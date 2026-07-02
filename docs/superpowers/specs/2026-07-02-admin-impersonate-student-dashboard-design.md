# Admin "Log in as student" from Data Download

**Date:** 2026-07-02
**Status:** Approved design, pending spec review
**Author:** Dhruv Sharma (with Claude)

## Problem

Admins on the Data Download page (`GroupStudentPage`) need a per-student
**Dashboard** button that opens a new browser tab already authenticated as that
student, landing on the real student portal dashboard (`/student/dashboard`) —
i.e. full impersonation, seeing exactly what the student sees and able to act as
them.

## Constraint that shapes the whole design

The student portal (`/student/dashboard`) lives in the **same React app and same
origin** as the admin Data Download page. The session cookie `cn_at` is
`Path=/`, no `Domain`, `HttpOnly`, `SameSite=Strict` — so it is shared across
every tab of that origin. Minting a student `cn_at` in that browser (as the
existing entitlement SSO flow does) would **overwrite the admin's own `cn_at`**,
silently logging the admin out or turning all their admin tabs into the student.

Therefore the impersonation session must be carried **without a cookie**, in a
way that is scoped to the single impersonation tab and never touches the admin's
`cn_at`.

## Chosen approach (decisions locked in)

- **Session isolation:** token-in-URL, **no cookie**. The impersonation JWT lives
  only in the impersonation tab's `sessionStorage` (per-tab, per-origin — not
  shared with admin tabs, unlike cookies and `localStorage`).
- **Scope:** full impersonation — a real, short-lived student JWT; every portal
  API call works.
- **Target:** the real student portal dashboard, `/student/dashboard`
  (`StudentPortalDashboard`).
- **Token transport:** passed via `?t=<jwt>` on the landing URL (consistent with
  the existing `StudentSsoLanding` `?t=` precedent), immediately moved into
  `sessionStorage` and stripped from the URL.
- **Permission:** new `student.impersonate` permission code.

## Why no backend filter change is needed

`TokenAuthenticationFilter.getJwtFromRequest` builds an ordered candidate list:
assessment cookie (on assessment paths) → `cn_at` cookie → `Authorization: Bearer`
fallback, and authenticates with the first **valid** candidate. In a same-origin
tab the admin's `cn_at` is always sent, so it would win over any Bearer token.

The portal makes **raw `axios` calls with hardcoded `withCredentials: true`** (no
shared axios instance). A **global request interceptor** exploits this: when an
impersonation session is active in the tab, it sets `config.withCredentials =
false` and attaches `Authorization: Bearer <student-jwt>`. With the cookie not
sent at all, the filter's candidate list contains only the Bearer token and
authenticates as the student. The admin's `cn_at` is never transmitted on those
requests and never overwritten. The Bearer fallback is already documented as a
supported mode ("external admin scripts keep working").

## Components

### 1. Backend — mint endpoint

`POST /admin/impersonate/student/{userStudentId}` (new; likely on a small
`ImpersonationController` or the existing `UserController`).

- Guard: `@PreAuthorize("@auth.allows('student.impersonate')")`.
- Resolve `UserStudent` → `userId`; load `UserPrincipal` via
  `customUserDetailsService.loadUserById(userId)` — the exact path
  `EntitlementController.redeemDashboardToken` already uses, so the minted JWT
  carries the same roles/scopes/`sa` claim shape and validates identically on
  every subsequent request.
- Mint a **short-lived** JWT via `tokenProvider.createAccessToken(principal)`
  (the Phase 18 access minter is already short-lived), stamped with an
  `impersonatedBy=<adminUserId>` claim so backend audit trails can distinguish
  impersonated sessions. Stamping the claim requires a small `buildJwt` overload
  in `TokenProvider` that accepts an optional `impersonatedBy`; if we prefer zero
  `TokenProvider` change for v1, reuse `createAccessToken` as-is and rely on the
  audit-log row below for attribution.
- Write an audit entry (admin X impersonated student Y, timestamp) via the
  existing `UserActivityLogService`.
- Return `{ "token": "<jwt>" }`. **No cookie is set** (do not call
  `authCookieService`).
- Not in `PUBLIC_PATHS` — this endpoint is admin-authenticated.

### 2. Frontend — the Dashboard (login-as) button

In `GroupStudentPage.tsx`, add a per-row button (distinct from the existing
report "Dashboard" button that opens `/student/insight-dashboard`). On click:

