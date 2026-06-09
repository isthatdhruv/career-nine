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

export function generateSchoolLink(data: { instituteCode: number; sessionId: number; maxRegistrations?: number }) {
  return axios.post(`${API_URL}/school-registration/link/generate`, data);
}

export function getSchoolLink(instituteCode: number, sessionId: number) {
  return axios.get(`${API_URL}/school-registration/link/by-institute/${instituteCode}/${sessionId}`);
}

export function toggleSchoolLink(linkId: number) {
  return axios.put(`${API_URL}/school-registration/link/toggle/${linkId}`);
}

export function updateLinkMaxRegistrations(linkId: number, maxRegistrations: number) {
  return axios.put(`${API_URL}/school-registration/link/${linkId}/max-registrations`, { maxRegistrations });
}

// ── Pricing tiers per (institute, session, assessment) ──

export interface SchoolAssessmentTier {
  tierId?: number;
  instituteCode?: number;
  sessionId?: number;
  assessmentId?: number;
  name: string;
  description: string;
  amount: number | null;
  sortOrder: number;
  maxRegistrations: number | null;
  currentCount?: number;
  isActive?: boolean;
  // Feature inclusions — mirror the B2C pricing tier so a school tier can grant
  // counselling / report / dashboard to students who register through its link.
  includesFinalReport?: boolean;
  includesDashboard?: boolean;
  dashboardValidityDays?: number | null;
  includesCounselling?: boolean;
  counsellingSessionCount?: number | null;
  includesLms?: boolean;
  lmsValidityDays?: number | null;
}

export function getSchoolTiers(instituteCode: number, sessionId: number, assessmentId: number) {
  return axios.get<SchoolAssessmentTier[]>(
    `${API_URL}/school-registration/tiers/${instituteCode}/${sessionId}/${assessmentId}`
  );
}

export function createSchoolTier(
  instituteCode: number,
  sessionId: number,
  assessmentId: number,
  tier: SchoolAssessmentTier
) {
  return axios.post<SchoolAssessmentTier>(
    `${API_URL}/school-registration/tiers/${instituteCode}/${sessionId}/${assessmentId}`,
    tier
  );
}

export function updateSchoolTier(tierId: number, tier: Partial<SchoolAssessmentTier>) {
  return axios.put<SchoolAssessmentTier>(
    `${API_URL}/school-registration/tiers/${tierId}`,
    tier
  );
}

export function toggleSchoolTier(tierId: number) {
  return axios.patch<SchoolAssessmentTier>(
    `${API_URL}/school-registration/tiers/${tierId}/toggle`
  );
}

export function deleteSchoolTier(tierId: number) {
  return axios.delete(`${API_URL}/school-registration/tiers/${tierId}`);
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

export function verifyStudentDetails(token: string, body: { email: string; phone: string; dob: string }) {
  return axios.post(`${API_URL}/school-registration/public/verify-details/${token}`, body);
}
