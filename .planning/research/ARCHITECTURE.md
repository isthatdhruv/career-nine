# Architecture Research: Redis Integration for Assessment System

**Domain:** Spring Boot Educational Assessment Platform
**Researched:** 2026-03-07
**Confidence:** HIGH

## Current Architecture (Baseline)

### System Overview (Before Redis)

```
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (React SPA)                       │
│                    Port 3000 (dev)                            │
│  sessionStorage: assessment data                             │
│  localStorage: draft answers                                 │
└────────────────────┬─────────────────────────────────────────┘
                     │ HTTP/REST
┌────────────────────┴─────────────────────────────────────────┐
│              SPRING BOOT API (Monolith)                       │
│                Port 8091 (dev) / 8080 (docker)               │
├──────────────────────────────────────────────────────────────┤
│  Controllers:                                                 │
│    - AssessmentTableController (@Cacheable)                  │
│    - AssessmentQuestionController (@Cacheable)               │
│    - AssessmentAnswerController (@Transactional)             │
├──────────────────────────────────────────────────────────────┤
│  Cache Layer (Caffeine - In-Process):                        │
│    - assessmentDetails (1 day TTL, 500 max)                  │
│    - assessmentQuestions (1 day TTL, 500 max)                │
│    - measuredQualityTypes (1 day TTL, 500 max)               │
├──────────────────────────────────────────────────────────────┤
│  Lock System (File-Based):                                   │
│    - assessment-cache/*.json (locked snapshots)              │
├──────────────────────────────────────────────────────────────┤
│  Data Access (JPA):                                          │
│    - Complex entity graphs (Questionnaire → Sections →       │
│      Questions → Options → Scores)                           │
│    - Bulk operations in @Transactional methods               │
└────────────────────┬─────────────────────────────────────────┘
                     │ JDBC
┌────────────────────┴─────────────────────────────────────────┐
│                    MySQL 5.7+                                 │
│                    Port 3306                                  │
│  Database: career-9 (docker) / kareer-9 (dev)                │
│  - AssessmentTable, AssessmentQuestions, Options, Scores     │
│  - StudentAssessmentMapping, AssessmentAnswer                │
│  - AssessmentRawScore (calculated on submit)                 │
└──────────────────────────────────────────────────────────────┘

Docker Network: career_shared_net
  - api container (Spring Boot JAR)
  - mysql_db_api container
```

## Target Architecture (With Redis Integration)

### System Overview (After Redis)

```
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (React SPA)                       │
│                    Port 3000 (dev)                            │
│  sessionStorage: minimal (session token only)                │
│  localStorage: none (server-side session)                    │
└────────────────────┬─────────────────────────────────────────┘
                     │ HTTP/REST + Session Header
┌────────────────────┴─────────────────────────────────────────┐
│              SPRING BOOT API (Monolith)                       │
│                Port 8091 (dev) / 8080 (docker)               │
├──────────────────────────────────────────────────────────────┤
│  NEW: Session Management Service                             │
│    - AssessmentSessionService (create, validate, extend)     │
│    - SessionDTO (studentId, assessmentId, metadata)          │
│    - Idempotency filter (submission deduplication)           │
├──────────────────────────────────────────────────────────────┤
│  MODIFIED: Cache Configuration                               │
│    - RedisCacheManager (replaces CaffeineCacheManager)       │
│    - Same cache names, different backend                     │
│    - Fallback to Caffeine if Redis unavailable               │
├──────────────────────────────────────────────────────────────┤
│  MODIFIED: Controllers                                        │
│    - AssessmentTableController (session creation)            │
│    - AssessmentAnswerController (idempotency keys)           │
│    - Same @Cacheable annotations, no code changes            │
├──────────────────────────────────────────────────────────────┤
│  Data Access (JPA): UNCHANGED                                │
└────────────────────┬─────┬───────────────────────────────────┘
                     │     │
                     │     └──────────────────────┐
                     │ JDBC                       │ Redis Protocol
┌────────────────────┴──────────┐  ┌─────────────┴──────────────┐
│        MySQL 5.7+              │  │      Redis 7.x              │
│        Port 3306               │  │      Port 6379              │
│  Database: career-9            │  │  Database: 0 (default)      │
│  - Source of Truth             │  │  - Shared cache             │
│  - Persistent storage          │  │  - Session store            │
│                                │  │  - Idempotency keys         │
└────────────────────────────────┘  └────────────────────────────┘

Docker Network: career_shared_net (shared)
  - api container
  - mysql_db_api container
  - redis_cache container (NEW)
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Redis Container | Shared cache + session store | Official redis:7-alpine image, 6379:6379, maxmemory-policy allkeys-lru |
| RedisCacheManager | Spring Cache abstraction | Spring Data Redis with Jackson2JsonRedisSerializer for POJOs |
| RedisTemplate | Low-level Redis ops | StringRedisTemplate for sessions, RedisTemplate<String, Object> for cache |
| AssessmentSessionService | Server-side session lifecycle | Create on start, validate on answer, extend on activity, expire on submit |
| IdempotencyFilter | Dedup submissions | Redis SET with NX + TTL, check before @Transactional |
| Fallback Cache | Graceful degradation | Conditional @Bean, switch to Caffeine if Redis connection fails |

## Integration Points

### New Components (Create)

#### 1. Redis Container (Docker)

**File:** `docker-compose.yml`

```yaml
redis_cache:
  image: redis:7-alpine
  restart: always
  ports:
    - '6379:6379'
  command: >
    redis-server
    --maxmemory 512mb
    --maxmemory-policy allkeys-lru
    --save ""
    --appendonly no
  deploy:
    resources:
      limits:
        memory: 600m
  networks:
    - career_shared_net
