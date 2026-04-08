import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/session-notes`

export function createSessionNotes(data: any, userId: number) { return axios.post(`${BASE}/create?userId=${userId}`, data) }
export function getSessionNotes(appointmentId: number, isStudent: boolean = false) { return axios.get(`${BASE}/get/${appointmentId}?isStudent=${isStudent}`) }
export function updateSessionNotes(id: number, data: any) { return axios.put(`${BASE}/update/${id}`, data) }
