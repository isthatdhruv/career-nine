import React, { useState, useEffect, useMemo, useRef } from "react";
import { Button, Modal, Alert, Spinner, ProgressBar } from "react-bootstrap";
import { MDBDataTableV5 } from "mdbreact";
import * as XLSX from "xlsx";
import { setData } from "./StudentDataComputationExcel";
import { SchoolOMRRow } from "./DataStructure";
import { addStudentInfo, StudentInfo, getAllAssessments, Assessment } from "../StudentInformation/StudentInfo_APIs";
import { ReadCollegeData, GetSessionsByInstituteCode, ResolveOrCreateSection } from "../College/API/College_APIs";

/* ================= MASTER SCHEMA ================= */

const SCHEMA_FIELDS = [
  "name",
  "schoolRollNumber",
  "controlNumber",
  "phoneNumber",
  "email",
  "address",
  "studentDob",
  "sessionYear",
  "className",
  "sectionName"
];

/* ================= DEFAULT OBJECT ================= */

const DEFAULT_SCHEMA_OBJECT: Record<string, any> = {
  name: "",
  schoolRollNumber: "",
  controlNumber: null,
  phoneNumber: "",
  email: "",
  address: "",
  studentDob: "",
  user: null,
  instituteId: null,
  assesment_id: null,
  schoolSectionId: null
};

/* ================= COMPONENT ================= */

