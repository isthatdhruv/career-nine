import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL ;

const readCollege = `${API_URL}/api/instituteDetail/get`;
const readCollegeById = `${API_URL}/api/instituteDetail/getbyid/`;
const updateCollege = `${API_URL}/api/instituteDetail/update`;
const deleteCollege = `${API_URL}/api/instituteDetail/delete/`;

export function ReadCollegeData() {
  return axios.get(readCollege);
}

export function ReadCollegeByIdData(id: any) {
  return axios.get(readCollegeById + id);
}

export function UpdateCollegeData(values: any) {
  return axios.post(updateCollege, {
    values,
  });
}

export function DeleteCollegeData(id: any) {
  return axios.get(deleteCollege + id);
}
