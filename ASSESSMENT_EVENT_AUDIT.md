# Career-Nine Assessment — Pre-Event Audit (4000 Concurrent Students)

**Date:** 2026-06-11
**Scope:** Student registration → taking the assessment → submission → admin live tracking, end-to-end (assessment SPA, Spring backend, admin dashboard, infra config).
**Method:** 8 specialized workflow reviewers reading the actual code, every finding adversarially re-verified against the source by independent verifier agents. Load-bearing config facts re-confirmed by hand.
**Result:** 106 confirmed findings — **14 critical, 38 high, 38 medium, 16 low** — deduplicated below into **64 distinct issues** (C1–C6, H1–H18, M1–M30, L1–L10). Every workflow finding maps to exactly one section; duplicate reports are noted as "reported N×". 18 candidate findings were refuted and are listed at the end.

Each issue has two remedies:
- **Easiest fix** — the smallest change that removes the event risk (often config-only or a few lines). Safe to do under time pressure.
- **Recommended fix** — the proper solution to keep.

> ⚠️ **Coverage caveat:** the completeness-critic pass (hunting for un-traced cross-cutting flows — payment-gated starts, session-resume-after-browser-crash, OMR/offline upload colliding with online sessions) did not complete due to an account spend limit. Those areas got partial rather than exhaustive coverage. Everything listed below is confirmed.

---

## Verdict

**Not safe to run for 4000 concurrent students as-is.** Six independent event-stoppers exist; any one can halt admission or silently destroy submitted answers. The worst three are **config changes**, not rewrites. See the action plan at the end.

> **Verdict update 2026-06-12:** every critical except C4 is now fixed (C6 closed as non-issue), plus 11 of 18 highs and 6 mediums. See the fix tracker below.

---

## Fix tracker (updated 2026-06-12)

Every issue below carries a `> **Status:**` line. Legend: ✅ fixed · ◐ partial · ➖ closed as non-issue · ⬜ open.

| | ✅ Fixed | ◐ Partial | ➖ Non-issue | ⬜ Open |
|---|---|---|---|---|
| **Critical** | C1 C2 C3 C5 | — | C6 | **C4** |
| **High** | H1 H2 H3 H4 H5 H6 H7 H8 H11 H15 H18 | H16 | — | H9 H10 H12 H13 H14 H17 |
| **Medium** | M5 M6 M7 M10 M11 M29 | M8 M18 M30 | M26 | M1–M4 M9 M12–M17 M19–M25 M27 M28 |
| **Low** | L4 | — | — | L1–L3 L5–L10 |
| **Count** | **22** | **4** | **2** | **36** |

All fixes verified 2026-06-12: backend `mvn compile` + `TokenAuthenticationFilterTest` green; frontend `tsc` + full `vite build` green. **C4 (startAssessment wiping resume snapshots and in-flight submissions) is the highest-impact remaining item.**

Operational items still needed on the droplet / before event day (no code):
- Deploy the backend **with or before** the dashboard frontend (C3 CORS pairing).
- Recreate `redis_cache` (`docker compose up -d redis_cache`) to apply `noeviction` (C2).
- Revert the uncommitted `active: dev` in application.yml before commit/deploy (L8).
- Frontend deploy freeze during the event window (M17).
- Verify the event questionnaire has no base64 option images (M27).
- Auth-audit smoke test: deny-count must be 0 for a real student token (L9).
- Decide proctoring ON or OFF for the event — flipping `VITE_PROCTORING_ENABLED=false` + rebuild + redeploy disables it entirely (H15).

---

# 🔴 CRITICAL (14 findings → 6 root causes)

## C1. Rate limiter caps the whole venue at ~10 admissions/minute

> **Status: ✅ FIXED (2026-06-12)** — production `app.rate-limit.ip-per-minute: 6000` added (application.yml production profile).
*reported 5× (4 critical + 1 high) · scale-bottleneck/availability · re-verified by hand*

**Where:** `spring-social/.../security/ratelimit/RateLimitFilter.java:60-71` (`PER_IP_PATHS`), `application.yml:221` (`ip-per-minute: 10`, no production override), `application.yml:557` (production `trust-xff: true`).

**Problem:** `/auth/login`, `/auth/assessment-session`, `/auth/refresh`, `/auth/signup`, `/entitlement/redeem-token` and `/leads/capture` all share **one 10-token-per-60s bucket keyed by client IP** (`BucketRegistry` keys per `IP:<addr>`, not per path). Every student must `POST /auth/assessment-session` once to receive the `cn_at_asmnt` auth cookie before any assessment call works — it is the only issuer in the login flow (`/user/auth` sets no cookies). A school lab shares one NAT egress IP → the whole venue gets ~10 logins/mints per minute combined; the 11th student per minute gets HTTP 429, which the SPA dead-ends as *"Failed to start assessment. Please try again."* 4000 ÷ 10/min ≈ **6.7 hours just to admit everyone.** The same bucket also throttles venue-admin logins and magic-link redemption.

**Easiest fix:** One line in the production profile of `application.yml` (~line 556, under the existing `app.rate-limit:` block): `ip-per-minute: 6000` — or `enabled: false` for event day if one day of brute-force exposure is acceptable.

**Recommended fix:** Split buckets per `(IP + path)` in `BucketRegistry.bucketFor`; key `/auth/assessment-session` and `/auth/login` per `(IP + username)` so a shared NAT can't exhaust admission while brute-force protection still works per account; set production `trust-xff` correctly for the actual proxy chain (today the leftmost XFF is spoofable); make the SPA handle 429 explicitly in `AssessmentContext.tsx mint()` (honor `Retry-After`, auto-retry) instead of the generic catch-all.

---

## C2. Redis is the ONLY copy of submitted answers — and it is set to silently evict

> **Status: ✅ FIXED (2026-06-12)** — redis_cache → `noeviction`; proctoring payload deleted from Redis after MySQL persist; `PROCTORING_TTL_HOURS` 168→2.
*reported 3× critical · data-loss · re-verified by hand*

**Where:** `docker-compose.yml:34-35` (`--maxmemory 2048mb --maxmemory-policy allkeys-lru`), `AssessmentSessionService.java:315` (submitted payloads), `:451` (proctoring payloads, `PROCTORING_TTL_HOURS=168`, never deleted on success — `ProctoringProcessorService.java:63`).

**Problem:** This Redis is not a cache — it is the sole holder of submitted answer payloads (`career9:submitted:*`), partial drafts, live sessions, and submission locks until the async processor persists to MySQL. `allkeys-lru` evicts *any* key under pressure. Pressure is **guaranteed**: proctoring stores ~2–4MB JSON per student (gaze sampled 4×/sec, duplicated per question), kept 7 days → **4000 × ~3MB ≈ 8–16GB forced into a 2GB instance.** Evictions silently destroy completed submissions (student saw "accepted" and left), 403 active students mid-test when session keys vanish, and erase partial-answer crash recovery. The single most likely silent-data-loss mechanism of the event.

**Easiest fix:** (1) Change `docker-compose.yml` to `--maxmemory-policy noeviction` so writes fail loudly instead of silently dropping data; (2) in `ProctoringProcessorService.processAsync` success path, call `deleteProctoringData(studentId, assessmentId)` after `persistToMySQL` succeeds, and cut `PROCTORING_TTL_HOURS` from 168 to ~2.

**Recommended fix:** Split Redis: a `noeviction` instance (AOF on) for `career9:session/partial/submitted/proctoring` keys, a separate small LRU instance (or in-process Caffeine) for the Spring `@Cacheable` caches. Persist the raw submission JSON to MySQL synchronously inside `/submit` (one blob insert in the same write that sets `persistenceState="pending"`), and make the processor fall back to that row when Redis returns null.

---

## C3. Uncommitted `X-Auth-Scope` header blinds the entire admin dashboard

> **Status: ✅ FIXED (2026-06-12)** — `X-Auth-Scope` added to CORS `setAllowedHeaders`. **Deploy backend with/before the frontend.**
*reported 4× (2 critical + 2 high) · functional-bug · re-verified by hand*

**Where:** `react-social/.../auth/core/AuthHelpers.ts:118-122` (uncommitted — adds `X-Auth-Scope: session` to every admin API request), `spring-social/.../config/SecurityConfig.java:291-304` (CORS `setAllowedHeaders` does **not** include `X-Auth-Scope`).

**Problem:** The dashboard (`dashboard.career-9.com`) is cross-origin to the API (`api.career-9.com`); a non-safelisted request header forces a CORS preflight, which Spring's `CorsConfigurationSource` rejects. If this working tree ships, **admins cannot log in and Live Tracking makes zero successful calls** — total loss of visibility for the event, including the manual recovery tools (flush-partial-to-db, retry-now).

**Easiest fix (= recommended):** Add `"X-Auth-Scope"` to `setAllowedHeaders` in `SecurityConfig.java:303` and **deploy the backend before or together with the frontend**. Verify:
```bash
curl -X OPTIONS https://api.career-9.com/auth/me \
  -H 'Origin: https://dashboard.career-9.com' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: x-auth-scope'
# expect Access-Control-Allow-Headers to include x-auth-scope
```
**Recommended extra:** add a CORS preflight test to CI so future custom headers can't ship without the allowlist entry.

