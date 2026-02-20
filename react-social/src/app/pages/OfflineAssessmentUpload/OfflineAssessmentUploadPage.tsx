import { useEffect, useState, useRef } from "react";
import { Spinner, Button, Form, Badge, Alert } from "react-bootstrap";
import * as XLSX from "xlsx";
import { ReadCollegeData } from "../College/API/College_APIs";
import { getAssessmentMappingsByInstitute, getAssessmentSummaryList } from "../AssessmentMapping/API/AssessmentMapping_APIs";
import { getOfflineMapping, bulkSubmitAnswers } from "./API/OfflineUpload_APIs";

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
  answers: { [header: string]: number | null }; // header -> optionId
  errors: { [header: string]: string }; // header -> error message
  userIdError?: string;
}

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

  // Section 2-3: Upload & Preview state
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Section 4: Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);

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
      setParsedRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInstitute]);

  const loadAssessments = async (instituteCode: number) => {
    setLoadingAssessments(true);
    setSelectedAssessment("");
    setMappingData(null);
    setParsedRows([]);
    try {
      const [mappingsRes, summaryRes] = await Promise.all([
        getAssessmentMappingsByInstitute(instituteCode),
        getAssessmentSummaryList(),
      ]);
      const mappings = mappingsRes.data || [];
      const allAssessments = summaryRes.data || [];

      // Extract unique assessmentIds from mappings, then look up names from summary
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
      setParsedRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssessment]);

  const loadMapping = async (assessmentId: number) => {
    setLoadingMapping(true);
    setParsedRows([]);
    setSubmitResult(null);
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

  // Build a lookup: header -> QuestionMapping
  const headerToQuestion: { [header: string]: QuestionMapping } = {};
  if (mappingData) {
    for (const q of mappingData.questions) {
      if (q.excelQuestionHeader) {
        headerToQuestion[q.excelQuestionHeader] = q;
      }
    }
  }

  // assessmentMappings now holds the filtered assessment summaries directly
  const uniqueAssessments = assessmentMappings;

  // ============ Template Download ============
  const handleDownloadTemplate = () => {
    if (!mappingData) return;

    const headers = ["userId"];
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
      return { optionId: null }; // Skipped
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
      const seq = upper.charCodeAt(0) - 64; // A=1, B=2, etc.
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

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

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
    };
    reader.readAsBinaryString(file);
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
      // Clear error for this cell
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

    // Validate all rows have userId
    const invalidRows = parsedRows.filter(
      (r) => r.userId === null || r.userIdError
    );
    if (invalidRows.length > 0) {
      alert(
        `${invalidRows.length} row(s) have invalid or missing userId. Please fix them before submitting.`
      );
      return;
    }

    // Check for errors
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
        const answers: { questionnaireQuestionId: number; optionId: number }[] =
          [];
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

  // ============ Helpers for table headers ============
  const questionHeaders = mappingData
    ? mappingData.questions.filter((q) => q.excelQuestionHeader)
    : [];

  const getOptionText = (header: string, optionId: number | null): string => {
    if (optionId === null) return "";
    const q = headerToQuestion[header];
    if (!q) return String(optionId);
    const opt = q.options.find((o) => o.optionId === optionId);
    return opt ? opt.optionText : String(optionId);
  };

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
                    <th style={{ minWidth: "120px" }}>userId</th>
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
                    Submitting...
                  </>
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
                        <div key={i}>
                          Student {err.userStudentId}: {err.error}
                        </div>
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
