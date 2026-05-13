import axios from "axios";
import { User } from "./_models";

const API_URL = process.env.REACT_APP_API_URL 

export const GET_USER_BY_ACCESSTOKEN_URL = `${API_URL}/user/me`;
export const LOGIN_URL = `${API_URL}/auth/login`;
export const REGISTER_URL = `${API_URL}/register`;
export const REQUEST_PASSWORD_URL = `${API_URL}/forgot_password`;

// Backend returns { accessToken, tokenType }
export function login(email: string, password: string) {
  return axios.post<{ accessToken: string; tokenType: string }>(LOGIN_URL, {
    email,
    password,
  });
}

// Server should return AuthModel
export function register(
email: string, firstname: string, lastname: string, password: string, password_confirmation: string, phone: string, organisation: string, designation: string) {
  return axios.post(REGISTER_URL, {
    email,
    first_name: firstname,
    last_name: lastname,
    organisation,
    designation,
    phone,
    password,
    password_confirmation,
  });
}

// Server should return object => { result: boolean } (Is Email in DB)
export function requestPassword(email: string) {
  return axios.post<{ result: boolean }>(REQUEST_PASSWORD_URL, {
    email,
  });
}

export function getUserByToken(_token?: string) {
  // Phase 16: token is unused. cn_at cookie is attached automatically by
  // axios (withCredentials: true is set in AuthHelpers.setupAxios).
  // The parameter is kept optional for source-level back-compat with
  // existing callers that still pass auth.api_token.
  return axios.get<User>(GET_USER_BY_ACCESSTOKEN_URL);
}

export const LOGOUT_URL = `${API_URL}/auth/logout`;

export function logout() {
  // Server clears cn_at and cn_csrf via Max-Age=0.
  return axios.post(LOGOUT_URL);
}

export const OAUTH_EXCHANGE_URL = `${API_URL}/auth/oauth-exchange`;

// Phase 16-04: POST the URL-extracted JWT (from /oauth2/redirect?token=...) to the
// server so it can validate the signature/expiry and Set-Cookie the standard
// cn_at + cn_csrf pair. The token never reaches localStorage and is wiped from
// the address bar via window.history.replaceState in authRedirectPage.tsx.
export function exchangeOAuthToken(token: string) {
  return axios.post(OAUTH_EXCHANGE_URL, { token });
}
