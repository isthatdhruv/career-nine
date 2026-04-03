# Exception Handling Design — Career-Nine

**Date:** 2026-04-03
**Status:** Approved
**Scope:** Full-stack exception handling for Spring Boot backend + React frontend

---

## Goals

1. **Production stability** — Clean error responses instead of raw 500s and stack traces
2. **Debugging visibility** — Structured error info (status, message, path, timestamp) in every error response
3. **User experience** — Friendly toast notifications and inline validation instead of blank screens or browser `alert()`

## Constraints

- No functionality changes — same behavior, same HTTP status codes, same business logic
- Keep existing logging as-is (no `System.out.println` → SLF4J conversion)
- Keep existing Formik/Yup inline validation as-is
- Keep existing assessment API retry logic as-is
- One controller/component at a time to isolate risk

---

## Backend Design

### Standardized Error Response DTO

Every error from the API returns this JSON shape:

```json
{
  "status": 404,
  "error": "NOT_FOUND",
  "message": "Student with ID 42 not found",
  "timestamp": "2026-04-03T14:30:00",
  "path": "/student/getbyid/42"
}
```

**Class:** `ApiErrorResponse` in `com.kccitm.api.exception` package.

Fields:
- `int status` — HTTP status code
- `String error` — HTTP status reason (e.g., "NOT_FOUND", "BAD_REQUEST")
- `String message` — Human-readable error description
- `LocalDateTime timestamp` — When the error occurred
- `String path` — Request URI that caused the error

### Custom Exception Classes

Existing (keep as-is, remove `@ResponseStatus` annotations since the global handler takes over):

| Exception | HTTP Status | Usage |
|-----------|-------------|-------|
| `ResourceNotFoundException` | 404 | Entity not found by ID/field |
| `BadRequestException` | 400 | Invalid input, validation failures |
| `EmailSendException` | 500 | Email delivery failures |
| `OAuth2AuthenticationProcessingException` | 401 | OAuth flow errors |

New exceptions to add:

| Exception | HTTP Status | Usage |
|-----------|-------------|-------|
| `DuplicateResourceException` | 409 | Email already exists, duplicate entries |
| `UnauthorizedAccessException` | 403 | User lacks permission for action |
| `ServiceException` | 500 | Generic service-layer failures (DB, external APIs) |

All exceptions extend `RuntimeException` (except OAuth2 which extends `AuthenticationException`).

### Global Exception Handler

**Class:** `GlobalExceptionHandler` in `com.kccitm.api.exception` package.
**Annotation:** `@RestControllerAdvice`

Handles these exception types in order of specificity:

1. `ResourceNotFoundException` → 404
2. `BadRequestException` → 400
3. `DuplicateResourceException` → 409
4. `UnauthorizedAccessException` → 403
5. `EmailSendException` → 500
6. `ServiceException` → 500
7. `MethodArgumentNotValidException` (Spring) → 400
8. `HttpMessageNotReadableException` (Spring) → 400
9. `NoHandlerFoundException` (Spring) → 404
10. `HttpRequestMethodNotSupportedException` (Spring) → 405
11. `AccessDeniedException` (Spring Security) → 403
12. `Exception` (fallback) → 500

Each handler method:
- Logs the error with SLF4J
- Builds an `ApiErrorResponse` with the correct status, message, timestamp, and request path
- Returns `ResponseEntity<ApiErrorResponse>`

### SecurityConfig Update

Add `accessDeniedHandler` to the existing security config to return the standardized error response for 403s, instead of the default Spring behavior.

### Controller Cleanup Rules

For each controller (40+ files):

1. **Remove try-catch blocks** that exist solely to format error responses. Let exceptions propagate to the global handler.
2. **Replace `.orElse(null)` + null check** with `.orElseThrow(() -> new ResourceNotFoundException("EntityName", "id", id))`.
3. **Replace `throw new RuntimeException(...)`** with the appropriate custom exception (`ResourceNotFoundException`, `ServiceException`, etc.).
4. **Replace `ResponseEntity.status(500).body("error message")`** with `throw new ServiceException("error message")`.
5. **Replace `ResponseEntity.notFound().build()`** with `throw new ResourceNotFoundException(...)`.
6. **Keep try-catch blocks** where partial recovery happens (e.g., non-critical async ops like activity logging, meeting link generation).
7. **Keep existing `ResponseEntity.ok(data)`** success responses unchanged.

