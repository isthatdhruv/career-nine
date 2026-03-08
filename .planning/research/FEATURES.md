# Feature Research: Redis-Backed Assessment Caching

**Domain:** High-concurrency assessment system caching and reliability
**Researched:** 2026-03-07
**Confidence:** HIGH

## Executive Summary

This research focuses on Redis features for improving assessment reliability under 200+ concurrent students. Based on analysis of the existing system (Caffeine in-process cache, delete-then-save submission pattern, localStorage answers, MySQL bottleneck), Redis brings three critical capabilities: distributed caching, atomic submission queuing, and session consistency across server restarts.

**Existing Features (Already Built):**
- Student login with OAuth2/JWT
- Assessment selection and demographics
- Question navigation with localStorage persistence
- Answer submission with scoring (@Transactional delete-then-save)
- Caffeine in-process caching for questions
- Game-based assessments
- Proctoring features

**Current Problems:**
- Wrong assessment loaded (cache/session inconsistency)
- Data loading failures (MySQL saturation at 200+ users)
- Lost submissions (delete-then-save race conditions)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in a production-grade high-concurrency assessment system.

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Distributed Question Cache** | Questions loaded instantly even under peak load | MEDIUM | Existing @Cacheable, Redis Spring Boot Starter |
| **Session Persistence** | Assessment state survives server restart/crash | MEDIUM | Existing JWT auth, Spring Session Redis |
| **Atomic Answer Submission** | Answers never lost due to concurrent submissions | HIGH | Existing @Transactional submission logic, Redis transactions |
| **Cache Invalidation** | Updated questions visible immediately to all servers | LOW | Existing @CacheEvict, Redis Pub/Sub |
| **Assessment Instance Isolation** | Each student's session isolated from others | MEDIUM | Existing StudentAssessmentMapping, Redis namespace strategy |

### Differentiators (Competitive Advantage)

Features that set the product apart for high-concurrency scenarios.

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| **Write-Behind Answer Buffer** | Zero-latency answer saves with guaranteed persistence | HIGH | Existing answer model, Redis Streams + consumer workers |
| **Prefetch Queue** | Predictive loading of next question before student requests | MEDIUM | Existing question navigation, Redis sorted sets |
| **Graceful Degradation** | Assessment continues if Redis fails (falls back to DB) | MEDIUM | Existing Caffeine cache, circuit breaker pattern |
| **Submission Idempotency Keys** | Duplicate submissions auto-deduplicated | MEDIUM | Existing submission endpoint, Redis SET with TTL |
| **Real-time Progress Tracking** | Admin dashboard shows live submission stats | LOW | Existing proctoring features, Redis Pub/Sub |
| **Answer Draft Auto-Save** | Periodic backup of in-progress answers | MEDIUM | Existing localStorage, Redis HASH with expiry |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems at scale.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Redis as Primary Answer Store** | "Skip MySQL for speed" | Data loss risk if Redis evicts entries; complex backup | Use Redis as write-through cache + MySQL for persistence |
| **Full Session Replication** | "Preserve every UI state" | Memory explosion (200 users × session data), network overhead | Store only assessment context (current question, start time); use localStorage for UI state |
| **Real-time Answer Broadcasting** | "See what others are answering" | Privacy violation, academic dishonesty enabler | Use proctoring flags, admin-only live monitoring |
| **Infinite Cache TTL** | "Never reload questions" | Stale data when questions updated, memory leak | Use 1-hour TTL for assessments, evict on explicit update |
| **Distributed Locks on Every Read** | "Ensure consistency" | Serializes all reads, kills concurrency | Use optimistic locking (versioning), locks only for writes |

## Feature Dependencies

