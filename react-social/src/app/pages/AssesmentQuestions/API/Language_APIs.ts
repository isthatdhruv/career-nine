import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

const readLanguage = `${API_URL}/language-supported/getAll`;
const readLanguageById = `${API_URL}/language-supported/get/`;
const createLanguage = `${API_URL}/language-question/create-with-options`;

export function readLanguageData() {
  return axios.get(readLanguage);
}

export function readLanguageByIdData(id: any) {
  return axios.get(readLanguageById + id);
}

export function createLanguageQuestionAndOptionData(values: any) {
  return axios.post(createLanguage, values);
}