### Service Layer Changes

- Replace `throw new RuntimeException("Entity not found...")` with `throw new ResourceNotFoundException(...)` or `throw new ServiceException(...)` as appropriate.
- Replace duplicate-check patterns that throw `BadRequestException` with `DuplicateResourceException` where semantically correct (e.g., "Email already in use").
- No business logic changes.

---

## Frontend Design

### Axios Response Interceptor

**File:** `AuthHelpers.ts` — add response interceptor alongside existing request interceptor in `setupAxios()`.

Behavior by status code:
- **401** → Call `removeAuth()`, redirect to `/auth`, toast "Session expired, please log in again"
- **403** → Toast "You don't have permission for this action"
- **500+** → Toast "Something went wrong, please try again"
- **Network error** (no response) → Toast "Connection issue, check your internet"
- **400, 409** → Pass through to component (don't intercept — let inline validation handle it)

The interceptor extracts the `message` field from the backend's `ApiErrorResponse` when available, falls back to generic messages.

### React Error Boundary

**File:** New component `ErrorBoundary.tsx` in `src/app/modules/errors/`

- Class component implementing `componentDidCatch`
- Wraps the app in `App.tsx`
- Fallback UI: "Something went wrong" with a "Reload Page" button
- Catches uncaught React render errors only (not API errors)

### Toast Notification System

**Package:** `react-toastify`

**Setup:**
- `ToastContainer` added in `App.tsx` with config: position top-right, auto-close 5s
- Utility functions in a new `src/app/utils/toast.ts`:
  - `showErrorToast(message: string)`
  - `showSuccessToast(message: string)`
  - `showWarningToast(message: string)`

### Component Cleanup Rules

For each page/component:

1. **Replace `alert()` calls** with `showErrorToast()` or `showSuccessToast()`.
2. **Remove redundant error handling** where the axios interceptor now covers it (e.g., generic 500 catch blocks that just show an error message).
3. **Keep component-level error state** for 400/409 responses that need inline display.
4. **Keep Formik/Yup validation** completely unchanged.
5. **Keep assessment API retry logic** (`assessmentApi.ts`) completely unchanged.
6. **Keep existing error pages** (`Error401`, `Error404`, `Error500`) as route targets.

---

## Files Changed Summary

### Backend — New Files
- `exception/ApiErrorResponse.java` — Error response DTO
- `exception/GlobalExceptionHandler.java` — `@RestControllerAdvice`
- `exception/DuplicateResourceException.java`
- `exception/UnauthorizedAccessException.java`
- `exception/ServiceException.java`

### Backend — Modified Files
- `exception/ResourceNotFoundException.java` — Remove `@ResponseStatus`
- `exception/BadRequestException.java` — Remove `@ResponseStatus`
- `exception/EmailSendException.java` — Remove `@ResponseStatus`
- `security/SecurityConfig.java` — Add `accessDeniedHandler`
- 40+ controller files — Remove try-catch, throw custom exceptions
- Service files — Replace `RuntimeException` with custom exceptions

### Frontend — New Files
- `src/app/modules/errors/ErrorBoundary.tsx`
- `src/app/utils/toast.ts`

### Frontend — Modified Files
- `src/app/modules/auth/core/AuthHelpers.ts` — Add response interceptor
- `src/App.tsx` — Add `ErrorBoundary` wrapper + `ToastContainer`
- `package.json` — Add `react-toastify` dependency
- Component files with `alert()` or redundant error handling

---

## What Does NOT Change

- All API endpoint paths and HTTP methods
- All success response shapes
- All business logic and validation rules
- All Formik/Yup form validation
- Assessment API retry logic
- Existing `System.out.println` and `e.printStackTrace()` logging
- Existing error route pages (401, 404, 500)
- Database schema
- Authentication/OAuth2 flow
