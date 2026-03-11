import React, { useState, useEffect, useMemo } from "react";
import { ReadCollegeList, GetSessionsByInstituteCode } from "../College/API/College_APIs";
import {
  getAllAssessments,
  getStudentsWithMappingByInstituteId,
  Assessment,
} from "../StudentInformation/StudentInfo_APIs";

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

const FILTER_ITEMS: { key: FilterKey; label: string; icon: string }[] = [
  { key: "grade",   label: "Grade / Class", icon: "🎓" },
  { key: "section", label: "Section",        icon: "👥" },
  { key: "status",  label: "Status",         icon: "📊" },
  { key: "name",    label: "Name",           icon: "🔍" },
];

const ReportGenerationPage: React.FC = () => {
  // Step 1 — institute
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");
  const [institutesLoading, setInstitutesLoading] = useState(false);

  // Step 2 — assessment
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<number | "">("");
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);

  // Students + section lookup
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sectionLookup, setSectionLookup] = useState<Map<number, SectionInfo>>(new Map());
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Selection
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());

  // Step 3 — filter panel
  const [activeFilterItem, setActiveFilterItem] = useState<FilterKey>("grade");
  const [filterEnabled, setFilterEnabled] = useState<Set<FilterKey>>(new Set());
  const [nameQuery, setNameQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<Set<string>>(new Set());

  // Load institutes on mount
  useEffect(() => {
    setInstitutesLoading(true);
    ReadCollegeList()
      .then((res) => setInstitutes(res.data || []))
      .catch(() => setInstitutes([]))
      .finally(() => setInstitutesLoading(false));
  }, []);

  // Load assessments on mount
  useEffect(() => {
    setAssessmentsLoading(true);
    getAllAssessments()
      .then((res) => setAssessments(res.data || []))
      .catch(() => setAssessments([]))
      .finally(() => setAssessmentsLoading(false));
  }, []);

  // Load students + sections when institute changes
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
        const sessions = sessionsRes.data || [];
        for (const session of sessions) {
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

  // Reset filters + selection when assessment or institute changes
  useEffect(() => {
    setFilterEnabled(new Set());
    setActiveFilterItem("grade");
    setNameQuery("");
    setSelectedGrade("");
    setSelectedSection("");
    setSelectedStatus(new Set<string>());
    setSelectedStudentIds(new Set());
  }, [selectedInstitute, selectedAssessment]);

  // Filtered students for the selected assessment
  const assessmentStudents = useMemo(() => {
    if (selectedAssessment === "") return [];
    return students.filter((s) =>
      (s.assignedAssessmentIds || []).includes(Number(selectedAssessment))
    );
  }, [students, selectedAssessment]);

  // Unique grades from assessment students
  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    for (const s of assessmentStudents) {
      const info = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined;
      if (info?.className) grades.add(info.className);
    }
    return Array.from(grades).sort();
  }, [assessmentStudents, sectionLookup]);

  // Unique sections (all, not dependent on grade in panel)
  const uniqueSections = useMemo(() => {
    const sections = new Set<string>();
    for (const s of assessmentStudents) {
      const info = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined;
      if (info?.sectionName) sections.add(info.sectionName);
    }
    return Array.from(sections).sort();
  }, [assessmentStudents, sectionLookup]);

  // Final displayed students after all enabled filters
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

  const toggleFilter = (key: FilterKey, checked: boolean) => {
    setFilterEnabled((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else {
        next.delete(key);
        // clear that filter's value
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
    setActiveFilterItem("grade");
    setNameQuery("");
    setSelectedGrade("");
    setSelectedSection("");
    setSelectedStatus(new Set<string>());
  };

  const selectedInstituteName =
    institutes.find((i) => i.instituteCode === selectedInstitute)?.instituteName || "";
  const selectedAssessmentName =
    assessments.find((a) => a.id === selectedAssessment)?.assessmentName || "";

  const step = selectedInstitute === "" ? 1 : selectedAssessment === "" ? 2 : 3;

  const thStyle: React.CSSProperties = {
    padding: "12px 16px",
    fontWeight: 600,
    color: "#1a1a2e",
    borderBottom: "2px solid #e0e0e0",
    whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "12px 16px",
    borderBottom: "1px solid #f0f0f0",
    whiteSpace: "nowrap",
  };

  // Right-panel content for each filter
  const renderFilterPanel = (key: FilterKey) => {
    const enabled = filterEnabled.has(key);
    if (!enabled) {
      const item = FILTER_ITEMS.find((f) => f.key === key)!;
      return (
        <div style={{ textAlign: "center", color: "#aaa" }}>
          <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.4 }}>☑</div>
          <div style={{ fontSize: "0.9rem" }}>
            Tick the checkbox on the left to enable{" "}
            <strong style={{ color: "#555" }}>{item.label.toLowerCase()}</strong> filter
          </div>
        </div>
      );
    }

    if (key === "name") {
      return (
        <div style={{ width: "100%", maxWidth: 380 }}>
          <label className="form-label fw-semibold mb-2">Search by name, username or roll no.</label>
          <input
            className="form-control form-control-solid"
            placeholder="Type to search..."
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            autoFocus
          />
        </div>
      );
    }

    if (key === "grade") {
      return (
        <div style={{ width: "100%", maxWidth: 320 }}>
          <label className="form-label fw-semibold mb-2">Select Grade / Class</label>
          <select
            className="form-select form-select-solid"
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
          >
            <option value="">-- All Grades --</option>
            {uniqueGrades.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      );
    }

    if (key === "section") {
      return (
        <div style={{ width: "100%", maxWidth: 320 }}>
          <label className="form-label fw-semibold mb-2">Select Section</label>
          <select
            className="form-select form-select-solid"
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
          >
            <option value="">-- All Sections --</option>
            {uniqueSections.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      );
    }

    if (key === "status") {
      const statusOptions: { value: string; label: string; activeColor: string; dotColor: string }[] = [
        { value: "completed",  label: "Completed",   activeColor: "#059669", dotColor: "rgba(16,185,129,0.15)" },
        { value: "ongoing",    label: "In Progress", activeColor: "#2563eb", dotColor: "rgba(37,99,235,0.15)"  },
        { value: "notstarted", label: "Not Started", activeColor: "#d97706", dotColor: "rgba(245,158,11,0.15)" },
      ];
      const toggle = (val: string) => {
        setSelectedStatus((prev) => {
          const next = new Set(prev);
          if (next.has(val)) next.delete(val);
          else next.add(val);
          return next;
        });
      };
      return (
        <div>
          <label className="form-label fw-semibold mb-4">Select Status</label>
          <div className="d-flex flex-column gap-3">
            {statusOptions.map((opt) => {
              const checked = selectedStatus.has(opt.value);
              return (
                <label
                  key={opt.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: `1.5px solid ${checked ? opt.activeColor : "#e4e6ef"}`,
                    background: checked ? opt.dotColor : "#fff",
                    transition: "all 0.15s",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(opt.value)}
                    style={{ accentColor: opt.activeColor, width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span
                    style={{
                      fontWeight: checked ? 600 : 400,
                      color: checked ? opt.activeColor : "#5e6278",
                      fontSize: "0.9rem",
                    }}
                  >
                    {opt.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="card">
      <div className="card-header border-0 pt-6">
        <div className="card-title">
          <h3 className="card-label fw-bold fs-3 mb-1">Report Generation</h3>
        </div>
      </div>

      <div className="card-body pt-0">
        {/* Step indicators */}
        <div className="d-flex gap-4 mb-6 align-items-center">
          {[1, 2, 3].map((s) => (
            <div key={s} className="d-flex align-items-center gap-2">
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: step >= s ? "#4361ee" : "#e0e0e0",
                  color: step >= s ? "#fff" : "#999",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  flexShrink: 0,
                }}
              >
                {s}
              </div>
              <span style={{ fontSize: "0.85rem", color: step >= s ? "#4361ee" : "#999", fontWeight: step === s ? 700 : 400 }}>
                {s === 1 ? "Select School" : s === 2 ? "Select Assessment" : "Filter Students"}
              </span>
              {s < 3 && <span style={{ color: "#ccc", marginLeft: 4 }}>›</span>}
            </div>
          ))}
        </div>

        {/* Step 1: School */}
        <div className="mb-5" style={{ maxWidth: 420 }}>
          <label className="form-label fw-semibold">
            <span style={{ color: "#4361ee", fontWeight: 700 }}>1.</span> Which School?
          </label>
          {institutesLoading ? (
            <div className="text-muted">Loading schools...</div>
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

        {/* Step 2: Assessment */}
        {selectedInstitute !== "" && (
          <div className="mb-5" style={{ maxWidth: 420 }}>
            <label className="form-label fw-semibold">
              <span style={{ color: "#4361ee", fontWeight: 700 }}>2.</span> Which Assessment?
            </label>
            {assessmentsLoading ? (
              <div className="text-muted">Loading assessments...</div>
            ) : (
              <select
                className="form-select form-select-solid"
                value={selectedAssessment}
                onChange={(e) =>
                  setSelectedAssessment(e.target.value === "" ? "" : Number(e.target.value))
                }
              >
                <option value="">-- Select an assessment --</option>
                {assessments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.assessmentName}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Step 3: Filter + Results */}
        {selectedInstitute !== "" && selectedAssessment !== "" && (
          <>
            {studentsLoading ? (
              <div className="text-muted py-4">Loading students...</div>
            ) : (
              <>
                {/* Summary bar */}
                <div className="mb-4 p-3 bg-light-primary rounded d-flex gap-4 flex-wrap align-items-center">
                  <span className="fw-bold text-primary">{selectedInstituteName}</span>
                  <span className="text-muted">›</span>
                  <span className="fw-semibold">{selectedAssessmentName}</span>
                  <span className="badge badge-light-primary ms-auto">
                    {assessmentStudents.length} students allotted
                  </span>
                </div>

                {/* Step 3 — Filter panel */}
                <div className="mb-5">
                  <label className="form-label fw-semibold mb-3">
                    <span style={{ color: "#4361ee", fontWeight: 700 }}>3.</span> Select Filters
                  </label>

                  <div
                    style={{
                      border: "1px solid #e4e6ef",
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    {/* Header */}
                    <div
                      style={{
                        background: "#f5f8ff",
                        borderBottom: "1px solid #e4e6ef",
                        padding: "10px 20px",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        color: "#3a3a5c",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      Select Filters
                    </div>

                    <div style={{ display: "flex", minHeight: 240 }}>
                      {/* Left sidebar */}
                      <div style={{ width: 220, borderRight: "1px solid #e4e6ef", background: "#fafbff" }}>
                        {FILTER_ITEMS.map((item) => {
                          const isActive = activeFilterItem === item.key;
                          const isEnabled = filterEnabled.has(item.key);
                          return (
                            <div
                              key={item.key}
                              onClick={() => setActiveFilterItem(item.key)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "13px 16px",
                                cursor: "pointer",
                                background: isActive ? "#fff" : "transparent",
                                borderBottom: "1px solid #eef0f8",
                                borderLeft: isActive ? "3px solid #4361ee" : "3px solid transparent",
                                transition: "background 0.15s",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleFilter(item.key, e.target.checked);
                                  setActiveFilterItem(item.key);
                                }}
                                style={{ cursor: "pointer", accentColor: "#4361ee" }}
                              />
                              <span style={{ fontSize: "1rem" }}>{item.icon}</span>
                              <span
                                style={{
                                  fontSize: "0.875rem",
                                  fontWeight: isActive ? 600 : 400,
                                  color: isActive ? "#4361ee" : "#5e6278",
                                }}
                              >
                                {item.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Right panel */}
                      <div
                        style={{
                          flex: 1,
                          padding: 28,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#fff",
                        }}
                      >
                        {renderFilterPanel(activeFilterItem)}
                      </div>
                    </div>

                    {/* Bottom bar */}
                    <div
                      style={{
                        borderTop: "1px solid #e4e6ef",
                        padding: "12px 20px",
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 10,
                        background: "#fafbff",
                      }}
                    >
                      <button className="btn btn-sm btn-light" onClick={resetFilters}>
                        Reset
                      </button>
                      <button className="btn btn-sm btn-primary d-flex align-items-center gap-1">
                        <span>✓</span> Apply Filters
                      </button>
                    </div>
                  </div>
                </div>

                {/* Results table */}
                {displayedStudents.length === 0 ? (
                  <div className="text-muted py-4">No students match the current filter.</div>
                ) : (
                  <>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <span className="text-muted fs-6">{displayedStudents.length} student(s)</span>
                      {selectedStudentIds.size > 0 && (
                        <button className="btn btn-primary btn-sm">
                          Generate Report ({selectedStudentIds.size})
                        </button>
                      )}
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table
                        className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4"
                        style={{ width: "100%" }}
                      >
                        <thead>
                          <tr className="fw-bold text-muted bg-light">
                            <th style={{ ...thStyle, width: 44 }}>
                              <input
                                type="checkbox"
                                checked={
                                  displayedStudents.length > 0 &&
                                  displayedStudents.every((s) => selectedStudentIds.has(s.userStudentId))
                                }
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStudentIds(
                                      new Set(displayedStudents.map((s) => s.userStudentId))
                                    );
                                  } else {
                                    setSelectedStudentIds(new Set());
                                  }
                                }}
                              />
                            </th>
                            <th style={{ ...thStyle, width: 50 }}>#</th>
                            <th style={thStyle}>Name</th>
                            <th style={thStyle}>Username</th>
                            <th style={thStyle}>Roll No.</th>
                            <th style={thStyle}>Control No.</th>
                            <th style={thStyle}>Grade</th>
                            <th style={thStyle}>Section</th>
                            <th style={thStyle}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedStudents.map((s, idx) => {
                            const secInfo = s.schoolSectionId
                              ? sectionLookup.get(s.schoolSectionId)
                              : undefined;
                            const asmtInfo = (s.assessments || []).find(
                              (a) => a.assessmentId === Number(selectedAssessment)
                            );
                            const status = asmtInfo?.status || "notstarted";
                            const statusColors: Record<string, { bg: string; color: string }> = {
                              completed: { bg: "rgba(16,185,129,0.12)", color: "#059669" },
                              ongoing: { bg: "rgba(37,99,235,0.12)", color: "#2563eb" },
                              notstarted: { bg: "rgba(245,158,11,0.12)", color: "#d97706" },
                            };
                            const sc = statusColors[status] || statusColors.notstarted;
                            const isChecked = selectedStudentIds.has(s.userStudentId);
                            return (
                              <tr key={s.userStudentId} style={{ background: idx % 2 === 0 ? "#fff" : "#fafbfc" }}>
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
                                <td style={tdStyle}>{idx + 1}</td>
                                <td style={tdStyle}><span className="fw-semibold">{s.name || "-"}</span></td>
                                <td style={tdStyle}>{s.username || "-"}</td>
                                <td style={tdStyle}>{s.schoolRollNumber || "-"}</td>
                                <td style={tdStyle}>{s.controlNumber ?? "-"}</td>
                                <td style={tdStyle}>{secInfo?.className || "-"}</td>
                                <td style={tdStyle}>{secInfo?.sectionName || "-"}</td>
                                <td style={tdStyle}>
                                  <span
                                    style={{
                                      background: sc.bg,
                                      color: sc.color,
                                      padding: "4px 10px",
                                      borderRadius: 8,
                                      fontWeight: 600,
                                      fontSize: "0.8rem",
                                      textTransform: "capitalize",
                                    }}
                                  >
                                    {status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ReportGenerationPage;
