import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

export function getAllDemographicFields() {
  return axios.get(`${API_URL}/demographic-fields/getAll`);
}

export function getActiveDemographicFields() {
  return axios.get(`${API_URL}/demographic-fields/getActive`);
}

export function getDemographicFieldById(id: number) {
  return axios.get(`${API_URL}/demographic-fields/get/${id}`);
}

export function createDemographicField(data: any) {
  return axios.post(`${API_URL}/demographic-fields/create`, data);
}

export function updateDemographicField(id: number, data: any) {
  return axios.put(`${API_URL}/demographic-fields/update/${id}`, data);
}

export function deleteDemographicField(id: number) {
  return axios.delete(`${API_URL}/demographic-fields/delete/${id}`);
}
