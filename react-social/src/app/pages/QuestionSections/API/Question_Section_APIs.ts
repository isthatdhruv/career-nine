import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

const readQuestionSection = `http://192.168.3.78:8080/api/question-sections/getAll`;
const readQuestionSectionById = `${API_URL}/api/question-sections/get/`;
const createQuestionSection = `${API_URL}/api/question-sections/create`;
const updateQuestionSection = `${API_URL}/api/question-sections/update`;
const deleteQuestionSection = `${API_URL}/api/question-sections/delete/`;

export function ReadQuestionSectionData() {
  return axios.get(readQuestionSection);
}

export function ReadQuestionSectionByIdData(id: any) {
  return axios.get(readQuestionSectionById + id);
}

export function CreateQuestionSectionData(values: any) {
  return axios.post(createQuestionSection, values);
}

export function UpdateQuestionSectionData(values: any) {
  return axios.post(updateQuestionSection, {
    values,
  });
}

export function DeleteQuestionSectionData(id: any) {
  return axios.delete(deleteQuestionSection + id);
}
