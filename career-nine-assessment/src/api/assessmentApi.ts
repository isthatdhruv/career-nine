/**
 * Fire-and-forget partial save of student answers to DB.
 * Called on every section transition as a safety net against browser crashes.
 * Errors are silently swallowed — this is a best-effort background save.
 */
export function savePartialAnswers(payload: Record<string, any>): void {
  fetch(`${import.meta.env.VITE_API_URL}/assessment-answer/save-partial`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
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
