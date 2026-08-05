import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/counselling-slot`

export function getAvailableSlots(week?: string, instituteCode?: number) {
  const params = new URLSearchParams()
  if (week) params.append('week', week)
  if (instituteCode) params.append('instituteCode', String(instituteCode))
  const qs = params.toString()
  return axios.get(`${BASE}/available${qs ? '?' + qs : ''}`)
}
export function createManualSlot(data: any) { return axios.post(`${BASE}/create-manual`, data) }
export function blockDate(data: any) { return axios.post(`${BASE}/block-date`, data) }
export function deleteSlot(id: number) { return axios.delete(`${BASE}/delete/${id}`) }
/** { counsellorId: bookable-slots-from-today } for every counsellor that has any. */
export function getAvailableSlotCounts() {
  return axios.get<Record<string, number>>(`${BASE}/available-counts`)
}
export function getSlotsByCounsellor(counsellorId: number, start?: string, end?: string) {
  let params = start && end ? `?start=${start}&end=${end}` : ''
  return axios.get(`${BASE}/by-counsellor/${counsellorId}${params}`)
}
