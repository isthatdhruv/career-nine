# Career-Nine Assessment — Pre-Event Audit (4000 Concurrent Students)

**Date:** 2026-06-11
**Scope:** Student registration → taking the assessment → submission → admin live tracking, end-to-end (frontend SPA, Spring backend, infra config).
**Method:** 8 specialized reviewers reading the actual code, every finding adversarially re-verified against the source. Load-bearing config facts re-confirmed by hand.
**Result:** 106 verified findings — **14 critical, 38 high, 38 medium, 16 low**.

> ⚠️ **Coverage caveat:** the completeness-critic pass (which hunts for un-traced cross-cutting flows — payment-gated starts, session-resume-after-browser-crash, OMR/offline upload colliding with online sessions) did not complete due to an account spend limit. Those areas got partial rather than exhaustive coverage. Everything listed below is confirmed.

---

## Verdict

**Not safe to run for 4000 concurrent students as-is.** There are six independent event-stoppers, any one of which can halt admission or silently destroy submitted answers. The worst three are **config changes**, not rewrites.

---

## 🔴 CRITICAL — must fix before the event

### C1. Rate limiter caps the whole venue at ~10 admissions/minute
*Found by 5 independent reviewers · scale-bottleneck · re-verified by hand*

`RateLimitFilter` puts `/auth/login`, `/auth/assessment-session`, `/entitlement/redeem-token`, and `/leads/capture` into **one shared 10-token-per-60-second bucket keyed by client IP**.

- `spring-social/.../security/ratelimit/RateLimitFilter.java:60-71` — `PER_IP_PATHS`
- `spring-social/src/main/resources/application.yml:221` — `ip-per-minute: 10` (no production override)
- `spring-social/src/main/resources/application.yml:557` — production `trust-xff: true`

Every student must `POST /auth/assessment-session` once to receive the `cn_at_asmnt` auth cookie before any assessment call works — it is the only issuer in the login flow (`/user/auth` sets no cookies). In a school lab, hundreds of students share one NAT egress IP, so the **entire venue is throttled to ~10 logins/mints per minute combined**. The 11th student per minute gets HTTP 429, which the SPA treats as a generic failure and dead-ends with *"Failed to start assessment. Please try again."*

**Impact at 4000:** 4000 ÷ 10/min ≈ **6.7 hours just to admit everyone**, plus retry storms making it worse. Event-stopping.

**Fix (config-only):** In the production profile of `application.yml` (~line 556), under `app.rate-limit:` add `ip-per-minute: 6000` (or `enabled: false` for the day). Long-term: key `/auth/assessment-session` and `/auth/login` per `(IP + username)` in `BucketRegistry`; have the SPA honor `Retry-After` instead of the generic catch-all in `AssessmentContext.tsx`.

---

### C2. Redis is the ONLY copy of submitted answers — and it is set to silently evict
*Found by 3 reviewers · data-loss · re-verified by hand*

`docker-compose.yml:34-35` runs Redis with `--maxmemory 2048mb --maxmemory-policy allkeys-lru`. This Redis is **not a cache** — it is the sole holder of submitted answer payloads (`career9:submitted:*`), partial drafts, live sessions, and submission locks until the async processor persists them to MySQL (`AssessmentSessionService.java:315`). `allkeys-lru` evicts *any* key under memory pressure.

Memory pressure is **guaranteed**: proctoring samples gaze 4×/sec, stored twice per question → ~2–4MB JSON per student → **4000 × ~3MB ≈ 8–16GB forced into a 2GB instance.**

**Impact at 4000:** Completed submissions silently vanish after the student sees "accepted" and leaves; active students get 403'd mid-test when their session key is evicted; partial-answer crash recovery evaporates. The single most likely silent-data-loss mechanism of the event.

**Fix:**
1. Switch this Redis to `--maxmemory-policy noeviction` (fail loudly on OOM instead of silently dropping data).
2. Move the Spring `@Cacheable` caches to a separate small LRU Redis or in-process cache.
3. Persist the submission JSON to MySQL synchronously inside `/submit` (one blob insert) so Redis isn't the only copy.
4. Delete proctoring payloads from Redis after they persist to MySQL — `ProctoringProcessorService.java:63` currently never does (`PROCTORING_TTL_HOURS=168`).

