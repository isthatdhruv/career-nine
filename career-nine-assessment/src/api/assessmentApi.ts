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
  const csrfMatch = document.cookie.match(/(?:^|;\s*)cn_csrf=([^;]*)/)
  const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : undefined
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  }
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken

  fetch(`${import.meta.env.VITE_API_URL}/assessment-answer/save-partial`, {
    method: "POST",
    credentials: "include", // Phase 19: send cn_at_asmnt cookie on the partial-save call
    headers,
    body: JSON.stringify(payload),
  }).catch(() => {}); // fire-and-forget
}

/**
 * Restore the most recent partial-answer snapshot for a student+assessment
 * from Redis. Returns the parsed payload `{ answers: [...], savedAt }` or
 * null if no snapshot exists (404, network error, or non-OK response).
 *
 * Called once on SectionQuestionPage mount to hydrate React state without
 * touching localStorage. Redis is the single source of truth for in-progress
 * answer state.
 */
export async function restorePartialAnswers(
  studentId: number,
  assessmentId: number,
): Promise<{ answers: any[]; savedAt?: string } | null> {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/assessment-answer/partial-restore/${studentId}/${assessmentId}`,
      {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.answers)) return null;
    return data as { answers: any[]; savedAt?: string };
  } catch {
    return null;
  }
}
