import axios from "axios";
import { User } from "./_models";

const API_URL = process.env.REACT_APP_API_URL;

export const ME_URL = `${API_URL}/auth/me`;
export const LOGIN_URL = `${API_URL}/auth/login`;
export const LOGOUT_URL = `${API_URL}/auth/logout`;
export const OAUTH_EXCHANGE_URL = `${API_URL}/auth/oauth-exchange`;
export const FORGOT_PASSWORD_URL = `${API_URL}/auth/forgot-password`;
export const RESET_PASSWORD_URL = `${API_URL}/auth/reset-password`;

// Phase 16/18 cookie-based auth:
//   - The server sets cn_at (HttpOnly), cn_csrf (JS-readable), cn_rt (HttpOnly,
//     Path=/auth/refresh) on the response. The JSON body still carries
//     {accessToken} for back-compat with legacy callers (e.g. external curl
//     scripts), but the React app does not read it — cookies do the work.
export function login(email: string, password: string) {
  return axios.post<{ accessToken: string }>(LOGIN_URL, { email, password });
}

// Student-mode login on the same unified endpoint: identifier is a username OR
// email, the secret is date of birth (dd-MM-yyyy). The server verifies the user
// is a student (has a UserStudent record) and sets the same cn_at session cookie.
export function studentLogin(identifier: string, dob: string) {
  return axios.post<{ accessToken: string; userStudentId: number }>(LOGIN_URL, {
    mode: "student",
    email: identifier,
    dob,
  });
}

// Returns the authenticated user. The cn_at cookie is auto-attached by axios
// (withCredentials defaults in AuthHelpers.setupAxios). 401 if no valid cookie.
//
// __skipAuthRedirect is set so the response interceptor treats a 401 here as
// the LEGITIMATE "not logged in yet" signal and lets the caller's own catch
// block handle it. Without it, AuthInit on the public /auth page would loop:
// 401 → interceptor redirects to /auth → page reloads → AuthInit fires again.
export function getCurrentUser() {
  return axios.get<User>(ME_URL, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __skipAuthRedirect: true,
  } as any);
}

export function logout() {
  // Server revokes the access-jti, revokes the refresh-token row, and clears
  // cn_at + cn_csrf + cn_rt via Max-Age=0.
  return axios.post(LOGOUT_URL);
}

// Phase 16-04: POST the URL-extracted JWT (from /oauth2/redirect?token=...) so
// the server can validate it and Set-Cookie the standard cn_at + cn_csrf pair.
// The token never reaches localStorage and is wiped from the address bar via
// window.history.replaceState in authRedirectPage.tsx.
export function exchangeOAuthToken(token: string) {
  return axios.post(OAUTH_EXCHANGE_URL, { token });
}

// Request a single-use password reset link. Server emails the link via Odoo.
// Returns 404 with { success: false, message: "This email is not registered." }
// when the email is not a registered local-provider account.
export function requestPasswordReset(email: string) {
  return axios.post<{ success: boolean; message: string }>(
    FORGOT_PASSWORD_URL,
    { email }
  );
}

// Consume the single-use token and set a new password. Server returns 400 if
// the token is invalid, expired, or already used.
export function resetPasswordWithToken(token: string, newPassword: string) {
  return axios.post<{ success: boolean; message: string }>(
    RESET_PASSWORD_URL,
    { token, newPassword }
  );
}
