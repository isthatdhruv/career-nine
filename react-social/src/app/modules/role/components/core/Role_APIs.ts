import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL  

export const ReadRole = `${API_URL}/role/get`;
export const ReadRolebyId = `${API_URL}/role/getbyid/`;
export const upsertRole = `${API_URL}/role/update`;
export const deleteRole = `${API_URL}/role/delete/`;

export interface crudApiModal {
  data?: any;
}

export function readRoleData() {
  return axios.get(ReadRole);
}

export function readRoleDatabyId(id: any) {
  return axios.get(ReadRolebyId + id);
}

export function upsertRoleData(values: any) {
  return axios.put<crudApiModal>(upsertRole, {
    values,
  });
}

export function DeleteRoleData(id: any) {
  return axios.delete(deleteRole + id);
}
