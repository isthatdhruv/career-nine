import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

export interface TrackerListResponse<T> {
  rows: T[];
  total: number;
  page: number;
  size: number;
}

export interface ReportErrorSummary {
  logId: number;
  message: string;
  createdAt: string;
  reportType?: string;
}

export interface ReportErrorRow {
  logId: number;
  entitlementId: number;
  userStudentId: number;
  studentName?: string;
  studentEmail?: string;
  campaignId?: number;
  campaignName?: string;
  assessmentId?: number;
  assessmentName?: string;
  reportType?: string;
  studentClassAtAttempt?: number | null;
  attemptType: string;
  status: string;
  errorClass?: string;
  errorMessage?: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface PaymentRow {
  transactionId: number;
  createdAt?: string;
  studentName?: string;
  studentEmail?: string;
  studentPhone?: string;
  userStudentId?: number;
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
  finalReportActive?: boolean;
  assessmentStatus?: string;
  instituteCode?: number;
  instituteName?: string;
  lastReportError?: ReportErrorSummary | null;
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
  userStudentId?: number;
  assessmentStatus?: string;
  instituteCode?: number;
  instituteName?: string;
  lastReportError?: ReportErrorSummary | null;
}

export interface InstituteOption {
  instituteCode: number;
  instituteName: string;
}

// Note: institute list is now fetched via the centralized `useInstitutes`
// hook in `src/app/lib/queries/lookups.ts`. `getInstituteList` was removed
// to avoid bypassing the React Query cache.

export const assignStudentInstitute = (userStudentId: number, instituteCode: number) =>
  axios.post<{ status: string; instituteCode: number }>(
    `${process.env.REACT_APP_API_URL}/user-student/${userStudentId}/institute/${instituteCode}/assign-primary`
  );

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

export const resetPayment = (transactionId: number, reason?: string, resetBy?: string) =>
  axios.post(`${API_URL}/admin/tracker/payments/${transactionId}/reset`, { reason, resetBy });

export type CheckPaymentStatusResponse = {
  transactionId: number;
  previousStatus?: string;
  status: string;
  razorpayStatus?: string | null;
  changed: boolean;
  message: string;
  entitlementId?: number | null;
  entitlementStatus?: string | null;
};

export const checkPaymentStatus = (transactionId: number) =>
  axios.post<CheckPaymentStatusResponse>(
    `${API_URL}/admin/tracker/payments/${transactionId}/check-status`,
  );

export const sendPaymentLinkEmail = (
  transactionId: number,
  email: string,
  studentName?: string,
) =>
  axios.post(`${API_URL}/payment/${transactionId}/send-email`, {
    email,
    studentName: studentName ?? "Student",
  });

export const resendEntitlementService = (entitlementId: number, serviceType: string, recipient: string) =>
  axios.post(`${API_URL}/entitlement/${entitlementId}/resend/${serviceType}`, { recipient });

export const extendEntitlement = (entitlementId: number, newExpiresAt: string) =>
  axios.post(`${API_URL}/entitlement/${entitlementId}/extend`, { newExpiresAt });

export const revokeEntitlement = (entitlementId: number, reason?: string) =>
  axios.post(`${API_URL}/entitlement/${entitlementId}/revoke`, { reason });

export const getReportErrors = (filters: TrackerFilters & { status?: string } = {}) =>
  axios.get<TrackerListResponse<ReportErrorRow>>(`${API_URL}/admin/tracker/report-errors`, {
    params: buildParams(filters),
  });

export const retryReportGeneration = (logId: number, resolvedBy?: string) =>
  axios.post(`${API_URL}/admin/tracker/report-errors/${logId}/retry`, resolvedBy ? { resolvedBy } : {});

export const dismissReportError = (logId: number, note?: string, resolvedBy?: string) =>
  axios.post(`${API_URL}/admin/tracker/report-errors/${logId}/dismiss`, { note, resolvedBy });

export type AnswerSelection = {
  optionId?: number | null;
  optionText?: string | null;
  rankOrder?: number | null;
  textResponse?: string | null;
  mappedOptionId?: number | null;
  mappedOptionText?: string | null;
};

export type AnsweredQuestion = {
  questionnaireQuestionId: number;
  questionText?: string | null;
  questionType?: string | null;
  sectionName?: string | null;
  orderIndex?: string | null;
  selections: AnswerSelection[];
};

export type AdminAnswersResponse = {
  userStudentId: number;
  assessmentId: number;
  assessmentName?: string | null;
  studentName?: string | null;
  status: string;
  persistenceState?: string | null;
  totalQuestions: number;
  answeredQuestions: number;
  hasRedisDraft: boolean;
  redisAnswerCount?: number | null;
  questions: AnsweredQuestion[];
};

export const getStudentAssessmentAnswers = (userStudentId: number, assessmentId: number) =>
  axios.get<AdminAnswersResponse>(
    `${API_URL}/assessment-answer/admin-view/${userStudentId}/${assessmentId}`,
  );
