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

// ========================== PHASE 2-4: Student Data Import ==========================

// Fetch full user data from Firebase (personal, educational, scores, responses)
export function fetchFirebaseUserData() {
  return axios.get(`${API_URL}/firebase-mapping/fetch-user-data`);
}

// Fetch unique questions from Firebase responses
export function fetchUniqueQuestions() {
  return axios.get(`${API_URL}/firebase-mapping/fetch-unique-questions`);
}

// Bulk import students (creates User + StudentInfo + UserStudent)
export function importStudents(payload: any) {
  return axios.post(`${API_URL}/firebase-mapping/import-students`, payload);
}

// Import assessment raw scores
export function importScores(payload: any) {
  return axios.post(`${API_URL}/firebase-mapping/import-scores`, payload);
}

// Import extra data (career aspirations, subjects, values)
export function importExtraData(payload: any) {
  return axios.post(`${API_URL}/firebase-mapping/import-extra-data`, payload);
}

// Existing assessment endpoints (reuse)
export function getAllAssessments() {
  return axios.get(`${API_URL}/assessments/get/list`);
}

export function getAllMeasuredQualityTypes() {
  return axios.get(`${API_URL}/measured-quality-types/getAll`);
}

export function getAllAssessmentQuestions() {
  return axios.get(`${API_URL}/assessment-questions/getAll`);
}
