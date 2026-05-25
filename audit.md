# career-nine-assessment audit

End-to-end audit of the student-facing **career-nine-assessment** SPA — its user flow, every backend endpoint it calls, and the auth/permission model that fronts each endpoint. Verified against the current code in `/home/babayaga/Projects/career-nine-sandbox/` (not from memory).

---

## 1. App location & stack

- **Path:** `/home/babayaga/Projects/career-nine-sandbox/career-nine-assessment/`
- **Framework / build tool:** React 19 + TypeScript + Vite 7 (`career-nine-assessment/package.json`, `career-nine-assessment/vite.config.ts`)
- **Other notable deps:** `react-router-dom` 6, `axios` 1.13, `firebase` 12, `react-toastify`, `html2canvas`, `jspdf`, `webgazer` + `@mediapipe/tasks-vision` (proctoring), `vite-plugin-pwa` (workbox SW), `vite-plugin-compression2`.
- **Build outputs:** `dist/` with PWA + asset cache pre-warmed via `scripts/cache-assessment.sh`; build script invokes `cache-assessment.sh`, `tsc -b`, `vite build`, then `scripts/generate-manifest.cjs`.
- **API base URL:** `import.meta.env.VITE_API_URL` (env-files: `.env.development`, `.env.staging`, `.env.production`).
- **Auth model (dual mode):**
  - **Phase 19 cookie path (preferred):** HttpOnly `cn_at_asmnt` JWT (4 h TTL, claims `sub=userStudentId`, `aid=assessmentId`, `scope=assessment`, `jti=<uuid>`) minted by `POST /auth/assessment-session`. Activated when the build flag `VITE_ASSESSMENT_COOKIE_AUTH=true` AND the per-institute server flag `InstituteDetail.assessmentCookieAuthEnabled=true` (or the global `app.auth.assessmentCookieAuthB2C` for B2C students). Axios is configured with `withCredentials: true` (`career-nine-assessment/src/api/http.ts:48-63`). Critical writes (`save-partial`, `submit`, `assessment-proctoring/save`, `feedback-rating`) use raw `fetch` with `credentials: 'include'` to ensure the cookie attaches.
  - **Legacy v2.0 header fallback:** request interceptor injects `X-Assessment-Session` / `X-Assessment-Student-Id` / `X-Assessment-Id` from local/sessionStorage when `cookieAuthRuntimeActive=false` (`http.ts:76-97`). The runtime flag flips false on 404 (per-institute disabled), 403 (enrolment mismatch), or 5xx during the mint, and stays false for the tab lifetime.
  - **CSRF double-submit:** every state-changing call mirrors the JS-readable `cn_csrf` cookie into the `X-CSRF-Token` header (`http.ts:77-85`; same logic copied into the raw-fetch helpers).
- **Entry routes:** `BrowserRouter` mounted in `career-nine-assessment/src/App.tsx:34-72`. Root `/` redirects to `/student-login`. Public-by-design entry points include `/student-login`, `/assessment-register/:token` (B2B school mapping), `/c/:slug[/...]` (B2C campaign), `/assessment/start?t=&e=` (welcome-email magic link), `/payment-status`, and `/permission-denied`.

The HTTP client also implements a **/permission-denied** redirect interceptor: on `403` (or `401` while cookie auth is active) it navigates to `/permission-denied?from=<path>`, EXCEPT when the failing URL matches the public allowlist regex (`/campaign/public/`, `/promo-code/`, `/entitlement/redeem-token`, `/payment/webhook/(status|info)/`, `/auth/(login|logout|refresh|assessment-session)`, `/public/`). Retry policy: up to 3 attempts with exponential backoff on network errors and 5xx (`http.ts:145-183`).

---

## 2. End-to-end user flow

The student journey has one realistic golden path and three alternate entries (magic link, B2B school mapping, B2C campaign). Each step lists the user-visible action, the React route/component, and the API calls that fire (in order).

### 2.1 Golden path — username/DOB login

1. **Open app** → `/` redirects to `/student-login` (`App.tsx:40`).
2. **Login screen** (`pages/StudentLoginPage.tsx`).
   - User types Username + DOB (3 dropdowns); on Username blur the SPA fires a lazy `prefetchAssessmentData` (`StudentLoginPage.tsx:62-68` → `AssessmentContext.tsx:172-200`).
   - Prefetch call: `GET /assessments/prefetch/{userStudentId}` (`AssessmentContext.tsx:176`) and, if it returns an active assessment, also `GET /assessments/getby/{id}` + `GET /assessments/getById/{id}` (`AssessmentContext.tsx:70-71`) to warm sessionStorage.
   - On Submit: `POST /user/auth` with `{ username, dobDate }` (`StudentLoginPage.tsx:119`). Response stored in `localStorage` as `userStudentId`, `allottedAssessments`, `studentDob`. Navigate to `/allotted-assessment`.
3. **Allotted assessment list** (`pages/AllottedAssessmentPage.tsx`).
   - Renders cards from `localStorage.allottedAssessments`.
   - On "Start"/"Continue":
     1. `mintAssessmentSessionCookie(userStudentId, assessmentId)` → `POST /auth/assessment-session` with `{ userStudentId, assessmentId, dob }` (`AssessmentContext.tsx:280`). Sets `cn_at_asmnt` + `cn_csrf` cookies.
     2. `fetchAssessmentData(assessmentId)` — 3-tier load: Cache API → `/assessment-cache/{id}/data.json` + `config.json` static files → `GET /assessments/getby/{id}` + `GET /assessments/getById/{id}` (`AssessmentContext.tsx:59-74`).
     3. `GET /student-demographics/fields/{assessmentId}/{userStudentId}` to probe for dynamic demographic fields (`AllottedAssessmentPage.tsx:74`).
     4. If no demographics needed AND `config.collectEmailAndPhone === false`: `POST /assessments/startAssessment` (`AllottedAssessmentPage.tsx:86`) then navigate to `/general-instructions`. Otherwise navigate to `/demographics/{assessmentId}` with the fields payload in router state.
