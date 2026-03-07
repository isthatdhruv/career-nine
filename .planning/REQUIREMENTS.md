# Requirements: Career-Nine v2.0 Redis Assessment Upgrade

**Defined:** 2026-03-07
**Core Value:** Students can reliably take assessments without data loss, wrong assessment loading, or submission failures — even under peak concurrent load.

## v2 Requirements

Requirements for Redis assessment upgrade. Each maps to roadmap phases.

### Infrastructure

- [ ] **INFRA-01**: Redis 7.2-alpine Docker container with 1.5GB memory limit, allkeys-lru eviction, AOF persistence, health checks, on career_shared_net
- [ ] **INFRA-02**: Spring Data Redis + Lettuce connection pooling integrated with Spring Boot 2.5.5 (pom.xml + application.yml per profile)
- [ ] **INFRA-03**: Graceful degradation — CacheErrorHandler falls back to Caffeine/DB when Redis is unavailable
- [ ] **INFRA-04**: Redis monitoring via Spring Actuator health endpoint and memory/cache metrics

### Caching

- [ ] **CACHE-01**: RedisCacheManager replaces Caffeine for assessmentDetails, assessmentQuestions, measuredQualityTypes caches
- [ ] **CACHE-02**: Cache invalidation on assessment lock/unlock/update/create/delete via @CacheEvict
- [ ] **CACHE-03**: Assessment prefetch endpoint serves data from Redis cache for faster student load
- [ ] **CACHE-04**: Cache warming on application startup to prevent thundering herd on cold start

### Session & Submission

- [ ] **SESS-01**: Server-side assessment session in Redis (student + assessment + startTime) — prevents wrong assessment loading
- [ ] **SESS-02**: Idempotent submission via Redis SET NX dedup key — prevents duplicate submissions
- [ ] **SESS-03**: Safe submission pattern — save-before-delete replaces delete-then-save in AssessmentAnswerController
- [ ] **SESS-04**: Answer draft auto-save — periodic backup of localStorage answers to Redis every 30s

### Frontend Resilience

- [ ] **FRONT-01**: Frontend sends X-Session-Id header on all assessment API calls for server-side validation
- [ ] **FRONT-02**: Improved retry logic with exponential backoff and user-visible error messages
- [ ] **FRONT-03**: Clear submission success/failure feedback with retry option on failure

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Performance Optimization (v3+)

- **PERF-01**: Write-behind answer buffer using Redis Streams for sub-100ms answer saves
- **PERF-02**: Predictive next-question prefetch based on student progress
- **PERF-03**: Real-time admin progress dashboard via Redis Pub/Sub + WebSocket

### High Availability (v3+)

- **HA-01**: Redis Sentinel for automatic failover
- **HA-02**: Redis Cluster for horizontal scaling beyond 500 concurrent users

## Out of Scope

| Feature | Reason |
|---------|--------|
| Redis Cluster/Sentinel | Single instance sufficient for 200 concurrent users |
| Admin dashboard caching | Focus is student assessment flow only |
| Game results migration from Firebase | Separate concern, works fine as-is |
| New assessment features | Redis upgrade only, no new functionality |
| Spring Boot version upgrade | Keep 2.5.5, add Redis within compatibility |
| Frontend redesign | Only reliability/error handling improvements |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | — | Pending |
| INFRA-02 | — | Pending |
| INFRA-03 | — | Pending |
| INFRA-04 | — | Pending |
| CACHE-01 | — | Pending |
| CACHE-02 | — | Pending |
| CACHE-03 | — | Pending |
| CACHE-04 | — | Pending |
| SESS-01 | — | Pending |
| SESS-02 | — | Pending |
| SESS-03 | — | Pending |
| SESS-04 | — | Pending |
| FRONT-01 | — | Pending |
| FRONT-02 | — | Pending |
| FRONT-03 | — | Pending |

**Coverage:**
- v2 requirements: 15 total
- Mapped to phases: 0
- Unmapped: 15

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07*
