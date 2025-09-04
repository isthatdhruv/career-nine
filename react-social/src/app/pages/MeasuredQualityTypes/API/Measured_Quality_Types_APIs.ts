import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

const readMeasuredQualityTypes = `${API_URL}/measured-quality-types/getAll`;
const readMeasuredQualityTypesById = `${API_URL}/measured-quality-types/get/`;
const createMeasuredQualityTypes = `${API_URL}/measured-quality-types/create`;
const updateMeasuredQualityTypes = `${API_URL}/measured-quality-types/update`;
const deleteMeasuredQualityTypes = `${API_URL}/measured-quality-types/delete/`;

export function ReadMeasuredQualityTypesData() {
  return axios.get(readMeasuredQualityTypes);
}

export function ReadMeasuredQualityTypesByIdData(id: any) {
  return axios.get(readMeasuredQualityTypesById + id);
}

export function CreateMeasuredQualityTypesData(values: any) {
  return axios.post(createMeasuredQualityTypes, values);
}

export function UpdateMeasuredQualityTypesData(id: any, values: any) {
  return axios.put(`${updateMeasuredQualityTypes}/${id}`, values);
}

export function DeleteMeasuredQualityTypesData(id: any) {
  return axios.delete(deleteMeasuredQualityTypes + id);
}
