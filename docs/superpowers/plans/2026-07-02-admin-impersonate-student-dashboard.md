# Admin "Log in as student" from Data Download — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-student button on the Data Download page that opens a new tab authenticated as that student on the real student portal dashboard, without disturbing the admin's own session.

**Architecture:** An admin-authorized backend endpoint mints a short-lived student JWT (no cookie). A new tab opens `/student/impersonate?t=<jwt>`, moves the JWT into per-tab `sessionStorage`, strips it from the URL, and a global axios request interceptor injects it as `Authorization: Bearer` with `withCredentials:false` on every own-API call. With the cookie not sent, the backend's existing Bearer fallback authenticates as the student; the admin's `cn_at` is never sent or overwritten. Because Bearer requests can't be CSRF-forged, state-changing requests carrying a Bearer header are exempted from CSRF so full impersonation (incl. profile writes) works.

**Tech Stack:** Spring Boot (Java, Maven, JUnit/Mockito), React (TypeScript, react-scripts/Jest, axios), Flyway (MySQL).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-02-admin-impersonate-student-dashboard-design.md`.
- The admin's `cn_at` cookie must never be overwritten or sent on impersonation requests.
- Impersonation identity lives ONLY in `sessionStorage` (per-tab). Never write student ids to `localStorage` in this flow.
- New backend controller methods MUST carry `@PreAuthorize` (enforced by `ControllerPreAuthorizeCoverageTest`).
- Every `PermissionCode` enum value MUST have a seed row (enforced by `PermissionCatalogSeedCoverageTest`) — a new permission needs a Flyway migration.
- Own-API base URL (frontend): `process.env.REACT_APP_API_URL`. Assessment app URL constant is unrelated — do not use it here.
- Super-admins bypass all `@auth.allows()` checks (so `admin@career-9.net` can impersonate before any grant exists).

---

### Task 1: Add `student.impersonate` permission (enum + seed)

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/security/PermissionCode.java` (Student block ~line 47-49)
- Create: `spring-social/src/main/resources/db/migration/V20260702001__seed_student_impersonate_permission.sql`
- Test (existing, must pass): `spring-social/src/test/java/com/kccitm/api/archtest/PermissionCatalogSeedCoverageTest.java`

**Interfaces:**
- Produces: enum constant `PermissionCode.STUDENT_IMPERSONATE` with code string `"student.impersonate"`, used by Task 3's `@PreAuthorize`.

- [ ] **Step 1: Add the enum constant**

In `PermissionCode.java`, in the Student block, after `STUDENT_IMPORT_BULK`:

```java
    STUDENT_READ        ("student.read",        "View students"),
    STUDENT_WRITE       ("student.write",       "Create or update students"),
    STUDENT_IMPORT_BULK ("student.import_bulk", "Bulk-import students from CSV/Excel"),
    STUDENT_IMPERSONATE ("student.impersonate", "Open a student's dashboard as that student (admin impersonation)"),
```

- [ ] **Step 2: Create the Flyway seed migration**

Create `V20260702001__seed_student_impersonate_permission.sql`:

```sql
-- ---------------------------------------------------------------------------
-- V20260702001__seed_student_impersonate_permission.sql
--
-- Seeds the student.impersonate permission (PermissionCode.STUDENT_IMPERSONATE),
-- which gates POST /admin/impersonate/student/{userStudentId} — the Data Download
-- "Open as Student" action that mints a short-lived student JWT for admin
-- impersonation.
--
-- Idempotent: ON DUPLICATE KEY UPDATE (re-runnable; matches V20260521001).
-- Seeded WITHOUT an automatic role grant: impersonation is privileged, so the
-- correct role assignment is environment-specific and made via the Roles &
-- Permissions UI. Super-admins bypass all checks and can use it immediately.
-- ---------------------------------------------------------------------------

INSERT INTO permission (code, description) VALUES
  ('student.impersonate', 'Open a student''s dashboard as that student (admin impersonation)')
ON DUPLICATE KEY UPDATE description = VALUES(description);
```

