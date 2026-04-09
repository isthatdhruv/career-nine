import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

export function uploadReportZip(file: Blob, fileName: string) {
  const formData = new FormData();
  formData.append("file", file, fileName);
  formData.append("fileName", fileName);
  return axios.post<{ url: string; fileName: string }>(
    `${API_URL}/report-zip/upload`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" }, timeout: 300000 }
  );
}

export function deleteReportZip(url: string) {
  return axios.delete<{ status: string }>(
    `${API_URL}/report-zip/delete`,
    { params: { url } }
  );
}