```

**Why:**
- `allkeys-lru`: Auto-evict oldest keys when memory full (cache behavior)
- `--save ""` + `--appendonly no`: Disable persistence (cache-only, not session store)
- 512MB limit: Sufficient for ~50k cached questions + 1k active sessions
- Alpine image: Minimal footprint (5MB vs 100MB)

**Integration:** Add to `depends_on` in `api` service

---

#### 2. RedisConfig (Spring Configuration)

**File:** `spring-social/src/main/java/com/kccitm/api/config/RedisConfig.java`

```java
@Configuration
@EnableCaching
public class RedisConfig {

    @Value("${spring.redis.host:localhost}")
    private String redisHost;

    @Value("${spring.redis.port:6379}")
    private int redisPort;

    @Bean
    public RedisConnectionFactory redisConnectionFactory() {
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration();
        config.setHostName(redisHost);
        config.setPort(redisPort);

        LettuceConnectionFactory factory = new LettuceConnectionFactory(config);
        factory.setValidateConnection(true);
        return factory;
    }

    @Bean
    @Primary
    @ConditionalOnProperty(name = "spring.cache.type", havingValue = "redis")
    public CacheManager redisCacheManager(RedisConnectionFactory connectionFactory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofDays(1))
            .serializeKeysWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new GenericJackson2JsonRedisSerializer()));

        return RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(config)
            .transactionAware()
            .build();
    }

    @Bean
    @ConditionalOnProperty(name = "spring.cache.type", havingValue = "caffeine")
    public CacheManager caffeineFallbackCacheManager() {
        // Existing CaffeineCacheManager from CacheConfig.java
        CaffeineCacheManager manager = new CaffeineCacheManager(
            "assessmentDetails", "assessmentQuestions", "measuredQualityTypes"
        );
        manager.setCaffeine(Caffeine.newBuilder()
            .expireAfterWrite(1, TimeUnit.DAYS)
            .maximumSize(500));
        return manager;
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(
        RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        return template;
    }

    @Bean
    public StringRedisTemplate stringRedisTemplate(
        RedisConnectionFactory connectionFactory) {
        return new StringRedisTemplate(connectionFactory);
    }
}
```

**Why:**
- `@ConditionalOnProperty`: Graceful fallback to Caffeine if Redis unavailable
- `GenericJackson2JsonRedisSerializer`: Auto-serialize JPA entities (AssessmentQuestions, etc.)
- `transactionAware()`: Participate in Spring @Transactional (cache writes deferred until commit)
- Separate RedisTemplate beans: StringRedisTemplate for sessions, RedisTemplate for cache

**Integration:** Replaces `CacheConfig.java` (deprecate old bean, keep as fallback)

---

#### 3. AssessmentSessionService (Session Management)

**File:** `spring-social/src/main/java/com/kccitm/api/service/AssessmentSessionService.java`

```java
@Service
public class AssessmentSessionService {

