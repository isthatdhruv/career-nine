import React, { useEffect, useState } from "react";
import SearchableMultiSelect from "../../../components/SearchableMultiSelect";
import { Assessment } from "../../StudentInformation/StudentInfo_APIs";
import { getReportType } from "../../UnifiedReportManagement/API/UnifiedReport_APIs";
import { showErrorToast } from "../../../utils/toast";
import {
  AutoZipJob,
  AutoZipPreview,
  AutoZipSplit,
  previewAutoZip,
  startAutoZip,
} from "../API/ReportZip_APIs";

type Props = {
  open: boolean;
  onClose: () => void;
  instituteId: number;
  instituteName: string;
  /** Every assessment mapped to the school — the choices. */
  assessments: Assessment[];
  /** Pre-ticked: whatever the hub table is showing. */
  defaultAssessmentIds: number[];
  onStarted: (job: AutoZipJob) => void;
};

const SPLITS: { value: AutoZipSplit; label: string; hint: string }[] = [
  { value: "school", label: "One ZIP for the school", hint: "Class and section folders inside one archive" },
  { value: "class", label: "One ZIP per class", hint: "e.g. one file for Class 9, one for Class 10" },
  { value: "section", label: "One ZIP per section", hint: "e.g. one file for Class 9 Section A" },
];

const slug = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/**
 * Auto ZIP: the server gathers every rendered PDF of the school's students on
 * the chosen assessments and files it as Class / Section / [Assessment /]
 * Student.pdf — no row ticking, no browser download of each PDF.
 */
