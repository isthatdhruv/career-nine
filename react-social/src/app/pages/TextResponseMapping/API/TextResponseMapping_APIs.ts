import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

export function GetTextResponses(assessmentId: number) {
  return axios.get(`${API_URL}/assessment-answer/text-responses/${assessmentId}`);
}

export function MapTextResponse(assessmentAnswerId: number, optionId: number) {
  return axios.put(`${API_URL}/assessment-answer/map-text-response`, {
    assessmentAnswerId,
    optionId,
  });
}

export function RecalculateScores(assessmentId: number) {
  return axios.post(`${API_URL}/assessment-answer/recalculate-scores/${assessmentId}`);
}

export function GetAssessmentList() {
  return axios.get(`${API_URL}/assessments/get/list`);
}