```
Redis Infrastructure
    ├──requires──> Spring Boot Redis Starter
    ├──requires──> Redis Server 6.0+ (ACL support)
    └──requires──> Redis client connection pooling

Distributed Question Cache
    ├──requires──> Redis Infrastructure
    ├──enhances──> Existing @Cacheable(assessmentQuestions)
    └──enables──> Cache Invalidation

Session Persistence
    ├──requires──> Redis Infrastructure
    ├──requires──> Spring Session Redis
    └──enhances──> Existing JWT authentication

Atomic Answer Submission
    ├──requires──> Redis Infrastructure
    ├──requires──> Existing @Transactional submission
    ├──enables──> Submission Idempotency Keys
    └──enables──> Write-Behind Answer Buffer

Write-Behind Answer Buffer
    ├──requires──> Atomic Answer Submission
    ├──requires──> Redis Streams
    ├──enhances──> Existing answer persistence
    └──conflicts with──> Synchronous submission UI (needs async loading)

Prefetch Queue
    ├──requires──> Distributed Question Cache
    ├──enhances──> Existing question navigation
    └──optional for──> Sequential assessments

Graceful Degradation
    ├──requires──> Existing Caffeine cache
    ├──enhances──> All Redis features
    └──enables──> Production resilience
```

### Dependency Notes

- **Distributed Question Cache requires Redis Infrastructure:** Spring Boot Redis autoconfiguration handles connection management; replaces Caffeine for cross-instance consistency
- **Write-Behind Answer Buffer enhances Atomic Submission:** Submissions move from synchronous (delete-then-save) to async queue processing; frontend needs loading state
- **Graceful Degradation enhances all Redis features:** Circuit breaker detects Redis failures and falls back to direct MySQL + in-process Caffeine
- **Session Persistence enhances JWT auth:** JWT remains stateless for API auth; session stores assessment-specific state (progress, timing)

## MVP Definition

### Launch With (v1 - Redis Foundation)

Minimum viable Redis integration to fix current problems.

- [x] **Distributed Question Cache** — Fixes "wrong assessment loaded" by sharing cache across instances
  - Replaces: Caffeine `assessmentQuestions` cache
  - Implementation: `@Cacheable` with RedisCacheManager
  - Success metric: Zero cache mismatches under 200 concurrent users

- [x] **Cache Invalidation via Pub/Sub** — Ensures updated questions visible immediately
  - Replaces: Manual @CacheEvict (single instance only)
  - Implementation: Redis keyspace notifications → Spring event listener
  - Success metric: <5 second propagation time across all instances

- [x] **Atomic Answer Submission Queue** — Prevents data loss from delete-then-save races
  - Replaces: Direct @Transactional delete-then-save
  - Implementation: Redis LIST as submission queue + background worker
  - Success metric: Zero lost submissions under concurrent load tests

- [x] **Session Persistence** — Maintains assessment state across server restarts
  - Adds: Spring Session Redis for assessment context
  - Implementation: Store StudentAssessmentMapping state in Redis session
  - Success metric: Students resume assessment after server restart

### Add After Validation (v1.x - Reliability Enhancements)

Features to add once core Redis is stable.

- [ ] **Submission Idempotency Keys** — Deduplicates accidental double-submissions
  - Trigger: First production incident of duplicate submission
  - Implementation: Redis SET with submission hash, 10-minute TTL
  - Success metric: Zero duplicate answer records

- [ ] **Answer Draft Auto-Save** — Backup localStorage to Redis every 30s
  - Trigger: First data loss complaint from browser crash
  - Implementation: Redis HASH per student, 24-hour expiry
  - Success metric: <1 minute of lost work on browser crash

- [ ] **Graceful Degradation** — Continue operating if Redis fails
  - Trigger: First Redis outage or maintenance window
  - Implementation: Spring Cache fallback + Caffeine secondary cache
  - Success metric: <10% performance degradation on Redis failure

### Future Consideration (v2+ - Performance Optimization)

Features to defer until product-market fit established.

- [ ] **Write-Behind Answer Buffer** — Async answer persistence for sub-100ms saves
  - Why defer: Complex async consumer logic, frontend loading states
  - Precondition: >500 concurrent users or <500ms submission latency complaint

