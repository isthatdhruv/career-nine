import { useEffect, useState, useRef, useMemo } from "react";
import { Spinner, Button, Form, Badge, Alert } from "react-bootstrap";
import * as XLSX from "xlsx";
import { ReadCollegeData } from "../College/API/College_APIs";
import { getAssessmentMappingsByInstitute, getAssessmentSummaryList } from "../AssessmentMapping/API/AssessmentMapping_APIs";
import { getOfflineMapping, bulkSubmitWithStudents } from "./API/OfflineUpload_APIs";

// ============ Interfaces ============

interface OptionInfo {
  optionId: number;
  sequence: number;
  optionText: string;
}

interface QuestionMapping {
  questionnaireQuestionId: number;
  excelQuestionHeader: string;
  questionText: string;
  questionType: string;
  isMQT: boolean;
  questionnaireSectionId: number | null;
  sectionName: string | null;
  sectionOrder: string | null;
  options: OptionInfo[];
}

interface SectionMapping {
  questionnaireSectionId: number;
  sectionName: string;
  sectionOrder: string;
  questions: QuestionMapping[];
}

interface MappingData {
  assessmentId: number;
  assessmentName: string;
  questionnaireName: string;
  questions: QuestionMapping[];
  sections: SectionMapping[];
}

interface ParsedRow {
  name: string;
  dob: string;
  phone: string;
  answers: { [questionnaireQuestionId: number]: number | null };
  rowErrors: string[];
}

// ============ Helpers ============

const resolveOptionId = (
  cellValue: any,
  options: OptionInfo[]
): { optionId: number | null; error?: string } => {
  if (cellValue === null || cellValue === undefined || cellValue === "") {
    return { optionId: null };
  }

  const val = String(cellValue).trim();
  if (val === "") return { optionId: null };

  if (!options || options.length === 0) {
    return { optionId: null, error: "No options defined" };
  }

  const num = Number(val);
  if (!isNaN(num) && Number.isInteger(num) && num >= 1) {
    const opt = options.find((o) => o.sequence === num);
    if (opt) return { optionId: opt.optionId };
    return { optionId: null, error: `Sequence ${num} out of range (max ${options.length})` };
  }

  const upper = val.toUpperCase();
  if (/^[A-Z]$/.test(upper)) {
    const seq = upper.charCodeAt(0) - 64;
    const opt = options.find((o) => o.sequence === seq);
    if (opt) return { optionId: opt.optionId };
    return { optionId: null, error: `Letter ${upper} out of range (max ${options.length} options)` };
  }

  const lower = val.toLowerCase();
  if (lower === "yes" || lower === "y") {
    const opt = options.find((o) => o.sequence === 1);
    if (opt) return { optionId: opt.optionId };
  }
  if (lower === "no" || lower === "n") {
    const opt = options.find((o) => o.sequence === 2);
    if (opt) return { optionId: opt.optionId };
  }

  return { optionId: null, error: `Unrecognized value: "${val}"` };
};

