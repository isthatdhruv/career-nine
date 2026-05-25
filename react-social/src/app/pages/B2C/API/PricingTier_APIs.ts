import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

export interface PricingTier {
  tierId?: number;
  name: string;
  description?: string;
  basePriceInr: number;
  currency?: string;
  includesFinalReport?: boolean;
  includesDashboard?: boolean;
  includesCounselling?: boolean;
  counsellingSessionCount?: number | null;
  includesLms?: boolean;
  lmsValidityDays?: number | null;
  dashboardValidityDays?: number | null;
  sortOrder?: number;
  isActive?: boolean;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const getAllPricingTiers = () => axios.get<PricingTier[]>(`${API_URL}/pricing-tier/getAll`);
export const getActivePricingTiers = () => axios.get<PricingTier[]>(`${API_URL}/pricing-tier/getActive`);
export const getPricingTier = (id: number) => axios.get<PricingTier>(`${API_URL}/pricing-tier/get/${id}`);
export const createPricingTier = (body: PricingTier) => axios.post<PricingTier>(`${API_URL}/pricing-tier/create`, body);
export const updatePricingTier = (id: number, body: Partial<PricingTier>) =>
  axios.put<PricingTier>(`${API_URL}/pricing-tier/update/${id}`, body);
export const deletePricingTier = (id: number) => axios.delete(`${API_URL}/pricing-tier/delete/${id}`);
