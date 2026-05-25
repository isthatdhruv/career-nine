import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

export function getCareerSuggestion(studentId: number, assessmentId: number) {
  return axios.get(`${API_URL}/career-suggestion/suggest/${studentId}/${assessmentId}`);
}

export function getCareerComparison(studentId: number, assessmentId: number) {
  return axios.get(`${API_URL}/career-suggestion/compare/${studentId}/${assessmentId}`);
}
