# Seamless Assessment Registration → Auto-Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Student registers via any link and lands directly on `/allotted-assessment` without re-entering credentials, by hosting the registration page on the assessment domain so localStorage works same-origin and the backend returns the session payload inline.

**Architecture:** Backend register endpoint and payment-status endpoint extended to return `{ userStudentId, assessments }` inline. Public registration page is moved to the assessment domain (same origin as login/allotted-assessment), where it writes localStorage and navigates directly. Dashboard's old register/payment-status pages are soft-retired and replaced by redirect routes that forward live links to the assessment domain.

**Tech Stack:** Spring Boot 2.5.5 / Java 11 (backend), React 19 + Vite + TypeScript (assessment domain), React 18 + CRA + TypeScript (dashboard).

**Reference spec:** `docs/superpowers/specs/2026-05-06-seamless-assessment-registration-design.md`.

**Testing posture:** The codebase has no controller-level unit/integration test infrastructure (only one load test under `src/test/.../loadtest/`). TDD ceremony would create code with no place to run. Verification for backend tasks is **manual smoke testing on staging via curl/Postman** at the Phase 1 checkpoint. CLAUDE.md forbids running `npm run build`/`tsc` on frontend, so frontend verification is also **manual smoke testing on staging** at the Phase 2 and Phase 3 checkpoints. Each task still ships a single focused commit so rollback is granular.

