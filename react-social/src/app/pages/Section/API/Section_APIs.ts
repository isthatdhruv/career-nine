import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL ;

const readSection = `${API_URL}/section/get`;
const updateSection = `${API_URL}/section/update`;
const deleteSection = `${API_URL}/section/delete/`;

export function ReadSectionData() {
  return axios.get(readSection);
}

export function UpdateSectionData(values: any) {
  return axios.post(updateSection, {
    values,
  });
}

export function DeleteSectionData(id: any) {
  return axios.get(deleteSection + id);
}
