import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/counselling-appointment`

export function bookSlot(slotId: number, studentId: number, reason: string) { return axios.post(`${BASE}/book`, { slotId, studentId, reason }) }
export function getQueue() { return axios.get(`${BASE}/queue`) }
export function assignCounsellor(appointmentId: number, counsellorId: number, adminUserId: number) { return axios.put(`${BASE}/assign/${appointmentId}`, { counsellorId, adminUserId }) }
export function confirmAppointment(appointmentId: number, userId: number) { return axios.put(`${BASE}/confirm/${appointmentId}`, { userId }) }
export function declineAppointment(appointmentId: number, userId: number, reason: string) { return axios.put(`${BASE}/decline/${appointmentId}`, { userId, reason }) }
export function cancelAppointment(appointmentId: number, userId: number, reason: string) { return axios.put(`${BASE}/cancel/${appointmentId}`, { userId, reason }) }
export function rescheduleAppointment(appointmentId: number, newSlotId: number, userId: number) { return axios.put(`${BASE}/reschedule/${appointmentId}`, { newSlotId, userId }) }
export function setMeetingLink(appointmentId: number, meetingLink: string) { return axios.put(`${BASE}/set-meeting-link/${appointmentId}`, { meetingLink }) }
export function getStudentAppointments(studentId: number) { return axios.get(`${BASE}/by-student/${studentId}`) }
export function getCounsellorAppointments(counsellorId: number) { return axios.get(`${BASE}/by-counsellor/${counsellorId}`) }
export function getAppointmentStats() { return axios.get(`${BASE}/stats`) }

// Session check-in (counsellor enters the student's OTP at the start of the session).
export function startSession(appointmentId: number) { return axios.post(`${BASE}/start/${appointmentId}`) }
export function verifyCheckin(appointmentId: number, code: string) { return axios.post(`${BASE}/verify-checkin/${appointmentId}`, { code }) }

// Counsellor dashboard headline summary (today's sessions + booked/free/upcoming counts).
export function getDashboardSummary(counsellorId: number) { return axios.get(`${API_URL}/api/counsellor/${counsellorId}/dashboard-summary`) }
