# Phase 12: Frontend Resilience - Research

**Researched:** 2026-03-07
**Domain:** Frontend HTTP resilience, session management, error handling (React/TypeScript/axios)
**Confidence:** HIGH

## Summary

Phase 12 connects the frontend to the server-side session and submission infrastructure built in Phases 10-11. The backend already returns a `sessionToken` from `startAssessment`, has a `HandlerInterceptor` that validates `X-Assessment-Session` / `X-Assessment-Student-Id` / `X-Assessment-Id` headers, idempotent submission via Redis SET NX, and draft save/restore endpoints. The frontend currently ignores all of this -- it does not store the session token, sends no session headers, has no retry logic, and uses raw `fetch()` for student-facing calls (not axios).

The work is straightforward: (1) capture and store the session token from `startAssessment`, (2) attach session headers to all assessment API calls, (3) add retry with exponential backoff for transient failures, (4) replace generic `alert()` error messages with clear, actionable UI feedback, and (5) add loading states that prevent double-submission.

**Primary recommendation:** Create a dedicated `assessmentApi` module (axios instance with interceptors for session headers + retry logic) that all student assessment pages use. Keep it separate from the admin axios setup. Wire draft auto-save into the assessment flow.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| axios | 0.26.1 | HTTP client | Already in project, supports request/response interceptors |
| React 18 | 18.0.0 | UI framework | Already in project |
| TypeScript | 4.6.3 | Type safety | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| axios (interceptors) | 0.26.1 | Header injection + retry | Every assessment API call |
| sessionStorage | Browser API | Session token storage | Per-tab session isolation |
| localStorage | Browser API | Student ID, assessment ID | Already used in codebase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom retry logic | axios-retry (npm) | Would add a dependency; custom is ~20 lines and already sufficient for 3-attempt backoff. No new dependency needed. |
| axios instance | fetch() wrapper | Codebase already has axios for admin calls; mixing fetch + axios is the current problem. Standardize on axios. |
| React context for session | localStorage/sessionStorage | Context loses state on page refresh; sessionStorage persists per tab. Use sessionStorage for the token. |

**Installation:**
```bash
# No new packages needed -- all capabilities exist in current stack
```

## Architecture Patterns

### Recommended Project Structure
```
react-social/src/app/pages/StudentLogin/
    API/
        assessmentApi.ts          # NEW: Axios instance with session headers + retry
        StudentDemographic_APIs.ts  # Existing
    AssessmentContext.tsx          # MODIFY: Store sessionToken, wire draft save
    AllottedAssessmentPage.tsx     # MODIFY: Capture sessionToken from startAssessment
    usePreventReload.ts           # Existing (no changes)
```

### Pattern 1: Assessment Axios Instance with Session Headers
**What:** A dedicated axios instance that automatically injects session headers on every request to assessment endpoints.
**When to use:** All student-facing assessment API calls (submit, draft-save, draft-restore, fetch questionnaire during assessment).
**Example:**
```typescript
// assessmentApi.ts
import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8091';

const assessmentApi: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
});

// Request interceptor: attach session headers
assessmentApi.interceptors.request.use((config) => {
  const sessionToken = sessionStorage.getItem('assessmentSessionToken');
  const studentId = localStorage.getItem('userStudentId');
  const assessmentId = localStorage.getItem('assessmentId');

  if (sessionToken) {
    config.headers['X-Assessment-Session'] = sessionToken;
  }
  if (studentId) {
    config.headers['X-Assessment-Student-Id'] = studentId;
  }
  if (assessmentId) {
    config.headers['X-Assessment-Id'] = assessmentId;
  }

  return config;
});

export default assessmentApi;
```

### Pattern 2: Exponential Backoff Retry
**What:** Response interceptor that retries failed requests with exponential backoff (3 attempts max).
**When to use:** Network errors (no response) and 5xx server errors. NOT for 4xx client errors (400, 403, 404, 409).
**Example:**
```typescript
// Retry logic in response interceptor
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s

assessmentApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as any;
    config.__retryCount = config.__retryCount || 0;

    // Only retry on network errors or 5xx
    const isRetryable = !error.response || (error.response.status >= 500);

    if (isRetryable && config.__retryCount < MAX_RETRIES) {
      config.__retryCount += 1;
      const delay = BASE_DELAY_MS * Math.pow(2, config.__retryCount - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      return assessmentApi(config);
    }

    return Promise.reject(error);
  }
);
```

