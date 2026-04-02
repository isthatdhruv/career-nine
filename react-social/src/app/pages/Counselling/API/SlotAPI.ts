import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/counselling-slot`

export function getAvailableSlots(week?: string) { return axios.get(`${BASE}/available${week ? '?week=' + week : ''}`) }
export function createManualSlot(data: any) { return axios.post(`${BASE}/create-manual`, data) }
export function blockDate(data: any) { return axios.post(`${BASE}/block-date`, data) }
export function deleteSlot(id: number) { return axios.delete(`${BASE}/delete/${id}`) }
export function getSlotsByCounsellor(counsellorId: number, start?: string, end?: string) {
  let params = start && end ? `?start=${start}&end=${end}` : ''
  return axios.get(`${BASE}/by-counsellor/${counsellorId}${params}`)
}
