import axios from "axios";
import { InsightDashboardDTO } from "./insightTypes";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

/**
 * Fetch the per-student Insight Dashboard. The engine is resolved server-side
 * from the student's generated report; assessmentId is optional (defaults to the
 * most recently generated report).
 */
export function getInsightDashboard(
  userStudentId: number | string,
  assessmentId?: number | string,
  audience: "admin" | "student" = "admin"
) {
  const params: Record<string, string | number> = { audience };
  if (assessmentId) params.assessmentId = assessmentId;
  return axios.get<InsightDashboardDTO>(`${API_URL}/dashboard/insight/${userStudentId}`, {
    params,
  });
}

/**
 * Student self-service: returns the logged-in student's OWN dashboard. The
 * student is resolved server-side from their session cookie, so no id is passed.
 * Always uses the "student" audience (entitlement gate applied).
 */
export function getMyInsightDashboard(assessmentId?: number | string) {
  return axios.get<InsightDashboardDTO>(`${API_URL}/dashboard/insight/me`, {
    params: assessmentId ? { assessmentId } : undefined,
  });
}
