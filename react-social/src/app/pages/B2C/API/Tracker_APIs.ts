import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

export interface TrackerListResponse<T> {
  rows: T[];
  total: number;
  page: number;
  size: number;
}

export interface PaymentRow {
  transactionId: number;
  createdAt?: string;
  studentName?: string;
  studentEmail?: string;
  studentPhone?: string;
  amount?: number;
  originalAmount?: number;
  currency?: string;
  status?: string;
  promoCode?: string;
  purchasePath?: string;
  paymentLinkUrl?: string;
  shortUrl?: string;
  razorpayPaymentId?: string;
  campaignId?: number;
  campaignName?: string;
  assessmentId?: number;
  assessmentName?: string;
  entitlementId?: number;
  entitlementStatus?: string;
  tierName?: string;
}

export interface AllotmentRow {
  entitlementId: number;
  status?: string;
  grantedAt?: string;
  createdAt?: string;
  expiresAt?: string;
  purchasePath?: string;
  counsellingModel?: string;
  dashboardActive?: boolean;
  dashboardExpiresAt?: string;
  counsellingActive?: boolean;
  counsellingSessionsTotal?: number;
  counsellingSessionsUsed?: number;
  lmsActive?: boolean;
  lmsExpiresAt?: string;
  finalReportActive?: boolean;
  campaignId?: number;
  campaignName?: string;
  assessmentId?: number;
  assessmentName?: string;
  pricingTierId?: number;
  tierName?: string;
  paymentTransactionId?: number;
  paidAmount?: number;
  paymentStatus?: string;
  studentName?: string;
  studentEmail?: string;
  studentPhone?: string;
}

export interface TrackerFilters {
  campaignId?: number;
  status?: string;
  from?: string; // dd-MM-yyyy
  to?: string;
  q?: string;
  includeLeads?: boolean;
  page?: number;
  size?: number;
}

const buildParams = (f: TrackerFilters) => {
  const params: Record<string, any> = {};
  if (f.campaignId != null) params.campaignId = f.campaignId;
  if (f.status) params.status = f.status;
  if (f.from) params.from = f.from;
  if (f.to) params.to = f.to;
  if (f.q) params.q = f.q;
  if (f.includeLeads) params.includeLeads = true;
  if (f.page != null) params.page = f.page;
  if (f.size != null) params.size = f.size;
  return params;
};

export const getPayments = (filters: TrackerFilters = {}) =>
  axios.get<TrackerListResponse<PaymentRow>>(`${API_URL}/admin/tracker/payments`, { params: buildParams(filters) });

export const getAllotments = (filters: TrackerFilters = {}) =>
  axios.get<TrackerListResponse<AllotmentRow>>(`${API_URL}/admin/tracker/allotments`, { params: buildParams(filters) });

export const getAllotmentDetail = (id: number) =>
  axios.get(`${API_URL}/admin/tracker/allotments/${id}`);

export const getServiceActivity = (page = 0, size = 100) =>
  axios.get(`${API_URL}/admin/tracker/service-activity`, { params: { page, size } });

export const getSummary = (filters: TrackerFilters = {}) =>
  axios.get(`${API_URL}/admin/tracker/summary`, { params: buildParams(filters) });

export const resendPaymentLink = (transactionId: number) =>
  axios.post(`${API_URL}/admin/tracker/payments/${transactionId}/resend-link`);

export const resendEntitlementService = (entitlementId: number, serviceType: string, recipient: string) =>
  axios.post(`${API_URL}/entitlement/${entitlementId}/resend/${serviceType}`, { recipient });

export const extendEntitlement = (entitlementId: number, newExpiresAt: string) =>
  axios.post(`${API_URL}/entitlement/${entitlementId}/extend`, { newExpiresAt });

export const revokeEntitlement = (entitlementId: number, reason?: string) =>
  axios.post(`${API_URL}/entitlement/${entitlementId}/revoke`, { reason });
