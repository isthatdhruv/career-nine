

import axios from 'axios';
const API_URL = process.env.REACT_APP_API_URL  

const FindEmail = `${API_URL}/google-api/username/get/`;
const ResetPassword = `${API_URL}/google-api/password-reset/update`;

export interface crudApiModal {
  data?: any;
}

export function findemail(id: any) {
  return axios.get(FindEmail + id);
  //return axios.get(FileDelete+id)
}

export function resetpassword(values: any) {
  return axios.post(ResetPassword, {
    values,
  });
  //return axios.get(FileDelete+id)
}
