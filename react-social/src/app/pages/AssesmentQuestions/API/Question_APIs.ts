import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

const readQuestions = `${API_URL}/assessment-questions/getAll`;
const readQuestionsList = `${API_URL}/assessment-questions/getAllList`;
const readQuestionById = `${API_URL}/assessment-questions/get/`;
const createQuestion = `${API_URL}/assessment-questions/create`;
const updateQuestion = `${API_URL}/assessment-questions/update`;
const deleteQuestion = `${API_URL}/assessment-questions/delete/`;
const readMeasuredQualityTypes = `${API_URL}/measured-quality-types/getAll`;
const updateOptionScore = `${API_URL}/option-scores/create`;

export function updateOptionScoreData(optionScores: any) {
  return axios.post(updateOptionScore, optionScores);
}

export function ReadQuestionsData() {
  return axios.get(readQuestions);
}

export function ReadQuestionsDataList() {
  return axios.get(readQuestionsList);
}
export function ReadMeasuredQualityTypes() {
  return axios.get(readMeasuredQualityTypes);
}
export function ReadQuestionByIdData(id: any) {
  return axios.get(readQuestionById + id);
}
export function AssignMeasuredQualityTypeToQuestion(typeId: any, questionId: any) {
  const assignTypeToQuestion = `${API_URL}/measured-quality-types/${typeId}/assessment-questions/${questionId}`;
  return axios.post(assignTypeToQuestion);
}

export function RemoveMeasuredQualityTypeFromQuestion(typeId: any, questionId: any) {
  const removeTypeFromQuestion = `${API_URL}/measured-quality-types/${typeId}/assessment-questions/${questionId}`;
  return axios.delete(removeTypeFromQuestion);
}

export function GetMeasuredQualityTypesForQuestion(questionId: any) {
  const getTypesForQuestion = `${API_URL}/assessment-questions/${questionId}/measured-quality-types`;
  return axios.get(getTypesForQuestion);
}
export function CreateQuestionData(values: any) {
  // Transform the data to match backend expectations
  // const requestData = {
  //   ...values,
  //   section: values.sectionId ? { sectionId: values.sectionId } : null,
  //   options: values.questionOptions 
  //     ? values.questionOptions
  //         .filter((option: string) => option.trim() !== '') // Remove empty options
  //         .map((option: string, index: number) => ({
  //           optionText: option,
  //           isCorrect: index === 0 // For now, make first option correct by default
  //         }))
  //     : []
  // };
  // delete requestData.sectionId; // Remove the flat sectionId
  // delete requestData.questionOptions; // Remove the original field
  // console.log("Sending to backend:", requestData);
  return axios.post(createQuestion, values);
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
