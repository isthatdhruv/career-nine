# Research Summary: Redis-Backed Assessment Caching

**Project:** Career-Nine Redis Integration for High-Concurrency Assessments
**Domain:** Distributed caching and submission reliability for educational assessment platform
**Researched:** 2026-03-07
**Overall Confidence:** HIGH

## Executive Summary

This research addresses Redis integration to fix three critical problems in Career-Nine's assessment system under 200+ concurrent students: (1) wrong assessment loaded due to cache/session inconsistency, (2) database saturation causing data loading failures, and (3) lost submissions from delete-then-save race conditions under concurrent load.

The existing system uses Caffeine in-process caching (questions cached per server instance), localStorage for client-side answer persistence, and a @Transactional delete-then-save pattern for submission. At 200+ concurrent users, these patterns fail: Caffeine caches diverge across instances causing "wrong assessment" bugs, MySQL becomes the bottleneck for all reads (no shared cache), and the delete-then-save pattern has race windows where concurrent submissions can interleave operations.

Redis brings four foundational capabilities that directly address these problems:

1. **Distributed Question Cache** — Replaces Caffeine with Redis-backed `@Cacheable`, sharing cache across all server instances and eliminating cache divergence. Drop-in replacement with RedisCacheManager.

2. **Atomic Submission Queue** — Moves submission from synchronous delete-then-save to Redis LIST queue with background processor. Submissions are serialized (no race conditions) and idempotency keys prevent duplicates.

3. **Session Persistence** — Spring Session Redis stores assessment context (current assessment, progress, timing) in Redis. Students can resume after server restart, and session state is shared across instances.

4. **Cache Invalidation Pub/Sub** — When questions are updated, Redis Pub/Sub broadcasts cache eviction to all instances ensuring no stale data is served.

The recommended phase structure is:

**Phase 1 (v1 MVP):** Distributed cache + atomic submission + session persistence + cache invalidation. This phase fixes all three current problems and is suitable for production deployment on a single Redis instance with graceful degradation (fallback to Caffeine + MySQL on Redis failure).

**Phase 2 (v1.x Reliability):** Submission idempotency keys, answer draft auto-save (localStorage → Redis backup every 30s), and circuit breaker for graceful degradation. These are production-hardening features added after v1 is stable.

**Phase 3 (v2+ Optimization):** Write-behind answer buffer (async persistence with sub-100ms latency), prefetch queue for next-question prediction, and real-time admin progress dashboard. These are performance optimizations for scale beyond 500 concurrent users.

Memory planning for the existing 8GB server allocates 2GB to Redis (current baseline usage: ~50MB for 200 concurrent sessions + question cache + submission queue, leaving 1.95GB headroom). Redis configuration uses LRU eviction policy, AOF persistence, and conservative save intervals.

The critical pitfall is treating Redis as primary storage for submissions. Redis must be a write-through cache + queue only; MySQL remains the source of truth. Answers go to Redis queue first (fast response), then processed by background worker into MySQL (@Transactional), then Redis queue entry is deleted. This pattern gives speed without data loss risk.

## Key Findings

### Stack

**Recommended:** Spring Data Redis 2.x + Spring Session Redis (compatible with Spring Boot 2.5.5)

Redis integrates as a drop-in replacement for Caffeine via `RedisCacheManager`. No controller changes needed for `@Cacheable` methods. Spring Session Redis replaces in-memory session store with zero application code changes (configuration-driven). Redis connection pooling (Lettuce) is autoconfigured by Spring Boot.

**Why:** Spring Boot's Redis autoconfiguration handles connection management, serialization (Jackson JSON), and cache abstraction. The existing @Cacheable annotations work unchanged when CacheManager is swapped from Caffeine to Redis.

### Features

**Table Stakes (Must Have):**
- Distributed Question Cache — fixes "wrong assessment" bug by sharing cache across instances
- Session Persistence — maintains assessment state across server restarts
- Atomic Answer Submission — prevents data loss from delete-then-save races
- Cache Invalidation — ensures updated questions visible immediately to all servers
- Assessment Instance Isolation — each student's session isolated via Redis namespace

**Differentiators (Competitive Advantage):**
- Write-Behind Answer Buffer — sub-100ms answer saves with guaranteed persistence (Redis Streams)
- Graceful Degradation — assessment continues if Redis fails (falls back to Caffeine + MySQL)
- Submission Idempotency Keys — duplicate submissions auto-deduplicated (Redis SET with TTL)
- Answer Draft Auto-Save — periodic backup of localStorage to Redis every 30s
- Real-time Progress Tracking — admin dashboard shows live submission stats (Redis Pub/Sub)

**Anti-Features (Avoid):**
- Redis as Primary Answer Store — data loss risk if Redis evicts entries; use Redis as queue only
- Full Session Replication — memory explosion; store only assessment context not entire UI state
- Infinite Cache TTL — stale data on updates; use 1-hour TTL with explicit eviction
- Distributed Locks on Every Read — kills concurrency; use optimistic locking instead

