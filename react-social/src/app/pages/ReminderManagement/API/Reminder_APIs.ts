import axios from "axios";
import {
  PagedResponse,
  RecipientPreview,
  ReminderConfig,
  ReminderDeliveryStatus,
  ReminderLogDetail,
  ReminderLogRow,
  ReminderServiceType,
  ReminderSuppression,
} from "../types";

const API_URL = process.env.REACT_APP_API_URL;

// ---------- Config ----------
export function listReminderConfigs() {
  return axios.get<ReminderConfig[]>(`${API_URL}/reminders/config`);
}

export function getReminderConfig(serviceType: ReminderServiceType) {
  return axios.get<ReminderConfig>(`${API_URL}/reminders/config/${serviceType}`);
}

export function updateReminderConfig(
  serviceType: ReminderServiceType,
  payload: {
    enabled?: boolean;
    cronExpression?: string;
    leadTimeMinutes?: number | null;
    maxSendsPerRecipient?: number | null;
  }
) {
  return axios.put<ReminderConfig>(`${API_URL}/reminders/config/${serviceType}`, payload);
}

export function updateReminderTemplate(
  serviceType: ReminderServiceType,
  payload: { subject?: string; body?: string }
) {
  return axios.put<ReminderConfig>(`${API_URL}/reminders/config/${serviceType}/template`, payload);
}

export function sendTestReminder(
  serviceType: ReminderServiceType,
  payload: { to: string; subject?: string; body?: string }
) {
  return axios.post<{ status: string; subject: string; body: string; failureReason?: string; note?: string }>(
    `${API_URL}/reminders/config/${serviceType}/test`,
    payload
  );
}

export function getTemplateTokens(serviceType: ReminderServiceType) {
  return axios.get<{ tokens: string[]; sample: Record<string, string> }>(
    `${API_URL}/reminders/config/${serviceType}/tokens`
  );
}

// ---------- Logs ----------
export function searchReminderLogs(params: {
  serviceType?: ReminderServiceType;
  status?: ReminderDeliveryStatus;
  recipient?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}) {
  return axios.get<PagedResponse<ReminderLogRow>>(`${API_URL}/reminders/logs`, { params });
}

export function getReminderLog(id: number) {
  return axios.get<ReminderLogDetail>(`${API_URL}/reminders/logs/${id}`);
}

export function getReminderStats(params: { from?: string; to?: string }) {
  return axios.get<Record<string, Record<string, number>>>(`${API_URL}/reminders/logs/stats`, { params });
}

// ---------- Suppressions ----------
export function listReminderSuppressions(params: {
  serviceType?: ReminderServiceType;
  page?: number;
  size?: number;
}) {
  return axios.get<PagedResponse<ReminderSuppression>>(`${API_URL}/reminders/suppressions`, { params });
}

export function addReminderSuppression(payload: {
  userStudentId: number;
  serviceType: ReminderServiceType;
  reason?: string;
}) {
  return axios.post<ReminderSuppression>(`${API_URL}/reminders/suppressions`, payload);
}

export function removeReminderSuppression(id: number) {
  return axios.delete<void>(`${API_URL}/reminders/suppressions/${id}`);
}

// ---------- Manual send ----------
export function previewManualReminder(payload: {
  serviceType: ReminderServiceType;
  assessmentId?: number;
  instituteCode?: number;
  status?: string;
}) {
  return axios.post<{ recipients: RecipientPreview[]; total: number; note?: string }>(
    `${API_URL}/reminders/manual/preview`,
    payload
  );
}

export function sendManualReminder(payload: {
  serviceType: ReminderServiceType;
  assessmentId?: number;
  instituteCode?: number;
  status?: string;
  subject?: string;
  body?: string;
  recipients?: Array<{ userStudentId?: number; email: string; name?: string; instituteCode?: number; variables?: Record<string, string> }>;
}) {
  return axios.post<{ total: number; sent: number; failed: number; suppressed: number; capped: number }>(
    `${API_URL}/reminders/manual/send`,
    payload
  );
}
