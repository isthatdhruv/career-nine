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

export interface QuestionnaireTemplateMappingDto {
  mappingId: number;
  isDefault: boolean;
  template: ReportTemplateDto;
}

export interface QuestionnaireOption {
  questionnaireId: number;
  name: string | null;
}

export function ReadAllQuestionnaires() {
  return axios.get<QuestionnaireOption[]>(`${API_URL}/api/questionnaire/get/list`, {
    headers: { Accept: "application/json" },
  });
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

// ── Questionnaire ↔ template mapping ───────────────────────────────────

export function ReadQuestionnaireTemplates(questionnaireId: number) {
  return axios.get<QuestionnaireTemplateMappingDto[]>(
    `${API_URL}/questionnaire/${questionnaireId}/templates`
  );
}

/** Templates available for an assessment (mapped to its questionnaire). */
export function ReadAssessmentTemplates(assessmentId: number) {
  return axios.get<QuestionnaireTemplateMappingDto[]>(
    `${API_URL}/assessment/${assessmentId}/report-templates`
  );
}

export function MapTemplateToQuestionnaire(questionnaireId: number, reportTemplateId: number) {
  return axios.post<QuestionnaireTemplateMappingDto>(
    `${API_URL}/questionnaire/${questionnaireId}/templates`,
    { reportTemplateId }
  );
}

export function UnmapTemplateFromQuestionnaire(questionnaireId: number, reportTemplateId: number) {
  return axios.delete(`${API_URL}/questionnaire/${questionnaireId}/templates/${reportTemplateId}`);
}

export function SetDefaultTemplate(questionnaireId: number, reportTemplateId: number) {
  return axios.put<QuestionnaireTemplateMappingDto>(
    `${API_URL}/questionnaire/${questionnaireId}/default-template`,
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
