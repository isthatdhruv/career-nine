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
