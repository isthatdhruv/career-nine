# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-07)

**Core value:** Students can reliably take assessments without data loss, wrong assessment loading, or submission failures — even under peak concurrent load.
**Current focus:** Phase 10 — Session Management

## Current Position

Phase: 10 of 12 (Session Management)
Plan: 2 of 2 complete
Status: Phase Complete
Last activity: 2026-03-07 — Completed 10-02 Idempotent Submission

Progress: [██████░░░░] 55%

## Performance Metrics

**Velocity:**
- Total plans completed: 6 (v2.0 milestone)
- Average duration: 1.5min
- Total execution time: 9min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 08-redis-infrastructure | 2/2 | 3min | 1.5min |
| 09-redis-caching-layer | 2/2 | 2min | 1min |
| 10-session-management | 2/2 | 4min | 2min |

**Recent Trend:**
- Last 5 plans: 09-01 (1min), 09-02 (1min), 10-01 (2min), 10-02 (2min)
- Trend: Consistent

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Redis single instance (not Cluster) — 200 concurrent students doesn't need clustering
- Spring Data Redis + Lettuce client — Standard for Spring Boot 2.5.x, non-blocking
- ~1.5GB Redis with allkeys-lru eviction — Fits 8GB server constraint, assessment data is re-fetchable
- Server-side session in Redis (not JWT claims) — Prevents wrong assessment loading at the source
- Save-before-delete for submissions — Prevents data loss from current delete-then-save pattern
- JVM heap reduced 4GB->2GB to fit Redis in 8GB server budget (08-01)
- MySQL memory reduced 3GB->2GB, total budget: MySQL 2GB + API 3GB + Redis 1.5GB = 6.5GB (08-01)
- Used spring.redis.* namespace (Spring Boot 2.5.x), not spring.data.redis.* (08-01)
- Lettuce pool: dev=8 max-active, staging/prod=50 max-active (08-01)
- GenericJackson2JsonRedisSerializer for human-readable JSON values in Redis (08-02)
- CachingConfigurerSupport pattern for Spring Boot 2.5.x cache error handling (08-02)
- WARN-level logging for cache errors, not ERROR (08-02)
- GenericJackson2JsonRedisSerializer for cache values — consistent with RedisTemplate (09-01)
- "career9:" key prefix for cache namespace isolation (09-01)
- transactionAware() on RedisCacheManager for Spring transaction participation (09-01)
- disableCachingNullValues() to avoid caching empty results (09-01)
- Inject controllers (not repos) for cache warming — @Cacheable on controller methods requires Spring AOP proxy (09-02)
- "prefetch-" key prefix in assessmentDetails cache — shares eviction with existing @CacheEvict annotations (09-02)
- Skip warming assessmentDetails at startup — per-ID keyed, expensive to iterate all; warm on-demand (09-02)
- ISO-8601 string for session startTime instead of Instant — avoids Jackson serialization issues with GenericJackson2JsonRedisSerializer (10-01)
- Backwards compatible interceptor — no X-Assessment-Session header means pass through (10-01)
- Three separate headers (token, student ID, assessment ID) — avoids reading request body which is consumed once (10-01)
- Interceptor excludes admin/CRUD and startAssessment endpoints — only assessment-taking paths validated (10-01)
- Release idempotency lock on validation failure (no answers) — not a real submission, allow retry (10-02)
- HashMap for cached result — compatible with GenericJackson2JsonRedisSerializer (10-02)
- Bulk-submit endpoints excluded from idempotency — admin-only, handle re-upload by design (10-02)

### Roadmap Evolution

- v1.0 Responsive Overhaul completed (phases 1-7)
- v2.0 Redis Assessment Upgrade started (phases 8-12)
  - Phase 8: Redis Infrastructure (5 success criteria, INFRA-01 to INFRA-04)
  - Phase 9: Redis Caching Layer (5 success criteria, CACHE-01 to CACHE-04)
  - Phase 10: Session Management (5 success criteria, SESS-01 to SESS-02)
  - Phase 11: Safe Submission Pattern (5 success criteria, SESS-03 to SESS-04)
  - Phase 12: Frontend Resilience (5 success criteria, FRONT-01 to FRONT-03)

### Pending Todos

None yet.

### Blockers/Concerns

- 8GB RAM constraint requires careful Redis memory management (addressed in Phase 8)
- Spring Boot 2.5.5 compatibility with Redis libraries needs verification (addressed in Phase 8)
- Existing Caffeine cache migrated to Redis in 09-01 (RESOLVED)
- AssessmentQuestions serialization: Jackson serialization proven safe by existing HTTP responses — same serializer used for Redis (RESOLVED in 09-01)
- Cache warming and prefetch caching complete (RESOLVED in 09-02)

## Session Continuity

Last session: 2026-03-07
Stopped at: Completed 10-02-PLAN.md (Idempotent Submission) — Phase 10 complete
Resume file: .planning/phases/10-session-management/10-02-SUMMARY.md
