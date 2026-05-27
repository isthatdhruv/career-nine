import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

export type JwtTokenType = "ACCESS" | "REFRESH" | "ASSESSMENT" | "LEGACY";
export type JwtTokenStatus = "live" | "revoked" | "expired" | "";

export interface JwtTokenAudit {
  jti: string;
  userId: number;
  userEmail: string | null;
  tokenType: JwtTokenType;
  issuedAt: string;
  expiresAt: string;
  notBefore: string | null;
  revokedAt: string | null;
  revokedBy: number | null;
  revocationReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  rolesSnapshot: string | null;
  superAdmin: boolean;
  issuer: string | null;
}

export interface JwtTokenListResponse {
  content: JwtTokenAudit[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface JwtTokenStats {
  total: number;
  live: number;
  revoked: number;
  expired: number;
  byType: Record<JwtTokenType, number>;
}

export interface ListFilters {
  userId?: number;
  tokenType?: JwtTokenType;
  email?: string;
  status?: JwtTokenStatus;
  page?: number;
  size?: number;
}

export function listJwtTokens(filters: ListFilters = {}) {
  const params = new URLSearchParams();
  if (filters.userId != null) params.set("userId", String(filters.userId));
  if (filters.tokenType) params.set("tokenType", filters.tokenType);
  if (filters.email) params.set("email", filters.email);
  if (filters.status) params.set("status", filters.status);
  if (filters.page != null) params.set("page", String(filters.page));
  if (filters.size != null) params.set("size", String(filters.size));
  const qs = params.toString();
  return axios.get<JwtTokenListResponse>(
    `${API_URL}/admin/jwt-tokens${qs ? `?${qs}` : ""}`
  );
}

export function getJwtTokenDetail(jti: string) {
  return axios.get<JwtTokenAudit>(`${API_URL}/admin/jwt-tokens/${jti}`);
}

export function revokeJwtToken(jti: string, reason: string) {
  return axios.post(`${API_URL}/admin/jwt-tokens/${jti}/revoke`, { reason });
}

export function revokeAllForUser(userId: number, reason: string) {
  return axios.post(
    `${API_URL}/admin/jwt-tokens/users/${userId}/revoke-all`,
    { reason }
  );
}

export function getJwtTokenStats() {
  return axios.get<JwtTokenStats>(`${API_URL}/admin/jwt-tokens/stats`);
}
