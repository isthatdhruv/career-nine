import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

const readAssessment = `${API_URL}/assessments/getAll`;
const readAssessmentList = `${API_URL}/assessments/get/list`
const readAssessmentById = `${API_URL}/assessments/getById/`;
const createAssessment = `${API_URL}/assessments/create`;
const updateAssessment = `${API_URL}/assessments/update`;
const deleteAssessment = `${API_URL}/assessments/delete/`;
const readLanguageData = `${API_URL}/language-supported/getAll`;


export function ReadAssessmentData() {
  return axios.get(readAssessment);
}

export function ReadAssessmentList(){
  return axios.get(readAssessmentList);
}

export function ReadLanguageData() {
  return axios.get(readLanguageData);
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

// Soft-delete: sets isActive to false instead of removing from DB
export function DeactivateAssessment(id: any, currentData: any) {
  return axios.put(`${updateAssessment}/${id}`, {
    ...currentData,
    id,
    isActive: false,
  });
}
