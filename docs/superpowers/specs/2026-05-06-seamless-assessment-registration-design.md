# Seamless Assessment Registration → Auto-Login

**Date:** 2026-05-06
**Status:** Approved (design)
**Owner:** Dhruv Sharma

## Goal (one sentence)

Student registers via any link (dashboard-generated or assessment-direct), and on success — free, paid, or already-registered — they land directly on `/allotted-assessment` without re-entering credentials, by hosting the registration page on the assessment domain so localStorage works same-origin and the backend returns the session payload inline.

## Why

Today the flow is:

1. Student opens `dashboard.career-9.com/assessment-register/<token>` (or `assessment.career-9.com/assessment-register/<token>` — both pages exist).
2. Submits form, backend creates account, returns `{ username, dob }`.
3. Page shows credentials card with "Go to Student Login" button.
4. Student manually opens `assessment.career-9.com/student-login`, types username + DOB.
5. Backend issues `userStudentId` + assessment list, page navigates to `/allotted-assessment`.

Steps 3–4 are pure friction. Cross-domain localStorage prevented straight redirection, and two parallel registration pages drift over time.

## Approach

Selected: **Inline session in registration response.**

- Unify the public registration page on the assessment domain (same-origin with `student-login` and `allotted-assessment`).
- Backend returns the session payload (`userStudentId`, `assessments`) in the existing register endpoint's success responses and in the payment-status webhook polling response when status flips to `paid`.
- Frontend writes localStorage and navigates — same shape `/user/auth` writes today.

Rejected:

- **Frontend chains register → /user/auth.** Two round-trips, awkward race window, ugly for paid flow.
- **Short-lived login token.** Right design for cross-domain, but YAGNI once we go same-origin.

## Scope of changes

### Assessment domain (`career-nine-assessment`) — gains

