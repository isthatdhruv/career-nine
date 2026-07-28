import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";
const BASE = `${API_URL}/dashboard/cohort-insights`;

export interface CohortDimension {
  name: string;
  avgNormPct: number;
}

export interface CohortInsightPayload {
  studentCount: number;
  riasecAverage: CohortDimension[];
  logicVersion: string;
  note?: string;
}

export interface CohortInsightView {
  instituteCode: number;
  assessmentId: number;
  status: "PENDING" | "GENERATING" | "GENERATED" | "FAILED" | null;
  logicVersion: string | null;
  currentLogicVersion: string;
  logicStale: boolean;
  includedCount: number | null;
  completedCount: number | null;
  newSinceGeneration: number;
  computedAt: string | null;
  payload: CohortInsightPayload | null;
}

/** Superadmin: enqueue async generation. Returns { enqueued }. */
export function generateCohortInsight(instituteCode: number, assessmentId: number) {
  return axios.post<{ enqueued: boolean }>(
    `${BASE}/${instituteCode}/${assessmentId}/generate`
  );
}

/** School admin: read the stored cohort insight view for one assessment card. */
export function getCohortInsight(instituteCode: number, assessmentId: number) {
  return axios.get<CohortInsightView>(`${BASE}/${instituteCode}/${assessmentId}`);
}