---

### C3. Uncommitted `X-Auth-Scope` header blinds the entire admin dashboard
*Found by 4 reviewers · functional-bug · re-verified by hand*

The working-tree change to `react-social/.../auth/core/AuthHelpers.ts:118-122` attaches `X-Auth-Scope: session` to **every** admin API request. But the backend CORS allowlist (`SecurityConfig.java:291-304`) is:
`Authorization, Content-Type, Accept, X-CSRF-Token, X-Assessment-Session, X-Assessment-Student-Id, X-Assessment-Id, X-Requested-With` — **`X-Auth-Scope` is NOT in it.**

The dashboard (`dashboard.career-9.com`) is cross-origin to the API (`api.career-9.com`), so every request now triggers a CORS preflight the browser rejects.

**Impact at 4000:** If the frontend ships without the matching backend change, **admins cannot log in and Live Tracking makes zero successful calls** — total loss of visibility for the whole event, including manual recovery tools.

**Fix:** Add `"X-Auth-Scope"` to `setAllowedHeaders` in `SecurityConfig.java:303` and **deploy the backend before or with the frontend.** Verify:
```bash
curl -X OPTIONS https://api.career-9.com/auth/me \
  -H 'Origin: https://dashboard.career-9.com' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: x-auth-scope'
# expect Access-Control-Allow-Headers to include x-auth-scope
```

---

### C4. Re-entering an assessment wipes saved progress and in-flight submissions
*Found by 2 reviewers · data-loss*

`startAssessment` runs `clearAllForMapping()` — which deletes partial answers AND submitted answers — on **every** entry into an assessment, including the "Continue Assessment" resume path.

- `spring-social/.../controller/career9/AssessmentTableController.java:644`
- `spring-social/.../service/AssessmentSessionService.java:563-572`

It only blocks when status is already `completed`, but status stays `ongoing` during the entire window between "submit accepted" and the async processor committing. So the partial-answer snapshot that recovery depends on is **structurally dead** (deleted before the page mounts), and any student who navigates back and re-clicks after submitting (guaranteed at 4000 students) **silently destroys their own submission** while it's queued. Live tracking then shows them "ongoing" forever.

**Fix:** In `startAssessment`, before `clearAllForMapping`: if `persistenceState` is pending/failed or `hasSubmittedAnswers()` is true, return 409 ("submission being processed"). For a genuine `ongoing` resume, skip `deletePartialAnswers()` so recovery finds the snapshot.

---

### C5. Submit failure path lies to students ("saved locally" when nothing is saved)
*Found by 2 reviewers · data-loss*

`career-nine-assessment/src/pages/SectionQuestionPage.tsx:1129` — `confirmAndSubmit` POSTs with a **10-second** `AbortSignal.timeout`. Under end-of-assessment load the server routinely takes >10s; the client aborts while the server keeps processing (it holds the 90s Redis lock), retries, and hits the lock → backend returns 409 `{status:'duplicate'}` (`AssessmentAnswerController.java:331-340`). The frontend treats any non-OK as failure, and after 3 tries shows *"Your answers are saved locally"* — **which is false**: answers are in-memory/Redis-only and never written to localStorage.

**Impact at 4000:** When thousands submit in the same ~10-minute window, hundreds see this simultaneously; some reload and lose their final section for real; duplicate retries hammer the saturated backend.

**Fix:** Treat HTTP 409 / `status:'duplicate'` as success-pending and poll submission status; raise the timeout to ~30–60s with jittered backoff; call `savePartialAnswers()` once before the retry loop; fix the alert text.

---

### C6. Host RAM is oversubscribed — OOM-kill = total outage
*Found by 1 reviewer · availability · re-verified by hand*

`docker-compose.yml` container limits sum to **~19GB on a 16GB droplet**:

| Container | Limit |
|---|---|
| mysql_db_api | 2.5g |
| redis_cache | 2.5g |
| gotenberg | 1.5g |
| api | 3g |
| kafka | 1.5g |
| report-worker | 1.5g |
| redis_staging | 0.768g |
| api-staging | 3g |
| mysql_db_staging | 1.5g |
| sync_cron | 0.256g |
| redisinsight | 1g |
| **Total** | **~19GB on 16GB** |

At peak the kernel OOM-kills MySQL or the API → outage for all 4000, repeated each time load re-spikes. Each API restart also discards queued-but-unprocessed submissions.

**Fix:** Before the event: `docker compose stop api-staging mysql_db_staging redis_staging sync_cron redisinsight` (frees ~5GB of limits); trim prod limits so their sum ≤ ~13GB; add an 8GB swapfile (`vm.swappiness=10`) as an OOM safety net.

---

## 🟠 HIGH — strongly recommended (38 total; grouped by theme)

### Async submission pipeline is undersized and lossy
- `SpringSocialApplication.java:15` — `@EnableAsync` is on but **no executor is configured**, so all async work (submission persistence, emails, audit, reports) shares Spring Boot's default 8 threads + unbounded in-memory queue.
- `AssessmentSubmissionProcessorService.java:145` — 4000 submits create a long backlog **lost entirely on restart**.
- `AssessmentSessionService.java:40` — the 90s submission lock expires while jobs wait, re-enabling duplicate double-inserts of answers and raw scores.
- **Fix:** dedicated bounded `ThreadPoolTaskExecutor` (core 16, max 32, bounded queue, `CallerRunsPolicy`) for submissions; re-check status under a pessimistic DB lock inside `persistToMySQL`; add a startup sweeper for orphaned pending rows.

### Live Tracking is both blind and expensive
- **Progress permanently 0%** for active students — `useHeartbeat.ts:24` counts answers from `localStorage` keys (`assessmentAnswers`, `assessmentRankingAnswers`, `assessmentTextAnswers`) that the Redis-only refactor **no longer writes**. Fix: send the count from in-memory React state.
- **O(N) per poll** — `LiveTrackingController.java:126-167` loads all 4000 mappings with N+1 lazy hydration, then does a **per-student sequential Redis GET + per-student `COUNT(DISTINCT)` SQL query**, re-run every 8s per admin viewer. Fix: one batched `multiGet`, one grouped aggregate count query, server-side cached snapshot, pagination.
- Admin UI **deliberately masks lost heartbeats and never times out "ongoing"** — admins cannot identify disconnected/stuck students during the event.

### Auth filter hits the DB on every single request
- `TokenAuthenticationFilter.java:189-197` — each assessment request (including every 30s heartbeat **and** an extra heartbeat fired on every question navigation) runs 2–4 uncached queries (`findById` + role/permission joins) against a 50-connection Hikari pool. At 4000 students this saturates the pool.
- **Fix:** short-TTL Caffeine cache for the `userStudentId → principal` resolution (e.g. 60–120s).

### Partial-answer flush is a 3-minute write storm that can corrupt finals
- `PartialAnswerFlushService.java:122-137` — every 3 minutes it re-flushes **every** active student (no dirty check — DELETE + re-INSERT all answer rows), on the single-threaded scheduler, and its check-then-act window lets it **overwrite a freshly-persisted final submission with a stale draft**.
- **Fix:** dirty-check via a flush marker key; guard `flushOneStudent` with `hasSubmittedAnswers()` inside its transaction; serialize against the submission lock.

### Answer persistence is fragile on flaky WiFi
- `assessmentApi.ts:22-27` — `savePartialAnswers` is a single `fetch` with `.catch(()=>{})`, no retry/timeout/keepalive, fired only at section boundaries, and `lastSavedAnswersRef` is marked "saved" **before** the request succeeds → whole sections silently disappear.
- `SectionQuestionPage.tsx:458` — a slow `/partial-restore` on resume **replaces** (not merges) state, wiping answers the student just gave; the fetch has no timeout.
- **Fix:** await + retry, mark saved only on success, add `keepalive` + a `pagehide` flush; add a dirty-guard before restore overwrites; add a restore timeout.