4. **Demographics** (`pages/DemographicDetailsPage.tsx`, when needed).
   - On mount: optional `GET /student-demographics/contact-info/{userStudentId}` (`DemographicDetailsPage.tsx:82`) if email/phone collection is on; reuses pre-fetched fields or `GET /student-demographics/fields/{assessmentId}/{userStudentId}` (`DemographicDetailsPage.tsx:122`).
   - On Submit:
     1. `POST /student-demographics/contact-info/{userStudentId}` with `{ email, phoneNumber }` (`DemographicDetailsPage.tsx:246`).
     2. `POST /student-demographics/submit` with `{ userStudentId, assessmentId, responses[] }` (`DemographicDetailsPage.tsx:277`).
     3. `POST /assessments/startAssessment` + `fetchAssessmentData` in parallel (`DemographicDetailsPage.tsx:285-289`).
   - Navigate to `/general-instructions`.
5. **General instructions** (`pages/GeneralInstructionsPage.tsx`) — static markdown view, no API calls beyond the heartbeat the next route mounts.
6. **Section picker** (`pages/SelectSectionPage.tsx`, lazy-loaded).
   - Sections are derived from `assessmentData` in context (already cached).
   - `useHeartbeat` mounts → `POST /assessments/heartbeat` every 30 s with `{ userStudentId, assessmentId, page, answeredCount, sectionName? }` (`hooks/useHeartbeat.ts:80-108`).
   - Status check: `GET /assessments/{assessmentId}/student/{userStudentId}` (`SelectSectionPage.tsx:66`). If `studentStatus === "completed"`, redirect to `/studentAssessment/completed`. If `"ongoing"`, call `restorePartialAnswers(...)` → `GET /assessment-answer/partial-restore/{studentId}/{assessmentId}` (`api/assessmentApi.ts:39-59`) and auto-route to the next-unanswered section.
7. **Section instructions** (`pages/SectionInstructionPage.tsx`, lazy) — heartbeat continues.
8. **Question screens** (`pages/SectionQuestionPage.tsx`, lazy).
   - On every section transition (or auto-save tick), `savePartialAnswers(...)` → `POST /assessment-answer/save-partial` via raw fetch with `credentials: 'include'` (`api/assessmentApi.ts:13-28`). Fire-and-forget.
   - Live proctoring data (face tracking, click tracking) is accumulated in refs (`hooks/useFaceTracking.ts`, `usePerQuestionProctoring.ts`).
   - On final submit (`SectionQuestionPage.tsx:1077-1147`): raw fetch `POST /assessment-answer/submit` with `credentials: 'include'`, 10 s `AbortSignal.timeout`, up to 3 retries. On success it fires-and-forgets `submitProctoringData(payload)` → `POST /assessment-proctoring/save` (`api/proctoringApi.ts:5-21`) then navigates to `/studentAssessment/completed`.
9. **Thank you / rating** (`pages/ThankYouPage.tsx`).
   - Optional: `PUT /assessment-answer/feedback-rating` via raw fetch + cookie (`ThankYouPage.tsx:202-228`).
   - Optional: `getUpgradeInfo(entitlementId)` → `GET /campaign/public/upgrade-info/{entitlementId}` if a B2C upgrade is offered (`api-clients/campaignAPI.ts:51-53`).
   - Optional: `prepareReport(entitlementId, accessToken, assessmentId)` → `POST /bet-report-data/public/prepare?e=&t=&assessmentId=` to pre-warm the detailed PDF (`api-clients/campaignAPI.ts:84-92`).

### 2.2 Alternate entry — welcome-email magic link

- URL: `/assessment/start?t=<accessToken>&e=<entitlementId>` (route declared in `App.tsx:50`).
- `pages/AssessmentStartPage.tsx:38` calls `redeemAssessmentStartToken(token, entitlementId)` → `POST /entitlement/redeem-token`.
- Backend validates the unguessable token, **issues `cn_at_asmnt` itself** in the same response (`EntitlementController.java:189-198`), and returns the session payload (userStudentId, assessments, campaignSlug). SPA stamps localStorage and navigates to `/allotted-assessment`, joining the golden path at step 3.

### 2.3 Alternate entry — B2B school mapping

- URL: `/assessment-register/:token` (route in `App.tsx:49`; page `pages/AssessmentRegisterPage.tsx`).
- `getMappingInfoByToken(token)` → `GET /assessment-mapping/public/info/{token}` (`api-clients/assessmentMappingAPI.ts:3-5`).
- On submit: `registerStudentByToken(token, studentData)` → `POST /assessment-mapping/public/register/{token}` (`assessmentMappingAPI.ts:7-20`). Backend provisions the student and either auto-logs them in (cookie issuance) or redirects to `/student-login`.

### 2.4 Alternate entry — B2C campaign

