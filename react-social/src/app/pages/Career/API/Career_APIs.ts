import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

const readCareer = `${API_URL}/career/getAll`;
const readCareerById = `${API_URL}/career/get/`;
const createCareer = `${API_URL}/career/create`;
const updateCareer = `${API_URL}/career/update`;
const deleteCareer = `${API_URL}/career/delete/`;

export function ReadCareerData() {
  return axios.get(readCareer);
}

export function ReadCareerByIdData(id: any) {
  return axios.get(readCareerById + id);
}

export function CreateCareerData(values: any) {
  return axios.post(createCareer, values);
}

export function UpdateCareerData(id: any, values: any) {
  return axios.put(`${updateCareer}/${id}`, values);
}

export function DeleteCareerData(id: any) {
  return axios.delete(deleteCareer + id);
}
