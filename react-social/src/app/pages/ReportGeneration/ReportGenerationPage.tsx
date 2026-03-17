import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ReadCollegeList, GetSessionsByInstituteCode } from "../College/API/College_APIs";
import {
  getAllAssessments,
  getStudentsWithMappingByInstituteId,
  Assessment,
} from "../StudentInformation/StudentInfo_APIs";
import {
  ReportTemplate,
  AvailableField,
  uploadTemplate,
  getTemplatesByAssessment,
  updateTemplate,
  deleteTemplate,
  parsePlaceholders,
  getAvailableFields,
  previewReport,
  generatePdf,
  generatePdfBulk,
} from "./API/ReportTemplate_APIs";

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
type ActiveTab = "students" | "templates" | "mapping" | "preview";

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

  // ── Tab ──
  const [activeTab, setActiveTab] = useState<ActiveTab>("students");

  // ── Student selection ──
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ── Filters ──
  const [activeFilterItem, setActiveFilterItem] = useState<FilterKey>("grade");
  const [filterEnabled, setFilterEnabled] = useState<Set<FilterKey>>(new Set());
  const [nameQuery, setNameQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<Set<string>>(new Set());

  // ── Templates ──
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Mapping ──
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [availableFields, setAvailableFields] = useState<AvailableField[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [mappingLoading, setMappingLoading] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);

  // ── Preview ──
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewStudentId, setPreviewStudentId] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Generate ──
  const [generating, setGenerating] = useState(false);

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

  // Load templates when assessment changes
  const loadTemplates = useCallback(() => {
    if (selectedAssessment === "") {
      setTemplates([]);
      return;
    }
    setTemplatesLoading(true);
    getTemplatesByAssessment(Number(selectedAssessment))
      .then((res) => setTemplates(res.data || []))
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
  }, [selectedAssessment]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Reset on selection change
  useEffect(() => {
    setFilterEnabled(new Set());
    setActiveFilterItem("grade");
    setNameQuery("");
    setSelectedGrade("");
    setSelectedSection("");
    setSelectedStatus(new Set<string>());
    setSelectedStudentIds(new Set());
    setCurrentPage(1);
    setSelectedTemplate(null);
    setPlaceholders([]);
    setMappings({});
    setPreviewHtml("");
    setPreviewStudentId(null);
    setActiveTab("students");
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
    setActiveFilterItem("grade");
    setNameQuery("");
    setSelectedGrade("");
    setSelectedSection("");
    setSelectedStatus(new Set<string>());
  };

  const handleUploadTemplate = async () => {
    if (!uploadFile || !uploadName.trim() || selectedAssessment === "") return;
    setUploading(true);
    try {
      await uploadTemplate(uploadFile, uploadName.trim(), Number(selectedAssessment));
      setUploadName("");
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadTemplates();
    } catch (err: any) {
      alert("Upload failed: " + (err?.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!window.confirm("Delete this template?")) return;
    try {
      await deleteTemplate(id);
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
        setPlaceholders([]);
        setMappings({});
      }
      loadTemplates();
    } catch {
      alert("Delete failed");
    }
  };

  const handleSelectTemplate = async (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setMappingLoading(true);
    setPreviewHtml("");
    try {
      const [phRes, fieldsRes] = await Promise.all([
        parsePlaceholders(template.id),
        getAvailableFields(),
      ]);
      setPlaceholders(phRes.data.placeholders || []);
      setAvailableFields(fieldsRes.data || []);

      // Load existing mappings
      if (template.fieldMappings) {
        try {
          setMappings(JSON.parse(template.fieldMappings));
        } catch {
          setMappings({});
        }
      } else {
        // Auto-map: try to match placeholders to field keys
        const autoMap: Record<string, string> = {};
        const fieldKeys = (fieldsRes.data || []).map((f: AvailableField) => f.key);
        for (const ph of phRes.data.placeholders || []) {
          // Direct match
          if (fieldKeys.includes(ph)) {
            autoMap[ph] = ph;
          } else {
            // Try common patterns: studentName -> student.name
            const dotted = ph.replace(/([A-Z])/g, ".$1").toLowerCase();
            if (fieldKeys.includes(dotted)) {
              autoMap[ph] = dotted;
            }
          }
        }
        setMappings(autoMap);
      }
      setActiveTab("mapping");
    } catch (err: any) {
      alert("Failed to parse template: " + (err?.response?.data?.error || err.message));
    } finally {
      setMappingLoading(false);
    }
  };

  const handleSaveMappings = async () => {
    if (!selectedTemplate) return;
    setSavingMappings(true);
    try {
      const res = await updateTemplate(selectedTemplate.id, {
        fieldMappings: JSON.stringify(mappings),
      });
      setSelectedTemplate(res.data);
      loadTemplates();
      alert("Mappings saved!");
    } catch {
      alert("Failed to save mappings");
    } finally {
      setSavingMappings(false);
    }
  };

  const handlePreview = async (studentId: number) => {
    if (!selectedTemplate || selectedAssessment === "") return;
    setPreviewLoading(true);
    setPreviewStudentId(studentId);
    setActiveTab("preview");
    try {
      // Save mappings first if unsaved
      if (selectedTemplate.fieldMappings !== JSON.stringify(mappings)) {
        await updateTemplate(selectedTemplate.id, {
          fieldMappings: JSON.stringify(mappings),
        });
      }
      const res = await previewReport(
        selectedTemplate.id, studentId, Number(selectedAssessment)
      );
      setPreviewHtml(res.data.html);
    } catch (err: any) {
      alert("Preview failed: " + (err?.response?.data?.error || err.message));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadPdf = async (studentId: number) => {
    if (!selectedTemplate || selectedAssessment === "") return;
    setGenerating(true);
    try {
      const res = await generatePdf(
        selectedTemplate.id, studentId, Number(selectedAssessment)
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_${studentId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("PDF generation failed: " + (err?.response?.data?.error || err.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkDownload = async () => {
    if (!selectedTemplate || selectedAssessment === "" || selectedStudentIds.size === 0) return;
    setGenerating(true);
    try {
      const ids = Array.from(selectedStudentIds);
      const res = await generatePdfBulk(
        selectedTemplate.id, Number(selectedAssessment), ids
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `bulk_reports_${ids.length}_students.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Bulk PDF failed: " + (err?.response?.data?.error || err.message));
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

  // ═══════════════════════ STYLES ═══════════════════════

  const thStyle: React.CSSProperties = {
    padding: "10px 14px", fontWeight: 600, color: "#1a1a2e",
    borderBottom: "2px solid #e0e0e0", whiteSpace: "nowrap", fontSize: "0.85rem",
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 14px", borderBottom: "1px solid #f0f0f0", whiteSpace: "nowrap", fontSize: "0.85rem",
  };

  const tabStyle = (tab: ActiveTab): React.CSSProperties => ({
    padding: "10px 20px",
    cursor: "pointer",
    fontWeight: activeTab === tab ? 700 : 400,
    color: activeTab === tab ? "#4361ee" : "#6b7280",
    borderBottom: activeTab === tab ? "3px solid #4361ee" : "3px solid transparent",
    fontSize: "0.9rem",
    transition: "all 0.15s",
    background: "transparent",
    border: "none",
    borderBottomStyle: "solid",
  });

  // ═══════════════════════ RENDER ═══════════════════════

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontWeight: 800, fontSize: "1.5rem", color: "#1a1a2e", margin: 0 }}>
          Report Generation
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: "4px 0 0" }}>
          Upload HTML templates, map data fields, and generate PDF reports
        </p>
      </div>

      {/* Selection Row */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24,
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
          border: "2px dashed #e5e7eb", borderRadius: 12,
        }}>
          <div style={{ fontSize: "2rem", marginBottom: 8, opacity: 0.4 }}>&#x1F4CB;</div>
          <div>Select a school and assessment to get started</div>
        </div>
      )}

      {ready && (
        <>
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
            {selectedTemplate && (
              <span style={{
                background: "#059669", color: "#fff",
                padding: "4px 12px", borderRadius: 16, fontSize: "0.8rem", fontWeight: 600,
              }}>
                Template: {selectedTemplate.templateName}
              </span>
            )}
          </div>

          {/* Tabs */}
          <div style={{
            display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: 20, gap: 0,
          }}>
            <button style={tabStyle("students")} onClick={() => setActiveTab("students")}>
              Students
            </button>
            <button style={tabStyle("templates")} onClick={() => setActiveTab("templates")}>
              Templates
            </button>
            <button
              style={tabStyle("mapping")}
              onClick={() => setActiveTab("mapping")}
              disabled={!selectedTemplate}
            >
              Field Mapping
            </button>
            <button
              style={tabStyle("preview")}
              onClick={() => setActiveTab("preview")}
              disabled={!selectedTemplate}
            >
              Preview
            </button>
          </div>

          {/* ════════════ TAB: STUDENTS ════════════ */}
          {activeTab === "students" && (
            <>
              {studentsLoading ? (
                <div style={{ color: "#9ca3af", padding: 24 }}>Loading students...</div>
              ) : (
                <>
                  {/* Compact filter row */}
                  <div style={{
                    display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end",
                  }}>
                    {FILTER_ITEMS.map((item) => {
                      const enabled = filterEnabled.has(item.key);
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
                    <div style={{ display: "flex", gap: 8 }}>
                      {selectedStudentIds.size > 0 && selectedTemplate && (
                        <>
                          <button
                            className="btn btn-sm btn-light-primary"
                            onClick={() => {
                              const firstId = Array.from(selectedStudentIds)[0];
                              handlePreview(firstId);
                            }}
                          >
                            Preview First
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={handleBulkDownload}
                            disabled={generating}
                          >
                            {generating ? "Generating..." : `Download PDF (${selectedStudentIds.size})`}
                          </button>
                        </>
                      )}
                      {selectedStudentIds.size > 0 && !selectedTemplate && (
                        <button
                          className="btn btn-sm btn-warning"
                          onClick={() => setActiveTab("templates")}
                        >
                          Select a Template First
                        </button>
                      )}
                    </div>
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
                          {selectedTemplate && <th style={thStyle}>Actions</th>}
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
                              {selectedTemplate && (
                                <td style={tdStyle}>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    <button
                                      className="btn btn-sm btn-light-info"
                                      style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                                      onClick={() => handlePreview(s.userStudentId)}
                                    >
                                      Preview
                                    </button>
                                    <button
                                      className="btn btn-sm btn-light-success"
                                      style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                                      onClick={() => handleDownloadPdf(s.userStudentId)}
                                      disabled={generating}
                                    >
                                      PDF
                                    </button>
                                  </div>
                                </td>
                              )}
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
            </>
          )}

          {/* ════════════ TAB: TEMPLATES ════════════ */}
          {activeTab === "templates" && (
            <div>
              {/* Upload */}
              <div style={{
                border: "2px dashed #d1d5db", borderRadius: 12, padding: 24,
                marginBottom: 24, background: "#fafbff",
              }}>
                <h5 style={{ fontWeight: 700, marginBottom: 16, fontSize: "0.95rem" }}>
                  Upload New Template
                </h5>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500, color: "#6b7280", display: "block", marginBottom: 4 }}>
                      Template Name
                    </label>
                    <input
                      className="form-control form-control-solid"
                      placeholder="e.g., Career Aptitude Report"
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500, color: "#6b7280", display: "block", marginBottom: 4 }}>
                      HTML File
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".html,.htm"
                      className="form-control form-control-solid"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleUploadTemplate}
                    disabled={uploading || !uploadFile || !uploadName.trim()}
                    style={{ height: 42 }}
                  >
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
                <p style={{ margin: "12px 0 0", fontSize: "0.8rem", color: "#9ca3af" }}>
                  Use <code>{"{{placeholderName}}"}</code> syntax in your HTML for dynamic fields.
                  e.g., <code>{"{{student.name}}"}</code>, <code>{"{{score.Linguistic}}"}</code>
                </p>
              </div>

              {/* Template List */}
              <h5 style={{ fontWeight: 700, marginBottom: 12, fontSize: "0.95rem" }}>
                Templates for this Assessment
              </h5>
              {templatesLoading ? (
                <div style={{ color: "#9ca3af", padding: 16 }}>Loading templates...</div>
              ) : templates.length === 0 ? (
                <div style={{
                  padding: 32, textAlign: "center", color: "#9ca3af",
                  border: "1px solid #e5e7eb", borderRadius: 10,
                }}>
                  No templates yet. Upload one above.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                  {templates.map((t) => {
                    const isSelected = selectedTemplate?.id === t.id;
                    const hasMappings = !!t.fieldMappings;
                    return (
                      <div
                        key={t.id}
                        style={{
                          border: `2px solid ${isSelected ? "#4361ee" : "#e5e7eb"}`,
                          borderRadius: 10, padding: 16,
                          background: isSelected ? "#f0f4ff" : "#fff",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                        onClick={() => handleSelectTemplate(t)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>
                              {t.templateName}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 4 }}>
                              Uploaded: {t.createdAt || "—"}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            {hasMappings && (
                              <span style={{
                                background: "#dcfce7", color: "#059669",
                                padding: "2px 8px", borderRadius: 4, fontSize: "0.7rem", fontWeight: 600,
                              }}>
                                Mapped
                              </span>
                            )}
                            {isSelected && (
                              <span style={{
                                background: "#4361ee", color: "#fff",
                                padding: "2px 8px", borderRadius: 4, fontSize: "0.7rem", fontWeight: 600,
                              }}>
                                Active
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                          <button
                            className="btn btn-sm btn-light-primary"
                            style={{ fontSize: "0.75rem", padding: "2px 10px" }}
                            onClick={(e) => { e.stopPropagation(); handleSelectTemplate(t); }}
                          >
                            Configure Mapping
                          </button>
                          <a
                            href={t.templateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-light"
                            style={{ fontSize: "0.75rem", padding: "2px 10px" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            View HTML
                          </a>
                          <button
                            className="btn btn-sm btn-light-danger"
                            style={{ fontSize: "0.75rem", padding: "2px 10px" }}
                            onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════ TAB: MAPPING ════════════ */}
          {activeTab === "mapping" && selectedTemplate && (
            <div>
              {mappingLoading ? (
                <div style={{ color: "#9ca3af", padding: 24 }}>Parsing template placeholders...</div>
              ) : (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <h5 style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>
                      Map Placeholders to Data Fields
                    </h5>
                    <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: 0 }}>
                      We found <strong>{placeholders.length}</strong> placeholder(s) in your template.
                      Map each one to the data field it should display.
                    </p>
                  </div>

                  {placeholders.length === 0 ? (
                    <div style={{
                      padding: 32, textAlign: "center", color: "#d97706",
                      border: "1px solid #fef3c7", borderRadius: 10, background: "#fffbeb",
                    }}>
                      No <code>{"{{...}}"}</code> placeholders found in this template.
                      Make sure your HTML uses the <code>{"{{fieldName}}"}</code> syntax.
                    </div>
                  ) : (
                    <>
                      <div style={{
                        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
                        background: "#f8fafc", padding: 16, borderRadius: 10,
                        border: "1px solid #e5e7eb", marginBottom: 16,
                      }}>
                        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#374151", padding: "8px 0" }}>
                          Template Placeholder
                        </div>
                        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#374151", padding: "8px 0" }}>
                          Maps To (Data Field)
                        </div>

                        {placeholders.map((ph) => (
                          <React.Fragment key={ph}>
                            <div style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "8px 0", borderTop: "1px solid #e5e7eb",
                            }}>
                              <code style={{
                                background: "#eef2ff", color: "#4338ca",
                                padding: "4px 10px", borderRadius: 6, fontSize: "0.85rem",
                                fontWeight: 600,
                              }}>
                                {`{{${ph}}}`}
                              </code>
                            </div>
                            <div style={{ padding: "8px 0", borderTop: "1px solid #e5e7eb" }}>
                              <select
                                className="form-select form-select-sm form-select-solid"
                                value={mappings[ph] || ""}
                                onChange={(e) =>
                                  setMappings((prev) => ({ ...prev, [ph]: e.target.value }))
                                }
                              >
                                <option value="">-- Select field --</option>
                                {availableFields.map((f) => (
                                  <option key={f.key} value={f.key}>
                                    {f.label} ({f.key})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="btn btn-primary"
                          onClick={handleSaveMappings}
                          disabled={savingMappings}
                        >
                          {savingMappings ? "Saving..." : "Save Mappings"}
                        </button>
                        <button
                          className="btn btn-light-info"
                          onClick={() => {
                            if (displayedStudents.length > 0) {
                              handlePreview(displayedStudents[0].userStudentId);
                            } else {
                              alert("No students available to preview");
                            }
                          }}
                        >
                          Preview with First Student
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ════════════ TAB: PREVIEW ════════════ */}
          {activeTab === "preview" && selectedTemplate && (
            <div>
              <div style={{
                display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap",
              }}>
                <label style={{ fontWeight: 600, fontSize: "0.85rem" }}>Preview Student:</label>
                <select
                  className="form-select form-select-sm form-select-solid"
                  style={{ width: 260 }}
                  value={previewStudentId || ""}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    if (id) handlePreview(id);
                  }}
                >
                  <option value="">-- Select student --</option>
                  {displayedStudents.map((s) => (
                    <option key={s.userStudentId} value={s.userStudentId}>
                      {s.name} {s.schoolRollNumber ? `(${s.schoolRollNumber})` : ""}
                    </option>
                  ))}
                </select>
                {previewStudentId && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleDownloadPdf(previewStudentId)}
                    disabled={generating}
                  >
                    {generating ? "Generating..." : "Download PDF"}
                  </button>
                )}
              </div>

              {previewLoading ? (
                <div style={{ color: "#9ca3af", padding: 24, textAlign: "center" }}>
                  Generating preview...
                </div>
              ) : previewHtml ? (
                <div style={{
                  border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden",
                  background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}>
                  <div style={{
                    background: "#f8fafc", padding: "8px 16px",
                    borderBottom: "1px solid #e5e7eb",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>
                      Report Preview
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                      Student ID: {previewStudentId}
                    </span>
                  </div>
                  <iframe
                    srcDoc={previewHtml}
                    style={{ width: "100%", minHeight: 700, border: "none" }}
                    title="Report Preview"
                  />
                </div>
              ) : (
                <div style={{
                  padding: 48, textAlign: "center", color: "#9ca3af",
                  border: "2px dashed #e5e7eb", borderRadius: 12,
                }}>
                  Select a student above to preview their report
                </div>
              )}
            </div>
          )}

          {/* Mapping/Preview not available without template */}
          {(activeTab === "mapping" || activeTab === "preview") && !selectedTemplate && (
            <div style={{
              padding: 48, textAlign: "center", color: "#9ca3af",
              border: "2px dashed #e5e7eb", borderRadius: 12,
            }}>
              <div style={{ fontSize: "1.5rem", marginBottom: 8, opacity: 0.4 }}>&#x1F4C4;</div>
              <div>Select a template from the Templates tab first</div>
              <button
                className="btn btn-sm btn-light-primary mt-3"
                onClick={() => setActiveTab("templates")}
              >
                Go to Templates
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReportGenerationPage;