- URL: `/c/:slug[/:assessmentId[/:tierId]]` (`App.tsx:52-55`; page `pages/CampaignRegisterPage.tsx`).
- Discovery: `getCampaignInfoBySlug` / `getCampaignInfoByAssessment` / `getCampaignInfoByTier` → `GET /campaign/public/info/{slug}[/{assessmentId}[/{tierMappingId}]]`.
- Optional promo lookup: `validatePromoCode` → `POST /promo-codes/public/validate`.
- Trial path: `registerTrial` → `POST /campaign/public/register-trial/{slug}/{assessmentId}`.
- Paid path: `registerForCampaignTier` → `POST /campaign/public/register/{slug}/{assessmentId}/{tierMappingId}` returning a Razorpay payment link; SPA redirects out and back to `/payment-status?linkId=...`.
- `/payment-status` polls `GET /payment/webhook/status/{linkId}` (`pages/PaymentStatusPage.tsx:137-209`); first call appends `?reconcile=1` to force a Razorpay reconcile. On `status=paid`, backend includes the session payload + mints `cn_at_asmnt`; SPA navigates to `/allotted-assessment` or `/studentAssessment/completed`.
- "Try first, upgrade later" path: `/c/:slug/:assessmentId/upgrade/:entitlementId` (`PayForReportPage.tsx`) calls `payForReport(...)` → `POST /campaign/public/pay-for-report` which returns a Razorpay link; flow rejoins via `/payment-status`.

---

## 3. Endpoint reference

All endpoints below are called by the assessment SPA. The `@auth.allows(...)` strings come straight from the controllers; the `permitAll` column reflects `SecurityConfig.PUBLIC_PATHS` (`spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java:106-143`). `ABAC scope` describes the resolved scope argument passed to `AuthorizationService.allows(...)`.

### 3.1 Auth / session

| Method + path | Frontend caller | Controller handler | Purpose | Request shape | Response shape | Side effects | Auth requirement | Permission code | ABAC scope | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `POST /user/auth` | `pages/StudentLoginPage.tsx:119` | `UserController.checkUser` — `spring-social/src/main/java/com/kccitm/api/controller/UserController.java:122-136` | Username + DOB login that returns the student's session payload (userStudentId, allotted assessments). | Body: `{ username, dobDate }` | `{ userStudentId, assessments[], ... }` (from `studentSessionService.buildSessionPayload`) | None on success (read-only lookup); returns null on credential mismatch | **permitAll** (SecurityConfig PUBLIC_PATHS line 118) | — (no `@PreAuthorize`) | — | Comment in source says "anonymous-by-design, mirrors /auth/login". |
| `POST /auth/assessment-session` | `contexts/AssessmentContext.tsx:280` (via `mintAssessmentSessionCookie`) | `AssessmentSessionController.issueAssessmentSession` — `spring-social/src/main/java/com/kccitm/api/controller/AssessmentSessionController.java:112-202` | Mints the 4 h `cn_at_asmnt` HttpOnly cookie (+ a `cn_csrf` cookie) for the assessment-scoped flow. Phase-19 entry point. | Body: `{ userStudentId, assessmentId, dob (dd-MM-yyyy) }` | `{ ok: true }` or 403/404/400 with reason string | Issues `cn_at_asmnt` + `cn_csrf` cookies via `AuthCookieService`. Performs enrolment check (StudentAssessmentMapping lookup), DOB identity check (when on file), per-institute feature-flag check. | **permitAll** (PUBLIC_PATHS line 121, "SPA's first call; no prior cn_csrf") | — (no `@PreAuthorize`) | Enrolment + per-institute flag check act as the gate (no permission string). | Returns 404 when `InstituteDetail.assessmentCookieAuthEnabled` is FALSE/NULL (B2B) or `app.auth.assessmentCookieAuthB2C=false` (B2C); SPA falls back to legacy header path. |
| `POST /entitlement/redeem-token` | `api-clients/campaignAPI.ts:62` (via `pages/AssessmentStartPage.tsx`) | `EntitlementController.redeemToken` — `spring-social/src/main/java/com/kccitm/api/controller/career9/b2c/EntitlementController.java:180-225` | Redeems a welcome-email magic link, mints `cn_at_asmnt`, returns the session payload. | Body: `{ token, entitlementId }` | `{ entitlementId, userStudentId, assessmentId, campaignId, status, purchasePath, ..., assessments[], campaignSlug }` | Marks the entitlement's access token as redeemed; issues `cn_at_asmnt` cookie. | **permitAll** (PUBLIC_PATHS line 128) | — (annotation removed; comment "@PreAuthorize removed so the enforce flip won't 403 the anonymous redeem"). | — | Token validation is the gate (`EntitlementService.redeemAccessToken`, 30-byte SecureRandom). |

### 3.2 Assessment lifecycle (read + start + status)

