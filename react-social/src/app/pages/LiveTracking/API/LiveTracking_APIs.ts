import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

export function getAssessmentList() {
  return axios.get(`${API_URL}/assessments/get/list`);
}

export function getLiveTracking(assessmentId: number) {
  return axios.get(`${API_URL}/assessments/${assessmentId}/live-tracking`);
}

export function getRedisPartials(assessmentId?: number) {
  const params = assessmentId ? `?assessmentId=${assessmentId}` : '';
  return axios.get(`${API_URL}/assessment-answer/redis-partials${params}`);
}

export function flushPartialToDb(data: {userStudentId?: number, assessmentId: number}) {
  return axios.post(`${API_URL}/assessment-answer/flush-partial-to-db`, data);
}