### Pattern 3: Submission State Machine
**What:** A state machine that prevents double-submission and provides clear feedback.
**When to use:** The final answer submission call.
**States:** `idle` -> `submitting` -> `success` | `error`
**Example:**
```typescript
type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
const [submissionError, setSubmissionError] = useState<string | null>(null);

const handleSubmit = async () => {
  if (submissionState === 'submitting') return; // Prevent double-click
  setSubmissionState('submitting');
  setSubmissionError(null);

  try {
    const response = await assessmentApi.post('/assessment-answer/submit', payload);
    setSubmissionState('success');
    // Navigate to success page
  } catch (error: any) {
    setSubmissionState('error');
    const message = error.response?.data?.error
      || error.response?.data
      || 'Your answers could not be submitted. Please try again.';
    setSubmissionError(typeof message === 'string' ? message : 'Submission failed.');
  }
};
```

### Pattern 4: Draft Auto-Save
**What:** Periodic saving of student answers to Redis via the backend draft endpoint.
**When to use:** During assessment-taking, every 30 seconds.
**Example:**
```typescript
// In the assessment-taking component
useEffect(() => {
  const interval = setInterval(() => {
    if (answers && Object.keys(answers).length > 0) {
      assessmentApi.post('/assessment-answer/draft-save', {
        userStudentId: Number(localStorage.getItem('userStudentId')),
        assessmentId: Number(localStorage.getItem('assessmentId')),
        answers: answers,
      }).catch(() => {
        // Silent failure -- draft save is best-effort
        console.warn('Draft save failed');
      });
    }
  }, 30000); // 30 seconds

  return () => clearInterval(interval);
}, [answers]);
```

### Anti-Patterns to Avoid
- **Using fetch() for some calls and axios for others:** The codebase currently mixes `fetch()` (student pages) and `axios` (admin pages). Standardize assessment calls on the axios instance to get interceptor benefits.
- **Storing session token in React state only:** Lost on page refresh. Use `sessionStorage` (per-tab, survives refresh, clears when tab closes).
- **Retrying 409 Conflict responses:** The backend returns 409 when a submission is already in progress. This is NOT a transient error -- retrying it is wrong. Handle it as "already submitted."
- **Retrying 403 Forbidden responses:** The backend returns 403 when the session is invalid/expired. This requires the user to re-start the assessment, not retry.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request header injection | Manual headers on every call | Axios request interceptor | DRY, impossible to forget a header |
| Retry with backoff | Custom Promise chain per call | Axios response interceptor | Centralized, consistent behavior |
| Session token storage | React Context alone | sessionStorage + Context | Context dies on refresh; sessionStorage survives |
| Double-click prevention | Manual `isSubmitting` flag per page | Submission state machine pattern | Covers all states: idle/submitting/success/error |

**Key insight:** The interceptor pattern means resilience is automatic for any component using the `assessmentApi` instance. No per-component retry or header code needed.

## Common Pitfalls

### Pitfall 1: Not Handling 403 (Session Expired) Separately
**What goes wrong:** Student gets a generic error when their 24h session expires mid-assessment.
**Why it happens:** 403 from the interceptor means "invalid or expired assessment session" but looks like any other error to the frontend.
**How to avoid:** Check for 403 specifically in the response interceptor and show "Your session has expired. Please return to the assessment list and start again." Do NOT retry 403.
**Warning signs:** Students report "frozen" screens after leaving assessment open overnight.

### Pitfall 2: Not Handling 409 (Duplicate Submission) Correctly
**What goes wrong:** Student sees "submission failed" when they actually already submitted successfully.
**Why it happens:** Backend returns 409 Conflict with `{"status": "duplicate"}` or returns 200 with cached result. Frontend treats non-200 as error.
**How to avoid:** Check for 409 with "duplicate" status in submission handler. Show "Your assessment was already submitted successfully." Navigate to success page.
**Warning signs:** Students pressing submit multiple times and getting confused error messages.

### Pitfall 3: Retrying Non-Idempotent Draft Saves
**What goes wrong:** Multiple retry attempts for draft save create unnecessary Redis writes.
**Why it happens:** Draft save retries on network blip, but the next 30s interval will save anyway.
**How to avoid:** Don't retry draft saves. They are best-effort and periodic. A failed draft save will be retried naturally by the next interval.
**Warning signs:** Burst of draft save requests after network hiccup.

