import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

// ── Events (published by code; the engine reacts to them) ──────────────────

export interface MailEventOption {
  key: string;
  label: string;
}

export interface MailEventInfo {
  key: string;
  label: string;
  description: string;
  subjectKinds: string[];
  roles: MailEventOption[];
  fields: MailEventOption[];
  dateFields: MailEventOption[];
  predicates: MailEventOption[];
  automationCount: number;
}

// ── Automations ────────────────────────────────────────────────────────────

export type MailDeliveryMode = "IMMEDIATE" | "QUEUED";
export type MailChannel = "EMAIL";
export type MailAutomationSeedOrigin = "SEED" | "MANUAL";

export interface MailAutomationStats {
  queued: number;
  sent: number;
  failed: number;
  skipped: number;
  cancelled: number;
  last7dSent: number;
  lastSentAt: string | null;
}

export interface MailAutomation {
  id: number;
  automationKey: string | null;
  name: string;
  description: string | null;
  // Trigger: EITHER triggerEvents (one or more event keys) OR cron + audienceKey.
  triggerEvents: string[];
  cron: string | null;
  audienceKey: string | null;
  // Predicate keys, checked when the event arrives (and again at send time when recheckBeforeSend).
  conditions: string[];
  // Timing: relativeToField => one job per offset (negative = before) relative to that date in the
  // event; else one job after delayMinutes, then every repeatEveryMinutes up to maxSends total.
  delayMinutes: number;
  relativeToField: string | null;
  relativeOffsetsMinutes: number[];
  repeatEveryMinutes: number | null;
  maxSends: number | null;
  templateId: number | null;
  templateName: string | null;
  templateMailKey: string | null;
  emailType: string | null;
  recipientRoles: string[];
  extraRecipients: string[];
  // Pending jobs are cancelled when one of these events arrives for the same subject.
  cancelOnEvents: string[];
  deliveryMode: MailDeliveryMode;
  recheckBeforeSend: boolean;
  respectQuietHours: boolean;
  channel: MailChannel;
  scopeInstitutes: number[] | null;
  topic: string | null;
  enabled: boolean;
  paused: boolean;
  seedOrigin: MailAutomationSeedOrigin;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
  stats: MailAutomationStats;
}

// emailType is derived from the template on the server, so the client may omit it.
export type MailAutomationPayload = Omit<
  MailAutomation,
  "id" | "automationKey" | "templateName" | "templateMailKey" | "seedOrigin" | "warnings" | "createdAt" | "updatedAt" | "stats" | "emailType"
> & { emailType?: string | null };

export interface MailAudience {
  key: string;
  label: string;
  description: string;
}

// ── Queue ──────────────────────────────────────────────────────────────────

export type MailJobStatus = "PENDING" | "PROCESSING" | "RETRY" | "SENT" | "FAILED" | "CANCELLED" | "SKIPPED";

export interface MailJob {
  id: string;
  automationId: number | null;
  automationName: string | null;
  eventKey: string | null;
  recipient: string;
  role: string | null;
  subjectKey: string | null;
  fireAt: string;
  createdAt: string;
  attempts: number;
  seq: number;
  status: MailJobStatus;
  lastError: string | null;
  skipReason: string | null;
  templateName: string | null;
}

export interface MailQueueSummary {
  engineEnabled: boolean;
  paused: boolean;
  pending: number;
  processing: number;
  retrying: number;
  sentToday: number;
  failedToday: number;
}

export interface MailQueueResponse {
  summary: MailQueueSummary;
  jobs: MailJob[];
  recent: MailJob[];
}

export interface MailQueueFilters {
  status?: string;
  automationId?: number | string;
  recipient?: string;
  limit?: number;
}

// ── Settings ───────────────────────────────────────────────────────────────

export interface MailSettings {
  engineEnabled: boolean;
  dailyCeilingPerAccount: number;
  reserveForImmediate: number;
  paceSendsPerSecond: number;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
  stagingSinkEmail: string | null;
  updatedAt: string | null;
}

// ── Calls ──────────────────────────────────────────────────────────────────

export function getMailEvents() {
  return axios.get<MailEventInfo[]>(`${API_URL}/mail-events`);
}

export function getMailAutomations() {
  return axios.get<MailAutomation[]>(`${API_URL}/mail-automations`);
}

export function getMailAutomation(id: number) {
  return axios.get<MailAutomation>(`${API_URL}/mail-automations/${id}`);
}

export function createMailAutomation(payload: MailAutomationPayload) {
  return axios.post<MailAutomation>(`${API_URL}/mail-automations`, payload);
}

export function updateMailAutomation(id: number, payload: MailAutomationPayload) {
  return axios.put<MailAutomation>(`${API_URL}/mail-automations/${id}`, payload);
}

export function deleteMailAutomation(id: number) {
  return axios.delete<{ message: string }>(`${API_URL}/mail-automations/${id}`);
}

export function setMailAutomationEnabled(id: number, enabled: boolean) {
  return axios.post<MailAutomation>(`${API_URL}/mail-automations/${id}/enabled`, { enabled });
}

export function setMailAutomationPaused(id: number, paused: boolean) {
  return axios.post<MailAutomation>(`${API_URL}/mail-automations/${id}/paused`, { paused });
}

export function getMailAudiences() {
  return axios.get<MailAudience[]>(`${API_URL}/mail-automations/audiences`);
}

export function getMailQueue(filters: MailQueueFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.automationId !== undefined && filters.automationId !== "") params.set("automationId", String(filters.automationId));
  if (filters.recipient) params.set("recipient", filters.recipient);
  params.set("limit", String(filters.limit ?? 200));
  return axios.get<MailQueueResponse>(`${API_URL}/mail-queue?${params.toString()}`);
}

export function cancelMailJob(id: string) {
  return axios.post<{ message: string }>(`${API_URL}/mail-queue/${encodeURIComponent(id)}/cancel`);
}

// Fires the job now.
export function retryMailJob(id: string) {
  return axios.post<{ message: string }>(`${API_URL}/mail-queue/${encodeURIComponent(id)}/retry`);
}

export function setMailQueuePaused(paused: boolean) {
  return axios.post<{ paused: boolean }>(`${API_URL}/mail-queue/paused`, { paused });
}

export function getMailSettings() {
  return axios.get<MailSettings>(`${API_URL}/mail-settings`);
}

export function updateMailSettings(settings: MailSettings) {
  return axios.put<MailSettings>(`${API_URL}/mail-settings`, settings);
}
