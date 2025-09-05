import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

const readQuestions = `${API_URL}/assessment-questions/getAll`;
const readQuestionById = `${API_URL}/assessment-questions/get/`;
const createQuestion = `${API_URL}/assessment-questions/create`;
const updateQuestion = `${API_URL}/assessment-questions/update`;
const deleteQuestion = `${API_URL}/assessment-questions/delete/`;

export function ReadQuestionsData() {
  return axios.get(readQuestions);
}

export function ReadQuestionByIdData(id: any) {
  return axios.get(readQuestionById + id);
}

export function CreateQuestionData(values: any) {
  // Transform the data to match backend expectations
  const requestData = {
    ...values,
    section: values.sectionId ? { sectionId: values.sectionId } : null,
    options: values.questionOptions 
      ? values.questionOptions
          .filter((option: string) => option.trim() !== '') // Remove empty options
          .map((option: string, index: number) => ({
            optionText: option,
            isCorrect: index === 0 // For now, make first option correct by default
          }))
      : []
  };
  delete requestData.sectionId; // Remove the flat sectionId
  delete requestData.questionOptions; // Remove the original field
  console.log("Sending to backend:", requestData);
  return axios.post(createQuestion, requestData);
}

export function UpdateQuestionData(id: any, values: any) {
  // Transform the data to match backend expectations
  const requestData = {
    ...values,
    section: values.sectionId ? { sectionId: values.sectionId } : null,
    options: values.questionOptions 
      ? values.questionOptions
          .filter((option: string) => option.trim() !== '') // Remove empty options
          .map((option: string, index: number) => ({
            optionText: option,
            isCorrect: index === 0 // For now, make first option correct by default
          }))
      : []
  };
  delete requestData.sectionId; // Remove the flat sectionId
  delete requestData.questionOptions; // Remove the original field
  console.log("Sending update to backend:", requestData);
  return axios.put(`${updateQuestion}/${id}`, requestData);
}

export function DeleteQuestionData(id: any) {
  return axios.delete(deleteQuestion + id);
}
