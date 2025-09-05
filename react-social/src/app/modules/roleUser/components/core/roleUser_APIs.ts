import axios from 'axios';
const API_URL = process.env.REACT_APP_API_URL  

export const createUser = `${API_URL}/roleurl/createRole`;
export const ReadUser = `${API_URL}/user/get`;
export const ReadUserbyId = `${API_URL}/user/getbyid/`;
export const upsertUser = `${API_URL}/user/update`;
export const deleteUser = `${API_URL}/user/delete/`;

export const ReadRole = `${API_URL}/role/get`;
export const ReadRoleGroup = `${API_URL}/rolegroup/get`;
export const readRoleUser = `${API_URL}/userrolegroupmapping/get`;
export const upsertRoleUser = `${API_URL}/userrole/update/`;
export const upsertRoleGroupUser = `${API_URL}/userrolegroupmapping/update`;
export const deleteRoleUser = `${API_URL}/userrolegroupmapping/delete/`;
const FindEmail = `${API_URL}/userrole/get/`;
const ResetPassword = `${API_URL}/google-api/password-reset/update`;

export interface crudApiModal {
  data?: any;
}

export function readRoleData() {
  return axios.get(ReadRole);
}
export function readRoleGroupData() {
  return axios.get(ReadRoleGroup);
}

export function readUserData() {
  return axios.get(ReadUser);
}

export function readUserDatabyId(id: any) {
  return axios.post<crudApiModal>(ReadUserbyId + id);
}

export function upsertRoleGroupUserData(values: any) {
  return axios.post<crudApiModal>(upsertRoleGroupUser, {
    values,
  });
}

export function deleteUserData(id: any) {
  return axios.post<crudApiModal>(deleteUser + id);
}

export function readRoleUserData() {
  return axios.get(readRoleUser);
}

export function upsertRoleUserData(values: any, email: any) {
  return axios.post<crudApiModal>(upsertRoleUser + email, {
    values,
  });
}

export function upsertUserData(values: any) {
  return axios.post<crudApiModal>(upsertUser, {
    values,
  });
}

export function deleteRoleUserData(id: any) {
  return axios.get(deleteRoleUser + id);
}
export function findemail(id: any) {
  return axios.get(FindEmail + id);
  //return axios.get(FileDelete+id)
}

export function resetpassword(values: any) {
  return axios.post(ResetPassword, {
    values,
  });
}
