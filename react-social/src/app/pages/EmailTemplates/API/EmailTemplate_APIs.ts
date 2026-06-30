import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

export type EmailDeliveryMode = "SYNC" | "ASYNC";

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
}

export interface EmailTemplatePayload {
  name: string;
  emailType: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isDefault: boolean;
  deliveryMode: EmailDeliveryMode;
  active: boolean;
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
}

export interface EmailTemplateTestResult {
  success: boolean;
  status?: string;
  error?: string;
  logId?: number;
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
export function previewEmailTemplate(payload: EmailTemplatePayload) {
  return axios.post<EmailTemplatePreview>(`${API_URL}/email-templates/preview`, payload);
}

export function testEmailTemplate(id: number, to: string) {
  return axios.post<EmailTemplateTestResult>(`${API_URL}/email-templates/${id}/test`, { to });
}
