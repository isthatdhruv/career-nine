# Roadmap: Career-Nine

## Milestones

- ✅ **v1.0 Responsive Overhaul** - Phases 1-7 (completed)
- 🚧 **v2.0 Redis Assessment Upgrade** - Phases 8-12 (in progress)

## Phases

<details>
<summary>✅ v1.0 Responsive Overhaul (Phases 1-7) - COMPLETED</summary>

### Phase 7: Dashboard Responsive Overhaul

**Goal:** Every page accessible from the Aside menu renders without horizontal overflow on mobile (375px) and tablet (768px), with MDB tables scrolling horizontally, xl modals going fullscreen, and complex forms stacking vertically

**Depends on:** Nothing (self-contained — creates SCSS infrastructure internally)

**Plans:** 5 plans (3 waves)

Plans:
- [ ] 07-01-PLAN.md — Wave 1: SCSS infrastructure + global MDB table, modal, and nav fixes
- [ ] 07-02-PLAN.md — Wave 2: Institute group + Student management responsive fixes (_institute.scss)
- [ ] 07-03-PLAN.md — Wave 2: Assessment + Questionnaire form pages responsive fixes (_assessment.scss)
- [ ] 07-04-PLAN.md — Wave 2: Qualities, Roles, Career, Faculty, Dashboard + sub-pages (_qualities.scss, _misc.scss)
- [ ] 07-05-PLAN.md — Wave 3: Visual verification checkpoint (human-verify all 29 pages)

</details>

---

### 🚧 v2.0 Redis Assessment Upgrade (In Progress)

**Milestone Goal:** Add Redis as a caching and session layer to make the student assessment flow robust, fast, and reliable under 200+ concurrent load. Eliminates wrong assessment loading, data loading failures, and submission loss.

- [ ] **Phase 8: Redis Infrastructure** - Foundation layer with graceful degradation
- [ ] **Phase 9: Redis Caching Layer** - Distributed cache for assessment data
- [ ] **Phase 10: Session Management** - Server-side sessions prevent wrong assessments
- [ ] **Phase 11: Safe Submission Pattern** - Reliable answer persistence
- [ ] **Phase 12: Frontend Resilience** - Graceful failure handling

## Phase Details

### Phase 8: Redis Infrastructure

**Goal**: Redis is integrated with Spring Boot and fails gracefully when unavailable

**Depends on**: Nothing (first phase of v2.0)

**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04

**Success Criteria** (what must be TRUE):
1. Redis container runs on career_shared_net with 1.5GB memory limit and AOF persistence
2. Spring Boot connects to Redis with connection pooling and health checks
3. Application degrades gracefully to Caffeine/DB when Redis is unavailable (no crashes)
4. Spring Actuator health endpoint reports Redis connection status and memory usage
5. Docker compose up starts MySQL + API + Redis without manual intervention

**Plans:** 2 plans (2 waves)

Plans:
- [ ] 08-01-PLAN.md — Docker Redis container + Maven deps + application.yml config
- [ ] 08-02-PLAN.md — RedisConfig + CacheErrorConfig Java classes

---

### Phase 9: Redis Caching Layer

**Goal**: Assessment data served from distributed Redis cache with automatic invalidation

**Depends on**: Phase 8

**Requirements**: CACHE-01, CACHE-02, CACHE-03, CACHE-04

**Success Criteria** (what must be TRUE):
1. assessmentDetails, assessmentQuestions, and measuredQualityTypes served from Redis cache (not Caffeine)
2. Cache automatically invalidates across all instances when assessment is locked, unlocked, updated, or deleted
3. Assessment prefetch endpoint loads questions from Redis cache with <200ms response time
4. Application startup warms critical caches to prevent thundering herd on cold start
5. Cache hit rate visible in Spring Actuator metrics

**Plans:** 2 plans (2 waves)

Plans:
- [ ] 09-01-PLAN.md — RedisCacheManager replaces Caffeine + application.yml migration
- [ ] 09-02-PLAN.md — Cache warming on startup + prefetch endpoint caching

---

### Phase 10: Session Management

**Goal**: Server-side sessions prevent wrong assessment loading and duplicate submissions

**Depends on**: Phase 8

**Requirements**: SESS-01, SESS-02

**Success Criteria** (what must be TRUE):
1. Student assessment session (student ID + assessment ID + start time) stored in Redis and validated on every API call
2. Students cannot load the wrong assessment when multiple students share a device
3. Duplicate submission attempts are blocked via Redis SET NX idempotency keys
4. Student can resume assessment after server restart without losing progress
5. Session expires after 24 hours of inactivity

**Plans**: TBD

Plans:
- [ ] TBD after planning

---

### Phase 11: Safe Submission Pattern

**Goal**: Answer submissions are reliable and recoverable from failures

**Depends on**: Phase 10

**Requirements**: SESS-03, SESS-04

**Success Criteria** (what must be TRUE):
1. Answer submission uses save-before-delete pattern (no data loss from current delete-then-save)
2. Answer drafts auto-save from localStorage to Redis every 30 seconds
3. Student can recover unsaved answers from Redis after browser crash
4. Submission processing completes even under 200 concurrent submissions
5. No duplicate answer records exist after concurrent submissions from same student

**Plans**: TBD

Plans:
- [ ] TBD after planning

---

### Phase 12: Frontend Resilience

**Goal**: Frontend handles failures gracefully with clear user feedback

**Depends on**: Phase 10

**Requirements**: FRONT-01, FRONT-02, FRONT-03

**Success Criteria** (what must be TRUE):
1. Frontend sends X-Session-Id header on all assessment API calls
2. Failed API calls retry automatically with exponential backoff (3 attempts before showing error)
3. User sees clear error message when submission fails (not generic error)
4. User can retry failed submission without losing answers
5. Loading states prevent double-submission during network delays

**Plans**: TBD

Plans:
- [ ] TBD after planning

---

## Progress

**Execution Order:**
Phases execute in numeric order: 8 → 9 → 10 → 11 → 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 7. Dashboard Responsive Overhaul | v1.0 | 0/5 | Complete | - |
| 8. Redis Infrastructure | v2.0 | 2/2 | ✓ Complete | 2026-03-07 |
| 9. Redis Caching Layer | v2.0 | 0/2 | Not started | - |
| 10. Session Management | v2.0 | 0/TBD | Not started | - |
| 11. Safe Submission Pattern | v2.0 | 0/TBD | Not started | - |
| 12. Frontend Resilience | v2.0 | 0/TBD | Not started | - |

---

*Roadmap created: 2026-03-07*
*Last updated: 2026-03-07 (Phase 8 complete)*
