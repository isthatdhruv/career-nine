import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

const readQuestionSection = `${API_URL}/question-sections/getAll`;
const readQuestionSectionList = `${API_URL}/question-sections/getAllList`;
const readQuestionSectionById = `${API_URL}/question-sections/get/`;
const createQuestionSection = `${API_URL}/question-sections/create`;
const updateQuestionSection = `${API_URL}/question-sections/update`;
const deleteQuestionSection = `${API_URL}/question-sections/delete/`;

export function ReadQuestionSectionData() {
  return axios.get(readQuestionSection);
}

export function ReadQuestionSectionDataList() {
  return axios.get(readQuestionSectionList);
}

export function ReadQuestionSectionByIdData(id: any) {
  return axios.get(readQuestionSectionById + id);
}

export function CreateQuestionSectionData(values: any) {
  return axios.post(createQuestionSection, values);
}

export function UpdateQuestionSectionData(values: any) {
  return axios.put(`${updateQuestionSection}/${values.sectionId}`, values);
}

export function DeleteQuestionSectionData(id: any) {
  return axios.delete(deleteQuestionSection + id);
}

export function GetDeletedQuestionSections() {
  return axios.get(`${API_URL}/question-sections/deleted`);
}

export function RestoreQuestionSection(id: any) {
  return axios.put(`${API_URL}/question-sections/restore/${id}`);
}

export function PermanentDeleteQuestionSection(id: any) {
  return axios.delete(`${API_URL}/question-sections/permanent-delete/${id}`);
}
