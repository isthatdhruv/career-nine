import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/student-management`

export interface ManagedStudent {
  userStudentId: number
  userId: number
  name?: string
  grade?: string
  counsellingAllowed: boolean
  reportsVisible: boolean
  infoCompleted: boolean
}

export function getStudentsByInstitute(instituteCode: number) {
  return axios.get<ManagedStudent[]>(`${BASE}/by-institute/${instituteCode}`)
}

export function setCounsellingAllowed(userStudentId: number, value: boolean) {
  return axios.put(`${BASE}/counselling-allowed/${userStudentId}`, { value })
}

export function setReportsVisible(userStudentId: number, value: boolean) {
  return axios.put(`${BASE}/reports-visible/${userStudentId}`, { value })
}
