import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

// Per-institute default sending account (Phase 2 routing). A null defaultAccountId (or no
// row) means the institute falls back to the global default account.
export interface InstituteEmailSetting {
  id: number;
  instituteCode: number;
  defaultAccountId: number | null;
  defaultAccountName: string | null;
  updatedAt: string;
}

export function getInstituteEmailSettings() {
  return axios.get<InstituteEmailSetting[]>(`${API_URL}/institute-email-settings`);
}

export function getInstituteEmailSetting(instituteCode: number | string) {
  return axios.get<InstituteEmailSetting>(`${API_URL}/institute-email-settings/${instituteCode}`);
}

// Upsert the default account for an institute. Pass null to clear (fall back to global).
export function setInstituteEmailSetting(
  instituteCode: number | string,
  defaultAccountId: number | null
) {
  return axios.put<InstituteEmailSetting>(
    `${API_URL}/institute-email-settings/${instituteCode}`,
    { defaultAccountId }
  );
}

export function clearInstituteEmailSetting(instituteCode: number | string) {
  return axios.delete<{ message: string }>(
    `${API_URL}/institute-email-settings/${instituteCode}`
  );
}
