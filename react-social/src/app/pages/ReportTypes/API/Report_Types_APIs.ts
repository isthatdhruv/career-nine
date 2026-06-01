import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

export interface ReportTypeDto {
  reportTypeId: number;
  code: string;
  displayName: string;
}

export interface ReportSubtypeDto {
  reportSubtypeId: number;
  reportTypeId: number;
  reportTypeCode: string;
  code: string;
  displayName: string;
  templateSpacesUrl: string | null;
  templateUploadedAt: string | null;
  spacesRenderFolder: string;
}

// ── Report Types ──────────────────────────────────────────────────────

export function ReadReportTypes() {
  return axios.get<ReportTypeDto[]>(`${API_URL}/report-type`);
}

export function ReadReportTypeById(id: number) {
  return axios.get<ReportTypeDto>(`${API_URL}/report-type/${id}`);
}

export function CreateReportType(values: { code: string; displayName: string }) {
  return axios.post<ReportTypeDto>(`${API_URL}/report-type`, values);
}

export function UpdateReportType(id: number, values: { code?: string; displayName?: string }) {
  return axios.put<ReportTypeDto>(`${API_URL}/report-type/${id}`, values);
}

export function DeleteReportType(id: number) {
  return axios.delete(`${API_URL}/report-type/${id}`);
}

// ── Report Subtypes ───────────────────────────────────────────────────

export function ReadReportSubtypes(typeId?: number) {
  const url = typeId
    ? `${API_URL}/report-subtype?typeId=${typeId}`
    : `${API_URL}/report-subtype`;
  return axios.get<ReportSubtypeDto[]>(url);
}

export interface CreateSubtypeMeta {
  typeCode: string;
  code: string;
  displayName: string;
  spacesRenderFolder: string;
}

export function CreateReportSubtype(meta: CreateSubtypeMeta, file?: File) {
  const form = new FormData();
  form.append(
    "meta",
    new Blob([JSON.stringify(meta)], { type: "application/json" })
  );
  if (file) form.append("templateHtml", file);
  return axios.post<ReportSubtypeDto>(`${API_URL}/report-subtype`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function UpdateReportSubtype(id: number, values: { displayName?: string; spacesRenderFolder?: string }) {
  return axios.put<ReportSubtypeDto>(`${API_URL}/report-subtype/${id}`, values);
}

export function UploadSubtypeTemplate(id: number, file: File) {
  const form = new FormData();
  form.append("templateHtml", file);
  return axios.put<ReportSubtypeDto>(`${API_URL}/report-subtype/${id}/template`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function DeleteReportSubtype(id: number) {
  return axios.delete(`${API_URL}/report-subtype/${id}`);
}

// ── Bootstrap ─────────────────────────────────────────────────────────

export function BootstrapAllTemplates() {
  return axios.post<{
    uploadedCount: number;
    uploaded: Array<Record<string, string>>;
    failed: Array<Record<string, string>>;
  }>(`${API_URL}/report-template-bootstrap/upload-all`, {});
}
