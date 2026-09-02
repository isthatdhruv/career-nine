import { useEffect, useMemo, useState } from "react";
import { showErrorToast, showSuccessToast } from "../../utils/toast";
import PageHeader from "../../components/PageHeader";
import SearchableSelect from "../../components/SearchableSelect";
import { useInstitutes } from "../../lib/queries/lookups";
import { GetSessionsByInstituteCode } from "../College/API/College_APIs";
import { getStudentsWithMappingByInstituteId } from "../StudentInformation/StudentInfo_APIs";
import { getCatalogAssessmentSummaries } from "../AssessmentMapping/API/AssessmentMapping_APIs";
import {
  getGeneratedReportsByAssessment,
  GeneratedReport,
} from "../ReportGeneration/API/GeneratedReport_APIs";
import {
  EnqueueUnifiedReport,
  EnqueueUnifiedReportsBulk,
  ReadAssessmentTemplates,
  TemplateMappingDto,
} from "../ReportTemplates/API/Report_Templates_APIs";
import axios from "axios";
import { zipStoredPdfsInParts, ZipPart } from "../ReportGeneration/utils/pdfZip";
import GenerateQueueModal from "../ReportsHub/components/GenerateQueueModal";

/**
 * Report Center — school-facing report delivery page.
 *
 * Pick an institute (list is ABAC-scoped server-side), all assessments or one,
 * and get a flat list of student × assessment rows: status, completed-on,
 * report status, preview / download / send per row. Sending uses the unified
 * generate queue (Kafka-backed) with force=false + emailMode="all": an
 * existing report is NOT regenerated — the worker just emails the student the
 * fixed report template (PDF + CDN link). Missing reports are generated first,
 * then emailed. Bulk send enqueues one batch per assessment.
 */

type StudentRow = {
  userStudentId: number;
  name: string;
  username?: string;
  email?: string;
  schoolSectionId?: number;
  studentClass?: string | null;
  assessments?: {
    assessmentId: number;
    assessmentName: string;
    status: string;
    completedAt?: string | null;
  }[];
};

type SectionInfo = { className: string; sectionName: string };

type Row = {
  key: string;
  student: StudentRow;
  assessmentId: number;
  assessmentName: string;
  status: string;
  completedAt: string | null;
  grade: string;
  section: string;
  report: GeneratedReport | null;
};

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

const statusBadge = (status: string): { bg: string; fg: string; label: string } => {
  switch (status) {
    case "completed": return { bg: "#dcfce7", fg: "#166534", label: "Completed" };
    case "ongoing": return { bg: "#fef3c7", fg: "#92400e", label: "Ongoing" };
    default: return { bg: "#f1f5f9", fg: "#64748b", label: "Not started" };
  }
};

