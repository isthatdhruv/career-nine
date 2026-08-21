import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/availability-template`

export function createTemplate(data: any, days?: number) { return axios.post(`${BASE}/create${days ? '?days=' + days : ''}`, data) }
export function getTemplatesByCounsellor(counsellorId: number) { return axios.get(`${BASE}/get/by-counsellor/${counsellorId}`) }
export function updateTemplate(id: number, data: any) { return axios.put(`${BASE}/update/${id}`, data) }
export function deleteTemplate(id: number) { return axios.delete(`${BASE}/delete/${id}`) }
/**
 * Remove several weekly schedules in one request. Each id is deleted independently on the
 * server, so the response reports `deletedIds` and `failedIds` rather than failing whole.
 */
export function deleteTemplates(ids: number[]) {
  return axios.post<{ deletedIds: number[]; failedIds: number[]; slotsDeleted: number; slotsKept: number }>(
    `${BASE}/delete-batch`, { ids },
  )
}
export function toggleTemplateActive(id: number) { return axios.put(`${BASE}/toggle-active/${id}`) }
