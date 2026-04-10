import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

// ── Admin APIs ──

export function createSchoolConfig(data: {
  instituteCode: number;
  sessionId: number;
  classId: number;
  assessmentId: number;
  amount?: number;
}) {
  return axios.post(`${API_URL}/school-registration/config/create`, data);
}

export function batchSaveSchoolConfigs(data: {
  instituteCode: number;
  sessionId: number;
  configs: { classId: number; assessmentId: number; amount?: number }[];
}) {
  return axios.post(`${API_URL}/school-registration/config/batch-save`, data);
}

export function getSchoolConfigs(instituteCode: number, sessionId: number) {
  return axios.get(`${API_URL}/school-registration/config/by-institute/${instituteCode}/${sessionId}`);
}

export function updateSchoolConfig(configId: number, data: { assessmentId?: number; amount?: number; isActive?: boolean }) {
  return axios.put(`${API_URL}/school-registration/config/update/${configId}`, data);
}

export function deleteSchoolConfig(configId: number) {
  return axios.delete(`${API_URL}/school-registration/config/delete/${configId}`);
}

export function generateSchoolLink(data: { instituteCode: number; sessionId: number }) {
  return axios.post(`${API_URL}/school-registration/link/generate`, data);
}

export function getSchoolLink(instituteCode: number, sessionId: number) {
  return axios.get(`${API_URL}/school-registration/link/by-institute/${instituteCode}/${sessionId}`);
}

export function toggleSchoolLink(linkId: number) {
  return axios.put(`${API_URL}/school-registration/link/toggle/${linkId}`);
}

// ── Public APIs ──

export function getSchoolInfo(token: string) {
  return axios.get(`${API_URL}/school-registration/public/info/${token}`);
}

export function registerSchoolStudent(token: string, studentData: {
  name: string;
  email: string;
  dob: string;
  phone: string;
  gender: string;
  classId: number;
  schoolSectionId?: number;
  promoCode?: string;
}) {
  return axios.post(`${API_URL}/school-registration/public/register/${token}`, studentData);
}
