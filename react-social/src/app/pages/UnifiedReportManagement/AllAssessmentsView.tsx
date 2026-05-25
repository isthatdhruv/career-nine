import React, { useState, useEffect, useMemo, useCallback } from "react";
import { showErrorToast, showSuccessToast } from "../../utils/toast";
import {
  getStudentsWithMappingByInstituteId,
  Assessment,
} from "../StudentInformation/StudentInfo_APIs";
import { GetSessionsByInstituteCode } from "../College/API/College_APIs";
import { downloadReportAsPdf } from "../ReportGeneration/utils/htmlToPdf";
import {
  getReportType,
  generateDataForAssessment,
  generateReportsForAssessment,
  downloadReport as downloadReportApi,
} from "./API/UnifiedReport_APIs";
import {
  generateAllReportsOneClick,
  getGeneratedReportsByStudent,
  GeneratedReport,
} from "../ReportGeneration/API/GeneratedReport_APIs";

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

type Props = {
  instituteCode: number;
  instituteName: string;
  assessments: Assessment[];
};

// ═══════════════════════ COMPONENT ═══════════════════════

const AllAssessmentsView: React.FC<Props> = ({ instituteCode, instituteName, assessments }) => {
  const accentColor = "#6366f1"; // indigo for unified

  // ── Students ──
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sectionLookup, setSectionLookup] = useState<Map<number, SectionInfo>>(new Map());
  const [studentsLoading, setStudentsLoading] = useState(false);

  // ── Generated reports ──
  const [reportsMap, setReportsMap] = useState<Map<number, GeneratedReport[]>>(new Map());
  const [reportsLoading, setReportsLoading] = useState(false);

  // ── Selection + pagination ──
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ── Filters ──
  const [nameQuery, setNameQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");

  // ── Loading states ──
  const [generating, setGenerating] = useState(false);
  const [oneClickStudentId, setOneClickStudentId] = useState<number | null>(null);
  const [downloadingReportId, setDownloadingReportId] = useState<number | null>(null);

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

  // Load generated reports for visible students
  const loadReports = useCallback(async (studentIds: number[]) => {
    if (studentIds.length === 0) return;
    setReportsLoading(true);
    try {
      const newMap = new Map(reportsMap);
      // Load in batches of 20
      for (let i = 0; i < studentIds.length; i += 20) {
        const batch = studentIds.slice(i, i + 20);
        const results = await Promise.all(
          batch.map((id) => getGeneratedReportsByStudent(id).then((r) => ({ id, data: r.data })).catch(() => ({ id, data: [] as GeneratedReport[] })))
        );
        for (const { id, data } of results) {
          newMap.set(id, data);
        }
      }
      setReportsMap(newMap);
    } finally {
      setReportsLoading(false);
    }
  }, [reportsMap]);

  // Load reports when students load
  useEffect(() => {
    if (students.length === 0) return;
    const ids = students.map((s) => s.userStudentId);
    loadReports(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students]);

  // ═══════════════════════ FILTERING ═══════════════════════

  // Students who have at least one of the mapped assessments assigned
  const relevantStudents = useMemo(() => {
    const assessmentIds = new Set(assessments.map((a) => a.id));
    return students.filter((s) =>
      (s.assignedAssessmentIds || []).some((id) => assessmentIds.has(id))
    );
  }, [students, assessments]);

  const uniqueGrades = useMemo(() => {
    const g = new Set<string>();
    for (const s of relevantStudents) {
      const info = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined;
      if (info?.className) g.add(info.className);
    }
    return Array.from(g).sort();
  }, [relevantStudents, sectionLookup]);

  const displayedStudents = useMemo(() => {
    let result = relevantStudents;
    if (nameQuery.trim()) {
      const q = nameQuery.toLowerCase();
      result = result.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.username || "").toLowerCase().includes(q) ||
        (s.schoolRollNumber || "").toLowerCase().includes(q)
      );
    }
    if (selectedGrade) {
      result = result.filter((s) => sectionLookup.get(s.schoolSectionId!)?.className === selectedGrade);
    }
    return result;
  }, [relevantStudents, nameQuery, selectedGrade, sectionLookup]);

  const totalPages = Math.max(1, Math.ceil(displayedStudents.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedStudents = useMemo(
    () => displayedStudents.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize),
    [displayedStudents, safeCurrentPage, pageSize]
  );

  useEffect(() => { setCurrentPage(1); }, [nameQuery, selectedGrade]);

  // ═══════════��═══════════ HELPERS ═══════════════════════

  const getSelectedOrAllIds = () => {
    const visibleIds = new Set(displayedStudents.map((s) => s.userStudentId));
    const sel = Array.from(selectedStudentIds).filter((id) => visibleIds.has(id));
    return sel.length > 0 ? sel : displayedStudents.map((s) => s.userStudentId);
  };

  const getStudentAssessmentStatus = (student: StudentRow, assessmentId: number) => {
    const a = (student.assessments || []).find((a) => a.assessmentId === assessmentId);
    return a?.status || "notstarted";
  };

  const getStudentReportCount = (studentId: number) => {
    const student = students.find((s) => s.userStudentId === studentId);
    const completedCount = assessments.filter((a) => {
      const status = student ? getStudentAssessmentStatus(student, a.id) : "notstarted";
      return status === "completed";
    }).length;
    const reports = reportsMap.get(studentId) || [];
    const generated = reports.filter((r) => r.reportStatus === "generated").length;
    return { generated, total: completedCount };
  };

  const visibleSelectedCount = useMemo(() => {
    const vis = new Set(displayedStudents.map((s) => s.userStudentId));
    return Array.from(selectedStudentIds).filter((id) => vis.has(id)).length;
  }, [selectedStudentIds, displayedStudents]);

  const countLabel = (n: number) => visibleSelectedCount > 0 ? ` (${visibleSelectedCount})` : ` (All ${n})`;

  // ═══════════════════════ COMBINED GENERATE (DATA + REPORTS) ═══════════════════════

  const handleGenerate = async () => {
    const ids = getSelectedOrAllIds();
    if (ids.length === 0) return;
    setGenerating(true);
    let totalDataGenerated = 0;
    let totalReportsGenerated = 0;
    const allErrors: string[] = [];

    try {
      for (const assessment of assessments) {
        // Step 1: Generate data — only for completed & assigned students
        const dataIds = ids.filter((id) => {
          const s = students.find((s) => s.userStudentId === id);
          if (!s) return false;
          const status = getStudentAssessmentStatus(s, assessment.id);
          return status === "completed" && (s.assignedAssessmentIds || []).includes(assessment.id);
        });

        if (dataIds.length === 0) continue;

        let successDataIds: number[] = [];
        try {
          const dataRes = await generateDataForAssessment(assessment, dataIds);
          totalDataGenerated += dataRes.data.generated || 0;
          // Use the actual saved records to determine which students succeeded
          const savedIds = new Set<number>(
            (dataRes.data.data || []).map((d: any) => d.userStudent?.userStudentId).filter(Boolean)
          );
          successDataIds = savedIds.size > 0
            ? dataIds.filter((id) => savedIds.has(id))
            : []; // if no saved records returned, don't attempt report generation
          for (const err of dataRes.data.errors || []) {
            allErrors.push(`${assessment.assessmentName} [data]: Student ${err.userStudentId} - ${err.reason}`);
          }
        } catch (err: any) {
          allErrors.push(`${assessment.assessmentName} [data]: ${err?.response?.data?.error || err.message}`);
          continue; // skip report generation if data call itself failed
        }

        // Step 2: Generate reports only for students whose data succeeded
        if (successDataIds.length === 0) continue;
        try {
          const reportRes = await generateReportsForAssessment(assessment, successDataIds);
          totalReportsGenerated += reportRes.data.generated || 0;
          for (const err of reportRes.data.errors || []) {
            allErrors.push(`${assessment.assessmentName} [report]: Student ${err.userStudentId} - ${err.reason}`);
          }
        } catch (err: any) {
          allErrors.push(`${assessment.assessmentName} [report]: ${err?.response?.data?.error || err.message}`);
        }
      }

      const errMsg = allErrors.length > 0 ? `\n${allErrors.length} error(s).` : "";
      showSuccessToast(`Data: ${totalDataGenerated} | Reports: ${totalReportsGenerated}${errMsg}`);
      await loadReports(ids);
    } catch (err: any) {
      showErrorToast("Failed: " + (err?.response?.data?.error || err.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleOneClick = async (userStudentId: number) => {
    setOneClickStudentId(userStudentId);
    try {
      const res = await generateAllReportsOneClick(userStudentId);
      const { generated, errors } = res.data;
      if (generated > 0) {
        showSuccessToast(`Generated ${generated} report(s) for this student.`);
      }
      if (errors.length > 0) {
        showErrorToast(`${errors.length} error(s): ${errors.map((e: any) => e.reason).join(", ")}`);
      }
      // Refresh this student's reports
      await loadReports([userStudentId]);
    } catch (err: any) {
      showErrorToast("Failed: " + (err?.response?.data?.error || err.message));
    } finally {
      setOneClickStudentId(null);
    }
  };

  // ═══════════════════════ STYLES ═══════════════════════

  const thStyle: React.CSSProperties = { padding: "10px 14px", fontWeight: 600, color: "#1a1a2e", borderBottom: "2px solid #e0e0e0", whiteSpace: "nowrap", fontSize: "0.8rem" };
  const tdStyle: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid #f0f0f0", whiteSpace: "nowrap", fontSize: "0.8rem" };
  const statusBadge = (bg: string, color: string, text: string) => (
    <span style={{ background: bg, color, padding: "2px 8px", borderRadius: 6, fontWeight: 600, fontSize: "0.7rem" }}>{text}</span>
  );

  const statusColors: Record<string, { bg: string; color: string }> = {
    completed: { bg: "#dcfce7", color: "#059669" },
    ongoing: { bg: "#dbeafe", color: "#2563eb" },
    notstarted: { bg: "#fef3c7", color: "#d97706" },
  };

  // ═══════════════════════ RENDER ═══════════════════════

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ padding: 24 }}>
        {/* Summary */}
        <div style={{ padding: "12px 20px", background: accentColor + "10", borderRadius: 10, display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: accentColor }}>{instituteName}</span>
          <span style={{ color: "#cbd5e1" }}>/</span>
          <span style={{ fontWeight: 600, color: "#1e293b" }}>All Assessments ({assessments.length})</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <span style={{ background: accentColor, color: "#fff", padding: "4px 12px", borderRadius: 16, fontSize: "0.8rem", fontWeight: 600 }}>
              {relevantStudents.length} students
            </span>
          </div>
        </div>

        {studentsLoading ? (
          <div style={{ color: "#9ca3af", padding: 24 }}>Loading students...</div>
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
                  {generating ? "Generating..." : `Generate All${countLabel(displayedStudents.length)}`}
                </button>
              </div>
            </div>

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
                        }}
                      />
                    </th>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Grade</th>
                    {assessments.map((a) => (
                      <th key={a.id} style={{ ...thStyle, fontSize: "0.7rem", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}
                        title={`${a.assessmentName} [${getReportType(a).toUpperCase()}]`}>
                        {a.assessmentName.length > 12 ? a.assessmentName.slice(0, 12) + "..." : a.assessmentName}
                        <br />
                        <span style={{ fontSize: "0.6rem", color: getReportType(a) === "bet" ? "#4361ee" : "#0d9488", fontWeight: 700 }}>
                          {getReportType(a).toUpperCase()}
                        </span>
                      </th>
                    ))}
                    <th style={thStyle}>Reports</th>
                    <th style={thStyle}>Actions</th>
                    <th style={thStyle}>Preview / Download</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.map((s, idx) => {
                    const sectionInfo = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined;
                    const { generated, total } = getStudentReportCount(s.userStudentId);
                    const reportColor = generated === total && generated > 0 ? "#059669" : generated > 0 ? "#d97706" : "#dc2626";

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
                        {assessments.map((a) => {
                          const status = getStudentAssessmentStatus(s, a.id);
                          const assigned = (s.assignedAssessmentIds || []).includes(a.id);
                          if (!assigned) return <td key={a.id} style={tdStyle}><span style={{ color: "#d1d5db", fontSize: "0.7rem" }}>N/A</span></td>;
                          const sc = statusColors[status] || statusColors.notstarted;
                          return <td key={a.id} style={tdStyle}>{statusBadge(sc.bg, sc.color, status)}</td>;
                        })}
                        <td style={tdStyle}>
                          <span style={{
                            background: reportColor + "18", color: reportColor,
                            padding: "3px 10px", borderRadius: 6, fontWeight: 700, fontSize: "0.75rem",
                          }}>
                            {generated}/{total}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {total > 0 ? (
                            <button
                              className="btn btn-sm"
                              disabled={oneClickStudentId === s.userStudentId}
                              style={{
                                background: oneClickStudentId === s.userStudentId ? "#6c757d" : "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
                                border: "none", borderRadius: 6, padding: "4px 10px",
                                fontWeight: 600, color: "white", fontSize: "0.65rem",
                              }}
                              onClick={() => handleOneClick(s.userStudentId)}>
                              {oneClickStudentId === s.userStudentId ? "..." : "Generate"}
                            </button>
                          ) : (
                            <span style={{ color: "#d1d5db", fontSize: "0.7rem" }}>No completed</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: "normal", minWidth: 180 }}>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {(reportsMap.get(s.userStudentId) || [])
                              .filter((r) => r.reportStatus === "generated" && r.reportUrl)
                              .map((r) => {
                                const isBetR = r.typeOfReport === "bet";
                                const label = isBetR ? "BET" : "NAV";
                                const assessmentObj = assessments.find((a) => a.id === r.assessmentId);
                                return (
                                  <span key={r.generatedReportId} style={{ display: "inline-flex", gap: 2 }}>
                                    <a
                                      href={r.reportUrl!}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={`Preview ${label} Report`}
                                      style={{
                                        padding: "3px 8px", borderRadius: "6px 0 0 6px", fontSize: "0.6rem", fontWeight: 600,
                                        background: isBetR ? "#dbeafe" : "#ccfbf1",
                                        color: isBetR ? "#2563eb" : "#0d9488",
                                        textDecoration: "none",
                                      }}>
                                      {label}
                                    </a>
                                    <button
                                      disabled={downloadingReportId === r.generatedReportId}
                                      title={`Download ${label} Report`}
                                      style={{
                                        padding: "3px 6px", borderRadius: "0 6px 6px 0", fontSize: "0.6rem", fontWeight: 600,
                                        background: downloadingReportId === r.generatedReportId ? "#d1d5db" : "#f0fdf4",
                                        color: downloadingReportId === r.generatedReportId ? "#6b7280" : "#059669",
                                        border: "none", cursor: downloadingReportId === r.generatedReportId ? "not-allowed" : "pointer",
                                      }}
                                      onClick={async () => {
                                        if (!assessmentObj) return;
                                        setDownloadingReportId(r.generatedReportId);
                                        try {
                                          const safeName = (s.name || "student").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
                                          const reportLabel = isBetR ? "BET_Report" : "Career_Navigator";
                                          await downloadReportAsPdf(
                                            () => downloadReportApi(assessmentObj, s.userStudentId),
                                            `${safeName}_${reportLabel}.pdf`
                                          );
                                        } catch { showErrorToast("Download failed"); }
                                        finally { setDownloadingReportId(null); }
                                      }}>
                                      {downloadingReportId === r.generatedReportId ? "..." : "\u2B07"}
                                    </button>
                                  </span>
                                );
                              })}
                            {generated === 0 && (
                              <span style={{ color: "#d1d5db", fontSize: "0.7rem" }}>-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedStudents.length === 0 && (
                    <tr>
                      <td colSpan={6 + assessments.length} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", padding: 32 }}>
                        No students found
                      </td>
                    </tr>
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

        {reportsLoading && (
          <div style={{ textAlign: "center", padding: 8, color: "#9ca3af", fontSize: "0.8rem" }}>
            Loading report statuses...
          </div>
        )}
      </div>
    </div>
  );
};

export default AllAssessmentsView;