export default function UploadExcelFile() {
  const [showModal, setShowModal] = useState(false);
  const [fileName, setFileName] = useState("");
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [rawExcelData, setRawExcelData] = useState<any[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [showMapping, setShowMapping] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadResult, setUploadResult] = useState<{ success: number; skipped: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tableData, setTableData] = useState<{
    columns: any[];
    rows: SchoolOMRRow[];
  }>({ columns: [], rows: [] });

  const [institutes, setInstitutes] = useState<any[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<number | "">("");

  // Session/Grade/Section hierarchy
  const [hierarchyData, setHierarchyData] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");

  useEffect(() => {
    ReadCollegeData()
      .then((res: any) => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        console.log("Fetched Institutes:", list);
        setInstitutes(list);
      })
      .catch((err: any) => console.error("Failed to fetch institutes", err));

    getAllAssessments()
      .then((res) => {
        const activeOnly = (res.data || []).filter((a: any) => a.isActive !== false);
        setAssessments(activeOnly);
        console.log("Fetched Assessments:", activeOnly);
      })
      .catch((err) => console.error("Failed to fetch assessments", err));
  }, []);

  // Fetch hierarchy when institute changes
  useEffect(() => {
    if (selectedInstitute) {
      GetSessionsByInstituteCode(selectedInstitute)
        .then((res: any) => {
          setHierarchyData(res.data || []);
          setSelectedSession("");
          setSelectedGrade("");
          setSelectedSection("");
        })
        .catch((err: any) => {
          console.error("Failed to fetch sessions", err);
          setHierarchyData([]);
        });
    } else {
      setHierarchyData([]);
      setSelectedSession("");
      setSelectedGrade("");
      setSelectedSection("");
    }
  }, [selectedInstitute]);

  // Derived: available grades based on selected session
  const availableGrades = useMemo(() => {
    if (!selectedSession) return [];
    const session = hierarchyData.find((s: any) => s.sessionYear === selectedSession);
    return session?.schoolClasses || [];
  }, [hierarchyData, selectedSession]);

  // Derived: available sections based on selected grade
  const availableSections = useMemo(() => {
    if (!selectedGrade) return [];
    const grade = availableGrades.find((c: any) => c.className === selectedGrade);
    return grade?.schoolSections || [];
  }, [availableGrades, selectedGrade]);

  /* ================= FILE UPLOAD ================= */

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      if (!json.length) return;

      const headers = Object.keys(json[0]);
      setExcelColumns(headers);
      setRawExcelData(json);

      const initialMap: Record<string, string> = {};
      headers.forEach((h) => (initialMap[h] = ""));

      headers.forEach(h => {
        const lowerH = h.toLowerCase();
        const match = SCHEMA_FIELDS.find(f => f.toLowerCase() === lowerH ||
          (f === 'schoolRollNumber' && lowerH.includes('roll')) ||
          (f === 'controlNumber' && lowerH.includes('control')) ||
          (f === 'phoneNumber' && (lowerH.includes('phone') || lowerH.includes('mobile'))) ||
          (f === 'sessionYear' && (lowerH.includes('session') || lowerH === 'year' || lowerH.includes('academic year'))) ||
          (f === 'className' && (lowerH.includes('class') || lowerH.includes('grade'))) ||
          (f === 'sectionName' && lowerH.includes('section'))
        );
        if (match) initialMap[h] = match;
      });

      setColumnMap(initialMap);
      setShowMapping(true);
      setTableData({ columns: [], rows: [] });
      setUploadResult(null);
    };

    reader.readAsArrayBuffer(file);
    setFileName(file.name);
    setShowModal(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      processFile(file);
    }
  };

  /* ================= APPLY MAPPING ================= */

  const applyMapping = () => {
    const processed = setData(rawExcelData, columnMap);

    // Format dates in the processed data for preview
    const formattedProcessed = processed.map((row: any) => {
      const newRow = { ...row };
      if (newRow.studentDob) {
        newRow.studentDob = formatDate(newRow.studentDob);
      }
      return newRow;
    });

    const selectedFields = Array.from(
      new Set(Object.values(columnMap).filter((v) => v))
    );

    const columns = selectedFields.map((f) => ({
      label: f,
      field: f,
      sort: "asc",
      width: 150,
    }));

    setTableData({ columns, rows: formattedProcessed });
    setShowMapping(false);
  };

  /* ================= DATE FORMATTER ================= */

  const formatDate = (val: any): string => {
    if (!val) return "";
    let date;
    if (typeof val === 'number') {
      date = new Date((val - 25569) * 86400 * 1000);
    } else {
      const parsed = Date.parse(val);
      if (!isNaN(parsed)) date = new Date(parsed);
    }

    if (date && !isNaN(date.getTime())) {
      return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
    }
    return String(val);
  };

  /* ================= SUBMIT ================= */

  // Helper: get effective session/grade/section for a row (Excel overrides dropdown)
  const getEffectiveHierarchy = (row: any): { sessionYear: string; className: string; sectionName: string } | null => {
    let sessionYear = "";
    let className = "";
    let sectionName = "";

    // Extract from mapped Excel columns
    Object.entries(columnMap).forEach(([excelCol, schemaField]) => {
      if (schemaField === "sessionYear" && row[excelCol]) sessionYear = String(row[excelCol]).trim();
      if (schemaField === "className" && row[excelCol]) className = String(row[excelCol]).trim();
      if (schemaField === "sectionName" && row[excelCol]) sectionName = String(row[excelCol]).trim();
    });

    // Fall back to dropdown selections if Excel data is missing
    if (!sessionYear && selectedSession) sessionYear = selectedSession;
    if (!className && selectedGrade) className = selectedGrade;
    if (!sectionName && selectedSection) sectionName = selectedSection;

    // All three must be present to resolve a section
    if (sessionYear && className && sectionName) {
      return { sessionYear, className, sectionName };
    }
    return null;
  };

  const handleSubmit = async () => {
    setUploading(true);
    setUploadProgress({ current: 0, total: rawExcelData.length });
    let successCount = 0;
    let skippedCount = 0;

    // Phase 1: Pre-resolve all unique section combinations
    const sectionIdCache = new Map<string, number>();
    const uniqueCombos = new Set<string>();

    for (const row of rawExcelData) {
      const hierarchy = getEffectiveHierarchy(row);
      if (hierarchy) {
        const key = `${hierarchy.sessionYear}|${hierarchy.className}|${hierarchy.sectionName}`;
        uniqueCombos.add(key);
      }
    }

    // Resolve each unique combo sequentially to avoid race conditions
    for (const key of Array.from(uniqueCombos)) {
      const [sessionYear, className, sectionName] = key.split("|");
      try {
        const response = await ResolveOrCreateSection({
          instituteCode: Number(selectedInstitute),
          sessionYear,
          className,
          sectionName,
        });
        sectionIdCache.set(key, response.data.id);
      } catch (error) {
        console.error(`Failed to resolve section for ${key}:`, error);
      }
    }

    // Phase 2: Upload students sequentially to prevent duplicate assessment mappings
    for (let i = 0; i < rawExcelData.length; i++) {
      const row = rawExcelData[i];
      const obj: Record<string, any> = { ...DEFAULT_SCHEMA_OBJECT };
      if (selectedInstitute) obj.instituteId = Number(selectedInstitute);
      if (selectedAssessment) obj.assesment_id = String(selectedAssessment);
      let isValid = true;

      Object.entries(columnMap).forEach(([excelCol, schemaField]) => {
        if (schemaField) {
          const val = row[excelCol];
          if (schemaField === "studentDob") {
            if (!val || val === "" || val === "Null" || val === "null" || val === undefined) {
              isValid = false;
            } else {
              obj[schemaField] = formatDate(val);
            }
          } else {
            obj[schemaField] = val ?? "";
          }
        }
      });

      if (!isValid) { skippedCount++; setUploadProgress({ current: i + 1, total: rawExcelData.length }); continue; }

      // Resolve section ID from cache
      const hierarchy = getEffectiveHierarchy(row);
      if (hierarchy) {
        const key = `${hierarchy.sessionYear}|${hierarchy.className}|${hierarchy.sectionName}`;
        const sectionId = sectionIdCache.get(key);
        if (sectionId) obj.schoolSectionId = sectionId;
      }

      // Remove transient fields before sending to backend
      delete obj.sessionYear;
      delete obj.className;
      delete obj.sectionName;

      try {
        await addStudentInfo(obj as StudentInfo);
        successCount++;
      } catch (error) {
        console.error("Failed to upload info for row", row, error);
        skippedCount++;
      }

      setUploadProgress({ current: i + 1, total: rawExcelData.length });
    }

    setUploadResult({ success: successCount, skipped: skippedCount });
    setUploadProgress(null);
    setUploading(false);
  };

  const getMappedFieldsCount = () => Object.values(columnMap).filter(v => v).length;

  return (
    <div className="min-vh-100" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)', padding: '2rem' }}>
      {/* Header Section */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div className="card-body p-4">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h2 className="mb-1 fw-bold" style={{ color: '#1a1a2e' }}>
                <i className="bi bi-file-earmark-spreadsheet me-2" style={{ color: '#4361ee' }}></i>
                Student Data Import
              </h2>
              <p className="text-muted mb-0">Upload and map Excel files to import student information</p>
            </div>
            <div className="d-flex align-items-center gap-3">
              <div className="position-relative">
                <select
                  className="form-select shadow-sm"
                  style={{
                    minWidth: '220px',
                    borderRadius: '10px',
                    border: '2px solid #e0e0e0',
                    padding: '0.6rem 1rem',
                    fontWeight: 500,
                    transition: 'all 0.3s ease'
                  }}
                  value={selectedInstitute}
                  onChange={(e) => {
                    console.log("Selected value:", e.target.value);
                    setSelectedInstitute(e.target.value ? Number(e.target.value) : "");
                  }}
                >
                  <option value="">🏫 Select Institute</option>
                  {institutes.map((inst) => (
                    <option key={inst.instituteCode} value={inst.instituteCode}>
                      {inst.instituteName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="position-relative">
                <select
                  className="form-select shadow-sm"
                  style={{
                    minWidth: '220px',
                    borderRadius: '10px',
                    border: '2px solid #e0e0e0',
                    padding: '0.6rem 1rem',
                    fontWeight: 500,
                    transition: 'all 0.3s ease'
                  }}
                  value={selectedAssessment}
                  onChange={(e) => {
                    console.log("Selected assessment:", e.target.value);
                    setSelectedAssessment(e.target.value ? Number(e.target.value) : "");
                  }}
                >
                  <option value="">📝 Select Assessment</option>
                  {assessments.map((assessment) => (
                    <option key={assessment.id} value={assessment.id}>
                      {assessment.assessmentName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session/Grade/Section Dropdowns */}
      {selectedInstitute && (
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '16px' }}>
          <div className="card-body p-4">
            <p className="text-muted mb-3">
              <i className="bi bi-diagram-3 me-2"></i>
              Optional: Pre-select session, grade, and section (Excel data overrides these)
            </p>
            <div className="d-flex gap-3 flex-wrap">
              <select
                className="form-select shadow-sm"
                style={{
                  minWidth: '180px',
                  maxWidth: '220px',
                  borderRadius: '10px',
                  border: '2px solid #e0e0e0',
                  padding: '0.6rem 1rem',
                  fontWeight: 500,
                }}
                value={selectedSession}
                onChange={(e) => {
                  setSelectedSession(e.target.value);
                  setSelectedGrade("");
                  setSelectedSection("");
                }}
              >
                <option value="">Select Session</option>
                {hierarchyData.map((s: any) => (
                  <option key={s.id} value={s.sessionYear}>{s.sessionYear}</option>
                ))}
              </select>

              <select
                className="form-select shadow-sm"
                style={{
                  minWidth: '180px',
                  maxWidth: '220px',
                  borderRadius: '10px',
                  border: '2px solid #e0e0e0',
                  padding: '0.6rem 1rem',
                  fontWeight: 500,
                }}
                value={selectedGrade}
                onChange={(e) => {
                  setSelectedGrade(e.target.value);
                  setSelectedSection("");
                }}
                disabled={!selectedSession}
              >
                <option value="">Select Grade</option>
                {availableGrades.map((c: any) => (
                  <option key={c.id} value={c.className}>{c.className}</option>
                ))}
              </select>

              <select
                className="form-select shadow-sm"
                style={{
                  minWidth: '180px',
                  maxWidth: '220px',
                  borderRadius: '10px',
                  border: '2px solid #e0e0e0',
                  padding: '0.6rem 1rem',
                  fontWeight: 500,
                }}
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                disabled={!selectedGrade}
              >
                <option value="">Select Section</option>
                {availableSections.map((sec: any) => (
                  <option key={sec.id} value={sec.sectionName}>{sec.sectionName}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`card border-0 shadow-sm mb-4 ${isDragging ? 'border-primary' : ''}`}
        style={{
          borderRadius: '16px',
          cursor: 'pointer',
          border: isDragging ? '3px dashed #4361ee' : '3px dashed transparent',
          background: isDragging ? 'rgba(67, 97, 238, 0.05)' : 'white',
          transition: 'all 0.3s ease'
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="card-body p-5 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <div
            className="mx-auto mb-3 d-flex align-items-center justify-content-center"
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)',
              boxShadow: '0 10px 30px rgba(67, 97, 238, 0.3)'
            }}
          >
            <i className="bi bi-cloud-arrow-up-fill text-white" style={{ fontSize: '2rem' }}></i>
          </div>
          <h4 className="fw-semibold mb-2" style={{ color: '#1a1a2e' }}>
            {isDragging ? 'Drop your file here!' : 'Upload Excel File'}
          </h4>
          <p className="text-muted mb-3">
            Drag & drop your Excel file here, or <span style={{ color: '#4361ee', fontWeight: 600 }}>browse</span>
          </p>
          <div className="d-flex justify-content-center gap-2 flex-wrap">
            <span className="badge bg-light text-dark px-3 py-2" style={{ borderRadius: '20px' }}>
              <i className="bi bi-file-earmark-excel me-1" style={{ color: '#107C41' }}></i> .xlsx
            </span>
            <span className="badge bg-light text-dark px-3 py-2" style={{ borderRadius: '20px' }}>
              <i className="bi bi-file-earmark-excel me-1" style={{ color: '#107C41' }}></i> .xls
            </span>
          </div>

          {fileName && (
            <div className="mt-4 p-3 rounded-3" style={{ background: '#e8f5e9', display: 'inline-block' }}>
              <i className="bi bi-check-circle-fill me-2" style={{ color: '#4caf50' }}></i>
              <span className="fw-medium" style={{ color: '#2e7d32' }}>{fileName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Upload Result Alert */}
      {uploadResult && (
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '16px', overflow: 'hidden' }}>
          <div className="card-body p-0">
            <div className="d-flex">
              <div className="p-4 d-flex align-items-center justify-content-center"
                style={{ background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)', minWidth: '80px' }}>
                <i className="bi bi-check-circle-fill text-white" style={{ fontSize: '2rem' }}></i>
              </div>
              <div className="p-4 flex-grow-1">
                <h5 className="mb-2 fw-bold" style={{ color: '#1a1a2e' }}>Upload Complete!</h5>
                <div className="d-flex gap-4 flex-wrap">
                  <div>
                    <span className="text-muted">Successful:</span>
                    <span className="ms-2 badge bg-success px-3 py-2" style={{ fontSize: '0.95rem' }}>{uploadResult.success}</span>
                  </div>
                  <div>
                    <span className="text-muted">Skipped:</span>
                    <span className="ms-2 badge bg-warning text-dark px-3 py-2" style={{ fontSize: '0.95rem' }}>{uploadResult.skipped}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Column Mapping Section */}
      {excelColumns.length > 0 && showMapping && (
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '16px' }}>
          <div className="card-header bg-white border-0 p-4 pb-0">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <h4 className="mb-1 fw-bold" style={{ color: '#1a1a2e' }}>
                  <i className="bi bi-arrow-left-right me-2" style={{ color: '#4361ee' }}></i>
                  Map Excel Columns
                </h4>
                <p className="text-muted mb-0">Connect your Excel columns to the database fields</p>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-primary px-3 py-2" style={{ borderRadius: '20px' }}>
                  {getMappedFieldsCount()} of {excelColumns.length} mapped
                </span>
              </div>
            </div>
          </div>
          <div className="card-body p-4">
            <div className="row g-3">
              {excelColumns.map((col, index) => (
                <div key={col} className="col-12 col-md-6 col-lg-4">
                  <div
                    className="p-3 rounded-3 h-100"
                    style={{
                      background: columnMap[col] ? 'rgba(67, 97, 238, 0.08)' : '#f8f9fa',
                      border: columnMap[col] ? '2px solid rgba(67, 97, 238, 0.3)' : '2px solid transparent',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <label className="d-block mb-2">
                      <span className="badge bg-secondary me-2" style={{ borderRadius: '6px' }}>{index + 1}</span>
                      <span className="fw-semibold" style={{ color: '#1a1a2e' }}>{col}</span>
                    </label>
                    <select
                      className="form-select"
                      style={{
                        borderRadius: '8px',
                        border: '2px solid #e0e0e0',
                        fontWeight: 500
                      }}
                      value={columnMap[col]}
                      onChange={(e) =>
                        setColumnMap({ ...columnMap, [col]: e.target.value })
                      }
                    >
                      <option value="">⏭️ Ignore this column</option>
                      {SCHEMA_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          ✓ {f}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-4 pt-3 border-top">
              <Button
                size="lg"
                onClick={applyMapping}
                disabled={getMappedFieldsCount() === 0}
                style={{
                  background: 'linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.8rem 2.5rem',
                  fontWeight: 600,
                  boxShadow: '0 8px 20px rgba(67, 97, 238, 0.3)',
                  transition: 'all 0.3s ease'
                }}
              >
                <i className="bi bi-eye me-2"></i>
                Preview Data
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Data Preview Table */}
      {tableData.rows.length > 0 && !showMapping && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
          <div className="card-header bg-white border-0 p-4 pb-0">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <h4 className="mb-1 fw-bold" style={{ color: '#1a1a2e' }}>
                  <i className="bi bi-table me-2" style={{ color: '#4361ee' }}></i>
                  Data Preview
                </h4>
                <p className="text-muted mb-0">
                  <span className="badge bg-info text-dark me-2">{tableData.rows.length} records</span>
                  Review your data before submitting
                </p>
              </div>
              <Button
                variant="outline-secondary"
                onClick={() => setShowMapping(true)}
                style={{ borderRadius: '10px', fontWeight: 500 }}
              >
                <i className="bi bi-arrow-left me-2"></i>
                Back to Mapping
              </Button>
            </div>
          </div>
          <div className="card-body p-4">
            <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
              <MDBDataTableV5
                hover
                bordered
                striped
                entries={25}
                data={tableData}
                scrollY
                maxHeight="60vh"
                className="mb-0"
              />
            </div>

            <div className="d-flex justify-content-end align-items-center gap-3 mt-4 pt-3 border-top">
              {(!selectedInstitute || !selectedAssessment) && (
                <span className="text-warning">
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  {!selectedInstitute && !selectedAssessment
                    ? "Please select an institute and assessment first"
                    : !selectedInstitute
                      ? "Please select an institute first"
                      : "Please select an assessment first"}
                </span>
              )}
              <div className="d-flex flex-column align-items-end gap-2">
                {uploading && uploadProgress && (
                  <div style={{ width: '250px' }}>
                    <ProgressBar
                      now={Math.round((uploadProgress.current / uploadProgress.total) * 100)}
                      label={`${uploadProgress.current} / ${uploadProgress.total}`}
                      style={{ height: '22px', borderRadius: '10px' }}
                    />
                  </div>
                )}
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={uploading || !selectedInstitute || !selectedAssessment}
                  style={{
                    background: uploading
                      ? '#6c757d'
                      : 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0.8rem 2.5rem',
                    fontWeight: 600,
                    boxShadow: uploading ? 'none' : '0 8px 20px rgba(76, 175, 80, 0.3)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {uploading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Uploading {uploadProgress ? `${uploadProgress.current}/${uploadProgress.total}` : '...'}
                    </>
                  ) : (
                    <>
                      <i className="bi bi-cloud-upload me-2"></i>
                      Submit {tableData.rows.length} Students
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!fileName && excelColumns.length === 0 && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
          <div className="card-body p-5 text-center">
            <div
              className="mx-auto mb-4"
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <i className="bi bi-inbox" style={{ fontSize: '3rem', color: '#bdbdbd' }}></i>
            </div>
            <h4 className="fw-semibold mb-2" style={{ color: '#757575' }}>No File Uploaded</h4>
            <p className="text-muted mb-0">Upload an Excel file to get started with student data import</p>
          </div>
        </div>
      )}
    </div>
  );
}
