import React, { useState, useEffect, useMemo, useCallback } from "react";
import { showErrorToast, showSuccessToast } from "../../utils/toast";
import { downloadReportAsPdf, downloadReportsAsZip, ZipProgress } from "../ReportGeneration/utils/htmlToPdf";
import {
  getStudentsWithMappingByInstituteId,
  Assessment,
} from "../StudentInformation/StudentInfo_APIs";
import { GetSessionsByInstituteCode } from "../College/API/College_APIs";
import { getAssessmentMappingsByInstitute } from "../AssessmentMapping/API/AssessmentMapping_APIs";
import {
  getReportType,
  generateDataForAssessment,
  getReportDataByAssessment,
  generateReportsForAssessment,
  downloadReport,
  getReportUrls,
  exportReportExcel,
  exportOMR,
  exportOMRStudent,
  ReportType,
} from "./API/UnifiedReport_APIs";
import { createOrUpdateGeneratedReport } from "../ReportGeneration/API/GeneratedReport_APIs";

// ═══════════════════════ TYPES ═══════════════════════

type StudentRow = {
  userStudentId: number;
  name: string;
  username?: string;
  schoolRollNumber?: string;
  controlNumber?: number;
  phoneNumber?: string;
  studentDob?: string;
  schoolSectionId?: number;
  assessments?: { assessmentId: number; assessmentName: string; status: string }[];
  assignedAssessmentIds?: number[];
};

type SectionInfo = { className: string; sectionName: string };

type ReportData = {
  userStudent?: { userStudentId: number };
  reportStatus: string;
  reportUrl?: string | null;
  eligible?: boolean;
  eligibilityIssues?: string | null;
  [key: string]: any;
};

type Props = {
  instituteCode: number;
  instituteName: string;
  assessment: Assessment;
};

// ═══════════════════════ COMPONENT ═══════════════════════

