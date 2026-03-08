import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface RetryableConfig extends InternalAxiosRequestConfig {
  __retryCount?: number;
}

const assessmentApi = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8091',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// Request interceptor — inject session headers on every request
assessmentApi.interceptors.request.use((config: RetryableConfig) => {
  const sessionToken = sessionStorage.getItem('assessmentSessionToken');
  const userStudentId = localStorage.getItem('userStudentId');
  const assessmentId = localStorage.getItem('assessmentId');

  if (sessionToken) {
    config.headers['X-Assessment-Session'] = sessionToken;
  }
  if (userStudentId) {
    config.headers['X-Assessment-Student-Id'] = userStudentId;
  }
  if (assessmentId) {
    config.headers['X-Assessment-Id'] = assessmentId;
  }

  return config;
});

// Response interceptor — retry with exponential backoff for network errors and 5xx
assessmentApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;

    if (!config) {
      return Promise.reject(error);
    }

    const retryCount = config.__retryCount || 0;

    // Only retry on network errors or 5xx server errors
    const isRetryable = !error.response || error.response.status >= 500;

    if (!isRetryable || retryCount >= MAX_RETRIES) {
      return Promise.reject(error);
    }

    // Increment retry count directly on the config object (axios 0.26.x compatible)
    config.__retryCount = retryCount + 1;

    // Exponential backoff: 1s, 2s, 4s
    const delay = BASE_DELAY_MS * Math.pow(2, config.__retryCount - 1);
    await new Promise((resolve) => setTimeout(resolve, delay));

    return assessmentApi(config);
  }
);

/**
 * Maps an AxiosError to a user-friendly error message string.
 */
export function getErrorMessage(error: AxiosError): string {
  if (!error.response) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }

  switch (error.response.status) {
    case 403:
      return 'Your assessment session has expired. Please return to the assessment list and start again.';
    case 409:
      return 'Your assessment has already been submitted successfully.';
    case 400: {
      const data = error.response.data;
      return typeof data === 'string' ? data : 'Invalid submission data. Please try again.';
    }
    case 500:
      return 'The server encountered an error. Your answers are saved. Please try again in a moment.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

export default assessmentApi;
