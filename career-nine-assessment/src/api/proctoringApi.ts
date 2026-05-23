import { ProctoringPayload } from '../types/proctoring';

const BASE_URL = import.meta.env.VITE_API_URL;

export async function submitProctoringData(payload: ProctoringPayload): Promise<Response> {
  const csrfMatch = document.cookie.match(/(?:^|;\s*)cn_csrf=([^;]*)/)
  const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : undefined
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken

  return fetch(`${BASE_URL}/assessment-proctoring/save`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
}
