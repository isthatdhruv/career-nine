import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

export type EmailDeliveryMode = "SYNC" | "ASYNC";
export type EmailMailClass = "TRANSACTIONAL" | "SUBSCRIBED" | "INTERNAL";
export type EmailSeedOrigin = "SEED" | "CODE_PORT" | "REMINDER_CONFIG" | "MANUAL";
export type EmailPortState = "PORTED" | "CONTENT_ONLY";
export type EmailReviewStatus = "NOT_REVIEWED" | "APPROVED" | "NEEDS_CHANGE";
export type LintSeverity = "WARN" | "INFO";

export interface LintFinding {
  code: string;
  severity: LintSeverity;
  message: string;
}

export interface EmailTemplate {
  id: number;
  name: string;
  emailType: string;
  subjectTemplate: string | null;
  bodyTemplate: string | null;
  isDefault: boolean;
  deliveryMode: EmailDeliveryMode;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  // Provenance + review state (see the mail catalogue)
  mailKey: string | null;
  textTemplate: string | null;
  mailClass: EmailMailClass | null;
  seedOrigin: EmailSeedOrigin | null;
  sourceRef: string | null;
  portState: EmailPortState;
  variantFlags: string[];
  reviewStatus: EmailReviewStatus;
  reviewNotes: string | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  edited: boolean;
  live: boolean;
  findings: LintFinding[];
}

export interface EmailTemplatePayload {
  name: string;
  emailType: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isDefault: boolean;
  deliveryMode: EmailDeliveryMode;
  active: boolean;
  mailKey?: string;
  textTemplate?: string;
  mailClass?: string;
  variantFlags?: string[];
}

export interface EmailPlaceholderInfo {
  key: string;
  label: string;
  group: string;
}

export interface EmailTypeCatalogEntry {
  key: string;
  label: string;
  category: string;
  defaultDeliveryMode: EmailDeliveryMode;
  placeholders: EmailPlaceholderInfo[];
}

export interface EmailTemplatePreview {
  subject: string;
  html: string;
  text: string;
}

// A variant flag set to "true" renders its {{#flag}} section, "" hides it.
// Any placeholder key may be overridden the same way.
export interface EmailPreviewOptions {
  previewOverrides?: Record<string, string>;
  whitelabel?: boolean;
}

export interface EmailReviewPayload {
  reviewStatus: EmailReviewStatus;
  reviewNotes: string | null;
}

export interface EmailTemplateTestResult {
  success: boolean;
  status?: string;
  error?: string;
  logId?: number;
}

export interface MailCatalogueSummary {
  total: number;
  live: number;
  contentOnly: number;
  manual: number;
  unedited: number;
  notReviewed: number;
  approved: number;
  needsChange: number;
  withFindings: number;
}

export interface MailCatalogueRow {
  id: number;
  mailKey: string | null;
  name: string;
  emailType: string;
  typeLabel: string;
  category: string;
  mailClass: EmailMailClass | null;
  seedOrigin: EmailSeedOrigin | null;
  sourceRef: string | null;
  portState: EmailPortState;
  live: boolean;
  isDefault: boolean;
  active: boolean;
  edited: boolean;
  reviewStatus: EmailReviewStatus;
  reviewNotes: string | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  updatedAt: string;
  variantFlags: string[];
  hasText: boolean;
  findings: LintFinding[];
}

export interface MailCatalogueUnlisted {
  what: string;
  why: string;
}

export interface MailCatalogue {
  summary: MailCatalogueSummary;
  rows: MailCatalogueRow[];
  unlisted: MailCatalogueUnlisted[];
}

export function getEmailTemplates(emailType?: string) {
  const q = emailType ? `?emailType=${encodeURIComponent(emailType)}` : "";
  return axios.get<EmailTemplate[]>(`${API_URL}/email-templates${q}`);
}

export function getEmailTemplate(id: number) {
  return axios.get<EmailTemplate>(`${API_URL}/email-templates/${id}`);
}

export function getEmailTypeCatalog() {
  return axios.get<EmailTypeCatalogEntry[]>(`${API_URL}/email-templates/catalog`);
}

// Every mail the system sends (including copy ported from Java), with provenance and review state.
export function getMailCatalogue() {
  return axios.get<MailCatalogue>(`${API_URL}/email-templates/catalogue`);
}

export function createEmailTemplate(payload: EmailTemplatePayload) {
  return axios.post<EmailTemplate>(`${API_URL}/email-templates`, payload);
}

export function updateEmailTemplate(id: number, payload: EmailTemplatePayload) {
  return axios.put<EmailTemplate>(`${API_URL}/email-templates/${id}`, payload);
}

export function deleteEmailTemplate(id: number) {
  return axios.delete<{ message: string }>(`${API_URL}/email-templates/${id}`);
}

// Server-side render of a (possibly unsaved) template with sample values, for the preview pane.
export function previewEmailTemplate(payload: EmailTemplatePayload, options: EmailPreviewOptions = {}) {
  return axios.post<EmailTemplatePreview>(`${API_URL}/email-templates/preview`, { ...payload, ...options });
}

// Lint a (possibly unsaved) template; findings are advisory and never block a save.
export function lintEmailTemplate(payload: EmailTemplatePayload) {
  return axios.post<LintFinding[]>(`${API_URL}/email-templates/lint`, payload);
}

export function reviewEmailTemplate(id: number, payload: EmailReviewPayload) {
  return axios.put<EmailTemplate>(`${API_URL}/email-templates/${id}/review`, payload);
}

export function testEmailTemplate(id: number, to: string) {
  return axios.post<EmailTemplateTestResult>(`${API_URL}/email-templates/${id}/test`, { to });
}
