import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

/**
 * Build-time feature flag for Phase 19 cookie-based assessment auth.
 *
 * When true, the SPA is expected to call POST /auth/assessment-session after
 * student-identity resolution; the backend mints a 4h `scope=assessment` JWT
 * in an HttpOnly `cn_at_asmnt` cookie (Plan 19-01). The browser then attaches
 * the cookie automatically on every same-origin XHR (driven by
 * `withCredentials: true` below) for /assessments/**, /assessment-answer/**,
 * /student-demographics/**, /heartbeat/**, /assessment-proctoring/**,
 * /live-tracking/** and /student-info/** calls.
 *
 * Default `false` (production builds opt out). Staging builds can opt in by
 * setting VITE_ASSESSMENT_COOKIE_AUTH=true; the per-institute server flag
 * (InstituteDetail.assessmentCookieAuthEnabled — see Plan 19-01) gates the
 * runtime path on top of this build flag.
 */
export const COOKIE_AUTH_FLAG =
  String(import.meta.env.VITE_ASSESSMENT_COOKIE_AUTH || '').toLowerCase() === 'true'

/**
 * Runtime override for the build-time flag. Flipped to `false` by the mint
 * helper when POST /auth/assessment-session fails. The cookie is then the
 * only auth carrier we have — the legacy X-Assessment-Session header fallback
 * was removed because the SPA never wrote `assessmentSessionToken` anywhere,
 * making it dead code that produced 401s on every authenticated call.
 *
 * Starts mirroring COOKIE_AUTH_FLAG. A successful re-mint flips it back true.
 * `resetAuthState()` restores it to the build-time default — call on student
 * login so a prior tab-scoped failure doesn't bleed into the new session.
 */
let cookieAuthRuntimeActive = COOKIE_AUTH_FLAG

export function setCookieAuthRuntimeActive(active: boolean) {
  cookieAuthRuntimeActive = active
}

export function isCookieAuthRuntimeActive(): boolean {
  return cookieAuthRuntimeActive
}

/**
 * Reset request-side auth state to its build-time defaults. Used by the
 * student login page so a fresh login does not inherit a prior tab's
 * cookieAuthRuntimeActive=false state (set by a transient mint failure) and
 * does not carry the prior CSRF token. The HttpOnly `cn_at_asmnt` cookie
 * cannot be cleared from JS — POST /auth/logout handles that server-side.
 */
export function resetAuthState() {
  console.log('[ASSESS-SESSION-DEBUG] resetAuthState() called — clearing cn_csrf, resetting runtime flag'
    + ' pathname=' + (typeof window !== 'undefined' ? window.location.pathname : 'n/a'))
  cookieAuthRuntimeActive = COOKIE_AUTH_FLAG
  document.cookie = 'cn_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  /**
   * Phase 19 — REQUIRED so the browser attaches the cn_at_asmnt HttpOnly cookie
   * on every cross-origin XHR to the API origin. NOTE: backend CORS must respond
   * with an explicit `Access-Control-Allow-Origin: <SPA-origin>` (NOT `*`) AND
   * `Access-Control-Allow-Credentials: true`, otherwise the browser silently
   * drops the cookie. Tracked as an open question for Phase 16/20 infra owners.
   */
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 60000,
})

/**
 * Request interceptor. The cn_at_asmnt HttpOnly cookie is the sole auth
 * carrier — `withCredentials: true` above sends it on every same-origin XHR.
 * State-changing methods mirror the JS-readable cn_csrf cookie into the
 * X-CSRF-Token header so Spring Security's CsrfFilter passes.
 *
 * The previous v2.0 X-Assessment-* header fallback was removed: the SPA
 * never wrote `assessmentSessionToken` to sessionStorage, so the fallback
 * always shipped requests with no session identity and produced 401s on
 * every authenticated call when the cookie path was inactive.
 */
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = (config.method || 'get').toUpperCase()
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const match = document.cookie.match(/(?:^|;\s*)cn_csrf=([^;]*)/)
    if (match) {
      ;(config.headers as any)['X-CSRF-Token'] = decodeURIComponent(match[1])
    }
  }
  return config
})

/**
 * Endpoints that are anonymous-by-design and MUST NOT trigger the
 * Phase 19-05 permission-denied redirect when they 401/403. These are public
 * B2C funnels (registration, promo lookup, payment status, magic-link
 * redemption) — failures here should bubble to the calling component as a
 * normal error so it can render an in-page toast / banner.
 *
 * Without this carve-out a stale `cn_at_asmnt` cookie from a previous testing
 * session (4h TTL expired) attached to a POST `/campaign/public/register/...`
 * tips a fresh student onto the permission-denied page mid-registration.
 */
const PUBLIC_ENDPOINT_PATTERNS: RegExp[] = [
  /\/campaign\/public\//,
  /\/promo-code\//,
  /\/entitlement\/redeem-token/,
  /\/payment\/webhook\/(status|info)\//,
  /\/auth\/(login|logout|refresh|assessment-session)/,
  /\/public\//,   // catches /bet-report-data/public/, /navigator-report-data/public/, etc.
]

