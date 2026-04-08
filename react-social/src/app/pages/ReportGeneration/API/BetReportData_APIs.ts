import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const BASE = `${API_URL}/bet-report-data`;

export interface BetReportData {
  betReportDataId: number;
  userStudent: { userStudentId: number };
  assessmentId: number;
  studentName: string;
  studentGrade: string;
  cog1: string;
  cog2: string;
  cog3: string;
  cog3Description: string;
  selfManagement1: string;
  selfManagement2: string;
  selfManagement3: string;
  environment: string;
  value1: string;
  value2: string;
  value3: string;
  socialInsight: string;
  reportStatus: string;
  reportUrl: string | null;
  createdAt: string;
}

export interface GenerateResponse {
  generated: number;
  errors: { userStudentId: number; reason: string }[];
  data: BetReportData[];
}

export function generateBetReportData(assessmentId: number, userStudentIds: number[]) {
  return axios.post<GenerateResponse>(`${BASE}/generate-live`, {
    assessmentId,
    userStudentIds,
  });
}

export function getBetReportDataByAssessment(assessmentId: number) {
  return axios.get<BetReportData[]>(`${BASE}/by-assessment/${assessmentId}`);
}

export function getBetReportDataByStudent(userStudentId: number) {
  return axios.get<BetReportData[]>(`${BASE}/by-student/${userStudentId}`);
}

export function exportBetReportExcel(assessmentId: number) {
  return axios.get(`${BASE}/export-excel/${assessmentId}`, {
    responseType: 'blob',
  });
}

export interface GenerateReportsResponse {
  generated: number;
  errors: { userStudentId: number; reason: string }[];
  reports: { userStudentId: number; studentName: string; reportUrl: string }[];
}

export function generateHtmlReports(assessmentId: number, userStudentIds: number[]) {
  return axios.post<GenerateReportsResponse>(`${BASE}/generate-reports`, {
    assessmentId,
    userStudentIds,
  });
}

export function exportMqtScoresExcel(assessmentId: number, userStudentIds?: number[]) {
  return axios.post(`${BASE}/export-mqt-scores`, {
    assessmentId,
    userStudentIds: userStudentIds || [],
  }, {
    responseType: 'blob',
  });
}

export function downloadBetReport(userStudentId: number, assessmentId: number) {
  return axios.get(`${BASE}/download/${userStudentId}/${assessmentId}`, {
    responseType: 'blob',
  });
}

export function getBetReportUrls(assessmentId: number, userStudentIds: number[]) {
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

// ── School Report ──

export interface SchoolReportMqtStat {
  mqtId: number;
  mqtName: string;
  average: number;
  min: number;
  max: number;
  sum: number;
  count: number;
  gradeWise: Record<string, { average: number; count: number }>;
}

export interface SchoolReportMqGroup {
  mqName: string;
  mqts: SchoolReportMqtStat[];
}

export interface SchoolReportData {
  assessmentId: number;
  totalStudents: number;
  studentsWithScores: number;
  grades: string[];
  gradeStudentCounts: Record<string, number>;
  mqGroups: SchoolReportMqGroup[];
}

export function getSchoolReport(assessmentId: number, userStudentIds?: number[]) {
  return axios.post<SchoolReportData>(`${BASE}/school-report`, {
    assessmentId,
    userStudentIds: userStudentIds || [],
  });
}

// ── Email Recipients & Send Report Email ──

export interface EmailRecipient {
  email: string;
  name: string;
  role: string;
  designation?: string;
}

export function getEmailRecipientsForStudent(userStudentId: number) {
  return axios.get<EmailRecipient[]>(`${API_URL}/contact-person/email-recipients/${userStudentId}`);
}

export function sendReportEmail(payload: { emails: string[]; subject: string; htmlContent: string; fromName?: string }) {
  return axios.post(`${API_URL}/contact-person/send-report-email`, payload);
}