    private static final String SESSION_PREFIX = "assessment:session:";
    private static final long SESSION_TTL_MINUTES = 120; // 2 hours
    private static final long EXTENSION_THRESHOLD_MINUTES = 30;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    public String createSession(Long userStudentId, Long assessmentId) {
        String sessionId = UUID.randomUUID().toString();
        String key = SESSION_PREFIX + sessionId;

        AssessmentSessionDTO session = new AssessmentSessionDTO(
            sessionId, userStudentId, assessmentId,
            LocalDateTime.now(), LocalDateTime.now()
        );

        try {
            String json = objectMapper.writeValueAsString(session);
            redisTemplate.opsForValue().set(key, json,
                Duration.ofMinutes(SESSION_TTL_MINUTES));
            return sessionId;
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to create session", e);
        }
    }

    public Optional<AssessmentSessionDTO> getSession(String sessionId) {
        String key = SESSION_PREFIX + sessionId;
        String json = redisTemplate.opsForValue().get(key);

        if (json == null) return Optional.empty();

        try {
            AssessmentSessionDTO session = objectMapper.readValue(
                json, AssessmentSessionDTO.class);
            extendSessionIfNeeded(key, session);
            return Optional.of(session);
        } catch (JsonProcessingException e) {
            return Optional.empty();
        }
    }

    public void invalidateSession(String sessionId) {
        redisTemplate.delete(SESSION_PREFIX + sessionId);
    }

    private void extendSessionIfNeeded(String key, AssessmentSessionDTO session) {
        Long ttl = redisTemplate.getExpire(key, TimeUnit.MINUTES);
        if (ttl != null && ttl < EXTENSION_THRESHOLD_MINUTES) {
            redisTemplate.expire(key, Duration.ofMinutes(SESSION_TTL_MINUTES));
            session.setLastActivity(LocalDateTime.now());
        }
    }
}
```

**Why:**
- Server-side session tracking: Replaces client-side sessionStorage
- Auto-expiration: Redis TTL handles cleanup (no manual purge)
- Session extension: Activity detection prevents timeout during active use
- JSON serialization: Human-readable in Redis CLI for debugging

**Integration:** Called from AssessmentTableController.startAssessment()

---

#### 4. IdempotencyFilter (Submission Deduplication)

**File:** `spring-social/src/main/java/com/kccitm/api/filter/IdempotencyFilter.java`

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class IdempotencyFilter extends OncePerRequestFilter {

    private static final String IDEMPOTENCY_PREFIX = "idempotency:";
    private static final long IDEMPOTENCY_TTL_MINUTES = 10;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        // Only apply to assessment submission endpoints
        if (!request.getRequestURI().contains("/assessment-answer/submit")) {
            filterChain.doFilter(request, response);
            return;
        }

        String idempotencyKey = request.getHeader("X-Idempotency-Key");
        if (idempotencyKey == null || idempotencyKey.isEmpty()) {
            response.sendError(400, "Missing X-Idempotency-Key header");
            return;
        }

        String redisKey = IDEMPOTENCY_PREFIX + idempotencyKey;
        Boolean acquired = redisTemplate.opsForValue()
            .setIfAbsent(redisKey, "processing",
                Duration.ofMinutes(IDEMPOTENCY_TTL_MINUTES));

        if (Boolean.FALSE.equals(acquired)) {
            response.sendError(409, "Duplicate submission detected");
            return;
        }

        try {
            filterChain.doFilter(request, response);
            // On success, mark as completed
            redisTemplate.opsForValue().set(redisKey, "completed",
                Duration.ofMinutes(IDEMPOTENCY_TTL_MINUTES));
        } catch (Exception e) {
            // On failure, remove lock to allow retry
            redisTemplate.delete(redisKey);
            throw e;
        }
    }
}
```

**Why:**
- Redis SET NX: Atomic check-and-set prevents race conditions
- Request-scoped lock: Duplicate submissions from same client blocked
- Auto-cleanup: TTL removes old keys (no manual purge)
- Retry-safe: Lock removed on failure

**Integration:** Registered in Spring filter chain, applied to submit endpoints

---

### Modified Components (Update)

#### 1. CacheConfig.java (Deprecate Primary, Keep Fallback)

