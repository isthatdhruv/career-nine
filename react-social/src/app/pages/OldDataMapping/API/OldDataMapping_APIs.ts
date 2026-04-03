import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

// Fetch grouped school/session/grade/section data from Firebase (via backend)
export function fetchFirebaseSchoolData(tenant?: string) {
  return axios.get(`${API_URL}/firebase-mapping/fetch-school-data`, {
    params: tenant ? { tenant } : undefined,
  });
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

// Delete a school mapping and its children (sessions, grades, sections)
export function deleteMappingByName(firebaseName: string, type: string) {
  return axios.delete(`${API_URL}/firebase-mapping/deleteByFirebaseNameAndType`, {
    params: { firebaseName, type },
  });
}

// Get students by institute (from DB) with firebase docIds
export function getStudentsByInstitute(instituteCode: number) {
  return axios.get(`${API_URL}/firebase-mapping/students-by-institute/${instituteCode}`);
}

// ========================== PHASE 2-4: Student Data Import ==========================

// Fetch full user data from Firebase (personal, educational, scores, responses)
export function fetchFirebaseUserData(tenant?: string) {
  return axios.get(`${API_URL}/firebase-mapping/fetch-user-data`, {
    params: tenant ? { tenant } : undefined,
  });
}

// Fetch unique questions from Firebase responses
export function fetchUniqueQuestions() {
  return axios.get(`${API_URL}/firebase-mapping/fetch-unique-questions`);
}

// Bulk import students (creates User + StudentInfo + UserStudent)
export function importStudents(payload: any) {
  return axios.post(`${API_URL}/firebase-mapping/import-students`, payload);
}


// Import mapped question-answer pairs as AssessmentAnswer records
export function importMappedAnswers(payload: { userStudentId: number; assessmentId: number; answers: { questionId: number | null; optionId: number | null; textResponse: string }[] }) {
  return axios.post(`${API_URL}/firebase-mapping/import-mapped-answers`, payload);
}

// Force-complete status for partial students
export function forceCompleteStatus(payload: { userStudentId: number; assessmentId: number }[]) {
  return axios.post(`${API_URL}/firebase-mapping/force-complete-status`, payload);
}

// Question mapping persistence
export function getQuestionMappings(assessmentId: number) {
  return axios.get(`${API_URL}/firebase-mapping/question-mappings/${assessmentId}`);
}

export function saveQuestionMappings(assessmentId: number, mappings: any[]) {
  return axios.post(`${API_URL}/firebase-mapping/save-question-mappings`, { assessmentId, mappings });
}

export function deleteQuestionMappings(assessmentId: number) {
  return axios.delete(`${API_URL}/firebase-mapping/question-mappings/${assessmentId}`);
}

export function getAllMappedAssessments() {
  return axios.get(`${API_URL}/firebase-mapping/question-mappings/all-assessments`);
}

// Existing assessment endpoints (reuse)
export function getAllAssessments() {
  return axios.get(`${API_URL}/assessments/get/list`);
}

export function getAssessmentsByInstitute(instituteCode: number) {
  return axios.get(`${API_URL}/assessments/get/by-institute/${instituteCode}`);
}

export function getAllAssessmentQuestions() {
  return axios.get(`${API_URL}/assessment-questions/getAll`);
}

export function getAssessmentQuestionnaire(assessmentId: number) {
  return axios.get(`${API_URL}/assessments/getby/${assessmentId}`);
}

export function findAssessmentsBySameQuestionnaire(assessmentId: number) {
  return axios.get(`${API_URL}/assessments/find-by-same-questionnaire/${assessmentId}`);
}

export function deleteFirebaseStudents(instituteCode: number) {
  return axios.delete(`${API_URL}/firebase-mapping/delete-firebase-students/${instituteCode}`);
}