- [ ] **Step 3: Run the seed-coverage arch test**

Run: `cd spring-social && ./mvnw -q -Dtest=PermissionCatalogSeedCoverageTest test`
Expected: PASS (enum↔seed parity holds with the new code seeded).

- [ ] **Step 4: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/security/PermissionCode.java \
        spring-social/src/main/resources/db/migration/V20260702001__seed_student_impersonate_permission.sql
git commit -m "feat(auth): add student.impersonate permission + seed"
```

---

### Task 2: Exempt Bearer-authenticated requests from CSRF

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java` (CSRF chain ~line 350-356; add a static helper + imports)
- Create: `spring-social/src/test/java/com/kccitm/api/config/CsrfProtectionMatcherTest.java`
- Test (existing, must still pass): `spring-social/src/test/java/com/kccitm/api/controller/AuthLifecycleIT.java`

**Interfaces:**
- Produces: `static boolean SecurityConfig.requiresCsrfProtection(HttpServletRequest request, String[] publicPaths)` — false for safe methods, `PUBLIC_PATHS`, or any request carrying an `Authorization: Bearer` header; true otherwise.

**Why:** With impersonation using `withCredentials:false`, the `cn_csrf` cookie is not sent, so state-changing impersonation requests (e.g. profile PUT) would fail Spring's CSRF check. A request carrying an `Authorization: Bearer` header cannot be forged cross-site (the browser will not attach that header on a forged request), so it is inherently CSRF-safe and is exempted. This preserves the existing safe-method and `PUBLIC_PATHS` exemptions (folding `PUBLIC_PATHS` into the same predicate keeps the CSRF-exempt and auth-exempt sets sourced from one constant, as the existing code requires).

- [ ] **Step 1: Write the failing test**

Create `CsrfProtectionMatcherTest.java`:

```java
package com.kccitm.api.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CsrfProtectionMatcherTest {

    private static final String[] PUBLIC = { "/auth/login", "/entitlement/redeem-dashboard-token" };

    @Test
    void safeMethodsAreNotProtected() {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/student-portal/my-info/1");
        assertFalse(SecurityConfig.requiresCsrfProtection(req, PUBLIC));
    }

    @Test
    void bearerAuthenticatedWritesAreNotProtected() {
        MockHttpServletRequest req = new MockHttpServletRequest("PUT", "/student-portal/update-info/1");
        req.addHeader("Authorization", "Bearer abc.def.ghi");
        assertFalse(SecurityConfig.requiresCsrfProtection(req, PUBLIC));
    }

    @Test
    void publicPathWritesAreNotProtected() {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/auth/login");
        assertFalse(SecurityConfig.requiresCsrfProtection(req, PUBLIC));
    }

    @Test
    void cookieAuthenticatedWritesAreProtected() {
        MockHttpServletRequest req = new MockHttpServletRequest("PUT", "/student-portal/update-info/1");
        assertTrue(SecurityConfig.requiresCsrfProtection(req, PUBLIC));
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd spring-social && ./mvnw -q -Dtest=CsrfProtectionMatcherTest test`
Expected: FAIL — `requiresCsrfProtection` does not exist (compile error).

- [ ] **Step 3: Add the helper and wire the matcher**

In `SecurityConfig.java`, add imports near the other imports:

```java
import javax.servlet.http.HttpServletRequest;
import org.springframework.util.AntPathMatcher;
```

Add the static helper (place it near `PUBLIC_PATHS`):