const ReportCenterPage = () => {
  const { data: institutes = [], isLoading: loadingInstitutes } = useInstitutes<any>();
  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sectionLookup, setSectionLookup] = useState<Map<number, SectionInfo>>(new Map());
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<number | "">("");
  // assessmentId → userStudentId → GeneratedReport
  const [reportMap, setReportMap] = useState<Map<number, Map<number, GeneratedReport>>>(new Map());
  const [reportsLoading, setReportsLoading] = useState(false);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "completed" | "ongoing" | "notstarted">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [sendingKeys, setSendingKeys] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateMappingDto[]>([]);

  // ── Auto-select when the (server-scoped) institute list has exactly one ──
  useEffect(() => {
    if (selectedInstitute === "" && institutes.length === 1) {
      setSelectedInstitute(Number(institutes[0].instituteCode));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutes]);

  // ── Students + class/section names ──
  useEffect(() => {
    if (selectedInstitute === "") {
      setStudents([]);
      setSectionLookup(new Map());
      return;
    }
    setStudentsLoading(true);
    Promise.all([
      getStudentsWithMappingByInstituteId(Number(selectedInstitute)),
      GetSessionsByInstituteCode(selectedInstitute),
    ])
      .then(([studentsRes, sessionsRes]) => {
        setStudents(studentsRes.data || []);
        const lookup = new Map<number, SectionInfo>();
        for (const session of sessionsRes.data || []) {
          for (const cls of session.schoolClasses || []) {
            for (const sec of cls.schoolSections || []) {
              if (!lookup.has(sec.id)) {
                lookup.set(sec.id, { className: cls.className, sectionName: sec.sectionName });
              }
            }
          }
        }
        setSectionLookup(lookup);
      })
      .catch(() => {
        setStudents([]);
        setSectionLookup(new Map());
        showErrorToast("Failed to load students");
      })
      .finally(() => setStudentsLoading(false));
    setSelectedAssessment("");
    setSelectedKeys(new Set());
    setSearch("");
    setGradeFilter("");
    setSectionFilter("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
  }, [selectedInstitute]);

  // ── Assessment options: ONLY assessments mapped to the institute (its
  // enabled-assessments catalog) — not everything students were ever assigned.
  const [catalogAssessments, setCatalogAssessments] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    if (selectedInstitute === "") {
      setCatalogAssessments([]);
      return;
    }
    getCatalogAssessmentSummaries(Number(selectedInstitute))
      .then((res) =>
        setCatalogAssessments(
          (res.data || [])
            .map((a) => ({ id: a.id, name: a.assessmentName }))
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      )
      .catch(() => setCatalogAssessments([]));
  }, [selectedInstitute]);

  const assessmentOptions = catalogAssessments;
  const catalogIds = useMemo(
    () => new Set(catalogAssessments.map((a) => a.id)),
    [catalogAssessments]
  );

  // Fetch report status only where students actually have the assessment.
  const studentAssignedIds = useMemo(() => {
    const s = new Set<number>();
    for (const st of students) for (const a of st.assessments || []) s.add(a.assessmentId);
    return s;
  }, [students]);

  const scopedAssessmentIds = useMemo(
    () =>
      selectedAssessment === ""
        ? assessmentOptions.map((a) => a.id).filter((id) => studentAssignedIds.has(id))
        : [Number(selectedAssessment)],
    [selectedAssessment, assessmentOptions, studentAssignedIds]
  );

  // ── Report status per assessment in scope ──
  const refreshReports = () => {
    if (scopedAssessmentIds.length === 0) {
      setReportMap(new Map());
      return;
    }
    setReportsLoading(true);
    Promise.all(
      scopedAssessmentIds.map((aid) =>
        getGeneratedReportsByAssessment(aid)
          .then((res) => [aid, res.data || []] as const)
          .catch(() => [aid, [] as GeneratedReport[]] as const)
      )
    )
      .then((entries) => {
        const outer = new Map<number, Map<number, GeneratedReport>>();
        for (const [aid, reports] of entries) {
          const inner = new Map<number, GeneratedReport>();
          for (const r of reports) {
            const sid = r.userStudent?.userStudentId;
            if (sid != null) inner.set(sid, r);
          }
          outer.set(aid, inner);
        }
        setReportMap(outer);
      })
      .finally(() => setReportsLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refreshReports, [scopedAssessmentIds.join(",")]);

  // ── Templates for the Generate modal (specific assessment only) ──
  useEffect(() => {
    if (selectedAssessment === "") {
      setTemplates([]);
      return;
    }
    ReadAssessmentTemplates(Number(selectedAssessment))
      .then((res) => setTemplates(res.data || []))
      .catch(() => setTemplates([]));
  }, [selectedAssessment]);

  // ── Flatten to rows + filters ──
  const rows: Row[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59") : null;
    const out: Row[] = [];
    for (const s of students) {
      const sec = s.schoolSectionId != null ? sectionLookup.get(s.schoolSectionId) : undefined;
      const grade = sec?.className || s.studentClass || "";
      const section = sec?.sectionName || "";
      for (const a of s.assessments || []) {
        // Only assessments mapped to the institute appear — same rule as the
        // dropdown, so "All assessments" means "all catalog assessments".
        if (!catalogIds.has(a.assessmentId)) continue;
        if (selectedAssessment !== "" && a.assessmentId !== Number(selectedAssessment)) continue;
        if (q && !(s.name || "").toLowerCase().includes(q) && !(s.username || "").toLowerCase().includes(q)) continue;
        if (gradeFilter && grade !== gradeFilter) continue;
        if (sectionFilter && section !== sectionFilter) continue;
        if (statusFilter && (a.status || "notstarted") !== statusFilter) continue;
        const completedAt = a.completedAt || null;
        if (from || to) {
          if (!completedAt) continue;
          const d = new Date(completedAt);
          if (from && d < from) continue;
          if (to && d > to) continue;
        }
        out.push({
          key: `${a.assessmentId}-${s.userStudentId}`,
          student: s,
          assessmentId: a.assessmentId,
          assessmentName: a.assessmentName,
          status: a.status || "notstarted",
          completedAt,
          grade,
          section,
          report: reportMap.get(a.assessmentId)?.get(s.userStudentId) || null,
        });
      }
    }
    return out.sort((x, y) => (x.student.name || "").localeCompare(y.student.name || ""));
  }, [students, sectionLookup, selectedAssessment, search, gradeFilter, sectionFilter, statusFilter, dateFrom, dateTo, reportMap, catalogIds]);

  const gradeOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.grade).filter(Boolean))).sort(),
    [rows]
  );
  const sectionOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.section).filter(Boolean))).sort(),
    [rows]
  );

  const visibleSelected = useMemo(
    () => rows.filter((r) => selectedKeys.has(r.key)),
    [rows, selectedKeys]
  );
  // Send scope: the selection when there is one, else every visible completed row.
  const sendScope = useMemo(
    () => (visibleSelected.length > 0 ? visibleSelected : rows).filter((r) => r.status === "completed"),
    [visibleSelected, rows]
  );

  const toggleRow = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allVisibleChecked = rows.length > 0 && rows.every((r) => selectedKeys.has(r.key));
  const toggleAllVisible = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allVisibleChecked) rows.forEach((r) => next.delete(r.key));
      else rows.forEach((r) => next.add(r.key));
      return next;
    });
  };

  // ── Send one: queue-backed, force=false → existing report is only emailed ──
  const handleSendOne = async (row: Row) => {
    if (sendingKeys.has(row.key)) return;
    setSendingKeys((prev) => new Set(prev).add(row.key));
    try {
      await EnqueueUnifiedReport(row.student.userStudentId, row.assessmentId, undefined, false, "all");
      showSuccessToast(`Queued — ${row.student.name} will receive the report by email.`);
    } catch (e: any) {
      showErrorToast(e?.response?.data?.message || `Failed to queue send for ${row.student.name}`);
    } finally {
      setSendingKeys((prev) => {
        const next = new Set(prev);
        next.delete(row.key);
        return next;
      });
    }
  };

  // ── Bulk send: one Kafka batch per assessment ──
  const handleBulkSend = async () => {
    setConfirmBulk(false);
    if (sendScope.length === 0) return;
    setBulkSending(true);
    try {
      const byAssessment = new Map<number, number[]>();
      for (const r of sendScope) {
        if (!byAssessment.has(r.assessmentId)) byAssessment.set(r.assessmentId, []);
        byAssessment.get(r.assessmentId)!.push(r.student.userStudentId);
      }
      const results = await Promise.allSettled(
        Array.from(byAssessment.entries()).map(([aid, ids]) =>
          EnqueueUnifiedReportsBulk(aid, ids, undefined, false, "all")
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === 0) {
        showSuccessToast(`Queued ${sendScope.length} report emails — the queue delivers them shortly.`);
      } else {
        showErrorToast(`${failed} of ${byAssessment.size} batches failed to queue`);
      }
    } finally {
      setBulkSending(false);
    }
  };

  // ── Zip the already-rendered PDFs in scope (auto-multipart over 300 MB) ──
  const MAX_PART_BYTES = 300 * 1024 * 1024;

  // Direct CDN fetch first; when the bucket CORS policy blocks the browser,
  // fall back to the API's own-bucket proxy (/report-zip/fetch-pdf).
  const fetchPdfBlob = async (url: string): Promise<Blob | null> => {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.blob();
    } catch {
      /* CORS or network — try the proxy */
    }
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/report-zip/fetch-pdf`, {
        params: { url },
        responseType: "blob",
      });
      return res.data as Blob;
    } catch {
      return null;
    }
  };

  const saveBlob = (blob: Blob, name: string) => {
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Delayed revoke — an immediate revoke can cancel the download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(u), 30_000);
  };

  const handleDownloadZip = async () => {
    const scope = (visibleSelected.length > 0 ? visibleSelected : rows).filter(
      (r) => r.report?.pdfUrl
    );
    if (scope.length === 0) {
      showErrorToast("No rendered PDFs in the current selection");
      return;
    }
    setZipping(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      // Hold part 1 back until we know whether a part 2 exists — a single
      // part downloads without any "-partN" suffix.
      let firstPart: ZipPart | null = null;
      const { partCount, added, skipped } = await zipStoredPdfsInParts(
        scope.map((r) => ({
          fileName: `${(r.student.name || "student").replace(/[^\w-]+/g, "_")}-${r.assessmentName.replace(/[^\w-]+/g, "_")}`,
          pdfUrl: r.report!.pdfUrl,
        })),
        MAX_PART_BYTES,
        fetchPdfBlob,
        (part, index) => {
          if (index === 0) {
            firstPart = part;
            return;
          }
          if (firstPart) {
            saveBlob(firstPart.blob, `reports-${stamp}-part1.zip`);
            firstPart = null;
          }
          saveBlob(part.blob, `reports-${stamp}-part${index + 1}.zip`);
        }
      );
      if (firstPart) {
        saveBlob((firstPart as ZipPart).blob, `reports-${stamp}.zip`);
      }
      if (added === 0) {
        showErrorToast("No PDFs could be downloaded — check your connection and try again");
        return;
      }
      showSuccessToast(
        `Downloaded ${added} PDF${added === 1 ? "" : "s"} in ${partCount} ZIP${partCount === 1 ? "" : " parts"}` +
          (skipped.length ? ` (${skipped.length} skipped)` : "")
      );
    } catch {
      showErrorToast("Failed to build the ZIP");
    } finally {
      setZipping(false);
    }
  };

  const selectedAssessmentName =
    selectedAssessment === ""
      ? ""
      : assessmentOptions.find((a) => a.id === Number(selectedAssessment))?.name || "";

  const topBtn = (bg: string, disabled: boolean): React.CSSProperties => ({
    background: disabled ? "#e2e8f0" : bg,
    color: disabled ? "#94a3b8" : "#fff",
    border: "none",
    borderRadius: 10,
    padding: "0 16px",
    height: 38,
    fontWeight: 600,
    fontSize: "0.85rem",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
  });

  return (
    // ph-page = full-bleed: PageHeader's stylesheet lifts Metronic's
    // max-width container for pages carrying this class.
    <div className="ph-page">
      <PageHeader
        title="Report Center"
        subtitle="Preview, download and email assessment reports to students"
      />

      {/* Pickers */}
      <div style={{
        background: "#fff", borderRadius: 16, padding: "18px 22px",
        border: "1px solid #e2e8f0", marginBottom: 14,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label className="form-label fw-bold" style={{ fontSize: "0.8rem", color: "#475569" }}>
              Institute
            </label>
            <SearchableSelect
              value={selectedInstitute === "" ? "" : String(selectedInstitute)}
              onChange={(v: string) => setSelectedInstitute(v === "" ? "" : Number(v))}
              disabled={loadingInstitutes}
              options={[
                { value: "", label: loadingInstitutes ? "Loading…" : "-- Select institute --" },
                ...institutes.map((i: any) => ({
                  value: String(i.instituteCode),
                  label: i.instituteName,
                })),
              ]}
            />
          </div>
          <div>
            <label className="form-label fw-bold" style={{ fontSize: "0.8rem", color: "#475569" }}>
              Assessment
            </label>
            <select
              className="form-select"
              value={selectedAssessment === "" ? "" : String(selectedAssessment)}
              onChange={(e) => {
                setSelectedAssessment(e.target.value === "" ? "" : Number(e.target.value));
                setSelectedKeys(new Set());
              }}
              disabled={selectedInstitute === ""}
              style={{ borderRadius: 10, fontSize: "0.9rem" }}
            >
              <option value="">All assessments</option>
              {assessmentOptions.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filters + actions */}
      {selectedInstitute !== "" && (
        <div style={{
          background: "#fff", borderRadius: 16, padding: "14px 22px",
          border: "1px solid #e2e8f0", marginBottom: 14,
          display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
        }}>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Search name or username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 220, borderRadius: 8 }}
          />
          <select
            className="form-select form-select-sm"
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            style={{ maxWidth: 140, borderRadius: 8 }}
          >
            <option value="">All grades</option>
            {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select
            className="form-select form-select-sm"
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            style={{ maxWidth: 140, borderRadius: 8 }}
          >
            <option value="">All sections</option>
            {sectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            className="form-select form-select-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            style={{ maxWidth: 150, borderRadius: 8 }}
          >
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="ongoing">Ongoing</option>
            <option value="notstarted">Not started</option>
          </select>
          <input
            type="date"
            className="form-control form-control-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="Completed from"
            style={{ maxWidth: 150, borderRadius: 8 }}
          />
          <input
            type="date"
            className="form-control form-control-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="Completed to"
            style={{ maxWidth: 150, borderRadius: 8 }}
          />

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              style={topBtn("linear-gradient(135deg, #10b981 0%, #059669 100%)", bulkSending || sendScope.length === 0)}
              disabled={bulkSending || sendScope.length === 0}
              onClick={() => setConfirmBulk(true)}
              title="Email the report to every student in scope (selection, or all filtered) — queued, one batch per assessment"
            >
              {bulkSending ? (
                <><span className="spinner-border spinner-border-sm" /> Queueing…</>
              ) : (
                <><i className="bi bi-send" /> Send All ({sendScope.length})</>
              )}
            </button>
            <button
              style={topBtn("linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", zipping)}
              disabled={zipping}
              onClick={handleDownloadZip}
              title="Download the rendered PDFs in scope as a ZIP"
            >
              {zipping ? (
                <><span className="spinner-border spinner-border-sm" /> Zipping…</>
              ) : (
                <><i className="bi bi-file-zip" /> Download ZIP</>
              )}
            </button>
            <button
              style={topBtn("linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", selectedAssessment === "")}
              disabled={selectedAssessment === ""}
              onClick={() => setGenerateOpen(true)}
              title={selectedAssessment === "" ? "Pick a specific assessment to generate" : "Generate reports (queue)"}
            >
              <i className="bi bi-gear" /> Generate
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        {selectedInstitute === "" ? (
          <div style={{ padding: "56px 24px", textAlign: "center", color: "#94a3b8" }}>
            Select an institute to begin.
          </div>
        ) : studentsLoading ? (
          <div style={{ padding: "56px 24px", textAlign: "center" }}>
            <div className="spinner-border text-primary" />
            <p className="mt-3 text-muted">Loading students…</p>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "56px 24px", textAlign: "center", color: "#94a3b8" }}>
            No students match the current filters.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table mb-0" style={{ fontSize: "0.86rem" }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <th style={{ padding: "10px 12px", width: 36 }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={allVisibleChecked}
                      onChange={toggleAllVisible}
                    />
                  </th>
                  <th style={{ padding: "10px 12px" }}>Name</th>
                  <th style={{ padding: "10px 12px" }}>Username</th>
                  {selectedAssessment === "" && <th style={{ padding: "10px 12px" }}>Assessment</th>}
                  <th style={{ padding: "10px 12px" }}>Grade</th>
                  <th style={{ padding: "10px 12px" }}>Section</th>
                  <th style={{ padding: "10px 12px" }}>Status</th>
                  <th style={{ padding: "10px 12px" }}>Completed on</th>
                  <th style={{ padding: "10px 12px" }}>Report</th>
                  <th style={{ padding: "10px 12px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const b = statusBadge(r.status);
                  const hasPdf = !!r.report?.pdfUrl;
                  const hasReport = hasPdf || !!r.report?.reportUrl;
                  const sending = sendingKeys.has(r.key);
                  return (
                    <tr key={r.key} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 12px" }}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selectedKeys.has(r.key)}
                          onChange={() => toggleRow(r.key)}
                        />
                      </td>
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: "#111827" }}>
                        {r.student.name || "Unnamed"}
                      </td>
                      <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: "0.8rem" }}>
                        {r.student.username || "—"}
                      </td>
                      {selectedAssessment === "" && (
                        <td style={{ padding: "8px 12px" }}>{r.assessmentName}</td>
                      )}
                      <td style={{ padding: "8px 12px" }}>{r.grade || "—"}</td>
                      <td style={{ padding: "8px 12px" }}>{r.section || "—"}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{
                          background: b.bg, color: b.fg, borderRadius: 999,
                          padding: "2px 10px", fontSize: "0.74rem", fontWeight: 600,
                        }}>
                          {b.label}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px" }}>{fmtDate(r.completedAt)}</td>
                      <td style={{ padding: "8px 12px" }}>
                        {reportsLoading ? (
                          <span className="text-muted">…</span>
                        ) : hasPdf ? (
                          <span style={{ color: "#059669", fontWeight: 600, fontSize: "0.78rem" }}>PDF ready</span>
                        ) : hasReport ? (
                          <span style={{ color: "#d97706", fontWeight: 600, fontSize: "0.78rem" }}>Generated</span>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "0.78rem" }}>Not generated</span>
                        )}
                      </td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                        <button
                          className="btn btn-sm btn-light"
                          disabled={!hasReport}
                          title="Preview report"
                          onClick={() => window.open(r.report!.reportUrl || r.report!.pdfUrl || "", "_blank")}
                          style={{ marginRight: 6 }}
                        >
                          <i className="bi bi-eye" />
                        </button>
                        <button
                          className="btn btn-sm btn-light"
                          disabled={!hasPdf}
                          title="Download PDF"
                          onClick={() => window.open(r.report!.pdfUrl || "", "_blank")}
                          style={{ marginRight: 6 }}
                        >
                          <i className="bi bi-download" />
                        </button>
                        <button
                          className="btn btn-sm"
                          disabled={r.status !== "completed" || sending}
                          title={
                            r.status !== "completed"
                              ? "Assessment not completed yet"
                              : "Email the report to this student (fixed template, PDF + link)"
                          }
                          onClick={() => handleSendOne(r)}
                          style={{
                            background: r.status === "completed" ? "#ecfdf5" : "#f1f5f9",
                            color: r.status === "completed" ? "#059669" : "#94a3b8",
                            border: "1px solid #d1fae5",
                          }}
                        >
                          {sending ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-send" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk send confirmation */}
      {confirmBulk && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 10050, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setConfirmBulk(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 16, padding: "24px 28px", maxWidth: 440, width: "92%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h5 style={{ fontWeight: 700, marginBottom: 10 }}>Send {sendScope.length} report emails?</h5>
            <p style={{ fontSize: "0.86rem", color: "#4a5568" }}>
              {visibleSelected.length > 0
                ? `The ${sendScope.length} selected completed students`
                : `All ${sendScope.length} completed students in the current filter`}{" "}
              will be emailed their report (fixed template with the PDF and link).
              Delivery runs through the report queue — already-generated reports
              are not regenerated, missing ones are generated first.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn btn-sm btn-light" onClick={() => setConfirmBulk(false)}>Cancel</button>
              <button
                className="btn btn-sm"
                onClick={handleBulkSend}
                style={{ background: "#059669", color: "#fff", border: "none", fontWeight: 600 }}
              >
                Queue {sendScope.length} emails
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate modal (queue-backed) — needs a specific assessment */}
      {selectedAssessment !== "" && (
        <GenerateQueueModal
          open={generateOpen}
          onClose={() => setGenerateOpen(false)}
          assessmentId={Number(selectedAssessment)}
          assessmentName={selectedAssessmentName}
          templates={templates}
          initialTemplateId={templates.find((t) => t.isDefault)?.template.reportTemplateId ?? ""}
          students={(visibleSelected.length > 0 ? visibleSelected : rows)
            .filter((r) => r.status === "completed")
            .map((r) => ({
              userStudentId: r.student.userStudentId,
              name: r.student.name || "Unnamed",
              username: r.student.username,
            }))}
          onGenerated={refreshReports}
        />
      )}
    </div>
  );
};

export default ReportCenterPage;
