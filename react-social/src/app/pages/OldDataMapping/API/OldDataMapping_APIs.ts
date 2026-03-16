import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

// Fetch grouped school/session/grade/section data from Firebase (via backend)
export function fetchFirebaseSchoolData() {
  return axios.get(`${API_URL}/firebase-mapping/fetch-school-data`);
}

// Firebase mapping endpoints
export function saveMapping(payload: any) {
  return axios.post(`${API_URL}/firebase-mapping/save`, payload);
}

export function saveBatchMappings(payload: any[]) {
  return axios.post(`${API_URL}/firebase-mapping/save-batch`, payload);
}

export function getAllMappings() {
  return axios.get(`${API_URL}/firebase-mapping/getAll`);
}

export function getMappingsByType(type: string) {
  return axios.get(`${API_URL}/firebase-mapping/getByType/${type}`);
}

export function checkMapping(firebaseId: string, type: string) {
  return axios.get(`${API_URL}/firebase-mapping/check/${firebaseId}/${type}`);
}

// Institute endpoints (reuse existing)
export function getAllInstitutes() {
  return axios.get(`${API_URL}/instituteDetail/get/list`);
}

export function createInstitute(values: any) {
  return axios.post(`${API_URL}/instituteDetail/update`, { values });
}

// School session endpoints
export function getSessionsByInstitute(instituteCode: number) {
  return axios.get(`${API_URL}/schoolSession/getByInstituteCode/${instituteCode}`);
}

export function createSession(payload: any[]) {
  return axios.post(`${API_URL}/schoolSession/create`, payload);
}

// Classes are returned nested inside getSessionsByInstitute response
// Use POST /schoolSession/class/create to create individual classes
export function createClass(payload: any) {
  return axios.post(`${API_URL}/schoolSession/class/create`, payload);
}

// Sections are returned nested inside classes from getSessionsByInstitute
// Use POST /schoolSession/section/create to create individual sections
export function createSection(payload: any) {
  return axios.post(`${API_URL}/schoolSession/section/create`, payload);
}