| Method + path | Frontend caller | Controller handler | Purpose | Request shape | Response shape | Side effects | Auth requirement | Permission code | ABAC scope | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `GET /assessments/prefetch/{userStudentId}` | `contexts/AssessmentContext.tsx:176` | `AssessmentTableController.prefetchAssessmentData` — `spring-social/.../AssessmentTableController.java:664-714` | Lightweight per-student list of assessments (id, status, isActive, isLocked, questionnaireType) used to warm the SPA before login completes. | Path: `userStudentId` | `[{ assessmentId, status, assessmentName, isActive, showTimer, isLocked, questionnaireType, questionnaireId }, ...]` | Read-only; cached in Spring `assessmentDetails` cache with key `'prefetch-' + #userStudentId`. | Authenticated (NOT in PUBLIC_PATHS) | `@auth.allows('assessment.prefetch')` | None (no scope arg) — relies on Hibernate scope filter + the STUDENT role's own assessments. | Comment flags this as "PUBLIC?" pending Plan 15-06 EXCLUSIONS review. STUDENT role has `assessment.prefetch` per `V20260522001__seed_student_role_group.sql`. |
| `GET /assessments/getby/{id}` | `contexts/AssessmentContext.tsx:70` | `AssessmentTableController.getQuestionnaireById` — `AssessmentTableController.java:271-296` | Full questionnaire (sections + questions + options) for an assessment id. Serves from a cached snapshot when the assessment is locked. | Path: `id` (assessmentId) | List of questionnaire rows (sections → questions → options) | Read-only; Caffeine-cached (`questionnaireQuestions`). | Authenticated | `@auth.allows('assessment.read')` | None passed; STUDENT role bundle grants `assessment.read`. | Returns `[]` if no questionnaire wired. |
| `GET /assessments/getById/{id}` | `contexts/AssessmentContext.tsx:71` | `AssessmentTableController.getAssessmentDetailsById` — `AssessmentTableController.java:303-326` | Assessment config (timer, instructions, isActive, collectEmailAndPhone, etc.). | Path: `id` | `AssessmentTable` entity (or cached config) | Read-only; cached. | Authenticated | `@auth.allows('assessment.read')` | None | — |
| `GET /assessments/{assessmentId}/student/{userStudentId}` | `pages/SelectSectionPage.tsx:66` | `AssessmentTableController.getAssessmentStatusForStudent` — `AssessmentTableController.java:195-217` | Returns `{ isActive, studentStatus }` (ongoing / completed / null). Used for resume routing. | Path: `assessmentId`, `userStudentId` | `{ isActive: boolean, studentStatus: "ongoing"\|"completed"\|null }` | Read-only | Authenticated | `@auth.allows('assessment.read')` | None passed (note: no `instituteOfStudent(...)` like the answer endpoints use). | See §5 — ABAC scope is "soft" here; relies on permission alone. |
| `POST /assessments/startAssessment` | `pages/AllottedAssessmentPage.tsx:86`, `pages/DemographicDetailsPage.tsx:285` | `AssessmentTableController.startAssessment` — `AssessmentTableController.java:596-654` | Marks the StudentAssessmentMapping `ongoing`, creates a fresh Redis-backed AssessmentSession, clears stale Redis state. Idempotent. | Body: `{ userStudentId, assessmentId }` | `{ sessionToken, success: true, status: "ongoing" }` (409 if already completed) | Writes to `student_assessment_mapping`; creates Redis session; wipes any previous `partial:` / `submitted:` Redis keys for the pair. | Authenticated | `@auth.allows('assessment.start')` | None | STUDENT role bundle includes `assessment.start`. |
| `POST /assessments/heartbeat` | `hooks/useHeartbeat.ts:98` | `HeartbeatController.heartbeat` — `spring-social/.../HeartbeatController.java:29-45` | Live-tracking ping (30 s). Stores page + sectionId + questionIndex + answeredCount in Redis (60 s TTL). | Body: `{ userStudentId, assessmentId, page, answeredCount, sectionName?, sectionId?, questionIndex? }` | 200 empty / 400 if ids missing | Redis write only (no DB). | Authenticated | `@auth.allows('heartbeat.ping')` | None | STUDENT role bundle includes `heartbeat.ping`. Fire-and-forget on the client. |

### 3.3 Demographics

| Method + path | Frontend caller | Controller handler | Purpose | Request shape | Response shape | Side effects | Auth requirement | Permission code | ABAC scope | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `GET /student-demographics/fields/{assessmentId}/{userStudentId}` | `pages/AllottedAssessmentPage.tsx:74`, `pages/DemographicDetailsPage.tsx:122` | `StudentDemographicResponseController.getFieldsForAssessment` — `spring-social/.../StudentDemographicResponseController.java:133-205` | Returns the configured demographic field set for the assessment, with the student's existing values pre-filled. | Path: `assessmentId`, `userStudentId` | `DemographicField[]` (id, label, dataType, validation, isMandatory, options, currentValue, ...) | Read-only | Authenticated | `@auth.allows('student_demographic_response.read')` | None passed; comment "identifies by ids; scope-filter narrows access". | — |
| `GET /student-demographics/contact-info/{userStudentId}` | `pages/DemographicDetailsPage.tsx:82` | `StudentDemographicResponseController.getContactInfo` — `StudentDemographicResponseController.java:77-89` | Returns the student's stored `email` + `phoneNumber`. | Path: `userStudentId` | `{ email, phoneNumber }` | Read-only | Authenticated | `@auth.allows('student_demographic_response.read')` | None | — |
| `POST /student-demographics/contact-info/{userStudentId}` | `pages/DemographicDetailsPage.tsx:246` | `StudentDemographicResponseController.updateContactInfo` — `StudentDemographicResponseController.java:93-129` | Updates `StudentInfo.email` + `phoneNumber` after server-side regex validation. | Body: `{ email, phoneNumber }` | `{ success: true }` or 400 with `validationErrors[]` | DB write on `student_info`. | Authenticated | `@auth.allows('student_demographic_response.update')` | None | `@Transactional`. |
| `POST /student-demographics/submit` | `pages/DemographicDetailsPage.tsx:277` | `StudentDemographicResponseController.submit` — `StudentDemographicResponseController.java:209-...` | Submits demographic responses; validates mandatory + regex; upserts CUSTOM responses, writes SYSTEM fields into `StudentInfo`. | Body: `{ userStudentId, assessmentId, responses: [{ fieldId, value }] }` | `{ success: true }` or 400 with `validationErrors[]` | DB writes on `student_demographic_response` + `student_info` (for SYSTEM-source fields). | Authenticated | `@auth.allows('student_demographic_response.create')` | None | `@Transactional`. |

