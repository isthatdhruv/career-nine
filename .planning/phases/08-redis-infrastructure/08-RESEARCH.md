# Phase 8: Redis Infrastructure - Research

**Researched:** 2026-03-07
**Domain:** Docker Redis container, Spring Boot 2.5.5 Redis integration, graceful degradation, Actuator health monitoring
**Confidence:** HIGH

## Summary

Phase 8 establishes Redis infrastructure without changing any caching behavior. The goal is to add a Redis 7.2-alpine container to the existing Docker Compose setup, integrate Spring Data Redis with Lettuce connection pooling into the Spring Boot 2.5.5 application, implement graceful degradation so the app never crashes when Redis is unavailable, and expose Redis health/metrics via Spring Actuator. No existing `@Cacheable` annotations change in this phase -- the cache type remains Caffeine. Redis is connected and monitored but not yet used as the cache backend.

This phase is foundational: if Redis connectivity, graceful degradation, and monitoring are not rock-solid before Phase 9 (cache migration), every subsequent phase inherits fragility. The key risk is version incompatibility between Spring Boot 2.5.5 and Redis dependencies, which is well-understood and documented below.

**Primary recommendation:** Add Redis container to docker-compose.yml, add `spring-boot-starter-data-redis` + `commons-pool2` to pom.xml (BOM-managed versions only), configure `spring.redis.*` properties per profile, implement `CacheErrorHandler` for graceful degradation, and expose Actuator health endpoint -- all without changing `spring.cache.type` from `caffeine`.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Redis | 7.2-alpine | In-memory data store (container) | Latest stable, alpine for minimal footprint (~5MB image), full protocol compat with Lettuce 6.1.x |
| spring-boot-starter-data-redis | 2.5.x (BOM-managed) | Spring Data Redis integration | Auto-configured by Spring Boot 2.5.5 parent BOM, includes Lettuce client + RedisTemplate + RedisCacheManager |
| Lettuce | 6.1.x (BOM-managed) | Non-blocking Redis client | Default client for Spring Boot 2.5.x, thread-safe, supports connection pooling via commons-pool2 |
| commons-pool2 | 2.11.x (BOM-managed) | Connection pooling for Lettuce | Required when configuring `spring.redis.lettuce.pool.*` properties |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| spring-boot-starter-actuator | 2.5.x (already in pom.xml) | Health checks, metrics | Already present -- just needs endpoint configuration for Redis |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Lettuce | Jedis | Jedis is blocking/connection-per-thread; Lettuce is non-blocking/thread-safe. Lettuce is the Spring Boot 2.5.x default. No reason to switch. |
| Redis 7.2-alpine | Redis 6.2-alpine | Redis 6.2 is LTS but 7.2 is current stable with no breaking changes for basic operations. Lettuce 6.1.x is protocol-compatible with both. |
| commons-pool2 pooling | Lettuce shared native connection (no pool) | Default Lettuce uses one shared connection, which is fine for most workloads. Pool needed for high-concurrency (200 students) to avoid head-of-line blocking on pipeline. |

**Installation (pom.xml):**
```xml
<!-- Version managed by Spring Boot 2.5.5 parent POM - do NOT specify version -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>

<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-pool2</artifactId>
</dependency>
```

**CRITICAL:** Do NOT specify explicit versions. Spring Boot 2.5.5 parent BOM manages compatible versions. Specifying `3.x` will break the app with `NoSuchMethodError`.

## Architecture Patterns

### Current State (What Exists)

```
docker-compose.yml
  services:
    mysql_db_api:    (MySQL, 3GB mem limit, career_shared_net)
    api:             (Spring Boot JAR, 4GB mem limit, career_shared_net, depends_on: mysql_db_api)
  networks:
    career_shared_net: external: true
  volumes:
    mysql_data:

Spring Boot:
  - @EnableCaching on SpringSocialApplication.java
  - CacheConfig.java: CaffeineCacheManager (assessmentDetails, assessmentQuestions, measuredQualityTypes)
  - application.yml: spring.cache.type: caffeine (all 3 profiles: dev, staging, production)
  - spring-boot-starter-actuator already in pom.xml (no endpoint exposure configured)
  - SecurityConfig.java: /actuator/* already permitted in antMatchers
```

