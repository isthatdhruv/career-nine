import React, { useCallback, useEffect, useMemo, useState } from "react";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import { zipStoredPdfs } from "../../ReportGeneration/utils/pdfZip";
import {
  GenerateUnifiedReport,
  GenerateUnifiedReportsBulk,
  TemplateMappingDto,
} from "../../ReportTemplates/API/Report_Templates_APIs";
import {
  getGeneratedReportsByAssessment,
} from "../../ReportGeneration/API/GeneratedReport_APIs";

export interface ModalStudent {
  userStudentId: number;
  name: string;
  username?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  assessmentId: number;
  assessmentName: string;
  templates: TemplateMappingDto[];
  initialTemplateId: number | "";
  students: ModalStudent[];
  /** Called after any generation so the parent page can refresh its own maps. */
  onGenerated: () => void;
}

type Entry = { reportUrl: string | null; status: string; pdfUrl: string | null; pdfStatus: string };

const GenerateReportsModal: React.FC<Props> = ({
  open, onClose, assessmentId, assessmentName, templates, initialTemplateId, students, onGenerated,
}) => {
  const [templateId, setTemplateId] = useState<number | "">(initialTemplateId);
  const [entries, setEntries] = useState<Map<number, Entry>>(new Map());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const single = students.length === 1;

  useEffect(() => { setTemplateId(initialTemplateId); }, [initialTemplateId, open]);

  // Load existing generated reports for the chosen template.
  const loadEntries = useCallback(async () => {
    if (!open || templateId === "") { setEntries(new Map()); return; }
    setLoading(true);
    try {
      const res = await getGeneratedReportsByAssessment(assessmentId);
      const map = new Map<number, Entry>();
      for (const gr of res.data || []) {
        if (gr.reportTemplateId !== templateId) continue;
        const id = gr.userStudent?.userStudentId;
        if (id) map.set(id, {
          reportUrl: gr.reportUrl, status: gr.reportStatus,
          pdfUrl: gr.pdfUrl ?? null, pdfStatus: gr.pdfStatus ?? "notRequested",
        });
      }
      setEntries(map);
    } catch {
      setEntries(new Map());
    } finally {
      setLoading(false);
    }
  }, [open, templateId, assessmentId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // While any PDF is still rendering server-side, poll so badges flip to ready live.
  useEffect(() => {
    if (!open) return;
    const anyPending = Array.from(entries.values())
      .some((e) => e.pdfStatus === "pending" || e.pdfStatus === "rendering");
    if (!anyPending) return;
    const t = setInterval(() => { loadEntries(); }, 4000);
    return () => clearInterval(t);
  }, [open, entries, loadEntries]);

  // Count rows whose PDF is rendered and downloadable.
  const generatedCount = useMemo(
    () => students.filter((s) => entries.get(s.userStudentId)?.pdfStatus === "ready" && entries.get(s.userStudentId)?.pdfUrl).length,
    [students, entries]
  );

  const setEntry = (id: number, e: Entry) =>
    setEntries((prev) => { const n = new Map(prev); n.set(id, e); return n; });

  const tId = templateId === "" ? undefined : Number(templateId);

  // ── single generate / regenerate (component-level state update only) ──
  const generateOne = async (sid: number, force = false) => {
    if (templateId === "") { showErrorToast("Pick a report template first"); return; }
    setBusyIds((p) => new Set(p).add(sid));
    try {
      const res = await GenerateUnifiedReport(sid, assessmentId, tId, force);
      setEntry(sid, { reportUrl: res.data.reportUrl ?? null, status: "generated",
        pdfUrl: res.data.pdfUrl ?? null, pdfStatus: res.data.pdfStatus ?? "pending" });
      showSuccessToast(force ? "Report regenerated" : "Report generated");
      onGenerated();
    } catch (e: any) {
      showErrorToast("Generate failed: " + (e?.response?.data?.message || e?.response?.data?.code || e?.message || "error"));
    } finally {
      setBusyIds((p) => { const n = new Set(p); n.delete(sid); return n; });
    }
  };

  // ── bulk generate (chunked for a real progress bar) ──
  const generateAll = async () => {
    if (templateId === "") { showErrorToast("Pick a report template first"); return; }
    const ids = students.map((s) => s.userStudentId);
    setGenerating(true);
    setProgress({ current: 0, total: ids.length });
    let done = 0, ok = 0;
    const CHUNK = 5;
    try {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const res = await GenerateUnifiedReportsBulk(assessmentId, chunk, tId);
        for (const r of res.data.results || []) {
          if (r.status === "ok") { ok++; setEntry(r.userStudentId, { reportUrl: r.reportUrl ?? null, status: "generated",
            pdfUrl: r.pdfUrl ?? null, pdfStatus: r.pdfStatus ?? "pending" }); }
        }
        done += chunk.length;
        setProgress({ current: done, total: ids.length });
      }
      showSuccessToast(`Generated ${ok}/${ids.length}`);
      onGenerated();
    } catch (e: any) {
      showErrorToast("Bulk generation failed: " + (e?.response?.data || e?.message || "error"));
    } finally {
      setGenerating(false);
      setTimeout(() => setProgress(null), 1500);
    }
  };

  // ── downloads (straight from Spaces — no client-side rasterization) ──
  const triggerDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const safe = (s: string) => (s || "student").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");

  // Fetch a Spaces URL and force-download it with a friendly filename (cross-origin
  // <a download> is ignored by browsers, so we go via a blob; bucket CORS allows GET).
  const downloadUrlAsFile = async (url: string, fileName: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    triggerDownload(await res.blob(), fileName);
  };

  const downloadOnePdf = async (s: ModalStudent) => {
    const e = entries.get(s.userStudentId);
    if (!e?.pdfUrl) { showErrorToast("PDF not ready yet"); return; }
    setDownloadingId(s.userStudentId);
    try { await downloadUrlAsFile(e.pdfUrl, `${safe(s.name)}_report.pdf`); }
    catch { showErrorToast("Download failed (try Preview to open directly)"); }
    finally { setDownloadingId(null); }
  };

  const downloadOneHtml = async (s: ModalStudent) => {
    const e = entries.get(s.userStudentId);
    if (!e?.reportUrl) return;
    setDownloadingId(s.userStudentId);
    try { await downloadUrlAsFile(e.reportUrl, `${safe(s.name)}_report.html`); }
    catch { showErrorToast("Download failed"); }
    finally { setDownloadingId(null); }
  };

  const downloadAllZip = async () => {
    const items = students
      .map((s) => ({ fileName: `${safe(s.name)}_report`, pdfUrl: entries.get(s.userStudentId)?.pdfUrl ?? null }))
      .filter((x) => !!x.pdfUrl);
    if (items.length === 0) { showErrorToast("No ready PDFs to download"); return; }
    setDownloadingAll(true);
    try {
      const { blob, added, skipped } = await zipStoredPdfs(items);
      if (added === 0) { showErrorToast("No PDFs could be downloaded"); return; }
      triggerDownload(blob, `${safe(assessmentName)}_reports.zip`);
      if (skipped.length) showErrorToast(`${skipped.length} report(s) skipped (PDF not ready)`);
    } catch { showErrorToast("ZIP download failed"); }
    finally { setDownloadingAll(false); }
  };

  if (!open) return null;

  const selectedTemplate = templates.find((m) => m.template.reportTemplateId === templateId);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <div style={{ flexGrow: 1 }}>
            <h3 style={{ margin: 0 }}>Generate Reports</h3>
            <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
              {assessmentName} · {students.length} student{students.length !== 1 ? "s" : ""} selected
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {/* template picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: 4 }}>
            Report to generate
          </label>
          <select
            className="form-select"
            value={templateId}
            disabled={templates.length === 0 || generating}
            onChange={(e) => setTemplateId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            {templates.length === 0 ? (
              <option value="">No template mapped to this assessment</option>
            ) : (
              templates.map((m) => (
                <option key={m.template.reportTemplateId} value={m.template.reportTemplateId}>
                  {m.template.displayName}{m.isDefault ? " (default)" : ""}
                </option>
              ))
            )}
          </select>
        </div>

        {/* progress */}
        {progress && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: "0.8rem", color: "#374151", marginBottom: 4 }}>
              Generating {progress.current}/{progress.total}…
            </div>
            <div style={{ height: 8, background: "#e5e7eb", borderRadius: 6, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`,
                background: "linear-gradient(90deg,#0d9488,#14b8a6)", transition: "width 0.2s",
              }} />
            </div>
          </div>
        )}

        {/* student list */}
        <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <table className="table table-sm align-middle" style={{ marginBottom: 0 }}>
            <thead><tr style={{ fontSize: "0.78rem", color: "#6b7280" }}>
              <th>Name</th><th>Username</th><th>Report</th><th className="text-end">Actions</th>
            </tr></thead>
            <tbody>
              {students.map((s) => {
                const e = entries.get(s.userStudentId);
                const has = e?.status === "generated" && !!e?.reportUrl;
                const busy = busyIds.has(s.userStudentId);
                return (
                  <tr key={s.userStudentId}>
                    <td style={{ fontWeight: 600 }}>{s.name || "-"}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{s.username || "—"}</td>
                    <td>
                      {has ? <span className="badge badge-light-success">Generated</span>
                           : <span className="badge badge-light-warning">Not generated</span>}
                    </td>
                    <td className="text-end">
                      {has ? (
                        <span style={{ display: "inline-flex", gap: 4 }}>
                          <a className="btn btn-sm btn-light-primary py-1" href={e!.reportUrl!} target="_blank" rel="noreferrer">Preview</a>
                          <button className="btn btn-sm btn-light-success py-1"
                            disabled={downloadingId === s.userStudentId || e!.pdfStatus !== "ready" || !e!.pdfUrl}
                            title={e!.pdfStatus !== "ready" ? `PDF ${e!.pdfStatus}` : "Download PDF"}
                            onClick={() => downloadOnePdf(s)}>
                            {downloadingId === s.userStudentId ? "…"
                              : e!.pdfStatus === "ready" ? "PDF"
                              : e!.pdfStatus === "failed" ? "PDF ✗" : "PDF…"}
                          </button>
                          <button className="btn btn-sm btn-light py-1"
                            disabled={downloadingId === s.userStudentId}
                            onClick={() => downloadOneHtml(s)}>HTML</button>
                          <button className="btn btn-sm btn-light py-1" disabled={busy || generating}
                            onClick={() => generateOne(s.userStudentId, true)}>
                            {busy ? "…" : "Regenerate"}
                          </button>
                        </span>
                      ) : (
                        <button className="btn btn-sm btn-primary py-1" disabled={busy || generating || templateId === ""}
                          onClick={() => generateOne(s.userStudentId)}>
                          {busy ? "…" : "Generate"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* footer actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {!single && (
            <button className="btn btn-primary" disabled={generating || templateId === ""} onClick={generateAll}>
              {generating ? "Generating…" : `Generate all (${students.length})`}
            </button>
          )}
          <button className="btn btn-light-success" disabled={downloadingAll || generatedCount === 0}
            onClick={() => (single ? downloadOnePdf(students[0]) : downloadAllZip())}>
            {downloadingAll ? "Zipping…" : single ? "Download PDF" : `Download all as ZIP (${generatedCount})`}
          </button>
          <div style={{ flexGrow: 1 }} />
          <button className="btn btn-light" onClick={onClose}>Close</button>
        </div>
        {loading && <div style={{ fontSize: "0.78rem", color: "#9ca3af", marginTop: 8 }}>Loading current status…</div>}
        {selectedTemplate && (
          <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 8 }}>
            Engine: {selectedTemplate.template.engineCode}
            {!selectedTemplate.template.hasTemplate && " · ⚠ no HTML uploaded for this template"}
          </div>
        )}
      </div>
    </div>
  );
};

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1060,
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};
const panel: React.CSSProperties = {
  background: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 720,
  maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
};
const closeBtn: React.CSSProperties = {
  border: "none", background: "transparent", fontSize: "1.1rem", cursor: "pointer", color: "#6b7280",
};

export default GenerateReportsModal;
