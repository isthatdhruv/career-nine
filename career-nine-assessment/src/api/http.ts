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
 * Runtime override for the build-time flag. Flipped to `false` by
 * DataContext / login pages when POST /auth/assessment-session returns 404
 * (per-institute flag off for the current student). The request interceptor
 * below reads this flag — when false, it falls back to injecting the v2.0
 * X-Assessment-* headers (header path); when true, the cookie is the source
 * of truth and the legacy headers are NOT injected.
 *
 * The runtime flag starts mirroring COOKIE_AUTH_FLAG. Mint failure paths
 * (404 from per-institute disabled OR 5xx/network from a transient backend
 * error) flip it to false for the lifetime of the tab; the SPA stays on the
 * legacy path until reload.
 */
let cookieAuthRuntimeActive = COOKIE_AUTH_FLAG

export function setCookieAuthRuntimeActive(active: boolean) {
  cookieAuthRuntimeActive = active
}

export function isCookieAuthRuntimeActive(): boolean {
  return cookieAuthRuntimeActive
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
 * Request interceptor — feature-flag-gated v2.0 header fallback.
 *
 * When cookie auth is active (build flag on AND mint succeeded), we DO NOT
 * inject the legacy headers — the cn_at_asmnt cookie is the source of truth.
 *
 * When cookie auth is inactive (build flag off OR mint returned 404/error),
 * inject `X-Assessment-Session` / `X-Assessment-Student-Id` / `X-Assessment-Id`
 * exactly as the legacy react-social `assessmentApi.ts` did. This preserves
 * the v2.0 backwards-compat path for the one-release window.
 */
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (cookieAuthRuntimeActive) {
    return config
  }
  const sessionToken = sessionStorage.getItem('assessmentSessionToken')
  const userStudentId = localStorage.getItem('userStudentId')
  const assessmentId = localStorage.getItem('assessmentId')
  if (sessionToken) (config.headers as any)['X-Assessment-Session'] = sessionToken
  if (userStudentId) (config.headers as any)['X-Assessment-Student-Id'] = userStudentId
  if (assessmentId) (config.headers as any)['X-Assessment-Id'] = assessmentId
  return config
})

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
 *      when already on the denied page to avoid an infinite loop.
 *
 *      The retry logic runs FIRST: a transient 5xx still gets retried;
 *      only after retries are exhausted (or for a non-retryable 403/401)
 *      does the redirect fire.
 */
http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (AxiosRequestConfig & { __retryCount?: number }) | undefined

    // 1) Retry on network / 5xx with exponential backoff.
    if (config) {
      const retryCount = config.__retryCount || 0
      const isRetryable = !error.response || error.response.status >= 500
      if (isRetryable && retryCount < MAX_RETRIES) {
        config.__retryCount = retryCount + 1
        const delay = BASE_DELAY_MS * Math.pow(2, config.__retryCount - 1)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return http(config)
      }
    }

    // 2) Phase 19 (Plan 19-05): redirect to /permission-denied on 403, and on
    //    401 when cookie auth is active. Guard against window being absent
    //    (tests / SSR) and skip the redirect when already on the denied page.
    const status = error.response?.status
    if (typeof window !== 'undefined') {
      const path = window.location.pathname
      const isDeniedPage = path.endsWith('/permission-denied')
      const shouldRedirect =
        !isDeniedPage &&
        (status === 403 || (status === 401 && cookieAuthRuntimeActive))
      if (shouldRedirect) {
        const from = encodeURIComponent(path + window.location.search)
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