### 3.4 Answers / scoring

| Method + path | Frontend caller | Controller handler | Purpose | Request shape | Response shape | Side effects | Auth requirement | Permission code | ABAC scope | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `POST /assessment-answer/save-partial` | `api/assessmentApi.ts:22` (raw fetch + `credentials: 'include'`) | `AssessmentAnswerController.savePartialAnswers` — `spring-social/.../AssessmentAnswerController.java:1788-...` | Best-effort Redis snapshot of in-progress answers on every section transition. | Body: arbitrary `{ userStudentId, assessmentId, answers: [...] }` | 200 ack | Redis write only (`career9:partial:{sid}:{aid}`). | Authenticated | `@auth.allows('assessment_answer.update')` | None | Comment on line 1789 flags it as "PUBLIC?: assessment app partial save — flagged for 15-06 EXCLUSIONS review". STUDENT role bundle includes `assessment_answer.update`. |
| `GET /assessment-answer/partial-restore/{studentId}/{assessmentId}` | `api/assessmentApi.ts:44` (raw fetch) | `AssessmentAnswerController.restorePartialAnswers` — `AssessmentAnswerController.java:534-543` | Returns the most recent Redis partial-answer snapshot, or 404 if none. | Path: `studentId`, `assessmentId` | `{ answers: [...], savedAt? }` or 404 `{ status: "no_partial" }` | Read-only | Authenticated | `@auth.allows('assessment_answer.read', @auth.instituteOfStudent(#studentId))` | Institute (resolved via `AuthorizationService.instituteOfStudent` — `AuthorizationService.java:78-85`). | Phase 19 correction — previously passed `#studentId` into the institute dim (memory id 1144). |
| `POST /assessment-answer/submit` | `pages/SectionQuestionPage.tsx:1088` (raw fetch + `credentials: 'include'`, 10 s timeout, ≤3 retries) | `AssessmentAnswerController.submitAssessmentAnswers` — `AssessmentAnswerController.java:245-421` | Final submit. Saves submission to Redis, kicks off async processor, returns `{ status: "accepted" }`. Idempotent via 90 s in-flight lock; refuses re-processing of already-`completed` mappings. | Body: `{ userStudentId, assessmentId, answers: [...], ... }` | `{ status: "accepted", answersReceived }` or cached `{ ... }` or 409 duplicate | Redis writes (`submitted:`, lock); flips `student_assessment_mapping.persistenceState='pending'`; async processor later writes `assessment_answer` + `assessment_raw_score` rows and flips status to `completed`. | Authenticated | `@auth.allows('assessment_answer.submit')` | None passed via SpEL. | Extra defense-in-depth check at lines 266-289: if `cn_at_asmnt` is attached, its `(sub, aid)` claims MUST match the body — otherwise 401/403. STUDENT role bundle includes `assessment_answer.submit`. |
| `PUT /assessment-answer/feedback-rating` | `pages/ThankYouPage.tsx:202` (raw fetch + `credentials: 'include'`) | `AssessmentAnswerController.saveFeedbackRating` — `AssessmentAnswerController.java:491-521` | Stores 1-5 star rating on the StudentAssessmentMapping. | Body: `{ userStudentId, assessmentId, rating }` | `{ status: "saved", rating }` | Writes `student_assessment_mapping.feedback_rating`. | Authenticated | `@auth.allows('assessment_answer.update')` | None | — |

### 3.5 Proctoring

| Method + path | Frontend caller | Controller handler | Purpose | Request shape | Response shape | Side effects | Auth requirement | Permission code | ABAC scope | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `POST /assessment-proctoring/save` | `api/proctoringApi.ts:14` (raw fetch + `credentials: 'include'`, 10 s timeout) | `AssessmentProctoringController.saveProctoringData` — `spring-social/.../AssessmentProctoringController.java:71-89` | Persists per-question proctoring telemetry (face tracks, click counts, timestamps). | Body: `{ userStudentId, assessmentId, perQuestionData: [...] }` | `{ status: "accepted" }` | Redis write + async processor (`ProctoringProcessorService.processAsync`) that writes `assessment_proctoring_question_log` rows. | Authenticated | `@auth.allows('assessment_proctoring.create')` | None | STUDENT role bundle includes `assessment_proctoring.create`. Fire-and-forget post-submit. |

### 3.6 B2B school-mapping public funnel

