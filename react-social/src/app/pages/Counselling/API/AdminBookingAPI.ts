import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/counselling/admin`

// A student who completed the selected assessment. `hasUpcomingAppointment` flags
// the ones who already have an upcoming counselling session (shown in the "already
// booked" list; the admin chooses whether to re-book them).
export interface CompletedStudentRow {
  studentId: number
  name?: string
  email?: string
  hasUpcomingAppointment: boolean
}

export interface StudentBrief {
  studentId: number
  name?: string
  email?: string
}

// A student in the "already booked" list — their brief plus a snapshot of the current
// upcoming session (with whom + when), so the row can show the counsellor/timing and
// offer a counsellor change.
export interface BookedStudentRow extends StudentBrief {
  appointmentId?: number
  counsellorId?: number
  counsellorName?: string
  date?: string
  startTime?: string
  endTime?: string
}

export interface BulkPreview {
  assessmentId: number
  totalCompleted: number
  toBook: StudentBrief[]
  toBookCount: number
  alreadyBooked: BookedStudentRow[]
  alreadyBookedCount: number
  availableSlotCount: number
}

// The new booking a rebook produced — same snapshot shape as an already-booked row.
export interface RebookResult extends BookedStudentRow {
  studentId: number
}

export interface BookedBrief extends StudentBrief {
  appointmentId?: number
  slotId?: number
  date?: string
  startTime?: string
  endTime?: string
  counsellorId?: number
  counsellorName?: string
}

export interface UnbookedBrief extends StudentBrief {
  reason?: string
}

export interface BulkResult {
  assessmentId: number
  requestedCount: number
  bookedCount: number
  booked: BookedBrief[]
  unbookedCount: number
  unbooked: UnbookedBrief[]
}

// Students who completed an assessment (+ already-booked flag).
export function getStudentsForAssessment(assessmentId: number) {
  return axios.get<CompletedStudentRow[]>(`${BASE}/assessment/${assessmentId}/students`)
}

// Bulk allotment dry-run (counts, already-booked list, capacity, overflow).
export function getBulkPreview(assessmentId: number) {
  return axios.get<BulkPreview>(`${BASE}/bulk-allot/preview/${assessmentId}`)
}

// Bulk allotment confirm. `studentIds` = the exact students the admin ticked to book
// (union of the "to book" and "already booked / re-book" selections).
export function confirmBulkAllot(assessmentId: number, studentIds: number[]) {
  return axios.post<BulkResult>(`${BASE}/bulk-allot/confirm`, { assessmentId, studentIds })
}

// Single-student booking — admin picks the slot.
export function bookForStudent(studentId: number, slotId: number, reason?: string) {
  return axios.post(`${BASE}/book-for-student`, { studentId, slotId, reason })
}

// Change counsellor & rebook: moves an upcoming appointment onto the earliest available slot
// of the chosen counsellor. `userId` is the acting admin (optional — used only for the audit).
export function rebookWithCounsellor(appointmentId: number, counsellorId: number, userId?: number) {
  return axios.post<RebookResult>(`${BASE}/rebook-with-counsellor`, { appointmentId, counsellorId, userId })
}
