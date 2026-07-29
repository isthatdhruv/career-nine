import axios from "axios";
import { PricingTier } from "../../B2C/API/PricingTier_APIs";

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
  // Price (in rupees) for counselling sessions beyond the included count.
  counsellingPrice?: number | null;
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

// ============ PER-STUDENT INVITES (admin) ============
// Bind a specific, already-existing student to a mapping + custom-priced tier and
// mint a one-student link. The student opens it, sees a pre-filled registration
// page, pays the tier price, and takes the assessment.

export interface AssessmentStudentInvite {
  inviteId: number;
  mappingId: number;
  tierId: number;
  userStudentId: number;
  assessmentId: number;
  instituteCode: number;
  token: string;
  status: string;
}

// Find-or-create the INSTITUTE-level mapping invites hang their tiers off of.
export function ensureInviteMapping(instituteCode: number, assessmentId: number) {
  return axios.post<AssessmentInstituteMapping>(
    `${API_URL}/assessment-mapping/student-invite/ensure-mapping`,
    { instituteCode, assessmentId }
  );
}

// Reusable B2C pricing tiers for the invite picker — served under the mapping
// permission so the tool is self-contained.
export function getInvitePricingTiers() {
  return axios.get<PricingTier[]>(`${API_URL}/assessment-mapping/student-invite/pricing-tiers`);
}

// Selects a reusable B2C pricing tier (pricingTierId); the backend materialises it
// onto the mapping and binds the invite to it. customPrice (optional) overrides the
// tier's base price for this student.
export function createStudentInvite(
  mappingId: number,
  pricingTierId: number,
  userStudentId: number,
  customPrice?: number
) {
  return axios.post<AssessmentStudentInvite>(
    `${API_URL}/assessment-mapping/student-invite`,
    { mappingId, pricingTierId, userStudentId, customPrice }
  );
}

export interface StudentInviteRow {
  inviteId: number;
  token: string;
  status: string;
  createdAt?: string;
  assessmentId: number;
  assessmentName?: string;
  tierId?: number;
  tierName?: string;
  amount?: number | null;
  studentName?: string;
  studentEmail?: string;
}

export interface InviteStudentRow {
  userStudentId: number;
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  isDropped?: boolean;
}

// Institute student roster for the invite picker — gated by the SAME permission
// as the rest of the mapping feature (so the tool is self-contained).
export function getInviteStudents(instituteCode: number) {
  return axios.get<InviteStudentRow[]>(
    `${API_URL}/assessment-mapping/student-invite/students/${instituteCode}`
  );
}

export function getInvitesByInstitute(instituteCode: number) {
  return axios.get<StudentInviteRow[]>(
    `${API_URL}/assessment-mapping/student-invite/by-institute/${instituteCode}`
  );
}

export function revokeInvite(inviteId: number) {
  return axios.patch(`${API_URL}/assessment-mapping/student-invite/${inviteId}/revoke`);
}