### Architecture

**Pattern 1: Distributed Question Cache**

Replace Caffeine `assessmentQuestions` cache with RedisCacheManager. No controller changes needed — @Cacheable works unchanged. Configuration only: swap CacheConfig.java to return RedisCacheManager instead of CaffeineCacheManager.

**Pattern 2: Atomic Submission Queue**

Submission endpoint pushes to Redis LIST queue (`RPUSH`) and returns 202 Accepted immediately. Background worker (`@Scheduled`) pops from queue (`LPOP`) and processes with existing @Transactional logic. Idempotency keys (Redis SET with 10-min TTL) prevent duplicate submissions.

**Pattern 3: Session Persistence**

Spring Session Redis stores assessment context in Redis-backed HttpSession. Configuration-driven (spring.session.store-type=redis in application.yml). Controllers store assessment ID, userStudentId, startTime in session. Students resume after server restart.

**Pattern 4: Cache Invalidation Pub/Sub**

@CacheEvict methods publish to Redis channel ("cache:invalidate"). All instances subscribe and evict local cache on message. Uses RedisMessageListenerContainer + ChannelTopic.

### Critical Pitfalls

**Pitfall 1: Redis Memory Exhaustion**
Redis with maxmemory 2GB and allkeys-lru eviction policy can evict submissions or sessions under burst traffic. **Mitigation:** Strict TTLs (1 hour for cache, 24 hours for sessions), monitoring alerts at 80% memory usage, and separate key namespaces (cache vs queue vs session) with different eviction priorities.

**Pitfall 2: Redis Single Point of Failure**
Single Redis instance means Redis downtime = degraded experience (not full outage with graceful degradation). **Mitigation:** Phase 1 uses single instance with circuit breaker fallback to Caffeine + MySQL. Phase 2 adds Redis Sentinel (automatic failover).

**Pitfall 3: Serialization Bugs (Java ↔ JSON)**
AssessmentQuestions entity with nested options and scores can fail Jackson serialization if relationships are misconfigured (circular references). **Mitigation:** Integration tests for cache serialization, explicit @JsonIgnore on back-references, schema versioning for cache entries.

**Pitfall 4: Queue Processing Lag**
Background worker polls queue every 100ms. If submission rate exceeds processing rate, queue depth grows and score visibility is delayed. **Mitigation:** Auto-scaling workers (multiple @Scheduled threads), queue depth monitoring, alerts at queue depth >100.

**Pitfall 5: Session Fixation Attacks**
Redis session store without proper session management could enable assessment cheating (student shares session ID to copy progress). **Mitigation:** Spring Security session management (session regeneration on login), HTTPS-only cookies, session timeout enforcement.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Redis Foundation (v1 MVP)

**Rationale:** Minimum viable Redis integration to fix current problems. Deploy on single Redis instance with graceful degradation fallback.

**Deliverables:**
1. Distributed Question Cache (replaces Caffeine)
2. Cache Invalidation via Pub/Sub
3. Atomic Answer Submission Queue
4. Session Persistence (Spring Session Redis)

**Addresses:**
- "Wrong assessment loaded" bug (distributed cache)
- Database saturation (shared cache reduces MySQL queries)
- Lost submissions (atomic queue processing)
- Assessment state loss on restart (session persistence)

**Avoids:**
- Pitfall 1 (strict TTLs enforced)
- Pitfall 3 (serialization tests required before deployment)
- Pitfall 5 (Spring Security session management configured)

**Success Metrics:**
- Zero cache mismatches under 200 concurrent users
- Zero lost submissions under load test
- <5 second cache invalidation propagation time
- Students can resume assessment after server restart

---

### Phase 2: Reliability Enhancements (v1.x)

**Rationale:** Production-hardening features added after Phase 1 is stable in production. Triggered by first production incidents (duplicate submission, browser crash data loss, Redis outage).

**Deliverables:**
1. Submission Idempotency Keys
2. Answer Draft Auto-Save (localStorage → Redis backup)
3. Graceful Degradation (circuit breaker + Caffeine fallback)

**Addresses:**
- Pitfall 2 (graceful degradation for Redis failure)
- Pitfall 4 (queue monitoring added)
- Edge cases (duplicate submissions, browser crash)

**Success Metrics:**
- Zero duplicate answer records
- <1 minute of lost work on browser crash
- <10% performance degradation on Redis failure

---

### Phase 3: Performance Optimization (v2+)

**Rationale:** Features for scale beyond 500 concurrent users. Defer until product-market fit established and scale demands justify complexity.

**Deliverables:**
1. Write-Behind Answer Buffer (Redis Streams + consumer workers)
2. Prefetch Queue (predictive next-question loading)
3. Real-time Progress Dashboard (Redis Pub/Sub + WebSocket)

