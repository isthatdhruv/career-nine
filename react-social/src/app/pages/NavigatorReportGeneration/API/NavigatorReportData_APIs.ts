import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const BASE = `${API_URL}/navigator-report-data`;

export interface NavigatorReportData {
  navigatorReportDataId: number;
  userStudent: { userStudentId: number };
  assessmentId: number;
  studentName: string;
  studentClass: string;
  studentSchool: string;
  eligible: boolean;
  eligibilityIssues: string | null;
  dataSignificance: string;
  reportStatus: string;
  reportUrl: string | null;
  createdAt: string;
  // Phase 1
  ability1: string;
  ability2: string;
  ability3: string;
  ability4: string;
  weakAbility: string;
  pathway1: string;
  pathway2: string;
  pathway3: string;
  // Phase 3
  careerMatchResult: string;
}

export interface GenerateResponse {
  generated: number;
  errors: { userStudentId: number; reason: string }[];
  data: NavigatorReportData[];
}

export interface GenerateReportsResponse {
  generated: number;
  errors: { userStudentId: number; reason: string }[];
  reports: { userStudentId: number; studentName: string; reportUrl: string }[];
}

export function generateNavigatorReportData(assessmentId: number, userStudentIds: number[]) {
  return axios.post<GenerateResponse>(`${BASE}/generate`, {
    assessmentId,
    userStudentIds,
  });
}

export function getNavigatorReportDataByAssessment(assessmentId: number) {
  return axios.get<NavigatorReportData[]>(`${BASE}/by-assessment/${assessmentId}`);
}

export function getEligibleByAssessment(assessmentId: number) {
  return axios.get<NavigatorReportData[]>(`${BASE}/eligible/${assessmentId}`);
}

export function getIneligibleByAssessment(assessmentId: number) {
  return axios.get<NavigatorReportData[]>(`${BASE}/ineligible/${assessmentId}`);
}

export function exportNavigatorReportExcel(assessmentId: number) {
  return axios.get(`${BASE}/export-excel/${assessmentId}`, {
    responseType: 'blob',
  });
}

export function generateNavigatorHtmlReports(assessmentId: number, userStudentIds: number[]) {
  return axios.post<GenerateReportsResponse>(`${BASE}/generate-reports`, {
    assessmentId,
    userStudentIds,
  });
}

export function resetNavigatorForStudent(userStudentId: number, assessmentId: number) {
  return axios.delete(`${BASE}/reset/student/${userStudentId}/assessment/${assessmentId}`);
}

export function resetNavigatorForAssessment(assessmentId: number) {
  return axios.delete(`${BASE}/reset/assessment/${assessmentId}`);
}

export function downloadNavigatorReport(userStudentId: number, assessmentId: number) {
  return axios.get(`${BASE}/download/${userStudentId}/${assessmentId}`, {
    responseType: 'blob',
  });
}

export function getNavigatorReportUrls(assessmentId: number, userStudentIds: number[]) {
  return axios.post<{ reports: { userStudentId: number; studentName: string; fileName: string; reportUrl: string }[] }>(
    `${BASE}/download-zip`, { assessmentId, userStudentIds }
  );
}

export function exportGeneralAssessmentExcel(assessmentId: number) {
  return axios.get(`${API_URL}/general-assessment/export-excel/${assessmentId}`, {
    responseType: 'blob',
  });
}

export function exportGeneralAssessmentExcelForStudent(assessmentId: number, userStudentId: number) {
  return axios.get(`${API_URL}/general-assessment/export-excel/${assessmentId}/student/${userStudentId}`, {
    responseType: 'blob',
  });
}
