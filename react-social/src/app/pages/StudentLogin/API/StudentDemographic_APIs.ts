import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

export function getFieldsForAssessment(assessmentId: number, userStudentId: number) {
  return axios.get(`${API_URL}/student-demographics/fields/${assessmentId}/${userStudentId}`);
}

export function submitDemographics(data: {
  userStudentId: number;
  assessmentId: number;
  responses: { fieldId: number; value: string }[];
}) {
  return axios.post(`${API_URL}/student-demographics/submit`, data);
}

export function checkDemographicStatus(assessmentId: number, userStudentId: number) {
  return axios.get(`${API_URL}/student-demographics/status/${assessmentId}/${userStudentId}`);
}
