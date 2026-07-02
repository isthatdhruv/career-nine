import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

// ── Types ────────────────────────────────────────────────────────────────────
export type EmailProvider = "GMAIL" | "ODOO";
export type EmailMode = "API" | "SMTP" | null;

export interface EmailAccount {
  id: number;
  name: string;
  provider: EmailProvider;
  mode: EmailMode;
  fromEmail: string;
  fromName: string;
  isGlobalDefault: boolean;
  active: boolean;
  hasCredentials: boolean;
  createdAt: string;
  updatedAt: string;
}

// Provider + mode dependent credential shape. All fields optional at the type
// level because which ones apply depends on provider/mode; the form only sends
// the relevant subset. On edit, credentials may be omitted entirely to keep the
// existing (write-only) secrets.
export interface EmailAccountCredentials {
  // GMAIL + API
  useClasspathDefault?: boolean;
  serviceAccountJson?: string;
  delegatedUser?: string;
  // GMAIL + SMTP
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpStarttls?: boolean;
  // ODOO
  odooUrl?: string;
  odooDatabase?: string;
  odooUsername?: string;
  odooApiKey?: string;
}

export interface EmailAccountPayload {
  name: string;
  provider: EmailProvider;
  mode: EmailMode;
  fromEmail: string;
  fromName: string;
  isGlobalDefault: boolean;
  active: boolean;
  credentials?: EmailAccountCredentials;
}

export interface EmailAccountTestResult {
  success: boolean;
  status?: string;
  error?: string;
  logId?: number;
}

// ── Endpoints ────────────────────────────────────────────────────────────────
export function getEmailAccounts() {
  return axios.get<EmailAccount[]>(`${API_URL}/email-accounts`);
}

export function getEmailAccount(id: number) {
  return axios.get<EmailAccount>(`${API_URL}/email-accounts/${id}`);
}

export function createEmailAccount(payload: EmailAccountPayload) {
  return axios.post<EmailAccount>(`${API_URL}/email-accounts`, payload);
}

export function updateEmailAccount(id: number, payload: EmailAccountPayload) {
  return axios.put<EmailAccount>(`${API_URL}/email-accounts/${id}`, payload);
}

export function deleteEmailAccount(id: number) {
  return axios.delete<{ message: string }>(`${API_URL}/email-accounts/${id}`);
}

export function testEmailAccount(id: number, to: string) {
  return axios.post<EmailAccountTestResult>(`${API_URL}/email-accounts/${id}/test`, { to });
}

// Test credentials BEFORE saving — sends a real test through a transient (unsaved) account.
export function testEmailAccountConnection(payload: EmailAccountPayload, to: string) {
  return axios.post<EmailAccountTestResult>(
    `${API_URL}/email-accounts/test-connection?to=${encodeURIComponent(to)}`,
    payload
  );
}