### Pitfall 4: fetch() Calls Bypassing Interceptors
**What goes wrong:** Some assessment calls don't have session headers because they use `fetch()` instead of the axios instance.
**Why it happens:** The current codebase uses `fetch()` for student-facing calls (StudentLoginPage, AllottedAssessmentPage, AssessmentContext).
**How to avoid:** Migrate all assessment-flow API calls to use the `assessmentApi` instance. Audit for any remaining `fetch()` calls.
**Warning signs:** Backend logs showing missing X-Assessment-Session header on assessment endpoints.

### Pitfall 5: axios 0.26.1 Retry Config Object Mutation
**What goes wrong:** Retry interceptor re-sends the request but axios 0.26.x reuses the same config object reference.
**Why it happens:** In axios 0.26.x, the config object passed to interceptors is mutable and shared.
**How to avoid:** Attach `__retryCount` directly to the config object (it's the same reference on retry). Do NOT clone the config -- that breaks in 0.26.x because the cloned config doesn't preserve internal state.
**Warning signs:** Infinite retry loops or retry count not incrementing.

## Code Examples

### Capturing Session Token from startAssessment

```typescript
// In AllottedAssessmentPage.tsx, modify handleStartAssessment:
const response = await fetch(`${process.env.REACT_APP_API_URL}/assessments/startAssessment`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userStudentId: Number(userStudentId),
    assessmentId: assessment.assessmentId,
  }),
});

const data = await response.json();
if (data.sessionToken) {
  sessionStorage.setItem('assessmentSessionToken', data.sessionToken);
}
```

### Error Message Mapping

```typescript
// Map backend error responses to user-friendly messages
function getErrorMessage(error: AxiosError): string {
  if (!error.response) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }

  switch (error.response.status) {
    case 403:
      return 'Your assessment session has expired. Please return to the assessment list and start again.';
    case 409:
      return 'Your assessment has already been submitted successfully.';
    case 400:
      const body = error.response.data;
      return typeof body === 'string' ? body : 'Invalid submission data. Please try again.';
    case 500:
      return 'The server encountered an error. Your answers are saved. Please try again in a moment.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}
```

### Retry-Aware Submission UI

```tsx
{submissionState === 'error' && (
  <div className="alert alert-danger" role="alert">
    <strong>Submission Failed</strong>
    <p>{submissionError}</p>
    <button
      className="btn btn-primary"
      onClick={handleSubmit}
    >
      Retry Submission
    </button>
  </div>
)}

{submissionState === 'submitting' && (
  <button className="btn btn-primary" disabled>
    <span className="spinner-border spinner-border-sm me-2" />
    Submitting your answers...
  </button>
)}
```

## Existing Code Analysis

### Current State of Student Assessment Flow

| Aspect | Current | Target |
|--------|---------|--------|
| HTTP client (student pages) | `fetch()` (raw) | `assessmentApi` (axios instance with interceptors) |
| Session token | Returned by backend, ignored by frontend | Stored in sessionStorage, sent as X-Assessment-Session |
| Student ID header | Not sent | Sent as X-Assessment-Student-Id |
| Assessment ID header | Not sent | Sent as X-Assessment-Id |
| Retry logic | None | 3 attempts with exponential backoff (1s, 2s, 4s) |
| Error messages | `alert('Failed to start assessment')` | Inline error components with specific messages |
| Double-click prevention | `loadingId` state on Start button only | Full submission state machine (idle/submitting/success/error) |
| Draft auto-save | Not implemented | 30s interval using /assessment-answer/draft-save |
| Draft restore | Not implemented | On page load using /assessment-answer/draft-restore |

### Key Files to Modify

1. **NEW: `react-social/src/app/pages/StudentLogin/API/assessmentApi.ts`** - Axios instance with interceptors
2. **MODIFY: `react-social/src/app/pages/StudentLogin/AllottedAssessmentPage.tsx`** - Capture sessionToken, use assessmentApi
3. **MODIFY: `react-social/src/app/pages/StudentLogin/AssessmentContext.tsx`** - Store sessionToken, migrate from fetch to assessmentApi
4. **MODIFY: `react-social/src/app/pages/StudentLogin/DynamicDemographicForm.tsx`** - Use assessmentApi for startAssessment call

### Backend Endpoints Already Ready

| Endpoint | Method | Purpose | Headers Expected |
|----------|--------|---------|-----------------|
| `/assessments/startAssessment` | POST | Returns sessionToken | None (excluded from interceptor) |
| `/assessment-answer/submit` | POST | Submit answers | X-Assessment-Session, X-Assessment-Student-Id, X-Assessment-Id |
| `/assessment-answer/draft-save` | POST | Save draft to Redis | X-Assessment-Session, X-Assessment-Student-Id, X-Assessment-Id |
| `/assessment-answer/draft-restore/{sid}/{aid}` | GET | Restore draft | X-Assessment-Session, X-Assessment-Student-Id, X-Assessment-Id |
| `/assessments/getby/{id}` | GET | Get questionnaire | X-Assessment-Session, X-Assessment-Student-Id, X-Assessment-Id |
| `/assessments/getById/{id}` | GET | Get assessment config | X-Assessment-Session, X-Assessment-Student-Id, X-Assessment-Id |

### Missing: Assessment Question-Taking Page

The `/general-instructions` route is referenced in navigation and ALWAYS_ALLOWED list, but **no component is registered for it** in either AppRoutes.tsx or PrivateRoutes.tsx. Similarly, there is no question-taking/answer-submission page component visible in the codebase. This means:

- The submission UI where students answer questions and click "Submit" **may not exist yet**
- Phase 12 may need to build a minimal submission page, OR the page exists but is loaded externally
- The resilience patterns (retry, error display, loading states) need a page to live in

**Recommendation:** If the question-taking page doesn't exist, Phase 12 should focus on the infrastructure (assessmentApi module, session token capture, header injection) and apply error handling to the existing pages (AllottedAssessmentPage, DynamicDemographicForm). The submit retry UI can be wired in when the submission page is built.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| fetch() + manual headers | axios interceptors | Standard since axios 0.19+ | Automatic header injection, centralized retry |
| alert() for errors | Inline error components | React best practice | Better UX, retry affordance |
| No retry | Exponential backoff | Standard pattern | Resilience to transient failures |

**Deprecated/outdated:**
- None relevant -- axios 0.26.x is stable and the interceptor API hasn't changed.

## Open Questions

1. **Does the question-taking page exist?**
   - What we know: Navigation goes to `/general-instructions` but no component is registered for that route. No answer submission UI found in codebase.
   - What's unclear: Whether this page exists elsewhere (different branch, external app, or yet to be built).
   - Recommendation: Proceed with building the assessmentApi module and wiring it into existing pages. The submission retry UI can be added when the submission page exists.

2. **Should startAssessment use the assessmentApi instance?**
   - What we know: startAssessment is excluded from the backend interceptor (can't validate session before it exists).
   - What's unclear: Whether it should still use the assessmentApi instance (for consistency) or remain a plain fetch/axios call.
   - Recommendation: Use plain fetch or base axios for startAssessment since it doesn't need session headers. Simpler and avoids confusion.

3. **Should the frontend assessment pages continue using the AssessmentProvider context?**
   - What we know: AssessmentContext currently uses fetch(). It stores assessment data in sessionStorage.
   - What's unclear: Whether to merge session token into this context or keep it in sessionStorage only.
   - Recommendation: Keep sessionToken in sessionStorage (survives refresh) and read it from there in the axios interceptor. Optionally expose it via AssessmentContext for components that need to display session status.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `AssessmentSessionInterceptor.java` - Exact header names and validation logic
- Codebase analysis: `AssessmentSessionService.java` - Session lifecycle, draft save/restore, submission locking
- Codebase analysis: `AssessmentTableController.java` - startAssessment returns sessionToken
- Codebase analysis: `AssessmentAnswerController.java` - Idempotent submission, draft endpoints
- Codebase analysis: `WebMvcConfig.java` - Interceptor path patterns and exclusions
- Codebase analysis: `AuthHelpers.ts` - Existing axios interceptor pattern in project
- Phase 10 summaries (10-01-SUMMARY.md, 10-02-SUMMARY.md) - Backend session and idempotency decisions
- Phase 11 summaries (11-01-SUMMARY.md, 11-02-SUMMARY.md) - Backend draft save/restore and safe submission

### Secondary (MEDIUM confidence)
- axios 0.26.x interceptor API - verified via node_modules inspection (InterceptorManager.js exists)
- axios config object mutation behavior - known from 0.x series behavior

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using only what's already in the project (axios 0.26.1, React 18, TypeScript)
- Architecture: HIGH - Interceptor pattern verified against existing codebase, backend endpoints verified
- Pitfalls: HIGH - Derived from actual backend response codes and codebase patterns
- Missing page assessment: MEDIUM - Could not confirm whether question-taking page exists on another branch

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable; no moving parts)
