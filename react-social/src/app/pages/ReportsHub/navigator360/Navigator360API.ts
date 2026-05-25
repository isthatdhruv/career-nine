// ═══════════════════════════════════════════════════════════════════════════
// Navigator 360 — API Layer
// Fetches intermediary scores from the backend for Navigator 360 computation
// ═══════════════════════════════════════════════════════════════════════════

import axios from 'axios';
import { IntermediaryScores } from './Navigator360Types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

/**
 * Fetch raw intermediary scores for a student's assessment.
 * Returns RIASEC, Aptitude, MI scores and Section A/B/C selections.
 */
export async function fetchNavigator360Scores(
  studentId: number,
  assessmentId: number
): Promise<IntermediaryScores> {
  const response = await axios.get<IntermediaryScores>(
    `${API_URL}/navigator-report-data/navigator-360/scores/${studentId}/${assessmentId}`
  );
  return response.data;
}
