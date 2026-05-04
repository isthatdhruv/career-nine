import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/counselling-activity`

export interface ActivityLog {
  id: number
  activityType: string
  title: string
  description: string
  counsellor?: { id: number; name: string; email: string }
  actorName?: string
  isRead: boolean
  createdAt: string
}

export function getRecentActivities(limit?: number) {
  return axios.get<ActivityLog[]>(`${BASE}/recent${limit ? '?limit=' + limit : ''}`)
}

export function getUnreadCount() {
  return axios.get<{ count: number }>(`${BASE}/unread-count`)
}

export function markAllAsRead() {
  return axios.put(`${BASE}/mark-all-read`)
}
