import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

const readMeasuredQualities = `${API_URL}/measured-qualities/getAll`;
const readMeasuredQualitiesById = `${API_URL}/measured-qualities/get/`;
const createMeasuredQualities = `${API_URL}/measured-qualities/create`;
const updateMeasuredQualities = `${API_URL}/measured-qualities/update`;
const deleteMeasuredQualities = `${API_URL}/measured-qualities/delete/`;
const readTools = `${API_URL}/tools/getAll`;

export function ReadToolsData() {
  return axios.get(readTools);
}
export function ReadMeasuredQualitiesData() {
  return axios.get(readMeasuredQualities);
}

export function ReadMeasuredQualitiesByIdData(id: any) {
  return axios.get(readMeasuredQualitiesById + id);
}

export function CreateMeasuredQualitiesData(values: any) {
  return axios.post(createMeasuredQualities, values);
}

export function UpdateMeasuredQualitiesData(id: any, values: any) {
  return axios.put(`${updateMeasuredQualities}/${id}`, values);
}

export function DeleteMeasuredQualitiesData(id: any) {
  return axios.delete(deleteMeasuredQualities + id);
}
