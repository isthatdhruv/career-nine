import { useEffect, useState, useRef } from "react";
import { Spinner, Button, Form, Badge, Alert, ProgressBar } from "react-bootstrap";
import * as XLSX from "xlsx";
import { ReadCollegeData } from "../College/API/College_APIs";
import { getAssessmentMappingsByInstitute, getAssessmentSummaryList } from "../AssessmentMapping/API/AssessmentMapping_APIs";
import { getOfflineMapping, bulkSubmitAnswers, addStudentInfo } from "./API/OfflineUpload_APIs";

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
  options: OptionInfo[];
}

interface MappingData {
  assessmentId: number;
  assessmentName: string;
  questionnaireName: string;
  questions: QuestionMapping[];
}

// Parsed row: userId + optionId per question header (null = skipped)
interface ParsedRow {
  userId: number | null;
  studentData?: Record<string, string>; // only in createStudentsMode
  answers: { [header: string]: number | null }; // header -> optionId
  errors: { [header: string]: string }; // header -> error message
  userIdError?: string;
}

// Student fields config for column mapping
const STUDENT_FIELDS = [
  { key: "name", label: "Name", match: ["name", "student name", "student_name"] },
  { key: "schoolRollNumber", label: "Roll Number", match: ["roll", "rollno", "roll_number", "roll number", "roll no"] },
  { key: "phoneNumber", label: "Phone Number", match: ["phone", "mobile", "contact", "phone number", "phonenumber"] },
  { key: "email", label: "Email", match: ["email", "mail", "e-mail"] },
  { key: "studentDob", label: "Date of Birth", match: ["dob", "birth", "date_of_birth", "date of birth", "dateofbirth"] },
  { key: "gender", label: "Gender", match: ["gender", "sex"] },
  { key: "studentClass", label: "Class", match: ["class", "grade", "standard"] },
  { key: "address", label: "Address", match: ["address", "addr"] },
  { key: "sibling", label: "Siblings", match: ["sibling", "siblings"] },
  { key: "family", label: "Family", match: ["family"] },
  { key: "schoolBoard", label: "School Board", match: ["board", "school board", "schoolboard"] },
];

// Convert Excel serial date or string to dd-MM-yyyy
const formatDate = (val: any): string => {
  if (!val) return "";
  let date;
  if (typeof val === "number") {
    date = new Date((val - 25569) * 86400 * 1000);
  } else {
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) date = new Date(parsed);
  }
  if (date && !isNaN(date.getTime())) {
    return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
  }
  return String(val);
};

