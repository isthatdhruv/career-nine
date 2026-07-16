import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/counsellor-assessment`

// Counselling Phase 4 — admin assigns counsellors to assessments. The student
// booking flow then only offers slots from counsellors assigned to their assessment.
export function getAssignmentsByAssessment(assessmentId: number) {
  return axios.get(`${BASE}/by-assessment/${assessmentId}`)
}
export function getAssignmentsByCounsellor(counsellorId: number) {
  return axios.get(`${BASE}/by-counsellor/${counsellorId}`)
}

// Same rows enriched with the assessment name — used by the counsellor portal
// dashboard to list "assessments I counsel for".
export interface CounsellorAssessmentDetail {
  id: number
  assessmentId: number
  assessmentName?: string
  isActive?: boolean
}
export function getAssignmentsByCounsellorDetailed(counsellorId: number) {
  return axios.get<CounsellorAssessmentDetail[]>(`${BASE}/by-counsellor/${counsellorId}/detailed`)
}
export function assignCounsellor(counsellorId: number, assessmentId: number, assignedBy?: number) {
  return axios.post(`${BASE}/assign`, { counsellorId, assessmentId, assignedBy })
}
export function toggleAssignment(id: number) {
  return axios.put(`${BASE}/toggle/${id}`)
}
export function deleteAssignment(id: number) {
  return axios.delete(`${BASE}/${id}`)
}

// Assessment ids with counselling toggled on in at least one active tier — the
// assignment page only offers these in its assessment dropdown.
export function getCounsellingEnabledAssessments() {
  return axios.get<number[]>(`${BASE}/counselling-enabled-assessments`)
}

// Students who requested counselling on the thank-you page for an assessment that
// has no counsellor mapped yet. Assigning a counsellor auto-closes these.
export interface PendingCounsellingRequest {
  id: number
  userStudentId: number
  assessmentId: number
  assessmentName?: string
  studentName?: string
  studentEmail?: string
  studentPhone?: string
  instituteCode?: number | null
  instituteName?: string
  createdAt?: string
}
export function getPendingCounsellingRequests() {
  return axios.get<PendingCounsellingRequest[]>(`${BASE}/pending-requests`)
}
