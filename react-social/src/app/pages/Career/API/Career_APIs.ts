import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

<<<<<<< HEAD
const readCareer = `${API_URL}/career/getAll`;
const readCareerById = `${API_URL}/career/get/`;
const createCareer = `${API_URL}/career/create`;
const updateCareer = `${API_URL}/career/update`;
const deleteCareer = `${API_URL}/career/delete/`;

export function ReadCareerData() {
  return axios.get(readCareer);
=======
export function ReadCareersData() {
  return axios.get(`${API_URL}/career/getAll`);
>>>>>>> origin/palak
}
export function ReadCareerByIdData(id: any) {
  return axios.get(`${API_URL}/career/get/${id}`);
}
<<<<<<< HEAD

export function CreateCareerData(values: any) {
  return axios.post(createCareer, values);
}

export function UpdateCareerData(id: any, values: any) {
  return axios.put(`${updateCareer}/${id}`, values);
=======
export function CreateCareerData(values: any) {
  return axios.post(`${API_URL}/career/create`, values);
}
export function UpdateCareerData(id: any, values: any) {
  return axios.put(`${API_URL}/career/update/${id}`, values);
>>>>>>> origin/palak
}
export function DeleteCareerData(id: any) {
<<<<<<< HEAD
  return axios.delete(deleteCareer + id);
=======
  return axios.delete(`${API_URL}/career/delete/${id}`);
}

// MeasuredQualityTypes
export function ReadMeasuredQualityTypes() {
  return axios.get(`${API_URL}/measured-quality-types/getAll`);
}
export function AssignMeasuredQualityTypeToCareer(typeId: any, career_id: any) {
  return axios.post(`${API_URL}/measured-quality-types/${typeId}/careers/${career_id}`);
}
export function RemoveMeasuredQualityTypeFromCareer(typeId: any, career_id: any) {
  return axios.delete(`${API_URL}/measured-quality-types/${typeId}/careers/${career_id}`);
}
export function GetMeasuredQualityTypesForCareer(career_id: any) {
  return axios.get(`${API_URL}/career/${career_id}/measured-quality-types`);
>>>>>>> origin/palak
}