---

## C4. Re-entering an assessment wipes saved progress and in-flight submissions

> **Status: ⬜ OPEN** — Next critical to fix — startAssessment still wipes resume snapshots and in-flight submissions.
*reported 2× critical · data-loss*

**Where:** `AssessmentTableController.java:644` (`startAssessment` → `clearAllForMapping()`), `AssessmentSessionService.java:563-572` (deletes partial AND submitted answers).

**Problem:** `startAssessment` runs on **every** entry — including the "Continue Assessment" resume path — and wipes partial answers, submitted payloads, session and lock. It only blocks when status is already `completed`, but status stays `ongoing` for the whole window between "submit accepted" and the async processor committing (minutes under the 8-thread backlog). Consequences: (a) the `/partial-restore` recovery contract is structurally dead — the snapshot is deleted before `SectionQuestionPage` mounts; (b) any student who navigates back and re-clicks after submitting **silently destroys their own queued submission**; live tracking shows them "ongoing" forever. The client half: `StudentLoginPage`'s mount effect also clears the locally preserved answers it just rescued.

**Easiest fix:** In `startAssessment` (AssessmentTableController.java:637-650): if `"pending".equals(mapping.getPersistenceState())` or `assessmentSessionService.hasSubmittedAnswers(...)` → return 409 "submission being processed" instead of wiping; for a genuine `ongoing` resume, skip `deletePartialAnswers()` (only clear session/lock).

**Recommended fix:** Same guards, plus: never call `deleteSubmittedAnswers()` from the student-facing start path (reserve for an explicit admin reset flow); make the status transition a conditional update (`UPDATE ... SET status='ongoing' WHERE status NOT IN ('completed','pending')`) to close the stale-overwrite race; fix the login-page effect so rescued local answers survive.

---

## C5. Submit failure path lies to students ("saved locally" when nothing is saved)

> **Status: ✅ FIXED (2026-06-12)** — 409/duplicate treated as accepted; 60s feature-safe timeout; pre-submit `savePartialAnswers` snapshot; truthful failure alert.
*reported 2× critical · data-loss*

**Where:** `career-nine-assessment/src/pages/SectionQuestionPage.tsx:1129` (`confirmAndSubmit`, raw `fetch` + `AbortSignal.timeout(10000)`, 3 attempts), `AssessmentAnswerController.java:331-340` (409 `{status:'duplicate'}` from the 90s submission lock).

**Problem:** Under end-of-assessment load the server routinely takes >10s. The client aborts (server keeps processing and holds the lock), retries, hits the lock → 409, which the frontend counts as a failure (`!response.ok`). After 3 "failures" the student sees *"Your answers are saved locally"* — **false**: answers are in-memory/Redis-only, never in localStorage. When thousands submit in the same ~10-minute window, hundreds see this simultaneously; some reload and genuinely lose their final section; each false failure re-sent the full payload 3×, amplifying the load spike.

**Easiest fix:** In `confirmAndSubmit`: treat HTTP 409 / body `status:'duplicate'` as success-pending (navigate to `/studentAssessment/completed` or poll mapping status); raise the timeout to 30–60s; correct the alert text.

**Recommended fix:** All of the above plus: call `savePartialAnswers(generateSubmissionJSON())` once before the retry loop so the final section is snapshotted to Redis regardless of submit outcome; jittered exponential backoff; a submission-status poll endpoint the completed page can confirm against.

---

## C6. Host RAM is oversubscribed — OOM-kill = total outage

> **Status: ➖ CLOSED — NOT AN ISSUE** — Per Dhruv 2026-06-12: only `gotenberg`, `redis_cache`, `api`, `mysql_db_api` actually run on the box (~9.5GB of limits on 16GB). Staging/kafka/report-worker/redisinsight are not running.
*reported 1× critical · availability · re-verified by hand*

**Where:** `docker-compose.yml` (limits): mysql_db_api 2.5g + redis_cache 2.5g + gotenberg 1.5g + api 3g + kafka 1.5g + report-worker 1.5g + redis_staging 768m + api-staging 3g + mysql_db_staging 1.5g + sync_cron 256m + redisinsight 1g ≈ **19.25GB of limits on a 16GB droplet** (which also runs the OS and dockerd).

**Problem:** Limits cap individual containers; nothing prevents their sum exhausting physical RAM. At peak the kernel OOM-kills MySQL or the API → outage for all 4000 students, repeated as load re-spikes after each restart. Each API restart also discards the queued-but-unprocessed submissions (see H1) and resets the in-memory rate-limit buckets and jti deny list.

**Easiest fix:** Before the event: `docker compose stop api-staging mysql_db_staging redis_staging sync_cron redisinsight` (frees ~5.25GB of limits / ~3.5-4GB actual RAM); add an 8GB swapfile as an OOM safety net (`fallocate -l 8G /swapfile && mkswap /swapfile && swapon /swapfile`, `vm.swappiness=10`).

**Recommended fix:** Same, plus trim prod limits so their sum ≤ ~13GB (e.g. redis_cache maxmemory 1536mb/limit 2g, kafka 1g), and add host-level memory monitoring/alerting for event day.

---

# 🟠 HIGH (38 findings → 18 distinct issues)

## H1. Async submission pipeline: 8 default threads, unbounded queue, lost on restart

> **Status: ✅ FIXED (2026-06-12)** — `AsyncExecutorsConfig` — bounded `submissionExecutor` + `proctoringExecutor` + default pool (carries both `applicationTaskExecutor`/`taskExecutor` names); `ApplicationReadyEvent` sweeper re-enqueues `persistenceState='pending'` mappings whose Redis payload survived.
*reported 3× · scale-bottleneck/data-loss*

**Where:** `SpringSocialApplication.java:15` (`@EnableAsync`, no executor bean, no `spring.task.execution` tuning anywhere), `AssessmentSubmissionProcessorService.java:145`.

**Problem:** All `@Async` work — submission persistence, Odoo emails (no response timeout on the bare WebClient), audit logging, report generation — shares Spring Boot's default `applicationTaskExecutor`: 8 core threads + **unbounded in-memory queue**. 4000 near-simultaneous submits create a backlog of tens of minutes during which students sit in the dangerous accepted-but-not-persisted window (see C4), and **everything queued is lost on an API restart** (likely, given C6) with no automatic sweeper.

**Easiest fix:** Add to the production profile: `spring.task.execution.pool.core-size: 24`, `max-size: 32`, `queue-capacity: 2000` (CallerRunsPolicy via a small `TaskExecutorCustomizer` if needed) — one config block, drains 4000 submits in minutes.

**Recommended fix:** Dedicated bounded `@Bean("submissionExecutor")` `ThreadPoolTaskExecutor` used via `@Async("submissionExecutor")` on `processSubmissionAsync`, a separate small executor for email/audit so slow Odoo calls can't starve submissions, and a `@PostConstruct`/startup sweeper that re-enqueues any mapping with `persistenceState='pending'` whose `submitted:` key still exists in Redis.

## H2. 90s submission lock expires in the backlog → duplicate concurrent processing

> **Status: ✅ FIXED (2026-06-12)** — in-flight resubmission guard in `/submit` (pending/processing/retrying → acknowledge, no re-enqueue); `persistToMySQL` re-loads mapping `FOR UPDATE`, bails if already persisted, and the losing pass skips email/entitlement/report hooks.
*reported 2× · race-condition*

**Where:** `AssessmentSessionService.java:40` (`SUBMIT_LOCK_TTL_SECONDS=90`), `AssessmentSubmissionProcessorService.java:167` (lock cleared unconditionally in `finally`; `processSubmissionInternal` never re-checks).

**Problem:** Queued jobs routinely wait >90s at event scale. After expiry, a second `/submit` (double-click, browser retry — guaranteed given C5) acquires a fresh lock and enqueues a second processor task. Two tasks then persist the same submission concurrently → double-inserted answer rows and raw scores.

**Easiest fix:** In `/submit`, before acquiring the lock: if a `submitted:` key already exists with `processingStatus` pending/processing, return 200 `{status:"accepted"}` immediately without enqueuing a second job.

**Recommended fix:** Same, plus serialize at the DB: `persistToMySQL` re-loads the `StudentAssessmentMapping` with `@Lock(PESSIMISTIC_WRITE)` and re-checks status/persistenceState inside the transaction, returning early if another pass already committed.

## H3. Live-tracking poll is O(N) round-trips: per-student Redis GET + per-student COUNT, every 8s per admin

> **Status: ✅ FIXED (2026-06-12)** — one Redis MGET (`getHeartbeats`) + one grouped `COUNT(DISTINCT)` (`countDistinctQuestionsAnsweredGroupedByStudent`) replace the per-student loop.
*reported 4× · scale-bottleneck*

**Where:** `LiveTrackingController.java:126-167`.

