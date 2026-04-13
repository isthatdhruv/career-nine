import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

export interface CommunicationLogEntry {
  logId: number;
  channel: "EMAIL" | "WHATSAPP";
  recipientName: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  messageType: string;
  status: "SENT" | "FAILED";
  errorMessage: string | null;
  sentBy: string | null;
  createdAt: string;
}

export interface CommunicationLogPage {
  content: CommunicationLogEntry[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface CommunicationLogFilters {
  channel?: string;
  messageType?: string;
  status?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  size?: number;
}

export function getCommunicationLogs(filters: CommunicationLogFilters = {}) {
  const params: Record<string, string | number> = {};
  if (filters.channel) params.channel = filters.channel;
  if (filters.messageType) params.messageType = filters.messageType;
  if (filters.status) params.status = filters.status;
  if (filters.search) params.search = filters.search;
  if (filters.fromDate) params.fromDate = filters.fromDate;
  if (filters.toDate) params.toDate = filters.toDate;
  params.page = filters.page ?? 0;
  params.size = filters.size ?? 50;
  return axios.get<CommunicationLogPage>(`${API_URL}/communication-logs`, { params });
}
