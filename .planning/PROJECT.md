# Career-Nine

## What This Is

Career-Nine is a full-stack educational platform for student assessment, career guidance, and academic management. Two React frontends (admin dashboard + student assessment app) and a Spring Boot + MySQL backend. Serves 200+ concurrent students during peak assessment periods. Redis is now in the stack for caching and server-side assessment sessions (added in v2.0).

## Core Value

Students can reliably take assessments without data loss, wrong assessment loading, or submission failures — even under peak concurrent load.

**Adjacent value surfaced during v2.0 audit (drives v3.0):** Staff users (institute admins, principals, teachers, counsellors) need access to *only* the students/data within their scope (institute → session → class → section). The current system enforces almost no authorization, which is both a security gap and a blocker for multi-institute customers.

## Current Milestone: v3.0 Hybrid RBAC + ABAC Auth Redesign

**Goal:** Replace the current "URL-pattern authority" model with a hybrid:
- **RBAC** for verbs (roles → fine-grained permissions like `student.read`, `report.export`)
- **ABAC** for resource scope (4 attributes: `institute`, `session`, `class`, `section`)

A request is allowed iff the caller's role grants the verb **and** the target resource falls within at least one of the caller's scope grants. Multi-institute directors get multiple scope rows; a teacher with all sections of one class gets a single row with `section_id = NULL` (wildcard).

**Target outcomes:**
- No anonymously-reachable admin endpoints (eliminate the current mass-`permitAll`).
- Per-environment JWT signing secrets (eliminate the same-secret-everywhere risk).
- JWT out of `localStorage` (HttpOnly cookie + CSRF).
- Refresh tokens, logout, server-side revocation list.
- 4-dimension ABAC enforced on every student-data endpoint via `@PreAuthorize` + Hibernate filters.
- Audit log of authorization decisions for sensitive operations.

**Out of scope:** OAuth code paths (provider integration, redirect URI handling, OAuth-token storage). Tracked in [docs/AUTH_REDESIGN_PLAN.md](../docs/AUTH_REDESIGN_PLAN.md) §13 D1–D4 for a later cycle.

Full spec: [docs/AUTH_REDESIGN_PLAN.md](../docs/AUTH_REDESIGN_PLAN.md).

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

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
- ✓ Responsive frontend — **v1.0**
- ✓ Redis Docker container with 1.5GB memory cap and AOF persistence — **v2.0**
- ✓ Spring Boot Redis integration (Spring Data Redis + Lettuce, graceful degradation) — **v2.0**
- ✓ Distributed cache for assessment data (RedisCacheManager replaces Caffeine) — **v2.0**
- ✓ Cache warming on startup + prefetch endpoint caching — **v2.0**
- ✓ Server-side assessment session in Redis with sliding TTL and `X-Assessment-Session` header validation — **v2.0**
- ✓ Idempotent submission via Redis `SET NX` (no duplicate submissions) — **v2.0**
- ✓ Save-before-delete answer submission pattern — **v2.0**
- ✓ Draft auto-save / restore for crash recovery — **v2.0**
- ✓ Frontend resilience (retry with exponential backoff, submission state machine, inline error UI) — **v2.0**

### Active (v3.0 scope)

<!-- Hybrid RBAC + ABAC. See docs/AUTH_REDESIGN_PLAN.md for full detail. -->

- [ ] Externalize and rotate all secrets; per-environment JWT signing secrets
- [ ] Prune `SecurityConfig.permitAll()` to only truly public endpoints
- [ ] Enforce Razorpay webhook signature in all profiles
- [ ] Tighten `HttpFirewall` and CORS
- [ ] `permission` + `role_permission` tables; permission enum as single source of truth
- [ ] `user_scope` table (institute, session, class, section — NULL = wildcard)
- [ ] `student_info` schema fix: add `session_id` and `course_code` FKs (blocks 4-dim ABAC today)
- [ ] `refresh_token` and `auth_audit` tables
- [ ] `AuthorizationService` with SpEL bean (`@auth.allows(...)`)
- [ ] `@PreAuthorize` on every controller method; build-time check that none are missing
- [ ] Hibernate `@Filter` for scope-aware queries on student, assessment, campaign entities
- [ ] HttpOnly cookie session + CSRF token; drop `localStorage` JWT
- [ ] `useAuth().can()`, `<Can>`, `<RequirePermission>` components; menu driven by permissions
- [ ] 60-min access token + 7-day refresh token; `/auth/refresh`, `/auth/logout`, `/auth/me`
- [ ] Unify admin/student/counsellor/assessment auth onto one cookie-session model
- [ ] Rate limiting on `/auth/*` and bulk-import endpoints
- [ ] CSP, HSTS, `X-Frame-Options`, audit log writes for sensitive ops

### Out of Scope (v3.0)