### Target State (After Phase 8)

```
docker-compose.yml
  services:
    mysql_db_api:    (MySQL, 2GB mem limit -- reduced from 3GB)
    api:             (Spring Boot JAR, 3GB mem limit -- reduced from 4GB, depends_on: mysql_db_api + redis_cache)
    redis_cache:     (NEW: Redis 7.2-alpine, 1.5GB mem limit, career_shared_net)
  volumes:
    mysql_data:
    redis_data:      (NEW)

Spring Boot:
  - @EnableCaching: UNCHANGED
  - CacheConfig.java: UNCHANGED (still Caffeine, still @Primary)
  - NEW: RedisConfig.java: RedisConnectionFactory + RedisTemplate beans (NOT CacheManager yet)
  - NEW: CacheErrorHandler implementation for graceful degradation
  - application.yml: spring.redis.* properties added per profile, spring.cache.type: caffeine UNCHANGED
  - application.yml: management.* properties for Actuator Redis health
  - pom.xml: spring-boot-starter-data-redis + commons-pool2 added
```

### Pattern 1: Redis Container with Health Checks and AOF Persistence

**What:** Redis 7.2-alpine container on career_shared_net with memory limits, eviction policy, AOF persistence, and Docker health checks.

**When to use:** Every Redis deployment in Docker Compose.

**Example:**
```yaml
# docker-compose.yml addition
redis_cache:
  image: redis:7.2-alpine
  restart: always
  command: >
    redis-server
    --maxmemory 1536mb
    --maxmemory-policy allkeys-lru
    --appendonly yes
    --appendfsync everysec
  ports:
    - '6379:6379'
  deploy:
    resources:
      limits:
        memory: 1.5g
  networks:
    - career_shared_net
  volumes:
    - redis_data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 3s
    retries: 3
    start_period: 5s
```

**Key decisions:**
- `--maxmemory 1536mb`: Redis internal limit. Container limit is also 1.5GB. Redis overhead (~50-100MB for process) means effective cache is ~1.4GB.
- `--maxmemory-policy allkeys-lru`: When memory is full, evict least-recently-used keys. Safe because cached data is re-fetchable from MySQL.
- `--appendonly yes --appendfsync everysec`: AOF persistence writes every second. On Redis restart, data survives. Acceptable 1-second data loss window.
- `ports: '6379:6379'`: Exposed for local development. In production, can remove port mapping (containers communicate on career_shared_net).
- `healthcheck`: Docker knows when Redis is ready. `depends_on` with `condition: service_healthy` can be used by api service.

**Source:** Redis Docker official docs, verified with existing docker-compose.yml patterns in this project.

### Pattern 2: Spring Boot 2.5.5 Redis Property Configuration

**What:** Profile-specific `spring.redis.*` properties. In Spring Boot 2.x, the prefix is `spring.redis.*` (NOT `spring.data.redis.*` which is Spring Boot 3.x).

**When to use:** Every Spring Boot 2.5.x project with Redis.

**Example (application.yml additions):**
```yaml
---
spring:
  profiles: dev
  redis:
    host: localhost
    port: 6379
    timeout: 2000ms
    lettuce:
      pool:
        max-active: 8
        max-idle: 8
        min-idle: 2
        max-wait: 5000ms
      shutdown-timeout: 200ms

---
spring:
  profiles: staging
  redis:
    host: redis_cache
    port: 6379
    timeout: 2000ms
    lettuce:
      pool:
        max-active: 50
        max-idle: 20
        min-idle: 5
        max-wait: 5000ms
      shutdown-timeout: 200ms
```

**Key decisions:**
- `host: redis_cache` matches Docker Compose service name for DNS resolution on career_shared_net.
- `host: localhost` for dev profile (developer runs Redis locally or via Docker).
- `timeout: 2000ms`: Operation timeout. Fail fast instead of blocking threads.
- Pool sizing for staging: `max-active: 50` handles 200 concurrent students with connection reuse.
- Pool sizing for dev: `max-active: 8` is sufficient for local development.
- `spring.cache.type` remains `caffeine` in ALL profiles -- Redis is connected but not used as cache backend yet.