- [ ] **Prefetch Queue** — Predictive question loading
  - Why defer: Questionable ROI for typical 50-200 question assessments
  - Precondition: Assessments with >500 questions or mobile network users

- [ ] **Real-time Progress Dashboard** — Live admin monitoring
  - Why defer: Proctoring already captures snapshots
  - Precondition: Explicit request from assessment coordinators

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Distributed Question Cache | HIGH (fixes wrong assessment bug) | LOW (drop-in Caffeine replacement) | P1 |
| Atomic Answer Submission | HIGH (prevents data loss) | MEDIUM (queue + worker pattern) | P1 |
| Session Persistence | HIGH (user trust during outages) | LOW (Spring Session autoconfiguration) | P1 |
| Cache Invalidation | MEDIUM (admin workflow improvement) | LOW (Redis Pub/Sub built-in) | P1 |
| Submission Idempotency | MEDIUM (edge case handling) | LOW (SET with TTL) | P2 |
| Answer Draft Auto-Save | MEDIUM (data loss insurance) | MEDIUM (periodic job + conflict resolution) | P2 |
| Graceful Degradation | HIGH (production resilience) | MEDIUM (circuit breaker + fallback) | P2 |
| Write-Behind Buffer | LOW (marginal latency gain) | HIGH (async consumer infrastructure) | P3 |
| Prefetch Queue | LOW (rarely noticeable) | MEDIUM (prediction heuristics) | P3 |
| Real-time Dashboard | LOW (nice-to-have) | LOW (Pub/Sub + WebSocket) | P3 |

**Priority key:**
- P1: Must have for launch (fixes existing bugs)
- P2: Should have for production readiness (resilience)
- P3: Nice to have for scale optimization (future)

## Implementation Patterns

### Pattern 1: Distributed Question Cache

**What:** Replace in-process Caffeine cache with Redis-backed cache for `assessmentQuestions`.

**Current State:**
```java
@Cacheable("assessmentQuestions")
@GetMapping("/getAll")
public List<AssessmentQuestions> getAllAssessmentQuestions() {
    return fetchAndTransformFromDb();
}
```

**Redis Pattern:**
```java
// CacheConfig.java
@Bean
public RedisCacheManager cacheManager(RedisConnectionFactory factory) {
    RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
        .entryTtl(Duration.ofHours(1))
        .serializeValuesWith(SerializationPair.fromSerializer(
            new GenericJackson2JsonRedisSerializer()));

    return RedisCacheManager.builder(factory)
        .cacheDefaults(config)
        .build();
}

// No controller changes needed - @Cacheable works with RedisCacheManager
```

**Benefits:**
- All server instances share same cache
- Cache survives server restart
- Automatic serialization via Jackson

**Tradeoffs:**
- Network latency (1-5ms vs in-memory 0.1ms)
- Serialization overhead
- Redis memory usage

### Pattern 2: Atomic Answer Submission Queue

**What:** Move submission from synchronous delete-then-save to Redis queue with background processor.

**Current Problem:**
```java
// Race condition: Two concurrent submissions can interleave deletes/saves
@Transactional
public ResponseEntity<?> submitAssessmentAnswers(@RequestBody Map<String, Object> submissionData) {
    // 1. Delete old answers (race window opens)
    assessmentAnswerRepository.deleteByUserStudent_UserStudentIdAndAssessment_Id(...);

    // 2. Save new answers (another request's delete could run here)
    assessmentAnswerRepository.saveAll(answersToSave);
}
```

