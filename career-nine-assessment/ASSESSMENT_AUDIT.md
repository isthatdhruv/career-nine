# Career-Nine Assessment App — Functional, Logical & Performance Audit

**Scope:** `career-nine-assessment/` (React 19 + Vite + TypeScript SPA) — the full student-facing flow: login → demographics → start → instructions → section/question engine → submit → thank-you/report, plus registration funnels, payment, proctoring, games, caching/offline and build.

**Method:** Direct line-by-line reading of the source (every page, hook, context, util, api module, and the build config), cross-checked against the Spring backend contract and the production `dist/` bundle. In parallel, a 282-agent adversarial review pass independently re-derived findings (each candidate read the code and was challenged by two skeptics): **136 raw → 88 confirmed → 48 rejected.** This document gives a curated narrative of the most important issues up front, and **Appendix A lists all 88 independently-verified findings** with a fix for each.

> **Correction vs. the first draft:** the most important thing the verification pass changed is the payment verdict — the axios retry interceptor **replays non-idempotent POSTs**, so payment/registration/start calls are *not* as safe as the first pass implied. See **C7**.

**Stated priorities (from the request):** issues that can break the app *at the start of*, *during*, or *anywhere around* an assessment; critical correctness/money bugs; and unoptimised behaviour that hurts on a slow/flaky network (slow 4G, low-end Android).

---

## Severity legend

| Sev | Meaning |
|-----|---------|
| 🔴 **Critical** | Breaks the assessment mid-flow, loses answers, blocks start/submit, or makes the app unusable on slow 4G for many users. Fix first. |
| 🟠 **High** | Breaks a real path for some users/conditions, or a major perf regression. |
| 🟡 **Medium** | Degraded UX/perf, recoverable edge-case breakage, or latent risk. |
| ⚪ **Low** | Minor correctness/perf, dead code, cleanup. |

Each item lists **Where**, **What's wrong**, **Impact / when it bites**, **Trigger**, and **Fix**.

---

## ⭐ Start here — Top 10 risks (ranked) and quick wins

**Top 10 risks, most likely to break a live assessment or money flow (fix in this order):**

1. 🔴 **Background-call 401/403 → `window.location.href` full-page reload destroys all in-memory answers.** Replace the interceptor's hard redirect with in-app navigation that first flushes answers to `/save-partial`, and exempt background calls (heartbeat, branding) from ejecting. *(C1, C8)*
2. 🔴 **axios interceptor retries non-idempotent POSTs** (`startAssessment`, payment-link, submit) on every network error → double Razorpay charge + wiped restored answers. Retry GETs only (or POSTs with an explicit `Idempotency-Key`). *(C7)*
3. 🔴 **4 h `cn_at_asmnt` cookie expires mid-assessment with no proactive re-mint** → student ejected, in-flight answers lost. Silently re-mint on a timer well before TTL and on focus. *(C9)*
4. 🔴 **Out-of-bounds `questionIndex` crashes the engine to a white screen** (no error boundary). Clamp the index + add an ErrorBoundary. *(C5)*
5. 🔴 **Lazy-chunk load failure on a 4G blip → permanent blank screen.** Wrap `Suspense` in an ErrorBoundary; retry the dynamic import. *(M11 → upgraded)*
6. 🟠 **After submit retries are exhausted the student is stranded and "answers are saved locally" is false.** Persist the payload locally before claiming safety; treat `409` as success. *(C2, C3)*
7. 🔴 **Partial-restore `.then()` does a full `setAnswers` replace, clobbering answers typed during a slow restore.** Merge, don't replace; skip questions the student already touched. *(C-state, see Appendix)*
8. 🟠 **"Continue Assessment" / retried `startAssessment` wipes a returning student's saved answers.** Route "Continue" through `restorePartialAnswers`; make `startAssessment` idempotent server-side. *(C6-related)*
9. 🔴 **`ResourcePreloader` blocks the whole app (incl. login) behind a ~4 MB download for up to 15 s on cold-cache 4G.** Render immediately; preload in the background. *(H2)*
10. 🟠 **Section-boundary save excludes the last-typed text answer** (fires before the 300 ms debounce) and swallows all save failures. Flush pending text synchronously; await + retry the save. *(C6)*

**Quick wins (small change, big payoff):**

- **Gate the retry interceptor to GET-only** (`http.ts:164-176`) — one change defuses both double-charge and the `startAssessment`-wipes-answers data loss.
- **Clamp `currentIndex`** at `SectionQuestionPage.tsx:269` — one-liner kills the white-screen crash.
- **Add one top-level `ErrorBoundary`** around `<Suspense>` in `App.tsx` — converts every uncaught render/chunk failure from fatal to recoverable.
- **Make `ResourcePreloader` non-blocking** (`return <>{children}</>` immediately) — instantly unblocks the login form on slow 4G.
- **Dynamic-`import()` jsPDF + html2canvas** inside `htmlToPdf.ts` — removes ~600 KB from the entry chunk every student downloads at login.
- **Treat `409` as success** in the submit loop (`~:1133`) — stops false "failed" alerts on slow-but-successful submits.
- **Add an in-flight guard + 401-exemption to `useHeartbeat`** — stops background pings flooding the link and kicking students off.
- **Fix the false "answers are saved locally" copy** (`:1174`).
- **Disabled/spinner state on the Download Report tile** + drop `html2canvas` scale 3 → ~2 — prevents OOM/freeze + double-tap concurrent conversions on low-end Android.
- **`<link rel=preconnect>` to the API origin** in `index.html` — shaves a full RTT off the first auth call on high-latency 4G.

---

## 🔴 Critical

### C1 — A background heartbeat can throw the student onto `/permission-denied` mid-assessment
- **Where:** `src/hooks/useHeartbeat.ts:98` (posts via the `http` axios instance); `src/api/http.ts:110-118` (public-endpoint allow-list) and `:185-208` (the redirect interceptor).
- **What's wrong:** The heartbeat fires `http.post('/assessments/heartbeat', …)` every 30 s. `/assessments/heartbeat` is **not** in `PUBLIC_ENDPOINT_PATTERNS`, so when it returns 401 (the 4 h `cn_at_asmnt` cookie expired) or 403, the response interceptor runs `window.location.href = '/permission-denied'`. The hook's `.catch(()=>{})` only swallows the rejected promise — it runs **after** the redirect is already scheduled.
- **Impact / when:** A student who is mid-question when the cookie crosses the 4 h boundary (or on any transient 403) is ejected from the assessment by a *fire-and-forget telemetry call*, even if answer-saving would still work. Recurs every 30 s.
- **Trigger:** Cookie expiry / any 401-while-cookie-active or 403 on the heartbeat while on a question page.
- **Fix:** Add `/assessments/heartbeat` to `PUBLIC_ENDPOINT_PATTERNS` (telemetry must never redirect), **or** make the heartbeat a raw `fetch` like `savePartialAnswers`/`proctoringApi` (which deliberately bypass the interceptor). Broader: the redirect interceptor should only fire for *foreground, user-initiated* calls, not background ones.

### C2 — Final submit retries non-retryable errors and blocks the UI with `alert()`
- **Where:** `src/pages/SectionQuestionPage.tsx:1111-1178` (`confirmAndSubmit`).
- **What's wrong:** The submit loop treats **any** `!response.ok` as retryable and retries 3×. That includes `409 Conflict` ("already submitted"), `400` (validation), and `401/403` (auth) — none of which a retry can fix. Between attempts it calls blocking `alert("Submission failed … Retrying in Ns…")`, which freezes the page until dismissed. The request uses a 10 s `AbortSignal.timeout`, far tighter than the axios 60 s.
- **Impact / when:** On a 409 the student sees three scary "submission failed" alerts for an assessment that *did* submit. On slow 4G, a large answer+proctoring payload can exceed 10 s → abort → full re-send ×3 → wasted bandwidth and a terrible blocking UX.
- **Trigger:** Any 4xx on submit, or submit on a slow link.
- **Fix:** Only retry on network error / 5xx / timeout. Map `409` to the success/"already submitted" path, `400` to an inline validation message, `401/403` to a re-auth prompt. Replace `alert()` with the existing in-page modal/toast. Raise the submit timeout (e.g. 30–45 s) and/or add jitter.

### C3 — "Your answers are saved locally" is false, and the last section's answers can be lost
- **Where:** `src/pages/SectionQuestionPage.tsx:151-158` (answers are in-memory + Redis only), `:311-327` & `:1043-1052` (partial save fires **only on section transition**), `:1172-1176` (failure message).
- **What's wrong:** By design, answer state is **never** written to `localStorage` (Redis is the source of truth), and `savePartialAnswers` is only called when leaving a section. On the **last** section the student goes straight to `/submit`; there is no section-boundary save afterward. If all 3 submit attempts fail, the final section's answers exist **only in React memory** — not in localStorage and not in Redis — yet the alert reassures: *"Your answers are saved locally."*
- **Impact / when:** Real data loss on the most important screen (the submit). The student trusts the message, closes/reloads, and `restorePartialAnswers` returns the *previous* snapshot without the last section.
- **Trigger:** Submit fails (slow/flaky 4G) on the last section.
- **Fix:** Call `savePartialAnswers` immediately before the first submit attempt (and on each failure). Correct the message to reflect reality, or actually persist a recovery copy (localStorage/IndexedDB) and rehydrate from it. See also C6.

### C6 — In-progress answers within a section are never persisted until the section boundary
- **Where:** `src/pages/SectionQuestionPage.tsx:311-327`, `:1043-1052`; `src/api/assessmentApi.ts:13-28` (fire-and-forget, **no timeout, no retry**).
- **What's wrong:** A snapshot is pushed to Redis only when `sectionId` changes. A long section answered over many minutes holds all that work in volatile memory. `savePartialAnswers` itself is best-effort (`fetch().catch(()=>{})`) with no timeout and no retry, so on a flaky link the boundary save can silently fail too.
- **Impact / when:** A tab crash, OOM (see H3/M4/M10), accidental close, or browser reload mid-section loses the entire current section. The design comment calls this "accepted," but combined with slow-4G sessions and the proctoring memory pressure it's a frequent real loss.
- **Trigger:** Crash/reload/close mid-section; or boundary save fails on flaky network.
- **Fix:** Debounced autosave during a section (e.g. every N answers / 15–30 s) to Redis and/or localStorage; give `savePartialAnswers` a timeout + a couple of retries; flush on `visibilitychange: hidden` (more reliable than `beforeunload` on mobile).

### C4 — A new tab / lost `sessionStorage` leaves the student stuck on an infinite "Loading…" spinner
- **Where:** `src/pages/SectionQuestionPage.tsx:551-555`; `src/pages/SelectSectionPage.tsx:170-177`; `src/contexts/AssessmentContext.tsx:361-388` (hydrates only from **sessionStorage**).
- **What's wrong:** `assessmentData`/`assessmentConfig` are cached in `sessionStorage` and re-hydrated on mount. `sessionStorage` is **per-tab** and not shared with new tabs. Only `AllottedAssessmentPage` ever *fetches* the data; the section/question pages assume it's already in context. They render `"Loading Assessment"` / `"Loading sections…"` indefinitely with no re-fetch path and no timeout.
- **Impact / when:** Opening the assessment link in a new tab, a tab restore, or any sessionStorage gap → permanent spinner; the student cannot proceed.
- **Trigger:** Deep-link/new-tab/tab-restore onto `/studentAssessment/...` or `/general-instructions`.
- **Fix:** On these pages, if `assessmentData` is absent, call `fetchAssessmentData(localStorage.assessmentId)` (with a visible error/timeout fallback) instead of spinning forever. Consider mirroring the cached questionnaire to `localStorage` so it survives across tabs.

