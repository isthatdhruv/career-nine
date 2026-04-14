import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

// =========================================================================
// Firebase fetch cache (sessionStorage)
// ---------------------------------------------------------------------------
// The backend already caches the raw firestore dump for 10 minutes, so repeat
// calls within that window are cheap. This layer sits on top so that within a
// single browser tab we don't even round-trip to the backend — re-opening the
// mapping wizard or navigating between steps hits sessionStorage directly.
//
// Call clearFirebaseFetchCache() + POST /firebase-mapping/invalidate-cache
// from the "Refresh" button to force a fresh pull.
// =========================================================================
const FB_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const FB_CACHE_KEYS = {
  schoolData: (tenant?: string) => `fb_cache:schoolData:${tenant || "_"}`,
  userData: (tenant?: string) => `fb_cache:userData:${tenant || "_"}`,
  uniqueQuestions: () => `fb_cache:uniqueQuestions:_`,
};

function readCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > FB_CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // sessionStorage full or disabled — fail silently, we just lose the cache
  }
}

export function clearFirebaseFetchCache(): void {
  try {
    const keys = Object.keys(sessionStorage).filter((k) => k.startsWith("fb_cache:"));
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}

// Tell the backend to drop its Redis-side cache. Called from the Refresh
// button so a fresh Firestore scan runs on the next fetch.
export function invalidateFirebaseBackendCache() {
  return axios.post(`${API_URL}/firebase-mapping/invalidate-cache`);
}

// Fetch grouped school/session/grade/section data from Firebase (via backend)
// — cached in sessionStorage. Passing { force: true } bypasses both the
// sessionStorage and tells the backend to rebuild.
export async function fetchFirebaseSchoolData(
  tenant?: string,
  opts?: { force?: boolean }
) {
  const key = FB_CACHE_KEYS.schoolData(tenant);
  if (!opts?.force) {
    const cached = readCache<any>(key);
    if (cached) return { data: cached, fromCache: true } as any;
  } else {
    sessionStorage.removeItem(key);
  }

  const res = await axios.get(`${API_URL}/firebase-mapping/fetch-school-data`, {
    params: tenant ? { tenant } : undefined,
  });
  writeCache(key, res.data);
  return res;
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
// — cached in sessionStorage; pass { force: true } to bypass.
export async function fetchFirebaseUserData(
  tenant?: string,
  opts?: { force?: boolean }
) {
  const key = FB_CACHE_KEYS.userData(tenant);
  if (!opts?.force) {
    const cached = readCache<any>(key);
    if (cached) return { data: cached, fromCache: true } as any;
  } else {
    sessionStorage.removeItem(key);
  }

  const res = await axios.get(`${API_URL}/firebase-mapping/fetch-user-data`, {
    params: tenant ? { tenant } : undefined,
  });
  writeCache(key, res.data);
  return res;
}

// Fetch unique questions from Firebase responses — cached in sessionStorage.
export async function fetchUniqueQuestions(opts?: { force?: boolean }) {
  const key = FB_CACHE_KEYS.uniqueQuestions();
  if (!opts?.force) {
    const cached = readCache<any>(key);
    if (cached) return { data: cached, fromCache: true } as any;
  } else {
    sessionStorage.removeItem(key);
  }

  const res = await axios.get(`${API_URL}/firebase-mapping/fetch-unique-questions`);
  writeCache(key, res.data);
  return res;
}

// Bulk import students (creates User + StudentInfo + UserStudent)
export function importStudents(payload: any) {
  return axios.post(`${API_URL}/firebase-mapping/import-students`, payload);
}


// Import mapped question-answer pairs as AssessmentAnswer records
export function importMappedAnswers(payload: { userStudentId: number; assessmentId: number; answers: { questionId: number | null; optionId: number | null; textResponse: string }[]; totalMappedQuestions?: number }) {
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

export function detectUnmappedQuestions(assessmentId: number) {
  return axios.get(`${API_URL}/firebase-mapping/detect-unmapped-questions/${assessmentId}`);
}

export function deleteFirebaseStudents(instituteCode: number, forceAll: boolean = false) {
  return axios.delete(`${API_URL}/firebase-mapping/delete-firebase-students/${instituteCode}?forceAll=${forceAll}`);
}
