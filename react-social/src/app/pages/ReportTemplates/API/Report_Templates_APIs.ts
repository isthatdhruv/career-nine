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

// ═══════════════════ ASYNC ENQUEUE (Kafka → report-worker) ═══════════════════

export type EnqueueEmailMode = "none" | "all";

export interface EnqueueResultRow {
  userStudentId: number;
  status: "queued" | "forbidden" | "error";
  message?: string;
}

export interface EnqueueResponse {
  queued: number;
  batchId: string;
  results: EnqueueResultRow[];
}

export function EnqueueUnifiedReport(
  userStudentId: number,
  assessmentId: number,
  reportTemplateId?: number,
  force = false,
  emailMode: EnqueueEmailMode = "none"
) {
  return axios.post<EnqueueResponse>(`${API_URL}/generate-report-unified/enqueue`, {
    userStudentId, assessmentId, reportTemplateId, force, emailMode,
  });
}

export function EnqueueUnifiedReportsBulk(
  assessmentId: number,
  userStudentIds: number[],
  reportTemplateId?: number,
  force = false,
  emailMode: EnqueueEmailMode = "none"
) {
  return axios.post<EnqueueResponse>(`${API_URL}/generate-report-unified/enqueue/bulk`, {
    assessmentId, userStudentIds, reportTemplateId, force, emailMode,
  });
}

/** Keep an admin batch's lease alive; when heartbeats stop, the worker skips its remaining events. */
export function HeartbeatEnqueueBatch(batchId: string) {
  return axios.post<{ alive: boolean }>(`${API_URL}/generate-report-unified/enqueue/heartbeat`, { batchId });
}

/** Explicitly cancel a batch (confirmed modal close) and restore its still-queued rows. */
export function CancelEnqueueBatch(
  batchId: string,
  assessmentId: number,
  userStudentIds: number[],
  reportTemplateId?: number
) {
  return axios.post<{ cancelled: boolean; restored: number }>(
    `${API_URL}/generate-report-unified/enqueue/cancel`,
    { batchId, assessmentId, userStudentIds, reportTemplateId }
  );
}