**Problem:** `GET /assessments/{id}/live-tracking` loads ALL mappings (no pagination), then per student: lazy-walks `UserStudent → StudentInfo → User → InstituteDetail` (N+1), does one **sequential** Redis GET for the heartbeat, and for every student without a live heartbeat one `countDistinctQuestionsAnsweredByStudent` SQL query. At 4000 students × one poll per 8s per admin viewer, this alone can saturate the DB pool and Redis.

**Easiest fix:** Batch the two hot loops: one `redisTemplate.opsForValue().multiGet(allHeartbeatKeys)` and one grouped aggregate (`SELECT user_student_id, COUNT(DISTINCT questionnaire_question_id) ... GROUP BY user_student_id`) instead of per-student calls — two query-shape changes inside the existing method.

**Recommended fix:** Same, plus: fetch-join (or projection) the entity graph to kill the N+1; compute the snapshot once per assessment per poll-interval in a short-TTL server-side cache shared by all admin viewers; add pagination to the response.

## H4. Live-tracking progress is permanently 0% — heartbeat counts localStorage keys nothing writes

> **Status: ✅ FIXED (2026-06-12)** — `useHeartbeat` takes an `answeredCount` getter reading the in-memory answer-state refs; backend floors the live count at the DB count so progress no longer dips to 0% on non-question pages.
*reported 3× · functional/logical-bug*

**Where:** `career-nine-assessment/src/hooks/useHeartbeat.ts:19-68` (`countAnsweredQuestions` reads `assessmentAnswers`/`assessmentRankingAnswers`/`assessmentTextAnswers`).

**Problem:** The Redis-only answer-state refactor removed all writers of those localStorage keys (grep: only readers and `removeItem` remain). Every heartbeat reports `answeredCount=0`, and the heartbeat value **overrides** the DB count in the tracking view — so admins watch 4000 students apparently stuck at zero progress for the entire event.

