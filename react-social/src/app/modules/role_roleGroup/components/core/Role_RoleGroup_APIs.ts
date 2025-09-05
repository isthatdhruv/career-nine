import axios from 'axios';
const API_URL = process.env.REACT_APP_API_URL  

export const ReadRole = `${API_URL}/role/get`;
export const upsertRoleGroup = `${API_URL}/rolegroup/update`;

export const readRole_RoleGroup = `${API_URL}/rolegroup/get`;
export const upsertRole_RoleGroup = `${API_URL}/rolegroup/update`;
export const deleteRole_RoleGroup = `${API_URL}/rolegroup/delete/`;

export interface crudApiModal {
  data?: any;
}

export function readRoleData() {
  return axios.get(ReadRole);
}

export function upsertRoleData(values: any) {
  return axios.post<crudApiModal>(upsertRoleGroup, {
    values,
  });
}

export function readRole_RoleGroupData() {
  return axios.get(readRole_RoleGroup);
}

export function upsertRole_RoleGroupData(values: any) {
  return axios.post<crudApiModal>(upsertRole_RoleGroup, {
    values,
  });
}

export function deleteRole_RoleGroupData(id: any) {
  return axios.get<crudApiModal>(deleteRole_RoleGroup + id);
}