| Method + path | Frontend caller | Controller handler | Purpose | Request shape | Response shape | Side effects | Auth requirement | Permission code | ABAC scope | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `GET /assessment-mapping/public/info/{token}` | `api-clients/assessmentMappingAPI.ts:4` | `AssessmentInstituteMappingController.getMappingInfoByToken` — `spring-social/.../AssessmentInstituteMappingController.java:191-...` | Returns info about a school-mapping registration token (assessment name, institute, etc.). | Path: `token` (string) | Mapping info DTO | Read-only | **permitAll** (PUBLIC_PATHS line 134, `/assessment-mapping/public/**`) | — (annotation absent; "@PreAuthorize-Exempt" comment) | — | Token validity is the gate. |
| `POST /assessment-mapping/public/register/{token}` | `api-clients/assessmentMappingAPI.ts:19` (from `pages/AssessmentRegisterPage.tsx`) | `AssessmentInstituteMappingController.registerStudentByToken` — `AssessmentInstituteMappingController.java:258-...` | Self-registers a student under a school mapping token; provisions UserStudent + enrolment + emits welcome. | Body: `{ name, email, dob, phone, gender, classId?, schoolSectionId? }` | Auto-login session payload (same shape as `/user/auth`) | Inserts `user`, `student_info`, `user_student`, `student_assessment_mapping`; sends welcome email. | **permitAll** | — | Token + body validation in-handler. |

### 3.7 B2C campaign + payment + report-prep public funnel

| Method + path | Frontend caller | Controller handler | Purpose | Request shape | Response shape | Side effects | Auth requirement | Permission code | ABAC scope | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `GET /campaign/public/info/{slug}` | `api-clients/campaignAPI.ts:4` | `CampaignPublicController` `@GetMapping("/info/{slug}")` — `spring-social/.../b2c/CampaignPublicController.java:93` | Public campaign landing data. | Path: `slug` | Campaign DTO | Read-only | **permitAll** (PUBLIC_PATHS `/campaign/public/**`) | — | — | — |
| `GET /campaign/public/info/{slug}/{assessmentId}` | `api-clients/campaignAPI.ts:8` | `CampaignPublicController` line 100 | Campaign + selected assessment. | Path: `slug`, `assessmentId` | Campaign+assessment DTO | Read-only | **permitAll** | — | — | — |
| `GET /campaign/public/info/{slug}/{assessmentId}/{tierMappingId}` | `api-clients/campaignAPI.ts:12` | `CampaignPublicController` line 108 | Tier-resolved pricing/details. | Path | Tier DTO | Read-only | **permitAll** | — | — | — |
| `POST /campaign/public/register/{slug}/{assessmentId}/{tierMappingId}` | `api-clients/campaignAPI.ts:28` | `CampaignPublicController` line 216 | Paid B2C registration. Returns Razorpay payment-link URL + transactionId. | Body: `{ name, email, dob, phone?, gender?, promoCode? }` | `{ paymentLinkUrl, transactionId, ... }` | Creates `student_entitlement` (provisional) + Razorpay link; DOB-gated dedup check. | **permitAll** | — | — | DOB used to disambiguate duplicate emails. |
| `POST /campaign/public/register-trial/{slug}/{assessmentId}` | `api-clients/campaignAPI.ts:45` | `CampaignPublicController` line 343 | Free-trial B2C registration. | Body: `{ name, email, dob, phone, gender? }` | Session payload (auto-login) | Creates trial entitlement; sends welcome email; issues cn_at_asmnt. | **permitAll** | — | — | — |
| `GET /campaign/public/upgrade-info/{entitlementId}` | `api-clients/campaignAPI.ts:52` (from `ThankYouPage.tsx`) | `CampaignPublicController` line 475 | Surfaces upgrade campaign + assessment + tier for the entitlement so SPA can render the upsell. | Path: `entitlementId` | Upgrade DTO | Read-only | **permitAll** | — | — | — |
| `POST /campaign/public/pay-for-report` | `api-clients/campaignAPI.ts:70` (from `PayForReportPage.tsx`) | `CampaignPublicController` line 567 | Creates a Razorpay payment link for the "try-then-upgrade" detailed-report unlock. | Body: `{ entitlementId, campaignAssessmentTierId, promoCode? }` | `{ paymentLinkUrl, transactionId, ... }` | Razorpay link creation; entitlement upgrade flagged. | **permitAll** | — | — | — |
| `POST /promo-codes/public/validate` | `api-clients/promoCodeAPI.ts:6` | `PromoCodeController.validatePublic` — `spring-social/.../PromoCodeController.java:154-...` | Validates a promo code before checkout; returns discount + applicability. | Body: `{ code, campaignId? }` | Promo-validation DTO | Read-only (lookup). | **permitAll** (PUBLIC_PATHS line 131) | — | — | — |
| `GET /payment/webhook/status/{razorpayLinkId}` | `pages/PaymentStatusPage.tsx:142-143` | `PaymentWebhookController.getPaymentStatus` — `spring-social/.../PaymentWebhookController.java:167-246` | Reads payment status + (optionally with `?reconcile=1`) forces a Razorpay state sync. Returns auto-login session payload + sets `cn_at_asmnt` once `status=paid`. | Path: `razorpayLinkId`; query: `reconcile?` | `{ status, amount, transactionId, assessmentId, assessmentName, [userStudentId, assessments[]], ...}` | When `paid`: provisions student (via Razorpay webhook side-effects already invoked), mints `cn_at_asmnt` cookie. | **permitAll** (PUBLIC_PATHS line 126, `/payment/webhook/**`) | `@PreAuthorize("@auth.allows('payment_webhook.read')")` declared in source, but path is in PUBLIC_PATHS so the filter chain never enforces auth. | — | See §5: declared `@PreAuthorize` is dead code on this endpoint due to PUBLIC_PATHS overlap. |
| `POST /bet-report-data/public/prepare?e=&t=&assessmentId=` | `api-clients/campaignAPI.ts:89` (from `pages/ThankYouPage.tsx`) | `ReportPreparationController.prepareReport` — `spring-social/.../b2c/ReportPreparationController.java:41-86` | Pre-generates the student's detailed PDF report so the next "Download" click is instant. | Query: `t` (access token), `e` (entitlementId), `assessmentId` | `{ status: "ready", reportType, reportUrl, studentClassUsed }` or 5xx `{ status: "failed", logId }` | Generates BET or Navigator report file; uploads to storage; writes `report_generation_log`. | **permitAll** (PUBLIC_PATHS line 132, `/bet-report-data/public/**`) | — (annotation removed; access-token validation is the gate). | — | Comment "Coverage-excluded". |

