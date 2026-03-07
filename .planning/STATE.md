# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-07)

**Core value:** Students can reliably take assessments without data loss, wrong assessment loading, or submission failures — even under peak concurrent load.
**Current focus:** Phase 9 — Redis Caching Layer

## Current Position

Phase: 9 of 12 (Redis Caching Layer)
Plan: 1 of 2 complete
Status: Executing Phase 09
Last activity: 2026-03-07 — Completed 09-01 RedisCacheManager Migration

Progress: [███░░░░░░░] 30%

## Performance Metrics

**Velocity:**
- Total plans completed: 3 (v2.0 milestone)
- Average duration: 1.3min
- Total execution time: 4min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 08-redis-infrastructure | 2/2 | 3min | 1.5min |
| 09-redis-caching-layer | 1/2 | 1min | 1min |

**Recent Trend:**
- Last 5 plans: 08-01 (2min), 08-02 (1min), 09-01 (1min)
- Trend: Accelerating

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

## Session Continuity

Last session: 2026-03-07
Stopped at: Completed 09-01-PLAN.md (RedisCacheManager Migration)
Resume file: .planning/phases/09-redis-caching-layer/09-01-SUMMARY.md