- OAuth code paths — provider integration, redirect URI handling, OAuth-token DB storage (tracked separately)
- Spring Boot upgrade (2.5.5 → newer) — separate phase after Phase 20
- Assessment-app auth redesign — deferred to Phase 6 / separate plan (see `docs/AUTH_REDESIGN_PLAN.md` §9)
- Sub-institute (branch-level) scope — single institute granularity for v3.0; revisit if needed

## Context

- **Server constraint:** 8GB RAM total — 2GB MySQL, 3GB Java, 1.5GB Redis (added in v2.0), rest for OS.
- **v2.0 outcomes (validated):** Redis assessment session pattern works; cache hit on the assessment hot path; no submission loss under concurrent load.
- **v3.0 driver:** Independent audit (May 2026) of the auth stack surfaced critical gaps — most "admin" endpoints reachable anonymously, JWT secret identical across dev/staging/prod, no method-level authorization, `localStorage` JWT exposes XSS, `student_info` lacks the FKs needed to enforce session/class scope. See [docs/AUTH_REDESIGN_PLAN.md](../docs/AUTH_REDESIGN_PLAN.md) §13 for the full bugs catalog.
- **Assessment flow (still as v2.0 shipped):** Login → Select Assessment → Demographics → Instructions → Questions → Submit. Redis-backed session and idempotent submit are in place.
- **Auth flow today:** Email/password or OAuth → JWT in `localStorage` → axios injects `Authorization: Bearer` → URL-pattern check on the client (`authorityUrls`) + mostly-anonymous server side.
- **Docker:** Backend in `api`, MySQL in `mysql_db_api`, Redis on `career_shared_net`.

## Constraints

- **RAM:** 8GB total — no new server-side service in v3.0 (auth changes are in-process).
- **Backward compatible:** No breaking changes to existing API contracts during the v3.0 rollout. Log-only mode in Phase 15 lets us discover wrongly-mapped permissions without breaking real users.
- **Zero downtime:** Migrations run with `ddl-auto: validate` in staging/prod after Phase 14 — no destructive auto-update.
- **Spring Boot 2.5.5:** Must use compatible Spring Security 5.x patterns (`WebSecurityConfigurerAdapter`, `@EnableGlobalMethodSecurity`). Upgrade is a separate later milestone.
- **No auto-commits:** Tooling must not run `git commit` autonomously in this project — user commits manually.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Redis single instance, not Cluster | 200 concurrent students doesn't need clustering | ✓ Good (v2.0) |
| Spring Data Redis + Lettuce client | Standard for Spring Boot 2.5.x, non-blocking | ✓ Good (v2.0) |
| ~1.5GB Redis with allkeys-lru eviction | Fits 8GB server constraint, assessment data is re-fetchable | ✓ Good (v2.0) |
| Server-side session in Redis, not JWT claims | Prevents wrong assessment loading at the source | ✓ Good (v2.0) |
| Save-before-delete for submissions | Prevents data loss from the prior delete-then-save pattern | ✓ Good (v2.0) |
| Hybrid RBAC (verbs) + ABAC (scope) | Roles alone can't model "this teacher only for Class 10-B"; pure ABAC alone is too policy-heavy | — Pending (v3.0) |
| ABAC dimensions: `institute`, `session`, `class`, `section` | Matches existing entity hierarchy; `NULL` = wildcard handles "all sections of a class" cleanly | — Pending (v3.0) |
| Reuse existing entities for ABAC keys (`InstituteDetail.institute_code`, `InstituteSession.session_id`, `InstituteCourse.course_code`, `Section.id`) | No new entities — keeps migration narrow | — Pending (v3.0) |
| Multi-institute admins modeled via multiple `user_scope` rows | Avoids adding a separate institute-group entity | — Pending (v3.0) |
| `user_scope` is single source of truth for teacher assignments | No separate `teacher_assignment` table for now; adds columns later if product needs per-assignment metadata | — Pending (v3.0) |
| Backfill `student_info.session_id` from each institute's currently-active session | Deterministic, fail-closed on unresolved rows | — Pending (v3.0) |
| New staff users start with no scope (admin must grant) | Principle of least privilege | — Pending (v3.0) |
| OAuth code paths out of scope for v3.0 | Limits blast radius of the redesign; tracked separately | — Pending (v3.0) |
| HttpOnly cookie + CSRF token instead of `localStorage` JWT | Kills XSS token-exfiltration vector | — Pending (v3.0) |
| Short access token (60 min) + opaque refresh token (7 days), server-side revocable | Balances JWT statelessness against revocation needs | — Pending (v3.0) |
| GSD plugin for per-phase plan/execute | Sequential agentic flow, atomic commits, resumable | — Pending (v3.0) |

---
*Last updated: 2026-05-11 after v2.0 milestone archive + v3.0 milestone initialization*
