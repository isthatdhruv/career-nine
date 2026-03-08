import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

// ============ ADMIN APIs ============

export function createAssessmentMapping(data: {
  assessmentId: number;
  instituteCode: number;
  mappingLevel: string;
  sessionId?: number;
  classId?: number;
  sectionId?: number;
}) {
  return axios.post(`${API_URL}/assessment-mapping/create`, data);
}

export function getAssessmentMappingsByInstitute(instituteCode: number) {
  return axios.get(
    `${API_URL}/assessment-mapping/getByInstitute/${instituteCode}`
  );
}

export function updateAssessmentMapping(
  id: number,
  data: { isActive: boolean }
) {
  return axios.put(`${API_URL}/assessment-mapping/update/${id}`, data);
}

export function deleteAssessmentMapping(id: number) {
  return axios.delete(`${API_URL}/assessment-mapping/delete/${id}`);
}

// Lightweight: only id, assessmentName, isActive (no questionnaire cascade)
export function getAssessmentSummaryList() {
  return axios.get(`${API_URL}/assessments/get/list-summary`);
}

// ============ PUBLIC APIs ============

export function getMappingInfoByToken(token: string) {
  return axios.get(`${API_URL}/assessment-mapping/public/info/${token}`);
}

export function registerStudentByToken(
  token: string,
  studentData: {
    name: string;
    email: string;
    dob: string;
    phone: string;
    gender: string;
    classId?: number;
    schoolSectionId?: number;
  }
) {
  return axios.post(
    `${API_URL}/assessment-mapping/public/register/${token}`,
    studentData
  );
}