### Students can get trapped or silently skip submission
- `AssessmentGameWrapper.tsx:28-33` — game completion **awaits a Firestore write with no timeout**. Firestore doesn't reject while offline, so if a school firewall blocks `*.googleapis.com` (common), the student is **frozen on the game-over screen forever**. Fix: `Promise.race` with an ~8s timeout so `onComplete()` always fires; stash payload to localStorage and retry.
- `SectionQuestionPage.tsx:1062` — a student can reach the Thank-You page **without the submit POST ever firing** (`goToNextSection` on the last section navigates to `/completed` with only a fire-and-forget partial save). Fix: trigger the real submit flow there.

### Axios retries non-idempotent POSTs
- `http.ts:163-177` — the interceptor retries *any* failed request (registration, demographics, `startAssessment`) on timeout/5xx, causing **duplicate student accounts** (check-then-insert registration) and 4× retry-storm amplification.
- **Fix:** restrict auto-retry to idempotent methods (`get/head/options`), with per-request opt-in for safe retries.

### Magic-link / email-link students cannot start
- `AssessmentStartPage.tsx:41` — the redeem payload includes `studentDob` precisely so the page can seed it for the mint, but the page never stores it → mint aborts client-side.
- **Fix:** `localStorage.setItem('studentDob', String(data.studentDob))` after redeem (mirror `PaymentStatusPage.tsx:183-184`).

### Mint-failure fallback points at deleted code
- `AssessmentContext.tsx:276` — all mint failure branches (no DOB, 404, 403, network/5xx/429) "fall back to the legacy header path" that `http.ts` explicitly removed → student proceeds with **no auth carrier** and an alert loop.
- **Fix:** have mint return a typed reason; on failure, stop with a specific message per case instead of proceeding.

### Proctoring is heavy and unbounded
- `usePerQuestionProctoring.ts:81` / `useFaceTracking.ts:109` — gaze sampled 4×/sec, stored twice, the whole map `JSON.stringify`'d to localStorage on every navigation; WebGazer runs full face-mesh inference at ~60fps for the entire assessment → **UI sluggishness on low-end school machines** + multi-MB uploads.
- `ProctoringProcessorService.java:158-191` — retry scheduler uses blocking `KEYS` + GETs every full payload every 5 min, and `@Async` self-invocation makes retries run **serially on the single scheduler thread**, starving submission-retry and partial-flush jobs.
- **Fix:** downsample to ~1/sec, store one gaze array (derive direction server-side), per-question localStorage keys, delete from Redis after persist, dispatch retries through the async executor via a `self` proxy.

### Dashboard snapshot can heap-kill the API
- `DashboardSnapshotService.java:62` — computes a "hundreds-of-MB" JSON blob on the request thread with no single-flight protection; one admin refresh during the event can OOM the 3g container.
- **Fix:** stale-while-revalidate + per-key lock; move recompute off the request thread.

### MySQL is mistuned and shares one cnf with staging
- `mysql-custom.cnf:2-7` — `max_allowed_packet=512M`, `max_connections=200`, 1G buffer pool — the same file mounted into the 1.5g staging container (`docker-compose.yml:15` and `:271`).
- **Fix:** per-environment cnf; drop packet to 64–128M; size `max_connections` to the actual Hikari pools (api 50 + worker 50 + headroom).

---

## 🟡 MEDIUM — worth knowing (38 total; highlights)