- `pages/AssessmentRegisterPage.tsx` overwritten with the dashboard's version (porting adjustments below).
- New `pages/PaymentStatusPage.tsx` ported from the dashboard.
- New `api-clients/promoCodeAPI.ts`.
- New `utils/toast.ts` (verbatim copy of dashboard's `react-toastify` wrapper).
- `App.tsx`: mount `<ToastContainer />` at the BrowserRouter root; add `/payment-status` route.
- `package.json`: add `react-toastify@^11.0.5`.

### Porting adjustments (mechanical, applied during copy)

| Dashboard (source) | Assessment domain (target) |
|---|---|
| `import axios from "axios"` + `process.env.REACT_APP_API_URL` | reuse `src/api/http.ts` + `import.meta.env.VITE_API_URL` |
| `import { showErrorToast } from '../../utils/toast'` | new local `src/utils/toast.ts` |
| `import { validatePromoCode } from "../PromoCode/API/PromoCode_APIs"` | new `src/api-clients/promoCodeAPI.ts` |
| `import { ... } from "../AssessmentMapping/API/AssessmentMapping_APIs"` | existing `src/api-clients/assessmentMappingAPI.ts` |
| Success-screen redirect to `REACT_APP_STUDENT_LOGIN_URL` | replaced with auto-login + `navigate('/allotted-assessment')` |

### Dashboard (`react-social`) — soft retirement (no deletion)

- `pages/AssessmentRegister/AssessmentRegisterPage.tsx` → renamed `AssessmentRegisterPageOld.tsx`. File stays in repo, no imports.
- `pages/PaymentTracking/PaymentStatusPage.tsx` → renamed `PaymentStatusPageOld.tsx`. Same treatment.
- `AppRoutes.tsx`: lazy imports for both pages removed; route paths `/assessment-register/:token` and `/payment-status` replaced with inline redirect components that forward to `${ASSESSMENT_DOMAIN}/...` preserving query string.
- Admin UI in `pages/AssessmentMapping/*` that constructs the registration URL → points at assessment domain via `process.env.REACT_APP_ASSESSMENT_DOMAIN`.
- `staging.env` and `production.env`: add `REACT_APP_ASSESSMENT_DOMAIN`.

### Backend (`spring-social`) — changes

- Extract `buildSessionPayload(Long userStudentId)` helper from `UserController.checkUser` (lines 110–137). Returns `{ userStudentId, assessments: [{ assessmentId, studentStatus, assessmentName, isActive }, ...] }`. `UserController.checkUser` is refactored to delegate to it (behavior preserved exactly).
- `AssessmentInstituteMappingController.registerStudentByToken`:
  - Tighten the email-duplicate check (around line 329): when an email match is found in the institute, also verify the submitted DOB matches the stored `studentDob`. If mismatch, return 400: *"This email is already registered with a different date of birth. If this is your account, please use your registered date of birth."*
  - Three success paths now include the session payload merged into the response: fresh free registration (line ~419), `handleExistingStudent` (line ~526), `handleExistingStudentWithPayment` already-mapped branch (line ~507).
  - The `payment_required` response (line ~480) does **not** include session — student doesn't exist yet.
- `PaymentTransaction` model: add nullable `userStudentId` column. Stamped after student creation in the post-payment handler. Hibernate `ddl-auto: update` handles the schema change.
- `/payment/webhook/status/{linkId}` (PaymentController): when `status = "paid"` and `transaction.userStudentId != null`, merge session payload into response.
- `app.razorpay.callback-base-url` flipped per profile:
  - dev: `http://localhost:5173`
  - staging: staging assessment domain (separate subdomain)
  - production: `https://assessment.career-9.com`

### Out of scope

- `/user/auth` endpoint signature.
- `User`/`StudentInfo`/`UserStudent`/`StudentAssessmentMapping` entities.
- JWT/auth model (still no real session — localStorage carries `userStudentId`, same as today).
- `/assessment-mapping/public/info/{token}` (the prefill GET).
- `StudentLoginPage`, `AllottedAssessmentPage` — unchanged.

## User flows

### A — Free registration, brand new student

```
Student → assessment.career-9.com/assessment-register/<token>
       → submit form
       → backend creates User/StudentInfo/UserStudent/StudentAssessmentMapping,
         returns { status: "success", username, dob, userStudentId, assessments }
       → page writes localStorage, navigate('/allotted-assessment')
```

### B — Free registration, returning student (DOB matches)

```
Student → submit form with email already in DB, DOB matches
       → backend handleExistingStudent: maps assessment if missing,
         returns { status: "already_registered", userStudentId, assessments }
       → same auto-login → /allotted-assessment
```

### C — Email exists with DIFFERENT DOB (impersonation block)

```
Student → submit form with email match but DOB mismatch
       → backend returns 400 with explanation
       → showErrorToast, form stays for retry
```

### D — Paid registration, brand new student

```
Student → submit form on paid mapping
       → backend creates Razorpay link, PaymentTransaction (userStudentId = NULL)
       → returns { status: "payment_required", paymentUrl }
       → window.location.href = paymentUrl
       → student pays
       → Razorpay → assessment.career-9.com/payment-status?razorpay_payment_link_id=...
       → PaymentStatusPage polls /payment/webhook/status/<linkId> every 2s (max 15)
       → backend webhook: payment captured → creates student + mapping,
         stamps PaymentTransaction.userStudentId
       → poll receives { status: "paid", userStudentId, assessments }
       → page shows "Payment Successful!" splash for 1.5s
       → localStorage write, navigate('/allotted-assessment')
```

### E — Paid registration with 100% promo

Falls through fresh-registration branch (no Razorpay round-trip), same as Flow A.

### F — Paid registration with partial-discount promo

Same as Flow D, payment link is for discounted amount.

### G — Old dashboard link clicked (live link from before rollout)

```
Student → dashboard.career-9.com/assessment-register/<token>
       → RedirectAssessmentRegister: window.location.replace(
           assessment.career-9.com/assessment-register/<token>)
       → resumes Flow A/B/C/D
```

### H — In-flight Razorpay payment redirects to old dashboard URL

```
Razorpay → dashboard.career-9.com/payment-status?razorpay_payment_link_id=...
       → RedirectPaymentStatus: assessment.career-9.com/payment-status
         ?razorpay_payment_link_id=... (query string preserved)
       → resumes Flow D from polling
```

### I — Returning student on a new device (no registration link)

Unchanged. `/student-login` → `/user/auth` → `/allotted-assessment`.

### J — Backend deployed, assessment FE not yet deployed

Backend returns extra fields. Old dashboard register page ignores them — credentials card still shown. Zero user-visible change. Safe.

## Edge cases

| # | Case | Handling |
|---|---|---|
| 1 | Email + different DOB | 400 with explanation, toast, retry |
| 2 | Already-registered, already-mapped | Returns session, auto-login |
| 3 | Already-registered, not yet mapped | Adds mapping, returns session, auto-login |
| 4 | Paid: tab closed before paying | New payment link on retry; old expires per Razorpay TTL |
| 5 | Paid: webhook slow, `paid` arrives but no `userStudentId` yet | Keep polling — don't navigate without session |
| 6 | Paid: max polls exhausted with `paid` but no `userStudentId` | Show existing "verifying"/"error" UI; email already sent with credentials |
| 7 | Old dashboard register link | §G redirect |
| 8 | Old dashboard payment-status callback | §H redirect |
| 9 | Free reg backend response missing session | Defensive fallback: render existing credentials card |
| 10 | 100%-promo path | Falls through fresh-registration, session included |
| 11 | mappingLevel SESSION/CLASS/SECTION | Class/section selection logic ports verbatim |
| 12 | Stale localStorage on returning user | `localStorage.clear()` before write (matches `StudentLoginPage`) |
| 13 | User reopens registration page mid-assessment | Clears localStorage same as `StudentLoginPage` would; not a new failure mode |
| 14 | ToastContainer not visible on first load | Mounted at BrowserRouter root, renders before any page |

## Deploy order (immutable)

1. **Backend.** Ship: register endpoint returning session, payment-status returning session on `paid`, `userStudentId` stamp on `PaymentTransaction`, email-DOB tightening. Additive — old frontends ignore new fields.
2. **Assessment frontend.** Ship: new register page, payment-status page, toast, route.
3. **Dashboard frontend.** Ship: redirect components, admin-UI link-URL change, env vars.
4. **Razorpay config flip.** Update `callback-base-url` per profile, restart backend.

Each step is independently safe; no flag day required. Steps can run hours/days apart.

## Backwards compatibility

- Live registration links pointing at dashboard: handled by §G redirect (kept indefinitely; nine lines of code).
- In-flight Razorpay payment links pointing at dashboard: handled by §H redirect; cannot be removed for at least the lifetime of the longest-lived outstanding payment link.
- Hibernate `ddl-auto: update` adds `PaymentTransaction.userStudentId` column. Old rows have NULL; payment-status endpoint only reads it for `paid` status arriving after the deploy.

## Rollback

- Frontend: revert deploys in reverse order (#3 → #2). Dashboard pages revived by un-renaming `*Old.tsx` files and restoring imports.
- Backend: rollback safe — additive response fields.
- `userStudentId` column on `PaymentTransaction`: harmless if left in place during a rollback.

## Testing approach

- Backend: unit test `buildSessionPayload`; integration test `registerStudentByToken` happy paths (fresh free, fresh paid, already-registered with DOB match, already-registered with DOB mismatch, 100% promo); integration test `/payment/webhook/status/{linkId}` returns session when transaction has `userStudentId`.
- Assessment frontend: manual smoke test all 9 flows (A–I) on staging before production. No automated FE tests exist in this codebase per CLAUDE.md.
- Dashboard frontend: manual smoke test redirect components; admin UI link generation.

## Open questions resolved during brainstorming

- Q: Which registration outcomes auto-login? **A: All (free, paid, already-registered).**
- Q: How to handle email-match impersonation risk? **A: Tighten duplicate check to require DOB match.**
- Q: Cross-domain auth strategy? **A: Move registration to assessment domain — same-origin, no cross-domain auth needed.**
- Q: Toast on assessment domain or `alert()`? **A: Add `react-toastify`, port `utils/toast.ts`.**
- Q: Modify existing register page or copy from dashboard? **A: Copy, port adjustments only.**
- Q: Delete dashboard register/payment-status pages? **A: Soft-retire — rename `*Old.tsx`, drop imports.**
- Q: Track student on `PaymentTransaction` via stamp or email lookup? **A: Stamp `userStudentId` column.**
