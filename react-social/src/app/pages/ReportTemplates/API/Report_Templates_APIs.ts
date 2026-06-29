import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

// ── Types ──────────────────────────────────────────────────────────────

export interface ReportTemplateDto {
  reportTemplateId: number;
  code: string;
  displayName: string;
  engineCode: string;
  templateSpacesUrl: string | null;
  templateUploadedAt: string | null;
  spacesRenderFolder: string;
  hasTemplate: boolean;
}

export interface ReportTemplateCreate {
  code: string;
  displayName: string;
  engineCode: string;
  spacesRenderFolder: string;
}

export interface TemplateMappingDto {
  mappingId: number;
  isDefault: boolean;
  template: ReportTemplateDto;
}

// ── Template catalog CRUD ──────────────────────────────────────────────

export function ReadReportTemplates() {
  return axios.get<ReportTemplateDto[]>(`${API_URL}/report-template`);
}

export function ReadReportTemplateById(id: number) {
  return axios.get<ReportTemplateDto>(`${API_URL}/report-template/${id}`);
}

export function CreateReportTemplate(values: ReportTemplateCreate) {
  return axios.post<ReportTemplateDto>(`${API_URL}/report-template`, values);
}

export function UpdateReportTemplate(
  id: number,
  values: { displayName?: string; engineCode?: string; spacesRenderFolder?: string }
) {
  return axios.put<ReportTemplateDto>(`${API_URL}/report-template/${id}`, values);
}

export function DeleteReportTemplate(id: number) {
  return axios.delete(`${API_URL}/report-template/${id}`);
}

export function UploadReportTemplateHtml(id: number, file: File) {
  const form = new FormData();
  form.append("templateHtml", file);
  return axios.put<ReportTemplateDto>(`${API_URL}/report-template/${id}/template`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function BootstrapClasspathTemplates() {
  return axios.post<{
    uploadedCount: number;
    uploaded: Array<Record<string, string>>;
    failed: Array<Record<string, string>>;
  }>(`${API_URL}/report-template/bootstrap-classpath`, {});
}

// ── Assessment ↔ template mapping ──────────────────────────────────────

/** Templates mapped to an assessment, with the default flagged. */
export function ReadAssessmentTemplates(assessmentId: number) {
  return axios.get<TemplateMappingDto[]>(
    `${API_URL}/assessment/${assessmentId}/report-templates`
  );
}

export function MapTemplateToAssessment(assessmentId: number, reportTemplateId: number) {
  return axios.post<TemplateMappingDto>(
    `${API_URL}/assessment/${assessmentId}/templates`,
    { reportTemplateId }
  );
}

export function UnmapTemplateFromAssessment(assessmentId: number, reportTemplateId: number) {
  return axios.delete(`${API_URL}/assessment/${assessmentId}/templates/${reportTemplateId}`);
}

export function SetDefaultAssessmentTemplate(assessmentId: number, reportTemplateId: number) {
  return axios.put<TemplateMappingDto>(
    `${API_URL}/assessment/${assessmentId}/default-template`,
    { reportTemplateId }
  );
}

// ── Unified generation (optional templateId → default when omitted) ─────

export interface UnifiedReportResponse {
  status: string;
  typeCode?: string;
  subtypeCode?: string;
  reportUrl?: string;
  pdfUrl?: string | null;
  pdfStatus?: string;   // notRequested | pending | rendering | ready | failed
  code?: string;
  message?: string;
}

export function GenerateUnifiedReport(
  userStudentId: number,
  assessmentId: number,
  reportTemplateId?: number,
  force?: boolean
) {
  return axios.post<UnifiedReportResponse>(`${API_URL}/generate-report-unified`, {
    userStudentId,
    assessmentId,
    reportTemplateId,
    force,
  });
}

export interface BulkResultItem {
  userStudentId: number;
  status: "ok" | "error" | "forbidden";
  reportUrl?: string;
  pdfUrl?: string | null;
  pdfStatus?: string;   // notRequested | pending | rendering | ready | failed
  code?: string;
  typeCode?: string;
  message?: string;
}

/** Bulk generate one template for many students (same type). */
export function GenerateUnifiedReportsBulk(
  assessmentId: number,
  userStudentIds: number[],
  reportTemplateId?: number,
  force?: boolean
) {
  return axios.post<{ results: BulkResultItem[] }>(`${API_URL}/generate-report-unified/bulk`, {
    assessmentId,
    userStudentIds,
    reportTemplateId,
    force,
  });
}