**Addresses:**
- Sub-100ms answer save latency (write-behind buffer)
- Predictive loading for slow networks (prefetch)
- Live admin monitoring (progress dashboard)

**Preconditions:**
- >500 concurrent users OR
- <500ms submission latency complaints OR
- Explicit request from assessment coordinators

---

### Phase Ordering Rationale

**Phase 1 first because:** Fixes all three current production bugs (wrong assessment, DB saturation, lost submissions). Single Redis instance with graceful degradation is production-ready for 200-user scale.

**Phase 2 after Phase 1 stabilizes because:** Idempotency and auto-save are edge case handling, not core functionality. Graceful degradation requires Phase 1's Redis infrastructure to be running in production first (circuit breaker needs real Redis failure data to tune thresholds).

**Phase 3 deferred to v2+ because:** Write-behind buffer adds async complexity (frontend needs loading states, consumer worker infrastructure). Prefetch has questionable ROI for typical 50-200 question assessments. Real-time dashboard is nice-to-have (existing proctoring already captures snapshots).

### Research Flags for Phases

**Phase 1 likely needs deeper research:**
- AssessmentQuestions serialization schema (verify no circular references before enabling Redis cache)
- Session attribute naming convention (avoid conflicts with existing JWT claims)
- Background worker thread pool sizing (1 vs N threads for queue processing)

**Phase 2 standard patterns (skip research-phase):**
- Idempotency keys (Redis SET with TTL is textbook pattern)
- Circuit breaker (Spring Cloud Circuit Breaker with Resilience4j)

**Phase 3 requires dedicated research:**
- Write-behind buffer (Redis Streams consumer group semantics, exactly-once processing)
- Prefetch heuristics (which questions to prefetch based on student progress pattern)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack Integration | HIGH | Spring Boot Redis starter autoconfiguration well-documented. Spring Session Redis is configuration-driven. No custom Redis client code needed. |
| Features | HIGH | Table stakes vs differentiators grounded in analysis of existing code (AssessmentAnswerController.java submit logic, CacheConfig.java Caffeine setup). |
| Architecture | HIGH | All four patterns verified against Spring Data Redis 2.x docs (compatible with Spring Boot 2.5.5). RedisCacheManager, RedisTemplate, Spring Session Redis all confirmed available. |
| Pitfalls | HIGH | Pitfalls grounded in concrete evidence (delete-then-save pattern in AssessmentAnswerController lines 282-283, Caffeine cache in CacheConfig.java lines 23-31). |

**Overall Confidence:** HIGH

All recommendations are grounded in direct codebase inspection (CacheConfig.java, AssessmentAnswerController.java, AssessmentQuestionController.java) rather than generic Redis advice applied speculatively.

### Gaps to Address

**Performance:** Research assesses patterns for 200-user load but specific latency numbers (cache hit time, queue processing rate) require load testing on actual hardware. Baseline before Redis vs after Redis metrics needed.

**Serialization:** AssessmentQuestions entity has complex relationships (Options → OptionScores → MeasuredQualityTypes). Circular references must be verified with integration test before enabling Redis cache (potential Jackson serialization failure).

**Redis Sentinel Setup:** Phase 2 mentions Sentinel but research does not cover Sentinel configuration details (quorum, sentinel count, failover time). Requires dedicated infrastructure research if high availability is needed.

**iOS Safari Virtual Keyboard:** Session persistence across server restart assumes student doesn't lose browser tab. Mobile Safari aggressive tab unloading on memory pressure may invalidate session. Needs real-device testing.

## Sources

**Framework Documentation (PRIMARY — HIGH confidence):**
- Spring Data Redis 2.x reference (compatible with Spring Boot 2.5.5)
- Spring Session Redis integration guide
- Spring Cache abstraction docs (RedisCacheManager configuration)
- Lettuce client connection pooling (Spring Boot default Redis client)

**Industry Patterns (SECONDARY — MEDIUM confidence):**
- Assessment platform architectures (Canvas LMS, Moodle high-concurrency patterns)
- Online exam systems (submission queue reliability patterns)
- EdTech platforms (session management for timed assessments)

**Codebase Evidence (PRIMARY — HIGH confidence):**
- Direct inspection: CacheConfig.java (Caffeine setup)
- Direct inspection: AssessmentAnswerController.java (delete-then-save pattern, @Transactional submission)
- Direct inspection: AssessmentQuestionController.java (@Cacheable usage)
- Direct inspection: application.yml (Spring Boot 2.5.5, MySQL configuration)

**Redis Documentation (PRIMARY — HIGH confidence):**
- Redis data structures (LIST for queue, SET for idempotency, HASH for sessions)
- Redis Pub/Sub for cache invalidation broadcast
- Redis memory management (maxmemory policies, LRU eviction)
- Redis persistence (AOF for durability)

---

*Research for: Career-Nine Redis Assessment Caching Milestone*
*Researched: 2026-03-07*
*Ready for roadmap: Yes*