/** Normalize Excel date value to dd-MM-yyyy string */
const normalizeDob = (raw: any): string => {
  if (raw === null || raw === undefined || raw === "") return "";
  if (raw instanceof Date) {
    const d = raw.getDate().toString().padStart(2, "0");
    const m = (raw.getMonth() + 1).toString().padStart(2, "0");
    const y = raw.getFullYear();
    return `${d}-${m}-${y}`;
  }
  const str = String(raw).trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-");
    return `${d}-${m}-${y}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split("/");
    return `${d}-${m}-${y}`;
  }
  return str;
};

// ============ Component ============

const OfflineAssessmentUploadPage = () => {
  // --- School & Assessment selection ---
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<string>("");
  const [assessmentMappings, setAssessmentMappings] = useState<any[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<string>("");
  const [loadingInstitutes, setLoadingInstitutes] = useState(false);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  const [mappingData, setMappingData] = useState<MappingData | null>(null);
  const [loadingMapping, setLoadingMapping] = useState(false);

  // --- Excel upload ---
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [rawExcelData, setRawExcelData] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Mapping: DB field key → Excel header ---
  // Keys: "name", "dob", "phone", "q_{qqId}", "mqt_{qqId}_{optionId}"
  const [fieldToHeader, setFieldToHeader] = useState<Record<string, string>>({});
  const [mappingApplied, setMappingApplied] = useState(false);

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);

  // --- Build flat rows for the mapping table ---
  const mappingRows = useMemo(() => {
    if (!mappingData?.sections) return [];

    const rows: {
      key: string;
      label: string;
      sectionName: string;
      isMQT: boolean;
      type: "identity" | "question" | "mqt_option";
    }[] = [];

    // Identity fields first
    rows.push({ key: "name", label: "Student Name", sectionName: "Student Identity", isMQT: false, type: "identity" });
    rows.push({ key: "dob", label: "Date of Birth", sectionName: "Student Identity", isMQT: false, type: "identity" });
    rows.push({ key: "phone", label: "Phone Number", sectionName: "Student Identity", isMQT: false, type: "identity" });

    // Questions grouped by section
    for (const section of mappingData.sections) {
      for (const q of section.questions) {
        if (q.isMQT) {
          for (const opt of q.options) {
            rows.push({
              key: `mqt_${q.questionnaireQuestionId}_${opt.optionId}`,
              label: `${q.questionText?.substring(0, 50) || "Q" + q.questionnaireQuestionId} → ${opt.optionText?.substring(0, 40)}`,
              sectionName: section.sectionName,
              isMQT: true,
              type: "mqt_option",
            });
          }
        } else {
          rows.push({
            key: `q_${q.questionnaireQuestionId}`,
            label: q.questionText?.substring(0, 80) || `Question ${q.questionnaireQuestionId}`,
            sectionName: section.sectionName,
            isMQT: false,
            type: "question",
          });
        }
      }
    }

    return rows;
  }, [mappingData]);

  // Build preview column list from applied mapping
  const previewColumns = useMemo(() => {
    if (!mappingApplied || !mappingData) return [];

    const mappedQQIds = new Set<number>();
    for (const [key] of Object.entries(fieldToHeader)) {
      if (key.startsWith("q_")) {
        mappedQQIds.add(Number(key.substring(2)));
      } else if (key.startsWith("mqt_")) {
        const qqId = Number(key.split("_")[1]);
        mappedQQIds.add(qqId);
      }
    }

    const cols: {
      qqId: number;
      questionText: string;
      isMQT: boolean;
      options: OptionInfo[];
      sectionName: string;
    }[] = [];

    for (const section of mappingData.sections) {
      for (const q of section.questions) {
        if (mappedQQIds.has(q.questionnaireQuestionId)) {
          cols.push({
            qqId: q.questionnaireQuestionId,
            questionText: q.questionText,
            isMQT: q.isMQT,
            options: q.options,
            sectionName: section.sectionName,
          });
        }
      }
    }
    return cols;
  }, [mappingApplied, fieldToHeader, mappingData]);

  // Mapping validation
  const mappingValidation = useMemo(() => {
    const issues: string[] = [];
    const hasName = !!fieldToHeader["name"];
    if (!hasName) issues.push("Map a column to 'Student Name' (required)");

    const mappedQQIds = new Set<number>();
    for (const key of Object.keys(fieldToHeader)) {
      if (key.startsWith("q_")) mappedQQIds.add(Number(key.substring(2)));
      else if (key.startsWith("mqt_")) mappedQQIds.add(Number(key.split("_")[1]));
    }

    const totalQuestions = mappingData?.questions.length || 0;
    if (mappedQQIds.size === 0) {
      issues.push("No question columns mapped");
    } else if (mappedQQIds.size < totalQuestions) {
      issues.push(`${mappedQQIds.size} of ${totalQuestions} questions mapped`);
    }

    return { issues, hasName, mappedCount: mappedQQIds.size };
  }, [fieldToHeader, mappingData]);

  // ============ Load data ============

  useEffect(() => {
    loadInstitutes();
  }, []);

  const loadInstitutes = async () => {
    setLoadingInstitutes(true);
    try {
      const res = await ReadCollegeData();
      setInstitutes(res.data || []);
    } catch (error) {
      console.error("Failed to load institutes:", error);
    } finally {
      setLoadingInstitutes(false);
    }
  };

  useEffect(() => {
    if (selectedInstitute) {
      loadAssessments(Number(selectedInstitute));
    } else {
      setAssessmentMappings([]);
      setSelectedAssessment("");
      setMappingData(null);
      resetUploadState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInstitute]);

  const loadAssessments = async (instituteCode: number) => {
    setLoadingAssessments(true);
    setSelectedAssessment("");
    setMappingData(null);
    resetUploadState();
    try {
      let mappings: any[] = [];
      let allAssessments: any[] = [];

      try {
        const mappingsRes = await getAssessmentMappingsByInstitute(instituteCode);
        mappings = mappingsRes.data || [];
      } catch (err) {
        console.error("Failed to load institute mappings:", err);
      }

      try {
        const summaryRes = await getAssessmentSummaryList();
        allAssessments = summaryRes.data || [];
      } catch (err) {
        console.error("Failed to load assessment list:", err);
      }

      if (mappings.length > 0) {
        const mappedIds = new Set(mappings.map((m: any) => m.assessmentId));
        const filtered = allAssessments.filter((a: any) => mappedIds.has(a.id));
        setAssessmentMappings(filtered);
      } else {
        setAssessmentMappings(allAssessments);
      }
    } catch (error) {
      console.error("Failed to load assessments:", error);
    } finally {
      setLoadingAssessments(false);
    }
  };

  useEffect(() => {
    if (selectedAssessment) {
      loadMapping(Number(selectedAssessment));
    } else {
      setMappingData(null);
      resetUploadState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssessment]);

  const loadMapping = async (assessmentId: number) => {
    setLoadingMapping(true);
    resetUploadState();
    try {
      const mappingRes = await getOfflineMapping(assessmentId);
      setMappingData(mappingRes.data);
    } catch (error) {
      console.error("Failed to load mapping:", error);
      alert("Failed to load assessment mapping. Make sure the assessment has a linked questionnaire.");
    } finally {
      setLoadingMapping(false);
    }
  };

  const resetUploadState = () => {
    setExcelHeaders([]);
    setRawExcelData([]);
    setFieldToHeader({});
    setMappingApplied(false);
    setParsedRows([]);
    setFileName("");
    setSubmitResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ============ File Upload ============

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mappingData) return;

    setFileName(file.name);
    setSubmitResult(null);
    setMappingApplied(false);
    setParsedRows([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "binary", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

      if (jsonData.length === 0) {
        alert("The Excel file is empty or has no data rows.");
        return;
      }

      const headers = Object.keys(jsonData[0]);
      setExcelHeaders(headers);
      setRawExcelData(jsonData);

      // Auto-detect: try to map identity columns by common names
      const autoMap: Record<string, string> = {};
      for (const header of headers) {
        const lower = header.toLowerCase().trim();
        if (lower === "name" || lower === "student name" || lower === "student_name") {
          autoMap["name"] = header;
        } else if (lower === "dob" || lower === "date of birth" || lower === "date_of_birth" || lower === "birth date") {
          autoMap["dob"] = header;
        } else if (lower === "phone" || lower === "phone number" || lower === "phone_number" || lower === "mobile" || lower === "mobile number") {
          autoMap["phone"] = header;
        }
      }
      setFieldToHeader(autoMap);
    };
    reader.readAsBinaryString(file);
  };

  // ============ Mapping Handlers ============

  const handleFieldMapping = (fieldKey: string, excelHeader: string) => {
    setFieldToHeader((prev) => {
      const updated = { ...prev };
      if (excelHeader === "") {
        delete updated[fieldKey];
      } else {
        updated[fieldKey] = excelHeader;
      }
      return updated;
    });
  };

  // Get set of already-used Excel headers (to prevent duplicate mapping)
  const usedHeaders = useMemo(() => {
    return new Set(Object.values(fieldToHeader));
  }, [fieldToHeader]);

  // ============ Apply Mapping & Parse ============

  const handleApplyMapping = () => {
    if (!mappingData || rawExcelData.length === 0) return;

    const nameHeader = fieldToHeader["name"];
    const dobHeader = fieldToHeader["dob"];
    const phoneHeader = fieldToHeader["phone"];

    const rows = rawExcelData.map((row) => {
      const rowErrors: string[] = [];

      const name = nameHeader ? String(row[nameHeader] ?? "").trim() : "";
      if (!name) rowErrors.push("Name is required");

      let dob = "";
      if (dobHeader) {
        dob = normalizeDob(row[dobHeader]);
        if (dob && !/^\d{2}-\d{2}-\d{4}$/.test(dob)) {
          rowErrors.push(`DOB "${row[dobHeader]}" could not be parsed to dd-MM-yyyy`);
        }
      }

      const phone = phoneHeader ? String(row[phoneHeader] ?? "").trim() : "";

      const answers: { [qqId: number]: number | null } = {};
      const mqtSelections: Record<number, number[]> = {};

      for (const [fieldKey, excelHeader] of Object.entries(fieldToHeader)) {
        if (fieldKey === "name" || fieldKey === "dob" || fieldKey === "phone") continue;

        const cellVal = row[excelHeader];

        if (fieldKey.startsWith("q_")) {
          const qqId = Number(fieldKey.substring(2));
          const q = mappingData.questions.find(
            (q) => q.questionnaireQuestionId === qqId
          );
          if (q) {
            const result = resolveOptionId(cellVal, q.options);
            answers[qqId] = result.optionId;
            if (result.error) rowErrors.push(`${excelHeader}: ${result.error}`);
          }
        } else if (fieldKey.startsWith("mqt_")) {
          const parts = fieldKey.split("_");
          const qqId = Number(parts[1]);
          const optionId = Number(parts[2]);
          const val = String(cellVal ?? "").trim();
          if (val === "1" || val.toLowerCase() === "yes" || val.toLowerCase() === "y") {
            if (!mqtSelections[qqId]) mqtSelections[qqId] = [];
            mqtSelections[qqId].push(optionId);
          }
        }
      }

      // Resolve MQT selections
      for (const [qqIdStr, selectedIds] of Object.entries(mqtSelections)) {
        const qqId = Number(qqIdStr);
        if (selectedIds.length === 1) {
          answers[qqId] = selectedIds[0];
        } else if (selectedIds.length > 1) {
          answers[qqId] = null;
          rowErrors.push(`Question ${qqId}: Multiple MQT options selected`);
        }
      }

      return { name, dob, phone, answers, rowErrors };
    });

    setParsedRows(rows);
    setMappingApplied(true);
  };

  // ============ Edit Handlers ============

  const handleFieldChange = (rowIndex: number, field: "name" | "dob" | "phone", value: string) => {
    setParsedRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = { ...updated[rowIndex], [field]: value };
      return updated;
    });
  };

  const handleAnswerChange = (rowIndex: number, qqId: number, optionId: number | null) => {
    setParsedRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[rowIndex] };
      row.answers = { ...row.answers, [qqId]: optionId };
      updated[rowIndex] = row;
      return updated;
    });
  };

  // ============ Submit ============

  const handleSubmit = async () => {
    if (!mappingData || parsedRows.length === 0) return;

    const rowsWithNameError = parsedRows.filter((r) => !r.name.trim());
    if (rowsWithNameError.length > 0) {
      alert(`${rowsWithNameError.length} row(s) have no student name. Please fix before submitting.`);
      return;
    }

    const rowsWithErrors = parsedRows.filter((r) => r.rowErrors.length > 0);
    if (rowsWithErrors.length > 0) {
      if (!window.confirm(`${rowsWithErrors.length} row(s) have parsing warnings. Those answers may be skipped. Continue?`))
        return;
    }

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const students = parsedRows.map((row) => ({
        name: row.name.trim(),
        dob: row.dob || undefined,
        phone: row.phone || undefined,
        answers: Object.entries(row.answers)
          .filter(([, optId]) => optId !== null)
          .map(([qqId, optId]) => ({
            questionnaireQuestionId: Number(qqId),
            optionId: optId!,
          })),
      }));

      const res = await bulkSubmitWithStudents({
        assessmentId: mappingData.assessmentId,
        instituteId: Number(selectedInstitute),
        students,
      });

      setSubmitResult(res.data);
    } catch (error: any) {
      console.error("Submit failed:", error);
      setSubmitResult({
        status: "error",
        message: error.response?.data || error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ============ Render ============

  // Group mapping rows by section for display
  const groupedMappingRows = useMemo(() => {
    const groups: Record<string, typeof mappingRows> = {};
    for (const row of mappingRows) {
      if (!groups[row.sectionName]) groups[row.sectionName] = [];
      groups[row.sectionName].push(row);
    }
    return groups;
  }, [mappingRows]);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Offline Assessment Data Upload</h3>
      </div>
      <div className="card-body">
        {/* Section 1: School & Assessment Selection */}
        <div className="card card-body bg-light mb-4">
          <h6 className="mb-3">Select School & Assessment</h6>
          <div className="row g-3 align-items-end">
            <div className="col-md-5">
              <Form.Label>School / Institute</Form.Label>
              {loadingInstitutes ? (
                <div><Spinner animation="border" size="sm" /> Loading...</div>
              ) : (
                <Form.Select
                  value={selectedInstitute}
                  onChange={(e) => setSelectedInstitute(e.target.value)}
                >
                  <option value="">Select an institute...</option>
                  {institutes.map((inst: any) => (
                    <option key={inst.instituteCode} value={inst.instituteCode}>
                      {inst.instituteName}
                    </option>
                  ))}
                </Form.Select>
              )}
            </div>
            <div className="col-md-5">
              <Form.Label>Assessment</Form.Label>
              {loadingAssessments ? (
                <div><Spinner animation="border" size="sm" /> Loading...</div>
              ) : (
                <Form.Select
                  value={selectedAssessment}
                  onChange={(e) => setSelectedAssessment(e.target.value)}
                  disabled={!selectedInstitute}
                >
                  <option value="">Select an assessment...</option>
                  {assessmentMappings.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.assessmentName}
                    </option>
                  ))}
                </Form.Select>
              )}
            </div>
            <div className="col-md-2">
              {loadingMapping && <Spinner animation="border" size="sm" className="ms-2" />}
            </div>
          </div>
          {mappingData && (
            <div className="mt-3">
              <Badge bg="success" className="me-2">
                Questionnaire: {mappingData.questionnaireName}
              </Badge>
              <Badge bg="info" className="me-2">
                {mappingData.sections?.length || 0} sections
              </Badge>
              <Badge bg="secondary">
                {mappingData.questions.length} questions
              </Badge>
            </div>
          )}
        </div>

        {/* Section 2: Upload Excel */}
        {mappingData && (
          <div className="card card-body bg-light mb-4">
            <h6 className="mb-3">Upload Excel File</h6>
            <div className="row g-3 align-items-end">
              <div className="col-md-6">
                <Form.Label>Choose Excel File</Form.Label>
                <Form.Control
                  type="file"
                  accept=".xlsx,.xls"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
              </div>
              <div className="col-md-4">
                {fileName && <small className="text-muted">{fileName}</small>}
              </div>
              <div className="col-md-2">
                {excelHeaders.length > 0 && (
                  <Badge bg="info">{rawExcelData.length} rows, {excelHeaders.length} columns</Badge>
                )}
              </div>
            </div>
            <div className="mt-2">
              <small className="text-muted">
                Upload any Excel file with one student per row. You will map its columns to questions next.
              </small>
            </div>
          </div>
        )}

        {/* Section 3: Column Mapping - DB questions on left, Excel headers dropdown on right */}
        {excelHeaders.length > 0 && mappingData && !mappingApplied && (
          <div className="card card-body bg-light mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">Map DB Questions to Excel Columns</h6>
              <div className="d-flex gap-2 align-items-center">
                {mappingValidation.issues.length > 0 && (
                  <small className="text-warning">
                    {mappingValidation.issues[0]}
                  </small>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApplyMapping}
                  disabled={!mappingValidation.hasName || mappingValidation.mappedCount === 0}
                >
                  Apply Mapping & Preview
                </Button>
              </div>
            </div>

            <div style={{ maxHeight: "500px", overflowY: "auto", border: "1px solid #dee2e6" }}>
              <table className="table table-bordered table-sm mb-0">
                <thead style={{ position: "sticky", top: 0, zIndex: 2, backgroundColor: "#212529", color: "#fff" }}>
                  <tr>
                    <th style={{ width: "50%", backgroundColor: "#212529", color: "#fff" }}>DB Question / Field</th>
                    <th style={{ width: "50%", backgroundColor: "#212529", color: "#fff" }}>Excel Column</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedMappingRows).map(([sectionName, rows]) => (
                    <>
                      <tr key={`section-${sectionName}`} className="table-secondary">
                        <td colSpan={2}>
                          <strong>{sectionName}</strong>
                          <small className="text-muted ms-2">({rows.length} fields)</small>
                        </td>
                      </tr>
                      {rows.map((row) => {
                        const currentHeader = fieldToHeader[row.key] || "";
                        const isMapped = !!currentHeader;

                        return (
                          <tr key={row.key} className={isMapped ? "" : "text-muted"}>
                            <td>
                              {row.label}
                              {row.isMQT && (
                                <Badge bg="info" className="ms-1" style={{ fontSize: "0.65rem" }}>MQT</Badge>
                              )}
                              {row.key === "name" && (
                                <Badge bg="danger" className="ms-1" style={{ fontSize: "0.65rem" }}>Required</Badge>
                              )}
                            </td>
                            <td>
                              <Form.Select
                                size="sm"
                                value={currentHeader}
                                onChange={(e) => handleFieldMapping(row.key, e.target.value)}
                              >
                                <option value="">-- Not mapped --</option>
                                {excelHeaders.map((h) => (
                                  <option
                                    key={h}
                                    value={h}
                                    disabled={usedHeaders.has(h) && h !== currentHeader}
                                  >
                                    {h}{usedHeaders.has(h) && h !== currentHeader ? " (already used)" : ""}
                                  </option>
                                ))}
                              </Form.Select>
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 4: Preview & Edit Table */}
        {mappingApplied && parsedRows.length > 0 && mappingData && (
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">
                Preview ({parsedRows.length} students)
                {parsedRows.some((r) => r.rowErrors.length > 0) && (
                  <Badge bg="warning" className="ms-2">Has warnings</Badge>
                )}
              </h6>
              <div className="d-flex gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => { setMappingApplied(false); setParsedRows([]); }}
                >
                  Back to Mapping
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={resetUploadState}
                >
                  Clear & Re-upload
                </Button>
              </div>
            </div>
            <div style={{ maxHeight: "500px", overflow: "auto", border: "1px solid #dee2e6" }}>
              <table className="table table-bordered table-sm table-hover mb-0">
                <thead style={{ position: "sticky", top: 0, zIndex: 2, backgroundColor: "#212529", color: "#fff" }}>
                  <tr>
                    <th style={{ minWidth: "40px", backgroundColor: "#212529", color: "#fff" }}>#</th>
                    <th style={{ minWidth: "150px", backgroundColor: "#212529", color: "#fff" }}>Name</th>
                    <th style={{ minWidth: "110px", backgroundColor: "#212529", color: "#fff" }}>DOB</th>
                    <th style={{ minWidth: "120px", backgroundColor: "#212529", color: "#fff" }}>Phone</th>
                    {previewColumns.map((col) => (
                      <th
                        key={col.qqId}
                        style={{ minWidth: "140px", backgroundColor: "#212529", color: "#fff" }}
                        title={col.questionText}
                      >
                        {col.questionText?.substring(0, 25) || `Q${col.qqId}`}
                        {col.isMQT && (
                          <Badge bg="info" className="ms-1" style={{ fontSize: "0.6rem" }}>MQT</Badge>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, rowIdx) => {
                    const hasErrors = row.rowErrors.length > 0;
                    const noName = !row.name.trim();
                    const weakMatch = !row.dob && !row.phone && !noName;

                    return (
                      <tr
                        key={rowIdx}
                        className={noName ? "table-danger" : hasErrors ? "table-danger" : weakMatch ? "table-warning" : ""}
                        title={row.rowErrors.length > 0 ? row.rowErrors.join("; ") : weakMatch ? "No DOB or phone - may create duplicate" : ""}
                      >
                        <td>{rowIdx + 1}</td>
                        <td>
                          <input
                            type="text"
                            className={`form-control form-control-sm ${noName ? "is-invalid" : ""}`}
                            value={row.name}
                            onChange={(e) => handleFieldChange(rowIdx, "name", e.target.value)}
                            style={{ minWidth: "130px" }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={row.dob}
                            onChange={(e) => handleFieldChange(rowIdx, "dob", e.target.value)}
                            placeholder="dd-MM-yyyy"
                            style={{ minWidth: "100px" }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={row.phone}
                            onChange={(e) => handleFieldChange(rowIdx, "phone", e.target.value)}
                            style={{ minWidth: "110px" }}
                          />
                        </td>
                        {previewColumns.map((col) => {
                          const optionId = row.answers[col.qqId];
                          const hasAnswerError = row.rowErrors.some(
                            (err) => err.includes(`${col.qqId}`)
                          );

                          return (
                            <td
                              key={col.qqId}
                              className={hasAnswerError ? "table-danger" : ""}
                            >
                              <select
                                className="form-select form-select-sm"
                                value={optionId ?? ""}
                                onChange={(e) =>
                                  handleAnswerChange(
                                    rowIdx,
                                    col.qqId,
                                    e.target.value === "" ? null : Number(e.target.value)
                                  )
                                }
                              >
                                <option value="">-- Skip --</option>
                                {col.options.map((opt) => (
                                  <option key={opt.optionId} value={opt.optionId}>
                                    {opt.optionText}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 5: Submit */}
        {mappingApplied && parsedRows.length > 0 && mappingData && (
          <div className="card card-body bg-light">
            <div className="d-flex align-items-center gap-3 flex-wrap">
              <Button
                variant="success"
                size="lg"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <><Spinner animation="border" size="sm" className="me-2" />Submitting...</>
                ) : (
                  <>Submit All ({parsedRows.length} students)</>
                )}
              </Button>

              {submitResult && submitResult.status === "success" && (
                <Alert variant="success" className="mb-0 flex-grow-1">
                  <strong>Upload complete.</strong>
                  <div>Students processed: <strong>{submitResult.studentsProcessed}</strong></div>
                  {submitResult.matchSummary && (
                    <div>
                      Matched existing: <Badge bg="primary">{submitResult.matchSummary.matched}</Badge>{" "}
                      Newly created: <Badge bg="success">{submitResult.matchSummary.created}</Badge>{" "}
                      Failed: <Badge bg={submitResult.matchSummary.failed > 0 ? "danger" : "secondary"}>{submitResult.matchSummary.failed}</Badge>
                    </div>
                  )}
                  {submitResult.errors?.length > 0 && (
                    <div className="mt-2">
                      <strong>Errors:</strong>
                      {submitResult.errors.map((err: any, i: number) => (
                        <div key={i} className="text-danger">
                          Row {(err.rowIndex ?? 0) + 1} ({err.name}): {err.error}
                        </div>
                      ))}
                    </div>
                  )}
                </Alert>
              )}

              {submitResult && submitResult.status === "error" && (
                <Alert variant="danger" className="mb-0 flex-grow-1">
                  Submission failed: {typeof submitResult.message === "string" ? submitResult.message : JSON.stringify(submitResult.message)}
                </Alert>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfflineAssessmentUploadPage;
