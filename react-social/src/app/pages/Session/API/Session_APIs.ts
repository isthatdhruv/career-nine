import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL ;

const ReadSession = `${API_URL}/instituteSession/get`;
const readSessionById = `${API_URL}/instituteSession/getbyBatchId/`;
const updateSession = `${API_URL}/instituteSession/update`;
const deleteSession = `${API_URL}/instituteSession/delete/`;

export function readSessionData() {
  return axios.get(ReadSession);
}

export function ReadSessionByBatchIdData(id: any) {
  return axios.get(readSessionById + id);
}

export function UpdateSessionData(values: any) {
  return axios.post(updateSession, {
    values,
  });
}

export function DeleteSessionData(id: any) {
  return axios.get(deleteSession + id);
}