**Redis Pattern:**
```java
// Submission endpoint pushes to Redis queue
@PostMapping("/submit")
public ResponseEntity<?> submitAssessmentAnswers(@RequestBody Map<String, Object> submissionData) {
    String submissionId = UUID.randomUUID().toString();

    // Generate idempotency key
    String idempotencyKey = DigestUtils.md5Hex(
        userStudentId + ":" + assessmentId + ":" + submissionTimestamp
    );

    // Check duplicate
    if (redisTemplate.opsForValue().setIfAbsent(
        "submission:idempotency:" + idempotencyKey, "1", 10, TimeUnit.MINUTES)) {

        // Push to queue (atomic)
        redisTemplate.opsForList().rightPush(
            "submission:queue",
            objectMapper.writeValueAsString(submissionData)
        );

        return ResponseEntity.accepted().body(Map.of("submissionId", submissionId));
    } else {
        return ResponseEntity.ok().body(Map.of("status", "duplicate"));
    }
}

// Background worker processes queue
@Scheduled(fixedDelay = 100)
public void processSubmissionQueue() {
    String submission = redisTemplate.opsForList().leftPop("submission:queue");
    if (submission != null) {
        processSubmission(submission); // Existing @Transactional logic
    }
}
```

**Benefits:**
- Submissions serialized (no delete-then-save races)
- Idempotency prevents duplicates
- Fast response to user (202 Accepted)

**Tradeoffs:**
- Async processing (need polling or WebSocket for completion)
- Requires background worker process
- Redis as critical path (need fallback)

### Pattern 3: Session Persistence

**What:** Store assessment progress in Redis-backed session for resume-after-restart.

**Current State:**
- JWT carries authentication only
- Assessment state rebuilt from MySQL on each request
- Server restart forces students to re-login and lose in-progress context

**Redis Pattern:**
```java
// application.yml
spring:
  session:
    store-type: redis
    redis:
      namespace: career9:session

// Controller stores assessment context
@PostMapping("/start-assessment")
public ResponseEntity<?> startAssessment(@RequestBody Map<String, Object> request,
                                          HttpSession session) {
    Long assessmentId = ((Number) request.get("assessmentId")).longValue();
    Long userStudentId = ((Number) request.get("userStudentId")).longValue();

    // Store in Redis-backed session
    session.setAttribute("currentAssessment", assessmentId);
    session.setAttribute("userStudentId", userStudentId);
    session.setAttribute("startTime", System.currentTimeMillis());
    session.setMaxInactiveInterval(3600); // 1 hour

    return ResponseEntity.ok(/* assessment data */);
}

// Resume retrieves from session
@GetMapping("/resume-assessment")
public ResponseEntity<?> resumeAssessment(HttpSession session) {
    Long assessmentId = (Long) session.getAttribute("currentAssessment");
    if (assessmentId == null) {
        return ResponseEntity.status(404).body("No active assessment");
    }

    // Rebuild state from session + DB
    return ResponseEntity.ok(/* assessment data */);
}
```

**Benefits:**
- Students resume after server restart
- Reduces MySQL queries for session state
- Works with load balancer session affinity

**Tradeoffs:**
- Session size must stay small (<10KB recommended)
- Redis session store becomes critical dependency
- Requires session cleanup (TTL management)

### Pattern 4: Cache Invalidation via Pub/Sub

**What:** Broadcast cache eviction events to all server instances.

**Current Problem:**
```java
// Only invalidates cache on instance that processes the request
@CacheEvict(value = "assessmentQuestions", allEntries = true)
@PostMapping("/create")
public AssessmentQuestions createAssessmentQuestion(...) {
    return assessmentQuestionRepository.save(assessmentQuestions);
}
```

**Redis Pattern:**
```java
// Cache eviction publishes to Redis channel
@CacheEvict(value = "assessmentQuestions", allEntries = true)
@PostMapping("/create")
public AssessmentQuestions createAssessmentQuestion(...) {
    AssessmentQuestions saved = assessmentQuestionRepository.save(assessmentQuestions);

    // Broadcast to all instances
    redisTemplate.convertAndSend("cache:invalidate", "assessmentQuestions");

    return saved;
}

// All instances subscribe and evict locally
@Configuration
public class CacheInvalidationConfig {
    @Bean
    RedisMessageListenerContainer container(RedisConnectionFactory factory,
                                            CacheManager cacheManager) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);
        container.addMessageListener(new MessageListener() {
            @Override
            public void onMessage(Message message, byte[] pattern) {
                String cacheName = new String(message.getBody());
                cacheManager.getCache(cacheName).clear();
            }
        }, new ChannelTopic("cache:invalidate"));
        return container;
    }
}
```