---

## 4. Auth & permission model summary

### How the SPA obtains a session

1. **Username + DOB** → `POST /user/auth` returns the `userStudentId` + allotted-assessments list. No cookie yet; the SPA stores ids in `localStorage` and the DOB string in `localStorage.studentDob`.
2. **Cookie mint** → `POST /auth/assessment-session` with `{ userStudentId, assessmentId, dob }`. On success the backend issues `cn_at_asmnt` (HttpOnly, Secure outside dev, SameSite, 4 h) + `cn_csrf` (JS-readable). The runtime flag `cookieAuthRuntimeActive` flips true; the request interceptor stops injecting `X-Assessment-*` headers.
3. **Header fallback** → if the mint returns 404 (per-institute flag off), 403 (enrolment mismatch), or any network/5xx, the runtime flag stays false and every subsequent axios call ships `X-Assessment-Session` / `X-Assessment-Student-Id` / `X-Assessment-Id` from `sessionStorage`/`localStorage` (legacy v2.0 path served by an interceptor on the backend side). Critical raw-fetch calls (`submit`, `save-partial`, `proctoring`, `feedback-rating`) always send `credentials: 'include'` so the cookie attaches when it exists, but they intentionally do NOT inject the legacy headers — by Phase-19 design, those calls rely on the cookie path or PUBLIC_PATHS being open.
4. **Alternate cookie issuers:**
   - `POST /entitlement/redeem-token` (magic link) — issues `cn_at_asmnt` inline.
   - `GET /payment/webhook/status/{linkId}` — issues `cn_at_asmnt` inline once `status=paid`.

### SecurityConfig public/protected decision

- `SecurityConfig.PUBLIC_PATHS` (`spring-social/.../SecurityConfig.java:106-143`) is the **single source of truth** for both CSRF exemption and `permitAll()` — they are wired from the same array (lines 331 & 354). Anything not in PUBLIC_PATHS, STATIC_ASSET_PATHS, or the `/actuator` carve-out falls into `.anyRequest().authenticated()`.
- PUBLIC_PATHS that the assessment app calls: `/user/auth`, `/auth/assessment-session`, `/entitlement/redeem-token`, `/payment/webhook/**`, `/campaign/public/**`, `/promo-codes/public/validate`, `/bet-report-data/public/**`, `/assessment-mapping/public/**`, plus `/auth/login`, `/auth/refresh`, `/auth/logout`, `/oauth2/**`.
- CORS is configured to mirror `allowedOrigins` with `allowCredentials=true` (`SecurityConfig.java:268-292`) and allows the `X-CSRF-Token` + `X-Assessment-*` headers explicitly.
- HSTS only in `production` profile; CSP ships report-only in every profile (`SecurityConfig.java:299-319`, `466-499`).
- `EnableGlobalMethodSecurity(prePostEnabled = true)` (line 43) is what makes `@PreAuthorize` annotations evaluate — `auth.enforce-mode` defaults to `log-only` (`AuthorizationService.java:55-56`), so denies are *recorded* (auth_audit) but every call still returns `true`. The flip to enforcing is Phase 17 and is set via `AUTH_ENFORCE_MODE=enforce`.

### `@auth.allows(...)` pattern

- The `AuthorizationService` bean (registered as `@Service("auth")`) exposes `allows(perm, ...scopeArgs)` overloads. Callers write `@PreAuthorize("@auth.allows('assessment_answer.read', @auth.instituteOfStudent(#studentId))")` and SpEL binds the scope args at runtime.
- Scope helper: `instituteOfStudent(Long userStudentId)` (`AuthorizationService.java:78-85`) resolves the student's institute_code — used by `partial-restore` and the answer/report endpoints touched by memory id 1144's recent correction.
- **Principal hydration for assessment cookies:** `TokenAuthenticationFilter` resolves the JWT `sub` to a `UserDetails` (with role groups + permissions) when the request carries `cn_at_asmnt`, so `@PreAuthorize` strings actually evaluate against the STUDENT role's permission bundle (memory id 1140). Fallback to a minimal principal if the User lookup fails (legacy `StudentAssessmentMapping` ABAC then carries the load).

### Where permission strings are seeded (Flyway)

- `spring-social/src/main/resources/db/migration/V20260512001__seed_phase15_permissions.sql` — Phase 15 permission catalog (434 lines).
- `spring-social/src/main/resources/db/migration/V20260522001__seed_student_role_group.sql` — creates the `STUDENT` role and a `student` role group, links them, and seeds **exactly the 16 codes** the assessment SPA needs:
  - `user.me`, `user.update`
  - `student_info.read`, `student_info.update`
  - `student_demographic_response.create` / `.read` / `.update`
  - `assessment.read`, `assessment.prefetch`, `assessment.start`
  - `heartbeat.ping`
  - `assessment_answer.read`, `assessment_answer.update`, `assessment_answer.submit`
  - `assessment_proctoring.create`
  - `generated_report.read`
