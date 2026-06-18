import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

export interface Campaign {
  campaignId?: number;
  name: string;
  slug: string;
  brandLogoUrl?: string;
  targetAudience?: string;
  description?: string;
  validFrom?: string;
  validTo?: string;
  defaultPurchasePath?: "A" | "B";
  defaultCounsellingModel?: "1" | "2";
  instituteCode?: number | null;
  isActive?: boolean;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface InstituteOption {
  instituteCode: number;
  instituteName: string;
}

export interface CampaignAssessmentRow {
  mappingId: number;
  assessmentId: number;
  assessmentName?: string;
  purchasePath?: "A" | "B" | null;
  counsellingModel?: "1" | "2" | null;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  tiers?: CampaignAssessmentTier[];
}

export interface CampaignAssessmentTier {
  id: number;
  campaignAssessmentMappingId: number;
  pricingTierId: number;
  priceOverrideInr?: number | null;
  isDefault?: boolean;
  isActive?: boolean;
}

// Class-based registration: a class routes to one of the campaign's attached
// assessments. The student picks a class and that assessment (+ its default
// tier/price) auto-selects — mirrors the B2B school flow.
export interface CampaignClassRoute {
  routeId: number;
  classId: number;
  sessionId?: number | null;
  assessmentId: number;
  assessmentName?: string | null;
  className?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CampaignClassOption {
  classId: number;
  className: string;
}

export interface CampaignSessionOption {
  sessionId: number;
  sessionYear?: string;
  classes: CampaignClassOption[];
}

export interface CampaignFullDto {
  campaign: Campaign;
  assessments: CampaignAssessmentRow[];
  classRoutes?: CampaignClassRoute[];
  institute?: InstituteOption | null;
}

// Note: institute list is now fetched via the centralized `useInstitutes`
// hook in `src/app/lib/queries/lookups.ts`. `getInstituteList` was removed
// to avoid bypassing the React Query cache.

export const getAllCampaigns = () => axios.get<Campaign[]>(`${API_URL}/campaign/getAll`);
export const getCampaign = (id: number) => axios.get<CampaignFullDto>(`${API_URL}/campaign/get/${id}`);
export const getCampaignBySlug = (slug: string) => axios.get<CampaignFullDto>(`${API_URL}/campaign/get/by-slug/${slug}`);
export const createCampaign = (body: Campaign) => axios.post<Campaign>(`${API_URL}/campaign/create`, body);
export const updateCampaign = (id: number, body: Partial<Campaign>) =>
  axios.put<Campaign>(`${API_URL}/campaign/update/${id}`, body);
export const deleteCampaign = (id: number) => axios.delete(`${API_URL}/campaign/delete/${id}`);
export const resolveCampaign = (campaignId: number, assessmentId: number) =>
  axios.get(`${API_URL}/campaign/${campaignId}/resolved/${assessmentId}`);

export const attachAssessment = (campaignId: number, body: {
  assessmentId: number;
  purchasePath?: "A" | "B" | null;
  counsellingModel?: "1" | "2" | null;
  sortOrder?: number;
}) => axios.post(`${API_URL}/campaign/${campaignId}/assessment`, body);

export const updateAssessmentMapping = (mappingId: number, body: {
  purchasePath?: "A" | "B" | null;
  counsellingModel?: "1" | "2" | null;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}) => axios.put(`${API_URL}/campaign/assessment/${mappingId}`, body);

export const detachAssessment = (mappingId: number) =>
  axios.delete(`${API_URL}/campaign/assessment/${mappingId}`);

export const attachTierToMapping = (mappingId: number, body: {
  pricingTierId: number;
  priceOverrideInr?: number | null;
  isDefault?: boolean;
  isActive?: boolean;
}) => axios.post(`${API_URL}/campaign/assessment/${mappingId}/tier`, body);

export const detachTierFromMapping = (tierMapId: number) =>
  axios.delete(`${API_URL}/campaign/assessment/tier/${tierMapId}`);

// ── Class-based registration (class → assessment routing) ────────────────────
export const getCampaignClassOptions = (campaignId: number) =>
  axios.get<{ sessions: CampaignSessionOption[] }>(`${API_URL}/campaign/${campaignId}/class-options`);

export const upsertClassRoute = (campaignId: number, body: {
  classId: number;
  sessionId?: number | null;
  assessmentId: number;
  sortOrder?: number;
  isActive?: boolean;
}) => axios.post(`${API_URL}/campaign/${campaignId}/class`, body);

export const deleteClassRoute = (routeId: number) =>
  axios.delete(`${API_URL}/campaign/class/${routeId}`);

export const importSchoolConfig = (campaignId: number, sessionId: number) =>
  axios.post<{ imported: number; assessmentsAttached: number; assessmentsTouched: number; message: string }>(
    `${API_URL}/campaign/${campaignId}/import-school-config`, { sessionId });
