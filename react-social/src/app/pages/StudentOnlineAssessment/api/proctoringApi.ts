import { ProctoringPayload } from '../types/proctoring';

export async function submitProctoringData(payload: ProctoringPayload): Promise<void> {
  const API_URL = process.env.REACT_APP_API_URL;

  const response = await fetch(`${API_URL}/assessment-proctoring/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to submit proctoring data: ${errorText}`);
  }
}
