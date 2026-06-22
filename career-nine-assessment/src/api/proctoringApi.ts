import { ProctoringPayload } from '../types/proctoring';
import { timeoutSignal } from '../utils/timeoutSignal';
import { apiUrl } from '../utils/apiUrl';

export async function submitProctoringData(payload: ProctoringPayload): Promise<Response> {
  const csrfMatch = document.cookie.match(/(?:^|;\s*)cn_csrf=([^;]*)/)
  const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : undefined
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken

  return fetch(apiUrl('/assessment-proctoring/save'), {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(payload),
    // 30s (was 10s): even with per-question sample capping this is the
    // largest payload the student app sends, and it ships at event end over
    // congested venue WiFi. timeoutSignal (not AbortSignal.timeout) so older
    // school browsers don't throw a synchronous TypeError before the request
    // even starts.
    signal: timeoutSignal(30000),
  });
}
