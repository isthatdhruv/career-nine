import { useEffect, useState, useRef, useMemo } from "react";
import { Spinner, Button, Form, Badge, Alert, ProgressBar } from "react-bootstrap";
import * as XLSX from "xlsx";
import { ReadCollegeData } from "../College/API/College_APIs";
import { getAssessmentMappingsByInstitute, getAssessmentSummaryList } from "../AssessmentMapping/API/AssessmentMapping_APIs";
import { getOfflineMapping, bulkSubmitAnswers } from "./API/OfflineUpload_APIs";
import { getDemographicsByAssessment } from "../CreateAssessment/API/Assessment_Demographics_APIs";

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
  userId: number | null;
  answers: { [questionnaireQuestionId: number]: number | null };
  errors: { [label: string]: string };
  userIdError?: string;
}

// Dynamic demographic field from AssessmentDemographicMapping API
interface DemographicField {
  mappingId: number;
  assessmentId: number;
  fieldDefinition: {
    fieldId: number;
    fieldName: string;
    displayLabel: string;
    fieldSource: string; // "SYSTEM" | "CUSTOM"
    systemFieldKey: string | null;
    dataType: string;
    options?: { optionId: number; optionValue: string; optionLabel: string; displayOrder: number }[];
  };
  isMandatory: boolean;
  displayOrder: number;
  customLabel: string | null;
}

// ============ Helpers ============

/** Generate section code from alphabetical index: 0 -> SEC_A, 1 -> SEC_B, etc. */
const sectionCode = (index: number): string => {
  const letter = String.fromCharCode(65 + index); // A, B, C...
  return `SEC_${letter}`;
};

/** Generate label for a question or option dropdown */
const generateLabel = (
  secCode: string,
  questionIndex: number,
  optionIndex?: number
): string => {
  const qLabel = `${secCode}_Q${questionIndex + 1}`;
  if (optionIndex !== undefined) {
    return `${qLabel}_O${optionIndex + 1}`;
  }
  return qLabel;
};

/** Resolve cell value to optionId for non-MQT questions */
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

  // Try numeric: 1, 2, 3... -> sequence
  const num = Number(val);
  if (!isNaN(num) && Number.isInteger(num) && num >= 1) {
    const opt = options.find((o) => o.sequence === num);
    if (opt) return { optionId: opt.optionId };
    return { optionId: null, error: `Sequence ${num} out of range (max ${options.length})` };
  }

  // Try alphabetic: A, B, C... -> 1, 2, 3
  const upper = val.toUpperCase();
  if (/^[A-Z]$/.test(upper)) {
    const seq = upper.charCodeAt(0) - 64;
    const opt = options.find((o) => o.sequence === seq);
    if (opt) return { optionId: opt.optionId };
    return { optionId: null, error: `Letter ${upper} out of range (max ${options.length} options)` };
  }

  // Try Yes/No
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

// ============ Component ============

