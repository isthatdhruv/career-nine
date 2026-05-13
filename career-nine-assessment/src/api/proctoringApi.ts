import { ProctoringPayload } from '../types/proctoring';

const BASE_URL = import.meta.env.VITE_API_URL;

export async function submitProctoringData(payload: ProctoringPayload): Promise<Response> {
  return fetch(`${BASE_URL}/assessment-proctoring/save`, {
    method: 'POST',
    credentials: 'include', // Phase 19: send cn_at_asmnt cookie on proctoring submit
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
}