**Confidence:** HIGH -- verified that Spring Boot 2.x uses `spring.redis.*` prefix. The `spring.data.redis.*` prefix is Spring Boot 3.x only.

### Pattern 3: CacheErrorHandler for Graceful Degradation (INFRA-03)

**What:** Implement Spring's `CachingConfigurer` interface to provide a custom `CacheErrorHandler` that logs errors and swallows exceptions instead of propagating them. This means if Redis is down, `@Cacheable` silently falls through to the database query.

**When to use:** Any production system where cache failure should not cause application failure.

**Example:**
```java
// Source: Spring Framework CachingConfigurer interface
@Configuration
public class CacheErrorConfig implements CachingConfigurer {

    private static final Logger logger = LoggerFactory.getLogger(CacheErrorConfig.class);

    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                logger.warn("Cache GET failed [cache={}, key={}]: {}",
                    cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                logger.warn("Cache PUT failed [cache={}, key={}]: {}",
                    cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                logger.warn("Cache EVICT failed [cache={}, key={}]: {}",
                    cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCacheClearError(RuntimeException exception, Cache cache) {
                logger.warn("Cache CLEAR failed [cache={}]: {}",
                    cache.getName(), exception.getMessage());
            }
        };
    }
}
```

**Important limitation:** `CacheErrorHandler` does NOT handle errors when `@Cacheable(sync=true)` is used. In this codebase, none of the existing `@Cacheable` annotations use `sync=true`, so this is safe.

**Why this matters for Phase 8:** Even though the cache type is still Caffeine in Phase 8, implementing the error handler now means Phase 9 (switching to Redis cache) already has graceful degradation in place. If Redis goes down after Phase 9, the error handler catches the `RedisConnectionException` and the method executes normally (hitting the database).

**Confidence:** HIGH -- Spring Framework's `CachingConfigurer.errorHandler()` is documented and stable.

### Pattern 4: Actuator Redis Health and Metrics (INFRA-04)

**What:** Configure Spring Actuator to expose Redis health status and cache metrics.

**When to use:** Any production system with Redis.

**Example (application.yml additions):**
```yaml
# Add to each profile or to the default section
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,caches
  endpoint:
    health:
      show-details: always
      show-components: always
  health:
    redis:
      enabled: true
```

**What this provides:**
- `GET /actuator/health` -- includes Redis connection status (`UP`/`DOWN`), Redis version, memory usage
- `GET /actuator/health/redis` -- Redis-specific health details
- `GET /actuator/metrics/cache.*` -- Cache hit/miss rates, size, eviction counts
- `GET /actuator/caches` -- List of all registered cache names

**Security note:** The existing `SecurityConfig.java` already permits `/actuator/*` endpoints (line 147 of SecurityConfig.java). No security changes needed.

**Confidence:** HIGH -- `spring-boot-starter-actuator` is already in pom.xml, and `spring-boot-starter-data-redis` auto-registers `RedisHealthIndicator`.

### Anti-Patterns to Avoid

- **Adding RedisCacheManager in Phase 8:** Phase 8 is infrastructure only. Do NOT switch `spring.cache.type` to `redis` yet. That is Phase 9.
- **Specifying explicit dependency versions:** Let the Spring Boot BOM manage versions. Explicit versions cause classpath conflicts.
- **Exposing Redis port to public internet:** The `ports: '6379:6379'` mapping should only be used in dev. For staging/production, keep Redis on internal network only.
- **Skipping health checks:** Without Docker health checks, `depends_on` only waits for container start, not Redis readiness. The api container may try to connect before Redis is ready.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Redis connection management | Custom socket/connection code | `spring-boot-starter-data-redis` auto-configuration | Handles connection pooling, reconnection, serialization |
| Health monitoring | Custom Redis ping endpoint | Spring Actuator `RedisHealthIndicator` | Auto-registered when Redis starter is on classpath |
| Connection pooling | Custom pool implementation | `commons-pool2` via `spring.redis.lettuce.pool.*` | Battle-tested, configurable, integrated with Lettuce |
| Cache error handling | Try-catch around every `@Cacheable` method | Spring `CacheErrorHandler` via `CachingConfigurer` | Centralized, applies to all cache operations automatically |

