import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/session-notes`

export function createSessionNotes(data: any, userId: number) { return axios.post(`${BASE}/create?userId=${userId}`, data) }
export function getSessionNotes(appointmentId: number, isStudent: boolean = false) { return axios.get(`${BASE}/get/${appointmentId}?isStudent=${isStudent}`) }
export function updateSessionNotes(id: number, data: any) { return axios.put(`${BASE}/update/${id}`, data) }

// ── Photos of handwritten session notes ─────────────────────────────────────
// Stored in the report bucket on DigitalOcean Spaces beside the rendered reports
// (report-renders/session-notes/appointment-<id>/). Counsellor/admin only.

export interface SessionNotesPhoto {
  id: number
  appointmentId: number
  fileUrl: string
  objectKey?: string
  contentType?: string
  fileSize?: number
  originalFileName?: string
  uploadedByUserId?: number
  createdAt?: string
}

/** Upload one or more image files; resolves with the appointment's full photo list. */
export function uploadSessionNotesPhotos(appointmentId: number, files: File[]) {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  return axios.post<SessionNotesPhoto[]>(`${BASE}/photos/${appointmentId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function getSessionNotesPhotos(appointmentId: number) {
  return axios.get<SessionNotesPhoto[]>(`${BASE}/photos/${appointmentId}`)
}

/** One call for a whole page: `{ [appointmentId]: SessionNotesPhoto[] }`. */
export function getSessionNotesPhotosBulk(appointmentIds: number[]) {
  if (appointmentIds.length === 0) {
    return Promise.resolve({ data: {} as Record<string, SessionNotesPhoto[]> })
  }
  return axios.get<Record<string, SessionNotesPhoto[]>>(`${BASE}/photos`, {
    params: { appointmentIds: appointmentIds.join(',') },
  })
}

export function deleteSessionNotesPhoto(photoId: number) {
  return axios.delete(`${BASE}/photos/${photoId}`)
}
