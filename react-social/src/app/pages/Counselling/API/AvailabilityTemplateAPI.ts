import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/availability-template`

export function createTemplate(data: any, days?: number) { return axios.post(`${BASE}/create${days ? '?days=' + days : ''}`, data) }
export function getTemplatesByCounsellor(counsellorId: number) { return axios.get(`${BASE}/get/by-counsellor/${counsellorId}`) }
export function updateTemplate(id: number, data: any) { return axios.put(`${BASE}/update/${id}`, data) }
export function deleteTemplate(id: number) { return axios.delete(`${BASE}/delete/${id}`) }
export function toggleTemplateActive(id: number) { return axios.put(`${BASE}/toggle-active/${id}`) }
