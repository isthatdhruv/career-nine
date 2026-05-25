import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/counselling-rating`

export interface PendingRatingAppointment {
  id: number
  status: string
  counsellor?: { id: number; name?: string }
  slot?: { date: string; startTime: string; endTime: string; durationMinutes?: number }
  studentReason?: string
}

export function createRating(appointmentId: number, rating: number, review: string) {
  return axios.post(`${BASE}/create`, { appointmentId, rating, review })
}

export function getRatingByAppointment(appointmentId: number) {
  return axios.get(`${BASE}/by-appointment/${appointmentId}`)
}

export function getPendingRatingsForStudent(studentId: number) {
  return axios.get<PendingRatingAppointment[]>(`${BASE}/pending-for-student/${studentId}`)
}

export function getCounsellorRatings(counsellorId: number) {
  return axios.get(`${BASE}/by-counsellor/${counsellorId}`)
}