**Key insight:** Spring Boot auto-configuration does almost all the work. Phase 8 is primarily configuration, not code. The only Java code needed is the `CacheErrorHandler` implementation and a `RedisConfig` class for the `RedisTemplate` bean.

## Common Pitfalls

### Pitfall 1: Spring Boot 2.5.5 vs 3.x Dependency Conflict

**What goes wrong:** Developer adds `spring-boot-starter-data-redis` with explicit version `3.x` or copies config from a Spring Boot 3.x tutorial using `spring.data.redis.*` property prefix.
**Why it happens:** Most current Redis + Spring Boot tutorials target Spring Boot 3.x. Spring Boot 2.5.5 is EOL.
**How to avoid:** Do NOT specify version on Redis dependencies. Use `spring.redis.*` prefix (not `spring.data.redis.*`). Verify with `mvn dependency:tree | grep redis` after adding dependency.
**Warning signs:** `NoSuchMethodError`, `ClassNotFoundException`, application fails to start.

### Pitfall 2: Docker DNS Resolution Failure

**What goes wrong:** Spring Boot app in `api` container cannot resolve `redis_cache` hostname because Redis is on a different Docker network or not yet started.
**Why it happens:** `career_shared_net` is external. Redis must explicitly join it. `depends_on` without health check condition only waits for container creation, not Redis readiness.
**How to avoid:** Add Redis to `career_shared_net` in docker-compose.yml. Add `healthcheck` to Redis service. Use `depends_on: redis_cache: condition: service_healthy` on api service (requires docker-compose version 2.1+ healthcheck syntax compatibility -- note: version 3.3 in current docker-compose.yml does not support `condition` in `depends_on`, so rely on Spring Boot's connection retry + graceful degradation).
**Warning signs:** `RedisConnectionException: Unable to connect to redis_cache:6379`, `UnknownHostException: redis_cache`.

### Pitfall 3: Memory Budget Miscalculation

**What goes wrong:** Adding 1.5GB Redis to an 8GB server without reducing MySQL and JVM memory causes OOM at the host level.
**Why it happens:** Current allocation: MySQL 3GB + JVM 4GB + OS ~1GB = 8GB. Adding Redis 1.5GB exceeds physical RAM.
**How to avoid:** Reduce JVM heap from `-Xmx4g` to `-Xmx2g` (command in docker-compose.yml). Reduce MySQL from 3GB to 2GB limit. Final: MySQL 2GB + JVM 3GB (2g heap + ~1g non-heap) + Redis 1.5GB + OS 1.5GB = 8GB.
**Warning signs:** Host-level OOM killer terminates containers, `docker logs` shows "Killed".

### Pitfall 4: Lettuce Fails Silently on Connection Loss

**What goes wrong:** Lettuce's default behavior on lost connection is to buffer commands and retry. If Redis is down for extended periods, command buffer grows unbounded, consuming JVM heap.
**Why it happens:** Lettuce is designed for transient failures with auto-reconnect. Extended outages are not its default scenario.
**How to avoid:** Set `spring.redis.timeout: 2000ms` and `spring.redis.lettuce.shutdown-timeout: 200ms`. The `CacheErrorHandler` catches the resulting exception after timeout. For Phase 8, this is sufficient since cache type is still Caffeine.
**Warning signs:** JVM heap grows when Redis is down, `OutOfMemoryError` after prolonged Redis outage.

### Pitfall 5: Actuator Endpoints Not Exposed

**What goes wrong:** Adding `spring-boot-starter-data-redis` auto-registers `RedisHealthIndicator`, but `/actuator/health` only shows `status: UP` without Redis details because `show-details` defaults to `never`.
**Why it happens:** Spring Actuator defaults are conservative. Health details are hidden. Only `health` and `info` endpoints are exposed by default.
**How to avoid:** Explicitly configure `management.endpoint.health.show-details: always` and `management.endpoints.web.exposure.include: health,info,metrics,caches`.
**Warning signs:** `/actuator/health` returns `{"status":"UP"}` with no component breakdown.

## Code Examples

### Example 1: RedisConfig.java (Connection Factory + Template Only)

```java
// Phase 8: Infrastructure only -- NO CacheManager bean
package com.kccitm.api.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.afterPropertiesSet();
        return template;
    }

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        return new StringRedisTemplate(connectionFactory);
    }
}
```

**Notes:**
- `RedisConnectionFactory` is auto-configured by Spring Boot from `spring.redis.*` properties. No need to define it manually.
- `LettuceConnectionFactory` with pool is auto-configured when `commons-pool2` is on the classpath AND `spring.redis.lettuce.pool.*` properties are set.
- `GenericJackson2JsonRedisSerializer` uses Jackson (already in project) for human-readable JSON in Redis.
- This bean is for future phases (session management, etc). Phase 8 just establishes it.

### Example 2: docker-compose.yml Complete Redis Addition

```yaml
services:
  redis_cache:
    image: redis:7.2-alpine
    restart: always
    command: >
      redis-server
      --maxmemory 1536mb
      --maxmemory-policy allkeys-lru
      --appendonly yes
      --appendfsync everysec
    ports:
      - '6379:6379'
    deploy:
      resources:
        limits:
          memory: 1.5g
    networks:
      - career_shared_net
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 5s

  api:
    # existing config...
    command: ["java", "-Xms1g", "-Xmx2g", "-jar", "/usr/local/lib/demo.jar"]
    depends_on:
      - mysql_db_api
      - redis_cache
    deploy:
      resources:
        limits:
          memory: 3g

  mysql_db_api:
    # existing config...
    deploy:
      resources:
        limits:
          memory: 2g

volumes:
  mysql_data:
  redis_data:
```

### Example 3: Verifying Redis Connection After Deployment

```bash
# 1. Start all containers
docker-compose up -d

# 2. Check Redis is healthy
docker-compose ps redis_cache
# Should show "healthy"

# 3. Test Redis from host
docker exec -it redis_cache redis-cli PING
# Should return: PONG

# 4. Check Redis memory config
docker exec -it redis_cache redis-cli CONFIG GET maxmemory
# Should return: 1536mb (1610612736 bytes)

docker exec -it redis_cache redis-cli CONFIG GET maxmemory-policy
# Should return: allkeys-lru

# 5. Check AOF persistence
docker exec -it redis_cache redis-cli CONFIG GET appendonly
# Should return: yes

# 6. Check Spring Boot Actuator
curl http://localhost:8080/actuator/health | jq .
# Should include: "redis": { "status": "UP", "details": { "version": "7.2.x" } }

# 7. Test Redis connectivity from api container
docker exec -it <api_container> sh -c "nc -zv redis_cache 6379"
# Should output: redis_cache (172.x.x.x:6379) open
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `spring.data.redis.*` properties | `spring.redis.*` properties (Spring Boot 2.x) | Spring Boot 3.0 renamed to `spring.data.redis.*` | Must use `spring.redis.*` for Spring Boot 2.5.5 |
| Jedis (blocking client) | Lettuce (non-blocking, default since Boot 2.0) | Spring Boot 2.0 (2018) | Already using correct approach |
| Manual RedisConnectionFactory bean | Auto-configured from properties | Spring Boot 2.x auto-config | Less code needed, just set properties |
| `SimpleCacheErrorHandler` (throws exceptions) | Custom `CacheErrorHandler` (swallows, logs) | Always been available, just rarely configured | Critical for graceful degradation |

**Deprecated/outdated:**
- `spring-boot-starter-data-redis-reactive`: Not needed for this project (using standard WebMvc, not WebFlux for cache). The existing `spring-boot-starter-webflux` in pom.xml is for outbound HTTP calls, not reactive Redis.

## Open Questions

1. **Redis password authentication**
   - What we know: Current docker-compose.yml Redis has no password. Redis is only accessible on `career_shared_net` (internal Docker network).
   - What's unclear: Whether production security policy requires Redis authentication even on internal networks.
   - Recommendation: Skip password for Phase 8 (internal network only). Add `--requirepass` and `spring.redis.password` in a later hardening phase if needed. This is consistent with how MySQL is configured (root password but accessible on internal network).

2. **JVM memory reduction from 4GB to 2GB**
   - What we know: Current JVM is `-Xms2g -Xmx4g`. We need to free 1.5GB for Redis. Reducing to `-Xms1g -Xmx2g` gives us the headroom.
   - What's unclear: Whether 2GB heap is sufficient for current workload (47 controllers, complex entity graphs, 200 concurrent students).
   - Recommendation: Monitor JVM heap usage with current traffic BEFORE reducing. If current usage is below 1.5GB (likely for 200 users), 2GB heap is safe. If not, reduce MySQL to 1.5GB instead.

3. **Docker Compose version 3.3 and `depends_on` with conditions**
   - What we know: Docker Compose v3.3 syntax does NOT support `depends_on: condition: service_healthy`. That syntax is v2.x only. Docker Compose v3 `depends_on` only controls startup order, not readiness.
   - What's unclear: Whether to downgrade to v2.x format or use Docker Compose v2 CLI (which supports health conditions regardless of file version).
   - Recommendation: Keep v3.3 format. Use simple `depends_on` (startup order only). Spring Boot's Lettuce client will auto-retry connections, and the `CacheErrorHandler` handles the brief window where Redis isn't ready yet. This is sufficient for graceful degradation.

4. **dev profile: Redis optional or required?**
   - What we know: Developers may not always run Redis locally.
   - What's unclear: Whether dev profile should fail-fast or degrade gracefully when Redis is absent.
   - Recommendation: For dev profile, Spring Boot will still try to connect to `localhost:6379`. With the `CacheErrorHandler` in place and cache type still set to Caffeine, Redis connection failure is harmless -- it just logs warnings. RedisTemplate operations (for future session service) will throw exceptions, but those aren't used in Phase 8.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `docker-compose.yml`, `pom.xml`, `application.yml`, `CacheConfig.java`, `SecurityConfig.java`, `SpringSocialApplication.java`
- Spring Boot 2.5.5 parent BOM manages spring-data-redis 2.5.x and Lettuce 6.1.x versions
- Redis Docker Hub: `redis:7.2-alpine` official image
- Spring Boot 2.x uses `spring.redis.*` property prefix (confirmed via Spring Boot 2.5 reference docs and web search)

### Secondary (MEDIUM confidence)
- [Spring Boot Redis with Lettuce and Jedis](https://howtodoinjava.com/spring-data/spring-boot-redis-with-lettuce-jedis/) -- connection pooling configuration patterns
- [Safeguarding Spring App From Cache Failure](https://dzone.com/articles/safeguard-spring-app-from-cache-failure) -- CacheErrorHandler pattern
- [Spring Boot Actuator Redis Health](https://runebook.dev/en/articles/spring_boot/application-properties/application-properties.actuator.management.health.redis.enabled) -- management.health.redis.enabled auto-configuration
- [CacheErrorHandler JavaDoc](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/interceptor/CacheErrorHandler.html) -- interface contract
- [Spring Data Redis Drivers](https://docs.spring.io/spring-data/redis/reference/redis/drivers.html) -- Lettuce connection pooling requires commons-pool2

### Tertiary (LOW confidence)
- Memory budget (8GB server with MySQL 3GB + JVM 4GB) -- from prior research docs, not verified against actual production server specs. Validate before reducing memory limits.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Spring Boot 2.5.5 + Redis is well-documented, BOM-managed versions eliminate guesswork
- Architecture: HIGH -- Docker Compose patterns verified against existing codebase, Actuator already partially configured
- Pitfalls: HIGH -- version incompatibility and Docker networking are well-known issues with clear solutions
- Memory budget: MEDIUM -- based on prior research docs, not validated against live production metrics

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable technology, unlikely to change)
