import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

const readQuestions = `${API_URL}/api/assessment-questions/getAll`;
const readQuestionById = `${API_URL}/api/assessment-questions/get/`;
const createQuestion = `${API_URL}/api/assessment-questions/create`;
const updateQuestion = `${API_URL}/api/assessment-questions/update`;
const deleteQuestion = `${API_URL}/api/assessment-questions/delete/`;

export function ReadQuestionsData() {
  return axios.get(readQuestions);
}

export function ReadQuestionByIdData(id: any) {
  return axios.get(readQuestionById + id);
}

export function CreateQuestionData(values: any) {
  return axios.post(createQuestion, values);
}

export function UpdateQuestionData(id: any, values: any) {
  return axios.put(`${updateQuestion}/${id}`, values);
}

export function DeleteQuestionData(id: any) {
  return axios.delete(deleteQuestion + id);
}
