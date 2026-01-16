import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;


const readQuestionaireData = `${API_URL}/api/questionnaire/get`;
const readQuestionaireById = `${API_URL}/api/questionnaire/getbyid/`;
const createQuestionaire = `${API_URL}/api/questionnaire/create`;
const updateQuestionaire = `${API_URL}/api/questionnaire/update`;
const deleteQuestionaire = `${API_URL}/api/questionnaire/delete/`;
const readLanguageData = `${API_URL}/language-supported/getAll`;




export function ReadQuestionaireData() {
  return axios.get(readQuestionaireData);
}

export function ReadQuestionaireById(id: string) {
  return axios.get(readQuestionaireById + id);
}

export function CreateQuestionaire(questionaire: any) {
  return axios.post(createQuestionaire, questionaire);
}

export function UpdateQuestionaire(id: string, questionaire: any) {
  return axios.put(`${updateQuestionaire}/${id}`, questionaire);
}

export function DeleteQuestionaire(id: string) {
  return axios.delete(deleteQuestionaire + id);
}

export function ReadLanguageData() {
  return axios.get(readLanguageData);
}
