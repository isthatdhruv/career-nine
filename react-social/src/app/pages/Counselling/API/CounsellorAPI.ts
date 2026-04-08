import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/counsellor`

export function createCounsellor(data: any) { return axios.post(`${BASE}/create`, data) }
export function getAllCounsellors() { return axios.get(`${BASE}/getAll`) }
export function getActiveCounsellors() { return axios.get(`${BASE}/getActive`) }
export function getCounsellorById(id: number) { return axios.get(`${BASE}/get/${id}`) }
export function getCounsellorByUserId(userId: number) { return axios.get(`${BASE}/get/by-user/${userId}`) }
export function updateCounsellor(id: number, data: any) { return axios.put(`${BASE}/update/${id}`, data) }
export function toggleCounsellorActive(id: number) { return axios.put(`${BASE}/toggle-active/${id}`) }
