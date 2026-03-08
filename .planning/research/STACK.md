# Stack Research: Redis Integration for Spring Boot 2.5.5

**Domain:** Redis caching, session management, and submission reliability
**Researched:** 2026-03-07
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Redis | 7.2-alpine | Distributed cache, session store, submission queue | Industry standard, Docker-friendly, low memory footprint with alpine |
| spring-boot-starter-data-redis | 2.5.15 (managed by Spring Boot BOM) | Redis integration with Spring Boot | Auto-configured by Spring Boot 2.5.5, includes Lettuce client + RedisTemplate + RedisCacheManager |
| Lettuce | 6.1.x (managed by Spring Boot BOM) | Non-blocking Redis client | Default client for Spring Boot 2.5.x, supports connection pooling, thread-safe |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| commons-pool2 | 2.11.x (managed) | Lettuce connection pooling | Required when configuring `spring.redis.lettuce.pool.*` properties |
| jackson-databind | 2.12.x (existing) | JSON serialization for Redis cache entries | Already in project, used for Redis value serialization |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| redis-cli | Redis debugging and monitoring | Included in Redis Docker image, use `docker exec -it redis redis-cli` |
| Redis Insight | GUI for Redis monitoring | Optional, run as separate Docker container during development |

## Installation

```xml
<!-- pom.xml additions -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
    <!-- Version managed by Spring Boot 2.5.5 parent POM -->
</dependency>

<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-pool2</artifactId>
    <!-- Version managed by Spring Boot BOM -->
</dependency>
```

```yaml
# docker-compose.yml addition
redis:
  image: redis:7.2-alpine
  restart: always
  command: redis-server --maxmemory 1536mb --maxmemory-policy allkeys-lru --appendonly yes
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
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Redis 7.2-alpine | Redis 6.2 | If Redis 7.x has compatibility issues with Lettuce 6.1.x (unlikely) |
| Lettuce (default) | Jedis | If blocking I/O is preferred or Lettuce has specific issues — not recommended for Spring Boot 2.5.x |
| Spring Data Redis | Redisson | If distributed locks, rate limiting, or advanced data structures are needed beyond what RedisTemplate provides |
| Single Redis instance | Redis Sentinel | When uptime SLA > 99.9% is required — defer to Phase 2+ |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| spring-boot-starter-data-redis 3.x | Requires Spring Framework 6+ / Java 17+, incompatible with Spring Boot 2.5.5 | Let Spring Boot BOM manage version (2.5.x) |
| Jedis client | Less performant than Lettuce for concurrent workloads, requires connection-per-thread | Lettuce (default, non-blocking, thread-safe) |
| Spring Session Redis | Adds complexity for stateless JWT-based app; assessment sessions are custom domain objects, not HTTP sessions | Custom Redis session service with RedisTemplate |
| Redis Cluster | Overkill for 200 concurrent users, adds operational complexity | Single Redis instance with allkeys-lru eviction |
| JDK serialization for Redis | 10x larger payloads, version-brittle, not human-readable | Jackson JSON serialization via GenericJackson2JsonRedisSerializer |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Spring Boot 2.5.5 | Spring Data Redis 2.5.x | Managed by spring-boot-starter-data-redis |
| Spring Data Redis 2.5.x | Lettuce 6.1.x | Auto-configured, connection pooling via commons-pool2 |
| Lettuce 6.1.x | Redis 6.x / 7.x | Full protocol compatibility |
| Redis 7.2-alpine | Docker 20.10+ | Current Docker on production server |
| Jackson 2.12.x (existing) | GenericJackson2JsonRedisSerializer | Used for cache entry serialization |

## Configuration by Profile

**Dev (localhost):**
```yaml
spring:
  redis:
    host: localhost
    port: 6379
    timeout: 2000ms
  cache:
    type: redis
    redis:
      time-to-live: 86400000  # 1 day
```

**Staging/Production (Docker):**
```yaml
spring:
  redis:
    host: redis  # Docker service name
    port: 6379
    timeout: 2000ms
    lettuce:
      pool:
        max-active: 50
        max-idle: 20
        min-idle: 5
  cache:
    type: redis
    redis:
      time-to-live: 86400000
```

## Memory Budget

| Component | Current | After Redis |
|-----------|---------|-------------|
| Java (api container) | 4GB | 3GB (reduce `-Xmx`) |
| MySQL | 3GB | 2GB |
| Redis | 0 | 1.5GB (`maxmemory 1536mb`) |
| OS + overhead | 1GB | 1.5GB |
| **Total** | **8GB** | **8GB** |

## Sources

- Spring Boot 2.5.5 dependency management BOM (verified compatible versions)
- Spring Data Redis 2.5.x reference documentation
- Redis official Docker images (redis:7.2-alpine)
- Existing codebase: `pom.xml`, `CacheConfig.java`, `application.yml`, `docker-compose.yml`

---
*Stack research for: Redis Integration with Spring Boot 2.5.5*
*Researched: 2026-03-07*
