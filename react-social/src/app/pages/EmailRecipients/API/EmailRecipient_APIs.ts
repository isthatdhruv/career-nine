import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

export type RecipientKind = "TO" | "CC" | "BCC";

/**
 * A standing recipient of an automatic notification.
 *
 * `leadType` and `source` are narrowing filters — null on either means "every lead".
 * They are only meaningful for the lead scenarios; other send-scenarios ignore them.
 */
export interface EmailRecipient {
  id: number;
  emailType: string;
  email: string;
  label: string | null;
  recipientKind: RecipientKind;
  leadType: string | null;
  source: string | null;
  active: boolean;
  updatedAt: string | null;
}

export interface EmailRecipientPayload {
  emailType: string;
  email: string;
  label: string | null;
  recipientKind: RecipientKind;
  leadType: string | null;
  source: string | null;
  active: boolean;
}

export interface RecipientOptions {
  leadTypes: { value: string; label: string }[];
  recipientKinds: RecipientKind[];
}

export function getEmailRecipients(emailType?: string) {
  const q = emailType ? `?emailType=${encodeURIComponent(emailType)}` : "";
  return axios.get<EmailRecipient[]>(`${API_URL}/email-recipients${q}`);
}

export function getRecipientOptions() {
  return axios.get<RecipientOptions>(`${API_URL}/email-recipients/options`);
}

export function createEmailRecipient(payload: EmailRecipientPayload) {
  return axios.post<EmailRecipient>(`${API_URL}/email-recipients`, payload);
}

export function updateEmailRecipient(id: number, payload: Partial<EmailRecipientPayload>) {
  return axios.put<EmailRecipient>(`${API_URL}/email-recipients/${id}`, payload);
}

export function deleteEmailRecipient(id: number) {
  return axios.delete<{ message: string }>(`${API_URL}/email-recipients/${id}`);
}