```java
    /**
     * CSRF-protection predicate. Returns false (no CSRF token required) for:
     *   - safe/idempotent methods (GET/HEAD/TRACE/OPTIONS),
     *   - the anonymous-by-design PUBLIC_PATHS set (no prior cn_csrf exists),
     *   - any request carrying an Authorization: Bearer header — the browser
     *     never attaches that header on a forged cross-site request, so a
     *     Bearer-authenticated call cannot be CSRF-forged. This is what lets the
     *     cookie-less admin student-impersonation session issue writes.
     * Returns true (CSRF required) for every other state-changing request —
     * i.e. cookie-authenticated writes, exactly as before.
     */
    static boolean requiresCsrfProtection(HttpServletRequest request, String[] publicPaths) {
        String method = request.getMethod();
        if ("GET".equals(method) || "HEAD".equals(method)
                || "TRACE".equals(method) || "OPTIONS".equals(method)) {
            return false;
        }
        String authz = request.getHeader("Authorization");
        if (authz != null && authz.startsWith("Bearer ")) {
            return false;
        }
        String uri = request.getRequestURI();
        String ctx = request.getContextPath();
        String path = (ctx != null && !ctx.isEmpty() && uri.startsWith(ctx))
                ? uri.substring(ctx.length()) : uri;
        AntPathMatcher matcher = new AntPathMatcher();
        for (String p : publicPaths) {
            if (matcher.match(p, path)) return false;
        }
        return true;
    }
```

Replace the CSRF exemption line:

```java
                .ignoringAntMatchers(PUBLIC_PATHS)
```

with:

```java
                .requireCsrfProtectionMatcher(
                        request -> requiresCsrfProtection(request, PUBLIC_PATHS))
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `cd spring-social && ./mvnw -q -Dtest=CsrfProtectionMatcherTest test`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the auth integration test to confirm no regression**

Run: `cd spring-social && ./mvnw -q -Dtest=AuthLifecycleIT test`
Expected: PASS (existing login/CSRF behavior for cookie sessions unchanged).

- [ ] **Step 6: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java \
        spring-social/src/test/java/com/kccitm/api/config/CsrfProtectionMatcherTest.java
git commit -m "feat(auth): exempt Bearer-authenticated requests from CSRF"
```

---

### Task 3: Backend mint endpoint

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/controller/ImpersonationController.java`
- Create: `spring-social/src/test/java/com/kccitm/api/controller/ImpersonationControllerTest.java`

**Interfaces:**
- Consumes: `PermissionCode.STUDENT_IMPERSONATE` (Task 1); `CsrfProtectionMatcher` bearer exemption (Task 2).
- Produces: `POST /admin/impersonate/student/{userStudentId}` → `200 { "token": "<jwt>" }`; `404` if the student/user is missing. Reuses `CustomUserDetailsService.loadUserById(userId)` and `TokenProvider.createAccessToken(UserPrincipal)` (both already used by `EntitlementController.redeemDashboardToken`).

- [ ] **Step 1: Write the failing test**

Create `ImpersonationControllerTest.java`:

```java
package com.kccitm.api.controller;

import com.kccitm.api.model.UserStudent;
import com.kccitm.api.repository.UserStudentRepository;
import com.kccitm.api.security.CustomUserDetailsService;
import com.kccitm.api.security.TokenProvider;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.UserActivityLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

class ImpersonationControllerTest {

    private UserStudentRepository userStudentRepository;
    private CustomUserDetailsService customUserDetailsService;
    private TokenProvider tokenProvider;
    private UserActivityLogService userActivityLogService;
    private ImpersonationController controller;

    @BeforeEach
    void setup() {
        userStudentRepository = Mockito.mock(UserStudentRepository.class);
        customUserDetailsService = Mockito.mock(CustomUserDetailsService.class);
        tokenProvider = Mockito.mock(TokenProvider.class);
        userActivityLogService = Mockito.mock(UserActivityLogService.class);
        controller = new ImpersonationController(
                userStudentRepository, customUserDetailsService,
                tokenProvider, userActivityLogService);
    }

