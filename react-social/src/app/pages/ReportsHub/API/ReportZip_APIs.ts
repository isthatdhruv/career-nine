import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

export function uploadReportZip(file: Blob, fileName: string) {
  const formData = new FormData();
  formData.append("file", file, fileName);
  formData.append("fileName", fileName);
  return axios.post<{ url: string; fileName: string }>(
    `${API_URL}/report-zip/upload`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" }, timeout: 600000 }
  );
}

export function deleteReportZip(url: string) {
  return axios.delete<{ status: string }>(
    `${API_URL}/report-zip/delete`,
    { params: { url } }
  );
}

// ── Auto ZIP: the server bundles a whole school's rendered PDFs, by class & section ──

export type AutoZipSplit = "school" | "class" | "section";

export type AutoZipRequest = {
  instituteId: number;
  assessmentIds: number[];
  splitBy: AutoZipSplit;
  zipName?: string;
};

export type AutoZipPreviewGroup = {
  className: string;
  sectionName: string;
  ready: number;
  completedNoPdf: number;
  notCompleted: number;
};

export type AutoZipPreview = {
  ready: number;
  completedNoPdf: number;
  notCompleted: number;
  zipCount: number;
  groups: AutoZipPreviewGroup[];
};

export type AutoZipPart = { name: string; url: string; fileCount: number; bytes: number };

export type AutoZipJob = {
  id: string;
  instituteId: number;
  assessmentIds: number[];
  splitBy: AutoZipSplit;
  name: string;
  status: "queued" | "running" | "done" | "error";
  phase?: string | null;
  total: number;
  processed: number;
  added: number;
  failed: number;
  missing: number;
  parts: AutoZipPart[];
  error?: string | null;
  createdAt: number;
  finishedAt?: number | null;
};

export function previewAutoZip(req: AutoZipRequest) {
  return axios.post<AutoZipPreview>(`${API_URL}/report-zip/auto/preview`, req);
}

export function startAutoZip(req: AutoZipRequest) {
  return axios.post<AutoZipJob>(`${API_URL}/report-zip/auto`, req);
}

/** The current user's auto ZIP jobs, newest first. */
export function listAutoZipJobs() {
  return axios.get<AutoZipJob[]>(`${API_URL}/report-zip/auto`);
}

/** Cancels a running job, or deletes a finished job's ZIPs from Spaces. */
export function deleteAutoZipJob(jobId: string) {
  return axios.delete<{ status: string }>(`${API_URL}/report-zip/auto/${jobId}`);
}
