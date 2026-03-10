import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

export function getAssessmentList() {
  return axios.get(`${API_URL}/assessments/get/list`);
}

export function getLiveTracking(assessmentId: number) {
  return axios.get(`${API_URL}/assessments/${assessmentId}/live-tracking`);
}
