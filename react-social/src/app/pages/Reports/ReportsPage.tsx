import React, { useState, useEffect, useMemo } from "react";
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { downloadReportAsPdf, downloadReportsAsZip, ZipProgress } from "../ReportGeneration/utils/htmlToPdf";
import { ReadCollegeList, GetSessionsByInstituteCode } from "../College/API/College_APIs";
import {
  getAllAssessments,
  getStudentsWithMappingByInstituteId,
  Assessment,
} from "../StudentInformation/StudentInfo_APIs";
import { getAssessmentMappingsByInstitute } from "../AssessmentMapping/API/AssessmentMapping_APIs";
import {
  getBetReportDataByAssessment,
  generateHtmlReports,
  downloadBetReport,
  getBetReportUrls,
  BetReportData,
  exportGeneralAssessmentExcel,
  exportGeneralAssessmentExcelForStudent,
  exportMqtScoresExcel,
  exportBetReportExcel,
} from "../ReportGeneration/API/BetReportData_APIs";

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
type FilterKey = "name" | "grade" | "section" | "status" | "dataGenerated";

const FILTER_ITEMS: { key: FilterKey; label: string }[] = [
  { key: "grade", label: "Grade / Class" },
  { key: "section", label: "Section" },
  { key: "status", label: "Report Status" },
  { key: "dataGenerated", label: "Data Generated" },
  { key: "name", label: "Name" },
];

