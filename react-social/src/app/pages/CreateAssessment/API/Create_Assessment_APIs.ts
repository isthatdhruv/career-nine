import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

const readAssessment = `${API_URL}/assessments/getAll`;
const readAssessmentById = `${API_URL}/assessments/get/`;
const createAssessment = `${API_URL}/assessments/create`;
const updateAssessment = `${API_URL}/assessments/update`;
const deleteAssessment = `${API_URL}/assessments/delete/`;

export function ReadAssessmentData() {
  return axios.get(readAssessment);
}

export function ReadAssessmentByIdData(id: any) {
  return axios.get(readAssessmentById + id);
}

export function CreateAssessmentData(values: any) {
  return axios.post(createAssessment, values);
}

export function UpdateAssessmentData(id: any, values: any) {
  return axios.put(`${updateAssessment}/${id}`, values);
}

export function DeleteAssessmentData(id: any) {
  return axios.delete(deleteAssessment + id);
}
