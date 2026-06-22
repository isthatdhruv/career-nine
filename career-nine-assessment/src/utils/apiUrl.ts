/**
 * Build an absolute API URL from VITE_API_URL + a path, collapsing any
 * duplicate slash at the join.
 *
 * Why this exists: axios (src/api/http.ts) already normalises the join via its
 * internal combineURLs — a trailing slash on the baseURL plus a leading slash
 * on the request path collapse to a single `/`. The raw fetch() write paths
 * (save-partial, partial-restore, submit, feedback-rating, proctoring/save) do
 * NOT — they concatenate `${VITE_API_URL}${path}` as plain strings. So a single
 * stray trailing slash on VITE_API_URL (trivially introduced in a deploy env)
 * turns every fetch-based request into one containing `//`, which Spring
 * Security's StrictHttpFirewall rejects with RequestRejectedException (surfacing
 * as HTTP 500). The result is a baffling failure where the assessment loads fine
 * (axios GETs) but nothing can be saved or submitted (fetch writes).
 *
 * Routing the fetch paths through here makes them as robust as the axios path.
 *
 * @param path API path; may or may not start with a leading slash.
 */
const API_BASE = String(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export function apiUrl(path: string): string {
  return `${API_BASE}/${path.replace(/^\/+/, '')}`
}
