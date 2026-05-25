# Redis Implementation Guide — Career-Nine v2.0

A complete technical reference for the Redis assessment upgrade. Covers architecture, every configuration class, the session lifecycle, caching strategy, data safety patterns, and frontend resilience — with full source code and the reasoning behind each decision.

**Milestone:** v2.0 Redis Assessment Upgrade
**Stack:** Spring Boot 2.5.5, Java 11, Redis 7.2-alpine, React 18, TypeScript, Axios 0.26.1
**Scope:** 5 phases, 10 plans, 33 files changed, +3,774 lines

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Phase 8 — Redis Infrastructure](#2-phase-8--redis-infrastructure)
   - [2.1 Docker Setup](#21-docker-setup)
   - [2.2 Maven Dependencies](#22-maven-dependencies)
   - [2.3 Application Configuration (YAML)](#23-application-configuration-yaml)
   - [2.4 RedisConfig — Template Beans](#24-redisconfig--template-beans)
   - [2.5 CacheErrorConfig — Graceful Degradation](#25-cacheerrorconfig--graceful-degradation)
3. [Phase 9 — Redis Caching Layer](#3-phase-9--redis-caching-layer)
   - [3.1 CacheConfig — RedisCacheManager](#31-cacheconfig--rediscachemanager)
   - [3.2 CacheWarmingConfig — Startup Warming](#32-cachewarmingconfig--startup-warming)
   - [3.3 Controller Cache Annotations](#33-controller-cache-annotations)
4. [Phase 10 — Session Management](#4-phase-10--session-management)
   - [4.1 AssessmentSession Model](#41-assessmentsession-model)
   - [4.2 AssessmentSessionService](#42-assessmentsessionservice)
   - [4.3 AssessmentSessionInterceptor](#43-assessmentsessioninterceptor)
   - [4.4 WebMvcConfig — Interceptor Registration](#44-webmvcconfig--interceptor-registration)
   - [4.5 startAssessment — Token Issuance](#45-startassessment--token-issuance)
   - [4.6 Idempotent Submission (SET NX)](#46-idempotent-submission-set-nx)
5. [Phase 11 — Safe Submission Pattern](#5-phase-11--safe-submission-pattern)
   - [5.1 Save-Before-Delete Pattern](#51-save-before-delete-pattern)
   - [5.2 Draft Auto-Save Endpoints](#52-draft-auto-save-endpoints)
6. [Phase 12 — Frontend Resilience](#6-phase-12--frontend-resilience)
   - [6.1 assessmentApi Axios Module](#61-assessmentapi-axios-module)
   - [6.2 Session Token Capture](#62-session-token-capture)
   - [6.3 AssessmentContext Migration](#63-assessmentcontext-migration)
   - [6.4 Submission State Machine](#64-submission-state-machine)
7. [Redis Key Schema](#7-redis-key-schema)
8. [Memory Budget & Constraints](#8-memory-budget--constraints)
9. [Data Flow Diagrams](#9-data-flow-diagrams)
10. [Key Decisions & Rationale](#10-key-decisions--rationale)
11. [Requirements Traceability](#11-requirements-traceability)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        React SPA (port 3000)                     │
│                                                                   │
│  assessmentApi (axios)                                            │
│  ├── Request interceptor → injects X-Assessment-Session,          │
│  │   X-Assessment-Student-Id, X-Assessment-Id headers             │
│  └── Response interceptor → retry 3x with exponential backoff     │
│                                                                   │
│  AllottedAssessmentPage → submission state machine                 │
│  AssessmentContext → uses assessmentApi for data fetching          │
└───────────────────────────────┬───────────────────────────────────┘
                                │ HTTP/REST
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Spring Boot API (port 8091)                    │
│                                                                   │
│  AssessmentSessionInterceptor                                     │
│  ├── Validates X-Assessment-Session header against Redis          │
│  ├── Returns 403 if invalid/expired                               │
│  └── Passes through if no header (backwards compatible)           │
│                                                                   │
│  AssessmentSessionService                                         │
│  ├── Sessions: career9:session:{studentId}:{assessmentId}        │
│  ├── Locks:    career9:submit:{studentId}:{assessmentId}         │
│  └── Drafts:   career9:draft:{studentId}:{assessmentId}          │
│                                                                   │
│  RedisCacheManager (@Cacheable / @CacheEvict)                     │
│  ├── career9:assessmentQuestions::{key}                           │
│  ├── career9:assessmentDetails::{key}                            │
│  └── career9:measuredQualityTypes::{key}                         │
│                                                                   │
│  CacheErrorConfig → swallows errors, falls back to DB             │
│  CacheWarmingConfig → warms caches on startup                     │
└───────────┬──────────────────────────┬────────────────────────────┘
            │ JDBC                     │ Lettuce (non-blocking)
            ▼                          ▼
      ┌──────────┐              ┌──────────────┐
      │  MySQL   │              │ Redis 7.2    │
      │  (3306)  │              │ (6379)       │
      │  2 GB    │              │ 1.5 GB       │
      └──────────┘              │ AOF persist  │
                                │ LRU eviction │
                                └──────────────┘
```

**What Redis does in this system:**

| Concern | Before Redis | After Redis |
|---------|-------------|-------------|
| Assessment caching | In-process Caffeine (lost on restart) | Distributed Redis (survives restarts) |
| Session validation | None (any student could load any assessment) | Server-side token validated per request |
| Duplicate submissions | No protection | SET NX idempotency lock |
| Answer safety | Delete-then-save (data loss window) | Save-before-delete + draft auto-save |
| Frontend errors | Generic `alert()` | Specific messages with retry |

---

## 2. Phase 8 — Redis Infrastructure

**Goal:** Redis is integrated with Spring Boot and fails gracefully when unavailable.

### 2.1 Docker Setup

Redis runs as a sidecar container alongside MySQL and the Spring Boot API, all on the same Docker network.

**docker-compose.yml** (Redis service):

```yaml
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

**The Spring Boot API depends on Redis being healthy before starting:**

```yaml
api:
  depends_on:
    redis_cache:
      condition: service_healthy
```

**Why these settings:**

| Setting | Value | Reason |
|---------|-------|--------|
| `maxmemory` | 1536mb | Fits within 8GB server budget (MySQL 2GB + API 3GB + Redis 1.5GB = 6.5GB) |
| `maxmemory-policy` | allkeys-lru | Assessment data is re-fetchable from DB, so evicting least-recently-used is safe |
| `appendonly yes` | AOF persistence | Sessions and drafts survive Redis restarts |
| `appendfsync everysec` | Fsync every second | Balance between durability and performance |
| `redis:7.2-alpine` | Alpine image | Minimal footprint (~30MB vs ~130MB for full image) |
| Health check | PING every 10s | Spring Boot waits for Redis before accepting traffic |

### 2.2 Maven Dependencies

Added to `spring-social/pom.xml`:

```xml
<!-- Spring Data Redis (version managed by Spring Boot BOM 2.5.5) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>

<!-- Connection pooling for Lettuce (the default Redis client in Spring Boot 2.5.x) -->
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-pool2</artifactId>
</dependency>
```

**Why Lettuce (not Jedis):** Lettuce is the default Redis client in Spring Boot 2.5.x. It uses Netty for non-blocking I/O, making it safe for connection pooling in a multithreaded Spring application. Jedis uses blocking I/O and requires careful thread-safety management.

### 2.3 Application Configuration (YAML)

Three profiles — `dev`, `staging`, `production` — each configure Redis differently:

**Dev profile** (localhost, small pool):

```yaml
spring:
  cache:
    type: redis
    cache-names: assessmentQuestions,assessmentDetails,measuredQualityTypes,questionnaireQuestions
    redis:
      time-to-live: 86400000    # 24 hours in milliseconds
      key-prefix: "career9:"
      use-key-prefix: true
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
```

**Staging/Production profile** (Docker hostname, larger pool):

```yaml
spring:
  cache:
    type: redis
    # same cache-names and redis settings
  redis:
    host: redis_cache          # Docker service name
    port: 6379
    timeout: 2000ms
    lettuce:
      pool:
        max-active: 50         # 200 concurrent users need more connections
        max-idle: 20
        min-idle: 5
        max-wait: 5000ms
      shutdown-timeout: 200ms
```

**Actuator health endpoint** (all profiles):

```yaml
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

**Why `spring.redis.*` not `spring.data.redis.*`:** Spring Boot 2.5.x uses the `spring.redis.*` namespace. The `spring.data.redis.*` namespace was introduced in Spring Boot 3.x. Using the wrong namespace silently ignores all configuration.

### 2.4 RedisConfig — Template Beans

**File:** `spring-social/src/main/java/com/kccitm/api/config/RedisConfig.java`

```java
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

**Two beans, two purposes:**

| Bean | Key Serializer | Value Serializer | Used For |
|------|---------------|-----------------|----------|
| `RedisTemplate<String, Object>` | String | JSON (GenericJackson2Json) | Sessions, drafts, submission locks — structured data |
| `StringRedisTemplate` | String | String | Simple key-value operations (future use) |

**Why GenericJackson2JsonRedisSerializer:** Stores objects as human-readable JSON in Redis (inspectable via `redis-cli`), and includes `@class` type hints for deserialization. The alternative (JdkSerializationRedisSerializer) produces opaque binary blobs. The tradeoff is slightly larger storage and no compile-time type safety on deserialization — hence the `convertToSession()` helper in `AssessmentSessionService`.

### 2.5 CacheErrorConfig — Graceful Degradation

**File:** `spring-social/src/main/java/com/kccitm/api/config/CacheErrorConfig.java`

```java
@Configuration
public class CacheErrorConfig extends CachingConfigurerSupport {

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

**How it works:** Spring's `@Cacheable` and `@CacheEvict` annotations route through this handler when Redis throws an exception (connection timeout, out of memory, etc.). Instead of propagating the exception and crashing the request, the handler logs a WARN and swallows the error. The original method executes normally, hitting the database as a fallback.

**Why WARN, not ERROR:** Cache failures are expected during Redis restarts or network blips. ERROR-level would trigger alerting. WARN is visible in logs but doesn't wake anyone up at 3 AM.

**Why `CachingConfigurerSupport`:** This is the Spring Boot 2.5.x way to register a global `CacheErrorHandler`. In Spring Boot 3.x, you'd implement `CachingConfigurer` directly (the `Support` class was deprecated).

---

## 3. Phase 9 — Redis Caching Layer

**Goal:** Assessment data served from distributed Redis cache with automatic invalidation.

### 3.1 CacheConfig — RedisCacheManager

**File:** `spring-social/src/main/java/com/kccitm/api/config/CacheConfig.java`

```java
@Configuration
public class CacheConfig {

    @Bean
    @Primary
    public CacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofDays(1))
                .serializeKeysWith(
                        RedisSerializationContext.SerializationPair
                            .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair
                            .fromSerializer(new GenericJackson2JsonRedisSerializer()))
                .prefixCacheNameWith("career9:")
                .disableCachingNullValues();

        Map<String, RedisCacheConfiguration> cacheConfigurations = new HashMap<>();
        cacheConfigurations.put("assessmentDetails", defaultConfig);
        cacheConfigurations.put("assessmentQuestions", defaultConfig);
        cacheConfigurations.put("measuredQualityTypes", defaultConfig);

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(cacheConfigurations)
                .transactionAware()
                .build();
    }
}
```

**Configuration breakdown:**

| Setting | Value | Purpose |
|---------|-------|---------|
| `entryTtl(Duration.ofDays(1))` | 24h | Assessment data changes infrequently; eviction is fast via `@CacheEvict` |
| `prefixCacheNameWith("career9:")` | Namespacing | All keys start with `career9:` to avoid collisions with other apps sharing Redis |
| `disableCachingNullValues()` | No null caching | Prevents caching empty results that would mask newly-created data |
| `transactionAware()` | Transaction participation | Cache writes only commit if the surrounding `@Transactional` succeeds |
| `@Primary` | Default CacheManager | Any `@Cacheable` without explicit `cacheManager` attribute uses this bean |

**What this replaces:** The previous `CaffeineCacheManager` was an in-process cache. If the server restarted, all cached assessment data was lost and the first wave of students would hit the database simultaneously (thundering herd). With Redis, the cache survives restarts.

### 3.2 CacheWarmingConfig — Startup Warming

**File:** `spring-social/src/main/java/com/kccitm/api/config/CacheWarmingConfig.java`

```java
@Configuration
public class CacheWarmingConfig implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger logger = LoggerFactory.getLogger(CacheWarmingConfig.class);

    @Autowired
    private AssessmentQuestionController assessmentQuestionController;

    @Autowired
    private MeasuredQualityTypesController measuredQualityTypesController;

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        try {
            logger.info("Starting cache warming...");

            assessmentQuestionController.getAllAssessmentQuestions();
            logger.info("Warmed assessmentQuestions cache");

            measuredQualityTypesController.getAllMeasuredQualityTypes();
            logger.info("Warmed measuredQualityTypes cache");

            logger.info("Cache warming completed successfully");
        } catch (Exception e) {
            logger.warn("Cache warming failed — application will continue, "
                       + "caches will populate on first request", e);
        }
    }
}
```

**Why inject controllers, not repositories:**  The `@Cacheable` annotation lives on the controller method. Spring AOP proxies intercept the call and check/populate the cache. If you call the repository directly, you bypass the proxy and the cache is never populated.

**Why `ApplicationReadyEvent`:** Fires after all beans are created, all startup callbacks are done, and the server is accepting requests. Using `@PostConstruct` would fire too early — the `CacheManager` bean might not be ready yet.

**Why not warm `assessmentDetails`:** This cache is keyed by assessment ID. Warming it would require iterating all assessments and loading each one — expensive and rarely needed at startup. It warms on-demand when a student accesses a specific assessment.

### 3.3 Controller Cache Annotations

Existing `@Cacheable` and `@CacheEvict` annotations on controllers automatically use the new `RedisCacheManager`:

```java
// AssessmentTableController.java

@Cacheable(value = "assessmentDetails", key = "#id")
@GetMapping("/getById/{id}")
public ResponseEntity<?> getAssessmentById(@PathVariable Long id) { ... }

@CacheEvict(value = "assessmentDetails", allEntries = true)
@PostMapping("/create")
public ResponseEntity<?> createAssessment(...) { ... }

// Similarly for lock/unlock/update/delete
```

```java
// AssessmentQuestionController.java

@Cacheable("assessmentQuestions")
@GetMapping("/getAll")
public ResponseEntity<?> getAllAssessmentQuestions() { ... }
```

**Cache eviction strategy:** Any mutation (create, update, delete, lock, unlock) evicts the entire `assessmentDetails` cache. This is aggressive but simple — with 200 concurrent students, the cache rebuilds in milliseconds from a single DB query.

---

## 4. Phase 10 — Session Management

**Goal:** Server-side sessions prevent wrong assessment loading and duplicate submissions.

**The problem:** When multiple students share a device (common in exam halls), the browser `localStorage` from one student's session would persist and the next student could load the wrong assessment. There was no server-side validation of "which student is taking which assessment right now."

### 4.1 AssessmentSession Model

**File:** `spring-social/src/main/java/com/kccitm/api/model/career9/AssessmentSession.java`

```java
@JsonIgnoreProperties(ignoreUnknown = true)
public class AssessmentSession implements Serializable {

    private static final long serialVersionUID = 1L;

    private String sessionToken;    // UUID, sent back to frontend
    private Long studentId;         // Which student
    private Long assessmentId;      // Which assessment
    private String startTime;       // ISO-8601 string (not Instant — see decision below)

    // Constructor, getters, setters...
}
```

**Why `String startTime` instead of `Instant`:** `GenericJackson2JsonRedisSerializer` stores Java type hints in JSON. `Instant` serializes to a complex nested object (`{"seconds": 1709827200, "nanos": 0}`). A plain ISO-8601 string like `"2026-03-07T14:00:00Z"` is simpler, human-readable in Redis, and avoids Jackson deserialization issues.

### 4.2 AssessmentSessionService

**File:** `spring-social/src/main/java/com/kccitm/api/service/AssessmentSessionService.java`

This is the central Redis service. It manages three concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                    AssessmentSessionService                       │
│                                                                   │
│  SESSION MANAGEMENT                                               │
│  ├── createSession(studentId, assessmentId) → AssessmentSession  │
│  ├── validateSession(studentId, assessmentId, token) → session   │
│  └── deleteSession(studentId, assessmentId)                      │
│                                                                   │
│  SUBMISSION LOCKING (SET NX)                                      │
│  ├── acquireSubmissionLock(studentId, assessmentId) → boolean    │
│  ├── markSubmissionComplete(studentId, assessmentId, result)     │
│  ├── getSubmissionResult(studentId, assessmentId) → Object       │
│  └── clearSubmissionLock(studentId, assessmentId)                │
│                                                                   │
│  DRAFT AUTO-SAVE                                                  │
│  ├── saveDraft(studentId, assessmentId, draftData)               │
│  ├── getDraft(studentId, assessmentId) → Object                  │
│  └── deleteDraft(studentId, assessmentId)                        │
└─────────────────────────────────────────────────────────────────┘
```

**Full implementation:**

```java
@Service
public class AssessmentSessionService {

    private static final String SESSION_KEY_PREFIX = "career9:session:";
    private static final String DRAFT_KEY_PREFIX   = "career9:draft:";
    private static final String SUBMIT_KEY_PREFIX  = "career9:submit:";
    private static final int SESSION_TTL_HOURS = 24;
    private static final int DRAFT_TTL_HOURS   = 24;
    private static final int SUBMIT_TTL_HOURS  = 24;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ── Session Management ──────────────────────────────────────

    public AssessmentSession createSession(Long studentId, Long assessmentId) {
        String token = UUID.randomUUID().toString();
        String key = SESSION_KEY_PREFIX + studentId + ":" + assessmentId;

        AssessmentSession session = new AssessmentSession(
                token, studentId, assessmentId, Instant.now().toString());

        redisTemplate.opsForValue().set(key, session, SESSION_TTL_HOURS, TimeUnit.HOURS);
        return session;
    }

    public AssessmentSession validateSession(Long studentId, Long assessmentId, String sessionToken) {
        String key = SESSION_KEY_PREFIX + studentId + ":" + assessmentId;
        Object value = redisTemplate.opsForValue().get(key);

        if (value == null) return null;

        AssessmentSession session = convertToSession(value);
        if (session == null || !sessionToken.equals(session.getSessionToken())) return null;

        // Sliding expiration: refresh TTL on each valid access
        redisTemplate.expire(key, SESSION_TTL_HOURS, TimeUnit.HOURS);
        return session;
    }

    public void deleteSession(Long studentId, Long assessmentId) {
        String key = SESSION_KEY_PREFIX + studentId + ":" + assessmentId;
        redisTemplate.delete(key);
    }

    // ── Submission Locking ──────────────────────────────────────

    public boolean acquireSubmissionLock(Long studentId, Long assessmentId) {
        String key = SUBMIT_KEY_PREFIX + studentId + ":" + assessmentId;
        Boolean result = redisTemplate.opsForValue()
                .setIfAbsent(key, "processing", SUBMIT_TTL_HOURS, TimeUnit.HOURS);
        return Boolean.TRUE.equals(result);
    }

    public void markSubmissionComplete(Long studentId, Long assessmentId, Object result) {
        String key = SUBMIT_KEY_PREFIX + studentId + ":" + assessmentId;
        redisTemplate.opsForValue().set(key, result, SUBMIT_TTL_HOURS, TimeUnit.HOURS);
    }

    public Object getSubmissionResult(Long studentId, Long assessmentId) {
        String key = SUBMIT_KEY_PREFIX + studentId + ":" + assessmentId;
        return redisTemplate.opsForValue().get(key);
    }

    public void clearSubmissionLock(Long studentId, Long assessmentId) {
        String key = SUBMIT_KEY_PREFIX + studentId + ":" + assessmentId;
        redisTemplate.delete(key);
    }

    // ── Draft Auto-Save ─────────────────────────────────────────

    public void saveDraft(Long studentId, Long assessmentId, Object draftData) {
        String key = DRAFT_KEY_PREFIX + studentId + ":" + assessmentId;
        redisTemplate.opsForValue().set(key, draftData, DRAFT_TTL_HOURS, TimeUnit.HOURS);
    }

    public Object getDraft(Long studentId, Long assessmentId) {
        String key = DRAFT_KEY_PREFIX + studentId + ":" + assessmentId;
        return redisTemplate.opsForValue().get(key);
    }

    public void deleteDraft(Long studentId, Long assessmentId) {
        String key = DRAFT_KEY_PREFIX + studentId + ":" + assessmentId;
        redisTemplate.delete(key);
    }

    // ── Helpers ─────────────────────────────────────────────────

    private AssessmentSession convertToSession(Object value) {
        if (value instanceof AssessmentSession) return (AssessmentSession) value;
        if (value instanceof Map) return objectMapper.convertValue(value, AssessmentSession.class);
        return null;
    }
}
```

**Why `convertToSession()`:** `GenericJackson2JsonRedisSerializer` sometimes deserializes JSON as a `LinkedHashMap` instead of the typed class (depends on classpath visibility and `@class` hints). This helper handles both cases safely.

**Why sliding expiration:** `redisTemplate.expire()` resets the TTL on every valid access. A student who starts an assessment and takes 6 hours won't have their session expire mid-exam. The 24h TTL only triggers on inactivity.

### 4.3 AssessmentSessionInterceptor

**File:** `spring-social/src/main/java/com/kccitm/api/config/AssessmentSessionInterceptor.java`

```java
@Component
public class AssessmentSessionInterceptor implements HandlerInterceptor {

    @Autowired
    private AssessmentSessionService sessionService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
                             Object handler) throws Exception {

        String sessionToken = request.getHeader("X-Assessment-Session");

        // No header = pass through (backwards compatible)
        if (sessionToken == null || sessionToken.isEmpty()) {
            return true;
        }

        String studentIdHeader = request.getHeader("X-Assessment-Student-Id");
        String assessmentIdHeader = request.getHeader("X-Assessment-Id");

        // Can't validate without IDs — pass through
        if (studentIdHeader == null || studentIdHeader.isEmpty()
                || assessmentIdHeader == null || assessmentIdHeader.isEmpty()) {
            return true;
        }

        Long studentId;
        Long assessmentId;
        try {
            studentId = Long.parseLong(studentIdHeader);
            assessmentId = Long.parseLong(assessmentIdHeader);
        } catch (NumberFormatException e) {
            return true;  // Invalid IDs — pass through
        }

        AssessmentSession session = sessionService.validateSession(
                studentId, assessmentId, sessionToken);

        if (session == null) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            response.getWriter().write(
                "{\"error\":\"Invalid or expired assessment session\"}");
            return false;
        }

        request.setAttribute("assessmentSession", session);
        return true;
    }
}
```

**The backwards-compatibility pattern:** The interceptor was designed to be deployed before the frontend sends session headers. If no `X-Assessment-Session` header is present, the request passes through unchanged. This allows incremental rollout — deploy the backend first, then the frontend.

**Why three separate headers (not a request body read):** HTTP request bodies can only be read once in a servlet. If the interceptor reads the body to extract student/assessment IDs, the controller can't read the body again. Using headers avoids this "consumed body" problem entirely.

### 4.4 WebMvcConfig — Interceptor Registration

```java
@Override
public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(assessmentSessionInterceptor)
            .addPathPatterns("/assessment-answer/**", "/assessments/**")
            .excludePathPatterns(
                "/assessments/getAll", "/assessments/create",
                "/assessments/update/**", "/assessments/delete/**",
                "/assessments/get/list", "/assessments/get/list-ids",
                "/assessments/prefetch/**",
                "/assessments/startAssessment"
            );
}
```

**What's intercepted:** Only student-facing assessment endpoints (submitting answers, fetching assessment data during an exam).

**What's excluded:** Admin CRUD operations, the prefetch endpoint (pre-session), and `startAssessment` itself (it creates the session, so it can't validate one yet).

### 4.5 startAssessment — Token Issuance

When a student starts an assessment, the controller creates a session and returns the token:

```java
// AssessmentTableController.java — startAssessment endpoint

AssessmentSession session = assessmentSessionService.createSession(
        userStudentId, assessmentId);

// Clear any stale submission lock from a previous attempt
assessmentSessionService.clearSubmissionLock(userStudentId, assessmentId);

Map<String, Object> response = new HashMap<>();
response.put("status", "ongoing");
response.put("sessionToken", session.getSessionToken());
return ResponseEntity.ok(response);
```

**Why clear the submission lock:** If a student started an assessment, the server crashed mid-submission, and the student restarts — the old SET NX lock would block the new submission. Clearing it on `startAssessment` ensures the student can retry.

### 4.6 Idempotent Submission (SET NX)

The submission endpoint uses Redis SET NX to prevent duplicate processing:

```java
// AssessmentAnswerController.java — submit endpoint (simplified)

// 1. Try to acquire the lock
if (!sessionService.acquireSubmissionLock(studentId, assessmentId)) {
    // Already locked — check if completed
    Object existingResult = sessionService.getSubmissionResult(studentId, assessmentId);
    if (existingResult != null && !"processing".equals(existingResult)) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(existingResult);
    }
    return ResponseEntity.status(HttpStatus.CONFLICT).body("Submission already in progress");
}

try {
    // 2. Process submission (save answers, calculate scores)
    // ... business logic ...

    // 3. Mark complete with cached result
    sessionService.markSubmissionComplete(studentId, assessmentId, resultMap);

    // 4. Clean up session and draft
    sessionService.deleteSession(studentId, assessmentId);
    sessionService.deleteDraft(studentId, assessmentId);

    return ResponseEntity.ok(resultMap);
} catch (Exception e) {
    // 5. Release lock on failure — allow retry
    sessionService.clearSubmissionLock(studentId, assessmentId);
    throw e;
}
```

**The SET NX lifecycle:**

```
Student clicks "Submit"
    │
    ├── acquireSubmissionLock() → Redis SETNX "career9:submit:42:7" = "processing"
    │   ├── true  → process submission → markSubmissionComplete() → 200 OK
    │   └── false → check existing result
    │       ├── "processing" → 409 "Submission in progress"
    │       └── {result}     → 409 + return cached result
    │
    └── On error → clearSubmissionLock() → student can retry
```

**Why release lock on failure:** If the database throws an exception during score calculation, the student is stuck — they can't retry because the lock exists. Releasing on failure allows retry. The lock only persists when submission actually succeeds (or is still processing).

---

## 5. Phase 11 — Safe Submission Pattern

**Goal:** Answer submissions are reliable and recoverable from failures.

### 5.1 Save-Before-Delete Pattern

**The problem:** The original code deleted existing answers before saving new ones:

```java
// BEFORE (unsafe)
assessmentAnswerRepository.deleteByUserStudent(userStudent);     // ← Data deleted
assessmentRawScoreRepository.deleteByMapping(mapping);           // ← Scores deleted
// If the server crashes HERE, all data is lost
assessmentAnswerRepository.saveAll(newAnswers);                  // ← Never reached
assessmentRawScoreRepository.saveAll(newScores);
```

**The fix — save first, then delete old records by specific ID:**

```java
// AFTER (safe)
// 1. Collect IDs of existing records
List<Long> existingAnswerIds = existingAnswers.stream()
        .map(AssessmentAnswer::getId).collect(Collectors.toList());
List<Long> existingScoreIds = existingScores.stream()
        .map(AssessmentRawScore::getId).collect(Collectors.toList());

// 2. Save new records FIRST
assessmentAnswerRepository.saveAll(newAnswers);
assessmentRawScoreRepository.saveAll(newScores);

// 3. Delete old records by specific ID (not a broad query)
if (!existingAnswerIds.isEmpty()) {
    assessmentAnswerRepository.deleteAllById(existingAnswerIds);
}
if (!existingScoreIds.isEmpty()) {
    assessmentRawScoreRepository.deleteAllById(existingScoreIds);
}
```

**Why this is safe:** If the server crashes after step 2 but before step 3, you have duplicate records (old + new) — but no data loss. The next submission attempt will clean up the duplicates. The existing `@Transactional` annotation provides automatic rollback if step 2 itself fails.

**Applied to all 4 endpoints:**
1. `submitAssessmentAnswers` — single student submission
2. `submitBulkAssessmentAnswers` — bulk admin upload
3. `submitBulkAssessmentAnswersText` — text-based bulk
4. `bulkSubmitUsingUrl` — URL-based bulk

### 5.2 Draft Auto-Save Endpoints

Two new REST endpoints allow the frontend to periodically backup answer state to Redis:

```java
// AssessmentAnswerController.java

@PostMapping("/draft-save")
public ResponseEntity<?> saveDraft(@RequestBody Map<String, Object> draftData) {
    Long studentId = ((Number) draftData.get("userStudentId")).longValue();
    Long assessmentId = ((Number) draftData.get("assessmentId")).longValue();
    sessionService.saveDraft(studentId, assessmentId, draftData);
    return ResponseEntity.ok("Draft saved");
}

@GetMapping("/draft-restore/{studentId}/{assessmentId}")
public ResponseEntity<?> restoreDraft(
        @PathVariable Long studentId, @PathVariable Long assessmentId) {
    Object draft = sessionService.getDraft(studentId, assessmentId);
    if (draft == null) {
        return ResponseEntity.notFound().build();
    }
    return ResponseEntity.ok(draft);
}
```

**Usage flow:**

```
Frontend (every 30 seconds):
    POST /assessment-answer/draft-save
    Body: { userStudentId, assessmentId, answers: [...] }
              │
              └── Redis: career9:draft:42:7 = { answers: [...] }  TTL: 24h

Browser crashes. Student reopens page:
    GET /assessment-answer/draft-restore/42/7
              │
              └── Returns saved answers → frontend repopulates form

Successful submission:
    sessionService.deleteDraft(studentId, assessmentId)
              │
              └── Redis: DEL career9:draft:42:7
```

**Draft cleanup on submission:** When the student successfully submits, the draft is deleted. The 24h TTL ensures abandoned drafts (student never comes back) are automatically cleaned up.

---

## 6. Phase 12 — Frontend Resilience

**Goal:** Frontend handles failures gracefully with clear user feedback.

### 6.1 assessmentApi Axios Module

**File:** `react-social/src/app/pages/StudentLogin/API/assessmentApi.ts`

```typescript
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface RetryableConfig extends InternalAxiosRequestConfig {
  __retryCount?: number;
}

const assessmentApi = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8091',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// ── Request Interceptor ─────────────────────────────────────────
// Automatically inject session headers on every request
assessmentApi.interceptors.request.use((config: RetryableConfig) => {
  const sessionToken = sessionStorage.getItem('assessmentSessionToken');
  const userStudentId = localStorage.getItem('userStudentId');
  const assessmentId = localStorage.getItem('assessmentId');

  if (sessionToken)  config.headers['X-Assessment-Session']    = sessionToken;
  if (userStudentId) config.headers['X-Assessment-Student-Id'] = userStudentId;
  if (assessmentId)  config.headers['X-Assessment-Id']         = assessmentId;

  return config;
});

// ── Response Interceptor ────────────────────────────────────────
// Retry network errors and 5xx with exponential backoff
assessmentApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    if (!config) return Promise.reject(error);

    const retryCount = config.__retryCount || 0;
    const isRetryable = !error.response || error.response.status >= 500;

    if (!isRetryable || retryCount >= MAX_RETRIES) {
      return Promise.reject(error);
    }

    config.__retryCount = retryCount + 1;
    const delay = BASE_DELAY_MS * Math.pow(2, config.__retryCount - 1);
    await new Promise((resolve) => setTimeout(resolve, delay));

    return assessmentApi(config);  // Retry the request
  }
);

// ── Error Message Utility ───────────────────────────────────────
export function getErrorMessage(error: AxiosError): string {
  if (!error.response) {
    return 'Unable to connect to the server. Please check your internet connection.';
  }
  switch (error.response.status) {
    case 403: return 'Your assessment session has expired. Please start again.';
    case 409: return 'Your assessment has already been submitted successfully.';
    case 400: {
      const data = error.response.data;
      return typeof data === 'string' ? data : 'Invalid submission data.';
    }
    case 500: return 'Server error. Your answers are saved. Please try again.';
    default:  return 'An unexpected error occurred. Please try again.';
  }
}

export default assessmentApi;
```

**Retry behavior:**

| Attempt | Delay | Total Wait |
|---------|-------|------------|
| 1st retry | 1 second | 1s |
| 2nd retry | 2 seconds | 3s |
| 3rd retry | 4 seconds | 7s |
| Give up | — | Show error to user |

**What gets retried vs. what doesn't:**

| Condition | Retry? | Reason |
|-----------|--------|--------|
| Network error (no response) | Yes | Transient connectivity issue |
| 500, 502, 503 | Yes | Server might recover |
| 400 Bad Request | No | Request is wrong, retrying won't help |
| 403 Forbidden | No | Session expired, need new session |
| 404 Not Found | No | Resource doesn't exist |
| 409 Conflict | No | Already submitted (treat as success) |

**Why `config.__retryCount` (direct mutation):** Axios 0.26.x clones the config object during request dispatch, but copies custom properties shallowly. Attaching `__retryCount` directly to the config object (rather than cloning the whole config) ensures the count persists across retries. This is a known pattern for pre-1.0 axios versions.

### 6.2 Session Token Capture

Both entry points to assessments capture the session token after `startAssessment`:

```typescript
// AllottedAssessmentPage.tsx — after startAssessment response
const data = await response.json();
if (data.sessionToken) {
  sessionStorage.setItem('assessmentSessionToken', data.sessionToken);
}
localStorage.setItem('assessmentId', String(assessment.assessmentId));

// DynamicDemographicForm.tsx — same pattern
if (data.sessionToken) {
  sessionStorage.setItem('assessmentSessionToken', data.sessionToken);
}
```

**Why `sessionStorage` (not `localStorage`):** Session tokens are intentionally ephemeral — they should not persist across browser sessions. If a student closes the browser and a different student opens it, the old token must be gone. `sessionStorage` is cleared when the tab closes; `localStorage` persists indefinitely.

**Why `assessmentId` uses `localStorage`:** The assessment ID is needed by the interceptor for every request. It's stored in `localStorage` because `AssessmentContext` (which fetches assessment data) may run in a different tab lifecycle than the one that called `startAssessment`.

### 6.3 AssessmentContext Migration

```typescript
// AssessmentContext.tsx — BEFORE (raw fetch)
const res = await fetch(`${BASE_URL}/assessments/getby/${assessmentId}`);
const data = await res.json();

// AssessmentContext.tsx — AFTER (assessmentApi with automatic headers + retry)
import assessmentApi from './API/assessmentApi';

const res = await assessmentApi.get(`/assessments/getby/${assessmentId}`);
const data = res.data;  // axios wraps response in .data
```

Every assessment API call now automatically gets:
- Session headers injected (request interceptor)
- Retry with backoff on failure (response interceptor)

### 6.4 Submission State Machine

```typescript
// AllottedAssessmentPage.tsx

const [submissionState, setSubmissionState] =
    useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
const [submissionError, setSubmissionError] = useState<string | null>(null);
```

**State transitions:**

```
    ┌──────┐
    │ idle │ ← initial state
    └──┬───┘
       │ user clicks "Submit"
       ▼
  ┌───────────┐
  │ submitting│ ← button disabled, spinner shown
  └──┬────┬───┘
     │    │
     │    │ API error (not 409)
     │    ▼
     │  ┌───────┐
     │  │ error │ ← error banner shown with retry button
     │  └───┬───┘
     │      │ user clicks "Retry"
     │      └──────→ back to "submitting"
     │
     │ API success OR 409 Conflict
     ▼
  ┌─────────┐
  │ success │ ← navigate to results
  └─────────┘
```

**Error UI:**

```tsx
{submissionState === 'error' && submissionError && (
  <div className="alert alert-danger mt-3" role="alert">
    <strong>Submission Failed</strong>
    <p>{submissionError}</p>
    <button className="btn btn-primary btn-sm" onClick={handleSubmit}>
      Retry Submission
    </button>
  </div>
)}
```

**Loading state (submit button):**

```tsx
{submissionState === 'submitting' ? (
  <button className="btn btn-primary" disabled>
    <span className="spinner-border spinner-border-sm me-2"
          role="status" aria-hidden="true" />
    Submitting...
  </button>
) : (
  <button className="btn btn-primary" onClick={handleSubmit}>
    Submit Assessment
  </button>
)}
```

**409 Conflict handling:** If the backend returns 409 (duplicate submission), the frontend treats it as success — the student's answers were already saved. This prevents a confusing "error" message when the student was just double-clicking.

---

## 7. Redis Key Schema

Every key in Redis follows a namespaced pattern:

```
career9:{domain}:{studentId}:{assessmentId}
```

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `career9:session:{studentId}:{assessmentId}` | JSON (AssessmentSession) | 24h (sliding) | Server-side session token binding student to assessment |
| `career9:submit:{studentId}:{assessmentId}` | String ("processing") or JSON (result) | 24h | SET NX idempotency lock for submission dedup |
| `career9:draft:{studentId}:{assessmentId}` | JSON (draft data) | 24h | Periodic backup of student's in-progress answers |
| `career9:assessmentQuestions::{hashKey}` | JSON (cached response) | 24h | Spring Cache: all assessment questions |
| `career9:assessmentDetails::{id}` | JSON (cached response) | 24h | Spring Cache: single assessment by ID |
| `career9:measuredQualityTypes::{hashKey}` | JSON (cached response) | 24h | Spring Cache: all measured quality types |

**Inspecting keys via redis-cli:**

```bash
# Connect to Redis
docker exec -it redis_cache redis-cli

# List all career9 keys
KEYS career9:*

# Check a session
GET career9:session:42:7

# Check memory usage
INFO memory

# Check cache hit rate
INFO stats
```

---

## 8. Memory Budget & Constraints

The application runs on an 8GB server. Every byte counts.

| Component | Before v2.0 | After v2.0 | Change |
|-----------|-------------|------------|--------|
| MySQL | 3 GB | 2 GB | -1 GB |
| Spring Boot API (JVM heap) | 4 GB | 3 GB | -1 GB |
| Redis | 0 GB | 1.5 GB | +1.5 GB |
| OS + overhead | ~1 GB | ~1.5 GB | +0.5 GB |
| **Total** | **8 GB** | **8 GB** | Net zero |

**Redis memory breakdown (estimated):**

| Data | Per-Key Size | Max Keys | Total |
|------|-------------|----------|-------|
| Sessions | ~500 bytes | 200 concurrent | ~100 KB |
| Submission locks | ~200 bytes | 200 concurrent | ~40 KB |
| Drafts | ~5 KB (answer array) | 200 concurrent | ~1 MB |
| Cached assessments | ~50 KB each | ~50 assessments | ~2.5 MB |
| Cached questions | ~500 KB | 1 (all questions) | ~500 KB |
| Cached quality types | ~100 KB | 1 (all types) | ~100 KB |
| **Total estimated** | | | **~4.2 MB** |

The 1.5 GB limit provides over 300x headroom. The `allkeys-lru` eviction policy will kick in only under extreme load — and since all data is re-fetchable from MySQL, eviction is safe.

---

## 9. Data Flow Diagrams

### Assessment Start Flow

```
Student                Frontend                 Spring Boot              Redis              MySQL
  │                       │                         │                      │                  │
  │──clicks "Start"──────►│                         │                      │                  │
  │                       │──POST /startAssessment─►│                      │                  │
  │                       │                         │──createSession()────►│                  │
  │                       │                         │  SET career9:session  │                  │
  │                       │                         │  :42:7 = {token,...} │                  │
  │                       │                         │◄─── OK ─────────────│                  │
  │                       │                         │──clearSubmitLock()──►│                  │
  │                       │                         │  DEL career9:submit  │                  │
  │                       │                         │  :42:7               │                  │
  │                       │◄──{sessionToken}────────│                      │                  │
  │                       │                         │                      │                  │
  │                       │──sessionStorage.setItem  │                      │                  │
  │                       │  ('assessmentSession     │                      │                  │
  │                       │   Token', token)         │                      │                  │
```

### Assessment Data Fetch Flow (with interceptor)

```
Student                Frontend                 Interceptor              Service             Redis
  │                       │                         │                      │                  │
  │──opens question──────►│                         │                      │                  │
  │                       │──GET /assessments/      │                      │                  │
  │                       │  getby/7                │                      │                  │
  │                       │  Headers:               │                      │                  │
  │                       │    X-Assessment-Session  │                      │                  │
  │                       │    X-Assessment-Student  │                      │                  │
  │                       │    X-Assessment-Id       │                      │                  │
  │                       │                         │                      │                  │
  │                       │                    ┌────┤──validateSession()──►│                  │
  │                       │                    │    │  GET career9:session  │                  │
  │                       │                    │    │  :42:7               │                  │
  │                       │                    │    │◄─── {session} ───────│                  │
  │                       │                    │    │                      │                  │
  │                       │                    │ OK │──expire(key, 24h)──►│                  │
  │                       │                    └────┤                      │                  │
  │                       │                         │                      │                  │
  │                       │                         │──@Cacheable check───►│                  │
  │                       │                         │  GET career9:assess   │                  │
  │                       │                         │  mentDetails::7      │                  │
  │                       │                         │◄─── {cached data} ──│                  │
  │                       │◄──── assessment data ───│                      │                  │
```

### Submission Flow (with idempotency)

```
Student                Frontend                 Controller               Service             Redis
  │                       │                         │                      │                  │
  │──clicks "Submit"─────►│                         │                      │                  │
  │                       │──submissionState =       │                      │                  │
  │                       │  "submitting"            │                      │                  │
  │                       │──POST /assessment-       │                      │                  │
  │                       │  answer/submit           │                      │                  │
  │                       │                         │──acquireSubmitLock()─►│                  │
  │                       │                         │  SETNX career9:sub   │                  │
  │                       │                         │  mit:42:7="process"  │                  │
  │                       │                         │◄─── true ────────────│                  │
  │                       │                         │                      │                  │
  │                       │                         │──save new answers────│──────────────────►│
  │                       │                         │──delete old answers──│──────────────────►│
  │                       │                         │──calculate scores────│──────────────────►│
  │                       │                         │                      │                  │
  │                       │                         │──markComplete()─────►│                  │
  │                       │                         │  SET career9:submit   │                  │
  │                       │                         │  :42:7 = {result}    │                  │
  │                       │                         │──deleteSession()────►│                  │
  │                       │                         │──deleteDraft()──────►│                  │
  │                       │◄──── 200 {result} ──────│                      │                  │
  │                       │──submissionState =       │                      │                  │
  │                       │  "success"               │                      │                  │
  │◄──navigate to results─│                         │                      │                  │
```

---

## 10. Key Decisions & Rationale

| # | Decision | Alternatives Considered | Rationale |
|---|----------|------------------------|-----------|
| 1 | Redis single instance (not Cluster/Sentinel) | Redis Cluster, Sentinel | 200 concurrent students doesn't need clustering. Single instance handles 100K+ ops/sec. |
| 2 | Spring Data Redis + Lettuce client | Jedis, Redisson | Default for Spring Boot 2.5.x. Lettuce is non-blocking (Netty), thread-safe without pooling (pooling added for connection reuse). |
| 3 | `GenericJackson2JsonRedisSerializer` | `JdkSerializationRedisSerializer`, `Jackson2JsonRedisSerializer` | Human-readable JSON in Redis CLI. JDK serialization produces binary blobs. Generic variant includes `@class` hints for polymorphic deser. |
| 4 | `spring.redis.*` namespace | `spring.data.redis.*` | Spring Boot 2.5.x uses the older namespace. 3.x uses the new one. Wrong namespace silently ignores all config. |
| 5 | ISO-8601 string for `startTime` | `java.time.Instant` | Avoids Jackson serialization complexity with `GenericJackson2JsonRedisSerializer`. Instant produces nested objects. |
| 6 | Backwards-compatible interceptor (pass-through on missing header) | Strict validation (reject if no header) | Allows deploying backend before frontend. Zero-downtime rollout. |
| 7 | Three separate HTTP headers | Read request body for IDs | Request body can only be read once in a servlet. Headers are always available. |
| 8 | Save-before-delete (not delete-then-save) | Upsert, REPLACE INTO | Works with JPA `saveAll()` without custom SQL. Temporary duplicates are safe; data loss is not. |
| 9 | `deleteAllById` (specific IDs) | `deleteByUserStudent` (broad query) | No new repository methods needed. More precise — won't accidentally delete newly-saved records. |
| 10 | Release submission lock on failure | Keep lock forever | Allows student retry. Lock only persists on actual success. |
| 11 | `sessionStorage` for token, `localStorage` for IDs | All in one storage | Session tokens must die with the tab (shared device safety). IDs need to persist across context changes. |
| 12 | Direct `__retryCount` mutation on config | Clone config per retry | Axios 0.26.x shallow-copies config. Direct mutation of custom properties survives the copy. |
| 13 | WARN-level cache error logging | ERROR-level | Cache misses are expected during Redis restarts. WARN is visible but doesn't trigger 3 AM alerts. |
| 14 | Inject controllers for cache warming | Inject repositories | `@Cacheable` is AOP-proxied. Calling the repository directly bypasses the cache proxy — cache never warms. |
| 15 | 24h TTL on sessions, drafts, locks | 1h, 12h, 48h | Matches the longest reasonable assessment duration. No assessment takes more than a day. |
| 16 | JVM heap 4GB→3GB, MySQL 3GB→2GB | Keep original sizes | Frees 2GB for Redis 1.5GB + OS overhead on an 8GB server. |

---

## 11. Requirements Traceability

Every requirement maps to a specific phase and implementation:

| Requirement | Phase | Implementation | File(s) |
|-------------|-------|----------------|---------|
| **INFRA-01**: Redis container | 8 | Docker service with 1.5GB, AOF, health check | `docker-compose.yml` |
| **INFRA-02**: Spring Data Redis + Lettuce | 8 | Maven deps + YAML per profile | `pom.xml`, `application.yml` |
| **INFRA-03**: Graceful degradation | 8 | CacheErrorHandler swallows exceptions | `CacheErrorConfig.java` |
| **INFRA-04**: Redis monitoring | 8 | Actuator health endpoint | `application.yml` (management section) |
| **CACHE-01**: RedisCacheManager replaces Caffeine | 9 | @Primary CacheManager bean | `CacheConfig.java` |
| **CACHE-02**: Cache invalidation on mutation | 9 | @CacheEvict on CRUD endpoints | `AssessmentTableController.java` |
| **CACHE-03**: Prefetch from Redis cache | 9 | @Cacheable on prefetch endpoint | `AssessmentTableController.java` |
| **CACHE-04**: Cache warming on startup | 9 | ApplicationReadyEvent listener | `CacheWarmingConfig.java` |
| **SESS-01**: Server-side sessions | 10 | Redis-backed session with interceptor | `AssessmentSessionService.java`, `AssessmentSessionInterceptor.java` |
| **SESS-02**: Idempotent submission (SET NX) | 10 | SETNX lock in submit endpoint | `AssessmentSessionService.java`, `AssessmentAnswerController.java` |
| **SESS-03**: Save-before-delete | 11 | Reordered save/delete in 4 endpoints | `AssessmentAnswerController.java` |
| **SESS-04**: Draft auto-save | 11 | POST /draft-save, GET /draft-restore | `AssessmentAnswerController.java`, `AssessmentSessionService.java` |
| **FRONT-01**: Session headers on all API calls | 12 | Axios request interceptor | `assessmentApi.ts` |
| **FRONT-02**: Retry with exponential backoff | 12 | Axios response interceptor | `assessmentApi.ts` |
| **FRONT-03**: Clear error messages + retry | 12 | State machine + getErrorMessage | `AllottedAssessmentPage.tsx`, `assessmentApi.ts` |

**Coverage:** 15/15 requirements implemented across 5 phases.

---

## File Index

All files created or modified in the v2.0 Redis upgrade:

### New Files (created)
| File | Phase | Purpose |
|------|-------|---------|
| `config/RedisConfig.java` | 8 | RedisTemplate + StringRedisTemplate beans |
| `config/CacheErrorConfig.java` | 8 | Graceful degradation for cache failures |
| `config/CacheConfig.java` | 9 | RedisCacheManager (replaces Caffeine) |
| `config/CacheWarmingConfig.java` | 9 | Warms critical caches on startup |
| `model/career9/AssessmentSession.java` | 10 | POJO for Redis session storage |
| `service/AssessmentSessionService.java` | 10 | Session, lock, and draft management |
| `config/AssessmentSessionInterceptor.java` | 10 | Validates session headers per request |
| `API/assessmentApi.ts` | 12 | Axios instance with interceptors |

### Modified Files
| File | Phase | Changes |
|------|-------|---------|
| `docker-compose.yml` | 8 | Added redis_cache service, redis_data volume, API depends_on |
| `pom.xml` | 8 | Added spring-boot-starter-data-redis, commons-pool2 |
| `application.yml` | 8, 9 | Redis connection config, cache type changed to redis |
| `config/WebMvcConfig.java` | 10 | Registered session interceptor |
| `controller/AssessmentTableController.java` | 9, 10 | Cache annotations, startAssessment returns token |
| `controller/AssessmentAnswerController.java` | 10, 11 | Idempotent submission, save-before-delete, draft endpoints |
| `AllottedAssessmentPage.tsx` | 12 | Session capture, state machine, error UI |
| `DynamicDemographicForm.tsx` | 12 | Session token capture |
| `AssessmentContext.tsx` | 12 | Migrated to assessmentApi |

---

*Document created: 2026-03-07*
*Covers: v2.0 Redis Assessment Upgrade (Phases 8-12)*
*Total implementation: 33 files, +3,774 lines, 10 plans, single-day execution*
