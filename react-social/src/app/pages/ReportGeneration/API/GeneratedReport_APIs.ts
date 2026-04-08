import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const BASE = `${API_URL}/generated-reports`;

export interface GeneratedReport {
  generatedReportId: number;
  userStudent: { userStudentId: number };
  assessmentId: number;
  typeOfReport: string; // "bet" | "navigator"
  reportStatus: string; // "notGenerated" | "generated" | "failed"
  reportUrl: string | null;
  visibleToStudent: boolean;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════ CRUD ═══════════════════════

export function getAllGeneratedReports() {
  return axios.get<GeneratedReport[]>(`${BASE}/getAll`);
}

export function getGeneratedReportById(id: number) {
  return axios.get<GeneratedReport>(`${BASE}/get/${id}`);
}

export function deleteGeneratedReport(id: number) {
  return axios.delete(`${BASE}/delete/${id}`);
}

// ═══════════════════════ QUERIES ═══════════════════════

export function getGeneratedReportsByStudent(userStudentId: number) {
  return axios.get<GeneratedReport[]>(`${BASE}/by-student/${userStudentId}`);
}

export function getGeneratedReportsByStudentAndType(userStudentId: number, typeOfReport: string) {
  return axios.get<GeneratedReport[]>(`${BASE}/by-student/${userStudentId}/type/${typeOfReport}`);
}

export function getGeneratedReportsByAssessment(assessmentId: number) {
  return axios.get<GeneratedReport[]>(`${BASE}/by-assessment/${assessmentId}`);
}

export function getGeneratedReportsByAssessmentAndType(assessmentId: number, typeOfReport: string) {
  return axios.get<GeneratedReport[]>(`${BASE}/by-assessment/${assessmentId}/type/${typeOfReport}`);
}

export function getGeneratedReportByStudentAssessmentType(
  userStudentId: number,
  assessmentId: number,
  typeOfReport: string
) {
  return axios.get<GeneratedReport>(
    `${BASE}/by-student/${userStudentId}/assessment/${assessmentId}/type/${typeOfReport}`
  );
}

// ═══════════════════════ STUDENT-FACING (visibility-filtered) ═══════════════════════

export function getVisibleReportsForStudent(userStudentId: number) {
  return axios.get<GeneratedReport[]>(`${BASE}/student/${userStudentId}`);
}

// ═══════════════════════ ADMIN: TOGGLE VISIBILITY ═══════════════════════

export function toggleReportVisibility(ids: number[], visible: boolean) {
  return axios.put<{ updated: number }>(`${BASE}/toggle-visibility`, { ids, visible });
}

// ═══════════════════════ CREATE / UPDATE ═══════════════════════

export function createOrUpdateGeneratedReport(data: {
  userStudentId: number;
  assessmentId: number;
  typeOfReport: string;
  reportStatus?: string;
  reportUrl?: string | null;
}) {
  return axios.post<GeneratedReport>(`${BASE}/create`, data);
}

export function updateGeneratedReport(id: number, data: { reportStatus?: string; reportUrl?: string | null }) {
  return axios.put<GeneratedReport>(`${BASE}/update/${id}`, data);
}

// ═══════════════════════ ONE-CLICK: ALL REPORTS ═══════════════════════

export interface OneClickAllResponse {
  generated: number;
  errors: { assessmentId: number; typeOfReport?: string; reason: string }[];
  reports: {
    assessmentId: number;
    typeOfReport: string;
    reportUrl: string;
    studentName: string;
    status: string;
  }[];
}

export function generateAllReportsOneClick(userStudentId: number, force = false) {
  return axios.post<OneClickAllResponse>(`${BASE}/one-click`, {
    userStudentId,
    force,
  }, { timeout: 300000 }); // 5 min timeout — generating multiple reports
}

// ═══════════════════════ DELETE ═══════════════════════

export function deleteByStudentAssessmentType(
  userStudentId: number,
  assessmentId: number,
  typeOfReport: string
) {
  return axios.delete(`${BASE}/by-student/${userStudentId}/assessment/${assessmentId}/type/${typeOfReport}`);
}

export function deleteByAssessmentAndType(assessmentId: number, typeOfReport: string) {
  return axios.delete(`${BASE}/by-assessment/${assessmentId}/type/${typeOfReport}`);
}