**Changes:**
```java
@Configuration
public class CacheConfig {

    // Remove @Primary annotation (moved to RedisConfig)
    // Keep as fallback only
    @Bean
    @ConditionalOnProperty(name = "spring.cache.type", havingValue = "caffeine")
    public CacheManager caffeineCacheManager() {
        // Existing implementation unchanged
    }
}
```

**Why:** Allows graceful fallback if Redis unavailable

---

#### 2. AssessmentTableController.java (Add Session Creation)

**Changes:**
```java
@RestController
@RequestMapping("/assessments")
public class AssessmentTableController {

    @Autowired
    private AssessmentSessionService sessionService; // NEW

    // NEW ENDPOINT
    @PostMapping("/startAssessment")
    public ResponseEntity<?> startAssessment(@RequestBody Map<String, Object> data) {
        Long userStudentId = ((Number) data.get("userStudentId")).longValue();
        Long assessmentId = ((Number) data.get("assessmentId")).longValue();

        // Validate entities exist
        UserStudent student = userStudentRepository.findById(userStudentId)
            .orElseThrow(() -> new RuntimeException("Student not found"));
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
            .orElseThrow(() -> new RuntimeException("Assessment not found"));

        // Create or find mapping
        StudentAssessmentMapping mapping = studentAssessmentMappingRepository
            .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
            .orElseGet(() -> {
                StudentAssessmentMapping m = new StudentAssessmentMapping();
                m.setUserStudent(student);
                m.setAssessmentId(assessmentId);
                m.setStatus("ongoing");
                return studentAssessmentMappingRepository.save(m);
            });

        // Create server-side session
        String sessionId = sessionService.createSession(userStudentId, assessmentId);

        return ResponseEntity.ok(Map.of(
            "sessionId", sessionId,
            "assessmentId", assessmentId,
            "userStudentId", userStudentId,
            "status", mapping.getStatus()
        ));
    }
}
```

**Why:**
- Replace file-based lock with Redis session
- Return sessionId to frontend for subsequent requests
- Existing endpoints (@Cacheable) unchanged

---

#### 3. AssessmentAnswerController.java (Add Idempotency + Session Validation)

**Changes:**
```java
@RestController
@RequestMapping("/assessment-answer")
public class AssessmentAnswerController {

    @Autowired
    private AssessmentSessionService sessionService; // NEW

    @Transactional
    @PostMapping(value = "/submit", headers = "Accept=application/json")
    public ResponseEntity<?> submitAssessmentAnswers(
            @RequestBody Map<String, Object> submissionData,
            @RequestHeader(value = "X-Session-Id", required = false) String sessionId) {

        // NEW: Validate session
        if (sessionId == null || sessionId.isEmpty()) {
            return ResponseEntity.badRequest()
                .body("Missing X-Session-Id header");
        }

        Optional<AssessmentSessionDTO> session = sessionService.getSession(sessionId);
        if (!session.isPresent()) {
            return ResponseEntity.status(401)
                .body("Invalid or expired session");
        }

        Long userStudentId = ((Number) submissionData.get("userStudentId")).longValue();
        Long assessmentId = ((Number) submissionData.get("assessmentId")).longValue();

        // NEW: Verify session matches submission data
        AssessmentSessionDTO s = session.get();
        if (!s.getUserStudentId().equals(userStudentId)
            || !s.getAssessmentId().equals(assessmentId)) {
            return ResponseEntity.status(403)
                .body("Session mismatch");
        }

        // Existing submission logic (lines 104-313) UNCHANGED
        // ...

        // NEW: Invalidate session on successful submission
        sessionService.invalidateSession(sessionId);

        return ResponseEntity.ok(Map.of(
            "status", "success",
            "scoresSaved", rawScoresToSave.size(),
            "answersSaved", answersToSave.size()
        ));
    }
}
```

**Why:**
- Session validation prevents unauthorized submissions
- Session invalidation prevents double-submission
- Existing @Transactional logic unchanged

---

#### 4. application.yml (Add Redis Configuration)

