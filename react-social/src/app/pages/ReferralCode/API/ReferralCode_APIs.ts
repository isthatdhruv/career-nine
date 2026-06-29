import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

export function createReferralCode(data: any) {
  return axios.post(`${API_URL}/referral-codes/create`, data);
}

export function getAllReferralCodes() {
  return axios.get(`${API_URL}/referral-codes/getAll`);
}

export function updateReferralCode(id: number, data: any) {
  return axios.put(`${API_URL}/referral-codes/update/${id}`, data);
}

export function deleteReferralCode(id: number) {
  return axios.delete(`${API_URL}/referral-codes/delete/${id}`);
}

export function getReferralCodeAssessments(id: number) {
  return axios.get<number[]>(`${API_URL}/referral-codes/${id}/assessments`);
}

export function getReferralInstitutes() {
  return axios.get(`${API_URL}/referral-codes/institutes`);
}

export function getInstituteAssessments(instituteCode: number) {
  return axios.get(`${API_URL}/referral-codes/institutes/${instituteCode}/assessments`);
}

export function getReferredStudents(id: number) {
  return axios.get(`${API_URL}/referral-codes/${id}/students`);
}
