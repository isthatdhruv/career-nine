# Career-Nine

## What This Is

Career-Nine is a full-stack educational platform for student assessment, career guidance, and academic management. It has two React frontends (admin dashboard + student assessment app) and a Spring Boot + MySQL backend. The platform serves 200+ concurrent students during peak assessment periods.

## Core Value

Students can reliably take assessments without data loss, wrong assessment loading, or submission failures — even under peak concurrent load.

## Current Milestone: v2.0 Redis Assessment Upgrade

**Goal:** Add Redis as a caching and session layer to make the student assessment flow robust, fast, and reliable under concurrent load.

**Target features:**
- Redis Docker container integrated with existing infrastructure (8GB RAM constraint)
- Server-side assessment session management (prevent wrong assessment loading)
- Redis-backed caching for assessment data (replace Caffeine for hot paths)
- Idempotent, queue-backed answer submission (prevent lost submissions)
- Assessment data prefetch optimization

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from existing codebase. -->

- ✓ OAuth2 authentication (Google, GitHub, Facebook) + JWT — existing
- ✓ Student registration and management — existing
- ✓ Assessment/questionnaire creation and management — existing
- ✓ Assessment scoring and raw score calculation — existing
- ✓ Multi-language question support — existing
- ✓ Question bulk upload via Excel — existing
- ✓ Career and measured quality management — existing
- ✓ Institute/branch/course/section management — existing
- ✓ Game-based assessments (Rabbit-Path, Hydro-Tube, Jungle-Spot) — existing
- ✓ Principal and class teacher dashboards — existing
- ✓ PDF generation for student ID cards — existing
- ✓ Google Workspace integration — existing
- ✓ Metronic layout system with sidebar navigation — existing
- ✓ Responsive frontend (v1.0 milestone) — existing

### Active

<!-- Current scope. Redis-based assessment robustness upgrade. -->

- [ ] Redis Docker container with memory limits (~1.5GB)
- [ ] Spring Boot Redis integration (Spring Data Redis + Lettuce)
- [ ] Assessment data cached in Redis (questionnaire, sections, questions, options)
- [ ] Student assessment session tracked server-side in Redis
- [ ] Idempotent submission with Redis dedup keys
- [ ] Answer submission reliability (save-before-delete pattern)
- [ ] Prefetch data served from Redis cache
- [ ] Cache invalidation on assessment lock/unlock/update
- [ ] Frontend resilience (retry, error handling improvements)

### Out of Scope

- Admin dashboard performance — focus is student assessment flow only
- Changing the assessment question/scoring model
- Adding new assessment features (new question types, etc.)
- Frontend redesign — only reliability/error handling improvements
- Redis Cluster or Sentinel — single instance is sufficient for this scale
- Migrating game results from Firebase to Redis

## Context

- **Server constraint:** 8GB RAM total — 3GB Java, 2GB MySQL, ~1.5GB Redis, rest for OS
- **Current caching:** Caffeine (in-process, 500 entries, 1-day TTL) — lost on restart
- **Current issues:** Wrong assessment loaded, data loading failures, lost submissions
- **Assessment flow:** Login → Select Assessment → Demographics → Instructions → Questions → Submit
- **Submit endpoint:** delete-then-save pattern inside @Transactional — risky under load
- **All assessment API endpoints are effectively unauthenticated** (SecurityConfig permitAll patterns)
- **Docker:** Backend runs in `api` container, MySQL in separate container, shared `career_shared_net` network

## Constraints

- **RAM:** 8GB total server — Redis must be capped at ~1.5GB with eviction policy
- **Docker:** Must integrate with existing docker-compose setup
- **Backward compatible:** No breaking changes to existing API contracts
- **Zero downtime:** Graceful fallback if Redis is unavailable (degrade to DB)
- **Spring Boot 2.5.5:** Must use compatible Redis libraries

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Redis single instance, not Cluster | 200 concurrent students doesn't need clustering | — Pending |
| Spring Data Redis + Lettuce client | Standard for Spring Boot 2.5.x, non-blocking | — Pending |
| ~1.5GB Redis with allkeys-lru eviction | Fits 8GB server constraint, assessment data is re-fetchable | — Pending |
| Server-side session in Redis, not JWT claims | Prevents wrong assessment loading at the source | — Pending |
| Save-before-delete for submissions | Prevents data loss from the current delete-then-save pattern | — Pending |

---
*Last updated: 2026-03-07 after v2.0 milestone initialization*