const OfflineAssessmentUploadPage = () => {
  // Section 1: Selection state
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<string>("");
  const [assessmentMappings, setAssessmentMappings] = useState<any[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<string>("");
  const [loadingInstitutes, setLoadingInstitutes] = useState(false);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  // Mapping data from backend
  const [mappingData, setMappingData] = useState<MappingData | null>(null);
  const [loadingMapping, setLoadingMapping] = useState(false);

  // Mode toggle
  const [createStudentsMode, setCreateStudentsMode] = useState(false);

  // Column mapping state (createStudentsMode only)
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [rawExcelData, setRawExcelData] = useState<any[]>([]);
  const [studentFieldMap, setStudentFieldMap] = useState<Record<string, string>>({});
  const [questionFieldMap, setQuestionFieldMap] = useState<Record<string, string>>({});
  const [mappingApplied, setMappingApplied] = useState(false);

  // Section 2-3: Upload & Preview state
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Section 4: Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [submitProgress, setSubmitProgress] = useState<{
    phase: string;
    current: number;
    total: number;
  } | null>(null);

  // Load institutes on mount
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

  // Load assessments when institute changes
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
      const [mappingsRes, summaryRes] = await Promise.all([
        getAssessmentMappingsByInstitute(instituteCode),
        getAssessmentSummaryList(),
      ]);
      const mappings = mappingsRes.data || [];
      const allAssessments = summaryRes.data || [];

      const mappedIds = new Set(mappings.map((m: any) => m.assessmentId));
      const filtered = allAssessments.filter((a: any) => mappedIds.has(a.id));
      setAssessmentMappings(filtered);
    } catch (error) {
      console.error("Failed to load assessments:", error);
    } finally {
      setLoadingAssessments(false);
    }
  };

  // Load mapping when assessment changes
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
      const res = await getOfflineMapping(assessmentId);
      setMappingData(res.data);
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
    setStudentFieldMap({});
    setQuestionFieldMap({});
    setMappingApplied(false);
    setSubmitResult(null);
    setSubmitProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Reset upload state when mode changes
  useEffect(() => {
    resetUploadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createStudentsMode]);

  // Build a lookup: header -> QuestionMapping
  const headerToQuestion: { [header: string]: QuestionMapping } = {};
  if (mappingData) {
    for (const q of mappingData.questions) {
      if (q.excelQuestionHeader) {
        headerToQuestion[q.excelQuestionHeader] = q;
      }
    }
  }

  const uniqueAssessments = assessmentMappings;

  // ============ Auto-mapping ============
  const runAutoMapping = (headers: string[]) => {
    const headersLower = headers.map((h) => h.toLowerCase().trim());

    // Auto-map student fields
    const newStudentMap: Record<string, string> = {};
    for (const field of STUDENT_FIELDS) {
      for (let i = 0; i < headers.length; i++) {
        const hLower = headersLower[i];
        if (field.match.some((m) => hLower === m || hLower.includes(m))) {
          newStudentMap[field.key] = headers[i];
          break;
        }
      }
    }
    setStudentFieldMap(newStudentMap);

    // Auto-map question headers (exact match)
    const newQuestionMap: Record<string, string> = {};
    if (mappingData) {
      for (const q of mappingData.questions) {
        const qHeader = q.excelQuestionHeader;
        if (!qHeader) continue;
        const qLower = qHeader.toLowerCase().trim();
        for (let i = 0; i < headers.length; i++) {
          if (headersLower[i] === qLower || headers[i] === qHeader) {
            newQuestionMap[qHeader] = headers[i];
            break;
          }
        }
      }
    }
    setQuestionFieldMap(newQuestionMap);
  };

  // ============ Template Download ============
  const handleDownloadTemplate = () => {
    if (!mappingData) return;

    const headers: string[] = [];

    if (createStudentsMode) {
      // Add student field headers first
      for (const field of STUDENT_FIELDS) {
        headers.push(field.label);
      }
    } else {
      headers.push("userId");
    }

    for (const q of mappingData.questions) {
      if (q.excelQuestionHeader) {
        headers.push(q.excelQuestionHeader);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(
      wb,
      `offline_template_${mappingData.assessmentName.replace(/\s+/g, "_")}.xlsx`
    );
  };

  // ============ Excel Parsing ============
  const resolveOptionId = (
    cellValue: any,
    question: QuestionMapping
  ): { optionId: number | null; error?: string } => {
    if (cellValue === null || cellValue === undefined || cellValue === "") {
      return { optionId: null };
    }

    const val = String(cellValue).trim();
    if (val === "") return { optionId: null };

    const options = question.options;
    if (!options || options.length === 0) {
      return { optionId: null, error: "No options defined" };
    }

    // Try numeric: 1, 2, 3, 4 -> sequence
    const num = Number(val);
    if (!isNaN(num) && Number.isInteger(num) && num >= 1) {
      const opt = options.find((o) => o.sequence === num);
      if (opt) return { optionId: opt.optionId };
      return { optionId: null, error: `Sequence ${num} out of range (max ${options.length})` };
    }

    // Try alphabetic: A, B, C, D -> 1, 2, 3, 4
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
      return { optionId: null, error: "No first option for Yes" };
    }
    if (lower === "no" || lower === "n") {
      const opt = options.find((o) => o.sequence === 2);
      if (opt) return { optionId: opt.optionId };
      return { optionId: null, error: "No second option for No" };
    }

    return { optionId: null, error: `Unrecognized value: "${val}"` };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mappingData) return;

    setFileName(file.name);
    setSubmitResult(null);
    setSubmitProgress(null);
    setMappingApplied(false);

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

      if (createStudentsMode) {
        // Store raw data and headers, let user map columns
        const headers = Object.keys(jsonData[0]);
        setExcelHeaders(headers);
        setRawExcelData(jsonData);
        setParsedRows([]);
        runAutoMapping(headers);
      } else {
        // Existing behavior: parse directly using userId + question headers
        const rows: ParsedRow[] = jsonData.map((row: any) => {
          const userId = row["userId"] !== undefined && row["userId"] !== ""
            ? Number(row["userId"])
            : null;

          const answers: { [header: string]: number | null } = {};
          const errors: { [header: string]: string } = {};

          for (const q of mappingData!.questions) {
            const header = q.excelQuestionHeader;
            if (!header) continue;
            const cellValue = row[header];
            const result = resolveOptionId(cellValue, q);
            answers[header] = result.optionId;
            if (result.error) {
              errors[header] = result.error;
            }
          }

          return {
            userId,
            answers,
            errors,
            userIdError: userId === null ? "Missing userId" : undefined,
          };
        });

        setParsedRows(rows);
      }
    };
    reader.readAsBinaryString(file);
  };

  // ============ Apply Column Mapping (createStudentsMode) ============
  const applyMapping = () => {
    if (!mappingData || rawExcelData.length === 0) return;

    const rows: ParsedRow[] = rawExcelData.map((row) => {
      // Build student data from studentFieldMap
      const studentData: Record<string, string> = {};
      for (const field of STUDENT_FIELDS) {
        const excelCol = studentFieldMap[field.key];
        if (excelCol && row[excelCol] != null && row[excelCol] !== "") {
          studentData[field.key] =
            field.key === "studentDob"
              ? formatDate(row[excelCol])
              : String(row[excelCol]);
        }
      }

      // Build answers from questionFieldMap
      const answers: { [header: string]: number | null } = {};
      const errors: { [header: string]: string } = {};
      for (const q of mappingData!.questions) {
        const header = q.excelQuestionHeader;
        if (!header) continue;
        const excelCol = questionFieldMap[header];
        if (!excelCol) {
          answers[header] = null;
          continue;
        }
        const cellValue = row[excelCol];
        const result = resolveOptionId(cellValue, q);
        answers[header] = result.optionId;
        if (result.error) errors[header] = result.error;
      }

      return { userId: null, studentData, answers, errors };
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
        userIdError:
          numVal === null || isNaN(numVal) ? "Invalid userId" : undefined,
      };
      return updated;
    });
  };

  const handleAnswerChange = (
    rowIndex: number,
    header: string,
    optionId: number | null
  ) => {
    setParsedRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[rowIndex] };
      row.answers = { ...row.answers, [header]: optionId };
      const newErrors = { ...row.errors };
      delete newErrors[header];
      row.errors = newErrors;
      updated[rowIndex] = row;
      return updated;
    });
  };

  // ============ Submit ============
  const handleSubmit = async () => {
    if (!mappingData || parsedRows.length === 0) return;

    if (createStudentsMode) {
      await handleCreateStudentsAndSubmit();
    } else {
      await handleExistingStudentsSubmit();
    }
  };

  // Original submit logic for existing students
  const handleExistingStudentsSubmit = async () => {
    const invalidRows = parsedRows.filter(
      (r) => r.userId === null || r.userIdError
    );
    if (invalidRows.length > 0) {
      alert(
        `${invalidRows.length} row(s) have invalid or missing userId. Please fix them before submitting.`
      );
      return;
    }

    const rowsWithErrors = parsedRows.filter(
      (r) => Object.keys(r.errors).length > 0
    );
    if (rowsWithErrors.length > 0) {
      if (
        !window.confirm(
          `${rowsWithErrors.length} row(s) have parsing errors. Cells with errors will be skipped. Continue?`
        )
      )
        return;
    }

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const students = parsedRows.map((row) => {
        const answers: { questionnaireQuestionId: number; optionId: number }[] = [];
        for (const q of mappingData!.questions) {
          const header = q.excelQuestionHeader;
          if (!header) continue;
          const optionId = row.answers[header];
          if (optionId !== null && optionId !== undefined) {
            answers.push({
              questionnaireQuestionId: q.questionnaireQuestionId,
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

  // Two-phase submit: create students then submit answers
  const handleCreateStudentsAndSubmit = async () => {
    const rowsWithErrors = parsedRows.filter(
      (r) => Object.keys(r.errors).length > 0
    );
    if (rowsWithErrors.length > 0) {
      if (
        !window.confirm(
          `${rowsWithErrors.length} row(s) have answer parsing errors. Those cells will be skipped. Continue?`
        )
      )
        return;
    }

    setSubmitting(true);
    setSubmitResult(null);

    let studentsCreated = 0;
    let studentsFailed = 0;
    const failedDetails: { row: number; error: string }[] = [];
    const updatedRows = [...parsedRows];

    // Phase 1: Create students sequentially
    setSubmitProgress({ phase: "Creating students", current: 0, total: parsedRows.length });

    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i];
      const payload: any = {
        ...(row.studentData || {}),
        instituteId: Number(selectedInstitute),
        assesment_id: String(selectedAssessment),
      };

      // Convert numeric fields
      if (payload.studentClass) payload.studentClass = Number(payload.studentClass);
      if (payload.sibling) payload.sibling = Number(payload.sibling);
      if (payload.phoneNumber) payload.phoneNumber = Number(payload.phoneNumber);

      try {
        const res = await addStudentInfo(payload);
        // /student-info/add returns StudentAssessmentMapping
        const data = res.data as any;
        const userStudentId =
          data.userStudent?.userStudentId ??
          data.userStudentId ??
          data.id;
        updatedRows[i] = { ...row, userId: userStudentId };
        studentsCreated++;
      } catch (err: any) {
        console.error(`Failed to create student row ${i + 1}:`, err);
        updatedRows[i] = { ...row, userId: null };
        studentsFailed++;
        failedDetails.push({
          row: i + 1,
          error: err.response?.data?.message || err.message || "Unknown error",
        });
      }

      setSubmitProgress({
        phase: "Creating students",
        current: i + 1,
        total: parsedRows.length,
      });
    }

    setParsedRows(updatedRows);

    // Phase 2: Submit answers for successfully created students
    const successRows = updatedRows.filter((r) => r.userId !== null);
    let answersResult: any = null;

    if (successRows.length > 0) {
      setSubmitProgress({
        phase: "Submitting answers",
        current: 0,
        total: 1,
      });

      const studentsPayload = successRows.map((row) => {
        const answers: { questionnaireQuestionId: number; optionId: number }[] = [];
        for (const q of mappingData!.questions) {
          const header = q.excelQuestionHeader;
          if (!header) continue;
          const optionId = row.answers[header];
          if (optionId !== null && optionId !== undefined) {
            answers.push({
              questionnaireQuestionId: q.questionnaireQuestionId,
              optionId,
            });
          }
        }
        return { userStudentId: row.userId!, answers };
      });

      try {
        const res = await bulkSubmitAnswers({
          assessmentId: mappingData!.assessmentId,
          students: studentsPayload,
        });
        answersResult = res.data;
      } catch (err: any) {
        console.error("Bulk answer submission failed:", err);
        answersResult = {
          status: "error",
          message: err.response?.data || err.message,
        };
      }
    }

    setSubmitProgress(null);
    setSubmitResult({
      status: "success",
      createStudentsMode: true,
      studentsCreated,
      studentsFailed,
      failedDetails,
      answersResult,
    });
    setSubmitting(false);
  };

  // ============ Helpers for table headers ============
  const questionHeaders = mappingData
    ? mappingData.questions.filter((q) => q.excelQuestionHeader)
    : [];

  // Get mapped student field keys that have a column assigned
  const mappedStudentFields = createStudentsMode
    ? STUDENT_FIELDS.filter((f) => studentFieldMap[f.key])
    : [];

  const getOptionText = (header: string, optionId: number | null): string => {
    if (optionId === null) return "";
    const q = headerToQuestion[header];
    if (!q) return String(optionId);
    const opt = q.options.find((o) => o.optionId === optionId);
    return opt ? opt.optionText : String(optionId);
  };

  // Count how many columns are mapped
  const mappedStudentCount = Object.values(studentFieldMap).filter(Boolean).length;
  const mappedQuestionCount = Object.values(questionFieldMap).filter(Boolean).length;
  const totalMapped = mappedStudentCount + mappedQuestionCount;
  const totalMappable = STUDENT_FIELDS.length + questionHeaders.length;

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
                <div>
                  <Spinner animation="border" size="sm" /> Loading...
                </div>
              ) : (
                <Form.Select
                  value={selectedInstitute}
                  onChange={(e) => setSelectedInstitute(e.target.value)}
                >
                  <option value="">Select an institute...</option>
                  {institutes.map((inst: any) => (
                    <option
                      key={inst.instituteCode}
                      value={inst.instituteCode}
                    >
                      {inst.instituteName}
                    </option>
                  ))}
                </Form.Select>
              )}
            </div>
            <div className="col-md-5">
              <Form.Label>Assessment</Form.Label>
              {loadingAssessments ? (
                <div>
                  <Spinner animation="border" size="sm" /> Loading...
                </div>
              ) : (
                <Form.Select
                  value={selectedAssessment}
                  onChange={(e) => setSelectedAssessment(e.target.value)}
                  disabled={!selectedInstitute}
                >
                  <option value="">Select an assessment...</option>
                  {uniqueAssessments.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.assessmentName}
                    </option>
                  ))}
                </Form.Select>
              )}
            </div>
            <div className="col-md-2">
              {loadingMapping && (
                <Spinner animation="border" size="sm" className="ms-2" />
              )}
            </div>
          </div>
          {mappingData && (
            <div className="mt-3">
              <Badge bg="success" className="me-2">
                Questionnaire: {mappingData.questionnaireName}
              </Badge>
              <Badge bg="info">
                {mappingData.questions.length} questions mapped
              </Badge>
            </div>
          )}
        </div>

        {/* Mode Toggle */}
        {mappingData && (
          <div className="card card-body bg-light mb-4">
            <h6 className="mb-3">Upload Mode</h6>
            <div className="d-flex gap-4">
              <Form.Check
                type="radio"
                id="mode-existing"
                name="uploadMode"
                label="Students already exist (userId required)"
                checked={!createStudentsMode}
                onChange={() => setCreateStudentsMode(false)}
              />
              <Form.Check
                type="radio"
                id="mode-create"
                name="uploadMode"
                label="Create new students from Excel"
                checked={createStudentsMode}
                onChange={() => setCreateStudentsMode(true)}
              />
            </div>
          </div>
        )}

        {/* Section 2: Template Download & Upload */}
        {mappingData && (
          <div className="card card-body bg-light mb-4">
            <h6 className="mb-3">Template & Upload</h6>
            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <Button
                  variant="outline-primary"
                  onClick={handleDownloadTemplate}
                >
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
                {fileName && (
                  <small className="text-muted">{fileName}</small>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Column Mapping UI (createStudentsMode only) */}
        {createStudentsMode && excelHeaders.length > 0 && !mappingApplied && (
          <div className="card card-body bg-light mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">
                Map Excel Columns{" "}
                <Badge bg="secondary" className="ms-2">
                  {totalMapped} / {totalMappable} mapped
                </Badge>
              </h6>
              <Button
                variant="primary"
                onClick={applyMapping}
                disabled={mappedStudentCount === 0}
              >
                Apply Mapping & Preview
              </Button>
            </div>

            {/* Student Fields Mapping */}
            <div className="mb-4">
              <h6 className="text-muted border-bottom pb-2">Student Fields</h6>
              <div className="row g-3">
                {STUDENT_FIELDS.map((field) => (
                  <div className="col-md-4" key={field.key}>
                    <Form.Label className="mb-1 small fw-bold">{field.label}</Form.Label>
                    <Form.Select
                      size="sm"
                      value={studentFieldMap[field.key] || ""}
                      onChange={(e) =>
                        setStudentFieldMap((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                    >
                      <option value="">-- not mapped --</option>
                      {excelHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Question Answer Mapping */}
            {questionHeaders.length > 0 && (
              <div>
                <h6 className="text-muted border-bottom pb-2">Question Answers</h6>
                <div className="row g-3">
                  {questionHeaders.map((q) => (
                    <div className="col-md-4" key={q.excelQuestionHeader}>
                      <Form.Label
                        className="mb-1 small fw-bold"
                        title={q.questionText}
                      >
                        {q.excelQuestionHeader}
                        <span className="text-muted fw-normal ms-1" style={{ fontSize: "0.75rem" }}>
                          ({q.questionText.length > 40
                            ? q.questionText.substring(0, 40) + "..."
                            : q.questionText})
                        </span>
                      </Form.Label>
                      <Form.Select
                        size="sm"
                        value={questionFieldMap[q.excelQuestionHeader] || ""}
                        onChange={(e) =>
                          setQuestionFieldMap((prev) => ({
                            ...prev,
                            [q.excelQuestionHeader]: e.target.value,
                          }))
                        }
                      >
                        <option value="">-- not mapped --</option>
                        {excelHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Back to Mapping button (createStudentsMode, after mapping applied) */}
        {createStudentsMode && mappingApplied && parsedRows.length > 0 && (
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

        {/* Section 3: Preview & Edit Table */}
        {parsedRows.length > 0 && mappingData && (
          <div className="mb-4">
            <h6 className="mb-3">
              Preview ({parsedRows.length} students)
              {parsedRows.some((r) => Object.keys(r.errors).length > 0) && (
                <Badge bg="warning" className="ms-2">
                  Has errors
                </Badge>
              )}
            </h6>
            <div className="table-responsive" style={{ maxHeight: "500px" }}>
              <table className="table table-bordered table-sm table-hover">
                <thead className="table-dark" style={{ position: "sticky", top: 0 }}>
                  <tr>
                    <th style={{ minWidth: "50px" }}>#</th>
                    {createStudentsMode ? (
                      <>
                        {mappedStudentFields.map((f) => (
                          <th key={f.key} style={{ minWidth: "120px" }}>
                            {f.label}
                          </th>
                        ))}
                      </>
                    ) : (
                      <th style={{ minWidth: "120px" }}>userId</th>
                    )}
                    {questionHeaders.map((q) => (
                      <th
                        key={q.excelQuestionHeader}
                        style={{ minWidth: "150px" }}
                        title={q.questionText}
                      >
                        {q.excelQuestionHeader}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      <td>{rowIdx + 1}</td>
                      {createStudentsMode ? (
                        <>
                          {mappedStudentFields.map((f) => (
                            <td key={f.key}>
                              {row.studentData?.[f.key] || ""}
                            </td>
                          ))}
                        </>
                      ) : (
                        <td
                          className={
                            row.userIdError ? "table-danger" : ""
                          }
                        >
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            value={row.userId ?? ""}
                            onChange={(e) =>
                              handleUserIdChange(rowIdx, e.target.value)
                            }
                            style={{ width: "100px" }}
                          />
                        </td>
                      )}
                      {questionHeaders.map((q) => {
                        const header = q.excelQuestionHeader;
                        const optionId = row.answers[header];
                        const hasError = !!row.errors[header];
                        const isBlank = optionId === null && !hasError;

                        return (
                          <td
                            key={header}
                            className={
                              hasError
                                ? "table-danger"
                                : isBlank
                                ? "table-warning"
                                : ""
                            }
                            title={row.errors[header] || ""}
                          >
                            <select
                              className="form-select form-select-sm"
                              value={optionId ?? ""}
                              onChange={(e) =>
                                handleAnswerChange(
                                  rowIdx,
                                  header,
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value)
                                )
                              }
                            >
                              <option value="">-- Skip --</option>
                              {q.options.map((opt) => (
                                <option
                                  key={opt.optionId}
                                  value={opt.optionId}
                                >
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

        {/* Section 4: Submit */}
        {parsedRows.length > 0 && mappingData && (
          <div className="card card-body bg-light">
            {/* Progress bar during submission */}
            {submitting && submitProgress && (
              <div className="mb-3">
                <div className="d-flex justify-content-between mb-1">
                  <small className="fw-bold">{submitProgress.phase}...</small>
                  <small>
                    {submitProgress.current} / {submitProgress.total}
                  </small>
                </div>
                <ProgressBar
                  now={
                    submitProgress.total > 0
                      ? (submitProgress.current / submitProgress.total) * 100
                      : 0
                  }
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
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    {createStudentsMode ? "Processing..." : "Submitting..."}
                  </>
                ) : (
                  <>
                    {createStudentsMode
                      ? `Create Students & Submit (${parsedRows.length} rows)`
                      : `Submit All (${parsedRows.length} students)`}
                  </>
                )}
              </Button>

              {/* Result for createStudentsMode */}
              {submitResult && submitResult.createStudentsMode && (
                <Alert
                  variant={submitResult.studentsFailed > 0 ? "warning" : "success"}
                  className="mb-0 flex-grow-1"
                >
                  <strong>{submitResult.studentsCreated}</strong> student(s) created.
                  {submitResult.studentsFailed > 0 && (
                    <span className="text-danger ms-2">
                      {submitResult.studentsFailed} failed.
                    </span>
                  )}
                  {submitResult.failedDetails?.length > 0 && (
                    <div className="mt-1">
                      {submitResult.failedDetails.map((f: any, i: number) => (
                        <div key={i} className="text-danger small">
                          Row {f.row}: {f.error}
                        </div>
                      ))}
                    </div>
                  )}
                  {submitResult.answersResult && (
                    <div className="mt-1">
                      {submitResult.answersResult.status === "success" ? (
                        <span className="text-success">
                          Answers submitted for{" "}
                          <strong>{submitResult.answersResult.studentsProcessed}</strong> student(s).
                          {submitResult.answersResult.errors?.length > 0 && (
                            <span className="text-danger ms-2">
                              {submitResult.answersResult.errors.length} answer error(s).
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-danger">
                          Answer submission failed: {submitResult.answersResult.message}
                        </span>
                      )}
                    </div>
                  )}
                </Alert>
              )}

              {/* Result for existing students mode */}
              {submitResult && !submitResult.createStudentsMode && submitResult.status === "success" && (
                <Alert variant="success" className="mb-0 flex-grow-1">
                  Successfully processed{" "}
                  <strong>{submitResult.studentsProcessed}</strong> students.
                  {submitResult.errors?.length > 0 && (
                    <span className="text-danger ms-2">
                      {submitResult.errors.length} error(s):
                      {submitResult.errors.map((err: any, i: number) => (
                        <div key={i}>
                          Student {err.userStudentId}: {err.error}
                        </div>
                      ))}
                    </span>
                  )}
                </Alert>
              )}

              {submitResult && !submitResult.createStudentsMode && submitResult.status === "error" && (
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
