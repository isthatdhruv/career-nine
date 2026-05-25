import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/student-counsellor-mapping`

export function assignStudentToCounsellor(studentId: number, counsellorId: number, adminUserId: number, notes?: string) {
  return axios.post(`${BASE}/assign`, { studentId, counsellorId, adminUserId, notes: notes || '' })
}
export function getStudentsForCounsellor(counsellorId: number) { return axios.get(`${BASE}/by-counsellor/${counsellorId}`) }
export function getCounsellorsForStudent(studentId: number) { return axios.get(`${BASE}/by-student/${studentId}`) }
export function getAllMappings() { return axios.get(`${BASE}/getAll`) }
export function deactivateMapping(id: number) { return axios.put(`${BASE}/deactivate/${id}`) }
export function bulkAssignStudents(counsellorId: number, studentIds: number[], adminUserId: number) {
  return axios.post(`${BASE}/bulk-assign`, { counsellorId, studentIds, adminUserId })
}