function isPublicEndpoint(url: string | undefined): boolean {
  if (!url) return false
  return PUBLIC_ENDPOINT_PATTERNS.some((re) => re.test(url))
}

/**
 * Response interceptor — two responsibilities:
 *
 *   1. Retry on network errors and 5xx with exponential backoff (mirrors the
 *      retry policy of the legacy react-social assessmentApi.ts so the
 *      cookie path is no less resilient than v2.0).
 *
 *   2. Phase 19 (Plan 19-05): on 403, redirect the user to the SPA's
 *      /permission-denied page (with ?from=<original path>). When cookie
 *      auth is the active mechanism, an expired/invalid cn_at_asmnt
 *      surfaces as 401 (header path emits 403 instead) — so we also
 *      redirect on 401-while-cookie-auth-active. The redirect is skipped
 *      when already on the denied page to avoid an infinite loop, AND when
 *      the failing request was a public endpoint (registration funnel,
 *      payment polling, magic-link redemption) — those need to surface the
 *      error in-page rather than throw the student onto a session-expiry UI.
 *
 *      The retry logic runs FIRST: a transient 5xx still gets retried;
 *      only after retries are exhausted (or for a non-retryable 403/401)
 *      does the redirect fire.
 */
http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (AxiosRequestConfig & { __retryCount?: number }) | undefined

    console.log(
      '[ASSESS-SESSION-DEBUG] interceptor error url=' + (config?.url ?? 'n/a') +
      ' method=' + (config?.method ?? 'n/a') +
      ' status=' + (error.response?.status ?? 'no-response') +
      ' cookieAuthRuntimeActive=' + cookieAuthRuntimeActive +
      ' cookies=' + (typeof document !== 'undefined' ? document.cookie : 'n/a')
    )

    // 1) Retry on network / 5xx with exponential backoff.
    if (config) {
      const retryCount = config.__retryCount || 0
      const isRetryable = !error.response || error.response.status >= 500
      if (isRetryable && retryCount < MAX_RETRIES) {
        config.__retryCount = retryCount + 1
        const delay = BASE_DELAY_MS * Math.pow(2, config.__retryCount - 1)
        console.log(
          '[ASSESS-SESSION-DEBUG] interceptor RETRY url=' + config.url +
          ' attempt=' + config.__retryCount + '/' + MAX_RETRIES + ' delayMs=' + delay
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        return http(config)
      }
    }

    // 2) Phase 19 (Plan 19-05): redirect to /permission-denied on 403, and on
    //    401 when cookie auth is active. Guard against window being absent
    //    (tests / SSR) and skip the redirect when already on the denied page,
    //    when the failing request was a public B2C endpoint, OR when the user
    //    is on a pre-login page where 401s are expected (e.g. the username-blur
    //    prefetch on /student-login fires before any cookie has been minted).
    const status = error.response?.status
    if (typeof window !== 'undefined') {
      const path = window.location.pathname
      const isDeniedPage = path.endsWith('/permission-denied')
      const isPreLoginPage = path === '/' || path === '/student-login'
      const publicCall = isPublicEndpoint(config?.url)
      const shouldRedirect =
        !isDeniedPage &&
        !isPreLoginPage &&
        !publicCall &&
        (status === 403 || (status === 401 && cookieAuthRuntimeActive))
      console.log(
        '[ASSESS-SESSION-DEBUG] interceptor redirect-decision status=' + status +
        ' path=' + path +
        ' isDeniedPage=' + isDeniedPage +
        ' isPreLoginPage=' + isPreLoginPage +
        ' publicCall=' + publicCall +
        ' shouldRedirect=' + shouldRedirect
      )
      if (shouldRedirect) {
        const from = encodeURIComponent(path + window.location.search)
        console.log('[ASSESS-SESSION-DEBUG] interceptor REDIRECTING TO /permission-denied from=' + path)
        window.location.href = `/permission-denied?from=${from}`
      }
    }

    return Promise.reject(error)
  }
)

/**
 * Maps an AxiosError to a user-friendly error message string.
 *
 * 401 is new in Phase 19 — the v2.0 X-Assessment-Session interceptor only
 * emitted 403. With cookie auth, expired/invalid cn_at_asmnt fails Spring
 * Security's authenticated() check and surfaces as 401.
 */
export function getErrorMessage(error: AxiosError): string {
  if (!error.response) {
    return 'Unable to connect to the server. Please check your internet connection and try again.'
  }
  switch (error.response.status) {
    case 401:
      return 'Your assessment session has expired. Please re-open your assessment link.'
    case 403:
      return 'Your assessment session has expired. Please return to the assessment list and start again.'
    case 409:
      return 'Your assessment has already been submitted successfully.'
    case 400: {
      const data = error.response.data
      return typeof data === 'string' ? data : 'Invalid submission data. Please try again.'
    }
    case 500:
      return 'The server encountered an error. Your answers are saved. Please try again in a moment.'
    default:
      return 'An unexpected error occurred. Please try again.'
  }
}

export default http
