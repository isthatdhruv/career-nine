/**
 * Background partial save of student answers to Redis (crash-recovery copy).
 * Called on section transitions and pagehide.
 *
 * Returns whether the save actually succeeded so callers can mark the
 * snapshot as saved ONLY on success — the old fire-and-forget version
 * swallowed every failure while the caller had already recorded the snapshot
 * as saved, so a save dropped by flaky venue WiFi was never retried and the
 * whole section silently vanished from the recovery copy.
 *
 * - up to 3 attempts with 1s/2s backoff on network error or 5xx
 * - keepalive: the browser finishes an in-flight save even if the tab
 *   navigates or closes right after firing it
 *
 * Phase 19: `credentials: 'include'` is required so the browser sends the
 * `cn_at_asmnt` HttpOnly cookie minted by POST /auth/assessment-session.
 * The legacy v2.0 path (X-Assessment-Session header) is NOT injected here
 * because this is a raw fetch, not the axios http instance — that path is
 * preserved on the axios instance in `./http.ts`. The backend will accept
 * either path during the backwards-compat window (per Plan 19-01).
 */
export async function savePartialAnswers(payload: Record<string, any>): Promise<boolean> {
  const csrfMatch = document.cookie.match(/(?:^|;\s*)cn_csrf=([^;]*)/)
  const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : undefined
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  }
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken

  const body = JSON.stringify(payload)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/assessment-answer/save-partial`, {
        method: "POST",
        credentials: "include", // Phase 19: send cn_at_asmnt cookie on the partial-save call
        headers,
        body,
        keepalive: true,
      })
      if (res.ok) return true
      // 4xx won't improve on retry (auth/validation) — bail immediately
      if (res.status < 500) return false
    } catch {
      // network error — fall through to retry
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
    }
  }
  return false
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
