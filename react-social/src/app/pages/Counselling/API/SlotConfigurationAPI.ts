import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/slot-configuration`

export interface SlotConfig {
  id: number
  name: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  slotDuration: number
  hasBreak: boolean
  breakStart?: string
  breakEnd?: string
  createdAt?: string
}

export function createSlotConfig(data: any) { return axios.post<SlotConfig>(`${BASE}/create`, data) }
export function getAllSlotConfigs() { return axios.get<SlotConfig[]>(`${BASE}/getAll`) }
export function deleteSlotConfig(id: number) { return axios.delete(`${BASE}/delete/${id}`) }
export function applySlotConfig(configId: number, counsellorIds: number[]) {
  return axios.post(`${BASE}/apply`, { configId, counsellorIds })
}

export function cleanupLegacy() {
  return axios.post<{ slotsDeleted: number; templatesDeleted: number }>(`${BASE}/cleanup-legacy`)
}