const AutoZipModal: React.FC<Props> = ({
  open, onClose, instituteId, instituteName, assessments, defaultAssessmentIds, onStarted,
}) => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [splitBy, setSplitBy] = useState<AutoZipSplit>("school");
  const [zipName, setZipName] = useState("");
  const [preview, setPreview] = useState<AutoZipPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [starting, setStarting] = useState(false);

  // Fresh defaults every time the modal opens.
  useEffect(() => {
    if (!open) return;
    const mapped = new Set(assessments.map((a) => a.id));
    const initial = defaultAssessmentIds.filter((id) => mapped.has(id));
    setSelectedIds(initial.length > 0 ? initial : assessments.map((a) => a.id));
    setSplitBy("school");
    setZipName(`${slug(instituteName) || "school"}_reports_${new Date().toISOString().slice(0, 10)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Live counts per class/section; debounced so ticking several assessments
  // in a row costs one request.
  useEffect(() => {
    if (!open) return;
    if (selectedIds.length === 0) { setPreview(null); setPreviewError(""); return; }
    let cancelled = false;
    setPreviewLoading(true);
    const t = window.setTimeout(() => {
      previewAutoZip({ instituteId, assessmentIds: selectedIds, splitBy })
        .then((res) => { if (!cancelled) { setPreview(res.data); setPreviewError(""); } })
        .catch((err) => {
          if (cancelled) return;
          setPreview(null);
          setPreviewError(err?.response?.data?.error || "Could not load the preview.");
        })
        .finally(() => { if (!cancelled) setPreviewLoading(false); });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [open, instituteId, selectedIds, splitBy]);

  if (!open) return null;

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await startAutoZip({
        instituteId, assessmentIds: selectedIds, splitBy, zipName: zipName.trim() || undefined,
      });
      onStarted(res.data);
      onClose();
    } catch (err: any) {
      showErrorToast(err?.response?.data?.error || "Could not start the ZIP.");
    } finally {
      setStarting(false);
    }
  };

  const canStart = !starting && !previewLoading && !!preview && preview.ready > 0 && selectedIds.length > 0;
  const th: React.CSSProperties = {
    padding: "7px 10px", fontSize: "0.72rem", fontWeight: 700, color: "#475569",
    textAlign: "left", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, background: "#f8fafc",
  };
  const td: React.CSSProperties = { padding: "6px 10px", fontSize: "0.8rem", borderBottom: "1px solid #f1f5f9" };
  const num: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1050,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.45)",
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 16, width: 680, maxWidth: "95vw", maxHeight: "90vh",
        display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 24px", borderBottom: "1px solid #e5e7eb", flexShrink: 0,
        }}>
          <div>
            <h3 style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem", color: "#1a1a2e" }}>Auto ZIP</h3>
            <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 2 }}>
              Every rendered report at <strong>{instituteName}</strong>, filed by class and section
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "1.4rem", color: "#9ca3af", lineHeight: 1, padding: 4,
          }}>&times;</button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 24px", overflowY: "auto", flex: 1 }}>
          {/* Assessments */}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>
              Assessments <span style={{ fontWeight: 500, color: "#6b7280" }}>· {selectedIds.length} selected</span>
            </label>
            <button type="button" className="btn btn-link btn-sm p-0"
              style={{ fontSize: "0.78rem" }}
              onClick={() => setSelectedIds(assessments.map((a) => a.id))}>
              Select all
            </button>
          </div>
          <SearchableMultiSelect
            options={assessments.map((a) => ({
              value: String(a.id),
              label: `${a.assessmentName} [${getReportType(a).toUpperCase()}]`,
            }))}
            value={selectedIds.map(String)}
            onChange={(vals) => setSelectedIds(vals.map(Number))}
            placeholder="-- Select one or more assessments --"
          />

          {/* Split */}
          <label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151", margin: "18px 0 6px", display: "block" }}>
            Organise as
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {SPLITS.map((s) => {
              const active = splitBy === s.value;
              return (
                <button key={s.value} type="button" onClick={() => setSplitBy(s.value)}
                  style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    border: `1.5px solid ${active ? "#7c3aed" : "#e5e7eb"}`,
                    background: active ? "#f5f3ff" : "#fff",
                  }}>
                  <div style={{ fontWeight: 600, fontSize: "0.82rem", color: active ? "#5b21b6" : "#1f2937" }}>{s.label}</div>
                  <div style={{ fontSize: "0.7rem", color: "#6b7280", marginTop: 2 }}>{s.hint}</div>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 6 }}>
            Inside each ZIP: <code>Class / Section / {selectedIds.length > 1 ? "Assessment / " : ""}Student.pdf</code>,
            plus <code>_summary.csv</code> listing students whose report isn't ready.
          </div>

          {/* Name */}
          <label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151", margin: "18px 0 6px", display: "block" }}>
            ZIP name
          </label>
          <input type="text" className="form-control form-control-sm form-control-solid"
            value={zipName} onChange={(e) => setZipName(e.target.value)} />
          {splitBy !== "school" && (
            <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 4 }}>
              Each file gets its {splitBy} appended, e.g. <code>{zipName || "reports"}_Class-9{splitBy === "section" ? "-Section-A" : ""}.zip</code>
            </div>
          )}

          {/* Preview */}
          <div style={{ marginTop: 18 }}>
            {selectedIds.length === 0 ? (
              <div style={{ color: "#9ca3af", fontSize: "0.85rem" }}>Pick at least one assessment.</div>
            ) : previewLoading && !preview ? (
              <div style={{ color: "#9ca3af", fontSize: "0.85rem" }}>Counting reports...</div>
            ) : previewError ? (
              <div style={{ color: "#dc2626", fontSize: "0.85rem" }}>{previewError}</div>
            ) : preview && (
              <div style={{ opacity: previewLoading ? 0.5 : 1, transition: "opacity 0.15s" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <Chip bg="#dcfce7" fg="#166534">{preview.ready} PDF{preview.ready === 1 ? "" : "s"} ready</Chip>
                  {preview.completedNoPdf > 0 && (
                    <Chip bg="#fef3c7" fg="#92400e">{preview.completedNoPdf} completed, no PDF yet</Chip>
                  )}
                  {preview.notCompleted > 0 && (
                    <Chip bg="#f1f5f9" fg="#475569">{preview.notCompleted} not completed</Chip>
                  )}
                  <Chip bg="#ede9fe" fg="#5b21b6">{preview.zipCount} ZIP file{preview.zipCount === 1 ? "" : "s"}</Chip>
                </div>
                {preview.completedNoPdf > 0 && (
                  <div style={{
                    fontSize: "0.75rem", color: "#92400e", background: "#fffbeb",
                    border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px", marginBottom: 10,
                  }}>
                    {preview.completedNoPdf} student{preview.completedNoPdf === 1 ? " has" : "s have"} finished but
                    {preview.completedNoPdf === 1 ? " has" : " have"} no rendered PDF. Generate or queue those reports
                    first if they should be in the ZIP.
                  </div>
                )}
                {preview.groups.length > 0 && (
                  <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 10 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={th}>Class</th>
                          <th style={th}>Section</th>
                          <th style={{ ...th, textAlign: "right" }}>Ready</th>
                          <th style={{ ...th, textAlign: "right" }}>No PDF yet</th>
                          <th style={{ ...th, textAlign: "right" }}>Not completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.groups.map((g) => (
                          <tr key={`${g.className}|${g.sectionName}`}>
                            <td style={td}>{g.className}</td>
                            <td style={td}>{g.sectionName}</td>
                            <td style={{ ...num, fontWeight: 600, color: g.ready ? "#166534" : "#9ca3af" }}>{g.ready}</td>
                            <td style={{ ...num, color: g.completedNoPdf ? "#b45309" : "#9ca3af" }}>{g.completedNoPdf}</td>
                            <td style={{ ...num, color: "#9ca3af" }}>{g.notCompleted}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          padding: "14px 24px", borderTop: "1px solid #e5e7eb", flexShrink: 0,
        }}>
          <span style={{ fontSize: "0.72rem", color: "#6b7280" }}>
            Runs on the server — you can close this page; it shows up in Downloads.
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-light btn-sm" onClick={onClose} style={{ borderRadius: 8 }}>Cancel</button>
            <button className="btn btn-sm" disabled={!canStart} onClick={handleStart}
              style={{
                background: canStart ? "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)" : "#9ca3af",
                border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 600, color: "#fff",
              }}>
              {starting ? "Starting..." : `Start Auto ZIP${preview?.ready ? ` (${preview.ready})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Chip: React.FC<{ bg: string; fg: string; children: React.ReactNode }> = ({ bg, fg, children }) => (
  <span style={{ background: bg, color: fg, padding: "3px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600 }}>
    {children}
  </span>
);

export default AutoZipModal;
