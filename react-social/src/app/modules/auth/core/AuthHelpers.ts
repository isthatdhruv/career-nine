import { AuthModel } from "./_models";

const AUTH_LOCAL_STORAGE_KEY = "kt-auth-react-v";
const getAuth = (): AuthModel | undefined => {
  if (!localStorage) {
    return;
  }

  const lsValue: string | null = localStorage.getItem(AUTH_LOCAL_STORAGE_KEY);
  if (!lsValue) {
    return;
  }

  try {
    const auth: AuthModel = JSON.parse(lsValue) as AuthModel;
    if (auth) {
      // You can easily check auth_token expiration also
      return auth;
    }
  } catch (error) {
    console.error("AUTH LOCAL STORAGE PARSE ERROR", error);
  }
};

const setAuth = (auth: AuthModel) => {
  if (!localStorage) {
    return;
  }

  try {
    const lsValue = JSON.stringify(auth);
    localStorage.setItem(AUTH_LOCAL_STORAGE_KEY, lsValue);
  } catch (error) {
    console.error("AUTH LOCAL STORAGE SAVE ERROR", error);
  }
};

const removeAuth = () => {
  if (!localStorage) {
    return;
  }

  try {
    localStorage.removeItem(AUTH_LOCAL_STORAGE_KEY);
  } catch (error) {
    console.error("AUTH LOCAL STORAGE REMOVE ERROR", error);
  }
};

export function setupAxios(axios: any) {
  axios.defaults.headers.Accept = "application/json";
  axios.interceptors.request.use(
    (config: { headers: { Authorization: string } }) => {
      const auth = getAuth();
      if (auth && auth.api_token) {
        config.headers.Authorization = `Bearer ${auth.api_token}`;
      }

      return config;
    },
    (err: any) => Promise.reject(err)
  );

  axios.interceptors.response.use(
    (response: any) => response,
    (error: any) => {
      if (!error.response) {
        const { showErrorToast } = require('../../utils/toast');
        showErrorToast('Connection issue, check your internet');
        return Promise.reject(error);
      }

      const status = error.response.status;
      const message = error.response?.data?.message || '';

      if (status === 401) {
        const { showErrorToast } = require('../../utils/toast');
        showErrorToast('Session expired, please log in again');
        removeAuth();
        window.location.href = '/auth';
        return Promise.reject(error);
      }

      if (status === 403) {
        const { showErrorToast } = require('../../utils/toast');
        showErrorToast(message || 'You don\'t have permission for this action');
        return Promise.reject(error);
      }

      if (status >= 500) {
        const { showErrorToast } = require('../../utils/toast');
        showErrorToast(message || 'Something went wrong, please try again');
        return Promise.reject(error);
      }

      // 400, 409, and other client errors pass through to the component
      return Promise.reject(error);
    }
  );
}

export { getAuth, setAuth, removeAuth, AUTH_LOCAL_STORAGE_KEY };
