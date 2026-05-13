/**
 * Fire-and-forget partial save of student answers to DB.
 * Called on every section transition as a safety net against browser crashes.
 * Errors are silently swallowed — this is a best-effort background save.
 *
 * Phase 19: `credentials: 'include'` is required so the browser sends the
 * `cn_at_asmnt` HttpOnly cookie minted by POST /auth/assessment-session.
 * The legacy v2.0 path (X-Assessment-Session header) is NOT injected here
 * because this is a raw fetch, not the axios http instance — that path is
 * preserved on the axios instance in `./http.ts`. The backend will accept
 * either path during the backwards-compat window (per Plan 19-01).
 */
export function savePartialAnswers(payload: Record<string, any>): void {
  fetch(`${import.meta.env.VITE_API_URL}/assessment-answer/save-partial`, {
    method: "POST",
    credentials: "include", // Phase 19: send cn_at_asmnt cookie on the partial-save call
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  }).catch(() => {}); // fire-and-forget
}