```
const { data } = await axios.post(
  `${API_BASE_URL}/admin/impersonate/student/${student.userStudentId}`,
  {}, { withCredentials: true }            // carries the admin's cn_at
);
window.open(`/student/impersonate?t=${encodeURIComponent(data.token)}`,
            "_blank", "noopener");
```

Label/style to avoid confusion with the existing report Dashboard button (e.g.
"Open as Student" / person icon). Show a toast on mint failure (403/network).

### 3. Frontend — impersonation landing route `/student/impersonate`

New lazy route in `PrivateRoutes.tsx`, layout-free (no Metronic aside), modeled
on `StudentSsoLanding`:

1. Read `?t=`. If missing → toast + navigate `/auth/login`.
2. Write the JWT to `sessionStorage` under a dedicated key (e.g.
   `cn_impersonation_jwt`), then `history.replaceState` to drop `?t=` from the
   URL so the token does not persist in history/referrer.
3. Ensure the global impersonation interceptor is installed (see §4).
4. `GET /auth/me` (Bearer via interceptor, no cookie) to hydrate the canonical
   student user shape → `setCurrentUser(me)`.
5. `navigate('/student/dashboard', { replace: true })`.
6. Failure modes redirect to `/auth/login` with a toast, mirroring
   `StudentSsoLanding`.

### 4. Frontend — global axios request interceptor (the linchpin)

Installed once at app bootstrap (e.g. alongside existing axios setup). On every
request:

```
const jwt = sessionStorage.getItem('cn_impersonation_jwt');
if (jwt) {
  config.withCredentials = false;                      // do NOT send admin cn_at
  config.headers = config.headers ?? {};
  config.headers.Authorization = `Bearer ${jwt}`;
}
return config;
```

Because the trigger is `sessionStorage`, the interceptor is inert in admin tabs
and only active in the impersonation tab. It transparently redirects all of the
portal's `withCredentials:true` calls onto the Bearer path.

## Isolation guarantees (must hold)

- **`cn_at` untouched:** impersonation requests set `withCredentials:false`, so
  the admin's `cn_at` is never sent on them and the mint response sets no cookie.
  The admin's session survives intact in all their tabs.
- **Per-tab scope:** the JWT lives in `sessionStorage`, which is per-tab — admin
  tabs cannot see it.
- **`localStorage` caution:** the portal historically seeds student identifiers
  into `localStorage` (shared across tabs). During impersonation, identity must
  come from `currentUser` / `sessionStorage`, and the impersonation flow must
  **not** write student ids into `localStorage`, or it could clobber state in the
  admin's other tabs. Any portal code that reads `localStorage` for the current
  student id in the impersonation tab must be verified during implementation.

## Security

- Endpoint gated by `student.impersonate`; only holders can mint.
- JWT short-lived (the Phase 18 access-token TTL from `appProperties`); stripped
  from URL on landing. If that TTL is longer than desired for a URL-borne token,
  add a dedicated shorter impersonation TTL when minting.
- Audit-logged: who impersonated whom, when. Optional `impersonatedBy` JWT claim
  for per-request backend attribution.
- No new anonymous surface: unlike the entitlement SSO redeem endpoint (which is
  in `PUBLIC_PATHS`), this mint endpoint is admin-authenticated.

## Alternatives considered

- **Accept cookie clobber** (mint student `cn_at` like existing SSO): rejected —
  logs the admin out of their own session across all tabs.
- **Separate cookie name/path** (`cn_at_imp` read only on `/student/*`): rejected
  for v1 — requires backend filter changes and careful path coupling; the
  header-injection approach achieves isolation with no filter change.
- **One-time opaque code** exchanged for the JWT (instead of JWT-in-URL):
  reasonable extra hardening, deferred — the JWT is short-lived and stripped from
  the URL immediately, matching the existing `?t=` precedent. Can be layered on
  later if desired.

## Out of scope

- A visible "you are impersonating" banner / exit-impersonation control in the
  portal (nice follow-up; not required for the core request).
- Restricting which admins can impersonate which students by scope/ABAC beyond
  the flat `student.impersonate` permission.

## Testing

- Mint endpoint: authorized admin gets a token; unauthorized (missing
  `student.impersonate`) gets 403; unknown `userStudentId` → 404.
- Interceptor: with `sessionStorage` key set, requests carry Bearer and omit
  credentials; without it, requests are unchanged.
- End-to-end: admin clicks button → new tab authenticates as student → portal
  loads with student data → admin's original tab still authenticated as admin
  (verify `cn_at` unchanged, admin API calls still succeed).
- Isolation: confirm no student id is written to `localStorage` by the
  impersonation flow.
