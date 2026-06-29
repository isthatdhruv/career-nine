import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

// ── Types ────────────────────────────────────────────────────────────────────
export type EmailLogStatus = "QUEUED" | "SENT" | "FAILED" | "SKIPPED";

export interface EmailLog {
  id: number;
  emailType: string;
  recipient: string;
  subject: string;
  accountId: number | null;
  accountName: string | null;
  templateId: number | null;
  instituteCode: number | null;
  userStudentId: number | null;
  deliveryMode: string | null;
  status: EmailLogStatus;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface EmailLogPage {
  content: EmailLog[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface EmailLogFilters {
  status?: string;
  type?: string;
  recipient?: string;
  page?: number;
  size?: number;
}

// ── Endpoints ────────────────────────────────────────────────────────────────
export function getEmailLogs(filters: EmailLogFilters = {}) {
  const params: Record<string, string | number> = {
    page: filters.page ?? 0,
    size: filters.size ?? 25,
  };
  if (filters.status) params.status = filters.status;
  if (filters.type) params.type = filters.type;
  if (filters.recipient) params.recipient = filters.recipient;
  return axios.get<EmailLogPage>(`${API_URL}/email-logs`, { params });
}

export function getEmailLog(id: number) {
  return axios.get<EmailLog>(`${API_URL}/email-logs/${id}`);
}
