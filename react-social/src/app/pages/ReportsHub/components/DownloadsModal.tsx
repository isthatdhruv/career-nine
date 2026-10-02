import React from "react";

export type ZipJob = {
  id: string;
  name: string;
  status: "zipping" | "uploading" | "done" | "error";
  phase?: string;
  progress: number; // 0-100
  url?: string;
  error?: string;
  createdAt: number;
  /** Auto ZIP split per class/section: one download per file. */
  parts?: { name: string; url: string; fileCount: number }[];
  /** Set for server-side auto ZIPs — cancel/delete go through the API. */
  serverJobId?: string;
  /** One-line result, e.g. "412 PDFs · 27 without a report". */
  summary?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  jobs: ZipJob[];
  onDelete: (job: ZipJob) => void;
  deleting: Set<string>;
};

const DownloadsModal: React.FC<Props> = ({ open, onClose, jobs, onDelete, deleting }) => {
  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1050,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.45)",
    }} onClick={onClose}>
      <div
        style={{
          background: "#fff", borderRadius: 16, width: 560, maxWidth: "95vw",
          maxHeight: "80vh", display: "flex", flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", borderBottom: "1px solid #e5e7eb", flexShrink: 0,
        }}>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem", color: "#1a1a2e" }}>
            Downloads ({jobs.length})
          </h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "1.4rem", color: "#9ca3af", lineHeight: 1, padding: 4,
          }}>&times;</button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1 }}>
          {jobs.length === 0 && (
            <div style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>
              No downloads yet. Use "Auto ZIP" or "Download ZIP" to build report archives.
            </div>
          )}

          {jobs.map((job) => {
            const isActive = job.status === "zipping" || job.status === "uploading";
            const isDone = job.status === "done";
            const isError = job.status === "error";
            const isDeleting = deleting.has(job.id);

            return (
              <div key={job.id} style={{
                padding: "14px 16px", marginBottom: 10, borderRadius: 10,
                border: `1px solid ${isError ? "#fecaca" : isActive ? "#c7d2fe" : "#e5e7eb"}`,
                background: isError ? "#fef2f2" : isActive ? "#f0f4ff" : "#fff",
              }}>
                {/* Top row: name + status */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1a1a2e" }}>
                    {job.name}
                  </span>
                  <span style={{
                    fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                    background: isDone ? "#dcfce7" : isError ? "#fee2e2" : "#e0e7ff",
                    color: isDone ? "#059669" : isError ? "#dc2626" : "#4338ca",
                  }}>
                    {isDone ? "Ready" : isError ? "Failed" : job.status === "uploading" ? "Uploading" : "Processing"}
                  </span>
                </div>

                {/* Progress bar (if active) */}
                {isActive && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{job.phase || "Working..."}</span>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{Math.round(job.progress)}%</span>
                    </div>
                    <div style={{ height: 5, background: "#e0e7ff", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 3, transition: "width 0.3s ease",
                        background: "linear-gradient(90deg, #7c3aed, #a855f7)",
                        width: `${job.progress}%`,
                      }} />
                    </div>
                  </>
                )}

                {/* Error message */}
                {isError && job.error && (
                  <div style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: 4 }}>{job.error}</div>
                )}

                {isDone && job.summary && (
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 2 }}>{job.summary}</div>
                )}

                {/* Server jobs can be cancelled while running, or cleared once failed. */}
                {job.serverJobId && (isActive || isError) && (
                  <button
                    onClick={() => onDelete(job)}
                    disabled={isDeleting}
                    style={{
                      marginTop: 8, padding: "4px 12px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 600,
                      background: "#fff", color: "#6b7280", border: "1px solid #d1d5db",
                      cursor: isDeleting ? "not-allowed" : "pointer",
                    }}
                  >
                    {isDeleting ? "..." : isActive ? "Cancel" : "Remove"}
                  </button>
                )}

                {/* Auto ZIP split into several files: one link per file. */}
                {isDone && job.parts && job.parts.length > 1 && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
                    {job.parts.map((p) => (
                      <a key={p.url} href={p.url} download={p.name}
                        style={{
                          display: "flex", justifyContent: "space-between", gap: 8,
                          padding: "5px 10px", borderRadius: 6, fontSize: "0.78rem",
                          background: "#f5f3ff", color: "#4c1d95", textDecoration: "none", fontWeight: 600,
                        }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                        <span style={{ flexShrink: 0, fontWeight: 500, color: "#6b7280" }}>{p.fileCount} PDFs</span>
                      </a>
                    ))}
                  </div>
                )}

                {/* Actions (if done) */}
                {isDone && (job.url || (job.parts && job.parts.length > 1)) && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {job.url && <a
                      href={job.url}
                      download={job.name}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "6px 14px", borderRadius: 8, fontSize: "0.8rem", fontWeight: 600,
                        background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                        color: "#fff", textDecoration: "none",
                      }}
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </a>}
                    <button
                      onClick={() => onDelete(job)}
                      disabled={isDeleting}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "6px 14px", borderRadius: 8, fontSize: "0.8rem", fontWeight: 600,
                        background: isDeleting ? "#d1d5db" : "#fff",
                        color: isDeleting ? "#6b7280" : "#dc2626",
                        border: `1px solid ${isDeleting ? "#d1d5db" : "#fecaca"}`,
                        cursor: isDeleting ? "not-allowed" : "pointer",
                      }}
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                )}

                {/* Timestamp */}
                <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginTop: 6 }}>
                  {new Date(job.createdAt).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DownloadsModal;