**Benefits:**
- Instant cache invalidation across all instances
- No stale data served after updates
- Minimal network overhead (pub/sub efficient)

**Tradeoffs:**
- Requires Redis Pub/Sub setup
- Message ordering not guaranteed (use versioning if critical)
- All instances receive message (broadcast storm on many instances)

## Production Considerations

### Memory Planning (8GB Server)

**Baseline Allocation:**
- MySQL: 2GB
- Spring Boot JVM heap: 2GB
- OS + buffers: 2GB
- **Redis: 2GB available**

**Redis Memory Budget (2GB):**
- Question cache: 500 questions × 20KB avg = 10MB
- Session store: 200 sessions × 5KB = 1MB
- Submission queue: 200 pending × 50KB = 10MB
- Answer drafts: 200 students × 100KB = 20MB
- Overhead (keys, metadata): 10MB
- **Total baseline: ~50MB**

**Headroom:** 1.95GB for burst traffic, answer history, extended sessions

**Redis Configuration:**
```yaml
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru  # Evict least-recently-used on memory pressure
save 900 1                     # Persist to disk every 15 min if ≥1 key changed
save 300 10                    # or every 5 min if ≥10 keys changed
appendonly yes                 # Enable AOF for durability
```

### High Availability

**Phase 1 (MVP):** Single Redis instance
- Risk: Redis downtime = degraded experience
- Mitigation: Graceful degradation (fallback to Caffeine + MySQL)
- Acceptable for initial deployment

**Phase 2 (Production):** Redis Sentinel (1 primary + 2 replicas)
- Automatic failover (<30s downtime)
- Read scaling for cache hits
- Cost: 3× Redis memory (6GB total)

**Phase 3 (Scale):** Redis Cluster
- Horizontal scaling beyond single-server capacity
- Needed only if >1000 concurrent users

### Monitoring

**Key Metrics:**
- Cache hit rate: >95% for questions
- Queue depth: <100 pending submissions
- Session count: Track concurrent active assessments
- Memory usage: Alert at >80% of maxmemory
- Eviction rate: Should be 0 for submissions/sessions

**Redis INFO commands:**
```bash
# Monitor cache performance
redis-cli INFO stats | grep keyspace_hits

# Monitor memory
redis-cli INFO memory | grep used_memory_human

# Monitor queue
redis-cli LLEN submission:queue
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Redis memory exhaustion | MEDIUM | HIGH (evicts sessions/submissions) | Strict TTLs, monitoring, LRU policy |
| Redis single point of failure | HIGH | MEDIUM (graceful degradation works) | Circuit breaker, Caffeine fallback, Sentinel later |
| Serialization bugs (Java ↔ JSON) | MEDIUM | MEDIUM (cache misses, data corruption) | Integration tests, schema versioning |
| Session fixation attacks | LOW | HIGH (assessment cheating) | Spring Security session management, HTTPS only |
| Queue processing lag | MEDIUM | MEDIUM (delayed score visibility) | Auto-scaling workers, queue depth alerts |

## Sources

**Framework Documentation:**
- Spring Data Redis 2.x (compatible with Spring Boot 2.5.5)
- Spring Session Redis integration patterns
- Caffeine cache fallback strategies

**Industry Patterns:**
- Assessment platform architectures (Canvas LMS, Moodle)
- High-concurrency submission handling (online exam systems)
- Redis patterns from Redis University and official docs

**Confidence Assessment:**
- **Stack Integration:** HIGH (Spring Boot Redis starter well-documented)
- **Patterns:** HIGH (established patterns from EdTech platforms)
- **Performance:** MEDIUM (specific to 200-user load, need load testing)
- **Tradeoffs:** HIGH (clear benefits/costs for each feature)

---
*Research for: Career-Nine Redis Assessment Caching Milestone*
*Researched: 2026-03-07*
*Focus: Features Redis brings to existing assessment flow*