### C5 — Out-of-range `questionIndex` in the URL crashes the page (white screen)
- **Where:** `src/pages/SectionQuestionPage.tsx:269` (`setCurrentIndex(Number(questionIndex) || 0)`) → `:557-558` (`const question = questions[currentIndex]; const qId = question.questionnaireQuestionId`).
- **What's wrong:** `questionIndex` from the URL is coerced but never clamped to `[0, questions.length-1]`. A value `>=` the question count makes `questions[currentIndex]` `undefined`, and the very next line dereferences `.questionnaireQuestionId` → `TypeError` → blank screen (no error boundary).
- **Impact / when:** A stale/edited/shared link, or navigating after the section's question count shrank, hard-crashes the assessment.
- **Trigger:** `/studentAssessment/sections/<id>/questions/9999`.
- **Fix:** Clamp the index: `Math.min(Math.max(0, n), questions.length - 1)`; guard render when `!question`; add a top-level error boundary so a render throw never white-screens a student.

### C7 — The axios retry interceptor replays **non-idempotent POSTs** → double Razorpay charge + wiped answers *(corrects the first-pass "payment is robust" note)*
- **Where:** `src/api/http.ts:164-176` (retries on `!error.response || status >= 500` for **all** methods); affected POSTs include `/payment/...` link creation, registration, `/assessments/startAssessment`, and `/assessment-answer/submit`.
- **What's wrong:** The retry policy keys only on status/network, not HTTP method. On a slow/flaky 4G link, a POST whose response is lost (or returns 5xx after the server already committed) is silently re-sent up to 3×. The client-side amount-safety I noted earlier does **not** prevent this — it's the *POST itself* being duplicated.
- **Impact / when:** (a) **Money:** duplicate Razorpay payment links / double-charge. (b) **Data:** a retried `startAssessment` can reset an ongoing attempt and **wipe the student's restored Redis partial answers**. (c) duplicate submits.
- **Trigger:** Any network blip / 5xx-after-commit on a POST over slow 4G; also component-level double-taps before `submitting` re-renders.
- **Fix:** Retry **GET only** by default; allow POST retry **only** when the caller attaches an `Idempotency-Key` the backend honours. Make `startAssessment` idempotent server-side (never reset existing partial answers for an `ongoing` attempt). Disable buttons synchronously on first click.

### C8 — The `/permission-denied` redirect is a full-page `window.location.href` nav that destroys in-memory answers
- **Where:** `src/api/http.ts:204-207`.
- **What's wrong:** On 401/403 the interceptor does `window.location.href = '/permission-denied'` — a hard browser navigation that tears down the React tree and every in-memory answer (which, per the Redis-only design, may not be saved anywhere). Triggers are often **not** user-initiated (heartbeat C1, branding re-fetch, cookie expiry C9).
- **Impact / when:** A transient background 401 becomes a guaranteed full redo of unsaved work; `PermissionDeniedPage`'s CTA then sends the student to `/student-login`, where re-auth wipes recovery state.
- **Trigger:** Any 401/403 from any call while on an assessment route.
- **Fix:** Use in-app React-Router navigation (no full reload); flush answers to `/save-partial` first; exempt background/telemetry calls entirely; point the denied-page CTA back to the assessment, not login.

### C9 — The 4 h `cn_at_asmnt` cookie expires mid-assessment with no proactive re-mint
- **Where:** `src/contexts/AssessmentContext.tsx:243-326` (mint is one-shot per `(student,assessment)` pair; never refreshed).
- **What's wrong:** The session cookie is minted once at Start and lives 4 h. A long assessment (or a paused/resumed one) crosses the TTL with no silent refresh; the next authenticated call 401s → C8 eject.
- **Impact / when:** Long/slow sessions are ejected mid-flow with in-flight answers lost.
- **Trigger:** Assessment duration (incl. idle) exceeds 4 h.
- **Fix:** Proactively re-mint on a timer well before TTL and on window focus; or refresh-on-401 (re-mint then retry the original call) instead of ejecting.

### C10 — `restorePartialAnswers` resolves late and **replaces** (not merges) answers the student already typed
- **Where:** `src/pages/SectionQuestionPage.tsx:412-461` (the restore `.then()` calls `setAnswers/​setRankingAnswers/​setTextAnswers` with freshly-built objects).
- **What's wrong:** On slow 4G the restore GET can resolve seconds after mount, by which time the student may have answered the visible question. The callback overwrites state wholesale, discarding those answers. Text answers are also re-mapped positionally, which can mis-place them.
- **Impact / when:** Silent loss of the first answers entered on a slow connection; mis-attributed text answers.
- **Trigger:** Student answers before the restore call returns (common on slow 4G).
- **Fix:** Merge restored data into current state; skip any question the student has already touched during the restore window; map text answers by a stable key, not by counter index.

---

## 🟠 High

### H1 — ~2.4 MB of eager JavaScript downloads before the login screen can paint
- **Where:** `src/App.tsx:12` (eager `import ThankYouPage`) → `src/pages/ThankYouPage.tsx:8` → `src/utils/htmlToPdf.ts:1-2` (`html2canvas` + `jsPDF` imported at module top); `src/firebase.ts`; `vite.config.ts:85-94` (manualChunks only splits react/router/firebase). Confirmed in `dist/assets/`: two `index-*.js` chunks at **1.3 MB + 1.1 MB**, plus `firebase` 214 KB and `index.es` (html2canvas) 156 KB.
- **What's wrong:** Almost every page is eagerly imported in `App.tsx`; only the 3 section pages are `lazy`. Because `ThankYouPage` is eager and statically pulls in the PDF stack, `jsPDF`+`html2canvas`+`dompurify` land in the initial bundle that the **login page** must download. Firebase, payment, registration and thank-you code all ship up front too.
- **Impact / when:** On a ~400 kbps effective slow-4G link, ~2.6 MB of JS ≈ **40–60 s** before the login form is interactive — for a screen that needs none of it.
- **Trigger:** Any first visit on a slow connection.
- **Fix:** `lazy()` everything that isn't on the first paint path (ThankYou, all registration/payment pages). Make `htmlToPdf` a dynamic `import()` inside the download handler so the PDF stack only loads when a report is downloaded. Add `webgazer`, `jspdf`, `html2canvas`, `bootstrap` to `manualChunks`. Target a <300 KB initial bundle.