**Deploy order is part of the plan.** Phases must ship in order: backend (#1) → assessment FE (#2) → dashboard FE (#3) → Razorpay config flip (#4). Each phase is independently safe; no flag day required. A staging smoke test gate sits between phases.

---

## Phase 1 — Backend

### Task 1: Extract `buildSessionPayload` helper

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/StudentSessionService.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/UserController.java:102-144`

**Why:** Three call sites need the `{ userStudentId, assessments: [...] }` payload that `UserController.checkUser` currently builds inline (login + new register success + new payment-status success). DRY before duplicating it.

- [ ] **Step 1: Create the service**

```java
// spring-social/src/main/java/com/kccitm/api/service/StudentSessionService.java
package com.kccitm.api.service;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.StudentAssessmentMappingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class StudentSessionService {

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    /**
     * Returns { userStudentId, assessments: [{ assessmentId, studentStatus, assessmentName, isActive }, ...] }
     * — same shape /user/auth returns. Used by login, registration auto-login, and post-payment auto-login.
     */
    public Map<String, Object> buildSessionPayload(Long userStudentId) {
        List<StudentAssessmentMapping> mappings =
                studentAssessmentMappingRepository.findByUserStudentUserStudentId(userStudentId);

        List<Map<String, Object>> assessmentsList = new ArrayList<>();
        for (StudentAssessmentMapping mapping : mappings) {
            Map<String, Object> info = new HashMap<>();
            info.put("assessmentId", mapping.getAssessmentId());
            info.put("studentStatus", mapping.getStatus());

            Optional<AssessmentTable> assessment =
                    assessmentTableRepository.findById(mapping.getAssessmentId());
            if (assessment.isPresent()) {
                info.put("assessmentName", assessment.get().getAssessmentName());
                info.put("isActive", assessment.get().getIsActive());
            } else {
                info.put("assessmentName", "Unknown Assessment");
                info.put("isActive", false);
            }
            assessmentsList.add(info);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("userStudentId", userStudentId);
        response.put("assessments", assessmentsList);
        return response;
    }
}
```

- [ ] **Step 2: Refactor `UserController.checkUser` to delegate**

In `UserController.java`, add:

```java
@Autowired
private com.kccitm.api.service.StudentSessionService studentSessionService;
```

Replace the `assessmentsList` building block (lines 110-137) inside the `if (userStudentRepository.getByUserId(user.getId()).isPresent())` branch so the method body becomes:

```java
@PostMapping(value = "user/auth", headers = "Accept=application/json")
public HashMap<String, Object> checkUser(@RequestBody User currentUser) {
    if (userRepository.findByUsernameAndDobDate(currentUser.getUsername(), currentUser.getDobDate()).isPresent()) {
        User user = userRepository.findByUsernameAndDobDate(currentUser.getUsername(), currentUser.getDobDate()).get();
        if (userStudentRepository.getByUserId(user.getId()).isPresent()) {
            UserStudent userStudent = userStudentRepository.getByUserId(user.getId()).get();
            return new HashMap<>(studentSessionService.buildSessionPayload(userStudent.getUserStudentId()));
        } else {
            return null;
        }
    } else {
        return null;
    }
}
```

- [ ] **Step 3: Smoke test**

Manually verify `/user/auth` still returns the same shape it did before:

```bash
curl -X POST http://localhost:8091/user/auth \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"username":"<known-username>","dobDate":"<dd-MM-yyyy>"}'
```

Expected: `{ "userStudentId": <number>, "assessments": [...] }`. Same fields and types as before the refactor.

- [ ] **Step 4: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/service/StudentSessionService.java \
        spring-social/src/main/java/com/kccitm/api/controller/UserController.java
git commit -m "refactor: extract StudentSessionService.buildSessionPayload from UserController.checkUser"
```

---

### Task 2: Tighten email-DOB duplicate check in registration

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentInstituteMappingController.java:328-338`

**Why:** Today the email-duplicate branch auto-accepts any submitted DOB. Once we expose auto-login on the already-registered path (Task 4), an attacker with the registration link could log in as a classmate by submitting only their email. Require DOB match before treating the submission as legitimate.

- [ ] **Step 1: Add DOB-match guard before delegating to existing-student handlers**

Replace the email-duplicate block (around line 328-338, the `// 6. Duplicate check by EMAIL` section) with:

```java
// 6. Duplicate check by EMAIL
List<StudentInfo> byEmail = studentInfoRepository.findByEmailAndInstituteId(email, instituteCode);
if (!byEmail.isEmpty()) {
    StudentInfo existing = byEmail.get(0);

    // Require DOB match before accepting — prevents impersonation now that
    // the registered-student path can return a session token.
    Date existingDob = existing.getStudentDob();
    if (existingDob == null || !sameDay(existingDob, dob)) {
        return ResponseEntity.badRequest().body(Map.of(
                "status", "error",
                "message", "This email is already registered with a different date of birth. " +
                        "If this is your account, please use your registered date of birth."));
    }

    if (paymentRequired && finalAmount > 0) {
        return handleExistingStudentWithPayment(existing, assessmentId, instituteCode,
                mapping.getMappingId(), finalAmount, originalAmount, promoCodeStr, promoDiscountPercent,
                name, email, dob, phone);
    }
    return handleExistingStudent(existing, assessmentId, instituteCode);
}
```

Then add this private helper at the bottom of the class (next to other private helpers):

```java
private static boolean sameDay(Date a, Date b) {
    if (a == null || b == null) return false;
    java.util.Calendar ca = java.util.Calendar.getInstance();
    java.util.Calendar cb = java.util.Calendar.getInstance();
    ca.setTime(a);
    cb.setTime(b);
    return ca.get(java.util.Calendar.YEAR) == cb.get(java.util.Calendar.YEAR)
        && ca.get(java.util.Calendar.MONTH) == cb.get(java.util.Calendar.MONTH)
        && ca.get(java.util.Calendar.DAY_OF_MONTH) == cb.get(java.util.Calendar.DAY_OF_MONTH);
}
```

(Day-level comparison avoids time-of-day mismatches in stored vs submitted DOB.)

- [ ] **Step 2: Smoke test**

```bash
# Pre-existing student with email "test@example.com" and DOB 01-01-2008.

# Same DOB — should succeed (returns "already_registered" with session in Task 4)
curl -X POST http://localhost:8091/assessment-mapping/public/register/<token> \
  -H "Content-Type: application/json" \
  -d '{"name":"X","email":"test@example.com","dob":"01-01-2008","phone":"","gender":""}'

# Wrong DOB — should return 400 with message about different date of birth
curl -X POST http://localhost:8091/assessment-mapping/public/register/<token> \
  -H "Content-Type: application/json" \
  -d '{"name":"X","email":"test@example.com","dob":"15-06-2010","phone":"","gender":""}'
```

Expected: 200 then 400 with `"This email is already registered with a different date of birth..."`.

- [ ] **Step 3: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentInstituteMappingController.java
git commit -m "fix: require DOB match on email-duplicate registration path"
```

---

### Task 3: Add session payload to registration success responses

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentInstituteMappingController.java`

**Why:** The frontend can only auto-login if the register endpoint hands back the same payload `/user/auth` returns. Three success paths need it.

- [ ] **Step 1: Inject `StudentSessionService`**

At the top of `AssessmentInstituteMappingController`, with the other `@Autowired` fields, add:

```java
@Autowired
private com.kccitm.api.service.StudentSessionService studentSessionService;
```

- [ ] **Step 2: Fresh free-registration path returns session**

Find the success response near line 419 (right after `studentAssessmentMappingRepository.save(sam);`). Replace the response-building block with:

```java
// Build response (auto-login session merged in)
Map<String, Object> response = new HashMap<>();
response.put("status", "success");
response.put("message", "Registration successful! Please save your login credentials.");
response.put("username", user.getUsername());
response.put("dob", dobStr);
response.putAll(studentSessionService.buildSessionPayload(userStudent.getUserStudentId()));

// Send registration email with credentials
String assessmentName = assessmentTableRepository.findById(assessmentId)
        .map(a -> a.getAssessmentName()).orElse("Assessment");
sendRegistrationEmail(email, name, user.getUsername(), dobStr, assessmentName);

return ResponseEntity.ok(response);
```

- [ ] **Step 3: `handleExistingStudent` returns session**

Find `private ResponseEntity<?> handleExistingStudent(...)` (around line 526). After the existing student is mapped to the assessment and the response map is being built, before the final `return ResponseEntity.ok(response);`, merge the session payload in. Locate the response-building code at the end of the method and adapt it. The end of the method currently looks something like:

```java
Map<String, Object> response = new HashMap<>();
response.put("status", "already_registered");
response.put("message", "...");
return ResponseEntity.ok(response);
```

Change to:

```java
Map<String, Object> response = new HashMap<>();
response.put("status", "already_registered");
response.put("message", "You are already registered for this assessment.");
response.putAll(studentSessionService.buildSessionPayload(userStudent.getUserStudentId()));
return ResponseEntity.ok(response);
```

(The variable name `userStudent` reflects what the existing method already builds; adapt to match whatever `UserStudent` reference the method has in scope when constructing the response.)

- [ ] **Step 4: `handleExistingStudentWithPayment` already-mapped branch returns session**

In `handleExistingStudentWithPayment` (around line 496), the early-return for the already-mapped case (line ~507-513) currently looks like:

```java
if (existingMapping.isPresent()) {
    Map<String, Object> response = new HashMap<>();
    response.put("status", "already_registered");
    response.put("message", "You are already registered for this assessment.");
    return ResponseEntity.ok(response);
}
```

Change to:

```java
if (existingMapping.isPresent()) {
    Map<String, Object> response = new HashMap<>();
    response.put("status", "already_registered");
    response.put("message", "You are already registered for this assessment.");
    response.putAll(studentSessionService.buildSessionPayload(userStudent.getUserStudentId()));
    return ResponseEntity.ok(response);
}
```

The `userStudent` variable already exists in scope at this point — it's the result of `userStudents.get(0)` two lines up.

- [ ] **Step 5: Smoke test**

```bash
# Fresh registration — verify userStudentId + assessments in response
curl -X POST http://localhost:8091/assessment-mapping/public/register/<free-token> \
  -H "Content-Type: application/json" \
  -d '{"name":"Test1","email":"test1@example.com","dob":"01-01-2010","phone":"","gender":"Male"}'
# Expected JSON keys: status, message, username, dob, userStudentId, assessments

# Re-submit same email + DOB — verify already_registered branch also returns session
curl -X POST http://localhost:8091/assessment-mapping/public/register/<free-token> \
  -H "Content-Type: application/json" \
  -d '{"name":"Test1","email":"test1@example.com","dob":"01-01-2010","phone":"","gender":"Male"}'
# Expected JSON keys: status=already_registered, message, userStudentId, assessments
```

- [ ] **Step 6: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentInstituteMappingController.java
git commit -m "feat: include session payload in registration success responses"
```

---

### Task 4: Add session payload to payment-status endpoint

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/PaymentWebhookController.java:126-151`

**Why:** Payment flow is async — student doesn't exist when register endpoint returns `payment_required`. The frontend polls `/payment/webhook/status/{linkId}` until `status === paid`. At that point we hand back the session so the page can auto-login. `userStudentId` is **already** stamped onto `PaymentTransaction` after student creation (see lines 345, 523, 576), so this is purely a response-shape change.

- [ ] **Step 1: Inject `StudentSessionService`**

At the top of `PaymentWebhookController`, with the other `@Autowired` fields, add:

```java
@Autowired
private com.kccitm.api.service.StudentSessionService studentSessionService;
```

- [ ] **Step 2: Merge session payload into `getPaymentStatus` response when paid**

Replace `getPaymentStatus` (lines 126-151) with:

```java
@GetMapping("/status/{razorpayLinkId}")
public ResponseEntity<?> getPaymentStatus(@PathVariable String razorpayLinkId) {
    Optional<PaymentTransaction> txnOpt = paymentTransactionRepository
            .findByRazorpayLinkId(razorpayLinkId);

    if (!txnOpt.isPresent()) {
        return ResponseEntity.notFound().build();
    }

    PaymentTransaction txn = txnOpt.get();
    Map<String, Object> response = new HashMap<>();
    response.put("status", txn.getStatus());
    response.put("amount", txn.getAmount() / 100);
    response.put("transactionId", txn.getTransactionId());
    response.put("assessmentId", txn.getAssessmentId());

    String assessmentName = assessmentTableRepository.findById(txn.getAssessmentId())
            .map(a -> a.getAssessmentName()).orElse("Assessment");
    response.put("assessmentName", assessmentName);

    if ("failed".equals(txn.getStatus()) && txn.getFailureReason() != null) {
        response.put("failureReason", txn.getFailureReason());
    }

    // Auto-login: when status flipped to paid AND student has been created
    // (provisioning may lag the status update by a few hundred ms), include
    // the session payload so the frontend can write localStorage and redirect.
    // If userStudentId is null at this moment, the frontend keeps polling.
    if ("paid".equals(txn.getStatus()) && txn.getUserStudentId() != null) {
        response.putAll(studentSessionService.buildSessionPayload(txn.getUserStudentId()));
    }

    return ResponseEntity.ok(response);
}
```

- [ ] **Step 3: Smoke test**

Find a `PaymentTransaction` row that's already `paid` and has a non-null `userStudentId`:

```bash
# Get any paid transaction's razorpay link id from the DB:
mysql -h localhost -u root -pCareer-qCsfeuECc3MW kareer-9 -e \
  "SELECT razorpay_link_id FROM payment_transaction WHERE status='paid' AND user_student_id IS NOT NULL LIMIT 1;"

# Hit the endpoint:
curl http://localhost:8091/payment/webhook/status/<that-link-id>
```

Expected response includes `userStudentId` and `assessments`.

For an in-flight transaction (still `created`), the response should NOT contain `userStudentId`/`assessments` — it should look exactly like before this change.

- [ ] **Step 4: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/controller/career9/PaymentWebhookController.java
git commit -m "feat: include session payload in payment-status when paid"
```

---

### Phase 1 staging gate

Before starting Phase 2, deploy backend to staging and verify all four smoke-test commands above succeed against the staging database. Old frontends ignore the new fields, so this deploy is invisible to users — safe to ship independently.

---

## Phase 2 — Assessment Frontend (depends on Phase 1 deployed)

### Task 5: Add `react-toastify` dependency

**Files:**
- Modify: `career-nine-assessment/package.json`

- [ ] **Step 1: Add the dependency**

In `package.json`, in the `"dependencies"` block (currently lines 15-23), add a `react-toastify` entry alphabetically:

```json
"dependencies": {
    "@mediapipe/tasks-vision": "^0.10.22",
    "axios": "^1.13.5",
    "bootstrap": "^5.3.8",
    "firebase": "^12.9.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^6.30.3",
    "react-toastify": "^11.0.5",
    "webgazer": "^3.4.0"
}
```

- [ ] **Step 2: Install**

```bash
cd career-nine-assessment && npm install
```

Expected: `react-toastify` added to `node_modules`. (CLAUDE.md forbids running `npm run build`/`tsc` — do not run those.)

- [ ] **Step 3: Commit**

```bash
git add career-nine-assessment/package.json career-nine-assessment/package-lock.json
git commit -m "chore: add react-toastify to assessment domain"
```

---

### Task 6: Create `utils/toast.ts` and `api-clients/promoCodeAPI.ts`

**Files:**
- Create: `career-nine-assessment/src/utils/toast.ts`
- Create: `career-nine-assessment/src/api-clients/promoCodeAPI.ts`

**Why:** The ported register page imports `showErrorToast` and `validatePromoCode`. These are local utilities that mirror the dashboard's, adapted to the assessment domain's `http` instance.

- [ ] **Step 1: Create `utils/toast.ts`**

```typescript
// career-nine-assessment/src/utils/toast.ts
import { toast } from 'react-toastify'

export const showErrorToast = (message: string) => {
  toast.error(message, {
    position: 'top-right',
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
  })
}

export const showSuccessToast = (message: string) => {
  toast.success(message, {
    position: 'top-right',
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
  })
}

export const showWarningToast = (message: string) => {
  toast.warn(message, {
    position: 'top-right',
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
  })
}
```

- [ ] **Step 2: Create `api-clients/promoCodeAPI.ts`**

The backend endpoint is `POST /promo-codes/public/validate` with body `{ code }` (verified in `PromoCodeController.java:142`).

```typescript
// career-nine-assessment/src/api-clients/promoCodeAPI.ts
import http from '../api/http'

export function validatePromoCode(code: string) {
  return http.post('/promo-codes/public/validate', { code })
}
```

- [ ] **Step 3: Commit**

```bash
git add career-nine-assessment/src/utils/toast.ts \
        career-nine-assessment/src/api-clients/promoCodeAPI.ts
git commit -m "feat: add toast util and promo-code API client to assessment domain"
```

---

### Task 7: Mount `<ToastContainer />` and add `/payment-status` route in `App.tsx`

**Files:**
- Modify: `career-nine-assessment/src/App.tsx`

- [ ] **Step 1: Add imports and mount the container, register the route**

Replace `App.tsx` with:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { DataProvider } from './contexts/DataContext'
import { AssessmentProvider } from './contexts/AssessmentContext'

import StudentLoginPage from './pages/StudentLoginPage'
import DemographicDetailsPage from './pages/DemographicDetailsPage'
import AllottedAssessmentPage from './pages/AllottedAssessmentPage'
import GeneralInstructionsPage from './pages/GeneralInstructionsPage'
import ThankYouPage from './pages/ThankYouPage'
import AssessmentRegisterPage from './pages/AssessmentRegisterPage'
import PaymentStatusPage from './pages/PaymentStatusPage'

const SelectSectionPage = lazy(() => import('./pages/SelectSectionPage'))
const SectionInstructionPage = lazy(() => import('./pages/SectionInstructionPage'))
const SectionQuestionPage = lazy(() => import('./pages/SectionQuestionPage'))

const LoadingSpinner = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  </div>
)

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <DataProvider>
        <AssessmentProvider>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Navigate to="/student-login" replace />} />
              <Route path="/student-login" element={<StudentLoginPage />} />
              <Route path="/demographics/:assessmentId" element={<DemographicDetailsPage />} />
              <Route path="/allotted-assessment" element={<AllottedAssessmentPage />} />
              <Route path="/general-instructions" element={<GeneralInstructionsPage />} />
              <Route path="/studentAssessment" element={<SelectSectionPage />} />
              <Route path="/studentAssessment/sections/:sectionId" element={<SectionInstructionPage />} />
              <Route path="/studentAssessment/sections/:sectionId/questions/:questionIndex" element={<SectionQuestionPage />} />
              <Route path="/studentAssessment/completed" element={<ThankYouPage />} />
              <Route path="/assessment-register/:token" element={<AssessmentRegisterPage />} />
              <Route path="/payment-status" element={<PaymentStatusPage />} />
              <Route path="*" element={<Navigate to="/student-login" replace />} />
            </Routes>
          </Suspense>
        </AssessmentProvider>
      </DataProvider>
    </BrowserRouter>
  )
}
```

(`PaymentStatusPage` doesn't exist yet — Task 9 creates it. We register the route now so Task 9's smoke test can verify the route resolves.)

- [ ] **Step 2: Commit**

```bash
git add career-nine-assessment/src/App.tsx
git commit -m "feat: mount ToastContainer and register /payment-status route in assessment app"
```

(The build will not compile until Task 9 lands. That's fine — we don't run the build per CLAUDE.md, and these commits will deploy together at the Phase 2 gate.)

---

### Task 8: Replace `AssessmentRegisterPage.tsx` with ported + auto-login version

**Files:**
- Modify: `career-nine-assessment/src/pages/AssessmentRegisterPage.tsx` (full overwrite)

**Why:** The existing assessment-domain register page lacks promo codes and Razorpay payment handling. The dashboard version has both. We port the dashboard version verbatim, then bolt on auto-login: on success, write localStorage and navigate to `/allotted-assessment` instead of showing the credentials card. The credentials card is retained as a defensive fallback (rendered only when the backend response unexpectedly omits `userStudentId`).

- [ ] **Step 1: Overwrite the file**

Open `react-social/src/app/pages/AssessmentRegister/AssessmentRegisterPage.tsx` and copy its full content. Then in the assessment domain's file, write the ported version with these surgical edits:

1. Replace the imports header (top of file) with:

```tsx
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { showErrorToast } from '../utils/toast'
import {
  getMappingInfoByToken,
  registerStudentByToken,
} from "../api-clients/assessmentMappingAPI"
import { validatePromoCode } from "../api-clients/promoCodeAPI"
```

(The dashboard import paths `../AssessmentMapping/API/AssessmentMapping_APIs` and `../PromoCode/API/PromoCode_APIs` and `../../utils/toast` are replaced; nothing else in the imports.)

2. The dashboard version uses `process.env.REACT_APP_STUDENT_LOGIN_URL` only inside the success card's "Go to Student Login" button. Replace the button block (around line 290-296 of the dashboard source):

```tsx
<button
  onClick={() => window.location.replace(process.env.REACT_APP_STUDENT_LOGIN_URL || "/student-login")}
  style={s.btnPrimary}
>
  Go to Student Login
</button>
```

with:

```tsx
<button
  onClick={() => navigate("/student-login")}
  style={s.btnPrimary}
>
  Go to Student Login
</button>
```

3. Modify `handleSubmit`'s success handling (around line 138-149 of the dashboard source). Find the block:

```tsx
const res = await registerStudentByToken(token!, data);

if (res.data.status === "payment_required") {
  if (res.data.paymentUrl) {
    window.location.href = res.data.paymentUrl;
  } else {
    showErrorToast("Payment link could not be generated. Please try again.");
  }
  return;
}

setResult(res.data);
```

Replace with:

```tsx
const res = await registerStudentByToken(token!, data)

if (res.data.status === "payment_required") {
  if (res.data.paymentUrl) {
    window.location.href = res.data.paymentUrl
  } else {
    showErrorToast("Payment link could not be generated. Please try again.")
  }
  return
}

// Auto-login: backend returned a session payload. Write localStorage and
// navigate the student straight to their allotted assessments. The success
// "credentials card" UI below remains as a defensive fallback in case the
// backend (during a partial rollout) returns success without a session.
if (res.data.userStudentId && res.data.assessments) {
  localStorage.clear()
  localStorage.setItem('userStudentId', String(res.data.userStudentId))
  localStorage.setItem('allottedAssessments', JSON.stringify(res.data.assessments))
  navigate('/allotted-assessment')
  return
}

setResult(res.data)
```

(Keep the rest of the file — the `if (loading)`, `if (error)`, `if (result)` UI blocks, the form, all styles, all keyframes — exactly as the dashboard source.)

4. Make sure `useNavigate` is in scope: the dashboard version already calls `useNavigate()` at the top of the component — keep that.

- [ ] **Step 2: Smoke test on staging (deferred to Phase 2 gate)**

This page won't be testable until Task 9 lands and the bundle builds successfully on staging. Smoke test plan, run after Phase 2 gate:

- Free-mapping link: submit form with new email → should navigate to `/allotted-assessment` showing the assessment.
- Free-mapping link: submit again with same email + same DOB → should navigate (already-registered branch).
- Free-mapping link: submit with same email but wrong DOB → should show toast with the DOB mismatch message; form stays.
- Paid-mapping link: submit form → should redirect to Razorpay; cover post-payment in Task 9.

- [ ] **Step 3: Commit**

```bash
git add career-nine-assessment/src/pages/AssessmentRegisterPage.tsx
git commit -m "feat: port dashboard register page to assessment domain with auto-login"
```

---

### Task 9: Create `PaymentStatusPage.tsx` with auto-login

**Files:**
- Create: `career-nine-assessment/src/pages/PaymentStatusPage.tsx`

**Why:** Razorpay redirects post-payment back to `/payment-status`. The page polls `/payment/webhook/status/{linkId}` until status is non-`created`. When it sees `status === 'paid'` AND `userStudentId` is present, it writes localStorage and navigates to `/allotted-assessment` after a 1.5s "Payment Successful!" splash. If `paid` arrives without a `userStudentId` (provisioning lag), it keeps polling.

- [ ] **Step 1: Copy the dashboard's `PaymentStatusPage.tsx`**

Open `react-social/src/app/pages/PaymentTracking/PaymentStatusPage.tsx` and copy the full content into `career-nine-assessment/src/pages/PaymentStatusPage.tsx`. Apply these edits:

1. Imports header (top of file). Replace:

```tsx
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;
```

with:

```tsx
import { useEffect, useState, useRef } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import http from "../api/http"
```

2. The component currently does `axios.get(`${API_URL}/payment/webhook/status/${linkId}`)`. Replace with `http.get(\`/payment/webhook/status/${linkId}\`)` (the shared `http` instance has the base URL baked in).

3. Add `const navigate = useNavigate()` at the top of the component, and modify the `pollStatus` success branch. Find the block:

```tsx
.then((res) => {
  const data = res.data;
  setDetails(data);

  if (data.status !== "created") {
    setStatus(data.status as PaymentStatus);
  } else {
    // Still processing — keep polling
    pollCount.current += 1;
    if (pollCount.current < 15) {
      pollTimer.current = setTimeout(pollStatus, 2000);
      setStatus("created");
    } else {
      // Max polls reached — trust Razorpay's query param if available
      const linkStatus = searchParams.get("razorpay_payment_link_status");
      setStatus((linkStatus as PaymentStatus) || "created");
    }
  }
})
```

Replace with:

```tsx
.then((res) => {
  const data = res.data
  setDetails(data)

  if (data.status === "paid" && data.userStudentId && data.assessments) {
    // Auto-login: webhook completed AND student was provisioned.
    localStorage.clear()
    localStorage.setItem("userStudentId", String(data.userStudentId))
    localStorage.setItem("allottedAssessments", JSON.stringify(data.assessments))
    setStatus("paid")
    setTimeout(() => navigate("/allotted-assessment"), 1500)
    return
  }

  if (data.status === "paid") {
    // Webhook says paid but provisioning is still racing. Keep polling so we
    // can pick up userStudentId once it lands.
    pollCount.current += 1
    if (pollCount.current < 15) {
      pollTimer.current = setTimeout(pollStatus, 2000)
      setStatus("created")
    } else {
      // Provisioning didn't catch up. Show the "Payment Successful!" card
      // without auto-redirect. Email with credentials has already been sent.
      setStatus("paid")
    }
    return
  }

  if (data.status !== "created") {
    setStatus(data.status as PaymentStatus)
    return
  }

  // status === "created" — keep polling
  pollCount.current += 1
  if (pollCount.current < 15) {
    pollTimer.current = setTimeout(pollStatus, 2000)
    setStatus("created")
  } else {
    const linkStatus = searchParams.get("razorpay_payment_link_status")
    setStatus((linkStatus as PaymentStatus) || "created")
  }
})
```

4. Keep the rest of the file as-is (the `statusConfig` object, the JSX layout, the keyframes, the catch block).

- [ ] **Step 2: Smoke test on staging (deferred to Phase 2 gate)**

Run a paid-flow registration end-to-end on staging:

- Submit a paid registration → Razorpay test card flow → after payment, Razorpay redirects to `assessment.career-9.com/payment-status?razorpay_payment_link_id=...`
- Page should show "Verifying Payment..." for ~2-4s, then "Payment Successful!" briefly, then auto-navigate to `/allotted-assessment`
- The new assessment should be visible on the allotted-assessment page

- [ ] **Step 3: Commit**

```bash
git add career-nine-assessment/src/pages/PaymentStatusPage.tsx
git commit -m "feat: port payment-status page to assessment domain with auto-login"
```

---

### Phase 2 staging gate

Deploy assessment frontend to staging (`staging-assessment.career-9.com`). Smoke test on a real browser:

1. Free registration on a new email → auto-login → assessment visible.
2. Re-submit same email + DOB → already-registered branch → auto-login.
3. Re-submit same email + wrong DOB → toast appears with DOB mismatch message.
4. Paid registration → Razorpay test mode → post-payment auto-login.
5. Existing student login (no registration link) → `/student-login` → still works.

---

## Phase 3 — Dashboard Frontend (depends on Phase 2 deployed)

### Task 10: Soft-retire dashboard register and payment-status pages

**Files:**
- Rename: `react-social/src/app/pages/AssessmentRegister/AssessmentRegisterPage.tsx` → `AssessmentRegisterPageOld.tsx`
- Rename: `react-social/src/app/pages/PaymentTracking/PaymentStatusPage.tsx` → `PaymentStatusPageOld.tsx`

**Why:** The two pages are no longer the canonical implementation. We rename rather than delete so they stay readable in repo for context (and rollback if needed). Imports are removed in Task 11.

- [ ] **Step 1: Rename the files**

```bash
git mv react-social/src/app/pages/AssessmentRegister/AssessmentRegisterPage.tsx \
       react-social/src/app/pages/AssessmentRegister/AssessmentRegisterPageOld.tsx

git mv react-social/src/app/pages/PaymentTracking/PaymentStatusPage.tsx \
       react-social/src/app/pages/PaymentTracking/PaymentStatusPageOld.tsx
```

- [ ] **Step 2: Verify nothing else imports them**

```bash
grep -rn "AssessmentRegisterPage\|PaymentStatusPage" /home/babayaga/Projects/career-nine-sandbox/react-social/src/ \
  | grep -v "Old\.tsx" | grep -v "node_modules"
```

Expected: only matches inside `AppRoutes.tsx` (which Task 11 will update). If anything else imports these pages, surface it before proceeding.

- [ ] **Step 3: Commit**

```bash
git add react-social/src/app/pages/AssessmentRegister/AssessmentRegisterPageOld.tsx \
        react-social/src/app/pages/PaymentTracking/PaymentStatusPageOld.tsx
git commit -m "chore: rename dashboard register and payment-status pages to *Old"
```

---

### Task 11: Replace dashboard routes with redirect components

**Files:**
- Modify: `react-social/src/app/routing/AppRoutes.tsx:38-49` and `:143-166`

**Why:** Live links pointing at `dashboard.career-9.com/assessment-register/<token>` and Razorpay callbacks pointing at `dashboard.career-9.com/payment-status?razorpay_payment_link_id=...` need to keep working. We replace the lazy imports with inline redirect components that forward to the assessment domain, preserving path params and query string.

- [ ] **Step 1: Remove old imports**

In `AppRoutes.tsx`, delete the two lazy imports near lines 38-49:

```tsx
const AssessmentRegisterPage = lazy(
  () => import("../pages/AssessmentRegister/AssessmentRegisterPage")
);
// ...
const PaymentStatusPage = lazy(
  () => import("../pages/PaymentTracking/PaymentStatusPage")
);
```

(Leave the other lazy imports — `SchoolAssessmentRegisterPage`, `PaymentRegisterPage`, etc. — untouched. Those are different pages.)

- [ ] **Step 2: Add redirect components**

Below the existing `ExternalRedirect` component (around line 27-36) add:

```tsx
const AssessmentRegisterRedirect: FC = () => {
  const { token } = useParams<{ token: string }>();
  useEffect(() => {
    const target = `${process.env.REACT_APP_ASSESSMENT_APP_URL}/assessment-register/${token}${window.location.search}`;
    window.location.replace(target);
  }, [token]);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", color: "#555" }}>
      Redirecting…
    </div>
  );
};

const PaymentStatusRedirect: FC = () => {
  useEffect(() => {
    const target = `${process.env.REACT_APP_ASSESSMENT_APP_URL}/payment-status${window.location.search}`;
    window.location.replace(target);
  }, []);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", color: "#555" }}>
      Redirecting…
    </div>
  );
};
```

`useParams` and `useEffect` are already imported elsewhere in this file (`useParams` from `react-router-dom`, `useEffect` from `react`). Verify they're in scope; if not, add them to the existing `import` lines.

- [ ] **Step 3: Replace the route definitions**

Around line 143-150, replace the `/assessment-register/:token` route block:

```tsx
<Route
  path="/assessment-register/:token"
  element={
    <SuspensedView>
      <AssessmentRegisterPage />
    </SuspensedView>
  }
/>
```

with:

```tsx
<Route
  path="/assessment-register/:token"
  element={<AssessmentRegisterRedirect />}
/>
```

Around line 159-166, replace the `/payment-status` route block:

```tsx
<Route
  path="/payment-status"
  element={
    <SuspensedView>
      <PaymentStatusPage />
    </SuspensedView>
  }
/>
```

with:

```tsx
<Route
  path="/payment-status"
  element={<PaymentStatusRedirect />}
/>
```

(`/school-register/:token` and `/payment-register/:transactionId` routes keep their existing wiring — they are separate pages, out of scope for this change.)

- [ ] **Step 4: Smoke test on staging (deferred to Phase 3 gate)**

After deploy to staging-dashboard:

```
# Visit in browser:
https://staging-dashboard.career-9.com/assessment-register/<token>
# Should redirect to:
https://staging-assessment.career-9.com/assessment-register/<token>

https://staging-dashboard.career-9.com/payment-status?razorpay_payment_link_id=plink_test_xyz
# Should redirect to:
https://staging-assessment.career-9.com/payment-status?razorpay_payment_link_id=plink_test_xyz
```

- [ ] **Step 5: Commit**

```bash
git add react-social/src/app/routing/AppRoutes.tsx
git commit -m "feat: redirect dashboard /assessment-register and /payment-status to assessment domain"
```

---

### Task 12: Point paid-registration URL generator at assessment domain

**Files:**
- Modify: `react-social/src/app/pages/College/components/AssessmentMappingPanel.tsx:148-149`

**Why:** Free-registration link generation already uses `REACT_APP_ASSESSMENT_APP_URL` (line 148), but paid-registration uses `REACT_APP_URL` (line 149) — i.e., the dashboard. Both should point at the assessment domain now. Newly generated links bypass the redirect from Task 11.

- [ ] **Step 1: Edit the URL builders**

In `AssessmentMappingPanel.tsx` lines 148-149, change:

```tsx
const getFreeRegistrationUrl = (token: string) => `${process.env.REACT_APP_ASSESSMENT_APP_URL}/assessment-register/${token}`;
const getPaidRegistrationUrl = (token: string) => `${process.env.REACT_APP_URL}/assessment-register/${token}`;
```

to:

```tsx
const getFreeRegistrationUrl = (token: string) => `${process.env.REACT_APP_ASSESSMENT_APP_URL}/assessment-register/${token}`;
const getPaidRegistrationUrl = (token: string) => `${process.env.REACT_APP_ASSESSMENT_APP_URL}/assessment-register/${token}`;
```

- [ ] **Step 2: Verify no other place builds these URLs**

```bash
grep -rn "assessment-register" /home/babayaga/Projects/career-nine-sandbox/react-social/src/ \
  | grep -v "Old\.tsx" | grep -v "AppRoutes.tsx"
```

Expected: only the two lines you just edited. If anything else constructs an `/assessment-register/...` URL, update it the same way.

- [ ] **Step 3: Smoke test on staging**

Open the College page → AssessmentMappingPanel → copy a paid registration link. The copied URL should now start with `https://staging-assessment.career-9.com/assessment-register/...` rather than `https://staging-dashboard...`.

- [ ] **Step 4: Commit**

```bash
git add react-social/src/app/pages/College/components/AssessmentMappingPanel.tsx
git commit -m "fix: paid-registration URL generator points at assessment domain"
```

---

### Phase 3 staging gate

Deploy dashboard frontend to staging. Verify:

1. Live old dashboard register link → redirects to assessment domain (Task 11).
2. Live old dashboard payment-status link with Razorpay query params → redirects with query string preserved (Task 11).
3. Newly generated paid-registration link from admin UI → points at assessment domain (Task 12).
4. Newly generated free-registration link from admin UI → unchanged (already pointed at assessment domain).
5. Whole flow end-to-end: admin generates paid link → student opens link → fills form → Razorpay → returns → auto-login → assessment visible.

---

## Phase 4 — Razorpay callback config flip

### Task 13: Update `app.razorpay.callback-base-url` per profile

**Files:**
- Modify: `spring-social/src/main/resources/application.yml:198`, `:364`, `:521`, and any other profile-scoped occurrence.

**Why:** New Razorpay payment links should redirect students directly to the assessment domain, bypassing the redirect from Task 11. **Already-issued links keep using the old callback (Razorpay stores it at link-creation time)** — that's why the redirect from Task 11 must stay indefinitely.

- [ ] **Step 1: Find every profile-scoped occurrence**

```bash
grep -n "callback-base-url" /home/babayaga/Projects/career-nine-sandbox/spring-social/src/main/resources/application.yml
```

Expected occurrences (per the file's profile structure):
- dev profile (~line 198): `http://localhost:3000` → change to `http://localhost:5173`
- staging profile (~line 521): `https://sandbox.career-9.com` → change to staging assessment URL (whatever DNS already exists for staging assessment, e.g. `https://staging-assessment.career-9.com`)
- production profile (~line 364): `https://dashboard.career-9.com` → change to `https://assessment.career-9.com`

- [ ] **Step 2: Make the edits**

For each occurrence, edit in place. Example for production:

```yaml
razorpay:
  # ... other razorpay settings ...
  callback-base-url: https://assessment.career-9.com
```

The literal `+ "/payment-status"` and `?ref=...` query suffix logic in `PaymentController.java:110, :211` and `AssessmentInstituteMappingController.java:442` stays unchanged. They append `/payment-status` to whatever `callback-base-url` is set to.

- [ ] **Step 3: Smoke test (after deploy)**

On staging: trigger a fresh paid registration. Inspect the Razorpay payment link's `callback_url` field (Razorpay dashboard, or via the API). It should now be `https://staging-assessment.career-9.com/payment-status?ref=...` rather than the dashboard URL.

Complete a test payment. Razorpay should redirect directly to the assessment domain — no redirect hop.

- [ ] **Step 4: Commit and deploy**

```bash
git add spring-social/src/main/resources/application.yml
git commit -m "config: point razorpay callback-base-url at assessment domain"
```

After this commit lands and the backend restarts, all *new* payment links go directly to the assessment domain. *Existing* in-flight links continue to work via the redirect from Task 11.

---

## Self-review checklist

- [ ] Phase 1 backend changes are additive (old frontends ignore new fields).
- [ ] Phase 1 deploys safely without Phase 2.
- [ ] Phase 2 deploys safely without Phase 3 (newly generated links still point through assessment domain via Task 12 from before; redirect from Task 11 not yet needed).
- [ ] Phase 3 deploys safely without Phase 4 (new Razorpay links still callback to dashboard, but redirect from Task 11 catches them).
- [ ] Phase 4 deploys safely (callback URL flip only affects new payment links; existing in-flight links still redirect via Task 11).
- [ ] Each phase has a staging smoke-test gate before proceeding to the next.
- [ ] No task introduces a flag-day / atomic-deploy requirement.
- [ ] Every reference to `userStudentId` matches between backend (Long), frontend (number/string), and stamp-points (already in place per `PaymentWebhookController.java:345, :523, :576`).
- [ ] No placeholders, no "TBD", every code block is complete.
- [ ] Rollback for each task is "revert the commit" — no schema migrations, no destructive operations.

## Rollback notes

- Phase 4 → revert config change, restart backend. New payment links go back to dashboard URL.
- Phase 3 → revert commits in reverse order. Renames in Task 10 reversed by `git mv` back. Imports restored in `AppRoutes.tsx`. Live links continue working through dashboard's revived old pages.
- Phase 2 → revert commits. Old assessment register page restored. Free registration loses the auto-login UX but keeps working (returns credentials card; student manually logs in).
- Phase 1 → revert commits. `UserController.checkUser` returns to inline assessment-list build. New register-response fields gone — frontends already ignore them, so revert is invisible to any users hitting old or new frontend.
