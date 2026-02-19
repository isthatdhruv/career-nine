import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

export function getDemographicsByAssessment(assessmentId: number) {
  return axios.get(`${API_URL}/assessment-demographics/getByAssessment/${assessmentId}`);
}

export function saveDemographicMapping(data: { assessmentId: number; fields: any[] }) {
  return axios.post(`${API_URL}/assessment-demographics/save`, data);
}

export function removeDemographicMapping(assessmentId: number, fieldId: number) {
  return axios.delete(`${API_URL}/assessment-demographics/remove/${assessmentId}/${fieldId}`);
}
