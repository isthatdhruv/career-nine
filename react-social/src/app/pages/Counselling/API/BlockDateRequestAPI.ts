import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/block-date-request`

export interface BlockDateRequest {
  id: number
  counsellor: { id: number; name: string; email: string }
  blockDate: string
  reason?: string
  status: string
  adminResponse?: string
  createdAt?: string
}

export function submitBlockDateRequest(counsellorId: number, date: string, reason?: string) {
  return axios.post<BlockDateRequest>(`${BASE}/submit`, { counsellorId, date, reason })
}

export function getPendingBlockRequests() {
  return axios.get<BlockDateRequest[]>(`${BASE}/pending`)
}

export function getBlockRequestsByCounsellor(counsellorId: number) {
  return axios.get<BlockDateRequest[]>(`${BASE}/by-counsellor/${counsellorId}`)
}

export function approveBlockRequest(id: number, adminResponse?: string) {
  return axios.put(`${BASE}/approve/${id}`, { adminResponse })
}

export function rejectBlockRequest(id: number, adminResponse?: string) {
  return axios.put(`${BASE}/reject/${id}`, { adminResponse })
}
