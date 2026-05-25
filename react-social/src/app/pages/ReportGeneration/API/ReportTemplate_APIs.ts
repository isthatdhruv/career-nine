import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const BASE = `${API_URL}/report-templates`;

export interface ReportTemplate {
    id: number;
    templateName: string;
    assessmentId: number;
    templateUrl: string;
    fieldMappings: string | null; // JSON string
    createdAt: string;
    updatedAt: string;
}

export interface AvailableField {
    key: string;
    label: string;
}

export interface ParsePlaceholdersResponse {
    placeholders: string[];
    availableFields: AvailableField[];
}

export function uploadTemplate(file: File, templateName: string, assessmentId: number) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('templateName', templateName);
    formData.append('assessmentId', assessmentId.toString());
    return axios.post<ReportTemplate>(`${BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
}

export function getTemplatesByAssessment(assessmentId: number) {
    return axios.get<ReportTemplate[]>(`${BASE}/by-assessment/${assessmentId}`);
}

export function getTemplateById(id: number) {
    return axios.get<ReportTemplate>(`${BASE}/get/${id}`);
}

export function updateTemplate(id: number, data: Partial<ReportTemplate>) {
    return axios.put<ReportTemplate>(`${BASE}/update/${id}`, data);
}

export function deleteTemplate(id: number) {
    return axios.delete(`${BASE}/delete/${id}`);
}

export function parsePlaceholders(templateId: number) {
    return axios.get<ParsePlaceholdersResponse>(`${BASE}/parse-placeholders/${templateId}`);
}

export function getAvailableFields() {
    return axios.get<AvailableField[]>(`${BASE}/available-fields`);
}

export function previewReport(templateId: number, userStudentId: number, assessmentId: number) {
    return axios.post<{ html: string }>(`${BASE}/preview`, {
        templateId,
        userStudentId,
        assessmentId,
    });
}

export function generatePdf(templateId: number, userStudentId: number, assessmentId: number) {
    return axios.post(`${BASE}/generate-pdf`, {
        templateId,
        userStudentId,
        assessmentId,
    }, { responseType: 'blob' });
}

export function generatePdfBulk(templateId: number, assessmentId: number, userStudentIds: number[]) {
    return axios.post(`${BASE}/generate-pdf-bulk`, {
        templateId,
        assessmentId,
        userStudentIds,
    }, { responseType: 'blob' });
}
