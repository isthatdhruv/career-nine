import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/notifications`

export function getMyNotifications(userId: number) { return axios.get(`${BASE}/my?userId=${userId}`) }
export function getUnreadCount(userId: number) { return axios.get(`${BASE}/unread-count?userId=${userId}`) }
export function markNotificationRead(id: number) { return axios.put(`${BASE}/mark-read/${id}`) }
export function markAllNotificationsRead(userId: number) { return axios.put(`${BASE}/mark-all-read?userId=${userId}`) }
