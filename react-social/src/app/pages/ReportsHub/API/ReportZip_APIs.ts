import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

/**
 * Upload a report zip directly to DigitalOcean Spaces via pre-signed PUT URL.
 * This bypasses nginx + Spring multipart limits, so zips can be hundreds of MB.
 *
 * Shape of the resolved response mirrors the old multipart upload so callers
 * in ReportsHubPage keep working without changes: `res.data.url`, `res.data.fileName`.
 */
export async function uploadReportZip(file: Blob, fileName: string) {
  const { data: presign } = await axios.get<{
    uploadUrl: string;
    publicUrl: string;
    key: string;
    fileName: string;
  }>(`${API_URL}/report-zip/presign`, { params: { fileName } });

  // Use raw fetch — the global axios interceptor adds an Authorization bearer
  // header, which the pre-signed URL does NOT sign and S3/Spaces will reject.
  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": "application/zip",
      "x-amz-acl": "public-read",
    },
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => "");
    throw new Error(`Spaces upload failed (${putRes.status}): ${text.slice(0, 200)}`);
  }

  return { data: { url: presign.publicUrl, fileName: presign.fileName } };
}

export function deleteReportZip(url: string) {
  return axios.delete<{ status: string }>(
    `${API_URL}/report-zip/delete`,
    { params: { url } }
  );
}
