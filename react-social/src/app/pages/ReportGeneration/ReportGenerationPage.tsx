import React, { useState, useEffect, useMemo } from "react";
import { ReadCollegeList, GetSessionsByInstituteCode } from "../College/API/College_APIs";
import {
  getAllAssessments,
  getStudentsWithMappingByInstituteId,
  Assessment,
} from "../StudentInformation/StudentInfo_APIs";
import { generateBetReportData, exportBetReportExcel } from "./API/BetReportData_APIs";

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
type FilterKey = "name" | "grade" | "section" | "status";

const FILTER_ITEMS: { key: FilterKey; label: string }[] = [
  { key: "grade", label: "Grade / Class" },
  { key: "section", label: "Section" },
  { key: "status", label: "Status" },
  { key: "name", label: "Name" },
];

const ReportGenerationPage: React.FC = () => {
  // ── Core selections ──
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");
  const [institutesLoading, setInstitutesLoading] = useState(false);

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<number | "">("");
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sectionLookup, setSectionLookup] = useState<Map<number, SectionInfo>>(new Map());
  const [studentsLoading, setStudentsLoading] = useState(false);

  // ── Student selection ──
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ── Filters ──
  const [filterEnabled, setFilterEnabled] = useState<Set<FilterKey>>(new Set());
  const [nameQuery, setNameQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<Set<string>>(new Set());

  // ── Generate / Export ──
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ═══════════════════════ DATA LOADING ═══════════════════════

  useEffect(() => {
    setInstitutesLoading(true);
    ReadCollegeList()
      .then((res) => setInstitutes(res.data || []))
      .catch(() => setInstitutes([]))
      .finally(() => setInstitutesLoading(false));
  }, []);

  useEffect(() => {
    setAssessmentsLoading(true);
    getAllAssessments()
      .then((res) => setAssessments(res.data || []))
      .catch(() => setAssessments([]))
      .finally(() => setAssessmentsLoading(false));
  }, []);

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
      })
      .finally(() => setStudentsLoading(false));
  }, [selectedInstitute]);

  // Reset on selection change
  useEffect(() => {
    setFilterEnabled(new Set());
    setNameQuery("");
    setSelectedGrade("");
    setSelectedSection("");
    setSelectedStatus(new Set<string>());
    setSelectedStudentIds(new Set());
    setCurrentPage(1);
  }, [selectedInstitute, selectedAssessment]);

  // ═══════════════════════ FILTERED STUDENTS ═══════════════════════

  const assessmentStudents = useMemo(() => {
    if (selectedAssessment === "") return [];
    return students.filter((s) =>
      (s.assignedAssessmentIds || []).includes(Number(selectedAssessment))
    );
  }, [students, selectedAssessment]);

  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    for (const s of assessmentStudents) {
      const info = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined;
      if (info?.className) grades.add(info.className);
    }
    return Array.from(grades).sort();
  }, [assessmentStudents, sectionLookup]);

  const uniqueSections = useMemo(() => {
    const sections = new Set<string>();
    for (const s of assessmentStudents) {
      const info = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined;
      if (info?.sectionName) sections.add(info.sectionName);
    }
    return Array.from(sections).sort();
  }, [assessmentStudents, sectionLookup]);

  const displayedStudents = useMemo(() => {
    let result = assessmentStudents;
    if (filterEnabled.has("name") && nameQuery.trim()) {
      const q = nameQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.username || "").toLowerCase().includes(q) ||
          (s.schoolRollNumber || "").toLowerCase().includes(q)
      );
    }
    if (filterEnabled.has("grade") && selectedGrade) {
      result = result.filter((s) => {
        const info = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined;
        return info?.className === selectedGrade;
      });
    }
    if (filterEnabled.has("section") && selectedSection) {
      result = result.filter((s) => {
        const info = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined;
        return info?.sectionName === selectedSection;
      });
    }
    if (filterEnabled.has("status") && selectedStatus.size > 0) {
      result = result.filter((s) => {
        const asmtInfo = (s.assessments || []).find(
          (a) => a.assessmentId === Number(selectedAssessment)
        );
        return selectedStatus.has(asmtInfo?.status || "notstarted");
      });
    }
    return result;
  }, [
    assessmentStudents, filterEnabled, nameQuery,
    selectedGrade, selectedSection, sectionLookup,
    selectedStatus, selectedAssessment,
  ]);

  const totalPages = Math.max(1, Math.ceil(displayedStudents.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedStudents = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return displayedStudents.slice(start, start + pageSize);
  }, [displayedStudents, safeCurrentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [nameQuery, selectedGrade, selectedSection, selectedStatus, filterEnabled]);

  // ═══════════════════════ ACTIONS ═══════════════════════

  const toggleFilter = (key: FilterKey, checked: boolean) => {
    setFilterEnabled((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else {
        next.delete(key);
        if (key === "name") setNameQuery("");
        if (key === "grade") setSelectedGrade("");
        if (key === "section") setSelectedSection("");
        if (key === "status") setSelectedStatus(new Set());
      }
      return next;
    });
  };

  const resetFilters = () => {
    setFilterEnabled(new Set());
    setNameQuery("");
    setSelectedGrade("");
    setSelectedSection("");
    setSelectedStatus(new Set<string>());
  };

  // ═══════════════════════ DERIVED ═══════════════════════

  const selectedInstituteName =
    institutes.find((i) => i.instituteCode === selectedInstitute)?.instituteName || "";
  const selectedAssessmentName =
    assessments.find((a) => a.id === selectedAssessment)?.assessmentName || "";

  const ready = selectedInstitute !== "" && selectedAssessment !== "";

  // ═══════════════════════ STYLES ═══════════════════════

  const thStyle: React.CSSProperties = {
    padding: "10px 14px", fontWeight: 600, color: "#1a1a2e",
    borderBottom: "2px solid #e0e0e0", whiteSpace: "nowrap", fontSize: "0.85rem",
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 14px", borderBottom: "1px solid #f0f0f0", whiteSpace: "nowrap", fontSize: "0.85rem",
  };

  // ═══════════════════════ RENDER ═══════════════════════

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontWeight: 800, fontSize: "1.5rem", color: "#1a1a2e", margin: 0 }}>
          Report Generation
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: "4px 0 0" }}>
          Select a school and assessment to view students and generate reports
        </p>
      </div>

      {/* Selection Row */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24,
        background: "#fff", padding: 20, borderRadius: 12,
        border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <div>
          <label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151", marginBottom: 6, display: "block" }}>
            School / Institute
          </label>
          {institutesLoading ? (
            <div style={{ color: "#9ca3af", padding: "8px 0" }}>Loading...</div>
          ) : (
            <select
              className="form-select form-select-solid"
              value={selectedInstitute}
              onChange={(e) => {
                setSelectedInstitute(e.target.value === "" ? "" : Number(e.target.value));
                setSelectedAssessment("");
              }}
            >
              <option value="">-- Select a school --</option>
              {institutes.map((inst) => (
                <option key={inst.instituteCode} value={inst.instituteCode}>
                  {inst.instituteName}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151", marginBottom: 6, display: "block" }}>
            Assessment
          </label>
          {assessmentsLoading ? (
            <div style={{ color: "#9ca3af", padding: "8px 0" }}>Loading...</div>
          ) : (
            <select
              className="form-select form-select-solid"
              value={selectedAssessment}
              onChange={(e) =>
                setSelectedAssessment(e.target.value === "" ? "" : Number(e.target.value))
              }
              disabled={selectedInstitute === ""}
            >
              <option value="">-- Select an assessment --</option>
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>{a.assessmentName}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {!ready && (
        <div style={{
          padding: 48, textAlign: "center", color: "#9ca3af",
          border: "2px dashed #e5e7eb", borderRadius: 12, background: "#fff",
        }}>
          <div style={{ fontSize: "2rem", marginBottom: 8, opacity: 0.4 }}>&#x1F4CB;</div>
          <div>Select a school and assessment to get started</div>
        </div>
      )}

      {ready && (
        <div style={{
          background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)", padding: 24,
        }}>
          {/* Summary */}
          <div style={{
            padding: "12px 20px", background: "#f0f4ff", borderRadius: 10,
            display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap",
          }}>
            <span style={{ fontWeight: 700, color: "#4361ee" }}>{selectedInstituteName}</span>
            <span style={{ color: "#cbd5e1" }}>/</span>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>{selectedAssessmentName}</span>
            <span style={{
              marginLeft: "auto", background: "#4361ee", color: "#fff",
              padding: "4px 12px", borderRadius: 16, fontSize: "0.8rem", fontWeight: 600,
            }}>
              {assessmentStudents.length} students
            </span>
          </div>

          {/* Students */}
          {studentsLoading ? (
            <div style={{ color: "#9ca3af", padding: 24 }}>Loading students...</div>
          ) : (
            <>
              {/* Compact filter row */}
              <div style={{
                display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end",
              }}>
                {FILTER_ITEMS.map((item) => {
                  if (item.key === "name") {
                    return (
                      <div key={item.key} style={{ flex: "1 1 200px", minWidth: 180 }}>
                        <label style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Search</label>
                        <input
                          className="form-control form-control-sm form-control-solid"
                          placeholder="Name, roll no..."
                          value={nameQuery}
                          onChange={(e) => {
                            setNameQuery(e.target.value);
                            if (e.target.value && !filterEnabled.has("name")) toggleFilter("name", true);
                          }}
                        />
                      </div>
                    );
                  }
                  if (item.key === "grade") {
                    return (
                      <div key={item.key} style={{ minWidth: 140 }}>
                        <label style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>{item.label}</label>
                        <select
                          className="form-select form-select-sm form-select-solid"
                          value={selectedGrade}
                          onChange={(e) => {
                            setSelectedGrade(e.target.value);
                            if (e.target.value) toggleFilter("grade", true);
                            else toggleFilter("grade", false);
                          }}
                        >
                          <option value="">All</option>
                          {uniqueGrades.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                    );
                  }
                  if (item.key === "section") {
                    return (
                      <div key={item.key} style={{ minWidth: 140 }}>
                        <label style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>{item.label}</label>
                        <select
                          className="form-select form-select-sm form-select-solid"
                          value={selectedSection}
                          onChange={(e) => {
                            setSelectedSection(e.target.value);
                            if (e.target.value) toggleFilter("section", true);
                            else toggleFilter("section", false);
                          }}
                        >
                          <option value="">All</option>
                          {uniqueSections.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    );
                  }
                  if (item.key === "status") {
                    return (
                      <div key={item.key} style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                        {[
                          { value: "completed", label: "Completed", color: "#059669" },
                          { value: "ongoing", label: "Ongoing", color: "#2563eb" },
                          { value: "notstarted", label: "Not Started", color: "#d97706" },
                        ].map((opt) => {
                          const checked = selectedStatus.has(opt.value);
                          return (
                            <button
                              key={opt.value}
                              onClick={() => {
                                const next = new Set(selectedStatus);
                                if (checked) next.delete(opt.value);
                                else next.add(opt.value);
                                setSelectedStatus(next);
                                if (next.size > 0) toggleFilter("status", true);
                                else toggleFilter("status", false);
                              }}
                              style={{
                                padding: "4px 10px", borderRadius: 6, fontSize: "0.75rem",
                                fontWeight: 600, cursor: "pointer",
                                border: `1.5px solid ${checked ? opt.color : "#e5e7eb"}`,
                                background: checked ? opt.color + "18" : "#fff",
                                color: checked ? opt.color : "#6b7280",
                              }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    );
                  }
                  return null;
                })}
                {filterEnabled.size > 0 && (
                  <button
                    onClick={resetFilters}
                    style={{
                      padding: "4px 12px", borderRadius: 6, fontSize: "0.75rem",
                      fontWeight: 600, cursor: "pointer", border: "1.5px solid #e5e7eb",
                      background: "#fff", color: "#ef4444", alignSelf: "flex-end",
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Action bar */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 12, flexWrap: "wrap", gap: 8,
              }}>
                <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                  {displayedStudents.length} student(s)
                  {selectedStudentIds.size > 0 && (
                    <span style={{ fontWeight: 600, color: "#4361ee", marginLeft: 8 }}>
                      ({selectedStudentIds.size} selected)
                    </span>
                  )}
                </span>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={async () => {
                    const ids = selectedStudentIds.size > 0
                      ? Array.from(selectedStudentIds)
                      : displayedStudents.map((s) => s.userStudentId);
                    setGenerating(true);
                    try {
                      const res = await generateBetReportData(Number(selectedAssessment), ids);
                      const { generated, errors } = res.data;
                      let msg = `Generated report data for ${generated} student(s).`;
                      if (errors.length > 0) {
                        msg += `\n${errors.length} skipped (no completed assessment or error).`;
                      }
                      alert(msg);
                    } catch (err: any) {
                      alert("Failed: " + (err?.response?.data?.error || err.message));
                    } finally {
                      setGenerating(false);
                    }
                  }}
                  disabled={displayedStudents.length === 0 || generating}
                >
                  {generating ? "Generating..." : (
                    <>
                      Generate Report Data & Save
                      {selectedStudentIds.size > 0
                        ? ` (${selectedStudentIds.size} selected)`
                        : ` (All ${displayedStudents.length})`}
                    </>
                  )}
                </button>
                <button
                  className="btn btn-sm btn-success"
                  onClick={async () => {
                    setExporting(true);
                    try {
                      const res = await exportBetReportExcel(Number(selectedAssessment));
                      const url = window.URL.createObjectURL(new Blob([res.data]));
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "bet_report_data.xlsx";
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      window.URL.revokeObjectURL(url);
                    } catch (err: any) {
                      alert("Export failed: " + (err?.response?.data?.error || err.message));
                    } finally {
                      setExporting(false);
                    }
                  }}
                  disabled={exporting}
                >
                  {exporting ? "Exporting..." : "Export XLSX"}
                </button>
              </div>

              {/* Table */}
              <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{ ...thStyle, width: 40 }}>
                        <input
                          type="checkbox"
                          checked={
                            paginatedStudents.length > 0 &&
                            paginatedStudents.every((s) => selectedStudentIds.has(s.userStudentId))
                          }
                          onChange={(e) => {
                            setSelectedStudentIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) paginatedStudents.forEach((s) => next.add(s.userStudentId));
                              else paginatedStudents.forEach((s) => next.delete(s.userStudentId));
                              return next;
                            });
                          }}
                        />
                      </th>
                      <th style={{ ...thStyle, width: 44 }}>#</th>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Roll No.</th>
                      <th style={thStyle}>Grade</th>
                      <th style={thStyle}>Section</th>
                      <th style={thStyle}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStudents.map((s, idx) => {
                      const globalIdx = (safeCurrentPage - 1) * pageSize + idx;
                      const secInfo = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined;
                      const asmtInfo = (s.assessments || []).find(
                        (a) => a.assessmentId === Number(selectedAssessment)
                      );
                      const status = asmtInfo?.status || "notstarted";
                      const sc: Record<string, { bg: string; color: string }> = {
                        completed: { bg: "#dcfce7", color: "#059669" },
                        ongoing: { bg: "#dbeafe", color: "#2563eb" },
                        notstarted: { bg: "#fef3c7", color: "#d97706" },
                      };
                      const colors = sc[status] || sc.notstarted;
                      const isChecked = selectedStudentIds.has(s.userStudentId);
                      return (
                        <tr key={s.userStudentId} style={{ background: globalIdx % 2 === 0 ? "#fff" : "#f9fafb" }}>
                          <td style={tdStyle}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setSelectedStudentIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(s.userStudentId);
                                  else next.delete(s.userStudentId);
                                  return next;
                                });
                              }}
                            />
                          </td>
                          <td style={tdStyle}>{globalIdx + 1}</td>
                          <td style={tdStyle}><span style={{ fontWeight: 600 }}>{s.name || "-"}</span></td>
                          <td style={tdStyle}>{s.schoolRollNumber || "-"}</td>
                          <td style={tdStyle}>{secInfo?.className || "-"}</td>
                          <td style={tdStyle}>{secInfo?.sectionName || "-"}</td>
                          <td style={tdStyle}>
                            <span style={{
                              background: colors.bg, color: colors.color,
                              padding: "3px 10px", borderRadius: 6,
                              fontWeight: 600, fontSize: "0.75rem", textTransform: "capitalize",
                            }}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginTop: 12, flexWrap: "wrap", gap: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                      {(safeCurrentPage - 1) * pageSize + 1}-{Math.min(safeCurrentPage * pageSize, displayedStudents.length)} of {displayedStudents.length}
                    </span>
                    <select
                      className="form-select form-select-sm form-select-solid"
                      style={{ width: 68, fontSize: "0.8rem" }}
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    >
                      {[25, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-sm btn-light" disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage(1)} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>First</button>
                    <button className="btn btn-sm btn-light" disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>Prev</button>
                    {(() => {
                      const pages: (number | string)[] = [];
                      const maxV = 5;
                      let start = Math.max(1, safeCurrentPage - Math.floor(maxV / 2));
                      let end = Math.min(totalPages, start + maxV - 1);
                      if (end - start + 1 < maxV) start = Math.max(1, end - maxV + 1);
                      if (start > 1) { pages.push(1); if (start > 2) pages.push("..."); }
                      for (let i = start; i <= end; i++) pages.push(i);
                      if (end < totalPages) { if (end < totalPages - 1) pages.push("..."); pages.push(totalPages); }
                      return pages.map((p, i) =>
                        typeof p === "string" ? (
                          <span key={`e-${i}`} style={{ padding: "4px 4px", color: "#9ca3af", fontSize: "0.8rem" }}>...</span>
                        ) : (
                          <button key={p} className={`btn btn-sm ${p === safeCurrentPage ? "btn-primary" : "btn-light"}`}
                            onClick={() => setCurrentPage(p)} style={{ padding: "4px 10px", fontSize: "0.8rem", minWidth: 32 }}>{p}</button>
                        )
                      );
                    })()}
                    <button className="btn btn-sm btn-light" disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>Next</button>
                    <button className="btn btn-sm btn-light" disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage(totalPages)} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>Last</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportGenerationPage;