const OfflineAssessmentUploadPage = () => {
  // Selection state
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<string>("");
  const [assessmentMappings, setAssessmentMappings] = useState<any[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<string>("");
  const [loadingInstitutes, setLoadingInstitutes] = useState(false);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  // Mapping data from backend
  const [mappingData, setMappingData] = useState<MappingData | null>(null);
  const [loadingMapping, setLoadingMapping] = useState(false);

  // Dynamic demographic fields for the selected assessment
  const [demographicFields, setDemographicFields] = useState<DemographicField[]>([]);

  // Excel & column mapping state
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [rawExcelData, setRawExcelData] = useState<any[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [mappingApplied, setMappingApplied] = useState(false);

  // Preview state
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [submitProgress, setSubmitProgress] = useState<{
    phase: string;
    current: number;
    total: number;
  } | null>(null);

  // ============ Derived: build mapping labels from sections ============

  const mappingLabels = useMemo(() => {
    if (!mappingData?.sections) return [];

    const labels: {
      label: string;
      sectionName: string;
      secCode: string;
      questionnaireQuestionId: number;
      questionText: string;
      isMQT: boolean;
      optionId?: number;
      optionText?: string;
      type: "question" | "option";
    }[] = [];

    mappingData.sections.forEach((section, secIdx) => {
      const secC = sectionCode(secIdx);
      section.questions.forEach((q, qIdx) => {
        if (q.isMQT) {
          // One dropdown per option
          q.options.forEach((opt, optIdx) => {
            labels.push({
              label: generateLabel(secC, qIdx, optIdx),
              sectionName: section.sectionName,
              secCode: secC,
              questionnaireQuestionId: q.questionnaireQuestionId,
              questionText: q.questionText,
              isMQT: true,
              optionId: opt.optionId,
              optionText: opt.optionText,
              type: "option",
            });
          });
        } else {
          // One dropdown per question
          labels.push({
            label: generateLabel(secC, qIdx),
            sectionName: section.sectionName,
            secCode: secC,
            questionnaireQuestionId: q.questionnaireQuestionId,
            questionText: q.questionText,
            isMQT: false,
            type: "question",
          });
        }
      });
    });

    return labels;
  }, [mappingData]);

  // Group labels by section code for rendering
  const labelsBySection = useMemo(() => {
    const grouped: Record<string, { sectionName: string; labels: typeof mappingLabels }> = {};
    for (const lbl of mappingLabels) {
      if (!grouped[lbl.secCode]) {
        grouped[lbl.secCode] = { sectionName: lbl.sectionName, labels: [] };
      }
      grouped[lbl.secCode].labels.push(lbl);
    }
    return grouped;
  }, [mappingLabels]);

  // Mapping progress
  const mappedCount = Object.values(columnMap).filter(Boolean).length;
  // +1 for userId
  const totalMappable = 1 + demographicFields.length + mappingLabels.length;

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
    setDemographicFields([]);
    resetUploadState();
    try {
      // Fetch independently so one failure doesn't block the other
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
        // No institute mappings: show all assessments
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
      setDemographicFields([]);
      resetUploadState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssessment]);

  const loadMapping = async (assessmentId: number) => {
    setLoadingMapping(true);
    resetUploadState();
    setDemographicFields([]);
    try {
      const [mappingRes, demoRes] = await Promise.all([
        getOfflineMapping(assessmentId),
        getDemographicsByAssessment(assessmentId),
      ]);
      setMappingData(mappingRes.data);
      setDemographicFields(demoRes.data || []);
    } catch (error) {
      console.error("Failed to load mapping:", error);
      alert("Failed to load assessment mapping. Make sure the assessment has a linked questionnaire.");
    } finally {
      setLoadingMapping(false);
    }
  };

  const resetUploadState = () => {
    setParsedRows([]);
    setFileName("");
    setExcelHeaders([]);
    setRawExcelData([]);
    setColumnMap({});
    setMappingApplied(false);
    setSubmitResult(null);
    setSubmitProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ============ Auto-mapping ============

  const runAutoMapping = (headers: string[]) => {
    const headersLower = headers.map((h) => h.toLowerCase().trim());
    const newMap: Record<string, string> = {};

    // Auto-map userId
    const userIdIdx = headersLower.findIndex(
      (h) => h === "userid" || h === "user_id" || h === "user id" || h === "studentid" || h === "student_id"
    );
    if (userIdIdx >= 0) newMap["userId"] = headers[userIdIdx];

    // Auto-map demographics by matching fieldName or displayLabel
    for (const df of demographicFields) {
      const fd = df.fieldDefinition;
      const label = (df.customLabel || fd.displayLabel).toLowerCase();
      const fieldName = fd.fieldName.toLowerCase();
      const sysKey = (fd.systemFieldKey || "").toLowerCase();
      for (let i = 0; i < headers.length; i++) {
        const hLower = headersLower[i];
        if (hLower === label || hLower === fieldName || (sysKey && hLower === sysKey) || hLower.includes(fieldName)) {
          newMap[`demo_${fd.fieldId}`] = headers[i];
          break;
        }
      }
    }

    // Auto-map question/option labels by exact match
    for (const lbl of mappingLabels) {
      const idx = headersLower.indexOf(lbl.label.toLowerCase());
      if (idx >= 0) newMap[lbl.label] = headers[idx];
    }

    setColumnMap(newMap);
  };

  // ============ Template Download ============

  const handleDownloadTemplate = () => {
    if (!mappingData) return;

    const headers: string[] = ["userId"];

    // Demographics headers from assessment config
    for (const df of demographicFields) {
      headers.push(df.customLabel || df.fieldDefinition.displayLabel);
    }

    // Question/option headers using labels
    for (const lbl of mappingLabels) {
      headers.push(lbl.label);
    }

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(
      wb,
      `offline_template_${mappingData.assessmentName.replace(/\s+/g, "_")}.xlsx`
    );
  };

  // ============ File Upload ============

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mappingData) return;

    setFileName(file.name);
    setSubmitResult(null);
    setSubmitProgress(null);
    setMappingApplied(false);
    setParsedRows([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (jsonData.length === 0) {
        alert("The Excel file is empty or has no data rows.");
        return;
      }

      const headers = Object.keys(jsonData[0]);
      setExcelHeaders(headers);
      setRawExcelData(jsonData);
      runAutoMapping(headers);
    };
    reader.readAsBinaryString(file);
  };

  // ============ Apply Mapping & Parse ============

  const applyMapping = () => {
    if (!mappingData || rawExcelData.length === 0) return;

    const rows: ParsedRow[] = rawExcelData.map((row) => {
      // Resolve userId
      const userIdCol = columnMap["userId"];
      let userId: number | null = null;
      let userIdError: string | undefined;
      if (userIdCol && row[userIdCol] !== undefined && row[userIdCol] !== "") {
        userId = Number(row[userIdCol]);
        if (isNaN(userId)) {
          userId = null;
          userIdError = "Invalid userId";
        }
      } else {
        userIdError = "Missing userId";
      }

      // Resolve answers
      const answers: { [qqId: number]: number | null } = {};
      const errors: { [label: string]: string } = {};

      for (const section of mappingData!.sections) {
        const secIdx = mappingData!.sections.indexOf(section);
        const secC = sectionCode(secIdx);

        section.questions.forEach((q, qIdx) => {
          if (q.isMQT) {
            // MQT: check each option column, find the one with value 1
            const selectedOptionIds: number[] = [];
            q.options.forEach((opt, optIdx) => {
              const optLabel = generateLabel(secC, qIdx, optIdx);
              const excelCol = columnMap[optLabel];
              if (excelCol) {
                const cellVal = String(row[excelCol] ?? "").trim();
                if (cellVal === "1" || cellVal.toLowerCase() === "yes" || cellVal.toLowerCase() === "y") {
                  selectedOptionIds.push(opt.optionId);
                }
              }
            });

            const qLabel = generateLabel(secC, qIdx);
            if (selectedOptionIds.length === 1) {
              answers[q.questionnaireQuestionId] = selectedOptionIds[0];
            } else if (selectedOptionIds.length > 1) {
              answers[q.questionnaireQuestionId] = null;
              errors[qLabel] = `Multiple options selected for MQT question`;
            } else {
              answers[q.questionnaireQuestionId] = null; // none selected
            }
          } else {
            // Non-MQT: single column with option number/letter
            const qLabel = generateLabel(secC, qIdx);
            const excelCol = columnMap[qLabel];
            if (excelCol) {
              const result = resolveOptionId(row[excelCol], q.options);
              answers[q.questionnaireQuestionId] = result.optionId;
              if (result.error) errors[qLabel] = result.error;
            } else {
              answers[q.questionnaireQuestionId] = null;
            }
          }
        });
      }

      return { userId, answers, errors, userIdError };
    });

    setParsedRows(rows);
    setMappingApplied(true);
  };

  // ============ Edit Handlers ============

  const handleUserIdChange = (rowIndex: number, value: string) => {
    setParsedRows((prev) => {
      const updated = [...prev];
      const numVal = value === "" ? null : Number(value);
      updated[rowIndex] = {
        ...updated[rowIndex],
        userId: numVal,
        userIdError: numVal === null || isNaN(numVal) ? "Invalid userId" : undefined,
      };
      return updated;
    });
  };

  const handleAnswerChange = (
    rowIndex: number,
    qqId: number,
    optionId: number | null
  ) => {
    setParsedRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[rowIndex] };
      row.answers = { ...row.answers, [qqId]: optionId };
      updated[rowIndex] = row;
      return updated;
    });
  };

  // ============ Column Map update helper ============

  const updateColumnMap = (key: string, value: string) => {
    setColumnMap((prev) => ({ ...prev, [key]: value }));
  };

  // ============ Submit ============

  const handleSubmit = async () => {
    if (!mappingData || parsedRows.length === 0) return;

    const invalidRows = parsedRows.filter((r) => r.userId === null || r.userIdError);
    if (invalidRows.length > 0) {
      alert(`${invalidRows.length} row(s) have invalid or missing userId. Please fix them before submitting.`);
      return;
    }

    const rowsWithErrors = parsedRows.filter((r) => Object.keys(r.errors).length > 0);
    if (rowsWithErrors.length > 0) {
      if (!window.confirm(`${rowsWithErrors.length} row(s) have parsing errors. Those answers will be skipped. Continue?`))
        return;
    }

    setSubmitting(true);
    setSubmitResult(null);
    setSubmitProgress({ phase: "Submitting answers", current: 0, total: 1 });

    try {
      const students = parsedRows.map((row) => {
        const answers: { questionnaireQuestionId: number; optionId: number }[] = [];
        for (const [qqIdStr, optionId] of Object.entries(row.answers)) {
          if (optionId !== null && optionId !== undefined) {
            answers.push({
              questionnaireQuestionId: Number(qqIdStr),
              optionId,
            });
          }
        }
        return { userStudentId: row.userId!, answers };
      });

      const res = await bulkSubmitAnswers({
        assessmentId: mappingData!.assessmentId,
        students,
      });

      setSubmitProgress({ phase: "Submitting answers", current: 1, total: 1 });
      setSubmitResult(res.data);
    } catch (error: any) {
      console.error("Submit failed:", error);
      setSubmitResult({
        status: "error",
        message: error.response?.data || error.message,
      });
    } finally {
      setSubmitting(false);
      setSubmitProgress(null);
    }
  };

  // ============ Get option text for preview ============

  const getOptionTextByQQ = (qqId: number, optionId: number | null): string => {
    if (optionId === null) return "";
    if (!mappingData) return String(optionId);
    const q = mappingData.questions.find((q) => q.questionnaireQuestionId === qqId);
    if (!q) return String(optionId);
    const opt = q.options.find((o) => o.optionId === optionId);
    return opt ? opt.optionText : String(optionId);
  };

  // Build flat list of question columns for preview table
  const previewColumns = useMemo(() => {
    if (!mappingData?.sections) return [];
    const cols: {
      label: string;
      qqId: number;
      questionText: string;
      isMQT: boolean;
      options: OptionInfo[];
    }[] = [];

    mappingData.sections.forEach((section, secIdx) => {
      const secC = sectionCode(secIdx);
      section.questions.forEach((q, qIdx) => {
        cols.push({
          label: generateLabel(secC, qIdx),
          qqId: q.questionnaireQuestionId,
          questionText: q.questionText,
          isMQT: q.isMQT,
          options: q.options,
        });
      });
    });
    return cols;
  }, [mappingData]);

  // ============ Render ============

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
              <Badge bg="secondary" className="me-2">
                {mappingData.questions.length} questions
              </Badge>
              <Badge bg="warning" text="dark">
                {demographicFields.length} demographics
              </Badge>
            </div>
          )}
        </div>

        {/* Section 2: Template Download & Upload */}
        {mappingData && (
          <div className="card card-body bg-light mb-4">
            <h6 className="mb-3">Template & Upload</h6>
            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <Button variant="outline-primary" onClick={handleDownloadTemplate}>
                  <i className="bi bi-download me-2" />
                  Download Excel Template
                </Button>
              </div>
              <div className="col-md-6">
                <Form.Label>Upload Filled Excel</Form.Label>
                <Form.Control
                  type="file"
                  accept=".xlsx,.xls"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
              </div>
              <div className="col-md-2">
                {fileName && <small className="text-muted">{fileName}</small>}
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Column Mapping UI */}
        {excelHeaders.length > 0 && mappingData && !mappingApplied && (
          <div className="card card-body bg-light mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">
                Map Excel Columns{" "}
                <Badge bg="secondary" className="ms-2">
                  {mappedCount} / {totalMappable} mapped
                </Badge>
              </h6>
              <Button
                variant="primary"
                onClick={applyMapping}
                disabled={!columnMap["userId"]}
              >
                Apply Mapping & Preview
              </Button>
            </div>

            {/* Identity */}
            <div className="mb-4">
              <h6 className="text-muted border-bottom pb-2">Identity</h6>
              <div className="row g-3">
                <div className="col-md-4">
                  <Form.Label className="mb-1 small fw-bold">userId (Student ID)</Form.Label>
                  <Form.Select
                    size="sm"
                    value={columnMap["userId"] || ""}
                    onChange={(e) => updateColumnMap("userId", e.target.value)}
                  >
                    <option value="">-- not mapped --</option>
                    {excelHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </Form.Select>
                </div>
              </div>
            </div>

            {/* Demographics */}
            {demographicFields.length > 0 && (
              <div className="mb-4">
                <h6 className="text-muted border-bottom pb-2">
                  Demographics
                  <Badge bg="secondary" className="ms-2" style={{ fontSize: "0.7rem" }}>
                    {demographicFields.length} fields
                  </Badge>
                </h6>
                <div className="row g-3">
                  {demographicFields.map((df) => {
                    const fd = df.fieldDefinition;
                    const label = df.customLabel || fd.displayLabel;
                    return (
                      <div className="col-md-4" key={fd.fieldId}>
                        <Form.Label className="mb-1 small fw-bold">
                          {label}
                          {df.isMandatory && <span className="text-danger ms-1">*</span>}
                          <span className="text-muted fw-normal ms-1" style={{ fontSize: "0.7rem" }}>
                            ({fd.fieldSource === "SYSTEM" ? fd.systemFieldKey : "custom"})
                          </span>
                        </Form.Label>
                        <Form.Select
                          size="sm"
                          value={columnMap[`demo_${fd.fieldId}`] || ""}
                          onChange={(e) => updateColumnMap(`demo_${fd.fieldId}`, e.target.value)}
                        >
                          <option value="">-- not mapped --</option>
                          {excelHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </Form.Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Question Mapping by Section */}
            {Object.entries(labelsBySection).map(([secC, { sectionName, labels }]) => (
              <div className="mb-4" key={secC}>
                <h6 className="text-muted border-bottom pb-2">
                  {secC} - {sectionName}
                </h6>
                <div className="row g-3">
                  {labels.map((lbl) => (
                    <div className="col-md-4" key={lbl.label}>
                      <Form.Label className="mb-1 small fw-bold" title={lbl.questionText}>
                        {lbl.label}
                        <span className="text-muted fw-normal ms-1" style={{ fontSize: "0.75rem" }}>
                          {lbl.type === "option" ? (
                            <>({lbl.optionText})</>
                          ) : (
                            <>
                              ({lbl.questionText && lbl.questionText.length > 30
                                ? lbl.questionText.substring(0, 30) + "..."
                                : lbl.questionText})
                            </>
                          )}
                        </span>
                      </Form.Label>
                      <Form.Select
                        size="sm"
                        value={columnMap[lbl.label] || ""}
                        onChange={(e) => updateColumnMap(lbl.label, e.target.value)}
                      >
                        <option value="">-- not mapped --</option>
                        {excelHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </Form.Select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Back to Mapping button */}
        {mappingApplied && parsedRows.length > 0 && (
          <div className="mb-3">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => {
                setMappingApplied(false);
                setParsedRows([]);
              }}
            >
              Back to Column Mapping
            </Button>
          </div>
        )}

        {/* Section 4: Preview & Edit Table */}
        {parsedRows.length > 0 && mappingData && (
          <div className="mb-4">
            <h6 className="mb-3">
              Preview ({parsedRows.length} students)
              {parsedRows.some((r) => Object.keys(r.errors).length > 0) && (
                <Badge bg="warning" className="ms-2">Has errors</Badge>
              )}
            </h6>
            <div className="table-responsive" style={{ maxHeight: "500px" }}>
              <table className="table table-bordered table-sm table-hover">
                <thead className="table-dark" style={{ position: "sticky", top: 0 }}>
                  {/* Section header row */}
                  <tr>
                    <th rowSpan={2} style={{ minWidth: "50px" }}>#</th>
                    <th rowSpan={2} style={{ minWidth: "120px" }}>userId</th>
                    {Object.entries(labelsBySection).map(([secC, { sectionName, labels }]) => {
                      // Count unique questions in this section
                      const uniqueQQIds = new Set(labels.map((l) => l.questionnaireQuestionId));
                      return (
                        <th
                          key={secC}
                          colSpan={uniqueQQIds.size}
                          className="text-center"
                          style={{ borderLeft: "2px solid #666" }}
                        >
                          {secC} - {sectionName}
                        </th>
                      );
                    })}
                  </tr>
                  {/* Question label row */}
                  <tr>
                    {previewColumns.map((col, idx) => {
                      // Add section border on first question of each section
                      const isFirstInSection = idx === 0 || previewColumns[idx - 1] &&
                        mappingData.questions.find(q => q.questionnaireQuestionId === previewColumns[idx - 1].qqId)?.questionnaireSectionId !==
                        mappingData.questions.find(q => q.questionnaireQuestionId === col.qqId)?.questionnaireSectionId;
                      return (
                        <th
                          key={col.label}
                          style={{
                            minWidth: "140px",
                            ...(isFirstInSection ? { borderLeft: "2px solid #666" } : {}),
                          }}
                          title={col.questionText}
                        >
                          {col.label}
                          {col.isMQT && (
                            <Badge bg="info" className="ms-1" style={{ fontSize: "0.6rem" }}>MQT</Badge>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      <td>{rowIdx + 1}</td>
                      <td className={row.userIdError ? "table-danger" : ""}>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={row.userId ?? ""}
                          onChange={(e) => handleUserIdChange(rowIdx, e.target.value)}
                          style={{ width: "100px" }}
                        />
                      </td>
                      {previewColumns.map((col) => {
                        const optionId = row.answers[col.qqId];
                        const hasError = Object.keys(row.errors).some(
                          (errKey) => errKey.startsWith(col.label.split("_O")[0])
                        );
                        const isBlank = optionId === null && !hasError;

                        return (
                          <td
                            key={col.label}
                            className={hasError ? "table-danger" : isBlank ? "table-warning" : ""}
                            title={
                              Object.entries(row.errors)
                                .filter(([k]) => k.startsWith(col.label.split("_O")[0]))
                                .map(([, v]) => v)
                                .join(", ") || ""
                            }
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 5: Submit */}
        {parsedRows.length > 0 && mappingData && (
          <div className="card card-body bg-light">
            {submitting && submitProgress && (
              <div className="mb-3">
                <div className="d-flex justify-content-between mb-1">
                  <small className="fw-bold">{submitProgress.phase}...</small>
                  <small>{submitProgress.current} / {submitProgress.total}</small>
                </div>
                <ProgressBar
                  now={submitProgress.total > 0 ? (submitProgress.current / submitProgress.total) * 100 : 0}
                  animated
                  striped
                />
              </div>
            )}

            <div className="d-flex align-items-center gap-3">
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
                  Successfully processed{" "}
                  <strong>{submitResult.studentsProcessed}</strong> students.
                  {submitResult.errors?.length > 0 && (
                    <span className="text-danger ms-2">
                      {submitResult.errors.length} error(s):
                      {submitResult.errors.map((err: any, i: number) => (
                        <div key={i}>Student {err.userStudentId}: {err.error}</div>
                      ))}
                    </span>
                  )}
                </Alert>
              )}

              {submitResult && submitResult.status === "error" && (
                <Alert variant="danger" className="mb-0 flex-grow-1">
                  Submission failed: {submitResult.message}
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