    @Test
    void returnsTokenForExistingStudent() {
        UserStudent us = new UserStudent();
        us.setUserId(42L);
        when(userStudentRepository.findById(7L)).thenReturn(Optional.of(us));

        UserPrincipal principal = Mockito.mock(UserPrincipal.class);
        when(principal.getId()).thenReturn(42L);
        when(principal.getUsername()).thenReturn("stud42");
        when(principal.getEmail()).thenReturn("s42@example.com");
        when(customUserDetailsService.loadUserById(42L)).thenReturn(principal);
        when(tokenProvider.createAccessToken(principal)).thenReturn("minted.jwt.token");

        ResponseEntity<?> resp = controller.impersonateStudent(7L, new MockHttpServletRequest());

        assertEquals(200, resp.getStatusCodeValue());
        assertEquals("minted.jwt.token", ((Map<?, ?>) resp.getBody()).get("token"));
    }

    @Test
    void returns404WhenStudentMissing() {
        when(userStudentRepository.findById(99L)).thenReturn(Optional.empty());
        ResponseEntity<?> resp = controller.impersonateStudent(99L, new MockHttpServletRequest());
        assertEquals(404, resp.getStatusCodeValue());
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd spring-social && ./mvnw -q -Dtest=ImpersonationControllerTest test`
Expected: FAIL — `ImpersonationController` does not exist (compile error).

- [ ] **Step 3: Create the controller**

Create `ImpersonationController.java`:

```java
package com.kccitm.api.controller;

import com.kccitm.api.model.UserStudent;
import com.kccitm.api.repository.UserStudentRepository;
import com.kccitm.api.security.CustomUserDetailsService;
import com.kccitm.api.security.TokenProvider;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.UserActivityLogService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Admin impersonation: mints a short-lived student JWT so an admin can open the
 * student portal dashboard AS that student, in a new tab, without a cookie.
 *
 * <p>The token is returned in the body (no Set-Cookie). The frontend keeps it in
 * per-tab sessionStorage and sends it as Authorization: Bearer with
 * withCredentials:false, so the admin's own cn_at cookie is never touched. The
 * minting path mirrors EntitlementController.redeemDashboardToken (same
 * loadUserById + createAccessToken) so the JWT validates identically downstream.
 */
@RestController
public class ImpersonationController {

    private final UserStudentRepository userStudentRepository;
    private final CustomUserDetailsService customUserDetailsService;
    private final TokenProvider tokenProvider;
    private final UserActivityLogService userActivityLogService;

    public ImpersonationController(UserStudentRepository userStudentRepository,
                                   CustomUserDetailsService customUserDetailsService,
                                   TokenProvider tokenProvider,
                                   UserActivityLogService userActivityLogService) {
        this.userStudentRepository = userStudentRepository;
        this.customUserDetailsService = customUserDetailsService;
        this.tokenProvider = tokenProvider;
        this.userActivityLogService = userActivityLogService;
    }

    @PreAuthorize("@auth.allows('student.impersonate')")
    @PostMapping("/admin/impersonate/student/{userStudentId}")
    public ResponseEntity<?> impersonateStudent(@PathVariable Long userStudentId,
                                                HttpServletRequest request) {
        Optional<UserStudent> usOpt = userStudentRepository.findById(userStudentId);
        if (!usOpt.isPresent() || usOpt.get().getUserId() == null) {
            return ResponseEntity.status(404).body("Student user not found");
        }

        UserPrincipal principal;
        try {
            principal = (UserPrincipal) customUserDetailsService.loadUserById(usOpt.get().getUserId());
        } catch (RuntimeException ex) {
            return ResponseEntity.status(404).body("Student user not found");
        }

        String jwt = tokenProvider.createAccessToken(principal);

        // Audit: record who impersonated whom (organisation field carries the
        // impersonating admin's id/email; there is no login event for the student
        // otherwise). Best-effort — never block the mint on a logging failure.
        Long adminId = null;
        String adminEmail = null;
        Authentication authn = SecurityContextHolder.getContext().getAuthentication();
        if (authn != null && authn.getPrincipal() instanceof UserPrincipal) {
            UserPrincipal admin = (UserPrincipal) authn.getPrincipal();
            adminId = admin.getId();
            adminEmail = admin.getEmail();
        }
        userActivityLogService.logLogin(
                principal.getId(), principal.getUsername(), principal.getEmail(),
                "IMPERSONATED_BY:" + adminId + ":" + adminEmail,
                UserActivityLogService.getClientIp(request),
                request.getHeader("User-Agent"));

        Map<String, Object> response = new HashMap<>();
        response.put("token", jwt);
        return ResponseEntity.ok(response);
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd spring-social && ./mvnw -q -Dtest=ImpersonationControllerTest test`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the PreAuthorize coverage arch test**

Run: `cd spring-social && ./mvnw -q -Dtest=ControllerPreAuthorizeCoverageTest test`
Expected: PASS (the new endpoint carries `@PreAuthorize`).

- [ ] **Step 6: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/controller/ImpersonationController.java \
        spring-social/src/test/java/com/kccitm/api/controller/ImpersonationControllerTest.java
git commit -m "feat(auth): mint endpoint for admin student impersonation"
```

---

### Task 4: Frontend axios interceptor — impersonation Bearer injection

**Files:**
- Modify: `react-social/src/app/modules/auth/core/AuthHelpers.ts` (`setupAxios`, request + response interceptors)
- Modify: `react-social/src/app/modules/auth/core/AuthHelpers.test.ts` (add cases)

**Interfaces:**
- Produces: exported const `IMPERSONATION_STORAGE_KEY = "cn_impersonation_jwt"` and behavior: when `sessionStorage[IMPERSONATION_STORAGE_KEY]` is set and the request targets our own API, the request carries `Authorization: Bearer <jwt>` and `withCredentials:false`; a 401 in impersonation mode does NOT trigger admin refresh. Consumed by Task 5 (landing writes the key) and Task 6.

- [ ] **Step 1: Write the failing test**

In `AuthHelpers.test.ts`, add (adapt to the file's existing `setupAxios(axios)` + `makeAdapter(routes)` harness — the harness lets you assert on the outgoing config):

```ts
import { IMPERSONATION_STORAGE_KEY } from "./AuthHelpers";

describe("impersonation interceptor", () => {
  afterEach(() => sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY));

  it("injects Bearer and disables credentials when impersonating an own-API call", async () => {
    sessionStorage.setItem(IMPERSONATION_STORAGE_KEY, "imp.jwt.token");
    let seen: any = null;
    axios.defaults.adapter = (async (config: any) => {
      seen = config;
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    }) as any;

    await axios.get(`${process.env.REACT_APP_API_URL}/student-portal/my-info/1`);

    expect(seen.headers.Authorization).toBe("Bearer imp.jwt.token");
    expect(seen.withCredentials).toBe(false);
  });

  it("leaves credentials on and adds no Bearer when not impersonating", async () => {
    let seen: any = null;
    axios.defaults.adapter = (async (config: any) => {
      seen = config;
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    }) as any;

    await axios.get(`${process.env.REACT_APP_API_URL}/student-portal/my-info/1`);

    expect(seen.headers.Authorization).toBeUndefined();
    expect(seen.withCredentials).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd react-social && CI=true npx react-scripts test AuthHelpers.test.ts --watchAll=false`
Expected: FAIL — `IMPERSONATION_STORAGE_KEY` is not exported / Bearer not injected.

- [ ] **Step 3: Implement in `setupAxios`**

Near the top of `AuthHelpers.ts` (module scope), export the key and a reader:

```ts
export const IMPERSONATION_STORAGE_KEY = "cn_impersonation_jwt";

function readImpersonationJwt(): string | null {
  try {
    return typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(IMPERSONATION_STORAGE_KEY)
      : null;
  } catch {
    return null;
  }
}
```

Replace the body of the existing request interceptor with (keeps CSRF/scope/sanitize behavior for normal calls, adds impersonation):

```ts
    (config: any) => {
      const impJwt = readImpersonationJwt();
      const ownApi = isOwnApiUrl(config.url);
      const impersonating = !!impJwt && ownApi;
      const method = (config.method || "get").toUpperCase();

      if (impersonating) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${impJwt}`;
      } else if (STATE_CHANGING.has(method)) {
        const csrf = readCookie(CSRF_COOKIE_NAME);
        if (csrf) {
          config.headers = config.headers || {};
          config.headers[CSRF_HEADER_NAME] = csrf;
        }
      }

      if (ownApi) {
        config.headers = config.headers || {};
        config.headers[AUTH_SCOPE_HEADER] = AUTH_SCOPE_VALUE;
      }

      // Impersonation is cookie-less: never send the admin's cn_at on these
      // requests (that would authenticate as the admin, not the student, and the
      // backend prefers the cookie over the Bearer token).
      if (impersonating) {
        config.withCredentials = false;
      } else if (config.withCredentials !== false) {
        config.withCredentials = true;
      }

      if (config.data && !(config.data instanceof FormData)) {
        const { sanitizePayload } = require("../../../utils/sanitizeText");
        config.data = sanitizePayload(config.data);
      }
      return config;
    },
```

In the response interceptor's `if (status === 401) {` branch, add at the very top of that block (before any refresh attempt):

```ts
        // Impersonation sessions have no refresh token; a 401 means the short
        // student JWT lapsed. Don't run the admin refresh path — surface it.
        if (readImpersonationJwt()) {
          const { showErrorToast } = require("../../../utils/toast");
          showErrorToast("Impersonation session expired. Reopen from Data Download.");
          return Promise.reject(error);
        }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd react-social && CI=true npx react-scripts test AuthHelpers.test.ts --watchAll=false`
Expected: PASS (both new cases + existing cases).

- [ ] **Step 5: Commit**

```bash
git add react-social/src/app/modules/auth/core/AuthHelpers.ts \
        react-social/src/app/modules/auth/core/AuthHelpers.test.ts
git commit -m "feat(auth): axios impersonation Bearer injection (cookie-less)"
```

---

### Task 5: Frontend impersonation landing route

**Files:**
- Create: `react-social/src/app/pages/StudentDashboard/student-portal/StudentImpersonationLanding.tsx`
- Modify: `react-social/src/app/routing/PrivateRoutes.tsx` (lazy import + `<Route>`)

**Interfaces:**
- Consumes: `IMPERSONATION_STORAGE_KEY` (Task 4).
- Produces: route `GET /student/impersonate?t=<jwt>` that establishes the session and redirects to `/student/dashboard`.

- [ ] **Step 1: Create the landing component**

Create `StudentImpersonationLanding.tsx` (modeled on `StudentSsoLanding.tsx`):

```tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { toAbsoluteUrl } from "../../../../_metronic/helpers";
import { useAuth } from "../../../modules/auth/core/Auth";
import { IMPERSONATION_STORAGE_KEY } from "../../../modules/auth/core/AuthHelpers";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8091";

/**
 * Admin impersonation landing. Opened in a NEW TAB by the Data Download
 * "Open as Student" button as /student/impersonate?t=<studentJwt>. We move the
 * JWT into per-tab sessionStorage (never a cookie, never localStorage — so the
 * admin's other tabs are untouched), strip it from the URL, hydrate the student
 * user via /auth/me (Bearer, no cookie), and land on /student/dashboard.
 */
const StudentImpersonationLanding: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setCurrentUser } = useAuth();
  const [status, setStatus] = useState<"establishing" | "failed">("establishing");
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const token = searchParams.get("t");
    if (!token) {
      toast.error("Missing impersonation link.");
      navigate("/login", { replace: true });
      return;
    }

    // Store per-tab and strip the token from the URL/history immediately.
    sessionStorage.setItem(IMPERSONATION_STORAGE_KEY, token);
    window.history.replaceState({}, document.title, "/student/impersonate");

    let cancelled = false;
    (async () => {
      try {
        // Bearer is injected by the global interceptor (reads sessionStorage).
        const { data: me } = await axios.get(`${API_BASE_URL}/auth/me`, {
          headers: { Accept: "application/json" },
        });
        if (cancelled) return;
        if (me) {
          setCurrentUser(me);
          navigate("/student/dashboard", { replace: true });
        } else {
          throw new Error("no user");
        }
      } catch {
        if (cancelled) return;
        sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY);
        setStatus("failed");
        toast.error("Could not open the student dashboard. The link may have expired.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams, setCurrentUser]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F7FA" }}>
      <div style={{ textAlign: "center" }}>
        <img src={toAbsoluteUrl("/media/logos/kcc.jpg")} alt="Career-9" style={{ height: 32, marginBottom: 16 }} />
        <div style={{ color: "#6B7A8D", fontSize: 14 }}>
          {status === "establishing" ? "Opening student dashboard…" : "Link expired or invalid."}
        </div>
      </div>
    </div>
  );
};

export default StudentImpersonationLanding;
```

- [ ] **Step 2: Register the route**

In `PrivateRoutes.tsx`, add the lazy import beside the other student-portal imports:

```tsx
  const StudentImpersonationLanding = lazy(
    () => import("../pages/StudentDashboard/student-portal/StudentImpersonationLanding")
  );
```

Add the route near the other layout-free `/student/*` standalone routes (e.g. next to `/student/dashboard-preview`):

```tsx
      {/* Admin impersonation landing — opened in a new tab by the Data Download
          "Open as Student" button. Establishes a cookie-less student session
          from ?t=<jwt> and redirects to /student/dashboard. Layout-free; no
          RequirePermission (the minted student JWT is the authorization). */}
      <Route path="/student/impersonate" element={
        <SuspensedView>
          <StudentImpersonationLanding />
        </SuspensedView>
      } />
```

- [ ] **Step 3: Verify it compiles**

Run: `cd react-social && npx tsc --noEmit`
Expected: exit 0 (no type errors).

- [ ] **Step 4: Commit**

```bash
git add react-social/src/app/pages/StudentDashboard/student-portal/StudentImpersonationLanding.tsx \
        react-social/src/app/routing/PrivateRoutes.tsx
git commit -m "feat(portal): impersonation landing route /student/impersonate"
```

---

### Task 6: "Open as Student" button on Data Download

**Files:**
- Modify: `react-social/src/app/pages/GroupStudent/GroupStudentPage.tsx` (per-row action buttons, near the existing "Dashboard" button ~line 2913-2940)

**Interfaces:**
- Consumes: `POST /admin/impersonate/student/{userStudentId}` (Task 3); route `/student/impersonate` (Task 5).

- [ ] **Step 1: Add the handler**

In `GroupStudentPage.tsx`, add a handler (near the other row handlers). Use the own-API base URL:

```tsx
  const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8091";

