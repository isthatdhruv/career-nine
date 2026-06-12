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
export function assignCounsellor(counsellorId: number, assessmentId: number, assignedBy?: number) {
  return axios.post(`${BASE}/assign`, { counsellorId, assessmentId, assignedBy })
}
export function toggleAssignment(id: number) {
  return axios.put(`${BASE}/toggle/${id}`)
}
export function deleteAssignment(id: number) {
  return axios.delete(`${BASE}/${id}`)
}
