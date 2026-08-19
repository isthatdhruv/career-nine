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
// Admin dashboard: every appointment (eager slot/counsellor/student) — the admin
// Counselling Dashboard aggregates the funnel, live queue, per-counsellor and trend
// metrics from this single list client-side.
export function getAllAppointments() { return axios.get(`${BASE}/getAll`) }

// Session check-in (counsellor enters the student's OTP at the start of the session).
export function startSession(appointmentId: number) { return axios.post(`${BASE}/start/${appointmentId}`) }
export function verifyCheckin(appointmentId: number, code: string) { return axios.post(`${BASE}/verify-checkin/${appointmentId}`, { code }) }

// Counsellor dashboard headline summary (today's sessions + booked/free/upcoming counts).
export function getDashboardSummary(counsellorId: number) { return axios.get(`${API_URL}/api/counsellor/${counsellorId}/dashboard-summary`) }

// ── Cancellation and no-show (docs/COUNSELLING_CANCELLATION.md) ──────────────────
//
// Note these are separate routes rather than variants of `cancelAppointment` above.
// That legacy PUT takes a body-supplied userId and never checks whose appointment it is;
// the student route below proves ownership server-side before doing anything.

export interface StudentCancellationInfo {
  missesRemaining: number
  missAllowance: number
  cutoffHours: number
  forceShifted: boolean
  shiftedFromStart: string | null
}

/** Deadline + remaining-allowance figures for one session's card. */
export function getStudentCancellationInfo(appointmentId: number) {
  return axios.get<StudentCancellationInfo>(`${BASE}/student/cancellation-info/${appointmentId}`)
}

/** The student cancels her own session. `note` is required when reason is OTHER. */
export function studentCancelAppointment(appointmentId: number, reason: string, note?: string) {
  return axios.post(`${BASE}/student/cancel/${appointmentId}`, { reason, note })
}

/** The student contests an absent mark — suspends the strike until admin decides. */
export function disputeAttendance(appointmentId: number, note?: string) {
  return axios.post(`${BASE}/student/dispute/${appointmentId}`, { note })
}

/** Counsellor drops one session; the server re-places the student and reports the outcome. */
export function counsellorCancelAppointment(
  appointmentId: number, userId: number, reason: string, note?: string
) {
  return axios.post(`${BASE}/counsellor/cancel/${appointmentId}`, { userId, reason, note })
}

/** Counsellor records that the student did not appear. Session window only. */
export function markStudentAbsent(appointmentId: number, userId: number) {
  return axios.post(`${BASE}/mark-student-absent/${appointmentId}`, { userId })
}

/** Admin cancels a session — costs nobody anything, both parties emailed. */
export function adminCancelAppointment(appointmentId: number, userId: number, note?: string) {
  return axios.post(`${BASE}/admin/cancel/${appointmentId}`, { userId, note })
}

// ── Manage Sessions (admin, Manage Counsellors page) ────────────────────────────
//
// getCounsellorAppointments above returns the raw appointment, which names neither the
// assessment nor the report. These carry both, so the dialog can show what a session is
// about and whether there is a report to send before the admin presses anything.

export interface CounsellorSessionSummary {
  appointmentId: number
  studentName?: string
  studentEmail?: string
  parentEmail?: string
  instituteName?: string
  assessmentName?: string
  date?: string
  startTime?: string
  endTime?: string
  status?: string
  mode?: string
  counsellorName?: string
  counsellorEmail?: string
  /** null when the student's report has not been generated yet. */
  reportLink?: string | null
}

export function getCounsellorSessions(counsellorId: number) {
  return axios.get<CounsellorSessionSummary[]>(`${BASE}/by-counsellor/${counsellorId}/sessions`)
}

/**
 * The report for a single session — for screens showing one session rather than a list
 * (the counsellor's session-notes page, the Report button on their appointments list).
 *
 * `reportLink` is null until one has generated, and `status` says why:
 *   ready        — the link is there
 *   notGenerated — the student has finished, but no report has come through for them
 *   notCompleted — the student has not finished the assessment yet
 *   unavailable  — nothing names an assessment for this session, so there is no report to find
 */
export type SessionReportStatus = 'ready' | 'notGenerated' | 'notCompleted' | 'unavailable'

export function getSessionReportLink(appointmentId: number) {
  return axios.get<{ reportLink: string | null; status: SessionReportStatus }>(
    `${BASE}/${appointmentId}/report-link`
  )
}

/** Who was written to, and whether the report link made it into the email. */
export interface SessionMailResult {
  recipients: string[]
  reportIncluded: boolean
}

/** Send the session details, with the report link, to the student and parent/guardian. */
export function emailSessionToStudent(appointmentId: number) {
  return axios.post<SessionMailResult>(`${BASE}/${appointmentId}/email/student`)
}

/** Send the session details, with the report link, to the counsellor taking it. */
export function emailSessionToCounsellor(appointmentId: number) {
  return axios.post<SessionMailResult>(`${BASE}/${appointmentId}/email/counsellor`)
}

export function getAttendanceDisputes() { return axios.get(`${BASE}/disputes`) }

export function resolveAttendanceDispute(
  appointmentId: number, userId: number, upheld: boolean, note?: string
) {
  return axios.post(`${BASE}/disputes/resolve/${appointmentId}`, { userId, upheld, note })
}