  const handleOpenAsStudent = async (student: any) => {
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/admin/impersonate/student/${student.userStudentId}`,
        {},
        { withCredentials: true } // carries the admin's cn_at to authorize the mint
      );
      if (data?.token) {
        window.open(
          `/student/impersonate?t=${encodeURIComponent(data.token)}`,
          "_blank",
          "noopener"
        );
      } else {
        toast.error("Could not start impersonation.");
      }
    } catch (e: any) {
      const code = e?.response?.status;
      toast.error(
        code === 403
          ? "You don't have permission to open a student's dashboard."
          : "Could not open the student dashboard."
      );
    }
  };
```

(If `axios` and `toast` are not already imported in this file, add `import axios from "axios";` and `import { toast } from "react-toastify";`.)

- [ ] **Step 2: Add the button**

In the per-row action cluster (next to the existing report "Dashboard" button), add a visually distinct button so it isn't confused with the report one:

```tsx
                              <button
                                className="btn btn-sm d-flex align-items-center gap-1"
                                onClick={() => handleOpenAsStudent(student)}
                                title="Open this student's dashboard logged in as them"
                                style={{
                                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                                  color: "#fff",
                                  border: "none",
                                  padding: "5px 10px",
                                  borderRadius: "6px",
                                  fontWeight: 600,
                                  fontSize: "0.78rem",
                                  transition: "all 0.2s",
                                  boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <i className="bi bi-box-arrow-up-right"></i>
                                Open as Student
                              </button>
```

- [ ] **Step 3: Verify it compiles**

Run: `cd react-social && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add react-social/src/app/pages/GroupStudent/GroupStudentPage.tsx
git commit -m "feat(data-download): 'Open as Student' impersonation button"
```

---

### Task 7: End-to-end manual verification

**Files:** none (runtime verification).

- [ ] **Step 1: Start backend and frontend** (per project run scripts).

- [ ] **Step 2: As an admin, open Data Download**, click "Open as Student" on a row.
  - Expected: a new tab opens, shows "Opening student dashboard…", then lands on `/student/dashboard` showing that student's portal. URL bar shows `/student/impersonate` with no `?t=` (token stripped), then `/student/dashboard`.

- [ ] **Step 3: Confirm admin session is intact.** Back in the original admin tab, navigate/refresh an admin page and make an admin API call.
  - Expected: still authenticated as the admin (the `cn_at` cookie was never overwritten). Check DevTools → Application → Cookies: `cn_at` value unchanged.

- [ ] **Step 4: Exercise a student write in the impersonation tab** (e.g. the student-info form PUT, if the student can edit).
  - Expected: succeeds (Bearer request is CSRF-exempt). No 403.

- [ ] **Step 5: Confirm isolation.** In DevTools for the impersonation tab: `sessionStorage` has `cn_impersonation_jwt`; `localStorage` has NOT gained a student id from this flow. The admin tab's `sessionStorage` does not contain the key.

- [ ] **Step 6: Confirm audit.** A `user_activity_log` row exists for the student with `organisation` = `IMPERSONATED_BY:<adminId>:<adminEmail>`.

---

## Self-Review

**Spec coverage:**
- Backend mint endpoint (§Components 1) → Task 3. ✅
- No cookie / token-in-URL isolation (§Chosen approach) → Tasks 3 (no Set-Cookie), 4 (withCredentials:false), 5 (sessionStorage + URL strip). ✅
- Global axios interceptor (§Components 4) → Task 4. ✅
- Landing route (§Components 3) → Task 5. ✅
- Dashboard button (§Components 2) → Task 6. ✅
- New `student.impersonate` permission (§Chosen approach) → Task 1. ✅
- Full impersonation incl. writes → Task 2 (CSRF Bearer exemption — a detail discovered during planning; the spec's "no backend filter change" holds, but a CSRF-matcher change is required for writes and is documented here). ✅
- Audit logging (§Security) → Task 3. ✅
- `localStorage` caution (§Isolation) → Task 5 (never writes it) + Task 7 verification. ✅
- Testing (§Testing) → Tasks 1-4 unit/arch tests + Task 7 E2E. ✅

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `IMPERSONATION_STORAGE_KEY` (defined Task 4) used verbatim in Tasks 4/5. `requiresCsrfProtection(HttpServletRequest, String[])` defined and tested in Task 2. `impersonateStudent(Long, HttpServletRequest)` defined and tested in Task 3. `handleOpenAsStudent(student)` self-contained in Task 6.

**Deviation from spec:** the spec claimed no backend change beyond the mint endpoint; planning surfaced that cookie-less writes need CSRF handling. Task 2 adds a small, standard CSRF exemption for Bearer requests. This is called out prominently for reviewer awareness.