const SingleAssessmentView: React.FC<Props> = ({ instituteCode, instituteName, assessment }) => {
  const reportType: ReportType = getReportType(assessment);
  const isBet = reportType === "bet";
  const accentColor = isBet ? "#4361ee" : "#0d9488";

  // ── Students ──
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sectionLookup, setSectionLookup] = useState<Map<number, SectionInfo>>(new Map());
  const [studentsLoading, setStudentsLoading] = useState(false);

  // ── Report data ──
  const [reportDataMap, setReportDataMap] = useState<Map<number, ReportData>>(new Map());
  const [reportDataLoading, setReportDataLoading] = useState(false);

  // ── Selection + pagination ──
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ── Filters ──
  const [nameQuery, setNameQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  // ── Loading ──
  const [generating, setGenerating] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<ZipProgress | null>(null);
  const [exportingOMR, setExportingOMR] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloadingStudentId, setDownloadingStudentId] = useState<number | null>(null);

  // ═══════════════════════ DATA LOADING ═══════════════════════

  useEffect(() => {
    setStudentsLoading(true);
    Promise.all([
      getStudentsWithMappingByInstituteId(instituteCode),
      GetSessionsByInstituteCode(instituteCode),
    ])
      .then(([studentsRes, sessionsRes]) => {
        setStudents(studentsRes.data || []);
        const lookup = new Map<number, SectionInfo>();
        for (const session of sessionsRes.data || []) {
          for (const cls of session.schoolClasses || []) {
            for (const sec of cls.schoolSections || []) {
              if (!lookup.has(sec.id)) lookup.set(sec.id, { className: cls.className, sectionName: sec.sectionName });
            }
          }
        }
        setSectionLookup(lookup);
      })
      .catch(() => { setStudents([]); setSectionLookup(new Map()); })
      .finally(() => setStudentsLoading(false));
  }, [instituteCode]);

  const refreshReportData = useCallback(async (): Promise<Map<number, ReportData>> => {
    setReportDataLoading(true);
    try {
      const res = await getReportDataByAssessment(assessment);
      const map = new Map<number, ReportData>();
      for (const r of res.data || []) {
        const id = r.userStudent?.userStudentId;
        if (id) map.set(id, r);
      }
      setReportDataMap(map);
      return map;
    } catch {
      setReportDataMap(new Map());
      return new Map();
    } finally {
      setReportDataLoading(false);
    }
  }, [assessment]);

  useEffect(() => { refreshReportData(); }, [refreshReportData]);

  // ═══════════════════════ FILTERING ═══════════════════════

  const assessmentStudents = useMemo(() => {
    return students.filter((s) => (s.assignedAssessmentIds || []).includes(assessment.id));
  }, [students, assessment.id]);

  const uniqueGrades = useMemo(() => {
    const g = new Set<string>();
    for (const s of assessmentStudents) {
      const info = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined;
      if (info?.className) g.add(info.className);
    }
    return Array.from(g).sort();
  }, [assessmentStudents, sectionLookup]);

  const uniqueSections = useMemo(() => {
    const sec = new Set<string>();
    for (const s of assessmentStudents) {
      const info = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined;
      if (info?.sectionName) sec.add(info.sectionName);
    }
    return Array.from(sec).sort();
  }, [assessmentStudents, sectionLookup]);

  const displayedStudents = useMemo(() => {
    let result = assessmentStudents;
    if (nameQuery.trim()) {
      const q = nameQuery.toLowerCase();
      result = result.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.username || "").toLowerCase().includes(q) ||
        (s.schoolRollNumber || "").toLowerCase().includes(q)
      );
    }
    if (selectedGrade) result = result.filter((s) => sectionLookup.get(s.schoolSectionId!)?.className === selectedGrade);
    if (selectedSection) result = result.filter((s) => sectionLookup.get(s.schoolSectionId!)?.sectionName === selectedSection);
    return result;
  }, [assessmentStudents, nameQuery, selectedGrade, selectedSection, sectionLookup]);

  const totalPages = Math.max(1, Math.ceil(displayedStudents.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedStudents = useMemo(
    () => displayedStudents.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize),
    [displayedStudents, safeCurrentPage, pageSize]
  );

  useEffect(() => { setCurrentPage(1); }, [nameQuery, selectedGrade, selectedSection]);

  // ═══════════════════════ HELPERS ═══════════════════════

  const getSelectedOrAllIds = () => {
    const visibleIds = new Set(displayedStudents.map((s) => s.userStudentId));
    const sel = Array.from(selectedStudentIds).filter((id) => visibleIds.has(id));
    return sel.length > 0 ? sel : displayedStudents.map((s) => s.userStudentId);
  };

  const visibleSelectedCount = useMemo(() => {
    const vis = new Set(displayedStudents.map((s) => s.userStudentId));
    return Array.from(selectedStudentIds).filter((id) => vis.has(id)).length;
  }, [selectedStudentIds, displayedStudents]);

  const countLabel = (n: number) => visibleSelectedCount > 0 ? ` (${visibleSelectedCount})` : ` (All ${n})`;

  const reportStats = useMemo(() => {
    let generated = 0, notGenerated = 0, hasData = 0;
    for (const s of displayedStudents) {
      const rd = reportDataMap.get(s.userStudentId);
      if (rd) { hasData++; if (rd.reportStatus === "generated") generated++; else notGenerated++; }
      else { notGenerated++; }
    }
    return { generated, notGenerated, hasData };
  }, [displayedStudents, reportDataMap]);

  const downloadBlob = (data: any, filename: string) => {
    const url = window.URL.createObjectURL(new Blob([data]));
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
  };

  // ═══════════════════════ COMBINED GENERATE ═══════════════════════

  const handleGenerate = async () => {
    let ids = getSelectedOrAllIds();
    if (ids.length === 0) return;
    setGenerating(true);

    try {
      // Step 1: Generate data
      const dataRes = await generateDataForAssessment(assessment, ids);
      const dataGenerated = dataRes.data.generated || 0;
      const dataErrors = dataRes.data.errors || [];

      // Refresh from DB to get the actual persisted state (React state is async, can't rely on it)
      const freshMap = await refreshReportData();

      // Only pass students who actually have data in the DB to report generation
      let reportIds = ids.filter((id) => freshMap.has(id));

      // For Navigator, also filter by eligibility
      if (!isBet) {
        reportIds = reportIds.filter((id) => {
          const rd = freshMap.get(id);
          return rd && rd.eligible !== false;
        });
      }

      if (reportIds.length === 0) {
        const errCount = dataErrors.length;
        showSuccessToast(`Generated data for ${dataGenerated} student(s).${errCount > 0 ? ` ${errCount} skipped.` : ""} No eligible students for report generation.`);
        setGenerating(false);
        return;
      }

      const reportRes = await generateReportsForAssessment(assessment, reportIds);
      const reportsGenerated = reportRes.data.generated || 0;
      const reportErrors = reportRes.data.errors || [];

      // Sync to centralized table
      const successReports = (reportRes.data.reports || []).filter((r: any) => r.reportUrl);
      for (const r of successReports) {
        createOrUpdateGeneratedReport({
          userStudentId: r.userStudentId,
          assessmentId: assessment.id,
          typeOfReport: reportType,
          reportStatus: "generated",
          reportUrl: r.reportUrl,
        }).catch(() => {});
      }

      // Handle fallback downloads
      const fallbacks = (reportRes.data.reports || []).filter((r: any) => r.downloadFallback);
      for (const fb of fallbacks) {
        const a = document.createElement("a");
        a.href = fb.reportUrl;
        a.download = fb.fileName || `report_${fb.userStudentId}.html`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }

      const allErrors = [...dataErrors, ...reportErrors];
      const errMsg = allErrors.length > 0 ? `\n${allErrors.length} error(s).` : "";
      showSuccessToast(`Data: ${dataGenerated} | Reports: ${reportsGenerated}${errMsg}`);
      await refreshReportData();
    } catch (err: any) {
      showErrorToast("Failed: " + (err?.response?.data?.error || err.message));
    } finally {
      setGenerating(false);
    }
  };

  // ═══════════════════════ STYLES ═══════════════════════

  const thStyle: React.CSSProperties = { padding: "10px 14px", fontWeight: 600, color: "#1a1a2e", borderBottom: "2px solid #e0e0e0", whiteSpace: "nowrap", fontSize: "0.85rem" };
  const tdStyle: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid #f0f0f0", whiteSpace: "nowrap", fontSize: "0.85rem" };
  const statusBadge = (bg: string, color: string, text: string) => (
    <span style={{ background: bg, color, padding: "3px 10px", borderRadius: 6, fontWeight: 600, fontSize: "0.75rem" }}>{text}</span>
  );
  const badge = (bg: string, text: string) => (
    <span style={{ background: bg, color: "#fff", padding: "4px 12px", borderRadius: 16, fontSize: "0.8rem", fontWeight: 600 }}>{text}</span>
  );

  // ═══════════════════════ RENDER ═══════════════════════

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ padding: 24 }}>
        {/* Summary bar */}
        <div style={{ padding: "12px 20px", background: accentColor + "10", borderRadius: 10, display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: accentColor }}>{instituteName}</span>
          <span style={{ color: "#cbd5e1" }}>/</span>
          <span style={{ fontWeight: 600, color: "#1e293b" }}>{assessment.assessmentName}</span>
          <span style={{
            background: isBet ? "#4361ee18" : "#0d948818",
            color: isBet ? "#4361ee" : "#0d9488",
            padding: "2px 10px", borderRadius: 6, fontWeight: 700, fontSize: "0.75rem",
          }}>{reportType.toUpperCase()}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {badge(accentColor, `${assessmentStudents.length} students`)}
            {badge("#4361ee", `${reportStats.generated} reports`)}
          </div>
        </div>

        {studentsLoading || reportDataLoading ? (
          <div style={{ color: "#9ca3af", padding: 24 }}>Loading...</div>
        ) : (
          <>
            {/* Filters */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 200px", minWidth: 180 }}>
                <label style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Search</label>
                <input className="form-control form-control-sm form-control-solid" placeholder="Name, roll no..."
                  value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} />
              </div>
              <div style={{ minWidth: 140 }}>
                <label style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Grade / Class</label>
                <select className="form-select form-select-sm form-select-solid" value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}>
                  <option value="">All</option>
                  {uniqueGrades.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 140 }}>
                <label style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Section</label>
                <select className="form-select form-select-sm form-select-solid" value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}>
                  <option value="">All</option>
                  {uniqueSections.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Action bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                {displayedStudents.length} student(s)
                {visibleSelectedCount > 0 && <span style={{ fontWeight: 600, color: accentColor, marginLeft: 8 }}>({visibleSelectedCount} selected)</span>}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-sm" disabled={displayedStudents.length === 0 || generating}
                  style={{
                    background: generating ? "#6c757d" : `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
                    border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 600, color: "white", fontSize: "0.85rem",
                  }}
                  onClick={handleGenerate}>
                  {generating ? "Generating..." : `Generate${countLabel(displayedStudents.length)}`}
                </button>

                <button className="btn btn-sm" disabled={downloadingZip || reportStats.generated === 0}
                  style={{
                    background: downloadingZip ? "#6c757d" : "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
                    border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 600, color: "white", fontSize: "0.85rem",
                  }}
                  onClick={async () => {
                    let ids = getSelectedOrAllIds().filter((id) => {
                      const rd = reportDataMap.get(id);
                      return rd && rd.reportStatus === "generated" && rd.reportUrl;
                    });
                    if (ids.length === 0) { showErrorToast("No generated reports to download."); return; }
                    setDownloadingZip(true); setZipProgress(null);
                    try {
                      const res = await getReportUrls(assessment, ids);
                      const studs = res.data.reports.map((r: any) => ({ userStudentId: r.userStudentId, fileName: r.fileName }));
                      await downloadReportsAsZip(
                        studs,
                        `${reportType}_reports_${assessment.id}.zip`,
                        (uid) => downloadReport(assessment, uid),
                        (p) => setZipProgress(p),
                      );
                    } catch (err: any) { showErrorToast("Download failed: " + (err?.response?.data?.error || err.message)); }
                    finally { setDownloadingZip(false); setZipProgress(null); }
                  }}>
                  {downloadingZip ? "Preparing ZIP..." : `Download ZIP`}
                </button>

                <button className="btn btn-sm btn-outline-secondary" disabled={exporting}
                  onClick={async () => {
                    setExporting(true);
                    try {
                      const res = await exportReportExcel(assessment);
                      downloadBlob(res.data, `${reportType}_data_${assessment.id}.xlsx`);
                    } catch (err: any) { showErrorToast("Export failed"); }
                    finally { setExporting(false); }
                  }}>
                  {exporting ? "..." : "Export XLSX"}
                </button>
              </div>
            </div>

            {/* ZIP progress */}
            {zipProgress && (
              <div style={{ marginBottom: 12, padding: "8px 16px", background: "#f0f4ff", borderRadius: 8, fontSize: "0.8rem", color: "#4361ee" }}>
                {zipProgress.phase === "fetching" && `Fetching report ${zipProgress.current}/${zipProgress.total}...`}
                {zipProgress.phase === "converting" && `Converting ${zipProgress.current}/${zipProgress.total}...`}
                {zipProgress.phase === "zipping" && "Creating ZIP..."}
              </div>
            )}

            {/* Table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={thStyle}>
                      <input type="checkbox"
                        checked={displayedStudents.length > 0 && selectedStudentIds.size >= displayedStudents.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedStudentIds(new Set(displayedStudents.map((s) => s.userStudentId)));
                          else setSelectedStudentIds(new Set());
                        }} />
                    </th>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Grade</th>
                    <th style={thStyle}>Section</th>
                    <th style={thStyle}>Assessment Status</th>
                    <th style={thStyle}>Report</th>
                    <th style={thStyle}>Preview / Download</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.map((s, idx) => {
                    const sectionInfo = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined;
                    const asmtStatus = (s.assessments || []).find((a) => a.assessmentId === assessment.id)?.status || "notstarted";
                    const rd = reportDataMap.get(s.userStudentId);
                    const reportStatus = rd?.reportStatus || "notGenerated";
                    const reportUrl = rd?.reportUrl || null;

                    const asc = asmtStatus === "completed" ? { bg: "#dcfce7", color: "#059669" }
                      : asmtStatus === "ongoing" ? { bg: "#dbeafe", color: "#2563eb" }
                      : { bg: "#fef3c7", color: "#d97706" };
                    const rsc = reportStatus === "generated" ? { bg: "#dcfce7", color: "#059669" } : { bg: "#fef3c7", color: "#d97706" };

                    return (
                      <tr key={s.userStudentId} style={{ background: selectedStudentIds.has(s.userStudentId) ? accentColor + "08" : undefined }}>
                        <td style={tdStyle}>
                          <input type="checkbox" checked={selectedStudentIds.has(s.userStudentId)}
                            onChange={(e) => {
                              const next = new Set(selectedStudentIds);
                              if (e.target.checked) next.add(s.userStudentId); else next.delete(s.userStudentId);
                              setSelectedStudentIds(next);
                            }} />
                        </td>
                        <td style={tdStyle}>{(safeCurrentPage - 1) * pageSize + idx + 1}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{s.name}</td>
                        <td style={tdStyle}>{sectionInfo?.className || "-"}</td>
                        <td style={tdStyle}>{sectionInfo?.sectionName || "-"}</td>
                        <td style={tdStyle}>{statusBadge(asc.bg, asc.color, asmtStatus)}</td>
                        <td style={tdStyle}>{statusBadge(rsc.bg, rsc.color, reportStatus === "generated" ? "Generated" : "Not Generated")}</td>
                        <td style={tdStyle}>
                          {reportUrl ? (
                            <div style={{ display: "flex", gap: 4 }}>
                              <a href={reportUrl} target="_blank" rel="noopener noreferrer"
                                style={{ padding: "3px 10px", borderRadius: 6, fontSize: "0.75rem", fontWeight: 600, background: "#dbeafe", color: "#2563eb", textDecoration: "none" }}>
                                Preview
                              </a>
                              <button
                                disabled={downloadingStudentId === s.userStudentId}
                                style={{
                                  padding: "3px 10px", borderRadius: 6, fontSize: "0.75rem", fontWeight: 600,
                                  background: downloadingStudentId === s.userStudentId ? "#d1d5db" : "#f0fdf4",
                                  color: downloadingStudentId === s.userStudentId ? "#6b7280" : "#059669",
                                  border: "none", cursor: downloadingStudentId === s.userStudentId ? "not-allowed" : "pointer",
                                }}
                                onClick={async () => {
                                  setDownloadingStudentId(s.userStudentId);
                                  try {
                                    const safeName = (s.name || "student").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
                                    const reportLabel = isBet ? "BET_Report" : "Career_Navigator";
                                    await downloadReportAsPdf(
                                      () => downloadReport(assessment, s.userStudentId),
                                      `${safeName}_${reportLabel}.pdf`
                                    );
                                  } catch { showErrorToast("Download failed"); }
                                  finally { setDownloadingStudentId(null); }
                                }}>
                                {downloadingStudentId === s.userStudentId ? "Downloading..." : "Download"}
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: "#d1d5db", fontSize: "0.75rem" }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedStudents.length === 0 && (
                    <tr><td colSpan={9} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", padding: 32 }}>No students found</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <select className="form-select form-select-sm form-select-solid" value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    style={{ width: 80 }}>
                    {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>per page</span>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="btn btn-sm btn-outline-secondary" disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage(safeCurrentPage - 1)}>&lt;</button>
                  <span style={{ padding: "4px 12px", fontSize: "0.85rem", color: "#374151" }}>
                    {safeCurrentPage} / {totalPages}
                  </span>
                  <button className="btn btn-sm btn-outline-secondary" disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage(safeCurrentPage + 1)}>&gt;</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SingleAssessmentView;