**Easiest fix:** Add `answeredCount?: () => number` to `HeartbeatOptions` (a getter ref so the 30s interval doesn't restart per answer) and pass a count derived from `SectionQuestionPage`'s in-memory `answers/rankingAnswers/textAnswers` state; delete `countAnsweredQuestions`.

**Recommended fix:** Same, plus have `LiveTrackingController` prefer the DB-side aggregate count (from H3's grouped query) whenever the heartbeat count is absent or lower — server data beats client-reported data.

## H5. Auth filter hits the DB 2–4× on every request (incl. every heartbeat)

> **Status: ✅ FIXED (2026-06-12)** — Caffeine cache (120s TTL, 10k max) for the assessment-scope principal hydration in `TokenAuthenticationFilter`.
*reported 3× (2 high + 1 low) · scale-bottleneck*

**Where:** `TokenAuthenticationFilter.java:189-197` (working tree — `userStudentRepository.findById` + `customUserDetailsService.loadUserById`, which runs user + role-scope + permission queries, uncached).

**Problem:** Every request carrying `cn_at_asmnt` — including every 30s heartbeat and the extra heartbeat fired per question navigation (M10) — pays 2–4 queries against the 50-connection Hikari pool shared with 300 Tomcat threads. At 4000 students this is thousands of queries/sec of pure auth overhead.

**Easiest fix:** Wrap the `(userStudentId → principal)` resolution in a Caffeine cache (`expireAfterWrite` 60–120s, `maximumSize` 10k) inside the filter's assessment-scope branch.

**Recommended fix:** Same cache, plus: skip the heavy role/permission hydration entirely when `auth.enforce-mode=log-only` (production's current mode — the minimal-principal fallback at `:203-208` already satisfies the security chain and service-layer ABAC).

## H6. Partial-answer auto-flush races the submission processor — stale draft can overwrite final answers

> **Status: ✅ FIXED (2026-06-12)** — `hasSubmittedAnswers` guard INSIDE `flushOneStudent`'s transaction, immediately before the destructive delete.
*reported 3× (2 high + 1 medium) · race-condition/data-loss*

**Where:** `PartialAnswerFlushService.java:122-157` (check-then-act: `hasSubmissionLock` + status checked outside the flush transaction, then delete-and-replace of all `assessment_answer` rows).

**Problem:** With thousands of entries per 3-minute sweep, the gap between the check and the flush stretches to minutes. Interleaving: submission processor commits final answers → flush (checked earlier, lock expired) deletes them and re-inserts the older partial draft. Silent corruption of a completed submission.

**Easiest fix:** Inside `flushOneStudent`, within its transaction and before the delete: skip if `assessmentSessionService.hasSubmittedAnswers(studentId, assessmentId)` (the `submitted:` key durably marks a submission from `/submit` until 7 days post-success).

**Recommended fix:** Same guard, plus serialize flush and processor on the same submission lock (`acquireSubmissionLock`, skip if not acquired, release in `finally`) so the two writers can never interleave.

## H7. Auto-flush rewrites EVERY active student's answers every 3 minutes (no dirty check)

> **Status: ✅ FIXED (2026-06-12)** — `savedAt` dirty-marker (`career9:partialFlushed:*`) — unchanged buffers are skipped each sweep.
*reported 2× · scale-bottleneck*

**Where:** `PartialAnswerFlushService.java:126-131` (flushed Redis keys deliberately retained for 24h TTL; no changed-since-last-flush check).

**Problem:** Every sweep re-flushes every student with any partial data — full DELETE + re-INSERT of all their answer rows plus ~5 lookups each, even if nothing changed. 4000 students × ~100 answers = ~400k row writes every 3 minutes, on the **single-threaded scheduler** that also runs the submission-retry pump and proctoring retries (H16).

**Easiest fix:** Dirty-check: after a successful flush, store the payload's `savedAt` in a marker key (`career9:partialFlushed:{sid}:{aid}`, same TTL); skip entries whose `savedAt` is unchanged. Turns steady-state sweeps into near no-ops.

**Recommended fix:** Same, plus move the flush loop off the default scheduler onto its own executor so a slow sweep can't starve the other scheduled jobs.

## H8. Section saves are fire-and-forget and marked "saved" before they succeed

> **Status: ✅ FIXED (2026-06-12)** — `savePartialAnswers` async + 3 retries + `keepalive`, snapshot marked saved only on server confirm, `pagehide` last-chance flush added.
*reported 1× · data-loss*

**Where:** `career-nine-assessment/src/api/assessmentApi.ts:22-27` (`savePartialAnswers`: single `fetch`, `.catch(() => {})`, no retry/timeout/keepalive), `SectionQuestionPage.tsx:315-327, 1043-1052` (`lastSavedAnswersRef.current = snapshot` assigned **before** the request is sent).

**Problem:** On flaky school WiFi a failed boundary save is recorded as saved — the dedup logic then never retries it. Whole sections silently disappear from the crash-recovery snapshot.

**Easiest fix:** Make `savePartialAnswers` async-checked: `if (res.ok)` → only then set `lastSavedAnswersRef`; add `keepalive: true`; 2–3 retries with backoff.

**Recommended fix:** Same, plus a `pagehide`/`visibilitychange` flush (with `keepalive`) and a debounced 30–60s autosave (see M8) so saves don't depend solely on section transitions.

## H9. Partial-restore wholesale-replaces answer state with no timeout — slow response wipes fresh answers

> **Status: ⬜ OPEN**
*reported 2× · race-condition*

**Where:** `SectionQuestionPage.tsx:412-461` (`setAnswers(hydrated)` etc. replace, not merge, whenever the response arrives), `assessmentApi.ts:39-59` (`restorePartialAnswers`: plain fetch, no AbortSignal).

**Problem:** The page is interactive while the GET is in flight; a resuming student who answers during a slow restore has those answers silently replaced by the older snapshot. A failed restore also lets the next boundary save overwrite the Redis snapshot with fewer answers.

**Easiest fix:** Add `signal: AbortSignal.timeout(10000)` (via the feature-safe helper from M30) to the restore fetch; set a `dirtyRef` in every answer mutation handler; skip the `set*` calls if `dirtyRef.current` is true (or merge per question, keeping local over restored).

**Recommended fix:** Merge per question instead of replace; distinguish definitive 404 (`{answers:[]}`) from transient errors and retry the latter with backoff before allowing any boundary save.

## H10. Game completion awaits a Firestore write with no timeout — students frozen on game-over screen

> **Status: ⬜ OPEN**
*reported 2× · availability/data-loss*

**Where:** `career-nine-assessment/src/games/AssessmentGameWrapper.tsx:28-80` (`await saveAnimalReaction/saveRabbitPath/saveHydroTube`), `DataContext.tsx:97-98` (`await setDoc(...)` — Firestore promises resolve only on server ack and never reject while offline).

**Problem:** If the school firewall blocks `*.googleapis.com` (very common), the write queues forever, `onComplete()` never fires, and the student is **trapped in the full-screen game overlay** with no way forward. On rejection the result is silently discarded but the question is marked answered.

**Easiest fix:** `await Promise.race([savePromise, new Promise(r => setTimeout(r, 8000))])` so `onComplete()` always fires; on timeout/rejection, stash the payload in a `pendingGameResults` localStorage queue.

**Recommended fix:** Same, plus retry the queue in the background and POST a copy of game results to the own backend (which is reachable if the assessment works at all) instead of relying solely on Firestore.

## H11. Students can reach the Thank-You page without the submit POST ever firing

> **Status: ✅ FIXED (2026-06-12)** — last section now routes into `handleSubmitAssessment()` (confirm → real submit POST) instead of the thank-you page.
*reported 1× · logical-bug/data-loss*

**Where:** `SectionQuestionPage.tsx:1018-1064` (`goNext` → `goToNextSection`; on the last section it `navigate('/studentAssessment/completed')` with only a fire-and-forget partial save — never `POST /assessment-answer/submit`).

**Problem:** A student whose answer pattern routes through this path believes they finished; their assessment is never submitted. Live tracking shows them ongoing forever; they appear in no results.

**Easiest fix:** In `goToNextSection`, when there is no next section, call `handleSubmitAssessment()` (the confirm-dialog → `confirmAndSubmit` flow) instead of navigating to `/completed`.

**Recommended fix:** Same, plus a guard on the ThankYou route: only render "completed" after a confirmed submit (flag set on 2xx/409-resolved submit), otherwise redirect back with a message.

## H12. Axios auto-retries non-idempotent POSTs — duplicate registrations and retry storms

> **Status: ⬜ OPEN** — Groundwork only: `__noRetry` per-request opt-out added to the interceptor (used by heartbeat). Idempotent-only retry policy still pending.
*reported 2× · race-condition*

**Where:** `career-nine-assessment/src/api/http.ts:163-177` (retries ANY request — including registration POSTs, `/user/auth`, `/assessments/startAssessment` — on timeout/network/5xx, 3×, fixed backoff, no jitter; 60s client timeout at `:74`).

**Problem:** A registration POST that times out client-side but completes server-side is retried → duplicate student accounts (compounded by M3's missing unique constraint). Under overload, every failure quadruples traffic in lockstep.

**Easiest fix:** Gate the retry on idempotent methods: `['get','head','options'].includes(method)`; allow per-request opt-in (`config.__retryable = true`) for safe POSTs.

**Recommended fix:** Same, plus jittered backoff and an idempotency key header on registration POSTs that the backend deduplicates on.

## H13. Magic-link students cannot start: `studentDob` from redeem payload is never stored

> **Status: ⬜ OPEN**
*reported 1× · functional-bug*

**Where:** `career-nine-assessment/src/pages/AssessmentStartPage.tsx:41-59` (seeds userStudentId/allottedAssessments/entitlementId... but not `studentDob`), backend deliberately includes it (`StudentSessionService.java:59-68`, `EntitlementController.java:223-225`).

**Problem:** `mintAssessmentSessionCookie` requires `localStorage.studentDob`; without it the mint aborts client-side → email-link students cannot make any authenticated POST.

**Easiest fix (= recommended):** After the purchasePath block (~line 59): `if (data.studentDob) localStorage.setItem('studentDob', String(data.studentDob))` — mirroring `PaymentStatusPage.tsx:183-184`.

## H14. Mint-failure branches "fall back" to an auth path that was deleted

> **Status: ⬜ OPEN**
*reported 1× · logical-bug*

**Where:** `AssessmentContext.tsx:276-319` (all failure branches — no DOB, 404, 403, network/5xx/429 — return false "falling back to the legacy header path"), `http.ts:27-30, 83-87` (that X-Assessment-Session header fallback was removed).

**Problem:** A student whose mint fails proceeds with **no auth carrier at all**; every subsequent call 401s and the student loops on a generic alert with no actionable message (this is also the dead-end that turns C1's 429s into a wall).

**Easiest fix:** Have `mintAssessmentSessionCookie` return/record a typed failure reason; in `AllottedAssessmentPage.handleStartAssessment`, stop on `false` with a specific message per reason (429 → "server busy, retrying in Xs" with auto-retry; 403 → "details don't match, contact your teacher"; network → retry button).

**Recommended fix:** Same, plus automatic re-mint with backoff for transient causes (429/5xx/network) before surfacing an error at all.

## H15. Proctoring frontend grows unboundedly and drains CPU for the whole session

> **Status: ✅ FIXED (2026-06-12)** — `VITE_PROCTORING_ENABLED` master kill-switch (set `false` in .env.production + rebuild + deploy → no camera/WebGazer/MediaPipe/collection/upload); duplicate `eyeGazePoints` array dropped (backend column nullable); gaze traces thinned to 300 points/question (~8-10× payload cut).
*reported 4× (2 high + 2 medium) · scale-bottleneck/ux-blocker*

**Where:** `useFaceTracking.ts:4-6, 109` (gaze 4×/sec into a never-truncated ref; `webgazer.begin()` runs TF face-mesh inference per camera frame — the 250ms throttle only drops listener samples, not the ML work), `usePerQuestionProctoring.ts:81, 140-153, 211-212` (every snapshot stored TWICE per question — `gazePoints` + `eyeGazePoints` — re-merged on revisits), plus `useFaceCounter` opening a **second** camera/ML pipeline.

**Problem:** ~2–4MB JSON per student (feeds C2), the entire map `JSON.stringify`'d to localStorage on **every** question navigation (main-thread jank, silent 5MB quota failures), and continuous double-ML CPU load that makes the question UI sluggish on low-end school machines.

**Easiest fix:** Stop double-storing (`drop gazePoints`, derive `gazeDirection` server-side from `eyeGazePoints`); cap/downsample to ~1 sample/sec beyond ~300 points per question. Two localized FE changes that cut payloads ~8×.

**Recommended fix:** Same, plus: persist per-question keys (write only the just-finalized question, rebuild map on mount); share one camera stream between WebGazer and the face counter; add an `assessmentConfig` flag to disable WebGazer on low-end devices (fall back to the 1Hz face counter).

## H16. Proctoring backend: blocking KEYS + full-payload reads every 5 min, retries run serially on the scheduler thread, multi-MB parses on request threads

> **Status: ◐ PARTIAL (2026-06-12)** — DONE: `self.processAsync` proxy fix (retries now actually async), dedicated bounded proctoring executor, delete-on-success (C2) leaves the retry sweep almost nothing to scan. REMAINING: blocking `KEYS` → SCAN (M25), status/retryCount in a separate small key (M28).
*reported 3× · scale-bottleneck/availability*

**Where:** `ProctoringProcessorService.java:158` (`retryFailedProctoring` → `getAllProctoringEntries` → blocking `KEYS` + per-key GET of full multi-MB payloads just to read 3 status fields — `AssessmentSessionService.java:492-507`), `:191` (`processAsync` called on `this`, bypassing the `@Async` proxy → retries run synchronously inside `@Scheduled` on the **single default scheduler thread**, starving the submission-retry pump and partial flush), `AssessmentProctoringController.java:85` (each save Jackson-parses ~2-4MB on the Tomcat request thread, copies the map, re-serializes to Redis — ~10-30MB transient heap per request × 300 threads at the end-of-assessment rush).

**Easiest fix:** (a) Two-line `@Lazy @Autowired private ProctoringProcessorService self;` + `self.processAsync(...)` at `:191` (the repo's own established pattern); (b) delete proctoring payloads after successful persist (already in C2's easiest fix) so the retry sweep has almost nothing to scan.

**Recommended fix:** Same, plus keep retry metadata (status/retryCount) in a small separate hash key so the sweep never reads payloads; replace `KEYS` with SCAN (M25); cap the request body size on the proctoring endpoint and shrink the payload at the source (H15).

## H17. Dashboard snapshot can compute hundreds of MB on the request thread — heap-kill risk

> **Status: ⬜ OPEN**
*reported 1× · availability*

**Where:** `DashboardSnapshotService.java:32-62` (`getOrComputeJsonBytes` on the HTTP thread; own comment: "this snapshot can be hundreds of MB on a real DB"; loads ALL students/institutes/assessments/reports/mappings; no stampede protection; admin-triggered refresh endpoint).

**Problem:** One admin pressing refresh (or a TTL expiry with several viewers) during the event can OOM the 3g API container — taking all 4000 students down with it.

**Easiest fix:** Single-flight: a per-key `ReentrantLock.tryLock()` around compute+save; losers serve the stale persisted payload immediately.

**Recommended fix:** Same, plus stale-while-revalidate with recompute on a background executor, and operationally: don't touch the admin dashboard's refresh during the event window.

## H18. MySQL mistuned and one shared cnf for prod + staging

> **Status: ✅ FIXED (2026-06-12)** — `max_connections` 200→120, `skip-name-resolve` added; `max_allowed_packet=512M` deliberately KEPT (dashboard snapshot LONGTEXT writes depend on it). Prod-only per decision — staging ignored.
*reported 1× · availability*

**Where:** `mysql-custom.cnf:2-7` (`innodb_buffer_pool_size=1G`, `max_connections=200`, `max_allowed_packet=512M`) mounted into BOTH `mysql_db_api` (2.5g limit) and `mysql_db_staging` (1.5g limit) — `docker-compose.yml:15, 271`.

**Problem:** 1G buffer pool + per-connection buffers × 200 connections + 512M packets doesn't fit the container limits; the staging container with the same cnf is worse. OOM-killed MySQL = total outage (compounds C6).

**Easiest fix:** Stop the staging DB for event day (already in C6); drop `max_allowed_packet` to 128M and `max_connections` to 120 (api pool 50 + worker 50 + headroom) in the prod cnf.

**Recommended fix:** Per-environment cnf files; size buffer pool to ~60% of the container limit; verify with `SHOW GLOBAL STATUS` under a load test before the event.

---

# 🟡 MEDIUM (38 findings → 30 distinct issues)

## M1. Usernames generated as `Math.random()*100000` — collisions break login at 4000 scale

> **Status: ⬜ OPEN**
*reported 2× · race-condition/data-loss*

**Where:** `SchoolRegistrationController.java:752, 967` (`new User((int)(Math.random()*100000), dob)`), same pattern in `AssessmentInstituteMappingController.java:842`, `CampaignPublicController.java:413/426/790/806`, `PaymentWebhookController.java:597/775`. No uniqueness check, no retry, **no DB unique constraint on `student_user.username`**.

**Problem:** Birthday paradox: at 4000 registrations into a 100k space, collisions are near-certain (~55 expected). Two students share a username; login by username+DOB breaks (500 or wrong account) for at least one.

**Easiest fix:** Extract `LeadStudentService.generateUsername`'s existing collision-checked pattern (retry until `findByUsernameAndDobDate` is empty, range 100000–999999) into a shared service and call it from all creation sites.

**Recommended fix:** Same, plus a Flyway migration adding `UNIQUE KEY` on `student_user.username` (dedupe existing rows first) so a race can never persist a duplicate.

## M2. Roll-number generator: read-max-then-+1, `synchronized` only within one JVM

> **Status: ⬜ OPEN**
*reported 1× · race-condition*

**Where:** `CareerNineRollNumberService.java:26`.

**Problem:** The read-compute-write isn't atomic with the subsequent save even single-JVM; duplicate roll numbers at registration-rush scale.

**Easiest fix:** Keep `synchronized` but re-check for the generated number's existence inside the same transaction as the save, retrying on conflict.

**Recommended fix:** Atomic counter table: `INSERT ... ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)` per `(institute_id, section_id)`.

## M3. Duplicate-student check-then-insert race — double registration / double charge

> **Status: ⬜ OPEN**
*reported 1× · race-condition*

**Where:** `SchoolRegistrationController.java:716-730` (`findByEmailAndInstituteId` then create; no unique constraint backing it).

**Problem:** Two concurrent registrations for the same student (double-click + H12's auto-retry) both pass the check and both insert.

**Easiest fix:** H12's retry fix removes the main trigger. Then add the unique index when convenient.

**Recommended fix:** Flyway migration `UNIQUE KEY uq_student_email_institute (email, institute_id)` (dedupe first); catch `DataIntegrityViolationException` in `registerStudent` and route the loser to the existing `handleExistingStudent` path.

## M4. Login verifies DOB against `User.dobDate`, mint verifies against `StudentInfo.studentDob`

> **Status: ⬜ OPEN**
*reported 1× · logical-bug*

**Where:** `UserController.java:124` vs `AssessmentSessionController.java:192`.

**Problem:** Any drift between the two columns lets a student log in and then be 403-blocked from starting (or vice versa) — an undiagnosable dead-end at the venue.

**Easiest fix (= recommended):** In `issueAssessmentSession`, accept the supplied DOB if it matches **either** `StudentInfo.studentDob` **or** `User.dobDate` (the user is already loaded at `:208`). Longer term: single source of truth for DOB.

## M5. `[SESSION-DEBUG]` System.out.println on every request — synchronized I/O bottleneck + PII flood

> **Status: ✅ FIXED (2026-06-12)** — every `[SESSION-DEBUG]`/`[ASSESS-SESSION-DEBUG]` `System.out.println` + `printStackTrace` in `TokenAuthenticationFilter`, `AssessmentSessionController`, `AuthController` removed or converted to `logger.debug` (silent at production INFO).
*reported 6× across dimensions · scale-bottleneck*

**Where:** working-tree `TokenAuthenticationFilter.java:99-114, 129-130, 142-144, 265-266 (printStackTrace), 270-272`; `AssessmentSessionController.java:119-223` (`[ASSESS-SESSION-DEBUG]`, includes rawDob); `AuthController.java:369-449`. No Docker log rotation configured.

**Problem:** `System.out` is a single synchronized PrintStream — every concurrent request serializes on its lock (≈133 heartbeats/sec at the event), and the logs include cookie inventories, IPs, JTIs and DOB values (PII) with unbounded disk growth.

**Easiest fix:** Delete the debug println/printStackTrace lines before the event (or convert to `logger.debug(...)` — the SLF4J logger already exists at `TokenAuthenticationFilter.java:43` — silenced by production INFO level).

**Recommended fix:** Same, plus `logging: { driver: json-file, options: { max-size: "50m", max-file: "3" } }` on every docker-compose service (containers must be recreated to apply).

## M6. `fetchAssessmentData` swallows all errors — students navigate forward with no questionnaire

> **Status: ✅ FIXED (2026-06-12)** — `fetchAssessmentData` returns success boolean; `AllottedAssessmentPage` and `DemographicDetailsPage` block forward navigation with a retry message on failure.
*reported 1× · ux-blocker*

**Where:** `AssessmentContext.tsx:350-358` (catch sets a context `error` string nobody reads), `AllottedAssessmentPage.tsx:73-75` (proceeds regardless).

**Problem:** On a failed questionnaire load (likely under event load), the student is navigated to the instructions page with an empty config and dead-ends with no message and no retry.

**Easiest fix:** Make `fetchAssessmentData` return success/throw; block forward navigation on failure with the existing "Failed to load assessment. Please try again." alert.

**Recommended fix:** Same, plus render the context `error` in `SelectSectionPage` with a Retry button that re-invokes the fetch.

## M7. School registration submit hard-gated on verify round-trip; phone silently mandatory

> **Status: ✅ FIXED (2026-06-12)** — Phone marked required (asterisk + `required` attr) and added to submit-time validation.
*reported 1× · ux-blocker*

**Where:** `SchoolAssessmentRegisterPage.tsx:49-53, 506` (submit disabled unless `verifyStatus === 'verified'`; the debounced verify only fires when email AND phone AND dob are all filled, but Phone is rendered as optional).

**Problem:** Students who skip the "optional" phone can never submit, with no explanation — a registration-desk pileup.

**Easiest fix:** Mark Phone required in the UI (the backend mandates it anyway).

**Recommended fix:** Same, plus make verify advisory: block submit only on `duplicate`/`partial` results (the backend duplicate check at submit time is the backstop), so a slow/failed verify round-trip can't gate registration.

## M8. Answers persist only at section boundaries — reload loses the whole current section; single-section assessments never save at all

> **Status: ◐ PARTIAL (2026-06-12)** — H8's success-checked boundary saves + `pagehide` flush shrink the loss window (incl. single-section assessments, which also get C5's pre-submit snapshot). The debounced mid-section autosave is not implemented.
*reported 1× · data-loss*

**Where:** `SectionQuestionPage.tsx:151, 315-327, 1044-1052`.

**Problem:** Answer state is React-state-only between boundaries. A crash/reload mid-section loses everything since the last section switch; an assessment with one section has **no** partial save before submit.

**Easiest fix:** Add a debounced autosave (30–60s after answer-state changes, reusing the existing snapshot-dedup logic) alongside the boundary saves.

**Recommended fix:** Same + H8's success-checked saves + a `pagehide` keepalive flush.

## M9. In-game Restart button does `window.location.reload()` — wipes in-memory section answers

> **Status: ⬜ OPEN**
*reported 1× · data-loss*

**Where:** `JungleSpotGame.tsx:392, 1009-1028`.

**Easiest fix:** Hide the restart control inside assessments (`allowRestart={false}` from `AssessmentGameWrapper`).

**Recommended fix:** Replace `handleRestart` with an in-component state reset (regenerate trials, reset refs, restart the RAF loop).

## M10. Heartbeat fires on every question navigation, not every 30s — and uses the auto-retrying client

> **Status: ✅ FIXED (2026-06-12)** — position fields move via ref; effect depends only on student/assessment → strict 30s cadence; heartbeat opted out of axios retries (`__noRetry`).
*reported 2× (1 medium + 1 low) · scale-bottleneck*

**Where:** `useHeartbeat.ts:101-108` (deps include `questionIndex`; effect re-runs and `send()`s immediately on every navigation; the "fire-and-forget, no retries" comment is contradicted by the shared retrying client).

**Problem:** Multiplies heartbeat POST volume several-fold during active answering — each one paying H5's auth queries.

**Easiest fix:** Keep position fields in a ref read inside `send()`; depend only on `[userStudentId, assessmentId]` so the cadence is strictly 30s. Mark the request `__noRetry`.

**Recommended fix:** Same; optionally throttle an immediate position-change ping to ≤1 per 5s if fresher positions matter for tracking.

## M11. Per-question min/exact selection rules bypassable via the sidebar navigator

> **Status: ✅ FIXED (2026-06-12)** — `areAllQuestionsAnswered` enforces per-question min/exact via `requiredMinFor()` (same derivation as the Next-button gate).
*reported 1× · logical-bug*

**Where:** `SectionQuestionPage.tsx:655, 1743-1748` (sidebar navigates anywhere; "answered" = ≥1 selection regardless of rules); backend accepts rule-violating sets.

**Easiest fix:** Apply the same `belowMin` check to `areAllQuestionsAnswered()` so rule-violating questions count as unanswered (blocks the submit confirm).

**Recommended fix:** Server-side validation in `submitAssessmentAnswers`: group by question, validate counts against `optionsRule/optionsCount`, reject 400 listing violating question IDs — the client check becomes UX, not enforcement.

## M12. Resumed text answers land in the wrong state bucket — answered questions count as unanswered

> **Status: ⬜ OPEN**
*reported 1× · logical-bug*

**Where:** `SectionQuestionPage.tsx:451` (restore routes optionId entries into the checkbox bucket; `generateSubmissionJSON` had converted matching text answers into optionIds at `:703-708`).

**Easiest fix (= recommended):** Make hydration type-aware: for text-type questions, convert restored optionId entries back into `textAnswers` via the option-text map (the `textIdxC` index already exists).

## M13. 1-second timer tick re-renders the entire 2900-line question page

> **Status: ⬜ OPEN**
*reported 1× · ux-blocker*

**Where:** `SectionQuestionPage.tsx:511` (`setInterval(() => setElapsedTime(p => p + 1), 1000)` at top level).

**Problem:** Combined with H15's ML load, continuous full-page re-render makes low-end school machines crawl.

**Easiest fix:** Move the timer badge + its interval into a small memoized child component.

**Recommended fix:** Same, plus render the already-memoized `QuestionNavigationGrid` for the sidebar so ticks can't cascade.

## M14. Stale per-assessment UI keys: previous assessment's completedGames pre-completes games in the next

> **Status: ⬜ OPEN**
*reported 1× · logical-bug*

**Where:** `AllottedAssessmentPage.tsx:124` (only the dev autofill path clears `assessmentSavedForLater/Skipped/ElapsedTime/CompletedGames`; the real Start flow clears nothing; games keyed by global gameCode).

**Easiest fix (= recommended):** In `handleStartAssessment`, when `localStorage.assessmentId` differs from the assessment being started, clear the per-assessment UI keys (same list the dev path uses).

## M15. Login shows "Invalid credentials" for server errors and can freeze ~3.5 minutes

> **Status: ⬜ OPEN**
*reported 1× · ux-blocker*

**Where:** `StudentLoginPage.tsx:142` (any `error.response` → "Invalid credentials"; the shared client retries 5xx 3× with up to 60s timeout each).

**Problem:** Under overload, students see a frozen "Signing In..." for minutes, then a *wrong* error telling them their DOB is incorrect — they'll re-type credentials and burn C1's rate-limit bucket.

**Easiest fix:** Use the existing `getErrorMessage(error)` helper (bad credentials come back as 200+null, so any `error.response` is a server error); pass a shorter per-request timeout on the login POST.

**Recommended fix:** Same, plus disable auto-retry on the login POST (H12) and show a "server busy — retry" state distinct from credential failure.

## M16. Service worker caches assessment JSON CacheFirst for 30 days — stale questionnaires

> **Status: ⬜ OPEN**
*reported 1× · functional-bug*

**Where:** `career-nine-assessment/vite.config.ts:63` (`CacheFirst`, `maxAgeSeconds` 30 days, for `/assessment-cache/*.{json,webp}`; plus 24h CDN cache).

**Problem:** A device that fetched `data.json/config.json` during a practice run serves that copy on event day — last-minute question fixes never arrive.

**Easiest fix:** Change the JSON handler to `NetworkFirst` (`networkTimeoutSeconds: 3`); bump the `cacheName` (e.g. `assessment-data-v2`) so already-deployed caches are abandoned.

**Recommended fix:** `StaleWhileRevalidate` for JSON, `CacheFirst` only for images, and version the data files by content hash so caching becomes harmless.

## M17. Mid-event deploy force-reloads active students

> **Status: ⬜ OPEN** — Operational: freeze assessment-frontend deploys during the event window.
*reported 1× · availability*

**Where:** `main.tsx:10` + generated SW (`registerType 'autoUpdate'` → skipWaiting + clientsClaim + cleanupOutdatedCaches); the chunk-failure handler auto-reloads into the beforeunload prompt.

**Easiest fix:** **Operational freeze: do not deploy the assessment frontend during the event window.** (Zero code.)

**Recommended fix:** Switch VitePWA to `registerType: 'prompt'` so a new SW waits until tabs close; have `handleChunkError` clear the beforeunload guard via a global flag before `location.reload()`.

## M18. Proctoring data submitted exactly once, fire-and-forget, 10s timeout on a multi-MB upload

> **Status: ◐ PARTIAL (2026-06-12)** — timeout 10s→30s (feature-safe) and the payload is ~8-10× smaller via H15. Retry loop + re-send-on-completed-page not implemented.
*reported 3× (2 medium + 1 low) · data-loss*

**Where:** `proctoringApi.ts:19-20` (`AbortSignal.timeout(10000)`, single attempt), `SectionQuestionPage.tsx:1143-1148` (errors only `console.warn`'d).

**Problem:** Uploading 2–4MB in 10s over congested venue WiFi fails routinely → large-scale silent proctoring data loss (and wasted bandwidth at the worst moment).

**Easiest fix:** Raise the abort to 60–120s and wrap in the same 3-attempt backoff used for answers; keep `proctoring_per_question` in localStorage on failure and re-send on the completed page.

**Recommended fix:** Shrink the payload first (H15), submit incrementally per-section during the assessment, `keepalive` on the final send.

## M19. Failure rows keep their original `firstFailedAt` forever — auto-expire can wipe a same-day submission

> **Status: ⬜ OPEN**
*reported 1× · data-loss*

**Where:** `AssessmentSubmissionProcessorService.java:620-631` (`recordFailure` reuses the row, sets `firstFailedAt` only on create; `resolveFailure` never clears it), 6-hourly `AssessmentFailureExpireService` sweep keys off that stale timestamp.

**Easiest fix (= recommended):** When reusing a previously-resolved row, start a fresh episode: reset `firstFailedAt`/`attemptCount`/`consecutiveNonTransientCount`. Defense in depth: make the expire query also require `resolved = false` recently re-confirmed.

## M20. Two tabs/devices clobber each other's answers (last-write-wins whole-snapshot saves)

> **Status: ⬜ OPEN**
*reported 1× · race-condition*

**Where:** `AssessmentSessionService.java:221-228` (entire answers array stored under one key, no merge/version check; multi-device resume is explicitly supported).

**Easiest fix:** Enforce one active session: have `/save-partial` and `/submit` require the `startAssessment` sessionToken and reject stale tokens (older tab gets a clear "opened elsewhere" message).

**Recommended fix:** Per-question merge server-side (Redis hash keyed by `questionnaireQuestionId`, HSET semantics) so concurrent sessions union instead of clobber.

## M21. Assessment JWT TTL is 4h with no refresh path — logout mid-assessment

> **Status: ⬜ OPEN**
*reported 1× · ux-blocker*

**Where:** `TokenProvider.java:260` (`cn_at_asmnt`, 4h, deliberately excluded from Phase-18 refresh rotation).

**Problem:** Late starts/delays push students past the cliff mid-test; combined with M23 the expiry hard-redirects them out of the assessment.

**Easiest fix:** Bump `assessmentTokenExpirationMsec` (`application.yml:176`) to comfortably exceed the event window (e.g. 12h) for event day.

**Recommended fix:** In `http.ts`, on a 401 from an assessment route attempt ONE silent re-mint (`mintAssessmentSessionCookie` from stored userStudentId/assessmentId/studentDob) and replay the failed request before any redirect.

## M22. Credential emails are fire-and-forget with swallowed errors — silent loss

> **Status: ⬜ OPEN**
*reported 1× · data-loss*

**Where:** `SchoolRegistrationController.java:1087-1112` (try/catch logs only; underlying email services are `@Async` and exceptions die on the async thread).

**Problem:** Students who registered but never received credentials cannot log in on event day, with no record of the failure.

**Easiest fix:** Persist an `email_status` row per registration (sent/failed) so the desk can look up and manually resend; add an admin "resend credentials" endpoint.

**Recommended fix:** Durable outbox with scheduled retry/backoff (or the existing Kafka `report.email` pattern), throttled under the Gmail per-user quota — or move this bulk path to a transactional ESP.

## M23. A single 401/403 on the background heartbeat hard-redirects the student to /permission-denied

> **Status: ⬜ OPEN**
*reported 1× · ux-blocker*

**Where:** `http.ts:186` (global 401/403 → redirect), heartbeat is NOT in the SPA's public-endpoint exemptions; backend requires valid cookie + CSRF for it despite the "anonymous health probe" comment (`HeartbeatController.java:27`).

**Problem:** Any token hiccup (incl. M21's 4h cliff) ejects the student mid-question, destroying in-memory answers (compounded by M8).

**Easiest fix:** Add `/assessments/heartbeat` to `PUBLIC_ENDPOINT_PATTERNS` in `http.ts:110-118` so a failed background heartbeat never redirects (it's already fire-and-forget).

**Recommended fix:** Same + close the underlying 4h cliff (M21).

## M24. Admin UI masks lost heartbeats and never times out "ongoing" — disconnected students invisible

> **Status: ⬜ OPEN**
*reported 1× · logical-bug*

**Where:** `react-social/.../LiveTracking/LiveTrackingPage.tsx:366-378` (expired heartbeat → restore last known position "instead of No signal"; no staleness indicator).

**Problem:** During the event, admins cannot distinguish an active student from one whose laptop died 40 minutes ago — exactly the signal live tracking exists to provide.

**Easiest fix:** Render the `isLive`/`lastSeen` the backend already sends: red "Offline — last seen HH:MM:SS" when `isLive=false`.

**Recommended fix:** Same, plus time-bound the position cache (store `cachedAt`, drop after ~2 min) and a sortable "stale" filter so proctors can work the list.

## M25. Blocking Redis `KEYS` (documented as SCAN) every 3 and 5 minutes against a full 2GB keyspace

> **Status: ⬜ OPEN** — Partially defused: delete-on-success (C2) keeps the proctoring keyspace near-empty, but the `KEYS` calls remain.
*reported 3× (1 medium + 2 low) · scale-bottleneck*

**Where:** `AssessmentSessionService.java:259, 405, 492` (`redisTemplate.keys(prefix + "*")`; javadoc claims SCAN); callers: 3-min flush, 5-min proctoring retry, admin Redis/Pending tabs. Keyspace deliberately inflated by 7-day-retained `submitted:`/`proctoring:` keys.

**Problem:** `KEYS` is O(keyspace) and blocks Redis single-threadedly — stalling every heartbeat/session/answer operation each sweep.

**Easiest fix:** Replace with cursor-based SCAN (`connection.scan(ScanOptions.match(prefix+"*").count(500))`) + `multiGet` for values — making the javadoc true.

**Recommended fix:** Maintain index SETs (`SADD` on save, `SREM` on delete) so sweeps enumerate exact members with no scan at all; delete the dead `getAllSubmittedEntries`.

## M26. Gotenberg + report-worker can claim 6 of 4 vCPUs while report PDFs render mid-event

> **Status: ➖ CLOSED — NOT AN ISSUE** — Moot per Dhruv 2026-06-12: kafka + report-worker are not running in prod. (Re-check if the report pipeline is ever started for the event.)
*reported 1× · scale-bottleneck*

**Where:** `docker-compose.yml:81, 190` (3.0 CPUs each); submission success path enqueues a whitelabel report per completed student (`AssessmentSubmissionProcessorService.java:475-482`).

**Problem:** As students finish, headless-Chromium PDF rendering competes with the API/MySQL for the 4 vCPUs at exactly peak submit time.

**Easiest fix:** `docker stop report-worker` during the live window — Kafka retains the events; the worker catches up afterward with zero loss.

**Recommended fix:** Right-size: gotenberg `cpus: "1.5"`, report-worker `cpus: "1.0"`, `REPORT_PIPELINE_GENERATE_CONCURRENCY=1`.

## M27. Question payload embeds option images as inline base64 LONGBLOBs

> **Status: ⬜ OPEN** — Pre-event check still required: verify the event questionnaire has no base64 option images.
*reported 1× · scale-bottleneck*

**Where:** `AssessmentQuestionOptions.java:100-116` (`@Lob byte[]` → `optionImageBase64` in JSON); the SPA loads the full questionnaire via `GET /assessments/getby/{id}` at start.

**Problem:** 4000 students × a multi-MB question bank through a 4-vCPU box at the synchronized start = a bandwidth/CPU spike exactly at admission time.

**Easiest fix:** Pre-event check: verify the event questionnaire has no LONGBLOB option images (`SELECT ... WHERE option_image IS NOT NULL`); if any, migrate them to DO Spaces URLs via the existing `optionImageUrl` field and null the blobs.

**Recommended fix:** `@JsonIgnore` the base64 getter permanently; serve images only by URL (CDN-cacheable, which the SW already handles well).

## M28. Proctoring `retryCount` incremented on a local copy, never written back — dead-letter never triggers

> **Status: ⬜ OPEN**
*reported 1× · logical-bug*

**Where:** `ProctoringProcessorService.java:74` (catch block mutates a local map; `updateProctoringStatus` re-reads Redis — still retryCount=0 — and writes only the status).

**Problem:** Failed proctoring entries retry forever every 5 minutes (multiplying H16's load); the dead-letter path is unreachable.

**Easiest fix (= recommended):** Single read-modify-write helper `markProctoringFailed(...)`: set `processingStatus="failed"` AND `retryCount+1` in one write, preserving TTL. Better long-term: keep status/retryCount in a separate small hash (see H16).

## M29. `AbortSignal.timeout` throws TypeError on older school browsers — submission permanently fails there

> **Status: ✅ FIXED (2026-06-12)** — shared `src/utils/timeoutSignal.ts` used by both the answer submit (60s) and proctoring upload (30s).
*reported 1× · functional-bug*

**Where:** `SectionQuestionPage.tsx:1129` (answer submit!) and `proctoringApi.ts:19`. Requires Chrome/Edge 103+, FF 100+, Safari 15.4+; not polyfilled by the Vite build.

**Problem:** On an older school machine, the submit call throws synchronously before any network I/O — the student can never submit from that machine.

**Easiest fix (= recommended):** Feature-safe helper at both call sites:
```ts
function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) return AbortSignal.timeout(ms);
  if (typeof AbortController !== 'undefined') { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; }
  return undefined;
}
```

## M30. Per-question proctoring map stringified to localStorage in full on every transition

> **Status: ◐ PARTIAL (2026-06-12)** — every localStorage write shrank ~10× via H15 (duplicate array dropped + 300-point thinning). Per-question key layout not implemented.
*reported 1× · scale-bottleneck — remediation covered under H15 (per-question keys, payload halving)*

---

# 🟢 LOW (16 findings → 10 distinct issues)

## L1. Login-page prefetch always fails (username string into a Long path param) — pure wasted load

> **Status: ⬜ OPEN**
**Where:** `StudentLoginPage.tsx:71-73` vs `AssessmentTableController.java:669-671`.
**Easiest (= recommended):** Remove the call from `handleUserIdBlur`; if cache-warming is wanted, prefetch with the real `userStudentId` right after successful login.

## L2. Allotted-assessments list never refreshed — admin resets invisible until re-login

> **Status: ⬜ OPEN**
**Where:** `AllottedAssessmentPage.tsx:26-35` (hydrates only from localStorage written at login).
**Easiest:** A "Refresh list" button re-fetching the session payload. **Recommended:** Re-fetch on mount + window focus, falling back to cache on network failure. *(Matters on event day: admin resets are the standard remedy for stuck attempts — C4/H11.)*

## L3. `document.cookie` (cn_csrf) logged to the console on every successful mint in production

> **Status: ⬜ OPEN**
**Where:** `AssessmentContext.tsx:291` — violates the repo's own TOK2 hardening note for shared/kiosk devices.
**Easiest:** Delete the `cookies=` portion; wrap debug logs in `if (import.meta.env.DEV)`. **Recommended:** Also add `esbuild: { drop: ['console'] }` to the production build.

## L4. `flushOneStudent`'s `@Transactional` bypassed by self-invocation — delete and re-insert run in two separate transactions

> **Status: ✅ FIXED (2026-06-12)** — `self` proxy in `PartialAnswerFlushService` — scheduled flush's delete + re-insert now run in ONE transaction.
**Where:** `PartialAnswerFlushService.java:55, 157` (plain `this` call bypasses the Spring proxy).
**Problem:** A crash between the delete and the saveAll leaves the student with zero persisted answers until the next sweep.
**Easiest (= recommended):** The repo's own pattern: `@Autowired @Lazy private PartialAnswerFlushService self;` → `self.flushOneStudent(...)`.

## L5. Bulk-submit endpoints catch per-row errors inside one shared transaction — one bad row can roll back the whole upload after reporting success

> **Status: ⬜ OPEN**
**Where:** `AssessmentAnswerController.java:664, 780, 1039, 1222`.
**Easiest (= recommended):** Move the per-student body into a service method with `@Transactional(REQUIRES_NEW)` (pattern already in `PaymentTransactionWriter.java:34`); drop `@Transactional` from the controllers. *(Relevant if OMR/offline uploads run alongside the event.)*

## L6. `processBatch` runs the full 6-phase pipeline for every mapping synchronously in one HTTP request

> **Status: ⬜ OPEN**
**Where:** `GeneralAssessmentController.java:63`.
**Easiest:** Don't invoke it for the live cohort during the event. **Recommended:** Page the batch through the async executor with a job-status endpoint, and add the missing unique constraint on `general_assessment_result (user_student_id, assessment_id)`.

## L7. Heartbeat endpoint trusts body-supplied IDs — any authenticated student can overwrite another's live position

> **Status: ⬜ OPEN**
**Where:** `HeartbeatController.java:30-42` (ownership interceptor checks only path/query params, not the JSON body).
**Easiest (= recommended):** Override body IDs with the request attributes the auth filter already sets (`assessmentUserStudentId`/`assessmentAssessmentId`); 403 on mismatch.

## L8. Uncommitted `application.yml` flips the default profile to `dev`

> **Status: ⬜ OPEN** — `active: dev` is still flipped in the working tree — revert before commit/deploy (docker-compose overrides it, so containerized prod is safe).
*reported 2× · also surfaced (and over-claimed) by 4 refuted findings*
**Where:** `application.yml:27` (`active: dev`); safe in compose deploys only because `docker-compose.yml:93` passes `--spring.profiles.active=production` on the command line.
**Easiest:** Revert line 27 to `production` before committing/deploying.
**Recommended:** Same, plus bake the profile into the image entrypoint and keep developer defaults in an untracked mechanism (`SPRING_PROFILES_ACTIVE=dev` locally).

## L9. log-only authorization mode writes an async `auth_audit` row for every DENY

> **Status: ⬜ OPEN** — Pre-event smoke test still required (auth_audit deny-count = 0 for a student token).
**Where:** `AuthorizationService.java:124-138`; production runs `auth.enforce-mode=log-only` (`application.yml:572-573`).
**Problem:** If any hot student endpoint computes DENY (anonymous or missing permission), every heartbeat/save floods the audit table through the shared 8-thread executor (H1).
**Easiest:** Pre-event smoke test: run one real student token through heartbeat/save-partial/submit and assert `SELECT COUNT(*) FROM auth_audit WHERE ts > <start>` = 0; alert on insert rate during the event. **Recommended:** Sample/rate-limit deny inserts per (user, permission).

## L10. Face counter loads WASM from jsdelivr `@latest` + Google-hosted model at runtime

> **Status: ⬜ OPEN**
**Where:** `useFaceCounter.ts:23-25, 51`.
**Problem:** Filtered school networks silently disable it; an upstream publish on event day changes the code served (unpinned).
**Easiest:** Pin the version in the CDN URL. **Recommended:** Self-host like face_mesh already is: copy `@mediapipe/tasks-vision/wasm/*` + `blaze_face_short_range.tflite` into `public/mediapipe/tasks-vision/` and point `FilesetResolver` there.

---

# ✅ Refuted findings (18) — checked and cleared

Investigated by adversarial verifiers and **not** problems; don't chase them:

1. **"Working tree ships `spring.profiles.active: dev` → prod boots against localhost/staging DB"** *(4 variants)* — compose passes `--spring.profiles.active=production` on the command line, overriding the file. (Residual housekeeping risk tracked as L8.)
2. **"B2C cookie-auth gate is OFF in production so campaign-registered students can never POST"** — refuted; registration responses set the cookie directly.
3. **"Desktop-required / ongoing-assessment modals are dead code trapping phone users"** — refuted.
4. **"Mint failure leaves SPA with no auth carrier, silent 401 loop with no redirect"** *(2 variants)* — the real, narrower issue is tracked as H14.
5. **"No ErrorBoundary → any render exception white-screens students"** — refuted for the event path.
6. **"Hard window.location redirect on 401/403 destroys answers"** — over-claimed as stated; the real, narrower heartbeat case is tracked as M23.
7. **"New multi-candidate token loop still can't rescue the expired-cookie 401 it claims to fix"** — refuted.
8. **"X-Auth-Scope opt-out depends on REACT_APP_API_URL matching"** — refuted as a separate issue (C3 covers the real problem).
9. **"Production session feature flag gates registration handoff → every student 404s"** — refuted.
10. **"verify-details DOB collision returns another student's credentials (PII leak)"** — refuted.
11. **"DOB timezone mismatch between registration and assessment-session"** — refuted (login uses `DATE()` truncation).
12. **"live-tracking-lite INNER JOIN silently drops students with missing linked rows"** — refuted.
13. **"Frontend defaults IDs to 0 → all students share Redis key `proctoring:0:0`"** — refuted.
14. **"`proctoring_per_question` localStorage key contaminates across students/assessments"** — refuted.

---

# Pre-event action plan (priority order)

## Tier 1 — config-only, ~1 hour, low risk, removes the event-stoppers
1. ✅ **C1:** `ip-per-minute: 6000` in the production rate-limit block. *(done 2026-06-12)*
2. ✅ **C3:** Add `X-Auth-Scope` to the CORS allowlist *(done 2026-06-12)*; ⬜ deploy backend with the frontend.
3. ✅ **C2:** Redis → `noeviction` in compose *(done 2026-06-12; recreate the container to apply)*. ➖ **C6:** moot — staging/kafka/report-worker/redisinsight aren't running on the box.
4. ⬜ **L8:** Revert `active: dev` in `application.yml` (still flipped in the working tree).
5. ⬜ **M17 (operational):** freeze frontend deploys during the event. ➖ M26: moot — report-worker not running.

## Tier 2 — small code changes, before the event
6. ⬜ **C4:** Guard `startAssessment` against wiping pending submissions / resume snapshots. **← next up, highest-impact remaining**
7. ✅ **C5 + M29:** Submit flow — 409 as success-pending, feature-safe 60s timeout, truthful error text, pre-submit partial save. *(done 2026-06-12)*
8. ✅ **H1/H2:** Bounded submission executor + startup sweeper + lock re-check. *(done 2026-06-12)*
9. ◐ **H4 + M24:** ✅ Real `answeredCount` from in-memory state *(done 2026-06-12)*; ⬜ M24 (offline/stale students in the admin UI) still open.
10. ◐ **C2 (code half) + M28 + H16:** ✅ delete proctoring payloads after persist; ✅ `self.processAsync` proxy fix *(done 2026-06-12)*; ⬜ M28 (`retryCount` write-back) still open.
11. ✅ **M5:** Strip the `[SESSION-DEBUG]` System.out logging from the auth hot path. *(done 2026-06-12)*
12. ◐ **H13 + H14 + M15 + M6:** ✅ M6 questionnaire-load retry *(done 2026-06-12)*; ⬜ H13 (magic-link DOB seed), H14 (typed mint errors), M15 (truthful login errors) still open.

## Tier 3 — strongly recommended hardening if time allows
13. ✅ **H3 + H5:** Batched live-tracking query + cached principal hydration. *(done 2026-06-12)*
14. ✅ **H6/H7 + L4:** Flush dirty-check, submitted-guard inside the transaction, self-proxy fix. *(done 2026-06-12)*
15. ◐ **H8/H9 + M8:** ✅ H8 success-checked saves + pagehide flush *(done 2026-06-12)*; ⬜ H9 (restore merge guard) and M8's debounced autosave still open.
16. ⬜ **H10 + L10:** Firestore timeout + self-hosted mediapipe (school-firewall resilience). *(Note: H15 kill-switch removes the L10 CDN risk whenever proctoring is off.)*
17. ⬜ **H12 + M1 + M3:** Idempotent-only retries; collision-checked usernames + unique constraints.
18. ⬜ **M16 + M21 + M23:** SW NetworkFirst for JSON; longer assessment-token TTL; heartbeat exempt from auth-redirect.

## Tier 4 — verify before event day (no code)
- Load-test the login → mint → heartbeat → save-partial → submit path at a few hundred concurrent users on staging-like config.
- Run the L9 auth-audit smoke test (deny-count must be 0 for a real student token).
- Confirm the event questionnaire has no base64 option images (M27).
- Confirm school networks can reach the app domain AND (or gracefully without) `*.googleapis.com` / CDNs (H10, L10).
- Dry-run an admin reset of a stuck student (L2, C4) so the desk procedure is known.

---

# Severity summary

| Severity | Workflow findings | Distinct issues | Status (2026-06-12) |
|---|---|---|---|
| 🔴 Critical | 14 | 6 (C1–C6) | 4 fixed · 1 non-issue · **1 open (C4)** |
| 🟠 High | 38 | 18 (H1–H18) | 11 fixed · 1 partial · 6 open |
| 🟡 Medium | 38 | 30 (M1–M30) | 6 fixed · 3 partial · 1 non-issue · 20 open |
| 🟢 Low | 16 | 10 (L1–L10) | 1 fixed · 9 open |
| **Total confirmed** | **106** | **64** | **22 fixed · 4 partial · 2 non-issue · 36 open** |
| Refuted / cleared | 18 | — | — |

**Traceability:** duplicate reports are folded into their section ("reported N×"): C1 ←4 crit +1 high · C2 ←3 crit · C3 ←2 crit +2 high · C4/C5 ←2 crit each · H3 ←4 high · H4/H1/H5/H16/H15 ←3–4 each · H6 ←2 high +1 med · M5 ←6 med · M25 ←1 med +2 low · M18 ←2 med +1 low · M10 ←1 med +1 low · L8 ←2 low · M30→H15 · all remaining findings map 1:1.

*Full per-finding detail with code excerpts and verifier reasoning is in the workflow run output (`wf_f038610e-73e`).*
