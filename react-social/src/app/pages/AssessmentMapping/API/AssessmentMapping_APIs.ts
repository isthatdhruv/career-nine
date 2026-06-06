import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

// ============ ADMIN APIs ============

// A saved mapping carries DISTINCT free & paid link tokens plus their independent
// active flags. `token` mirrors `paidToken` for legacy callers.
export interface AssessmentInstituteMapping {
  mappingId: number;
  assessmentId: number;
  instituteCode: number;
  mappingLevel: "INSTITUTE" | "SESSION" | "CLASS" | "SECTION";
  sessionId?: number | null;
  classId?: number | null;
  sectionId?: number | null;
  token: string;
  freeToken: string;
  paidToken: string;
  isActive: boolean;
  freeActive: boolean;
  paidActive: boolean;
}

export function createAssessmentMapping(data: {
  assessmentId: number;
  instituteCode: number;
  mappingLevel: string;
  sessionId?: number;
  classId?: number;
  sectionId?: number;
}) {
  return axios.post<AssessmentInstituteMapping>(`${API_URL}/assessment-mapping/create`, data);
}

export function getAssessmentMappingsByInstitute(instituteCode: number) {
  return axios.get<AssessmentInstituteMapping[]>(
    `${API_URL}/assessment-mapping/getByInstitute/${instituteCode}`
  );
}

export function updateAssessmentMapping(
  id: number,
  data: { isActive: boolean }
) {
  return axios.put(`${API_URL}/assessment-mapping/update/${id}`, data);
}

export function deleteAssessmentMapping(id: number) {
  return axios.delete(`${API_URL}/assessment-mapping/delete/${id}`);
}

export function getAssessmentSummariesByInstitute(instituteCode: number) {
  return axios.get<{ id: number; assessmentName: string; isActive: boolean; questionnaireType: boolean | null }[]>(
    `${API_URL}/assessment-mapping/getByInstitute/${instituteCode}/assessments`
  );
}

// Lightweight: only id, assessmentName, isActive (no questionnaire cascade)
export function getAssessmentSummaryList() {
  return axios.get(`${API_URL}/assessments/get/list-summary`);
}

// ============ INSTITUTE <-> ASSESSMENT CATALOG (admin) ============
// "Which assessments this institute offers". Backend keeps it in sync on mapping
// create; the catalog strip lets the admin add/toggle/remove independently.

export interface InstituteAssessment {
  id: number;
  instituteCode: number;
  assessmentId: number;
  isActive: boolean;
}

export function getCatalog(instituteCode: number) {
  return axios.get<InstituteAssessment[]>(
    `${API_URL}/assessment-mapping/institute/${instituteCode}/catalog`
  );
}

// Returns the updated catalog. On HTTP 400 the response body is a plain-string
// message (e.g. maxAssessments cap exceeded) — surface it to the admin.
export function enableCatalog(instituteCode: number, assessmentIds: number[]) {
  return axios.post<InstituteAssessment[]>(
    `${API_URL}/assessment-mapping/institute/${instituteCode}/catalog`,
    { assessmentIds }
  );
}

export function toggleCatalog(id: number) {
  return axios.patch<InstituteAssessment>(
    `${API_URL}/assessment-mapping/institute/catalog/${id}/toggle`
  );
}

export function deleteCatalog(id: number) {
  return axios.delete(`${API_URL}/assessment-mapping/institute/catalog/${id}`);
}

// ============ PER-LINK TOGGLES (admin) ============
// Flip the free or paid link independently of the mapping's master isActive.
// Returns the updated mapping (with freeActive / paidActive reflected).

export function toggleLink(mappingId: number, linkType: "free" | "paid") {
  return axios.patch<AssessmentInstituteMapping>(
    `${API_URL}/assessment-mapping/${mappingId}/link/${linkType}/toggle`
  );
}

// ============ PUBLIC APIs ============

export function getMappingInfoByToken(token: string) {
  return axios.get(`${API_URL}/assessment-mapping/public/info/${token}`);
}

export function registerStudentByToken(
  token: string,
  studentData: {
    name: string;
    email: string;
    dob: string;
    phone: string;
    gender: string;
    classId?: number;
    schoolSectionId?: number;
  }
) {
  return axios.post(
    `${API_URL}/assessment-mapping/public/register/${token}`,
    studentData
  );
}

// ============ PRICING TIERS ============

export interface AssessmentMappingTier {
  tierId?: number;
  mappingId?: number;
  name: string;
  description: string;
  amount: number | null;
  sortOrder: number;
  maxRegistrations: number | null;
  currentCount?: number;
  isActive?: boolean;
  // The auto-created free tier (sortOrder -1, amount 0) backing the free link.
  isFree?: boolean;
  // Service-inclusion toggles (parity with the B2C PricingTier flags).
  includesFinalReport?: boolean;
  includesDashboard?: boolean;
  dashboardValidityDays?: number | null;
  includesCounselling?: boolean;
  counsellingSessionCount?: number | null;
  includesLms?: boolean;
  lmsValidityDays?: number | null;
}

export function getTiers(mappingId: number) {
  return axios.get<AssessmentMappingTier[]>(
    `${API_URL}/assessment-mapping/${mappingId}/tiers`
  );
}

export function createTier(mappingId: number, tier: AssessmentMappingTier) {
  return axios.post<AssessmentMappingTier>(
    `${API_URL}/assessment-mapping/${mappingId}/tiers`,
    tier
  );
}

export function updateTier(tierId: number, tier: Partial<AssessmentMappingTier>) {
  return axios.put<AssessmentMappingTier>(
    `${API_URL}/assessment-mapping/tiers/${tierId}`,
    tier
  );
}

export function toggleTier(tierId: number) {
  return axios.patch<AssessmentMappingTier>(
    `${API_URL}/assessment-mapping/tiers/${tierId}/toggle`
  );
}

export function deleteTier(tierId: number) {
  return axios.delete(`${API_URL}/assessment-mapping/tiers/${tierId}`);
}

export function recountTier(tierId: number) {
  return axios.post(`${API_URL}/assessment-mapping/tiers/${tierId}/recount`);
}
