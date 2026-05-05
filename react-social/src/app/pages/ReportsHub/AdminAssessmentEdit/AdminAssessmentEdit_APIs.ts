import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

export type AdminAnswerEntry = {
  questionnaireQuestionId: number;
  optionId?: number;
  rankOrder?: number;
  textResponse?: string;
};

export type AdminSubmitPayload = {
  userStudentId: number;
  assessmentId: number;
  answers: AdminAnswerEntry[];
  adminUserId?: number | null;
  reason?: string;
};

export function getAssessmentQuestionnaire(assessmentId: number) {
  return axios.get(`${API_URL}/assessments/getby/${assessmentId}`);
}

export function getAssessmentDetails(assessmentId: number) {
  return axios.get(`${API_URL}/assessments/getById/${assessmentId}`);
}

export function getStudentAnswers(studentId: number) {
  return axios.get(`${API_URL}/assessment-answer/getByStudent/${studentId}`);
}

export function adminSubmitOnBehalfOfStudent(payload: AdminSubmitPayload) {
  return axios.post(`${API_URL}/assessment-answer/admin-submit`, payload);
}