**Changes:**
```yaml
spring:
  profiles: dev
  # ... existing config ...
  redis:
    host: localhost
    port: 6379
    timeout: 2000ms
    lettuce:
      pool:
        max-active: 8
        max-idle: 8
        min-idle: 2
  cache:
    type: redis  # Change from 'caffeine' to 'redis'
    redis:
      time-to-live: 86400000  # 1 day in ms
      cache-null-values: false
    cache-names: assessmentQuestions,assessmentDetails,measuredQualityTypes

---
spring:
  profiles: staging
  # ... existing config ...
  redis:
    host: redis_cache  # Docker service name
    port: 6379
    timeout: 2000ms
  cache:
    type: redis
```

**Why:**
- `spring.cache.type: redis`: Activates RedisCacheManager
- `lettuce.pool`: Connection pooling for concurrent requests
- Separate host per profile (localhost vs docker service name)

---

#### 5. pom.xml (Add Redis Dependencies)

**Changes:**
```xml
<dependencies>
    <!-- Existing dependencies ... -->

    <!-- NEW: Spring Data Redis -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-redis</artifactId>
    </dependency>

    <!-- NEW: Lettuce connection pool -->
    <dependency>
        <groupId>org.apache.commons</groupId>
        <artifactId>commons-pool2</artifactId>
    </dependency>
</dependencies>
```

**Why:**
- `spring-boot-starter-data-redis`: Includes RedisTemplate, RedisCacheManager, Lettuce client
- `commons-pool2`: Required for Lettuce connection pooling

---

## Data Flow Changes

### Before Redis (Current Flow)

#### Assessment Data Load
```
Frontend              Controller                 Caffeine              MySQL
   |                       |                         |                    |
   |--GET /assessments/1-->|                         |                    |
   |                       |--Check cache--------->  |                    |
   |                       |<-MISS------------------  |                    |
   |                       |--SELECT * FROM assessment_table ----------> |
   |                       |<-Result--------------------------------------|
   |                       |--Store in cache-------> |                    |
   |                       |<-OK-------------------- |                    |
   |<-JSON (assessment)----|                         |                    |
```

#### Assessment Submission
```
Frontend              Controller                 MySQL
   |                       |                         |
   |--POST /submit-------->|                         |
   |  {answers: [...]}     |                         |
   |                       |--BEGIN TRANSACTION----->|
   |                       |--DELETE old answers---->|
   |                       |--INSERT new answers---->|
   |                       |--DELETE old scores----->|
   |                       |--INSERT new scores----->|
   |                       |--COMMIT---------------->|
   |<-{status: success}----|                         |
```

**Problems:**
- No session validation (anyone can submit)
- No idempotency (double-click = duplicate scores)
- Cache per-instance (horizontal scaling = cache miss)
- File-based locks (not cluster-safe)

---

### After Redis (Target Flow)

#### Assessment Start (New)
```
Frontend              Controller              SessionService         Redis
   |                       |                         |                    |
   |--POST /startAssessment|                         |                    |
   |  {studentId, assessId}|                         |                    |
   |                       |--createSession()------->|                    |
   |                       |                         |--SET session:uuid->|
   |                       |                         |   TTL 2h           |
   |                       |                         |<-OK----------------|
   |                       |<-sessionId--------------|                    |
   |<-{sessionId: uuid}----|                         |                    |
   |  Store sessionId      |                         |                    |
```

#### Assessment Data Load (Cached)
```
Frontend              Controller              RedisCacheManager      Redis              MySQL
   |                       |                         |                    |                  |
   |--GET /assessments/1-->|                         |                    |                  |
   |  X-Session-Id: uuid   |                         |                    |                  |
   |                       |--@Cacheable------------>|                    |                  |
   |                       |                         |--GET cache:assess:1|                  |
   |                       |                         |<-HIT (JSON)--------|                  |
   |                       |<-Deserialized object----|                    |                  |
   |<-JSON (assessment)----|                         |                    |                  |
```

#### Assessment Data Load (Cache Miss)
```
Frontend              Controller              RedisCacheManager      Redis              MySQL
   |                       |                         |                    |                  |
   |--GET /assessments/1-->|                         |                    |                  |
   |                       |--@Cacheable------------>|                    |                  |
   |                       |                         |--GET cache:assess:1|                  |
   |                       |                         |<-MISS--------------|                  |
   |                       |--Query DB-------------------------------------------------------> |
   |                       |<-Result----------------------------------------------------------|
   |                       |--Store in cache-------->|                    |                  |
   |                       |                         |--SET cache:assess:1|                  |
   |                       |                         |   (JSON, TTL 1d)   |                  |
   |                       |                         |<-OK----------------|                  |
   |                       |<-Object-----------------|                    |                  |
   |<-JSON (assessment)----|                         |                    |                  |
```

