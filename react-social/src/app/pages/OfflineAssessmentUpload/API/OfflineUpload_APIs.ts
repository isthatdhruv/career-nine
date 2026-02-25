import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

export function getOfflineMapping(assessmentId: number) {
  return axios.get(`${API_URL}/assessment-answer/offline-mapping/${assessmentId}`);
}

export function bulkSubmitAnswers(data: {
  assessmentId: number;
  students: {
    userStudentId: number;
    answers: { questionnaireQuestionId: number; optionId: number }[];
  }[];
}) {
  return axios.post(`${API_URL}/assessment-answer/bulk-submit`, data);
}

export function bulkSubmitWithStudents(data: {
  assessmentId: number;
  instituteId: number;
  students: {
    name: string;
    dob?: string;
    phone?: string;
    answers: { questionnaireQuestionId: number; optionId: number }[];
  }[];
}) {
  return axios.post(`${API_URL}/assessment-answer/bulk-submit-with-students`, data);
}