- It also whitelists `/student/*` for the STUDENT role's `role_url` table (used by the dashboard SPA's `RequirePermission` gate, NOT the assessment SPA).

### ABAC scope enforcement

- Active for `partial-restore` (institute, via `instituteOfStudent(#studentId)`).
- NOT active for `submit`, `feedback-rating`, `save-partial`, `heartbeat`, `startAssessment`, `prefetch`, `getby`, `getById`, status, demographics — these rely on permission alone (the STUDENT role grants the codes) plus the in-handler defense-in-depth cookie-claim check on `/submit` (lines 266-289).
- Public funnel endpoints have no scope check; access is gated by in-handler token/signature/promo validation (Razorpay HMAC for webhooks, 30-byte SecureRandom for entitlement tokens, etc.).

---

## 5. Gaps / risks observed

- **`@PreAuthorize` shadowed by PUBLIC_PATHS on `GET /payment/webhook/status/{linkId}`.** The handler declares `@PreAuthorize("@auth.allows('payment_webhook.read')")`, but the path matches `/payment/webhook/**` in `PUBLIC_PATHS`, which forces `permitAll` ahead of method security. The annotation is effectively dead code; anonymous callers can poll arbitrary `razorpayLinkId` values. The endpoint also returns the session payload (and mints `cn_at_asmnt`) for any `paid` transaction, which is the intended UX but means knowledge of a Razorpay link id is the *only* thing protecting another student's session. Mitigations rely on Razorpay link ids being unguessable. Consider adding a server-side throttle / id obfuscation.
- **`/assessment-answer/submit` has weaker ABAC than its siblings.** It only enforces `@PreAuthorize("@auth.allows('assessment_answer.submit')")` with no scope dim, relying on the in-handler `cn_at_asmnt` `(sub, aid)` check (`AssessmentAnswerController.java:266-289`). That check is *only triggered if the cookie is present* — when the legacy header path is active (per-institute flag off) the in-handler check is skipped entirely and the endpoint trusts whatever `userStudentId`/`assessmentId` the body carries, gated only by the permission code. Once cookie auth is universal this is fine; until then a malicious admin-token holder (or anyone with `assessment_answer.submit`) can submit on behalf of any student. Source comment already flags it: "PUBLIC?: assessment app may call without admin JWT — flagged for 15-06 EXCLUSIONS review".
- **`/assessment-answer/save-partial` same shape, same caveat.** No `instituteOfStudent` dim; comment "PUBLIC?: assessment app partial save — flagged for 15-06 EXCLUSIONS review" on line 1789.
- **`/assessments/{id}/student/{userStudentId}` and `/assessments/prefetch/{userStudentId}` lack ABAC.** Both pass no scope arg; permission alone (`assessment.read` / `assessment.prefetch`) gates them. A student with the STUDENT role bundle can technically request another student's status / prefetch list (the response leaks assessment names + status). The companion `partial-restore` does use `instituteOfStudent(#studentId)`, so the asymmetry looks unintentional.
- **`/student-demographics/contact-info/{userStudentId}` (GET + POST) and `/student-demographics/fields/{...}/{...}`** also pass no scope arg ("scope-filter narrows access" per source comment), but no Hibernate scopeFilter is wired for the StudentInfo entity in the visible code — meaning enforcement currently relies on the permission alone and the still-`log-only` mode. Could leak/overwrite another student's contact info to anyone with `student_demographic_response.read/update`.
- **`POST /user/auth` is anonymous + returns the full session payload** with no rate limiting beyond `RateLimitFilter`'s per-IP bucket (`SecurityConfig.java:417`). A username-enumeration brute force would be visible in audit logs but functionally allowed; the only proof-of-identity is DOB.
- **DOB stored in `localStorage` (`studentDob`)** is required by `mintAssessmentSessionCookie` (`AssessmentContext.tsx:270-279`). Any XSS in the assessment SPA leaks the DOB → attacker can mint cookies for any `(userStudentId, assessmentId)` they know. CSP is currently report-only and allows `unsafe-inline` + `unsafe-eval` in `script-src`, which is documented as a known weakness in `SecurityConfig.java:460-465`.
- **`auth.enforce-mode=log-only` (default).** All `@PreAuthorize("@auth.allows(...)")` gates currently return `true` even on PERM_MISSING / SCOPE_MISMATCH (`AuthorizationService.java:46-48`). Until production flips `AUTH_ENFORCE_MODE=enforce`, the permission catalogue is observational only.
- **Stale memory note.** Prior observation 1101 catalogued "27 endpoints"; current count is ~28 distinct paths the SPA reaches (the `/bet-report-data/public/prepare` was added to a new `ReportPreparationController`, and the upgrade flow uses `/campaign/public/upgrade-info/{entitlementId}` + `/campaign/public/pay-for-report`). Prior note that `StudentLoginPage` "still calls `/user/auth`" remains accurate.
- **`X-Assessment-*` header fallback path** is documented in code but I did not see the backend `AssessmentSessionInterceptor` that consumes those headers in this audit — worth re-verifying it still exists if/when cookie auth becomes the default (memory id 1097 referenced it).
- **`/assessments/prefetch/{userStudentId}` is `@Cacheable` keyed by `userStudentId`** with no role-aware key — fine for a single student, but if the same userStudentId is shared across role-groups in the future the cache won't differentiate.