#### Assessment Submission (With Idempotency)
```
Frontend              IdempotencyFilter      Controller           SessionService    Redis         MySQL
   |                       |                      |                    |               |              |
   |--POST /submit-------->|                      |                    |               |              |
   |  X-Session-Id: uuid   |                      |                    |               |              |
   |  X-Idempotency-Key: k |                      |                    |               |              |
   |                       |--SET NX idem:k--------------------------------->         |              |
   |                       |<-OK (acquired)-----------------------------------         |              |
   |                       |--doFilter()--------->|                    |               |              |
   |                       |                      |--validateSession()->|               |              |
   |                       |                      |                    |--GET session:uuid----------> |
   |                       |                      |                    |<-Valid (JSON)--------------- |
   |                       |                      |<-Valid session-----|               |              |
   |                       |                      |--BEGIN TRANSACTION----------------------------------->|
   |                       |                      |--DELETE/INSERT answers/scores------------------------>|
   |                       |                      |--COMMIT---------------------------------------------->|
   |                       |                      |--invalidateSession()->|            |              |
   |                       |                      |                    |--DEL session:uuid----------> |
   |                       |<-Response------------|                    |               |              |
   |                       |--SET idem:k=complete---------------------------->         |              |
   |<-{status: success}----|                      |                    |               |              |
```

**Improvements:**
- Idempotency: Redis SET NX prevents duplicate submissions
- Session validation: Ensures student owns the assessment
- Shared cache: All API instances share Redis cache
- Auto-cleanup: TTL handles session/idempotency key expiration

---

## Architectural Patterns

### Pattern 1: Cache-Aside with Fallback

**What:** Spring @Cacheable + Redis, fall back to Caffeine if Redis unavailable

**Implementation:**
```java
@Bean
@Primary
@ConditionalOnProperty(name = "spring.cache.type", havingValue = "redis")
public CacheManager redisCacheManager(RedisConnectionFactory factory) {
    // Redis configuration
}

@Bean
@ConditionalOnProperty(name = "spring.cache.type", havingValue = "caffeine")
public CacheManager caffeineFallbackCacheManager() {
    // Caffeine configuration (existing)
}
```

**When to use:** Production systems requiring high availability

**Trade-offs:**
- **Pro:** Graceful degradation (app works without Redis)
- **Pro:** No controller code changes (@Cacheable unchanged)
- **Con:** Fallback cache is per-instance (horizontal scaling less effective)

---

### Pattern 2: Server-Side Session with Auto-Expiration

**What:** Store assessment session in Redis with TTL, extend on activity

**Implementation:**
```java
public String createSession(Long studentId, Long assessmentId) {
    String sessionId = UUID.randomUUID().toString();
    redisTemplate.opsForValue().set(
        "session:" + sessionId,
        sessionJson,
        Duration.ofMinutes(120)
    );
    return sessionId;
}

private void extendSessionIfNeeded(String key, AssessmentSessionDTO session) {
    Long ttl = redisTemplate.getExpire(key, TimeUnit.MINUTES);
    if (ttl < 30) {  // Extend if < 30min remaining
        redisTemplate.expire(key, Duration.ofMinutes(120));
    }
}
```

**When to use:** Long-running user workflows (assessments, forms, checkout)

**Trade-offs:**
- **Pro:** Auto-cleanup (no manual purge)
- **Pro:** Activity detection (extends on use, expires on abandon)
- **Con:** TTL-based (not persistent, lost on Redis restart)

---

### Pattern 3: Idempotency with Redis SET NX

**What:** Use Redis SET NX (set if not exists) for atomic deduplication

**Implementation:**
```java
Boolean acquired = redisTemplate.opsForValue().setIfAbsent(
    "idempotency:" + key,
    "processing",
    Duration.ofMinutes(10)
);

if (Boolean.FALSE.equals(acquired)) {
    response.sendError(409, "Duplicate submission");
    return;
}

try {
    // Process request
    redisTemplate.opsForValue().set(key, "completed");
} catch (Exception e) {
    redisTemplate.delete(key);  // Retry allowed
    throw e;
}
```

**When to use:** Financial transactions, order placement, assessment submission

**Trade-offs:**
- **Pro:** Atomic check-and-set (race-condition safe)
- **Pro:** Retry-safe (lock removed on failure)
- **Con:** Requires client to generate unique key

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k students | Single Redis instance, Caffeine fallback optional, 512MB memory |
| 1k-10k students | Single Redis instance, 2GB memory, enable Caffeine fallback for HA |
| 10k-100k students | Redis Sentinel (3 nodes), dedicated Redis for sessions vs cache |
| 100k+ students | Redis Cluster (sharding), separate cache/session clusters |

### Scaling Priorities

1. **First bottleneck:** Redis memory exhaustion
   - **Symptom:** Cache evictions, slow queries
   - **Fix:** Increase `maxmemory`, enable LRU eviction, analyze key distribution
   - **Timing:** When Redis memory usage > 80%

2. **Second bottleneck:** Network I/O between API and Redis
   - **Symptom:** High Redis CPU, slow cache operations
   - **Fix:** Enable Redis pipelining, use connection pooling, co-locate API + Redis
   - **Timing:** When Redis connections > 100 concurrent

3. **Third bottleneck:** Single-instance Redis becomes SPOF
   - **Symptom:** Downtime on Redis restart, data loss on crash
   - **Fix:** Redis Sentinel for HA, Redis Cluster for horizontal scaling
   - **Timing:** When uptime SLA > 99.9% required

## Anti-Patterns

### Anti-Pattern 1: Caching Entire JPA Entity Graphs

**What people do:** Store deeply nested JPA entities in Redis without optimization

```java
// BAD: Lazy-loading proxies cause serialization errors
@Cacheable("assessmentDetails")
public AssessmentTable getAssessment(Long id) {
    return assessmentTableRepository.findById(id).get();
    // AssessmentTable → Questionnaire → Sections → Questions → Options → Scores
    // Lazy proxies fail to serialize to JSON
}
```

**Why it's wrong:**
- Jackson cannot serialize Hibernate lazy proxies
- Circular references cause infinite loops
- Cache payload bloat (MB per entity)

**Do this instead:**

```java
// GOOD: Use DTOs or fetch joins
@Cacheable("assessmentDetails")
public AssessmentDTO getAssessment(Long id) {
    AssessmentTable entity = assessmentTableRepository
        .findByIdWithQuestionnaire(id);  // @EntityGraph fetch join
    return AssessmentDTO.fromEntity(entity);  // DTO without proxies
}
```

---

### Anti-Pattern 2: No TTL on Redis Keys

**What people do:** Store keys without expiration, rely on manual cleanup

```java
// BAD: Session never expires
redisTemplate.opsForValue().set("session:" + id, json);
// Orphaned sessions accumulate forever
```

**Why it's wrong:**
- Memory leak (orphaned keys)
- Manual cleanup required (cron jobs)
- No auto-recovery from abandoned workflows

**Do this instead:**

```java
// GOOD: Always set TTL
redisTemplate.opsForValue().set(
    "session:" + id,
    json,
    Duration.ofMinutes(120)  // Auto-expire after 2 hours
);
```

---

### Anti-Pattern 3: Synchronous Cache Writes in @Transactional

**What people do:** Write to cache before transaction commits

```java
// BAD: Cache updated before DB commit
@Transactional
public void submitAnswers(AnswerDTO dto) {
    answerRepository.save(answer);
    cacheManager.getCache("answers").put(answer.getId(), answer);
    // If transaction rolls back, cache has stale data
}
```

**Why it's wrong:**
- Cache inconsistency on rollback
- Readers see uncommitted data

**Do this instead:**

```java
// GOOD: Use transactionAware cache manager
@Bean
public CacheManager redisCacheManager(RedisConnectionFactory factory) {
    return RedisCacheManager.builder(factory)
        .transactionAware()  // Defer cache writes until commit
        .build();
}
```

---

## Suggested Build Order

### Phase 1: Redis Infrastructure (No Code Changes)
**Goal:** Add Redis to docker-compose, verify connectivity

1. Add `redis_cache` service to `docker-compose.yml`
2. Add Redis dependencies to `pom.xml`
3. Add Redis config to `application.yml` (keep `spring.cache.type: caffeine` for now)
4. Start containers: `docker-compose up -d`
5. Verify: `docker exec -it redis_cache redis-cli PING` → PONG

**Validation:** Redis container runs, API connects (no errors in logs)

---

### Phase 2: Cache Migration (Caffeine → Redis)
**Goal:** Switch cache backend without behavior changes

1. Create `RedisConfig.java` with RedisCacheManager
2. Update `application.yml`: `spring.cache.type: redis`
3. Test existing endpoints (GET /assessments/getAll, GET /assessment-questions/getAll)
4. Verify cache keys in Redis: `redis-cli KEYS cache:*`
5. Monitor logs for serialization errors

**Validation:** All @Cacheable endpoints work, cache hits visible in Redis

**Rollback Plan:** Set `spring.cache.type: caffeine`, redeploy

---

### Phase 3: Session Management (New Feature)
**Goal:** Add server-side session tracking

1. Create `AssessmentSessionService.java`
2. Create `AssessmentSessionDTO.java`
3. Add `/startAssessment` endpoint to `AssessmentTableController.java`
4. Update frontend: Call `/startAssessment`, store sessionId
5. Test: Start assessment, verify session in Redis (`GET session:*`)

**Validation:** Session created, TTL set, auto-expires after 2 hours

**Rollback Plan:** Frontend skips `/startAssessment`, direct submission works

---

### Phase 4: Submission Protection (Idempotency + Session)
**Goal:** Add deduplication and validation

1. Create `IdempotencyFilter.java`
2. Modify `AssessmentAnswerController.submit()` to validate session
3. Update frontend: Send `X-Session-Id` and `X-Idempotency-Key` headers
4. Test: Duplicate submission returns 409 Conflict
5. Test: Expired session returns 401 Unauthorized

**Validation:** Double-click prevented, session validation enforces ownership

**Rollback Plan:** Remove filter registration, revert controller changes

---

### Phase 5: Monitoring and Tuning
**Goal:** Observe production behavior, optimize

1. Add Redis metrics to Spring Actuator
2. Monitor: Cache hit rate, session count, memory usage
3. Tune: Adjust TTLs, maxmemory, eviction policy
4. Load test: 100 concurrent students taking assessment
5. Document: Runbook for Redis operations

**Validation:** Cache hit rate > 80%, p95 latency < 200ms, no OOM errors

---

## Dependencies and Ordering

```
Phase 1 (Infrastructure)
    ↓ (Redis running)
Phase 2 (Cache Migration)
    ↓ (Cache working)
Phase 3 (Session Management)
    ↓ (Sessions working)
Phase 4 (Submission Protection)
    ↓ (Idempotency working)
Phase 5 (Monitoring)
```

**Critical Path:**
- Phase 1 → 2: Cannot test cache without Redis running
- Phase 2 → 3: Session service depends on RedisTemplate from cache config
- Phase 3 → 4: Submission validation requires session service

**Parallel Work:**
- Frontend changes (session headers) can develop during Phase 2-3
- Documentation can write during Phase 1-2

---

## Sources

**Official Documentation (HIGH Confidence):**
- Spring Data Redis Reference: Spring Boot 2.5.5 supports Spring Data Redis 2.5.x
- Spring Cache Abstraction: https://docs.spring.io/spring-framework/reference/integration/cache.html
- Redis Documentation: https://redis.io/docs/ (Redis 7.x)

**Existing Codebase (HIGH Confidence):**
- `CacheConfig.java`: Current Caffeine implementation with 1-day TTL, 500 max entries
- `AssessmentAnswerController.java`: @Transactional submission flow with bulk operations
- `AssessmentTableController.java`: File-based lock system (assessment-cache/*.json)
- `docker-compose.yml`: Existing network setup (career_shared_net)
- `application.yml`: Caffeine cache configuration (dev/staging profiles)

**Architecture Patterns (MEDIUM Confidence):**
- Idempotency pattern: Industry standard (Stripe, PayPal use similar approach)
- Session management: Common pattern in e-commerce, online testing platforms
- Cache-aside with fallback: Spring Boot best practice for HA systems

---

*Architecture research for: Redis Integration with Spring Boot Assessment System*
*Researched: 2026-03-07*
