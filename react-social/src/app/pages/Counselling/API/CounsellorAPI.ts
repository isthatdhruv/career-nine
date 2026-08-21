import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/counsellor`

export function createCounsellor(data: any) { return axios.post(`${BASE}/create`, data) }
export function getAllCounsellors() { return axios.get(`${BASE}/getAll`) }
export function getActiveCounsellors() { return axios.get(`${BASE}/getActive`) }
export function getCounsellorById(id: number) { return axios.get(`${BASE}/get/${id}`) }
export function getCounsellorByUserId(userId: number) { return axios.get(`${BASE}/get/by-user/${userId}`) }
export function updateCounsellor(id: number, data: any) { return axios.put(`${BASE}/update/${id}`, data) }
export function toggleCounsellorActive(id: number) { return axios.put(`${BASE}/toggle-active/${id}`) }

// ── Deactivation with cascade (Manage Counsellors → Deactivate) ────────────────
//
// Deactivating a counsellor who still has sessions booked settles those sessions too:
// each is either parked with a rebooking link to the student, or cancelled with a
// follow-up promise. `preview` is the read-only "what would happen", shown for
// confirmation before `deactivateCounsellor` actually does it.

export interface AffectedSession {
  appointmentId: number
  studentName?: string
  studentEmail?: string
  studentPhone?: string
  date?: string
  startTime?: string
  endTime?: string
  mode?: string
  status?: string
  /** True when another counsellor covers this student, so she gets a rebooking link. */
  hasAlternative: boolean
  /** Present only in the result: PARKED | CANCELLED | FAILED. */
  outcome?: string
}

export interface DeactivationResult {
  counsellorId: number
  counsellorName?: string
  parked: number
  cancelled: number
  failed: number
  sessions: AffectedSession[]
}

export function getDeactivationPreview(id: number) {
  return axios.get<AffectedSession[]>(`${BASE}/${id}/deactivation-preview`)
}

export function deactivateCounsellor(id: number, userId?: number) {
  return axios.post<DeactivationResult>(`${BASE}/${id}/deactivate`, { userId })
}
