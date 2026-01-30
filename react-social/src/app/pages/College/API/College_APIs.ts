import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL ;

const readCollege = `${API_URL}/instituteDetail/get`;
const readCollegeById = `${API_URL}/instituteDetail/getbyid/`;
const updateCollege = `${API_URL}/instituteDetail/update`;
const deleteCollege = `${API_URL}/instituteDetail/delete/`;
const createSession = `${API_URL}/schoolSession/create`;

export function CreateSessionData(values: any) {
  return axios.post(createSession ,{
    values
  });
}
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
