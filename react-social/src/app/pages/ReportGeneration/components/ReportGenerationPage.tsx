import React, { useState, useEffect, useMemo, useCallback } from "react";
import { showErrorToast, showSuccessToast } from '../../../utils/toast';
import { downloadReportAsPdf, downloadReportsAsZip, ZipProgress } from "../utils/htmlToPdf";
import { ReadCollegeList, GetSessionsByInstituteCode } from "../../College/API/College_APIs";
import {
  getAllAssessments,
  getStudentsWithMappingByInstituteId,
  Assessment,
} from "../../StudentInformation/StudentInfo_APIs";
import { getAssessmentMappingsByInstitute } from "../../AssessmentMapping/API/AssessmentMapping_APIs";
import { createOrUpdateGeneratedReport } from "../API/GeneratedReport_APIs";

// ═══════════════════════ CONFIG TYPE ═══════════════════════

export type ReportData = {
  userStudent?: { userStudentId: number };
  reportStatus: string;
  reportUrl?: string | null;
  eligible?: boolean;
  eligibilityIssues?: string | null;
  [key: string]: any;
};

export type ReportGenerationConfig = {
  // Display
  title: string;
  subtitle: string;
  accentColor: string; // e.g., "#4361ee" or "#0d9488"
  placeholderIcon: string; // e.g., "&#x1F4CB;" or "&#x1F9ED;"
  reportFilePrefix: string; // e.g., "bet_report" or "navigator_report"

  // Report type tag for centralized tracking
  typeOfReport: string; // "bet" | "navigator"

  // Features
  hasEligibility: boolean;
  hasReset: boolean;
  dataTabExtraColumns?: (rd: ReportData | undefined) => React.ReactNode;
  dataTabExtraColumnsHeader?: string;
  reportsTabExtraInfo?: (rd: ReportData | undefined) => React.ReactNode;

  // API functions
  api: {
    generateData: (assessmentId: number, ids: number[]) => Promise<any>;
    getByAssessment: (assessmentId: number) => Promise<any>;
    exportExcel: (assessmentId: number) => Promise<any>;
    generateReports: (assessmentId: number, ids: number[]) => Promise<any>;
    exportOMR: (assessmentId: number) => Promise<any>;
    exportOMRStudent: (assessmentId: number, studentId: number) => Promise<any>;
    downloadReport: (userStudentId: number, assessmentId: number) => Promise<any>;
    getReportUrls: (assessmentId: number, userStudentIds: number[]) => Promise<any>;
    resetStudent?: (studentId: number, assessmentId: number) => Promise<any>;
    resetAssessment?: (assessmentId: number) => Promise<any>;
  };

  // Report generation filter (e.g., only eligible for Navigator)
  filterForReportGeneration?: (rd: ReportData) => boolean;
};

// ═══════════════════════ SHARED TYPES ═══════════════════════

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
type ActiveTab = "data" | "reports";

const FILTER_ITEMS: { key: FilterKey; label: string }[] = [
  { key: "grade", label: "Grade / Class" },
  { key: "section", label: "Section" },
  { key: "status", label: "Status" },
  { key: "name", label: "Name" },
];

// ═══════════════════════ COMPONENT ═══════════════════════