const ReportsPage: React.FC = () => {
  // ── Core selections ──
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");
  const [institutesLoading, setInstitutesLoading] = useState(false);

  const [allAssessments, setAllAssessments] = useState<Assessment[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<number | "">("");
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sectionLookup, setSectionLookup] = useState<Map<number, SectionInfo>>(new Map());
  const [studentsLoading, setStudentsLoading] = useState(false);

  // ── Report data from bet_report_data table ──
  const [reportDataMap, setReportDataMap] = useState<Map<number, BetReportData>>(new Map());
  const [reportDataLoading, setReportDataLoading] = useState(false);

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
  const [selectedDataGenerated, setSelectedDataGenerated] = useState<Set<string>>(new Set());

  // ── Generate ──
  const [generating, setGenerating] = useState(false);
  const [exportingOMR, setExportingOMR] = useState(false);
  const [exportingMQT, setExportingMQT] = useState(false);
  const [exportingBET, setExportingBET] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<ZipProgress | null>(null);
  const [exportingStudentId, setExportingStudentId] = useState<number | null>(null);

  // ═══════════════════════ DATA LOADING ═══════════════════════

  useEffect(() => {
    setInstitutesLoading(true);
    ReadCollegeList()
      .then((res) => setInstitutes(res.data || []))
      .catch(() => setInstitutes([]))
      .finally(() => setInstitutesLoading(false));
  }, []);

  useEffect(() => {
    getAllAssessments()
      .then((res) => setAllAssessments(res.data || []))
      .catch(() => setAllAssessments([]));
  }, []);

  const [mappedAssessmentIds, setMappedAssessmentIds] = useState<Set<number> | null>(null);

  useEffect(() => {
    if (selectedInstitute === "") {
      setMappedAssessmentIds(null);
      return;
    }
    setAssessmentsLoading(true);
    getAssessmentMappingsByInstitute(Number(selectedInstitute))
      .then((res) => {
        const ids = new Set<number>(
          (res.data || [])
            .filter((m: any) => m.isActive !== false)
            .map((m: any) => Number(m.assessmentId))
        );
        setMappedAssessmentIds(ids.size > 0 ? ids : null);
      })
      .catch(() => setMappedAssessmentIds(null))
      .finally(() => setAssessmentsLoading(false));
  }, [selectedInstitute]);

  useEffect(() => {
    if (mappedAssessmentIds && mappedAssessmentIds.size > 0) {
      setAssessments(allAssessments.filter((a) => mappedAssessmentIds.has(a.id)));
    } else {
      setAssessments(allAssessments);
    }
  }, [allAssessments, mappedAssessmentIds]);

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

  // Fetch report data when assessment is selected
  useEffect(() => {
    if (selectedAssessment === "") {
      setReportDataMap(new Map());
      return;
    }
    setReportDataLoading(true);
    getBetReportDataByAssessment(Number(selectedAssessment))
      .then((res) => {
        const map = new Map<number, BetReportData>();
        for (const r of res.data || []) {
          if (r.userStudent?.userStudentId) {
            map.set(r.userStudent.userStudentId, r);
          }
        }
        setReportDataMap(map);
      })
      .catch(() => setReportDataMap(new Map()))
      .finally(() => setReportDataLoading(false));
  }, [selectedAssessment]);

  // Reset on selection change
  useEffect(() => {
    setFilterEnabled(new Set());
    setNameQuery("");
    setSelectedGrade("");
    setSelectedSection("");
    setSelectedStatus(new Set<string>());
    setSelectedDataGenerated(new Set<string>());
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
        const rd = reportDataMap.get(s.userStudentId);
        const status = rd?.reportStatus || "notGenerated";
        return selectedStatus.has(status);
      });
    }
    if (filterEnabled.has("dataGenerated") && selectedDataGenerated.size > 0) {
      result = result.filter((s) => {
        const hasData = reportDataMap.has(s.userStudentId);
        if (selectedDataGenerated.has("yes") && hasData) return true;
        if (selectedDataGenerated.has("no") && !hasData) return true;
        return false;
      });
    }
    return result;
  }, [
    assessmentStudents, filterEnabled, nameQuery,
    selectedGrade, selectedSection, sectionLookup,
    selectedStatus, selectedDataGenerated, reportDataMap,
  ]);

  const totalPages = Math.max(1, Math.ceil(displayedStudents.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedStudents = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return displayedStudents.slice(start, start + pageSize);
  }, [displayedStudents, safeCurrentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [nameQuery, selectedGrade, selectedSection, selectedStatus, selectedDataGenerated, filterEnabled]);

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
        if (key === "dataGenerated") setSelectedDataGenerated(new Set());
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
    setSelectedDataGenerated(new Set<string>());
  };

  const handleGenerateReports = async () => {
    const visibleIds = new Set(displayedStudents.map((s) => s.userStudentId));
    const selectedVisible = Array.from(selectedStudentIds).filter((id) => visibleIds.has(id));
    const ids = selectedVisible.length > 0
      ? selectedVisible
      : displayedStudents.map((s) => s.userStudentId);

    // Only include students that have report data
    const idsWithData = ids.filter((id) => reportDataMap.has(id));
    if (idsWithData.length === 0) {
      showErrorToast("No students with generated report data found. Generate report data first from the Report Generation page.");
      return;
    }

    setGenerating(true);
    try {
      const res = await generateHtmlReports(Number(selectedAssessment), idsWithData);
      const { generated, errors } = res.data;
      let msg = `Generated ${generated} report(s).`;
      if (errors.length > 0) {
        msg += `\n${errors.length} failed: ${errors.map((e) => e.reason).join(", ")}`;
      }
      showSuccessToast(msg);

      // Refresh report data
      const refreshRes = await getBetReportDataByAssessment(Number(selectedAssessment));
      const map = new Map<number, BetReportData>();
      for (const r of refreshRes.data || []) {
        if (r.userStudent?.userStudentId) {
          map.set(r.userStudent.userStudentId, r);
        }
      }
      setReportDataMap(map);
    } catch (err: any) {
      showErrorToast("Failed: " + (err?.response?.data?.error || err.message));
    } finally {
      setGenerating(false);
    }
  };

  // ═══════════════════════ DERIVED ═══════════════════════

  const selectedInstituteName =
    institutes.find((i) => i.instituteCode === selectedInstitute)?.instituteName || "";
  const selectedAssessmentName =
    assessments.find((a) => a.id === selectedAssessment)?.assessmentName || "";

  const ready = selectedInstitute !== "" && selectedAssessment !== "";

  const visibleSelectedCount = useMemo(() => {
    const visibleIds = new Set(displayedStudents.map((s) => s.userStudentId));
    return Array.from(selectedStudentIds).filter((id) => visibleIds.has(id)).length;
  }, [selectedStudentIds, displayedStudents]);

  // Stats
  const reportStats = useMemo(() => {
    let generated = 0;
    let notGenerated = 0;
    let hasData = 0;
    for (const s of displayedStudents) {
      const rd = reportDataMap.get(s.userStudentId);
      if (rd) {
        hasData++;
        if (rd.reportStatus === "generated") generated++;
        else notGenerated++;
      } else {
        notGenerated++;
      }
    }
    return { generated, notGenerated, hasData };
  }, [displayedStudents, reportDataMap]);

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
          Report Export & Preview
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: "4px 0 0" }}>
          Generate HTML reports from BET report data and export to storage
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
          <div style={{ fontSize: "2rem", marginBottom: 8, opacity: 0.4 }}>&#x1F4C4;</div>
          <div>Select a school and assessment to manage reports</div>
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
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <span style={{
                background: "#4361ee", color: "#fff",
                padding: "4px 12px", borderRadius: 16, fontSize: "0.8rem", fontWeight: 600,
              }}>
                {assessmentStudents.length} students
              </span>
              <span style={{
                background: "#059669", color: "#fff",
                padding: "4px 12px", borderRadius: 16, fontSize: "0.8rem", fontWeight: 600,
              }}>
                {reportStats.generated} reports
              </span>
              <span style={{
                background: reportDataLoading ? "#9ca3af" : "#6b7280", color: "#fff",
                padding: "4px 12px", borderRadius: 16, fontSize: "0.8rem", fontWeight: 600,
              }}>
                {reportStats.hasData} with data
              </span>
            </div>
          </div>

          {/* Students */}
          {studentsLoading || reportDataLoading ? (
            <div style={{ color: "#9ca3af", padding: 24 }}>Loading...</div>
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
                          { value: "generated", label: "Generated", color: "#059669" },
                          { value: "notGenerated", label: "Not Generated", color: "#d97706" },
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
                  if (item.key === "dataGenerated") {
                    return (
                      <div key={item.key} style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                        <span style={{ fontSize: "0.7rem", color: "#9ca3af", alignSelf: "center", marginRight: 2 }}>Data:</span>
                        {[
                          { value: "yes", label: "Yes", color: "#059669" },
                          { value: "no", label: "No", color: "#dc2626" },
                        ].map((opt) => {
                          const checked = selectedDataGenerated.has(opt.value);
                          return (
                            <button
                              key={opt.value}
                              onClick={() => {
                                const next = new Set(selectedDataGenerated);
                                if (checked) next.delete(opt.value);
                                else next.add(opt.value);
                                setSelectedDataGenerated(next);
                                if (next.size > 0) toggleFilter("dataGenerated", true);
                                else toggleFilter("dataGenerated", false);
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
                  {visibleSelectedCount > 0 && (
                    <span style={{ fontWeight: 600, color: "#4361ee", marginLeft: 8 }}>
                      ({visibleSelectedCount} selected)
                    </span>
                  )}
                </span>
                <button
                  className="btn btn-sm"
                  onClick={handleGenerateReports}
                  disabled={displayedStudents.length === 0 || generating}
                  style={{
                    background: generating
                      ? "#6c757d"
                      : "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                    border: "none", borderRadius: 8, padding: "8px 20px",
                    fontWeight: 600, color: "white", fontSize: "0.85rem",
                    boxShadow: generating ? "none" : "0 4px 12px rgba(67, 97, 238, 0.3)",
                  }}
                >
                  {generating ? "Generating..." : (
                    <>
                      Generate Reports
                      {visibleSelectedCount > 0
                        ? ` (${visibleSelectedCount} selected)`
                        : ` (All ${displayedStudents.length})`}
                    </>
                  )}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={async () => {
                    if (!selectedAssessment) return;
                    const visibleIds = new Set(displayedStudents.map((s) => s.userStudentId));
                    const selectedVisible = Array.from(selectedStudentIds).filter((id) => visibleIds.has(id));
                    setExportingOMR(true);
                    try {
                      if (selectedVisible.length === 1) {
                        // Single student selected → per-student export
                        const res = await exportGeneralAssessmentExcelForStudent(
                          Number(selectedAssessment), selectedVisible[0]
                        );
                        const url = window.URL.createObjectURL(new Blob([res.data]));
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `general_assessment_${selectedAssessment}_student_${selectedVisible[0]}.xlsx`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                      } else {
                        // No selection or multiple → export all
                        const res = await exportGeneralAssessmentExcel(Number(selectedAssessment));
                        const url = window.URL.createObjectURL(new Blob([res.data]));
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `general_assessment_${selectedAssessment}.xlsx`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                      }
                    } catch (err: any) {
                      showErrorToast("Export failed: " + (err?.response?.data?.error || err.message));
                    } finally {
                      setExportingOMR(false);
                    }
                  }}
                  disabled={exportingOMR}
                  style={{
                    background: exportingOMR
                      ? "#6c757d"
                      : "linear-gradient(135deg, #0d9488 0%, #065f46 100%)",
                    border: "none", borderRadius: 8, padding: "8px 20px",
                    fontWeight: 600, color: "white", fontSize: "0.85rem",
                    boxShadow: exportingOMR ? "none" : "0 4px 12px rgba(13, 148, 136, 0.3)",
                  }}
                >
                  {exportingOMR ? "Exporting..." : (
                    <>
                      Export OMR Data
                      {visibleSelectedCount === 1
                        ? ` (1 selected)`
                        : visibleSelectedCount > 1
                        ? ` (${visibleSelectedCount} selected)`
                        : ` (All)`}
                    </>
                  )}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={async () => {
                    if (!selectedAssessment) return;
                    const visibleIds = new Set(displayedStudents.map((s) => s.userStudentId));
                    const selectedVisible = Array.from(selectedStudentIds).filter((id) => visibleIds.has(id));
                    setExportingMQT(true);
                    try {
                      const res = await exportMqtScoresExcel(
                        Number(selectedAssessment),
                        selectedVisible.length > 0 ? selectedVisible : undefined
                      );
                      const url = window.URL.createObjectURL(new Blob([res.data]));
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `mqt_scores_${selectedAssessment}.xlsx`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      window.URL.revokeObjectURL(url);
                    } catch (err: any) {
                      showErrorToast("Export failed: " + (err?.response?.data?.error || err.message));
                    } finally {
                      setExportingMQT(false);
                    }
                  }}
                  disabled={exportingMQT}
                  style={{
                    background: exportingMQT
                      ? "#6c757d"
                      : "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
                    border: "none", borderRadius: 8, padding: "8px 20px",
                    fontWeight: 600, color: "white", fontSize: "0.85rem",
                    boxShadow: exportingMQT ? "none" : "0 4px 12px rgba(124, 58, 237, 0.3)",
                  }}
                >
                  {exportingMQT ? "Exporting..." : (
                    <>
                      Export MQ/MQT Scores
                      {visibleSelectedCount > 0
                        ? ` (${visibleSelectedCount} selected)`
                        : ` (All)`}
                    </>
                  )}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={async () => {
                    if (!selectedAssessment) return;
                    setExportingBET(true);
                    try {
                      const res = await exportBetReportExcel(Number(selectedAssessment));
                      const url = window.URL.createObjectURL(new Blob([res.data]));
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `bet_report_data_${selectedAssessment}.xlsx`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      window.URL.revokeObjectURL(url);
                    } catch (err: any) {
                      showErrorToast("Export failed: " + (err?.response?.data?.error || err.message));
                    } finally {
                      setExportingBET(false);
                    }
                  }}
                  disabled={exportingBET}
                  style={{
                    background: exportingBET
                      ? "#6c757d"
                      : "linear-gradient(135deg, #e67e22 0%, #d35400 100%)",
                    border: "none", borderRadius: 8, padding: "8px 20px",
                    fontWeight: 600, color: "white", fontSize: "0.85rem",
                    boxShadow: exportingBET ? "none" : "0 4px 12px rgba(230, 126, 34, 0.3)",
                  }}
                >
                  {exportingBET ? "Exporting..." : "Export BET Report"}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={async () => {
                    if (!selectedAssessment) return;
                    const visibleIds = new Set(displayedStudents.map((s) => s.userStudentId));
                    const selectedVisible = Array.from(selectedStudentIds).filter((id) => visibleIds.has(id));
                    // Get students with generated reports
                    const ids = (selectedVisible.length > 0 ? selectedVisible : displayedStudents.map((s) => s.userStudentId))
                      .filter((id) => {
                        const rd = reportDataMap.get(id);
                        return rd && rd.reportStatus === "generated" && rd.reportUrl;
                      });
                    if (ids.length === 0) { showErrorToast("No students with generated reports found."); return; }
                    setDownloadingZip(true);
                    setZipProgress(null);
                    try {
                      const res = await getBetReportUrls(Number(selectedAssessment), ids);
                      const students = res.data.reports.map((r: any) => ({ userStudentId: r.userStudentId, fileName: r.fileName }));
                      await downloadReportsAsZip(
                        students,
                        `bet_reports_${selectedAssessment}.zip`,
                        (uid) => downloadBetReport(uid, Number(selectedAssessment)),
                        (p) => setZipProgress(p),
                      );
                    } catch (err: any) {
                      showErrorToast("Download failed: " + (err?.response?.data?.error || err.message));
                    } finally {
                      setDownloadingZip(false);
                      setZipProgress(null);
                    }
                  }}
                  disabled={downloadingZip}
                  style={{
                    background: downloadingZip
                      ? "#6c757d"
                      : "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    border: "none", borderRadius: 8, padding: "8px 20px",
                    fontWeight: 600, color: "white", fontSize: "0.85rem",
                    boxShadow: downloadingZip ? "none" : "0 4px 12px rgba(5, 150, 105, 0.3)",
                  }}
                >
                  {downloadingZip ? "Preparing ZIP..." : (
                    <>
                      Download ZIP (PDF)
                      {visibleSelectedCount > 0
                        ? ` (${visibleSelectedCount} selected)`
                        : ` (All)`}
                    </>
                  )}
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
                      <th style={thStyle}>Data</th>
                      <th style={thStyle}>Report Status</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStudents.map((s, idx) => {
                      const globalIdx = (safeCurrentPage - 1) * pageSize + idx;
                      const secInfo = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined;
                      const rd = reportDataMap.get(s.userStudentId);
                      const hasData = !!rd;
                      const reportStatus = rd?.reportStatus || "notGenerated";
                      const reportUrl = rd?.reportUrl || null;

                      const statusColors: Record<string, { bg: string; color: string }> = {
                        generated: { bg: "#dcfce7", color: "#059669" },
                        notGenerated: { bg: "#fef3c7", color: "#d97706" },
                      };
                      const colors = statusColors[reportStatus] || statusColors.notGenerated;
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
                              background: hasData ? "#dcfce7" : "#fee2e2",
                              color: hasData ? "#059669" : "#dc2626",
                              padding: "3px 10px", borderRadius: 6,
                              fontWeight: 600, fontSize: "0.75rem",
                            }}>
                              {hasData ? "Yes" : "No"}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              background: colors.bg, color: colors.color,
                              padding: "3px 10px", borderRadius: 6,
                              fontWeight: 600, fontSize: "0.75rem",
                            }}>
                              {reportStatus === "generated" ? "Generated" : "Not Generated"}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {reportUrl && (
                                <>
                                  <a
                                    href={reportUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      padding: "3px 10px", borderRadius: 6, fontSize: "0.75rem",
                                      fontWeight: 600, background: "#dbeafe", color: "#2563eb",
                                      textDecoration: "none",
                                    }}
                                  >
                                    Preview
                                  </a>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await downloadReportAsPdf(
                                          () => downloadBetReport(s.userStudentId, Number(selectedAssessment)),
                                          `${s.name || "report"}_bet_report.pdf`
                                        );
                                      } catch (e: any) {
                                        console.error("Download failed", e);
                                        showErrorToast("Download failed: " + (e?.response?.data?.error || e.message));
                                      }
                                    }}
                                    style={{
                                      padding: "3px 10px", borderRadius: 6, fontSize: "0.75rem",
                                      fontWeight: 600, background: "#f0fdf4", color: "#059669",
                                      border: "none", cursor: "pointer",
                                    }}
                                  >
                                    Download PDF
                                  </button>
                                </>
                              )}
                              <button
                                onClick={async () => {
                                  if (!selectedAssessment) return;
                                  setExportingStudentId(s.userStudentId);
                                  try {
                                    const res = await exportGeneralAssessmentExcelForStudent(
                                      Number(selectedAssessment), s.userStudentId
                                    );
                                    const url = window.URL.createObjectURL(new Blob([res.data]));
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = `${(s.name || "student").replace(/\s+/g, "_")}_OMR_${s.userStudentId}.xlsx`;
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                    window.URL.revokeObjectURL(url);
                                  } catch (err: any) {
                                    showErrorToast("Export failed: " + (err?.response?.data?.error || err.message));
                                  } finally {
                                    setExportingStudentId(null);
                                  }
                                }}
                                disabled={exportingStudentId === s.userStudentId}
                                style={{
                                  padding: "3px 10px", borderRadius: 6, fontSize: "0.75rem",
                                  fontWeight: 600, background: "#f0fdfa", color: "#0d9488",
                                  border: "none", cursor: "pointer",
                                }}
                              >
                                {exportingStudentId === s.userStudentId ? "..." : "OMR"}
                              </button>
                            </div>
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

      {/* ZIP Progress Modal */}
      {downloadingZip && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "32px 40px", minWidth: 380, maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem", fontWeight: 700, color: "#1a1a2e" }}>
              {zipProgress?.phase === "fetching" ? "Fetching Reports..." : zipProgress?.phase === "converting" ? "Converting to PDF..." : zipProgress?.phase === "zipping" ? "Creating ZIP..." : "Preparing..."}
            </h3>
            {zipProgress && (
              <>
                <div style={{ background: "#e5e7eb", borderRadius: 8, height: 10, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{
                    height: "100%", borderRadius: 8, transition: "width 0.3s ease",
                    background: zipProgress.phase === "fetching" ? "#3b82f6" : zipProgress.phase === "converting" ? "#8b5cf6" : "#059669",
                    width: `${Math.round((zipProgress.done / zipProgress.total) * 100)}%`,
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#6b7280" }}>
                  <span>{zipProgress.done} / {zipProgress.total}</span>
                  <span>{Math.round((zipProgress.done / zipProgress.total) * 100)}%</span>
                </div>
                {zipProgress.currentName && (
                  <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {zipProgress.currentName}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
