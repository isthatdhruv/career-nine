import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL ;

const readCareer = `${API_URL}/Career/get`;
const readCareerById = `${API_URL}/Career/getbyid/`;
const updateCareer = `${API_URL}/Career/update`;
const deleteCareer = `${API_URL}/Career/delete/`;

export function ReadCareerData() {
  return axios.get(readCareer);
}

export function ReadCareerByIdData(id: any) {
  return axios.get(readCareerById + id);
}

export function UpdateCareerData(values: any) {
  return axios.post(updateCareer, {
    values,
  });
}

export function DeleteCareerData(id: any) {
  return axios.get(deleteCareer + id);
}
