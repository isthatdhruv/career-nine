import { AuthModel } from "./_models";

const AUTH_LOCAL_STORAGE_KEY = "kt-auth-react-v";

// Phase 16: localStorage JWT is DEAD. cn_at is an HttpOnly cookie. The
// functions below are kept as no-op stubs so any legacy callers do not
// crash; remove them entirely in a Phase-16 follow-up cleanup once
// authRedirectPage.tsx (Plan 16-04) no longer references them.
const getAuth = (): AuthModel | undefined => undefined;
const setAuth = (_auth: AuthModel): void => {
  // intentionally a no-op
};
const removeAuth = (): void => {
  // intentionally a no-op
};

// Read a cookie value by name from document.cookie. Returns null if absent.
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const target = name + "=";
  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (let raw of cookies) {
    const c = raw.trim();
    if (c.startsWith(target)) {
      return decodeURIComponent(c.substring(target.length));
    }
  }
  return null;
}

const CSRF_COOKIE_NAME = "cn_csrf";
const CSRF_HEADER_NAME = "X-CSRF-Token";
const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Phase 18: silent-refresh-and-retry-once.
 *
 * - On 401 from a non-/auth/* endpoint, call POST /auth/refresh (cookies auto-sent
 *   via withCredentials), then retry the original request EXACTLY ONCE.
 * - Concurrent 401s share a single in-flight refresh promise (dedupe).
 * - If refresh fails OR retry still returns 401, log out and redirect to /auth.
 *
 * Why an in-flight promise (not a request queue):
 *   When the dashboard fans out 6 simultaneous API calls and all return 401, we want
 *   ONE /auth/refresh call (not 6). The promise stored in module scope is the join
 *   point — every concurrent 401 awaits the same promise, then retries its own
 *   original request once the refresh resolves.
 */
let inFlightRefresh: Promise<void> | null = null;

function isAuthFlowUrl(url: string | undefined): boolean {
  if (!url) return false;
  // Treat /auth/login, /auth/signup, /auth/refresh, /auth/logout, /auth/me as
  // "auth-flow" endpoints — a 401 on any of these must NOT trigger silent refresh.
  // (A 401 on /auth/refresh would recurse infinitely; 401 on the others means the
  // user's responsibility, not a token-expiry problem.)
  return /\/auth\/(login|signup|refresh|logout|me)\b/.test(url);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function performRefresh(axios: any): Promise<void> {
  // Pin the call so concurrent 401s await the SAME promise.
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      try {
        await axios.post(
          "/auth/refresh",
          {},
          {
            withCredentials: true,
            // Mark this request so the response interceptor never tries to silently
            // refresh THIS call (defense in depth — isAuthFlowUrl already handles it,
            // but explicit is better).
            __isRefreshCall: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any
        );
      } finally {
        // Clear the reference AFTER the promise settles so subsequent 401s start a
        // fresh refresh cycle. Done in a microtask via setTimeout(0) so any retries
        // queued in `then` callbacks of the current promise complete first.
        setTimeout(() => {
          inFlightRefresh = null;
        }, 0);
      }
    })();
  }
  return inFlightRefresh;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setupAxios(axios: any) {
  // Send the cn_at HttpOnly cookie on every request to our API.
  axios.defaults.withCredentials = true;
  axios.defaults.headers.Accept = "application/json";

  // Request interceptor: copy CSRF cookie to header on state-changing methods.
  axios.interceptors.request.use(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (config: any) => {
      const method = (config.method || "get").toUpperCase();
      if (STATE_CHANGING.has(method)) {
        const csrf = readCookie(CSRF_COOKIE_NAME);
        if (csrf) {
          config.headers = config.headers || {};
          config.headers[CSRF_HEADER_NAME] = csrf;
        }
      }
      // Ensure withCredentials at the per-call level too (defensive — some
      // call sites pass their own `config` and may have overridden defaults).
      if (config.withCredentials !== false) {
        config.withCredentials = true;
      }
      return config;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err: any) => Promise.reject(err)
  );

  axios.interceptors.response.use(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (response: any) => response,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (error: any) => {
      if (!error.response) {
        const { showErrorToast } = require("../../../utils/toast");
        showErrorToast("Connection issue, check your internet");
        return Promise.reject(error);
      }

      const status = error.response.status;
      const message = error.response?.data?.message || "";
      const originalConfig = error.config || {};
      const url: string | undefined = originalConfig?.url;

      if (status === 401) {
        // 1) Never silently refresh for auth-flow endpoints OR the refresh call itself.
        if (isAuthFlowUrl(url) || originalConfig.__isRefreshCall) {
          const { showErrorToast } = require("../../../utils/toast");
          showErrorToast("Session expired, please log in again");
          removeAuth();
          window.location.href = "/auth";
          return Promise.reject(error);
        }

        // 2) Never retry twice. If we've already attempted a silent refresh for THIS
        //    request, give up.
        if (originalConfig.__hasRetriedAfterRefresh) {
          const { showErrorToast } = require("../../../utils/toast");
          showErrorToast("Session expired, please log in again");
          removeAuth();
          window.location.href = "/auth";
          return Promise.reject(error);
        }

        // 3) Silent refresh (deduped via inFlightRefresh).
        try {
          await performRefresh(axios);
        } catch (refreshError) {
          // Refresh itself failed → log out, no retry.
          const { showErrorToast } = require("../../../utils/toast");
          showErrorToast("Session expired, please log in again");
          removeAuth();
          window.location.href = "/auth";
          return Promise.reject(refreshError);
        }

        // 4) Refresh succeeded — retry the original request exactly once.
        originalConfig.__hasRetriedAfterRefresh = true;
        try {
          return await axios.request(originalConfig);
        } catch (retryError) {
          // If retry returns 401, this same interceptor re-enters and the
          // __hasRetriedAfterRefresh guard above handles the logout path.
          return Promise.reject(retryError);
        }
      }

      if (status === 403) {
        const { showErrorToast } = require("../../../utils/toast");
        showErrorToast(message || "You don't have permission for this action");
        // Phase 19 (Plan 19-05): on 403, redirect the user to the persona-
        // appropriate /permission-denied page (in addition to the toast,
        // which gives instant feedback while the redirect happens).
        //
        // Persona is inferred from the current URL prefix:
        //   /student/*   → /student/permission-denied
        //   /counsellor/* → /counsellor/permission-denied
        //   anything else → /permission-denied (admin variant)
        //
        // ?from=<encoded original path> lets the page surface what the user
        // tried to open. The redirect uses window.location.href because the
        // axios interceptor runs outside React's router context.
        try {
          const path = window.location.pathname;
          const search = window.location.search;
          // Avoid infinite loop if already on a permission-denied page.
          if (!path.endsWith("/permission-denied")) {
            const from = encodeURIComponent(path + search);
            let dest = "/permission-denied";
            if (path.startsWith("/student/")) dest = "/student/permission-denied";
            else if (path.startsWith("/counsellor/")) dest = "/counsellor/permission-denied";
            window.location.href = `${dest}?from=${from}`;
          }
        } catch {
          // window may be unavailable in tests / SSR — fall through to reject.
        }
        return Promise.reject(error);
      }

      if (status >= 500) {
        const { showErrorToast } = require("../../../utils/toast");
        showErrorToast(message || "Something went wrong, please try again");
        return Promise.reject(error);
      }

      // 400, 409, and other client errors pass through to the component
      return Promise.reject(error);
    }
  );
}

export { getAuth, setAuth, removeAuth, AUTH_LOCAL_STORAGE_KEY };