const ReportGenerationPage: React.FC<{
  config: ReportGenerationConfig;
  externalInstitute?: number;
  externalAssessment?: number;
}> = ({ config, externalInstitute, externalAssessment }) => {
  const { api, accentColor } = config;
  const hideSelectors = externalInstitute !== undefined && externalAssessment !== undefined;

  const [activeTab, setActiveTab] = useState<ActiveTab>("data");

  // ── Core selections ──
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<number | "">(externalInstitute ?? "");
  const [institutesLoading, setInstitutesLoading] = useState(false);

  const [allAssessments, setAllAssessments] = useState<Assessment[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<number | "">(externalAssessment ?? "");
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);

  // Sync from external props when they change
  useEffect(() => {
    if (externalInstitute !== undefined) setSelectedInstitute(externalInstitute);
  }, [externalInstitute]);
  useEffect(() => {
    if (externalAssessment !== undefined) setSelectedAssessment(externalAssessment);
  }, [externalAssessment]);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sectionLookup, setSectionLookup] = useState<Map<number, SectionInfo>>(new Map());
  const [studentsLoading, setStudentsLoading] = useState(false);

  // ── Report data ──
  const [reportDataMap, setReportDataMap] = useState<Map<number, ReportData>>(new Map());
  const [reportDataLoading, setReportDataLoading] = useState(false);

  // ── Student selection + pagination ──
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ── Filters ──
  const [filterEnabled, setFilterEnabled] = useState<Set<FilterKey>>(new Set());
  const [nameQuery, setNameQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<Set<string>>(new Set());

  // ── Loading states ──
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingOMR, setExportingOMR] = useState(false);
  const [generatingReports, setGeneratingReports] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<ZipProgress | null>(null);
  const [exportingStudentId, setExportingStudentId] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);

  // ── Assessment mapping ──
  const [mappedAssessmentIds, setMappedAssessmentIds] = useState<Set<number> | null>(null);

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

  useEffect(() => {
    if (selectedInstitute === "") { setMappedAssessmentIds(null); return; }
    setAssessmentsLoading(true);
    getAssessmentMappingsByInstitute(Number(selectedInstitute))
      .then((res) => {
        const ids = new Set<number>(
          (res.data || []).filter((m: any) => m.isActive !== false).map((m: any) => Number(m.assessmentId))
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
    if (selectedInstitute === "") { setStudents([]); setSectionLookup(new Map()); return; }
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
              if (!lookup.has(sec.id)) lookup.set(sec.id, { className: cls.className, sectionName: sec.sectionName });
            }
          }
        }
        setSectionLookup(lookup);
      })
      .catch(() => { setStudents([]); setSectionLookup(new Map()); })
      .finally(() => setStudentsLoading(false));
  }, [selectedInstitute]);

  const refreshReportData = useCallback(async () => {
    if (selectedAssessment === "") return;
    const res = await api.getByAssessment(Number(selectedAssessment));
    const map = new Map<number, ReportData>();
    for (const r of res.data || []) {
      const id = r.userStudent?.userStudentId;
      if (id) map.set(id, r);
    }
    setReportDataMap(map);
  }, [selectedAssessment, api]);

  useEffect(() => {
    if (selectedAssessment === "") { setReportDataMap(new Map()); return; }
    setReportDataLoading(true);
    refreshReportData().catch(() => setReportDataMap(new Map())).finally(() => setReportDataLoading(false));
  }, [selectedAssessment, refreshReportData]);

  useEffect(() => {
    setFilterEnabled(new Set()); setNameQuery(""); setSelectedGrade(""); setSelectedSection("");
    setSelectedStatus(new Set<string>()); setSelectedStudentIds(new Set()); setCurrentPage(1);
  }, [selectedInstitute, selectedAssessment]);

  // ═══════════════════════ FILTERING ═══════════════════════

  const assessmentStudents = useMemo(() => {
    if (selectedAssessment === "") return [];
    return students.filter((s) => (s.assignedAssessmentIds || []).includes(Number(selectedAssessment)));
  }, [students, selectedAssessment]);

  const uniqueGrades = useMemo(() => {
    const g = new Set<string>();
    for (const s of assessmentStudents) { const i = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined; if (i?.className) g.add(i.className); }
    return Array.from(g).sort();
  }, [assessmentStudents, sectionLookup]);

  const uniqueSections = useMemo(() => {
    const sec = new Set<string>();
    for (const s of assessmentStudents) { const i = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined; if (i?.sectionName) sec.add(i.sectionName); }
    return Array.from(sec).sort();
  }, [assessmentStudents, sectionLookup]);

  const displayedStudents = useMemo(() => {
    let result = assessmentStudents;
    if (filterEnabled.has("name") && nameQuery.trim()) {
      const q = nameQuery.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q) || (s.username || "").toLowerCase().includes(q) || (s.schoolRollNumber || "").toLowerCase().includes(q));
    }
    if (filterEnabled.has("grade") && selectedGrade) result = result.filter((s) => sectionLookup.get(s.schoolSectionId!)?.className === selectedGrade);
    if (filterEnabled.has("section") && selectedSection) result = result.filter((s) => sectionLookup.get(s.schoolSectionId!)?.sectionName === selectedSection);
    if (filterEnabled.has("status") && selectedStatus.size > 0) {
      if (activeTab === "data") {
        result = result.filter((s) => { const a = (s.assessments || []).find((a) => a.assessmentId === Number(selectedAssessment)); return selectedStatus.has(a?.status || "notstarted"); });
      } else {
        result = result.filter((s) => selectedStatus.has(reportDataMap.get(s.userStudentId)?.reportStatus || "notGenerated"));
      }
    }
    return result;
  }, [assessmentStudents, filterEnabled, nameQuery, selectedGrade, selectedSection, sectionLookup, selectedStatus, selectedAssessment, activeTab, reportDataMap]);

  const totalPages = Math.max(1, Math.ceil(displayedStudents.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedStudents = useMemo(() => displayedStudents.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize), [displayedStudents, safeCurrentPage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [nameQuery, selectedGrade, selectedSection, selectedStatus, filterEnabled]);

  // ═══════════════════════ HELPERS ═══════════════════════

  const toggleFilter = (key: FilterKey, checked: boolean) => {
    setFilterEnabled((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key); else { next.delete(key); if (key === "name") setNameQuery(""); if (key === "grade") setSelectedGrade(""); if (key === "section") setSelectedSection(""); if (key === "status") setSelectedStatus(new Set()); }
      return next;
    });
  };

  const resetFilters = () => { setFilterEnabled(new Set()); setNameQuery(""); setSelectedGrade(""); setSelectedSection(""); setSelectedStatus(new Set<string>()); };

  const getSelectedOrAllIds = () => {
    const visibleIds = new Set(displayedStudents.map((s) => s.userStudentId));
    const sel = Array.from(selectedStudentIds).filter((id) => visibleIds.has(id));
    return sel.length > 0 ? sel : displayedStudents.map((s) => s.userStudentId);
  };

  const downloadBlob = (data: any, filename: string) => {
    const url = window.URL.createObjectURL(new Blob([data]));
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
  };

  // ═══════════════════════ DERIVED ═══════════════════════

  const selectedInstituteName = institutes.find((i) => i.instituteCode === selectedInstitute)?.instituteName || "";
  const selectedAssessmentName = assessments.find((a) => a.id === selectedAssessment)?.assessmentName || "";
  const ready = selectedInstitute !== "" && selectedAssessment !== "";

  const visibleSelectedCount = useMemo(() => {
    const vis = new Set(displayedStudents.map((s) => s.userStudentId));
    return Array.from(selectedStudentIds).filter((id) => vis.has(id)).length;
  }, [selectedStudentIds, displayedStudents]);

  const reportStats = useMemo(() => {
    let generated = 0, notGenerated = 0, hasData = 0, eligible = 0, ineligible = 0;
    for (const s of displayedStudents) {
      const rd = reportDataMap.get(s.userStudentId);
      if (rd) { hasData++; if (rd.reportStatus === "generated") generated++; else notGenerated++; if (rd.eligible) eligible++; else ineligible++; } else { notGenerated++; }
    }
    return { generated, notGenerated, hasData, eligible, ineligible };
  }, [displayedStudents, reportDataMap]);

  const statusOptions = activeTab === "data"
    ? [{ value: "completed", label: "Completed", color: "#059669" }, { value: "ongoing", label: "Ongoing", color: "#2563eb" }, { value: "notstarted", label: "Not Started", color: "#d97706" }]
    : [{ value: "generated", label: "Generated", color: "#059669" }, { value: "notGenerated", label: "Not Generated", color: "#d97706" }];

  const countLabel = (n: number) => visibleSelectedCount > 0 ? ` (${visibleSelectedCount})` : ` (All ${n})`;

  // ═══════════════════════ STYLES ═══════════════════════

  const thStyle: React.CSSProperties = { padding: "10px 14px", fontWeight: 600, color: "#1a1a2e", borderBottom: "2px solid #e0e0e0", whiteSpace: "nowrap", fontSize: "0.85rem" };
  const tdStyle: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid #f0f0f0", whiteSpace: "nowrap", fontSize: "0.85rem" };
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 24px", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer",
    border: "none", borderBottom: active ? `3px solid ${accentColor}` : "3px solid transparent",
    background: "transparent", color: active ? accentColor : "#6b7280",
  });
  const badge = (bg: string, text: string) => (
    <span style={{ background: bg, color: "#fff", padding: "4px 12px", borderRadius: 16, fontSize: "0.8rem", fontWeight: 600 }}>{text}</span>
  );
  const statusBadge = (bg: string, color: string, text: string) => (
    <span style={{ background: bg, color, padding: "3px 10px", borderRadius: 6, fontWeight: 600, fontSize: "0.75rem" }}>{text}</span>
  );
  const actionBtn = (bg: string, color: string, text: string, onClick: () => void, disabled = false) => (
    <button onClick={onClick} disabled={disabled} style={{ padding: "3px 10px", borderRadius: 6, fontSize: "0.75rem", fontWeight: 600, background: bg, color, border: "none", cursor: "pointer", textDecoration: "none" }}>{text}</button>
  );

  // ═══════════════════════ RENDER ═══════════════════════

  return (
    <div style={{ padding: hideSelectors ? 0 : "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      {!hideSelectors && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontWeight: 800, fontSize: "1.5rem", color: "#1a1a2e", margin: 0 }}>{config.title}</h2>
          <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: "4px 0 0" }}>{config.subtitle}</p>
        </div>
      )}

      {/* Selection Row */}
      {!hideSelectors && (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24, background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div>
          <label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151", marginBottom: 6, display: "block" }}>School / Institute</label>
          {institutesLoading ? <div style={{ color: "#9ca3af", padding: "8px 0" }}>Loading...</div> : (
            <select className="form-select form-select-solid" value={selectedInstitute}
              onChange={(e) => { setSelectedInstitute(e.target.value === "" ? "" : Number(e.target.value)); setSelectedAssessment(""); }}>
              <option value="">-- Select a school --</option>
              {institutes.map((inst) => <option key={inst.instituteCode} value={inst.instituteCode}>{inst.instituteName}</option>)}
            </select>
          )}
        </div>
        <div>
          <label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151", marginBottom: 6, display: "block" }}>Assessment</label>
          {assessmentsLoading ? <div style={{ color: "#9ca3af", padding: "8px 0" }}>Loading...</div> : (
            <select className="form-select form-select-solid" value={selectedAssessment} disabled={selectedInstitute === ""}
              onChange={(e) => setSelectedAssessment(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">-- Select an assessment --</option>
              {assessments.map((a) => <option key={a.id} value={a.id}>{a.assessmentName}</option>)}
            </select>
          )}
        </div>
      </div>
      )}

      {!ready && !hideSelectors && (
        <div style={{ padding: 48, textAlign: "center", color: "#9ca3af", border: "2px dashed #e5e7eb", borderRadius: 12, background: "#fff" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8, opacity: 0.4 }} dangerouslySetInnerHTML={{ __html: config.placeholderIcon }} />
          <div>Select a school and assessment to get started</div>
        </div>
      )}

      {ready && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          {/* Tabs */}
          <div style={{ borderBottom: "1px solid #e5e7eb", display: "flex", padding: "0 24px" }}>
            <button style={tabStyle(activeTab === "data")} onClick={() => { setActiveTab("data"); setSelectedStatus(new Set()); toggleFilter("status", false); }}>Data Generation</button>
            <button style={tabStyle(activeTab === "reports")} onClick={() => { setActiveTab("reports"); setSelectedStatus(new Set()); toggleFilter("status", false); }}>Reports ({reportStats.generated})</button>
          </div>

          <div style={{ padding: 24 }}>
            {/* Summary */}
            <div style={{ padding: "12px 20px", background: accentColor + "10", borderRadius: 10, display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, color: accentColor }}>{selectedInstituteName}</span>
              <span style={{ color: "#cbd5e1" }}>/</span>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>{selectedAssessmentName}</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {badge(accentColor, `${assessmentStudents.length} students`)}
                {config.hasEligibility && reportStats.hasData > 0 && (
                  <>{badge("#059669", `${reportStats.eligible} eligible`)}{reportStats.ineligible > 0 && badge("#d97706", `${reportStats.ineligible} ineligible`)}</>
                )}
                {activeTab === "reports" && badge("#4361ee", `${reportStats.generated} reports`)}
              </div>
            </div>

            {studentsLoading || (activeTab === "reports" && reportDataLoading) ? (
              <div style={{ color: "#9ca3af", padding: 24 }}>Loading...</div>
            ) : (
              <>
                {/* Filters */}
                <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                  {FILTER_ITEMS.map((item) => {
                    if (item.key === "name") return (
                      <div key={item.key} style={{ flex: "1 1 200px", minWidth: 180 }}>
                        <label style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Search</label>
                        <input className="form-control form-control-sm form-control-solid" placeholder="Name, roll no..."
                          value={nameQuery} onChange={(e) => { setNameQuery(e.target.value); if (e.target.value && !filterEnabled.has("name")) toggleFilter("name", true); }} />
                      </div>
                    );
                    if (item.key === "grade") return (
                      <div key={item.key} style={{ minWidth: 140 }}>
                        <label style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>{item.label}</label>
                        <select className="form-select form-select-sm form-select-solid" value={selectedGrade}
                          onChange={(e) => { setSelectedGrade(e.target.value); toggleFilter("grade", !!e.target.value); }}>
                          <option value="">All</option>
                          {uniqueGrades.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                    );
                    if (item.key === "section") return (
                      <div key={item.key} style={{ minWidth: 140 }}>
                        <label style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>{item.label}</label>
                        <select className="form-select form-select-sm form-select-solid" value={selectedSection}
                          onChange={(e) => { setSelectedSection(e.target.value); toggleFilter("section", !!e.target.value); }}>
                          <option value="">All</option>
                          {uniqueSections.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    );
                    if (item.key === "status") return (
                      <div key={item.key} style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                        {statusOptions.map((opt) => {
                          const checked = selectedStatus.has(opt.value);
                          return <button key={opt.value} onClick={() => {
                            const next = new Set(selectedStatus); if (checked) next.delete(opt.value); else next.add(opt.value);
                            setSelectedStatus(next); toggleFilter("status", next.size > 0);
                          }} style={{
                            padding: "4px 10px", borderRadius: 6, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                            border: `1.5px solid ${checked ? opt.color : "#e5e7eb"}`, background: checked ? opt.color + "18" : "#fff", color: checked ? opt.color : "#6b7280",
                          }}>{opt.label}</button>;
                        })}
                      </div>
                    );
                    return null;
                  })}
                  {filterEnabled.size > 0 && <button onClick={resetFilters} style={{ padding: "4px 12px", borderRadius: 6, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", border: "1.5px solid #e5e7eb", background: "#fff", color: "#ef4444", alignSelf: "flex-end" }}>Clear</button>}
                </div>

                {/* Action bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                    {displayedStudents.length} student(s)
                    {visibleSelectedCount > 0 && <span style={{ fontWeight: 600, color: accentColor, marginLeft: 8 }}>({visibleSelectedCount} selected)</span>}
                  </span>

                  {activeTab === "data" && (
                    <>
                      <button className="btn btn-sm" disabled={displayedStudents.length === 0 || generating}
                        style={{ background: generating ? "#6c757d" : `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`, border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 600, color: "white", fontSize: "0.85rem" }}
                        onClick={async () => {
                          setGenerating(true);
                          try {
                            const res = await api.generateData(Number(selectedAssessment), getSelectedOrAllIds());
                            const { generated, errors } = res.data;
                            showSuccessToast(`Generated data for ${generated} student(s).${errors.length > 0 ? `\n${errors.length} skipped.` : ""}`);
                            await refreshReportData();
                          } catch (err: any) { showErrorToast("Failed: " + (err?.response?.data?.error || err.message)); }
                          finally { setGenerating(false); }
                        }}>
                        {generating ? "Generating..." : `Generate Data${countLabel(displayedStudents.length)}`}
                      </button>
                      <button className="btn btn-sm btn-success" disabled={exporting}
                        onClick={async () => {
                          setExporting(true);
                          try { const res = await api.exportExcel(Number(selectedAssessment)); downloadBlob(res.data, `${config.reportFilePrefix}_data.xlsx`); }
                          catch (err: any) { showErrorToast("Export failed: " + (err?.response?.data?.error || err.message)); }
                          finally { setExporting(false); }
                        }}>
                        {exporting ? "Exporting..." : "Export XLSX"}
                      </button>
                      {config.hasReset && (
                        <button className="btn btn-sm btn-outline-danger" disabled={resetting}
                          onClick={async () => {
                            if (!window.confirm("Reset ALL report data for this assessment? This cannot be undone.")) return;
                            setResetting(true);
                            try { await api.resetAssessment!(Number(selectedAssessment)); showSuccessToast("Report data reset."); await refreshReportData(); }
                            catch (err: any) { showErrorToast("Reset failed: " + (err?.response?.data?.error || err.message)); }
                            finally { setResetting(false); }
                          }}>
                          {resetting ? "Resetting..." : "Reset All Data"}
                        </button>
                      )}
                    </>
                  )}

                  {activeTab === "reports" && (
                    <>
                      <button className="btn btn-sm" disabled={displayedStudents.length === 0 || generatingReports}
                        style={{ background: generatingReports ? "#6c757d" : `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`, border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 600, color: "white", fontSize: "0.85rem" }}
                        onClick={async () => {
                          let ids = getSelectedOrAllIds().filter((id) => reportDataMap.has(id));
                          if (config.filterForReportGeneration) ids = ids.filter((id) => config.filterForReportGeneration!(reportDataMap.get(id)!));
                          if (ids.length === 0) { showErrorToast("No eligible students with report data. Generate data first."); return; }
                          setGeneratingReports(true);
                          try {
                            const res = await api.generateReports(Number(selectedAssessment), ids);
                            const { generated, errors, reports } = res.data;
                            // Sync successful reports to centralized generated_report table
                            const successReports = (reports || []).filter((r: any) => r.reportUrl);
                            for (const r of successReports) {
                              createOrUpdateGeneratedReport({
                                userStudentId: r.userStudentId,
                                assessmentId: Number(selectedAssessment),
                                typeOfReport: config.typeOfReport,
                                reportStatus: "generated",
                                reportUrl: r.reportUrl,
                              }).catch(() => {}); // fire-and-forget, don't block UI
                            }
                            // Track failed ones too
                            for (const e of errors || []) {
                              createOrUpdateGeneratedReport({
                                userStudentId: e.userStudentId,
                                assessmentId: Number(selectedAssessment),
                                typeOfReport: config.typeOfReport,
                                reportStatus: "failed",
                              }).catch(() => {});
                            }
                            // Auto-download any reports that failed DO Spaces upload
                            const fallbacks = (reports || []).filter((r: any) => r.downloadFallback);
                            for (const fb of fallbacks) {
                              const a = document.createElement("a");
                              a.href = fb.reportUrl;
                              a.download = fb.fileName || `report_${fb.userStudentId}.html`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            }
                            const uploaded = generated - fallbacks.length;
                            const errorDetails = errors.length > 0 ? errors.map((e: any) => `Student ${e.userStudentId}: ${e.reason}`).join("\n") : "";
                            const fallbackMsg = fallbacks.length > 0 ? `\n${fallbacks.length} downloaded directly (cloud upload unavailable).` : "";
                            showSuccessToast(`Generated ${generated} report(s).${fallbackMsg}${errors.length > 0 ? `\n${errors.length} failed:\n${errorDetails}` : ""}`);
                            await refreshReportData();
                          } catch (err: any) { showErrorToast("Failed: " + (err?.response?.data?.error || err.message)); }
                          finally { setGeneratingReports(false); }
                        }}>
                        {generatingReports ? "Generating..." : `Generate Reports${countLabel(displayedStudents.length)}`}
                      </button>
                      <button className="btn btn-sm" disabled={downloadingZip || displayedStudents.length === 0}
                        style={{ background: downloadingZip ? "#6c757d" : "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)", border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 600, color: "white", fontSize: "0.85rem" }}
                        onClick={async () => {
                          let ids = getSelectedOrAllIds().filter((id) => {
                            const rd = reportDataMap.get(id);
                            return rd && rd.reportStatus === "generated" && rd.reportUrl;
                          });
                          if (ids.length === 0) { showErrorToast("No students with generated reports found."); return; }
                          setDownloadingZip(true);
                          setZipProgress(null);
                          try {
                            const res = await api.getReportUrls(Number(selectedAssessment), ids);
                            const students = res.data.reports.map((r: any) => ({ userStudentId: r.userStudentId, fileName: r.fileName }));
                            await downloadReportsAsZip(
                              students,
                              `${config.reportFilePrefix}_reports.zip`,
                              (uid) => api.downloadReport(uid, Number(selectedAssessment)),
                              (p) => setZipProgress(p),
                            );
                          } catch (err: any) { showErrorToast("Download failed: " + (err?.response?.data?.error || err.message)); }
                          finally { setDownloadingZip(false); setZipProgress(null); }
                        }}>
                        {downloadingZip ? "Preparing ZIP..." : `Download ZIP (PDF)${countLabel(displayedStudents.length)}`}
                      </button>
                    </>
                  )}

                  <button className="btn btn-sm btn-info" disabled={exportingOMR} onClick={async () => {
                    const visIds = new Set(displayedStudents.map((s) => s.userStudentId));
                    const sel = Array.from(selectedStudentIds).filter((id) => visIds.has(id));
                    setExportingOMR(true);
                    try {
                      if (sel.length === 1) { const res = await api.exportOMRStudent(Number(selectedAssessment), sel[0]); downloadBlob(res.data, `general_assessment_${selectedAssessment}_student_${sel[0]}.xlsx`); }
                      else { const res = await api.exportOMR(Number(selectedAssessment)); downloadBlob(res.data, `general_assessment_${selectedAssessment}.xlsx`); }
                    } catch (err: any) { showErrorToast("Export failed: " + (err?.response?.data?.error || err.message)); }
                    finally { setExportingOMR(false); }
                  }}>
                    {exportingOMR ? "Exporting..." : `Export OMR${visibleSelectedCount === 1 ? " (1)" : visibleSelectedCount > 1 ? ` (${visibleSelectedCount})` : " (All)"}`}
                  </button>
                </div>

                {/* Table */}
                <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th style={{ ...thStyle, width: 40 }}>
                          <input type="checkbox"
                            checked={paginatedStudents.length > 0 && paginatedStudents.every((s) => selectedStudentIds.has(s.userStudentId))}
                            onChange={(e) => setSelectedStudentIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) paginatedStudents.forEach((s) => next.add(s.userStudentId));
                              else paginatedStudents.forEach((s) => next.delete(s.userStudentId));
                              return next;
                            })} />
                        </th>
                        <th style={{ ...thStyle, width: 44 }}>#</th>
                        <th style={thStyle}>Name</th>
                        <th style={thStyle}>Roll No.</th>
                        <th style={thStyle}>Grade</th>
                        <th style={thStyle}>Section</th>
                        {activeTab === "data" && <th style={thStyle}>Status</th>}
                        {activeTab === "data" && config.hasEligibility && <th style={thStyle}>Eligible</th>}
                        {activeTab === "data" && config.dataTabExtraColumns && <th style={thStyle}>{config.dataTabExtraColumnsHeader || "Info"}</th>}
                        {activeTab === "reports" && config.hasEligibility && <th style={thStyle}>Eligible</th>}
                        {activeTab === "reports" && <th style={thStyle}>Report</th>}
                        {activeTab === "reports" && <th style={thStyle}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedStudents.map((s, idx) => {
                        const globalIdx = (safeCurrentPage - 1) * pageSize + idx;
                        const secInfo = s.schoolSectionId ? sectionLookup.get(s.schoolSectionId) : undefined;
                        const isChecked = selectedStudentIds.has(s.userStudentId);
                        const rd = reportDataMap.get(s.userStudentId);

                        return (
                          <tr key={s.userStudentId} style={{ background: globalIdx % 2 === 0 ? "#fff" : "#f9fafb" }}>
                            <td style={tdStyle}><input type="checkbox" checked={isChecked} onChange={(e) => setSelectedStudentIds((prev) => { const n = new Set(prev); if (e.target.checked) n.add(s.userStudentId); else n.delete(s.userStudentId); return n; })} /></td>
                            <td style={tdStyle}>{globalIdx + 1}</td>
                            <td style={tdStyle}><span style={{ fontWeight: 600 }}>{s.name || "-"}</span></td>
                            <td style={tdStyle}>{s.schoolRollNumber || "-"}</td>
                            <td style={tdStyle}>{secInfo?.className || "-"}</td>
                            <td style={tdStyle}>{secInfo?.sectionName || "-"}</td>

                            {activeTab === "data" && (() => {
                              const asmtInfo = (s.assessments || []).find((a) => a.assessmentId === Number(selectedAssessment));
                              const status = asmtInfo?.status || "notstarted";
                              const sc: Record<string, { bg: string; color: string }> = { completed: { bg: "#dcfce7", color: "#059669" }, ongoing: { bg: "#dbeafe", color: "#2563eb" }, notstarted: { bg: "#fef3c7", color: "#d97706" } };
                              const c = sc[status] || sc.notstarted;
                              return (
                                <>
                                  <td style={tdStyle}>{statusBadge(c.bg, c.color, status)}</td>
                                  {config.hasEligibility && (
                                    <td style={tdStyle}>{rd ? statusBadge(rd.eligible ? "#dcfce7" : "#fee2e2", rd.eligible ? "#059669" : "#dc2626", rd.eligible ? "Yes" : "No") : <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>-</span>}</td>
                                  )}
                                  {config.dataTabExtraColumns && <td style={tdStyle}>{config.dataTabExtraColumns(rd)}</td>}
                                </>
                              );
                            })()}

                            {activeTab === "reports" && (() => {
                              const reportStatus = rd?.reportStatus || "notGenerated";
                              const reportUrl = rd?.reportUrl || null;
                              const c = reportStatus === "generated" ? { bg: "#dcfce7", color: "#059669" } : { bg: "#fef3c7", color: "#d97706" };
                              return (
                                <>
                                  {config.hasEligibility && (
                                    <td style={tdStyle}>{rd ? statusBadge(rd.eligible ? "#dcfce7" : "#fee2e2", rd.eligible ? "#059669" : "#dc2626", rd.eligible ? "Eligible" : "Ineligible") : <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>No data</span>}</td>
                                  )}
                                  <td style={tdStyle}>{statusBadge(c.bg, c.color, reportStatus === "generated" ? "Generated" : "Not Generated")}</td>
                                  <td style={tdStyle}>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                      {reportUrl && (
                                        <>
                                          <a href={reportUrl} target="_blank" rel="noopener noreferrer" style={{ padding: "3px 10px", borderRadius: 6, fontSize: "0.75rem", fontWeight: 600, background: "#dbeafe", color: "#2563eb", textDecoration: "none" }}>Preview</a>
                                          {actionBtn("#f0fdf4", "#059669", "Download PDF", async () => {
                                            try { await downloadReportAsPdf(() => api.downloadReport(s.userStudentId, Number(selectedAssessment)), `${s.name || "report"}_${config.reportFilePrefix}.pdf`); } catch (e) { console.error("Download failed", e); showErrorToast("Download failed: " + (e instanceof Error ? e.message : "Unknown error")); }
                                          })}
                                        </>
                                      )}
                                      {actionBtn("#f0fdfa", "#0d9488", exportingStudentId === s.userStudentId ? "..." : "OMR", async () => {
                                        setExportingStudentId(s.userStudentId);
                                        try { const res = await api.exportOMRStudent(Number(selectedAssessment), s.userStudentId); downloadBlob(res.data, `${(s.name || "student").replace(/\s+/g, "_")}_OMR_${s.userStudentId}.xlsx`); }
                                        catch (err: any) { showErrorToast("Export failed: " + (err?.response?.data?.error || err.message)); }
                                        finally { setExportingStudentId(null); }
                                      }, exportingStudentId === s.userStudentId)}
                                      {config.hasReset && rd && actionBtn("#fee2e2", "#dc2626", "Reset", async () => {
                                        if (!window.confirm(`Reset report data for ${s.name}?`)) return;
                                        try { await api.resetStudent!(s.userStudentId, Number(selectedAssessment)); await refreshReportData(); }
                                        catch (err: any) { showErrorToast("Reset failed: " + (err?.response?.data?.error || err.message)); }
                                      })}
                                    </div>
                                  </td>
                                </>
                              );
                            })()}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                        {(safeCurrentPage - 1) * pageSize + 1}-{Math.min(safeCurrentPage * pageSize, displayedStudents.length)} of {displayedStudents.length}
                      </span>
                      <select className="form-select form-select-sm form-select-solid" style={{ width: 68, fontSize: "0.8rem" }}
                        value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}>
                        {[25, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-sm btn-light" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(1)} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>First</button>
                      <button className="btn btn-sm btn-light" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>Prev</button>
                      {(() => {
                        const pages: (number | string)[] = []; const maxV = 5;
                        let start = Math.max(1, safeCurrentPage - Math.floor(maxV / 2));
                        let end = Math.min(totalPages, start + maxV - 1);
                        if (end - start + 1 < maxV) start = Math.max(1, end - maxV + 1);
                        if (start > 1) { pages.push(1); if (start > 2) pages.push("..."); }
                        for (let i = start; i <= end; i++) pages.push(i);
                        if (end < totalPages) { if (end < totalPages - 1) pages.push("..."); pages.push(totalPages); }
                        return pages.map((p, i) => typeof p === "string"
                          ? <span key={`e-${i}`} style={{ padding: "4px 4px", color: "#9ca3af", fontSize: "0.8rem" }}>...</span>
                          : <button key={p} className={`btn btn-sm ${p === safeCurrentPage ? "btn-primary" : "btn-light"}`} onClick={() => setCurrentPage(p)} style={{ padding: "4px 10px", fontSize: "0.8rem", minWidth: 32 }}>{p}</button>
                        );
                      })()}
                      <button className="btn btn-sm btn-light" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>Next</button>
                      <button className="btn btn-sm btn-light" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(totalPages)} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>Last</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
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

export default ReportGenerationPage;
