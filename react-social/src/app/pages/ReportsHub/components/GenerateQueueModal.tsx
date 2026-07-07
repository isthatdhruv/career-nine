import React, { useCallback, useEffect, useState } from "react";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import { zipStoredPdfs } from "../../ReportGeneration/utils/pdfZip";
import {
  EnqueueUnifiedReport,
  EnqueueUnifiedReportsBulk,
  TemplateMappingDto,
} from "../../ReportTemplates/API/Report_Templates_APIs";
import {
  getGeneratedReportsByAssessment,
} from "../../ReportGeneration/API/GeneratedReport_APIs";
import { ModalStudent } from "./GenerateReportsModal";

interface Props {
  open: boolean;
  onClose: () => void;
  assessmentId: number;
  assessmentName: string;
  templates: TemplateMappingDto[];
  initialTemplateId: number | "";
  students: ModalStudent[];
  /** Called after any batch resolves so the parent page can refresh its maps. */
  onGenerated: () => void;
}

type Entry = { reportUrl: string | null; status: string; pdfUrl: string | null; pdfStatus: string };

const POLL_MS = 4000;

const GenerateQueueModal: React.FC<Props> = ({
  open, onClose, assessmentId, assessmentName, templates, initialTemplateId, students, onGenerated,
}) => {
  const [templateId, setTemplateId] = useState<number | "">(initialTemplateId);
  const [entries, setEntries] = useState<Map<number, Entry>>(new Map());
  const [loading, setLoading] = useState(false);
  const [enqueuing, setEnqueuing] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  // Email toggle: default OFF on every open; confirm required to switch ON.
  const [emailOn, setEmailOn] = useState(false);
  // Current batch: students still awaiting the worker. No time cap — large bulk
  // regenerates legitimately run long; polling stops when all rows resolve or
  // the modal closes.
  const [batch, setBatch] = useState<Set<number>>(new Set());
  const [batchTotal, setBatchTotal] = useState(0);

  const single = students.length === 1;

  useEffect(() => {
    setTemplateId(initialTemplateId);
    setEmailOn(false);
    setBatch(new Set());
    setBatchTotal(0);
  }, [initialTemplateId, open]);

  // Load rows for the chosen template (rows are unique per student+assessment+template).
  const loadEntries = useCallback(async () => {
    if (!open || templateId === "") { setEntries(new Map()); return new Map<number, Entry>(); }
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
      return map;
    } catch {
      return new Map<number, Entry>();
    } finally {
      setLoading(false);
    }
  }, [open, templateId, assessmentId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Poll while a batch is outstanding. A row leaves "queued" only when the
  // worker finished (success → "generated", terminal failure → "failed").
  useEffect(() => {
    if (!open || batch.size === 0) return;
    const t = setInterval(async () => {
      const map = await loadEntries();
      setBatch((prev) => {
        const next = new Set(prev);
        for (const sid of Array.from(prev)) {
          const st = map.get(sid)?.status;
          if (st && st !== "queued") next.delete(sid);
        }
        if (next.size === 0) {
          showSuccessToast("Queue batch finished");
          onGenerated();
        }
        return next;
      });
    }, POLL_MS);
    return () => clearInterval(t);
  }, [open, batch.size, loadEntries, onGenerated]);

  const tId = templateId === "" ? undefined : Number(templateId);
  const emailMode = emailOn ? ("all" as const) : ("none" as const);

  const startBatch = (ids: number[]) => {
    setBatch(new Set(ids));
    setBatchTotal(ids.length);
    // Chips flip to queued immediately (server stamped rows before the 202).
    setEntries((prev) => {
      const n = new Map(prev);
      for (const id of ids) {
        const e = n.get(id);
        n.set(id, { reportUrl: e?.reportUrl ?? null, status: "queued",
          pdfUrl: e?.pdfUrl ?? null, pdfStatus: e?.pdfStatus ?? "notRequested" });
      }
      return n;
    });
  };

  const toggleEmail = () => {
    if (emailOn) { setEmailOn(false); return; }
    const yes = window.confirm(
      `Email ${students.length} student(s) their report when generation completes?\n\n` +
      `Whitelabel status is IGNORED — every selected student with an email address will receive one.`
    );
    if (yes) setEmailOn(true);
  };

  // ── enqueue one (force = which button: Regenerate ✕ = true, Regenerate = false) ──
  const enqueueOne = async (sid: number, force: boolean) => {
    if (templateId === "") { showErrorToast("Pick a report template first"); return; }
    setBusyIds((p) => new Set(p).add(sid));
    try {
      const res = await EnqueueUnifiedReport(sid, assessmentId, tId, force, emailMode);
      const row = res.data.results?.[0];
      if (row && row.status !== "queued") {
        showErrorToast(`Enqueue failed: ${row.message || row.status}`);
        return;
      }
      startBatch([sid]);
    } catch (e: any) {
      showErrorToast("Enqueue failed: " + (e?.response?.data?.error || e?.message || "error"));
    } finally {
      setBusyIds((p) => { const n = new Set(p); n.delete(sid); return n; });
    }
  };

  // ── enqueue all (single bulk call; worker concurrency does the pacing) ──
  const enqueueAll = async (force: boolean) => {
    if (templateId === "") { showErrorToast("Pick a report template first"); return; }
    const ids = students.map((s) => s.userStudentId);
    setEnqueuing(true);
    try {
      const res = await EnqueueUnifiedReportsBulk(assessmentId, ids, tId, force, emailMode);
      const okIds = (res.data.results || []).filter((r) => r.status === "queued").map((r) => r.userStudentId);
      const failed = (res.data.results || []).filter((r) => r.status !== "queued");
      if (failed.length) showErrorToast(`${failed.length} student(s) not queued (${failed[0].status})`);
      if (okIds.length === 0) return;
      startBatch(okIds);
      showSuccessToast(`Queued ${okIds.length}/${ids.length}${emailOn ? " (emails ON)" : ""}`);
    } catch (e: any) {
      showErrorToast("Bulk enqueue failed: " + (e?.response?.data?.error || e?.message || "error"));
    } finally {
      setEnqueuing(false);
    }
  };

  // ── downloads (same as GenerateReportsModal — straight from Spaces) ──
  const triggerDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const safe = (s: string) => (s || "student").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");

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
    catch { showErrorToast("Download failed"); }
    finally { setDownloadingId(null); }
  };

  const downloadAllZip = async () => {
    // Zip guard: zipping mid-batch downloads the PREVIOUS versions still in Spaces.
    if (batch.size > 0) {
      const yes = window.confirm(`${batch.size} report(s) still regenerating — zip the current versions anyway?`);
      if (!yes) return;
    }
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
  const resolved = batchTotal - batch.size;
  const readyPdfCount = students.filter((s) => {
    const e = entries.get(s.userStudentId);
    return e?.pdfStatus === "ready" && !!e?.pdfUrl;
  }).length;

  const chip = (sid: number) => {
    const e = entries.get(sid);
    if (batch.has(sid) || e?.status === "queued") return <span className="badge badge-light-info">Queued…</span>;
    if (e?.status === "generated" && e.reportUrl) return <span className="badge badge-light-success">Generated</span>;
    if (e?.status === "failed") return <span className="badge badge-light-danger">Failed</span>;
    return <span className="badge badge-light-warning">Not generated</span>;
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <div style={{ flexGrow: 1 }}>
            <h3 style={{ margin: 0 }}>Generate Queue</h3>
            <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
              {assessmentName} · {students.length} student{students.length !== 1 ? "s" : ""} · via report-worker
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {/* template picker */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: 4 }}>
            Report to generate
          </label>
          <select
            className="form-select"
            value={templateId}
            disabled={templates.length === 0 || enqueuing || batch.size > 0}
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

        {/* email toggle */}
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <div className="form-check form-switch" style={{ marginBottom: 0 }}>
            <input className="form-check-input" type="checkbox" id="queueEmailToggle"
              checked={emailOn} onChange={toggleEmail} disabled={enqueuing} />
            <label className="form-check-label" htmlFor="queueEmailToggle" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
              Email these students
            </label>
          </div>
          <span style={{ fontSize: "0.75rem", color: emailOn ? "#dc2626" : "#9ca3af" }}>
            {emailOn ? "ON — every student with an address will be emailed (whitelabel ignored)" : "off"}
          </span>
        </div>

        {/* batch progress */}
        {batchTotal > 0 && batch.size > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: "0.8rem", color: "#374151", marginBottom: 4 }}>
              Worker processing {resolved}/{batchTotal}…
            </div>
            <div style={{ height: 8, background: "#e5e7eb", borderRadius: 6, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${batchTotal ? (resolved / batchTotal) * 100 : 0}%`,
                background: "linear-gradient(90deg,#6366f1,#8b5cf6)", transition: "width 0.3s",
              }} />
            </div>
          </div>
        )}

        {/* student list */}
        <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <table className="table table-sm align-middle" style={{ marginBottom: 0 }}>
            <thead><tr style={{ fontSize: "0.78rem", color: "#6b7280" }}>
              <th>Name</th><th>Username</th><th>Status</th><th className="text-end">Actions</th>
            </tr></thead>
            <tbody>
              {students.map((s) => {
                const e = entries.get(s.userStudentId);
                const busy = busyIds.has(s.userStudentId) || batch.has(s.userStudentId);
                return (
                  <tr key={s.userStudentId}>
                    <td style={{ fontWeight: 600 }}>{s.name || "-"}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{s.username || "—"}</td>
                    <td>{chip(s.userStudentId)}</td>
                    <td className="text-end">
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <button className="btn btn-sm btn-light-danger py-1" disabled={busy || enqueuing || templateId === ""}
                          title="Recalculate scores + placeholders, regenerate report + PDF"
                          onClick={() => enqueueOne(s.userStudentId, true)}>
                          {busy ? "…" : "Regenerate ✕"}
                        </button>
                        <button className="btn btn-sm btn-light py-1" disabled={busy || enqueuing || templateId === ""}
                          title="Re-render from existing scores, regenerate PDF"
                          onClick={() => enqueueOne(s.userStudentId, false)}>
                          {busy ? "…" : "Regenerate"}
                        </button>
                        <button className="btn btn-sm btn-light-success py-1"
                          disabled={downloadingId === s.userStudentId || e?.pdfStatus !== "ready" || !e?.pdfUrl}
                          title={e?.pdfStatus !== "ready" ? `PDF ${e?.pdfStatus ?? "not requested"}` : "Download PDF"}
                          onClick={() => downloadOnePdf(s)}>
                          {downloadingId === s.userStudentId ? "…" : "PDF"}
                        </button>
                      </span>
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
            <>
              <button className="btn btn-danger" disabled={enqueuing || batch.size > 0 || templateId === ""}
                title="Recalculate scores + placeholders for every student"
                onClick={() => enqueueAll(true)}>
                {enqueuing ? "Queuing…" : `Regenerate ✕ all (${students.length})`}
              </button>
              <button className="btn btn-primary" disabled={enqueuing || batch.size > 0 || templateId === ""}
                title="Re-render every report from existing scores"
                onClick={() => enqueueAll(false)}>
                {enqueuing ? "Queuing…" : `Regenerate all (${students.length})`}
              </button>
            </>
          )}
          {single && (
            <span style={{ fontSize: "0.78rem", color: "#6b7280", alignSelf: "center" }}>
              Use the row buttons to queue this student.
            </span>
          )}
          <button className="btn btn-light-success" disabled={downloadingAll || readyPdfCount === 0}
            onClick={() => (single ? downloadOnePdf(students[0]) : downloadAllZip())}>
            {downloadingAll ? "Zipping…" : single ? "Download PDF" : `Download all as ZIP (${readyPdfCount})`}
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
  background: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 760,
  maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
};
const closeBtn: React.CSSProperties = {
  border: "none", background: "transparent", fontSize: "1.1rem", cursor: "pointer", color: "#6b7280",
};

export default GenerateQueueModal;
