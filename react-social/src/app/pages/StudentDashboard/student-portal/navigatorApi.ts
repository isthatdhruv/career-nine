// ─────────────────────────────────────────────────────────────────────────────
// Student-self navigator API. The Navigator 360 dashboard is PRECOMPUTED at
// report-generation time (ReportService → generated_report.navigator_dashboard_json)
// and read directly here via self-scoped /generated-reports/me/navigator* endpoints
// (the student is resolved from the session cookie — own data only).
// ─────────────────────────────────────────────────────────────────────────────
import axios from 'axios'

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8091'

/** Lean per-assessment summary (GET /generated-reports/me/navigator). */
export interface NavigatorReportCard {
  assessmentId: number
  reportStatus: string | null
  /** true when navigator_dashboard_json is populated (i.e. the dashboard is ready). */
  hasDashboard: boolean
  pdfUrl: string | null
  reportUrl: string | null
  updatedAt: string | null
}

/** One scored dimension (RIASEC / ability / MI). */
export interface ScoredDimension {
  name: string
  rawScore: number
  normPct: number
  stanine: number
  level: string
}

export interface CareerMatch {
  career?: { name?: string; id?: string; degreePaths?: string[] }
  pScore: number
  aScore: number
  iScore: number
  valuesMatch: number
  suitability: number
  suitability9: number
  potentialMatch: number
  isAspiration: boolean
}

/** Precomputed Navigator360Result (serialised by the backend engine). */
export interface NavigatorDashboard {
  studentName?: string
  studentClass?: string
  gradeGroup?: string
  riasec?: ScoredDimension[]
  abilities?: ScoredDimension[]
  mi?: ScoredDimension[]
  careerAspirations?: string[]
  values?: string[]
  subjectsOfInterest?: string[]
  potentialScore?: { personality: number; intelligence: number; ability: number; academic: number; total: number; completionPct: number }
  preferenceScore?: { p1Values: number; p2Aspirations: number; p3Culture: number; p4Subjects: number; total: number }
  careerMatches?: CareerMatch[]
  topCareers?: CareerMatch[]
  cci?: { applicable: boolean; pct: number | null; band: string }
  alignmentScore?: number
  hollandCode?: string
  hardFail?: boolean
  [key: string]: any
}

export interface NavigatorDashboardResponse {
  assessmentId: number
  pdfUrl: string | null
  reportUrl: string | null
  dashboard: NavigatorDashboard
}

/** All navigator report summaries for the signed-in student (one per generated assessment). */
export async function getMyNavigatorReports(): Promise<NavigatorReportCard[]> {
  const { data } = await axios.get(`${API_URL}/generated-reports/me/navigator`)
  return Array.isArray(data) ? data : []
}

/** The precomputed Navigator 360 dashboard for one of the student's own assessments. */
export async function getMyNavigatorReport(assessmentId: number): Promise<NavigatorDashboardResponse> {
  const { data } = await axios.get(`${API_URL}/generated-reports/me/navigator/${assessmentId}`)
  return data
}
