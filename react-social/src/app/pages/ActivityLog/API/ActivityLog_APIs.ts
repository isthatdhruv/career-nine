import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

export function getLoginLogs(startDate: string, endDate: string) {
  return axios.get(
    `${API_URL}/activity-log/logins?startDate=${startDate}&endDate=${endDate}`
  );
}

export function getUrlAccessLogs(
  userId: number,
  startDate: string,
  endDate: string
) {
  return axios.get(
    `${API_URL}/activity-log/urls/${userId}?startDate=${startDate}&endDate=${endDate}`
  );
}