### H2 — The whole app is gated behind `ResourcePreloader`, which eagerly downloads assessment/game assets before login renders
- **Where:** `src/main.tsx:33-35` wraps `<App/>`; `src/components/ResourcePreloader.tsx:266` returns `null` until `ready`; `:199-236` downloads all `assessment`/`game`-priority manifest resources; `:249-257` 15 s safety timeout.
- **What's wrong:** Nothing renders (not even login) until the preloader finishes or 15 s elapse. It pre-downloads assessment and **game** resources (potentially MBs of video/assets) that a student at the login screen doesn't need yet, competing for the same slow pipe.
- **Impact / when:** First-time slow-4G users can stare at the boot bar for up to 15 s before they can even log in; bandwidth is spent on assets that may never be used.
- **Trigger:** First load (cold cache) on slow 4G.
- **Fix:** Render the app immediately and preload **in the background** (don't block on `ready`). Only prefetch the *specific* assessment's data once it's known (after login/Start), and prefetch game assets lazily/just-in-time, ideally on Wi-Fi or via `navigator.connection` hints.

### H3 — Proctoring storage & uploads grow unbounded and choke slow links / low-end devices
- **Where:** `src/hooks/usePerQuestionProctoring.ts:81-88` (`persistData` JSON-stringifies the **entire** per-question map to localStorage **on every question finalize**), `:202-221` (merge keeps all gaze/eye points), `:132-137` (slices off ever-growing arrays); `src/hooks/useFaceTracking.ts:34,79` (snapshots pushed ~4×/s, never trimmed); `SectionQuestionPage.tsx:1105-1109,1143` (full dataset POSTed once); `src/api/proctoringApi.ts:19` (10 s timeout).
- **What's wrong:** Gaze snapshots accumulate at ~4/s for the whole session in memory; the per-question map (with all gaze + eye + click points) is re-serialized to localStorage after **each** question → O(n²) write growth and main-thread jank, with a real shot at `QuotaExceededError`. At submit, the entire dataset is sent in one request behind a 10 s timeout.
- **Impact / when:** Long assessments on low-end Android: rising memory, UI jank between questions, possible localStorage quota errors, and a proctoring upload that reliably times out on slow 4G (lost silently).
- **Trigger:** Any normal long session with proctoring enabled.
- **Fix:** Cap/trim snapshot arrays (ring buffer); persist incrementally (only the finalized question, e.g. via append) instead of rewriting the whole map; downsample gaze data; chunk/stream the proctoring upload (per-section) with retries instead of one big POST; consider `navigator.sendBeacon` for the final flush.

### H4 — MediaPipe model & WASM loaded from external CDNs (`@latest`, uncached), plus a second camera stream
- **Where:** `src/hooks/useFaceCounter.ts` — `FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm')` and `modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/.../blaze_face_short_range.tflite'`; it also calls its own `navigator.mediaDevices.getUserMedia(...)` independent of WebGazer (`useFaceTracking.ts`).
- **What's wrong:** (1) `@latest` is non-deterministic — a new MediaPipe release can break the app with no code change. (2) Both the WASM and the `.tflite` model come from **third-party origins** that are *not* the self-hosted `/mediapipe/face_mesh/` path (which vite rewrites and the PWA caches), so they are **not** PWA-cached and re-download each session. (3) School/exam networks frequently block jsdelivr/googleapis → face counting silently dies. (4) Opening a **second** camera stream alongside WebGazer's can fail or conflict on some devices/browsers that don't allow concurrent capture of one camera.
- **Impact / when:** Heavy, fragile downloads over slow 4G; silent proctoring loss on locked-down networks; potential camera conflict on low-end devices.
- **Trigger:** Any proctored session, especially on restricted/slow networks.
- **Fix:** Self-host and **pin** the tasks-vision WASM + model under `/mediapipe/...` (the path already rewritten + PWA-cached); remove the `@latest` tag. Reuse WebGazer's single `MediaStream` for face counting instead of opening a second one. Degrade gracefully (already partially handled) with a clear non-blocking state.

### H5 — Auto-advance `setTimeout`s are never tracked or cleared
- **Where:** `src/pages/SectionQuestionPage.tsx:873-887` (`toggleOption`) and `:938-953` (`handleRankChange`).
- **What's wrong:** After a selection, a 400 ms `setTimeout` calls `navigate(...)`. The timer id is never stored or cleared. Rapid clicking, or unmount within 400 ms, fires the navigation late — navigating from the wrong question or after the component is gone.
- **Impact / when:** On a laggy device a fast student can trigger overlapping navigations / land on an unexpected question; React state-update-after-unmount warnings.
- **Trigger:** Fast successive selections or navigating away within 400 ms.
- **Fix:** Store the timeout in a ref and clear it on the next interaction and on unmount; or drive auto-advance from an effect keyed on the answer instead of a bare timer.

### H6 — Mount-time status check on `SelectSectionPage` can eject to `/permission-denied`
- **Where:** `src/pages/SelectSectionPage.tsx:65-68` (`http.get('/assessments/{id}/student/{sid}')` — not a public endpoint).
- **What's wrong:** This authenticated GET runs on every mount. A transient 401/403 (cookie just expired, flaky auth) triggers the same `/permission-denied` redirect as C1, but here on the screen right before the questions.
- **Impact / when:** Student finishes instructions, hits the section list, a transient auth blip ejects them.
- **Trigger:** Cookie expiry / transient 403 on entering the section list.
- **Fix:** Treat a *transient* failure here as non-fatal (retry/soft-fail) and only redirect on a confirmed, persistent auth failure; align with the C1 fix.

### H8 — No bot protection (reCAPTCHA) on the public registration funnels
- **Where:** `src/pages/AssessmentRegisterPage.tsx`, `src/pages/CampaignRegisterPage.tsx`, `src/pages/SchoolAssessmentRegisterPage.tsx` — a repo-wide search for `captcha`/`grecaptcha` returns **nothing**. (Matches the project note that the reCAPTCHA secret is "still pending.")
- **What's wrong:** Public B2C/B2B registration POSTs (account creation, payment-link generation, credential/welcome emails) have no human-verification gate.
- **Impact / when:** Scriptable abuse — mass fake registrations, email/SMS spam via the welcome-credential pipeline, payment-link spam.
- **Trigger:** A bot hitting the public `/c/:slug` / register endpoints.
- **Fix:** Add reCAPTCHA (or hCaptcha/Turnstile) to the public registration submits and verify server-side; rate-limit the endpoints.

### H9 — Admin live-tracking `answeredCount` is always 0 (reads keys the engine never writes)
- **Where:** `src/hooks/useHeartbeat.ts:19-67` reads `assessmentAnswers` / `assessmentRankingAnswers` / `assessmentTextAnswers` from localStorage; `SectionQuestionPage.tsx:329-333` explicitly **does not** persist answers to localStorage (Redis-only design).
- **What's wrong:** The data source for `answeredCount` was removed when the engine moved to Redis-only answers, but the heartbeat counter was not updated. It parses 3 absent JSON blobs every 30 s and always reports `0`.
- **Impact / when:** Admin live-tracking shows every student as 0 answered. Also: the `StudentLoginPage` "unsaved answers recovery" branch (`:17-31`) and the submit-time cleanup (`SectionQuestionPage.tsx:1151-1153`) are now dead code keyed on the same never-written keys.
- **Trigger:** Always.
- **Fix:** Compute `answeredCount` from the in-memory answer state (pass a count into the hook) or from the Redis snapshot; delete the dead localStorage recovery/cleanup paths or repoint them.

---

## 🟡 Medium

### M1 — `goBack` only moves within the current section and keeps two sources of truth for the index
- **Where:** `SectionQuestionPage.tsx:1033-1041`. `goBack` sets `currentIndex` *and* `navigate`s, while the URL-param effect (`:257-273`) also sets `currentIndex` — momentary double-set. It also can't return to the previous section's last question.
- **Fix:** Drive `currentIndex` from the URL param only (single source of truth); let "Back" cross section boundaries.

### M2 — Game results are written to Firestore from the client, keyed by a client-controlled id
- **Where:** `src/contexts/DataContext.tsx:84-151` — `setDoc(doc(db, "game_results", userStudentId), …, {merge:true})` where `userStudentId` comes from localStorage.
- **What's wrong:** A student can set any `userStudentId` and write/overwrite arbitrary `game_results`. Integrity depends entirely on Firestore security rules (not in this repo).
- **Fix:** Verify Firestore rules restrict writes to the authenticated principal; ideally route game scoring through the authenticated backend instead of direct client writes.

### M3 — `ThankYouPage` bootstraps identity from URL query params (IDOR surface)
- **Where:** `ThankYouPage.tsx:129-137` writes `entitlementId`/`userStudentId`/`assessmentId` straight from the URL into localStorage, then fetches upgrade-info/report.
- **What's wrong:** Anyone can craft a URL with arbitrary ids. Report/upgrade access is gated by a server `accessToken` on the entitlement, so it's likely safe — but it should be confirmed the backend never returns sensitive data on id alone.
- **Fix:** Confirm server-side authorization for upgrade-info/report by token, not id; avoid trusting URL-supplied identity for anything sensitive.

### M4 — Client-side PDF generation can OOM/crash low-end devices
- **Where:** `src/utils/htmlToPdf.ts:56-65` — `html2canvas(el, { scale: 3 })` on a 960 px iframe (~2880 px canvas) per page, then downscale.
- **Impact:** Generating a multi-page report on a low-end phone can blow memory and crash the tab (post-assessment, on the Thank-You page).
- **Fix:** Lower `scale` (1.5–2), render/release pages one at a time, or prefer the server-side PDF path for low-memory clients; it's already conditional on report type.

### M5 — Dead "Desktop Required" mobile-block modal; messaging contradicts the mobile UI
- **Where:** `AllottedAssessmentPage.tsx:20-21,524-546` — `setShowMobileWarning`/`setShowOngoingModal` are never called, so the modals never show. The text claims the assessment "cannot be completed on a mobile device," yet `SectionQuestionPage` ships a mobile sidebar/responsive layout.
- **Fix:** Either implement a real device gate (if mobile truly isn't supported) or delete the dead modals and the misleading copy.

### M6 — "Continue Assessment" (ongoing) replays demographics/instructions and resumes at `questions/0`
- **Where:** `AllottedAssessmentPage.tsx:37-95` routes ongoing through the full start flow; `SelectSectionPage.tsx:97-103` resumes to `…/questions/0` rather than the actual next-unanswered index.
- **Impact:** Returning students re-see demographics/instructions and land on an already-answered question (answers are restored, so not data loss — just confusing).
- **Fix:** For `ongoing`, skip demographics/instructions and deep-link to the true next-unanswered `(sectionId, questionIndex)`.

### M7 — Elapsed-time timer drifts and is throttled in the background
- **Where:** `SectionQuestionPage.tsx:511-517` — a 1 s `setInterval` increments `elapsedTime`.
- **Impact:** Background tab throttling (mobile) and tick drift make the displayed time inaccurate over long sessions.
- **Fix:** Compute elapsed from a stored start timestamp (`Date.now()` delta) rather than counting ticks.

### M8 — Login DOB accepts impossible dates; year range is hard-coded and ages out
- **Where:** `StudentLoginPage.tsx:57-60,111-112` — `validateDob` only checks all three are picked; `days` is always 1–31; `years = 2024 - i` (1985–2024, frozen).
- **Impact:** "31 February" is selectable (auth just fails server-side); the year list goes stale each calendar year and excludes some valid birth years.
- **Fix:** Validate a real calendar date; derive the year range dynamically.

### M9 — `useDebouncedLocalStorage` can silently drop data on non-quota write failures
- **Where:** `src/hooks/useDebouncedLocalStorage.ts:12-36` — `flush` clears `pendingWrites` first, then writes; a non-`QuotaExceededError` failure logs but does not re-queue.
- **Impact:** Rare, but a transient write error loses that key's pending value. A single shared timer also coalesces unrelated keys (fine functionally).
- **Fix:** Re-queue failed writes; keep the quota fallback.

### M10 — Option images are base64-decoded and pinned in a module-level array
- **Where:** `src/contexts/AssessmentContext.tsx:98-132` (`preDecodeOptionImages`).
- **Impact:** Image-heavy questionnaires keep all decoded `Image` objects alive for memory smoothness — but on low-end devices this is memory pressure that compounds with H3.
- **Fix:** Decode lazily per-section/visible question; cap the retained set.

### M11 — No error boundary around `Suspense`; lazy-chunk failure relies on a one-shot reload
- **Where:** `App.tsx:40-71` (Suspense, no `ErrorBoundary`); `main.tsx:8-29` (reload-once on chunk fetch failure).
- **Impact:** On slow 4G a lazy chunk (`SectionQuestionPage`, games) can fail to load; the one-shot reload is the only recovery — if it also fails, the user sees a blank screen.
- **Fix:** Add an error boundary with a retry CTA; keep the reload hack as a secondary path.

### M12 — Inconsistent timeouts/error-handling between axios and the raw-`fetch` calls
- **Where:** axios `timeout: 60000` (`http.ts:74`) vs raw-`fetch` submit/proctoring at 10 s (`SectionQuestionPage.tsx:1129`, `proctoringApi.ts:19`); the submit path bypasses the axios retry/redirect entirely.
- **Impact:** The most important call (submit) has the tightest timeout and its own ad-hoc retry; behaviour diverges from every other call.
- **Fix:** Standardise timeouts per call class; share one retry policy.

---

## ⚪ Low / cleanup

- **L1** — `QuestionNavigationGrid` is imported in `SectionQuestionPage.tsx:15` but never rendered (an inline grid is used instead). Dead code/bundle weight.
- **L2** — `devAutoFill`/`devMode` are statically imported into `AllottedAssessmentPage` and ship in the prod bundle (gated by hostname at runtime, so not exposed — just dead weight). Consider build-time stripping.
- **L3** — Verbose `console.log` in prod paths: the full submission JSON (`SectionQuestionPage.tsx:1095-1096,1139-1140`) and many `[ASSESS-SESSION-DEBUG]` logs in `AssessmentContext`/`http.ts` (some gated by `DEV`, but the mint and submit logs are not). Strip for production.
- **L4** — Submit clears `assessmentAnswers*` localStorage keys that are never written (`SectionQuestionPage.tsx:1151-1153`). Dead.
- **L5** — `StudentLoginPage.tsx:17-31` "unsaved answers recovery" is dead (those keys never exist). 
- **L6** — `usePreventReload` (`beforeunload`) is unreliable on mobile Safari/Chrome; don't depend on it for save-on-exit (see C6 fix: use `visibilitychange`).
- **L7** — Heartbeat parses three localStorage JSON blobs every 30 s for a count that's always 0 (see H9).

---

## Slow-4G / low-end performance — consolidated

The app *can* function on a slow link, but several choices fight against it:

1. **Initial bundle is far too big** (H1) — ~2.6 MB of eager JS before login. Biggest single win.
2. **App render is blocked by the resource preloader** (H2), which also fetches game assets too early.
3. **Proctoring** (H3, H4) downloads large external models, keeps unbounded data in memory/localStorage, and uploads everything in one tight-timeout POST.
4. **Answer durability is weak on flaky networks** (C3, C6) — saves only at section boundaries, fire-and-forget, no retry, no offline queue.
5. **Submit & proctoring use 10 s timeouts** (C2, H3, M12) that large payloads blow past on slow 4G, then retry/abort.
6. **No request abort on unmount** anywhere (axios calls, fetches) → wasted in-flight work and races when navigating on a slow link.

**Highest-leverage perf fixes:** lazy-load non-login routes + dynamic-import the PDF stack (H1); stop blocking render on the preloader (H2); self-host+pin+cache the MediaPipe assets and reuse one camera stream (H4); incremental/chunked proctoring persistence + upload (H3); in-section autosave with retry (C6).

---

## Systemic themes (root causes worth fixing once)

- **The 401/403 → `/permission-denied` redirect is too aggressive** and fires for *background* calls (heartbeat C1, status check H6). Background/telemetry calls should never navigate the user.
- **Two answer-durability models coexist** (Redis-only in the engine vs. the old localStorage assumptions in heartbeat/login/submit-cleanup), producing dead code (H9, L4, L5) and a false safety message (C3).
- **Non-retryable errors are retried** (submit C2) while **idempotent durability is under-saved** (C6) — the retry policy is applied to the wrong places.
- **Heavy, eagerly-loaded, externally-hosted dependencies** (PDF stack, firebase, MediaPipe) inflate the critical path (H1, H2, H4).
- **No render-level resilience** — no error boundary, no index clamping, no re-fetch fallback (C4, C5, M11) means a single bad input/lost cache white-screens a student.

---

## Suggested fix order (impact × effort)

**Do first (small change, stops mid-assessment breakage):**
1. C1 — carve out / raw-fetch the heartbeat (one-line allow-list).
2. C5 — clamp `questionIndex` + guard `!question` + add an error boundary (M11).
3. C2 — don't retry 4xx; remove `alert()`; fix the 409 path.
4. C3/C6 — save partial answers before submit and during a section; fix the message.

**Do next (high value):**
5. C4 — re-fetch `assessmentData` when context is empty.
6. H1/H2 — lazy-load non-login routes + dynamic PDF import; stop blocking render on the preloader.
7. H9 — fix `answeredCount`; delete dead recovery/cleanup code.
8. H6 — soften the section-list status-check redirect.

**Then (perf + correctness):**
9. H3/H4 — incremental proctoring persistence + upload; self-host/pin/cache MediaPipe; single camera stream.
10. H8 — reCAPTCHA + rate-limiting on public registration.
11. H5, M-series, L-series as capacity allows.

---

## What was checked and looks solid

- **Payment amount integrity** (`PayForReportPage`, `PaymentStatusPage`): the **amount is computed server-side** — the client sends only `tierId`+`promoCode`, never a tamperable price (`PayForReportPage.tsx:107-112`). Payment-status endpoints are in the public carve-out, so polling won't eject the user; polling is bounded (15×2 s) with sensible reconcile + fallback paths. **Caveat (C7):** this does *not* make the flow double-charge-safe — the axios interceptor can replay the payment-link POST, and a double-click can fire two requests before `submitting` re-renders. Idempotency must be enforced (key + server dedupe).
- **XSS:** instructions render via a custom React-element markdown parser (`instructionMarkdown.tsx`) — no `dangerouslySetInnerHTML` on user/DB content (the only such usage is on hard-coded strings in `GeneralInstructionsPage.tsx:128`).
- **Demographics** (`DemographicDetailsPage`): reasonable per-type validation, `noValidate` with custom checks, double-submit guard, phone digit-masking.
- **Firebase / games data** are lazy-loaded (`DataContext.tsx:3-7`); games chunk-split out of the main bundle.
- **CSRF**: state-changing calls consistently mirror `cn_csrf` → `X-CSRF-Token`, including the raw-fetch paths.

---

*Generated from a direct source review of `career-nine-assessment/` plus an adversarial multi-agent cross-check. Line references are against the tree at audit time; re-verify after edits.*

---

## Appendix A — All 88 independently-verified findings (adversarial multi-agent pass)

These were produced by a separate 282-agent review: each candidate finding was read against the code and challenged by two independent skeptics; only findings confirmed by **≥1** skeptic are listed (`votes` = skeptics who confirmed / total). They overlap with the curated narrative above and add deeper, domain-specific issues (game internals, build/deploy, slow-4G timing). Grouped by domain; ordered by severity within each.

### assessment-flow-navigation

- **[CRITICAL]** No React error boundary anywhere — lazy-chunk load failure on flaky network produces a permanent blank screen  
  `src/App.tsx:22-24, 40-71` · votes 2/2  
  **Why:** A student mid-assessment on slow 4G who navigates into a section (lazy chunk) during a network blip sees a blank page and cannot continue; answers in memory are lost. Affects many users on the target low-end-Android/slow-4G profile.  
  **Fix:** Wrap <Routes> (or at least the lazy routes) in an ErrorBoundary that renders a 'Connection problem — Retry' button which re-attempts the import / reloads. Broaden the message match in main.tsx to a case-insensitive regex covering all browsers, and allow more than one reload (e.g.…

- **[HIGH]** SectionQuestionPage crashes on out-of-range questionIndex deep-link / refresh (no clamp)  
  `src/pages/SectionQuestionPage.tsx:269, 553-558` · votes 2/2  
  **Why:** A bookmarked/refreshed/back-forward URL with a stale or too-large question index (e.g. the student previously was on a longer section, or a hand-edited URL) crashes the question screen.  
  **Fix:** Clamp on mount: const idx = Number(questionIndex); setCurrentIndex(Number.isFinite(idx) ? Math.min(Math.max(idx,0), (section.questions?.length ?? 1)-1) : 0). Also guard render: if (!question) redirect to questions/0 or show a recoverable error.

- **[HIGH]** Invalid sectionId deep-link soft-locks SectionQuestionPage on a permanent 'Loading Assessment' spinner  
  `src/pages/SectionQuestionPage.tsx:262-265, 553-554` · votes 2/2  
  **Why:** A stale/incorrect section URL (old bookmark, content edit that removed a section, copy-paste error) leaves the student on an infinite spinner with no way forward; combined with usePreventReload's beforeunload prompt, they cannot easily escape.  
  **Fix:** When section is not found, navigate('/studentAssessment', { replace: true }) (back to the section picker) or render an explicit 'Section not found' message with a button to the picker, instead of returning into the indefinite loading state.

- **[HIGH]** Deep-linking into section/instruction routes with no assessmentData loaded shows infinite spinner instead of recovering  
  `src/pages/SectionInstructionPage.tsx:40-76` · votes 2/2  
  **Why:** Refreshing the page (or restoring a tab) on any section/instruction route after sessionStorage is gone leaves the student stuck on a spinner; they cannot resume. On mobile, sessionStorage is frequently dropped when the browser backgrounds the tab.  
  **Fix:** In SectionInstructionPage/SectionQuestionPage, add an effect: if assessmentData is null and localStorage has assessmentId, call fetchAssessmentData(assessmentId); on still-failing after a timeout, redirect to /allotted-assessment. Centralize this as a route guard so all three laz…

- **[HIGH]** Resume auto-redirect in SelectSectionPage can yank a student out of a section they manually clicked into  
  `src/pages/SelectSectionPage.tsx:55-118, 153-155` · votes 2/2  
  **Why:** Student deliberately picks Section B, then after a slow network delay is silently bounced to Section A (first-unanswered), losing their place and confusing them mid-assessment.  
  **Fix:** Guard the async navigation with a cancellation ref set on unmount and on user interaction (e.g. let cancelled=false; in handleSectionClick set it), and skip the resume-navigate if the user has already navigated away. Better: do the resume routing once on mount only (not on every …

- **[HIGH]** AllottedAssessmentPage 'Continue Assessment' calls startAssessment for ongoing students, wiping their Redis partial answers  
  `src/pages/AllottedAssessmentPage.tsx:37-95` · votes 2/2  
  **Why:** An ongoing student who returns and clicks 'Continue Assessment' loses every previously-saved partial answer (everything restorePartialAnswers would have recovered). Direct answer-data loss.  
  **Fix:** Branch on studentStatus: for 'ongoing', skip the startAssessment POST entirely and navigate straight to /studentAssessment (the resume path which calls restorePartialAnswers). Only call startAssessment for not-started status. Mirror this guard in DemographicDetailsPage.

- **[MEDIUM]** Heartbeat answeredCount is always 0 — reads localStorage keys that are never written  
  `src/hooks/useHeartbeat.ts:19-68` · votes 2/2  
  **Why:** Admin live-tracking dashboard always shows 0 answered for every active student, defeating the heartbeat feature; also the login-page 'preserve unsaved answers' recovery never triggers, so there is no localStorage safety net against a tab crash.  
  **Fix:** Either (a) have SectionQuestionPage scheduleWrite the answer maps to those localStorage keys (re-enabling the crash-recovery net), or (b) compute answeredCount from the actual source — pass it into useHeartbeat from SectionQuestionPage's in-memory answers/rankingAnswers/textAnswe…

- **[LOW]** usePreventReload nags on non-answer screens and impedes recovery from soft-lock states  
  `src/hooks/usePreventReload.ts:3-19` · votes 2/2  
  **Why:** Degraded UX and harder recovery from the soft-lock states; students on flaky networks who need to refresh are discouraged from doing so.  
  **Fix:** Pass an `enabled` flag to usePreventReload that is true only on the active question page when there is unsaved in-memory answer state (as StudentLoginPage already does conditionally), and false on instruction/selection/landing screens.

- **[LOW]** AllottedAssessmentPage filters to isActive only — completed-but-inactive assessments vanish and show false 'No Assessments'  
  `src/pages/AllottedAssessmentPage.tsx:258, 291` · votes 2/2  
  **Why:** Students who finished an assessment that was later deactivated lose visibility of it (and any path to their report). Confusing 'No Assessments' message for users who actually completed work.  
  **Fix:** Show completed assessments regardless of isActive (with a 'Completed — View Report' action), and base the empty-state on the unfiltered list length. Reserve the isActive gate for the Start button's disabled state only.

- **[LOW]** AssessmentStartPage error path leaves an uncleared 4s redirect timer that can override later navigation  
  `src/pages/AssessmentStartPage.tsx:26-67` · votes 1/2  
  **Why:** Edge-case unexpected redirect to /student-login a few seconds after the user has already moved on, or a no-op when the magic-link token changes in place.  
  **Fix:** Store the timeout id and clear it in the effect cleanup (return () => clearTimeout(id)). If supporting in-place token changes is desired, drop the ranRef short-circuit guard for changed params.



### auth-session

- **[CRITICAL]** 4h cn_at_asmnt cookie expires mid-assessment with no proactive re-mint — student ejected, answers silently lost  
  `src/contexts/AssessmentContext.tsx:243-326` · votes 2/2  
  **Why:** Mid-assessment, for any student on a long/multi-session assessment: the cn_at_asmnt cookie dies at the 4h mark and cannot be renewed without returning to the assessment list and re-clicking Start (which mintedPairRef already blocks for the same pair until reset). Answers in fligh…  
  **Fix:** Add a proactive re-mint: track the mint timestamp and, on a timer (e.g. at ~3h30m) or on any 401 from an assessment endpoint, re-call /auth/assessment-session (clearing mintedPairRef first) to rotate the cookie before/at expiry. At minimum, expose a re-mint path from SectionQuest…

- **[CRITICAL]** Mid-assessment 401 triggers window.location.href full-page reload, destroying all in-memory answers  
  `src/api/http.ts:186-208` · votes 2/2  
  **Why:** Mid-assessment, any student whose cn_at_asmnt expires or whose institute flag is flipped off while taking the test: a background GET (e.g. branding, a re-fetch) returns 401 -> hard reload -> all un-flushed answers lost and the student lands on a dead-end 'session no longer valid'…  
  **Fix:** Replace the hard `window.location.href` redirect with an event/callback the React app handles via React Router (preserving SPA state), and BEFORE redirecting, force a synchronous flush of current answers to Redis. Better: on 401-while-active, attempt a silent re-mint and replay t…

- **[HIGH]** mint() with no studentDob in localStorage sets cookieAuthRuntimeActive=false, silently disabling all auth with no recovery  
  `src/contexts/AssessmentContext.tsx:273-285` · votes 1/2  
  **Why:** Any student reaching the assessment without studentDob in localStorage cannot start: mint is skipped, no cookie is ever set, calls 401, no redirect, dead-end. Especially affects the payment auto-login flow when the webhook payload lacks studentDob.  
  **Fix:** When dob is missing, do not silently disable auth and claim a (now-nonexistent) header fallback. Either re-prompt the student for DOB / bounce them to /student-login to re-establish identity, or fetch studentDob from the session payload. The stale comment about the header fallbac…

- **[HIGH]** Partial-answer autosave is fire-and-forget raw fetch with zero retry and silent 401 swallow — answers lost on expiry/flaky network  
  `src/api/assessmentApi.ts:13-28` · votes 1/2  
  **Why:** On a long assessment or any session whose cookie expired, the only persistent backup of in-progress answers silently stops working. The student sees no error and keeps answering; on the next hard reload/eject (finding #2) everything since the last *successful* save is lost.  
  **Fix:** Route partial-save through a resilient path: retry with backoff, surface persistent 401/403 to trigger a silent re-mint (and replay), and signal the student if saves are persistently failing so they don't lose hours of work unknowingly.

- **[HIGH]** Multi-tab / shared-kiosk session bleed: HttpOnly cn_at_asmnt is browser-global; second student's login cannot reliably evict the first student's live cookie  
  `src/pages/StudentLoginPage.tsx:36-41, 130-135` · votes 2/2  
  **Why:** On invigilated/kiosk devices and multi-tab use, one student's answers can be submitted under another student's identity, or a stale tab keeps writing with a mismatched cookie vs localStorage. Data integrity and exam-fraud risk.  
  **Fix:** Make /auth/logout awaited and verified before allowing the new login to proceed; detect cross-tab identity changes (e.g. storage event on userStudentId) and force the stale tab to re-auth/lock; consider binding answer submits to the (userStudentId in the JWT) so a mismatched loca…

- **[HIGH]** PermissionDeniedPage CTA sends ejected students to /student-login, not back to their assessment — guarantees lost progress + re-login wipe  
  `src/components/PermissionDeniedPage.tsx:60-75` · votes 1/2  
  **Why:** A transient/expired-session eject becomes a guaranteed full restart with answer loss: student is dropped to login, re-auth wipes recovery state, and they must redo the assessment. No path back to the in-progress assessment.  
  **Fix:** Attempt a silent re-mint using the still-present localStorage (userStudentId, assessmentId, studentDob) and, on success, navigate back to `from` to resume in place. Only fall back to /student-login if re-mint fails, and never clear recovery answers on that re-login.

- **[MEDIUM]** Login-page prefetch passes the username string to /assessments/prefetch/{userStudentId} (expects numeric id) — prefetch always fails  
  `src/pages/StudentLoginPage.tsx:68-74` · votes 1/2  
  **Why:** On slow 4G the assessment-list warm-up never happens, so AllottedAssessmentPage and the first assessment load are slower than designed for every student. Also generates a 400 per username blur on the server.  
  **Fix:** Either change the prefetch endpoint to accept a username, or defer prefetch until after /user/auth returns the numeric userStudentId and call prefetchAssessmentData(String(data.userStudentId)) there. Until then, the blur-time prefetch is misdirected.

- **[MEDIUM]** Login accepts impossible calendar dates; /user/auth returns 200+null body on bad credentials, making auth-failure vs transport-error indistinguishable  
  `src/pages/StudentLoginPage.tsx:52-60, 114-152` · votes 2/2  
  **Why:** Students can pick impossible dates and only get a generic 'Invalid credentials' with no hint it was the date; real auth failures and transport anomalies are conflated. Confusing, recoverable UX/correctness issue.  
  **Fix:** Constrain the day dropdown to the selected month/year and reject future/absurd dates client-side, and have /user/auth return a proper 401 with a body on failure instead of 200+null so the client can distinguish auth failure from transport errors.

- **[LOW]** StudentLoginPage mount effect re-fires on provider re-render (non-memoized dep), re-clearing storage + re-issuing logout mid-login  
  `src/pages/StudentLoginPage.tsx:16-42` · votes 1/2  
  **Why:** Potential mid-login storage re-clear (disrupting a half-entered form / preserved recovery state) on any provider re-render, plus duplicate logout POSTs; a second logout that lands after a fast mint could even clear the freshly minted cookie.  
  **Fix:** Wrap resetAssessmentAuthState (and the other context callbacks) in useCallback in the provider, and run the login-mount reset exactly once (empty dep array, read the function from a ref) so it cannot re-fire on provider re-renders.



### build-pwa-bundle

- **[CRITICAL]** jsPDF + html2canvas (~600KB+) eagerly bundled into the entry chunk, downloaded by every student on the login page  
  `src/utils/htmlToPdf.ts:1-2 (htmlToPdf.ts); App.tsx:12; ThankYouPage.tsx:8` · votes 2/2  
  **Why:** On slow 4G (~50-150 KB/s effective) the ~256KB-brotli entry chunk takes many seconds longer than necessary before first interactive paint of the login form. Affects 100% of students on first/cold-cache load — the worst-affected being low-end Android on slow 4G, which is exactly t…  
  **Fix:** Make report generation lazy. In ThankYouPage, replace the static `import { downloadHtmlAsPdf } from '../utils/htmlToPdf'` with a dynamic `await import('../utils/htmlToPdf')` invoked only inside the download click handler. This moves jsPDF/html2canvas/canvg/dompurify out of the en…

- **[CRITICAL]** ResourcePreloader blocks the entire app (including the login form) while downloading 4.05MB of assessment data + 3 tutorial MP4s  
  `src/components/ResourcePreloader.tsx:164-268 (esp. 199-236, 251-257, 266)` · votes 2/2  
  **Why:** On slow 4G a cold-cache student stares at the loading bar for the full 15s safety timeout before they can even type a username, on every device that hasn't cached yet. Pre-downloading 1.16MB of videos and 1.7MB of JSON for assessments the student may never take wastes their data …  
  **Fix:** Do not gate rendering of <App/> on the preloader. Render children immediately and let prefetch happen in the background (move ResourcePreloader to a non-blocking effect, or render children always and only show the inline preloader overlay until critical app JS is parsed). At mini…

- **[HIGH]** DigitalOcean App Platform ignores the Netlify-style _headers file: hashed assets are not cached immutable and index.html is not no-cache  
  `public/_headers:1-9 (public/_headers); deploy: .do/app.yaml` · votes 1/2  
  **Why:** Returning students after a deploy can hit a chunk-load reload loop / broken lazy routes (SectionQuestionPage, SelectSectionPage). Repeat visitors lose the benefit of immutable caching, increasing slow-4G load times. Affects all users after every deploy.  
  **Fix:** Configure cache headers via the host that is actually used. On DO App Platform, set per-route headers in the app spec (or front with a CDN/proxy that applies them). Ensure index.html is served no-cache and /assets/* (hashed) is served immutable. Do not rely on `_headers`.

- **[HIGH]** PWA precaches 5.4MB on first load — including the 1.27MB webgazer/tfjs chunk and mediapipe — competing with the active assessment on slow 4G  
  `vite.config.ts:47-80` · votes 2/2  
  **Why:** A student on slow 4G who just loaded the app and starts logging in / taking the assessment has 5.4MB of background SW precache saturating their already-thin pipe, slowing answer saves and question loads (data-loss / freeze risk under packet loss). The 1.27MB webgazer chunk is pre…  
  **Fix:** Exclude the heavy lazy chunks from precache via workbox `globIgnores` (e.g. the gaze-tracking vendor chunk and mediapipe), letting them load on demand / via runtimeCaching. Keep precache to the true app shell (entry JS, CSS, index.html, login-critical assets). Optionally switch t…

- **[HIGH]** Proctoring stack (1.27MB webgazer chunk + 17MB mediapipe WASM from CDN) loads unconditionally for every student on the question page  
  `src/pages/SectionQuestionPage.tsx:95-98 (hooks); useFaceCounter.ts:23-25; useFaceTracking.ts:52` · votes 2/2  
  **Why:** On slow 4G, opening the first question forces a large download burst that delays question render and competes with answer-save traffic — risking freeze and answer loss mid-assessment. Affects every student who reaches the question page. The @latest CDN also means the WASM version…  
  **Fix:** Gate the proctoring hooks behind a per-assessment/per-institute proctoring flag so non-proctored assessments never load webgazer/mediapipe. Pin the mediapipe version (not @latest) and self-host the WASM (dist/mediapipe already ships 17MB) so it is served same-origin and covered b…

- **[MEDIUM]** Pre-compressed .br/.gz artifacts are dead weight: DO App Platform does not serve sibling pre-compressed files  
  `vite.config.ts:81-83` · votes 1/2  
  **Why:** Wasted CPU/time at build, larger deploy, and — critically — the carefully-produced brotli (which would roughly 4x shrink the entry chunk on the wire) is not what the client receives unless DO's own runtime brotli kicks in. No correctness break, but the slow-4G compression win the…  
  **Fix:** Either (a) deploy behind a server that serves the pre-compressed siblings (nginx `gzip_static`/`brotli_static`), or (b) drop vite-plugin-compression2 and rely on the host's runtime compression. Confirm via response headers that the entry chunk is delivered with `content-encoding:…

- **[MEDIUM]** manualChunks 'react' produces an empty 1-byte chunk; React is duplicated into the entry instead of split  
  `vite.config.ts:88-93` · votes 2/2  
  **Why:** React (~140KB) re-downloads as part of the entry on every app-code change instead of being cached across deploys, and the manualChunks config gives a false sense that vendors are split. Minor extra slow-4G cost on repeat/post-deploy visits; the empty chunk is harmless but indicat…  
  **Fix:** Use a function-form manualChunks that buckets by node_modules path (e.g. group all of node_modules into a vendor chunk, or specifically isolate react/react-dom + jspdf + html2canvas), or rely on Vite's automatic vendor splitting. Verify the react chunk is actually populated after…

- **[MEDIUM]** Resource manifest version is Date.now()-based, busting the entire on-device resource cache on every build even when assessment content is unchanged  
  `scripts/generate-manifest.cjs:64 (version: Date.now().toString(36)); ResourcePreloader.tsx:188-197` · votes 1/2  
  **Why:** Every deploy makes returning students on slow 4G re-download up to 4MB of assessment/game resources that were already cached and unchanged. Frequent deploys repeatedly punish the slow-4G cohort.  
  **Fix:** Derive the manifest version from a content hash of the resource set (e.g. hash of sorted url+size, or reuse Vite's build hash only when content changed), not Date.now(). Cache name should change only when the prefetched bytes actually change.

- **[MEDIUM]** No preconnect/dns-prefetch to the API origin; render-blocking gtag inline config in <head>  
  `index.html:10-17 (gtag); whole head (no preconnect)` · votes 2/2  
  **Why:** On slow/high-latency 4G the missing preconnect adds a full RTT (often 200-600ms+) before the first API call can even start, delaying the login/auth round trip. Marginal but cumulative on the critical path.  
  **Fix:** Add `<link rel=preconnect crossorigin href="https://api.career-9.com">` (and dns-prefetch fallback), and a preconnect to cdn.jsdelivr.net if the mediapipe CDN stays. Consider deferring gtag entirely until after first interaction.

- **[MEDIUM]** cache-assessment.sh runs at build time and silently keeps stale cached assessment JSON on fetch failure, shipping outdated questions to students  
  `scripts/cache-assessment.sh:29-36, 77-88` · votes 1/2  
  **Why:** If the locked assessment content changed but the build-time fetch failed (or returned an older snapshot), students take a stale version of the assessment (wrong/old questions, scoring config mismatch) with no signal to anyone. CacheFirst + 30-day expiry means even a later fix doe…  
  **Fix:** Fail the build loudly when a locked assessment cannot be fetched (don't silently keep stale), include a content hash/version in the cached JSON path or filename so updated content invalidates the cache, and consider StaleWhileRevalidate (not CacheFirst) for /assessment-cache so d…

- **[LOW]** Firebase config (apiKey, projectId, appId) hardcoded in source instead of env, and Firestore bundles ~218KB into a chunk used only for game data  
  `src/firebase.ts:4-14` · votes 1/2  
  **Why:** No environment separation for Firebase (same project for staging and prod); config drift requires a code change + rebuild. Low direct risk because keys are public, but worth gating Firestore security rules and moving config to env for hygiene. The 218KB chunk is correctly lazy to…  
  **Fix:** Move firebaseConfig values to VITE_FIREBASE_* env vars (document in .env.example) so staging/prod use separate projects, and ensure firebase remains dynamically imported only from the game-data save path. Verify Firestore security rules restrict writes appropriately since the key…



### network-api-resilience

- **[CRITICAL]** Retry interceptor replays non-idempotent POSTs — duplicate Razorpay payment links / double-charge on slow 4G  
  `src/api/http.ts:146-177` · votes 2/2  
  **Why:** Money correctness: a student on flaky 4G who taps 'Pay' once can be issued multiple distinct Razorpay payment links and multiple PaymentTransaction rows; if more than one is paid (e.g. the student retries from email links too) they are double-charged with no server-side guard. Ev…  
  **Fix:** Make retries method-aware: only retry idempotent methods (GET/HEAD) automatically. For POST/PUT/PATCH/DELETE, do not retry on `!error.response` or 5xx unless the call explicitly opts in via a config flag (e.g. config.__idempotent) AND carries a client-generated idempotency key fo…

- **[CRITICAL]** startAssessment retried on timeout wipes the student's freshly-restored Redis partial answers  
  `src/api/http.ts:163-177` · votes 1/2  
  **Why:** Data loss: a returning student resuming an assessment over flaky 4G can have all previously saved partial answers silently destroyed by a duplicate startAssessment, forcing them to redo the whole assessment. Also the DemographicDetailsPage call (line 285) is inside Promise.all an…  
  **Fix:** Exclude POSTs from automatic retry (see method-aware fix). Specifically for startAssessment, make it safe-to-replay server-side: only clearAllForMapping when status is not already 'ongoing' for the same session, or guard with an idempotency token so a replay is a no-op. On the cl…

- **[CRITICAL]** Heartbeat 401/403 ejects a mid-assessment student to /permission-denied  
  `src/api/http.ts:110-123, 185-208` · votes 2/2  
  **Why:** A background ping kicks the student off the assessment page mid-flow, losing in-section answers that hadn't hit a section boundary. The student cannot continue. Long assessments (>4h, or any cookie hiccup) are especially exposed. This is the worst outcome (app breaks mid-assessme…  
  **Fix:** Treat heartbeat as advisory: add /assessments/heartbeat (and other fire-and-forget/background telemetry like live-tracking) to PUBLIC_ENDPOINT_PATTERNS or a dedicated NO_REDIRECT list so a heartbeat auth failure never triggers the global redirect. Background pings must surface as…

- **[HIGH]** 60s axios timeout × 4 attempts with no jitter = up to ~247s hang per request on slow 4G  
  `src/api/http.ts:74, 3-4, 163-176` · votes 2/2  
  **Why:** On slow/flaky 4G the UI appears frozen for up to ~4 minutes on any failing call; synchronized retries from a classroom amplify backend load right when it's already struggling (thundering herd). Low-end Android over slow 4G is the stated worst-case audience.  
  **Fix:** Reduce timeout to 15-20s for interactive calls. Add full jitter to backoff: delay = random(0, BASE_DELAY_MS * 2^attempt). Cap total retry window. Consider per-endpoint timeouts (longer for submit, short for heartbeat).

- **[HIGH]** No offline detection — requests fire blindly while offline and burn the full retry/timeout budget  
  `src/api/http.ts:146-213` · votes 2/2  
  **Why:** Offline students get long frozen waits and generic 'Unable to connect' messages with no offline UX; the app cannot pause/queue and resume cleanly. Save-partial losses go unnoticed.  
  **Fix:** Add navigator.onLine gating: short-circuit non-critical calls (heartbeat) when offline; for critical calls, listen for the 'online' event and resume/flush queued saves. Surface an offline banner. Map the offline state to a distinct, actionable message.

- **[HIGH]** savePartialAnswers is fire-and-forget with no awaited result, no retry, and silently swallows ALL errors — answer loss  
  `src/api/assessmentApi.ts:13-28` · votes 1/2  
  **Why:** Silent data loss of a whole section's answers when a section-boundary save fails on flaky 4G and the tab is later reloaded/crashes. The student must redo work they thought was saved.  
  **Fix:** Persist answer state to localStorage as a durable fallback (the comment claims Redis-only, but that makes a failed save unrecoverable). At minimum, retry save-partial a few times with backoff and surface a non-blocking 'saving…/save failed' indicator. Consider sendBeacon on visib…

- **[HIGH]** Manual submit retry loop double-counts with interceptor and is unreachable for double-protection; uses raw fetch with 10s timeout that is too tight for async submit on slow 4G  
  `src/pages/SectionQuestionPage.tsx:1111-1178, 1122-1131` · votes 1/2  
  **Why:** On slow 4G the 10s abort fires before a successful-but-slow submit completes; the student is shown alarming retry/failure alerts even though the answers were saved server-side, and may abandon or re-attempt. The 409 path is mishandled (treated as error rather than success).  
  **Fix:** Increase submit timeout to 30-45s. On non-ok, parse the body: treat 409 with status 'duplicate'/'already_submitted' and any 200 'already_submitted' as SUCCESS (navigate to completed). Distinguish AbortError from real failure in the alert copy.

- **[HIGH]** No abort-on-unmount on any http (axios) call — leaked requests, late setState, and redirect after navigation away  
  `src/api/http.ts:60-75, 146-213` · votes 1/2  
  **Why:** A slow/retried request from a prior page can hijack navigation by redirecting to /permission-denied mid-assessment, and late resolutions cause state updates on unmounted components. On slow 4G where requests linger for minutes, this is highly likely.  
  **Fix:** Thread an AbortController.signal into every http call from a component and abort it in the effect cleanup. In the interceptor, skip the redirect when error.code === 'ERR_CANCELED'. Guard .then setState with an isMounted/abort check.

- **[MEDIUM]** Heartbeat interval keeps firing while requests pile up — no in-flight guard floods a slow link  
  `src/hooks/useHeartbeat.ts:83-108` · votes 2/2  
  **Why:** On a congested 4G link the connection pool fills with retrying heartbeats, blocking/queuing the assessment-critical requests behind them; main-thread JSON parsing every 30s adds jank on low-end devices.  
  **Fix:** Guard with an in-flight flag (skip the tick if the prior heartbeat hasn't resolved). Disable retries for heartbeat (it should be best-effort: pass a per-call config to opt out of the interceptor retry). Throttle/cheapen countAnsweredQuestions or memoize it.

- **[MEDIUM]** restorePartialAnswers / restore path conflates 404, network error, and empty into null — silent loss of resume on transient failure  
  `src/api/assessmentApi.ts:39-59` · votes 2/2  
  **Why:** A transient restore failure on resume makes the student appear to have no saved progress; because the one restore attempt is consumed (didRestoreRef set pre-await), they cannot recover their answers without a full reload, and may overwrite the real Redis snapshot by re-answering.  
  **Fix:** Retry restore a few times with backoff before treating as 'no snapshot'. Distinguish 404 (genuinely none) from network/5xx (unknown — block start and show retry). Set didRestoreRef only after a definitive success/404, not before the await.

- **[LOW]** Proctoring submit uses AbortSignal.timeout(10000) with no fallback for unsupported browsers and no retry — proctoring data lost on slow 4G  
  `src/api/proctoringApi.ts:5-21` · votes 2/2  
  **Why:** On slow 4G or older low-end Android browsers, proctoring data submission silently fails and is never retried; the data sits orphaned in localStorage. Loss of proctoring/integrity data, though not assessment answers.  
  **Fix:** Feature-detect AbortSignal.timeout (fall back to AbortController + setTimeout). Increase timeout for large payloads, add a small retry, and add a startup flush that re-sends any leftover proctoring_per_question from localStorage.



### proctoring-games-perf

- **[HIGH]** MediaPipe FaceCounter loads WASM + model from external CDNs (unpinned @latest) with no local fallback — blocks/fails on slow 4G  
  `src/hooks/useFaceCounter.ts:23-57` · votes 2/2  
  **Why:** On slow 4G / low-end Android the face counter never initializes (or stalls), and the multi-MB downloads compete for the same constrained link the assessment itself needs to fetch questions/save answers — slowing the whole assessment. With '@latest', a CDN change can break proctor…  
  **Fix:** Self-host the tasks-vision WASM and blaze_face .tflite under public/ (as already done for face_mesh) and point modelAssetPath/forVisionTasks at the local path; pin an exact @mediapipe/tasks-vision version instead of @latest; wrap the loads with a timeout (Promise.race) so a stall…

- **[HIGH]** Two simultaneous camera streams + WebGazer model load + RAF/intervals run on every question page mount with no timeout  
  `src/hooks/useFaceTracking.ts:47-143` · votes 1/2  
  **Why:** On a low-end Android phone this pegs CPU/GPU, drains battery fast, and causes the question UI to jank/freeze (taps and scrolling lag) for the whole assessment. The duplicate camera stream doubles the memory/decode cost.  
  **Fix:** Use a single shared camera stream for both WebGazer and the face counter instead of two getUserMedia calls; throttle the WebGazer regression loop; gate the whole proctoring stack behind a device-capability / opt-in check; add a timeout around webgazer.begin() so a hung init degra…

- **[HIGH]** Proctoring snapshot/click buffers grow unbounded for the entire assessment, then are serialized into one giant submit payload  
  `src/hooks/useFaceTracking.ts:34-40, 79-94` · votes 2/2  
  **Why:** Memory growth and repeated large JSON.stringify to localStorage cause GC pauses / jank on low-end devices; the localStorage write can throw QuotaExceeded (silently swallowed at line 85-87, so persisted proctoring data silently stops updating). The final submit is a multi-hundred-…  
  **Fix:** Cap snapshot/click buffer sizes (ring buffer) and aggregate per-question on the fly instead of retaining raw points; store only summary stats (counts/avgs) rather than every raw gaze sample; chunk the proctoring upload per-section or compress; raise/remove the 10s timeout for the…

- **[HIGH]** Proctoring camera, WebGazer loop, and per-question RAF keep running while a game is full-screen (page never unmounts)  
  `src/pages/SectionQuestionPage.tsx:1414-1427` · votes 2/2  
  **Why:** Game + proctoring run concurrently on a low-end device, doubling the frame-budget pressure — the reaction-time game (JungleSpot) and timing-sensitive games jank/drop frames, corrupting the psychometric timing measurements and freezing the UI. Battery drains rapidly.  
  **Fix:** Pause/suspend proctoring (stop the WebGazer loop and camera, pause the MediaPipe detect timer and heartbeat) while isGameActive is true, or move the game route to a sibling component so SectionQuestionPage proctoring tears down; resume when the game completes.

- **[HIGH]** Game-result Firestore save is fire-and-forget; failure is swallowed and the game is still marked complete — silent data loss  
  `src/games/AssessmentGameWrapper.tsx:23-99` · votes 2/2  
  **Why:** On a flaky/firewalled network the game's psychometric results are silently dropped, but the student sees the question as completed and submits — the report is generated without that game's data, and there is no way to recover it.  
  **Fix:** On save failure, retry with backoff and/or persist the game payload to localStorage and re-attempt on next load; do NOT mark the game complete / call onComplete success until the save succeeds (or surface a visible error and offer retry).

- **[MEDIUM]** Game userStudentId prop read from non-existent localStorage key 'User Student id'  
  `src/pages/SectionQuestionPage.tsx:1415-1416` · votes 1/2  
  **Why:** Game results are only saved by an accidental fallback; if a student's id isn't in localStorage under the canonical key, or the fallback is changed, game data is written to doc '' (collision across all students) or dropped. playerName/userStudentId logging is also wrong.  
  **Fix:** Change line 1415 to localStorage.getItem('userStudentId') || '' to match the canonical key used everywhere else.

- **[MEDIUM]** useFaceCounter never resolves to WebGazer video while WebGazer also never finishes — second camera leaks for whole session  
  `src/hooks/useFaceCounter.ts:64-89` · votes 2/2  
  **Why:** Permanent dual-camera capture on the weakest devices/networks (exactly where WebGazer is slowest), compounding battery/CPU drain and memory for the full assessment.  
  **Fix:** Coalesce on a single shared MediaStream from the start rather than depending on WebGazer's late-created video element; if keeping two, add a timeout that tears down the independent stream once a shared video is available OR keeps only one stream as the canonical source.

- **[MEDIUM]** Proctoring submit has 10s timeout, no retry, and is fire-and-forget after answer submit — lost on slow 4G  
  `src/api/proctoringApi.ts:5-21` · votes 2/2  
  **Why:** On slow 4G the proctoring POST aborts at 10s and all per-question proctoring data is lost (only localStorage retains it, but the user has already navigated away and storage is cleared on the next successful submit). For the institution this means missing proctoring evidence with …  
  **Fix:** Increase/remove the 10s timeout for proctoring, add retry-with-backoff (reuse the answer-submit pattern), and only clear localStorage('proctoring_per_question') after a confirmed success; consider beacon/keepalive so it survives navigation.

- **[MEDIUM]** JungleSpot restart uses window.location.reload(), wiping in-progress assessment state and reloading the whole SPA  
  `src/games/JungleSpotGame.tsx:392, 1009-1028` · votes 2/2  
  **Why:** A student tapping the game's Restart button mid-assessment triggers a full SPA reload, losing un-Redis-saved answers for the current section and forcing a heavy re-initialization (camera, WebGazer, MediaPipe) on a low-end device.  
  **Fix:** Replace window.location.reload() with an in-component reset (reset refs/state and restart the loop, like handleStartMainGame) so only the game restarts, not the SPA; or remove the Restart button in the assessment-embedded context.

- **[LOW]** usePerQuestionProctoring captures DOM rects via requestAnimationFrame on every question change but never cancels it  
  `src/hooks/usePerQuestionProctoring.ts:236-260` · votes 1/2  
  **Why:** Mis-captured element rects for fast question transitions, mildly corrupting the gaze-vs-option spatial proctoring analysis; harmless to assessment flow.  
  **Fix:** Store the rAF id and cancelAnimationFrame in the effect cleanup; or capture rects synchronously keyed to the question id and ignore captures whose id no longer matches prevQuestionIdRef.

- **[LOW]** WebGazer cleanup re-imports webgazer asynchronously in unmount; teardown can race a not-yet-finished begin()  
  `src/hooks/useFaceTracking.ts:145-172` · votes 2/2  
  **Why:** Occasional orphaned WebGazer camera/DOM after fast navigation during init, leaking a camera stream until the next full reload — worse on slow networks where init is slow.  
  **Fix:** Hold a module/ref handle to the webgazer instance and synchronously call end()/clearGazeListener() in cleanup (no re-import), and have the init path always run end() when cancelled becomes true after begin() resolves; consider a single guarded teardown that both paths await.



### registration-payment

- **[CRITICAL]** axios retries non-idempotent payment/registration POSTs on network error → double Razorpay link / double-charge  
  `src/api/http.ts:163-177` · votes 2/2  
  **Why:** Real money double-charge for paying students on flaky networks; orphan live payment links; for free-path registration, multiple student accounts / entitlements can be provisioned for one submission. Hits paying students mid-funnel on slow/packet-loss connections.  
  **Fix:** Do not retry non-idempotent methods. Restrict retry to GET/HEAD (and explicitly-marked idempotent calls): `const method=(config.method||'get').toUpperCase(); const idempotent=['GET','HEAD'].includes(method); const isRetryable=idempotent && (!error.response||error.response.status>…

- **[HIGH]** Double-click on Register&Pay / Pay before submitting=true commits fires two payment-link requests  
  `src/pages/PayForReportPage.tsx:101-126, 269-275` · votes 2/2  
  **Why:** Two live payment links from one user intent; if the student pays both (or the duplicate gets webhook-provisioned at price>0) they can be charged twice. Affects fast/double-tapping users, especially on high-latency networks where the button visibly lags.  
  **Fix:** Add a synchronous in-flight ref guard at the top of every handleSubmit: `if (submittingRef.current) return; submittingRef.current = true;` set/clear in try/finally, independent of React state. This deduplicates synchronous double-invocations that the async `submitting` flag canno…

- **[MEDIUM]** DOB parsed into payment link without validity check → impossible dates accepted as password/credential  
  `src/pages/AssessmentRegisterPage.tsx:69-81, 118-122` · votes 2/2  
  **Why:** Student registers (and may pay), gets a credentials card showing the DOB they typed, but the backend lenient-parsed it to a different date → DOB-based login and cookie minting fail; for paid users this is payment-taken-but-cannot-access.  
  **Fix:** Validate the DOB is a real calendar date and within a sane range (e.g. not in the future, year 1900–current) before submit; reject otherwise. Mirror non-lenient parsing on the backend (sdf.setLenient(false)) so a bad date is rejected rather than silently rolled.

- **[MEDIUM]** PaymentStatusPage reconcile (?reconcile=1) only sent on poll #0 — if first poll fails it is never retried, slow webhook never short-circuited  
  `src/pages/PaymentStatusPage.tsx:141-143, 229-238` · votes 2/2  
  **Why:** When the first status poll fails on a flaky connection (likely on slow 4G right after returning from Razorpay), the reconcile short-circuit is permanently lost for that page load, maximizing the chance the student times out on 'Verifying' despite a successful payment.  
  **Fix:** Send reconcile=1 on every poll while urlSaysPaid and status is still 'created' (or at least re-attempt reconcile on a fixed cadence), not just poll #0. Track whether a reconcile has actually been delivered (response received) rather than gating on pollCount===0.

- **[LOW]** PayForReportPage 'Pay' allowed for discountedPriceInr<=0 is blocked but free-via-promo (100% off) path has no success route  
  `src/pages/PayForReportPage.tsx:269-275, 113-117` · votes 1/2  
  **Why:** A student with a legitimate 100%-off promo on the pay-for-report page is blocked from redeeming it (button disabled at INR 0), or sees a spurious error if the server returns a non-payment_required success.  
  **Fix:** When discountedPriceInr === 0, change the CTA to 'Unlock for free' and submit; handle a non-'payment_required' success response (e.g. status 'success'/'active') by navigating to the completed/thank-you page instead of showing an error.

- **[LOW]** CounsellingSlotPicker date-range navigation uses toISOString (UTC) for shiftIso, can skip/repeat a day across timezone+DST  
  `src/components/CounsellingSlotPicker.tsx:62-67, 217, 228` · votes 2/2  
  **Why:** Counselling slots for an edge day may be unreachable or duplicated for students in certain timezones / around DST; minor since most users are IST (UTC+5:30, positive offset) but breaks for any negative-offset locale.  
  **Fix:** Compute shiftIso purely in local-date arithmetic without toISOString: build from local Y/M/D, add days, and re-extract local Y/M/D (same approach as todayIso) so the string stays a local calendar date consistent with the disabled check and backend grouping.



### report-thankyou

- **[CRITICAL]** Failed report generation re-runs full server-side generation 4× via axios 5xx retry, blocking download and amplifying load  
  `src/pages/ThankYouPage.tsx:177-189` · votes 2/2  
  **Why:** Paid students whose report errors wait far longer than necessary (4 generation cycles + 7s backoff) before seeing the 'will be emailed' fallback; backend report-generation workers get hammered 4× per failure, risking cascading 500s for other students. Worst on slow 4G where each …  
  **Fix:** Do not route the report-prepare call through the generic 5xx-retry interceptor, or mark it non-retryable. Either (a) use a dedicated axios instance / config flag that disables __retry for /bet-report-data/public/prepare, or (b) have the backend return a 200 with {status:'failed'}…

- **[CRITICAL]** html2canvas scale:3 on a 960px iframe OOMs / freezes low-end Android over slow 4G during PDF download  
  `src/utils/htmlToPdf.ts:54-77` · votes 1/2  
  **Why:** On the exact target device (low-end Android, slow 4G) the PDF download freezes the tab for many seconds or crashes it; the student cannot get their paid report. Even when it works, memory spikes can evict the page mid-conversion.  
  **Fix:** Drop scale to a device-aware value (e.g. 2, or 1.5 when navigator.deviceMemory<=4 / hardwareConcurrency<=4), render+encode pages one at a time and explicitly null out each canvas (set width=height=0) before the next iteration to free memory, add a hard page-count/size guard, and …

- **[HIGH]** downloadHtmlAsPdf fetch has no timeout and no retry — hangs forever on slow/flaky 4G  
  `src/utils/htmlToPdf.ts:105-118` · votes 2/2  
  **Why:** Student taps Download Report, the request stalls on flaky network, and the UI gives no feedback or recovery — they assume the app is broken. No automatic retry for a recoverable blip.  
  **Fix:** Wrap the fetch with an AbortController timeout (e.g. 20-30s) and a small retry-with-backoff loop for network errors/5xx; on timeout/failure fall through to the existing window.open(preparedReportUrl) fallback. Surface a visible spinner/disabled state and re-enable on failure.

- **[HIGH]** Download tile has no disabled/spinner feedback during conversion; rapid taps fire concurrent html2canvas conversions  
  `src/pages/ThankYouPage.tsx:203-226, 622-668` · votes 2/2  
  **Why:** Multiple concurrent heavy PDF conversions on a low-end phone → tab freeze/crash; user has no indication the first tap is working, so re-tapping is the natural behaviour.  
  **Fix:** Early-return in handleDownloadReport when isDownloading is true; reflect isDownloading in the tile (spinner + cursor:'wait' + pointerEvents:'none'). This also fixes the missing-progress UX.

- **[MEDIUM]** Feedback-rating submit uses raw fetch (no retry, no interceptor) and silently no-ops when session IDs are missing  
  `src/pages/ThankYouPage.tsx:318-365` · votes 2/2  
  **Why:** Lost ratings on flaky networks (no retry); rating permanently unsubmittable for query-param-bootstrapped sessions; potential NaN payload to backend.  
  **Fix:** Route rating through the http axios client (gets retry/backoff/CSRF/credentials for free). Validate parsed ints (guard NaN). Hide/disable the star widget when userStudentId/assessmentId are unavailable instead of letting the user click into a guaranteed error.

- **[MEDIUM]** Query-param bootstrap writes attacker-controlled IDs to localStorage with no validation, persisting across sessions  
  `src/pages/ThankYouPage.tsx:129-137` · votes 1/2  
  **Why:** PII disclosure (name/email/phone) for arbitrary entitlements and feedback-rating forgery via a shared/crafted URL; plus localStorage corruption of the legitimate student's session identifiers.  
  **Fix:** Restrict the query-param bootstrap to an authenticated/admin context (it's described as a B2C admin tracker convenience). Validate IDs are numeric. Server-side, the rating and upgrade-info endpoints must authorise the caller against the session/entitlement token rather than trust…

- **[MEDIUM]** Ordered-list markdown loses the author's start number and renumbers from 1  
  `src/utils/instructionMarkdown.tsx:42-48, 133-140` · votes 2/2  
  **Why:** Assessment instruction steps display with incorrect numbering (e.g. all steps show 1.,2. when author intended 3.,4., or numbering resets across paragraph breaks). Students follow mis-numbered instructions; trust/clarity hit on a critical pre-assessment screen.  
  **Fix:** Capture the first item's number and emit `<ol start={firstNum}>`; optionally treat blank-line-separated numbered items as one continuous list, or accept the split but preserve each segment's starting number.

- **[MEDIUM]** Dev auto-fill UI and answer-generation code ship in the production bundle, gated only by client-side hostname  
  `src/utils/devMode.ts:1-9` · votes 2/2  
  **Why:** Data-integrity risk (garbage assessment submissions if the gate is ever satisfied in prod), plus unnecessary JS shipped to slow-4G students. Hostname is a weak, spoofable gate for a destructive capability.  
  **Fix:** Gate the dev auto-fill import/branch behind a build-time constant (import.meta.env.DEV or a dedicated VITE_ENABLE_DEV_AUTOFILL define) so it is dead-code-eliminated from production bundles entirely, in addition to the hostname check.

- **[MEDIUM]** PDF iframe asset wait fail-opens after 5s, capturing a half-loaded report (missing fonts/images) into the PDF  
  `src/utils/htmlToPdf.ts:33-39, 56-62` · votes 2/2  
  **Why:** Paid students on slow 4G can download a PDF with missing images, wrong fonts, or blank sections, and never know it's degraded (no error fires). The deliverable is silently wrong.  
  **Fix:** Wait on document.fonts.ready and on all <img> decode()/complete promises inside the iframe (with a longer, network-aware cap), not a flat 5s. Detect blank/under-rendered canvases and fall back to window.open(htmlUrl) so the browser renders the full report natively.

- **[LOW]** Markdown inline emphasis regex mis-parses underscores in words and unbalanced asterisks  
  `src/utils/instructionMarkdown.tsx:66-86` · votes 2/2  
  **Why:** Pre-assessment instruction text with underscores/asterisks (snake_case identifiers, multiplication, glob patterns) renders with stray italics or dropped characters, confusing students.  
  **Fix:** Require word-boundary / whitespace context for `_` emphasis (CommonMark intraword underscore rule), or restrict emphasis to `**`/`*` only and require non-space adjacency; add backslash-escape handling.

- **[LOW]** downloadHtmlAsPdf leaks the object URL and anchor if conversion throws after blob creation; no revoke on the error path  
  `src/utils/htmlToPdf.ts:105-118` · votes 1/2  
  **Why:** Memory leak of multi-MB PDF blobs across repeated/aborted downloads on the low-end devices already under memory pressure.  
  **Fix:** Wrap the URL/anchor lifecycle in try/finally and always URL.revokeObjectURL(url) and remove the anchor.



### section-question-engine

- **[CRITICAL]** Out-of-bounds questionIndex from URL/grid crashes the question engine (white screen mid-assessment)  
  `src/pages/SectionQuestionPage.tsx:269, 557-560` · votes 2/2  
  **Why:** Mid-assessment hard crash to a blank/error screen for any student who refreshes or is navigated to an index beyond the section length. On a flaky network, stale-cached vs fresh questionnaire payloads with differing section sizes make this reachable. Student cannot continue withou…  
  **Fix:** Clamp on read and on set: `const safeIndex = Math.min(Math.max(0, Number(questionIndex) || 0), (section.questions?.length ?? 1) - 1)` in the mount effect, and guard the render: `const question = questions[currentIndex]; if (!question) return <Redirect/Loading>;` before dereferenc…

- **[HIGH]** Auto-advance setTimeout uses stale currentIndex/qId after navigation, can skip or mis-target questions  
  `src/pages/SectionQuestionPage.tsx:872-887, 938-953, 1018-1031` · votes 2/2  
  **Why:** On fast tapping (common on touch devices) or when a selection lands the user mid-flight, the engine can jump to the wrong question or double-navigate, producing a 'skipped a question' experience and leaving questions unanswered that the student believes they answered.  
  **Fix:** Store the auto-advance timer in a ref and clear it at the start of every navigation/selection handler and on unmount. Compute the target inside the timer using refs for sectionId/currentIndex, or capture the navigation target at schedule time and guard against re-navigation if th…

- **[HIGH]** Heartbeat answeredCount is always 0/stale — reads localStorage keys the engine never writes  
  `src/hooks/useHeartbeat.ts:19-68, 91` · votes 2/2  
  **Why:** Admin live-tracking shows every in-progress student as having answered 0 questions, breaking proctor/operator monitoring during a live session. Silent — no error, just wrong operational data.  
  **Fix:** Pass the live answered count from SectionQuestionPage state into the heartbeat hook (compute from answers/rankingAnswers/textAnswers), or have the heartbeat read from the same source of truth the engine uses. Remove the dead localStorage parsing.

- **[HIGH]** Stale prior-student game/skip/timer state leaks across sessions in the same tab (gameCode collision marks questions falsely answered)  
  `src/pages/SectionQuestionPage.tsx:163-194, 232-237, 242-255, 1150-1157` · votes 2/2  
  **Why:** On shared school devices (the primary B2B use case), a second assessment/student can see game questions falsely marked green/answered via gameCode collision, letting them submit without playing — corrupting scores. elapsedTime is inherited too.  
  **Fix:** Namespace all localStorage keys by `${userStudentId}:${assessmentId}` (or include studentId in completedGames keys). Reset elapsedTime and completedGames when the active assessmentId changes. Validate gameCode belongs to the current questionnaire before treating it as completed.

- **[HIGH]** usePreventReload does nothing to persist answers — refresh/back/OS-kill mid-section silently loses the current section's work  
  `src/hooks/usePreventReload.ts:1-19` · votes 2/2  
  **Why:** Any mid-section refresh, back-gesture, or OS tab kill on low-end Android (common: OS reclaims background tab memory) loses the entire current section; the student must redo it. The worst-case answer loss the brief warns about.  
  **Fix:** Add a `pagehide`/`visibilitychange(hidden)` handler that calls savePartialAnswers(generateSubmissionJSON()) via `navigator.sendBeacon` (survives unload) so in-section progress reaches Redis. Optionally periodically debounce-save partial answers, not only on section change.

- **[HIGH]** Section-transition partial save excludes last-typed text answer (runs before 300ms debounce commits)  
  `src/pages/SectionQuestionPage.tsx:313-327, 1043-1052, 2316-2349` · votes 2/2  
  **Why:** The last-typed text answer in a section is not in the Redis snapshot taken at the section boundary; if the tab dies before the next boundary, that answer is lost even though it is on screen. Affects text/MQT questions.  
  **Fix:** Flush pending textDebounceRef timers (apply localTextInputs into textAnswers) before generating the submission in goToNextSection and the section-change effect. Or read text from localTextInputs as a fallback in generateSubmissionJSON.

- **[HIGH]** After exhausting submit retries the student is stranded; the 'answers are saved locally' message is false  
  `src/pages/SectionQuestionPage.tsx:1166-1181` · votes 2/2  
  **Why:** On a sustained slow/flaky network at submit time the student cannot submit, the message lies about local safety, and closing the tab loses the last section's answers — blocks completion, one of the worst outcomes in the brief.  
  **Fix:** Persist the full answer set to Redis via savePartialAnswers (sendBeacon) before/along with submit so a re-open can restore everything. Replace the false message; offer a persistent idempotency-keyed 'Retry submit' control.

- **[MEDIUM]** Question status grid recomputes all colors on every interaction; memoized QuestionNavigationGrid is bypassed entirely  
  `src/components/QuestionNavigationGrid.tsx:16-55` · votes 2/2  
  **Why:** Janky typing/selection and slow navigation on low-end Android across the full assessment: the entire status grid recomputes on every interaction. The memo optimization exists but is dead.  
  **Fix:** Use QuestionNavigationGrid (or memoize the inline grid). Precompute a color map via useMemo keyed by the answer maps into a plain Record<key,color> the grid reads by lookup, instead of calling a changing callback per cell.

- **[MEDIUM]** Partial-restore hydration replaces (not merges) fresh answers on slow networks and mis-maps text answers positionally  
  `src/pages/SectionQuestionPage.tsx:412-462, 433-446` · votes 2/2  
  **Why:** Restored text answers can land in wrong boxes or appear missing; and a slow restore that resolves after the student begins re-answering overwrites freshly entered data on resume over slow 4G.  
  **Fix:** Merge restored state into existing state (only fill keys not already set). Preserve the original input index for text answers in the partial payload instead of reconstructing positionally. No-op the restore if the student already modified state.

- **[MEDIUM]** Game completion uses stale qId/question from closure; a missed option store omits the completed game from the scored submission  
  `src/pages/SectionQuestionPage.tsx:1356-1405, 1367-1369, 731-746` · votes 1/2  
  **Why:** A completed game can be omitted from the scored submission (green in UI, absent in payload) when qId is stale or the option lookup fails, silently zeroing that question's score. Affects game-based sections.  
  **Fix:** Capture qId/question into refs at launch time and use them in handleGameComplete. Include completed games in generateSubmissionJSON via completedGames (map gameCode→optionId across the questionnaire) so a completed game is always submitted even if `answers` missed it.

- **[LOW]** elapsedTime is a global wall-clock initialized from localStorage with no per-assessment scoping  
  `src/pages/SectionQuestionPage.tsx:191-194, 511-517` · votes 1/2  
  **Why:** Misleading/inflated timer value when stale assessmentElapsedTime survives across sessions. Display only; low impact.  
  **Fix:** Scope elapsedTime to assessmentId and reset it when the active assessment changes, or stop persisting it across sessions.



### state-persistence-offline

- **[CRITICAL]** Partial-restore async callback clobbers answers the student already entered (data loss on slow 4G)  
  `src/pages/SectionQuestionPage.tsx:368-462` · votes 2/2  
  **Why:** Student loses answers entered during the restore window on a resumed/ongoing assessment over slow 4G — exactly the worst-outcome (b) answer loss. Most likely on the resume path where a snapshot exists and the network is slow.  
  **Fix:** Merge instead of replace, and bail if the user already interacted: capture a 'dirty' ref set true on first answer/text/ranking change; in the .then, if dirty, skip the setState calls entirely, OR deep-merge hydrated values into the functional updater (setAnswers(prev => mergeNonE…

- **[HIGH]** savePartialAnswers fire-and-forget swallows all failures with no retry — section-boundary snapshots silently lost  
  `src/api/assessmentApi.ts:13-28` · votes 2/2  
  **Why:** On a mid-assessment tab crash/reload after a failed save-partial, the student's resume snapshot is stale by one-or-more sections; they redo work. Combined with the 'Redis-only, no localStorage' design this is real data loss, not just degraded UX.  
  **Fix:** Add bounded retry with backoff (mirror http.ts policy) inside savePartialAnswers, OR route it through the http instance which already retries network/5xx; additionally keep a localStorage mirror of the answer maps as a last-resort durable fallback so a swallowed save-partial does…

- **[MEDIUM]** useDebouncedLocalStorage quota-eviction deletes legitimate assessment progress keys to free space  
  `src/hooks/useDebouncedLocalStorage.ts:12-36` · votes 2/2  
  **Why:** On low-storage devices, persisting one progress key can destroy other progress keys, corrupting resume; a throw mid-flush loses queued writes permanently.  
  **Fix:** Only evict genuinely disposable caches (e.g. assessmentSeenSectionInstructions), never the saved-for-later/skipped/completed-games progress keys; restore unwritten entries back into pendingWrites on failure so they retry.

- **[MEDIUM]** ResourcePreloader caches truncated/partial downloads as complete and never re-validates — poisons offline cache for the build  
  `src/components/ResourcePreloader.tsx:130-160,214-232` · votes 1/2  
  **Why:** A single truncated download during preload permanently poisons that resource in the Cache API, so offline/slow-4G students never get the cached copy and always pay the network cost (or fail when fully offline).  
  **Fix:** Validate downloaded byte count against resource.size / Content-Length before cache.put and skip caching on mismatch; in tryStaticCache, cache.delete(url) when JSON parse fails so the entry can be re-fetched.

- **[MEDIUM]** DataContext game saves have no offline queue/retry and isSaving is a shared flag corrupted by concurrent saves  
  `src/contexts/DataContext.tsx:84-151` · votes 2/2  
  **Why:** Game (psychometric) results silently lost on flaky network with no retry; isSaving flicker can let UI proceed before a save completes.  
  **Fix:** Enable Firestore offline persistence so writes queue and sync when back online; add bounded retry; replace the single isSaving boolean with a per-game flag/counter; surface failure with a retry.

- **[LOW]** preloadAssessmentData is dead code and its prefetch-await short-circuit can never fire; full payload always loads synchronously on the Start click  
  `src/contexts/AssessmentContext.tsx:201-222` · votes 1/2  
  **Why:** The 'preload before Start' optimization is non-functional, so on slow 4G the Start click blocks on the full (potentially multi-MB base64) payload download with only a spinner; students perceive a freeze.  
  **Fix:** Either remove dead preloadAssessmentData, or actually call it (e.g. on assessment-list render/hover) and fix it to set cachedAssessmentIdRef so the short-circuit works; pre-warm the full payload after a successful mint.

- **[LOW]** Hydration effect desyncs the three sessionStorage keys when one is corrupted, leaving data-without-config in memory  
  `src/contexts/AssessmentContext.tsx:361-388` · votes 1/2  
  **Why:** A single corrupted sessionStorage entry yields an inconsistent in-memory state until re-fetch, silently flipping timer/save-for-later behavior.  
  **Fix:** Hydrate the three keys atomically: parse all three, and if any fails, clear all three and skip hydration so the page goes through a clean fetch.

- **[LOW]** fetchAssessmentData blocks on the unrelated login-page prefetch list call, inflating Start-assessment latency on slow 4G  
  `src/contexts/AssessmentContext.tsx:334-345` · votes 1/2  
  **Why:** Start-assessment latency on slow 4G is inflated by however long the unrelated prefetch list call takes to settle.  
  **Fix:** Remove the prefetch await from fetchAssessmentData (it consumes nothing the prefetch produces); the analogous await in preload (line 208) is similarly unnecessary unless preload is fixed to consume prefetch output.