- **Username generated as `Math.random()*100000`** with no uniqueness check or DB constraint — collisions near-certain at 4000 registrations and break login for the loser. Roll-number generation has the same read-max-then-+1 race (`SchoolRegistrationController`, in-JVM `synchronized` only).
- **Login DOB checked against `User.dobDate` but mint checks `StudentInfo.studentDob`** — column drift lets a student log in but fail to mint (or vice-versa).
- **`[SESSION-DEBUG] System.out.println` on every authenticated request** (working-tree filter) — synchronous I/O on the hot path for all 4000 students × every heartbeat, logging cookie lengths/IPs/JTIs (PII), no Docker log rotation. **Remove before the event.**
- **Service worker caches assessment JSON for 30 days (CacheFirst)** — stale questionnaires served during the event; a mid-event deploy force-reloads active students via `skipWaiting`+`clientsClaim`.
- **A single 401/403 on a fire-and-forget heartbeat hard-redirects the student to `/permission-denied` mid-question**, losing in-memory answers.
- **Assessment JWT TTL is 4h with no refresh path** — a long assessment + slow start can log a student out mid-test with no recovery.
- **Question payload embeds option images as inline base64 LONGBLOBs** — 4000 students each download the full multi-MB question bank at the synchronized start.
- **`AbortSignal.timeout` in the submit path throws `TypeError` on older school browsers** — submission permanently fails on those machines.
- **Per-question selection rules (min/exact) are bypassable via the sidebar navigator** — submission accepts rule-violating answer sets.
- **Two tabs/devices clobber each other** — last-write-wins partial buffer + delete-and-replace submit silently discards the other session's answers.
- **Failure rows keep their original `firstFailedAt` forever** — the 6-hourly auto-expire sweep can wipe a same-day submission.
- **In-game Restart button does `window.location.reload()`** — wipes in-memory section answers.
- **Resumed text answers that matched an option are restored into the wrong state bucket** — answered text questions count as unanswered.
- **Gotenberg (3 CPUs) + report-worker (3 CPUs) can together claim 6 of 4 vCPUs** while report-on-completion PDFs render during the event.
- **Scheduled sweeps use blocking Redis `KEYS`** (mislabeled SCAN) against a near-full 2GB Redis every 3 and 5 minutes.

---

## ✅ Checked and cleared (notable refutations)

These were investigated and are **not** problems — do not chase them:

- **"Working tree ships `spring.profiles.active: dev` → prod boots against localhost"** — *refuted, re-confirmed by hand.* The uncommitted `application.yml:27` does flip `production`→`dev`, **but** `docker-compose.yml:93` passes `--spring.profiles.active=production` on the command line, which overrides the file. Harmless in containerized prod. **Still revert that line before committing** — anyone running the jar manually without the flag would boot dev.
- **"B2C cookie-auth gate is OFF in production so campaign students can never POST"** — refuted.
- **"Mint failure leaves SPA with no auth carrier and silently 401s with no redirect"** — partially refuted (the dead-end alert path is the real issue; see HIGH "Mint-failure fallback").
- **"No ErrorBoundary → any render exception white-screens students"** — refuted for the event path.
- **"verify-details DOB collision returns credentials for a non-matching student"** — refuted.
- **"DOB timezone mismatch between registration and assessment-session"** — refuted (login uses `DATE()` truncation).
- **"Frontend defaults userStudentId/assessmentId to 0 → all share Redis key `proctoring:0:0`"** — refuted.

---

## Recommended pre-event action order

**Config-only (~1 hour, low risk):**
1. Raise `app.rate-limit.ip-per-minute` in the production profile (C1).
2. Add `X-Auth-Scope` to the CORS allowlist; deploy backend with the frontend (C3).
3. Set Redis to `noeviction`; stop the staging stack + redisinsight + sync_cron; add swap (C2, C6).
4. Revert the `active: dev` line in `application.yml`.

**Code, before the event:**
5. Stop `startAssessment` from wiping progress on resume / pending submit (C4).
6. Fix the submit 409-as-failure loop and the false "saved locally" message (C5).
7. Configure a bounded async executor for submissions + add a startup sweeper (HIGH).
8. Fix live-tracking `answeredCount` and the O(N) poll query (HIGH).

---

## Severity summary

| Severity | Count |
|---|---|
| 🔴 Critical | 14 (6 distinct root causes) |
| 🟠 High | 38 |
| 🟡 Medium | 38 |
| 🟢 Low | 16 |
| **Total confirmed** | **106** |
| Refuted / cleared | 18 |

*Full per-finding detail with code excerpts and verifier reasoning was produced by the audit workflow and is available in the run output.*
