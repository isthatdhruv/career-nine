import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Spinner, Button, Form, Badge, Alert, Modal, Table } from "react-bootstrap";
import * as XLSX from "xlsx";
import { ReadCollegeData } from "../College/API/College_APIs";
import { getAssessmentMappingsByInstitute, getAssessmentSummaryList } from "../AssessmentMapping/API/AssessmentMapping_APIs";
import { getOfflineMapping, bulkSubmitByRollNumber, bulkSubmitWithStudents, getSavedOmrMapping, saveOmrMapping, getSavedOmrMappingByQuestionnaire, getAllOmrMappings } from "./API/OfflineUpload_APIs";

// ============ Types ============

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
  questionnaireId: number;
  questionnaireName: string;
  questions: QuestionMapping[];
  sections: SectionMapping[];
}

interface ParsedAnswer {
  questionnaireQuestionId: number;
  optionId: number;
}

interface ParsedStudent {
  rowIndex: number;
  rollNumber: string;
  name: string;
  mobile: string;
  dob: string;
  studentClass: string;
  answers: ParsedAnswer[];
  warnings: string[];
}

// ============ Mapping row definition ============

/**
 * Each row in the mapping table represents something that needs an Excel column.
 *
 * type="identity"   → Roll Number, Name, etc.
 * type="question"   → A multi-question section question. Cell value = A/B/C/D / Yes/No.
 * type="option"     → A merged-section option. Cell value = 1 / BLANK.
 */
interface MappingRow {
  key: string;                // unique key for state
  label: string;              // display label
  sectionLabel: string;       // grouping label
  type: "identity" | "question" | "option";
  // for question type
  questionnaireQuestionId?: number;
  options?: OptionInfo[];
  // for option type (merged section)
  optionId?: number;
  optionSequence?: number;
  parentQuestionnaireQuestionId?: number;
}

// ============ Answer resolvers ============

function resolveMultiQuestionAnswer(
  cellValue: string,
  options: OptionInfo[]
): { optionId: number | null; warning?: string } {
  const val = String(cellValue).trim();
  if (val === "" || val === "BLANK" || val === "blank") return { optionId: null };

  if (val.startsWith("(") && val.includes(",")) {
    return { optionId: null, warning: `Multiple answers: ${val}` };
  }

  const upper = val.toUpperCase();
  if (/^[A-Z]$/.test(upper)) {
    const seq = upper.charCodeAt(0) - 64;
    const opt = options.find((o) => o.sequence === seq);
    if (opt) return { optionId: opt.optionId };
    return { optionId: null, warning: `Option ${upper} out of range (max ${options.length})` };
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

  const num = Number(val);
  if (!isNaN(num) && Number.isInteger(num) && num >= 1) {
    const opt = options.find((o) => o.sequence === num);
    if (opt) return { optionId: opt.optionId };
    return { optionId: null, warning: `Seq ${num} out of range (max ${options.length})` };
  }

  return { optionId: null, warning: `Unrecognized: "${val}"` };
}

// ============ Component ============

const OMRDataUploadPage = () => {
  // --- Selection ---
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState("");
  const [assessmentMappings, setAssessmentMappings] = useState<any[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState("");
  const [loadingInstitutes, setLoadingInstitutes] = useState(false);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [mappingData, setMappingData] = useState<MappingData | null>(null);
  const [loadingMapping, setLoadingMapping] = useState(false);

  // --- Upload mode ---
  const [uploadMode, setUploadMode] = useState<"rollnumber" | "name">("rollnumber");

  // --- Excel ---
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [rawExcelData, setRawExcelData] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Mapping: key → Excel header ---
  const [fieldToHeader, setFieldToHeader] = useState<Record<string, string>>({});
  const [mappingApplied, setMappingApplied] = useState(false);

  // --- Collapsible sections ---
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // --- Saved mapping ---
  const [savedMappingExists, setSavedMappingExists] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);
  const [loadingSavedMapping, setLoadingSavedMapping] = useState(false);
  const [autoLoadedMapping, setAutoLoadedMapping] = useState(false);
  const savedMappingJsonRef = useRef<Record<string, string> | null>(null);

  // --- Parsed data ---
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);

  // --- Submit ---
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);

  // --- Modals ---
  const [warningModalStudent, setWarningModalStudent] = useState<ParsedStudent | null>(null);
  const [answerModalStudent, setAnswerModalStudent] = useState<ParsedStudent | null>(null);
  const [showSavedMappingsModal, setShowSavedMappingsModal] = useState(false);
  const [allSavedMappings, setAllSavedMappings] = useState<any[]>([]);
  const [loadingAllMappings, setLoadingAllMappings] = useState(false);

  // ============ Build mapping rows from questionnaire ============

  const mappingRows = useMemo((): MappingRow[] => {
    if (!mappingData?.sections) return [];

    const rows: MappingRow[] = [];

    // Identity fields
    rows.push({ key: "id_rollNumber", label: "Roll Number", sectionLabel: "Student Identity", type: "identity" });
    rows.push({ key: "id_name", label: "Name", sectionLabel: "Student Identity", type: "identity" });
    rows.push({ key: "id_mobile", label: "Mobile Number", sectionLabel: "Student Identity", type: "identity" });
    rows.push({ key: "id_dob", label: "Date of Birth", sectionLabel: "Student Identity", type: "identity" });
    rows.push({ key: "id_class", label: "Class / Grade", sectionLabel: "Student Identity", type: "identity" });

    const sortedSections = [...mappingData.sections].sort(
      (a, b) => parseInt(a.sectionOrder || "0") - parseInt(b.sectionOrder || "0")
    );

    for (let si = 0; si < sortedSections.length; si++) {
      const section = sortedSections[si];
      const sLetter = String.fromCharCode(65 + si);
      const sectionLabel = `Section ${sLetter}: ${section.sectionName}`;
      const isMerged = section.questions.length === 1;

      if (isMerged) {
        // Merged section: each option gets its own mapping row
        const q = section.questions[0];
        for (const opt of q.options) {
          rows.push({
            key: `opt_${q.questionnaireQuestionId}_${opt.optionId}`,
            label: `Option ${opt.sequence}: ${opt.optionText}`,
            sectionLabel,
            type: "option",
            optionId: opt.optionId,
            optionSequence: opt.sequence,
            parentQuestionnaireQuestionId: q.questionnaireQuestionId,
          });
        }
      } else {
        // Multi-question section: each question gets a mapping row
        for (let qi = 0; qi < section.questions.length; qi++) {
          const q = section.questions[qi];
          const optSummary = q.options.map((o) => o.optionText).join(" / ");
          rows.push({
            key: `q_${q.questionnaireQuestionId}`,
            label: `Q${qi + 1}: ${q.questionText?.substring(0, 60) || ""}`,
            sectionLabel,
            type: "question",
            questionnaireQuestionId: q.questionnaireQuestionId,
            options: q.options,
          });
        }
      }
    }

    return rows;
  }, [mappingData]);

  // Group mapping rows by section for display
  const groupedMappingRows = useMemo(() => {
    const groups: Record<string, MappingRow[]> = {};
    for (const row of mappingRows) {
      if (!groups[row.sectionLabel]) groups[row.sectionLabel] = [];
      groups[row.sectionLabel].push(row);
    }
    return groups;
  }, [mappingRows]);

  // Used headers (to prevent double-mapping)
  const usedHeaders = useMemo(() => new Set(Object.values(fieldToHeader)), [fieldToHeader]);

  // Mapping validation
  const mappingValidation = useMemo(() => {
    const issues: string[] = [];
    const hasRollNumber = !!fieldToHeader["id_rollNumber"];
    const hasName = !!fieldToHeader["id_name"];
    if (uploadMode === "rollnumber" && !hasRollNumber) issues.push("Map Roll Number (required)");
    if (uploadMode === "name" && !hasName) issues.push("Map Name (required)");

    let mappedQuestionCount = 0;
    for (const key of Object.keys(fieldToHeader)) {
      if (key.startsWith("q_") || key.startsWith("opt_")) mappedQuestionCount++;
    }
    const totalMappable = mappingRows.filter((r) => r.type !== "identity").length;
    if (mappedQuestionCount === 0) issues.push("No question/option columns mapped");

    return { issues, canApply: issues.length === 0 && mappedQuestionCount > 0, mappedQuestionCount, totalMappable };
  }, [fieldToHeader, mappingRows, uploadMode]);

  // ============ Data loading ============

  useEffect(() => { loadInstitutes(); }, []);

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
      setAssessmentMappings([]); setSelectedAssessment(""); setMappingData(null); resetAll();
    }
  }, [selectedInstitute]);

  const loadAssessments = async (instituteCode: number) => {
    setLoadingAssessments(true);
    setSelectedAssessment(""); setMappingData(null); resetAll();
    try {
      let mappings: any[] = [];
      let allAssessments: any[] = [];
      try { mappings = (await getAssessmentMappingsByInstitute(instituteCode)).data || []; } catch {}
      try { allAssessments = (await getAssessmentSummaryList()).data || []; } catch {}

      const ids = new Set(mappings.map((m: any) => m.assessmentId));
      setAssessmentMappings(allAssessments.filter((a: any) => ids.has(a.id)));
    } catch {} finally {
      setLoadingAssessments(false);
    }
  };

  useEffect(() => {
    if (selectedAssessment) { loadMapping(Number(selectedAssessment)); }
    else { setMappingData(null); resetAll(); }
  }, [selectedAssessment]);

  const loadMapping = async (assessmentId: number) => {
    setLoadingMapping(true); resetAll();
    try {
      const res = await getOfflineMapping(assessmentId);
      setMappingData(res.data);

      // Check if saved column mapping exists:
      // 1. Try exact match: (assessmentId, instituteId)
      // 2. Fallback: any mapping saved for the same questionnaireId
      if (selectedInstitute) {
        let found = false;
        try {
          const savedRes = await getSavedOmrMapping(assessmentId, Number(selectedInstitute));
          if (savedRes.data?.mappingJson) {
            savedMappingJsonRef.current = JSON.parse(savedRes.data.mappingJson);
            setSavedMappingExists(true);
            found = true;
          }
        } catch {}

        if (!found && res.data?.questionnaireId) {
          try {
            const qRes = await getSavedOmrMappingByQuestionnaire(res.data.questionnaireId);
            if (qRes.data?.mappingJson) {
              savedMappingJsonRef.current = JSON.parse(qRes.data.mappingJson);
              setSavedMappingExists(true);
              found = true;
            }
          } catch {}
        }

        if (!found) {
          savedMappingJsonRef.current = null;
          setSavedMappingExists(false);
        }
      }
    } catch {
      alert("Failed to load assessment mapping.");
    } finally {
      setLoadingMapping(false);
    }
  };

  const applyMappingFromJson = (saved: Record<string, string>, headers: string[]) => {
    if (headers.length > 0) {
      const headerSet = new Set(headers);
      const filtered: Record<string, string> = {};
      for (const [key, header] of Object.entries(saved)) {
        if (headerSet.has(header)) filtered[key] = header;
      }
      setFieldToHeader(filtered);
    } else {
      setFieldToHeader(saved);
    }
  };

  const handleLoadSavedMapping = async () => {
    if (!selectedAssessment || !selectedInstitute) return;
    // Use cached data if available — no redundant API call
    if (savedMappingJsonRef.current) {
      applyMappingFromJson(savedMappingJsonRef.current, excelHeaders);
      return;
    }
    setLoadingSavedMapping(true);
    try {
      const res = await getSavedOmrMapping(Number(selectedAssessment), Number(selectedInstitute));
      if (res.data?.mappingJson) {
        const saved: Record<string, string> = JSON.parse(res.data.mappingJson);
        savedMappingJsonRef.current = saved;
        applyMappingFromJson(saved, excelHeaders);
      }
    } catch {
      alert("No saved mapping found.");
    } finally {
      setLoadingSavedMapping(false);
    }
  };

  const handleSaveMapping = async () => {
    if (!selectedAssessment || !selectedInstitute || Object.keys(fieldToHeader).length === 0) return;
    setSavingMapping(true);
    try {
      await saveOmrMapping({
        assessmentId: Number(selectedAssessment),
        instituteId: Number(selectedInstitute),
        mappingJson: JSON.stringify(fieldToHeader),
        questionnaireId: mappingData?.questionnaireId,
      });
      savedMappingJsonRef.current = { ...fieldToHeader };
      setSavedMappingExists(true);
      alert("Mapping saved successfully!");
    } catch {
      alert("Failed to save mapping.");
    } finally {
      setSavingMapping(false);
    }
  };

  const resetAll = () => {
    setExcelHeaders([]); setRawExcelData([]); setFieldToHeader({});
    setMappingApplied(false); setParsedStudents([]);
    setFileName(""); setSubmitResult(null); setExpandedSections(new Set());
    setSavedMappingExists(false); setAutoLoadedMapping(false);
    savedMappingJsonRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ============ File Upload ============

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mappingData) return;

    setFileName(file.name);
    setSubmitResult(null);
    setMappingApplied(false);
    setParsedStudents([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "binary", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

      if (jsonData.length === 0) { alert("Excel file is empty."); return; }

      const headers = Object.keys(jsonData[0]).filter(
        (h) => h && !h.startsWith("__EMPTY")
      );
      setExcelHeaders(headers);
      setRawExcelData(jsonData);
      setAutoLoadedMapping(false);

      // Auto-apply saved mapping if available
      if (savedMappingJsonRef.current) {
        const headerSet = new Set(headers);
        const filtered: Record<string, string> = {};
        for (const [key, header] of Object.entries(savedMappingJsonRef.current)) {
          if (headerSet.has(header)) filtered[key] = header;
        }
        setFieldToHeader(filtered);
        setAutoLoadedMapping(true);
      } else {
        setFieldToHeader({});
      }
    };
    reader.readAsBinaryString(file);
  };

  // ============ Section toggle ============

  const toggleSection = (sectionLabel: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionLabel)) next.delete(sectionLabel);
      else next.add(sectionLabel);
      return next;
    });
  };

  const expandAllSections = () => {
    setExpandedSections(new Set(Object.keys(groupedMappingRows)));
  };

  const collapseAllSections = () => {
    setExpandedSections(new Set());
  };

  // ============ Mapping handlers ============

  const handleFieldMapping = (fieldKey: string, excelHeader: string) => {
    setFieldToHeader((prev) => {
      const updated = { ...prev };
      if (excelHeader === "") delete updated[fieldKey];
      else updated[fieldKey] = excelHeader;
      return updated;
    });
  };

  // ============ Apply Mapping & Parse ============

  const handleApplyMapping = () => {
    if (!mappingData || rawExcelData.length === 0) return;

    const sortedSections = [...mappingData.sections].sort(
      (a, b) => parseInt(a.sectionOrder || "0") - parseInt(b.sectionOrder || "0")
    );

    const students: ParsedStudent[] = rawExcelData.map((row, rowIdx) => {
      const warnings: string[] = [];
      const answers: ParsedAnswer[] = [];

      const rollNumber = fieldToHeader["id_rollNumber"] ? String(row[fieldToHeader["id_rollNumber"]] ?? "").trim() : "";
      const name = fieldToHeader["id_name"] ? String(row[fieldToHeader["id_name"]] ?? "").trim() : "";
      const mobile = fieldToHeader["id_mobile"] ? String(row[fieldToHeader["id_mobile"]] ?? "").trim() : "";
      const dob = fieldToHeader["id_dob"] ? String(row[fieldToHeader["id_dob"]] ?? "").trim() : "";
      const studentClass = fieldToHeader["id_class"] ? String(row[fieldToHeader["id_class"]] ?? "").trim() : "";

      for (let si = 0; si < sortedSections.length; si++) {
        const section = sortedSections[si];
        const sLetter = String.fromCharCode(65 + si);
        const isMerged = section.questions.length === 1;

        if (isMerged) {
          const q = section.questions[0];
          // Collect which options are selected (value = "1")
          const selectedOptionIds: number[] = [];
          for (const opt of q.options) {
            const mapKey = `opt_${q.questionnaireQuestionId}_${opt.optionId}`;
            const header = fieldToHeader[mapKey];
            if (!header) continue;
            const val = String(row[header] ?? "").trim();
            if (val === "1") selectedOptionIds.push(opt.optionId);
          }

          if (selectedOptionIds.length === 1) {
            answers.push({ questionnaireQuestionId: q.questionnaireQuestionId, optionId: selectedOptionIds[0] });
          } else if (selectedOptionIds.length > 1) {
            answers.push({ questionnaireQuestionId: q.questionnaireQuestionId, optionId: selectedOptionIds[0] });
            warnings.push(`Sec ${sLetter}: Multiple options selected, using first`);
          }
          // length === 0 means unanswered, no warning needed
        } else {
          for (let qi = 0; qi < section.questions.length; qi++) {
            const q = section.questions[qi];
            const mapKey = `q_${q.questionnaireQuestionId}`;
            const header = fieldToHeader[mapKey];
            if (!header) continue;

            const cellValue = String(row[header] ?? "").trim();
            const result = resolveMultiQuestionAnswer(cellValue, q.options);
            if (result.warning) warnings.push(`${sLetter}-Q${qi + 1}: ${result.warning}`);
            if (result.optionId) {
              answers.push({ questionnaireQuestionId: q.questionnaireQuestionId, optionId: result.optionId });
            }
          }
        }
      }

      return { rowIndex: rowIdx, rollNumber, name, mobile, dob, studentClass, answers, warnings };
    });

    setParsedStudents(students);
    setMappingApplied(true);
  };

  // ============ Stats ============

  const stats = useMemo(() => {
    if (!parsedStudents.length || !mappingData) return null;
    const totalQuestions = mappingData.questions.length;
    const withWarnings = parsedStudents.filter((s) => s.warnings.length > 0).length;
    const withRollNumber = parsedStudents.filter((s) => s.rollNumber.trim()).length;
    const avgAnswers = Math.round(
      parsedStudents.reduce((sum, s) => sum + s.answers.length, 0) / parsedStudents.length
    );
    return { totalQuestions, withWarnings, withRollNumber, avgAnswers };
  }, [parsedStudents, mappingData]);

  // ============ Answer detail resolver for modal ============

  const getAnswerDetails = useCallback(
    (student: ParsedStudent) => {
      if (!mappingData) return [];
      const details: {
        sectionName: string; sectionLetter: string; questionNumber: number;
        questionText: string; selectedOption: string; optionSequence: number; answered: boolean;
      }[] = [];
      const sortedSections = [...mappingData.sections].sort(
        (a, b) => parseInt(a.sectionOrder || "0") - parseInt(b.sectionOrder || "0")
      );
      for (let si = 0; si < sortedSections.length; si++) {
        const section = sortedSections[si];
        const sLetter = String.fromCharCode(65 + si);
        for (let qi = 0; qi < section.questions.length; qi++) {
          const q = section.questions[qi];
          const answer = student.answers.find((a) => a.questionnaireQuestionId === q.questionnaireQuestionId);
          const selectedOpt = answer ? q.options.find((o) => o.optionId === answer.optionId) : null;
          details.push({
            sectionName: section.sectionName, sectionLetter: sLetter, questionNumber: qi + 1,
            questionText: q.questionText || `Question ${q.questionnaireQuestionId}`,
            selectedOption: selectedOpt?.optionText || "-",
            optionSequence: selectedOpt?.sequence || 0,
            answered: !!answer,
          });
        }
      }
      return details;
    },
    [mappingData]
  );

  // ============ Submit ============

  const handleSubmit = async () => {
    if (!mappingData || parsedStudents.length === 0) return;

    if (uploadMode === "rollnumber") {
      const noRoll = parsedStudents.filter((s) => !s.rollNumber.trim());
      if (noRoll.length > 0) {
        alert(`${noRoll.length} row(s) have no roll number.`);
        return;
      }
    } else {
      const noName = parsedStudents.filter((s) => !s.name.trim());
      if (noName.length > 0) {
        alert(`${noName.length} row(s) have no name.`);
        return;
      }
    }

    setSubmitting(true);
    setSubmitResult(null);

    try {
      let res;
      if (uploadMode === "rollnumber") {
        res = await bulkSubmitByRollNumber({
          assessmentId: mappingData.assessmentId,
          instituteId: Number(selectedInstitute),
          students: parsedStudents.map((s) => ({ rollNumber: s.rollNumber.trim(), answers: s.answers })),
        });
      } else {
        res = await bulkSubmitWithStudents({
          assessmentId: mappingData.assessmentId,
          instituteId: Number(selectedInstitute),
          students: parsedStudents.map((s) => ({
            name: s.name.trim(), dob: s.dob || undefined, phone: s.mobile || undefined, answers: s.answers,
          })),
        });
      }
      setSubmitResult(res.data);
    } catch (error: any) {
      setSubmitResult({ status: "error", message: error.response?.data || error.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ============ Saved Mappings Modal ============

  const handleShowSavedMappings = async () => {
    setShowSavedMappingsModal(true);
    setLoadingAllMappings(true);
    try {
      const res = await getAllOmrMappings();
      setAllSavedMappings(res.data || []);
    } catch {
      setAllSavedMappings([]);
    } finally {
      setLoadingAllMappings(false);
    }
  };

  // ============ Render ============

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">OMR Data Upload</h3>
        <div className="card-toolbar d-flex align-items-center gap-3">
          <Button variant="outline-primary" size="sm" onClick={handleShowSavedMappings}>
            View Saved Mappings
          </Button>
          <small className="text-muted">Upload scanned OMR data with manual column mapping</small>
        </div>
      </div>
      <div className="card-body">

        {/* ── Step 1: School & Assessment ── */}
        <div className="card card-body bg-light mb-4">
          <h6 className="mb-3">1. Select School & Assessment</h6>
          <div className="row g-3 align-items-end">
            <div className="col-md-5">
              <Form.Label>School / Institute</Form.Label>
              {loadingInstitutes ? (
                <div><Spinner animation="border" size="sm" /> Loading...</div>
              ) : (
                <Form.Select value={selectedInstitute} onChange={(e) => setSelectedInstitute(e.target.value)}>
                  <option value="">Select an institute...</option>
                  {institutes.map((inst: any) => (
                    <option key={inst.instituteCode} value={inst.instituteCode}>{inst.instituteName}</option>
                  ))}
                </Form.Select>
              )}
            </div>
            <div className="col-md-5">
              <Form.Label>Assessment</Form.Label>
              {loadingAssessments ? (
                <div><Spinner animation="border" size="sm" /> Loading...</div>
              ) : (
                <Form.Select value={selectedAssessment} onChange={(e) => setSelectedAssessment(e.target.value)} disabled={!selectedInstitute}>
                  <option value="">Select an assessment...</option>
                  {assessmentMappings.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.assessmentName}</option>
                  ))}
                </Form.Select>
              )}
            </div>
            <div className="col-md-2">{loadingMapping && <Spinner animation="border" size="sm" />}</div>
          </div>
          {mappingData && (
            <div className="mt-3">
              <Badge bg="success" className="me-2">Questionnaire: {mappingData.questionnaireName}</Badge>
              <Badge bg="info" className="me-2">{mappingData.sections?.length || 0} sections</Badge>
              <Badge bg="secondary">{mappingData.questions.length} questions</Badge>
            </div>
          )}
        </div>

        {/* ── Step 2: Upload & Mode ── */}
        {mappingData && (
          <div className="card card-body bg-light mb-4">
            <h6 className="mb-3">2. Upload Excel File</h6>
            <div className="row g-3 align-items-end">
              <div className="col-md-3">
                <Form.Label>Upload Mode</Form.Label>
                <Form.Select value={uploadMode} onChange={(e) => setUploadMode(e.target.value as any)}>
                  <option value="rollnumber">Match by Roll Number</option>
                  <option value="name">Match/Create by Name</option>
                </Form.Select>
              </div>
              <div className="col-md-5">
                <Form.Label>Excel File</Form.Label>
                <Form.Control type="file" accept=".xlsx,.xls" ref={fileInputRef} onChange={handleFileUpload} />
              </div>
              <div className="col-md-4">
                {fileName && <small className="text-muted d-block">{fileName}</small>}
                {excelHeaders.length > 0 && (
                  <Badge bg="info">{rawExcelData.length} rows, {excelHeaders.length} columns</Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Column Mapping ── */}
        {excelHeaders.length > 0 && mappingData && !mappingApplied && (
          <div className="card card-body bg-light mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">3. Map Excel Columns to Questions / Options</h6>
              <div className="d-flex gap-2 align-items-center flex-wrap">
                {mappingValidation.issues.length > 0 && (
                  <small className="text-warning">{mappingValidation.issues[0]}</small>
                )}
                <Badge bg="info">
                  {mappingValidation.mappedQuestionCount}/{mappingValidation.totalMappable} mapped
                </Badge>
                {autoLoadedMapping && (
                  <Badge bg="success" style={{ fontSize: "0.7rem" }}>Saved mapping auto-applied</Badge>
                )}
                {savedMappingExists && (
                  <Button variant="outline-success" size="sm" onClick={handleLoadSavedMapping} disabled={loadingSavedMapping}>
                    {loadingSavedMapping ? <><Spinner animation="border" size="sm" className="me-1" />Loading...</> : "Re-apply Saved Mapping"}
                  </Button>
                )}
                <Button
                  variant="outline-info" size="sm"
                  onClick={handleSaveMapping}
                  disabled={savingMapping || Object.keys(fieldToHeader).length === 0}
                >
                  {savingMapping ? <><Spinner animation="border" size="sm" className="me-1" />Saving...</> : "Save Mapping"}
                </Button>
                <Button variant="outline-secondary" size="sm" onClick={expandAllSections}>Expand All</Button>
                <Button variant="outline-secondary" size="sm" onClick={collapseAllSections}>Collapse All</Button>
                <Button variant="primary" size="sm" onClick={handleApplyMapping} disabled={!mappingValidation.canApply}>
                  Apply Mapping & Preview
                </Button>
              </div>
            </div>

            {/* Collapsible sections */}
            <div className="accordion" id="mappingAccordion">
              {Object.entries(groupedMappingRows).map(([sectionLabel, rows]) => {
                const isExpanded = expandedSections.has(sectionLabel);
                const mappedCount = rows.filter((r) => !!fieldToHeader[r.key]).length;
                const isIdentity = rows[0]?.type === "identity";
                const isMergedSection = rows[0]?.type === "option";

                return (
                  <div className="accordion-item" key={sectionLabel}>
                    <h2 className="accordion-header">
                      <button
                        className={`accordion-button ${!isExpanded ? "collapsed" : ""}`}
                        type="button"
                        onClick={() => toggleSection(sectionLabel)}
                        style={{ padding: "0.6rem 1rem" }}
                      >
                        <div className="d-flex align-items-center gap-2 w-100 flex-wrap">
                          <strong>{sectionLabel}</strong>
                          <Badge bg="secondary" style={{ fontSize: "0.65rem" }}>
                            {rows.length} fields
                          </Badge>
                          <Badge bg={mappedCount === rows.length ? "success" : mappedCount > 0 ? "warning" : "danger"} style={{ fontSize: "0.65rem" }}>
                            {mappedCount}/{rows.length} mapped
                          </Badge>
                          {isMergedSection && (
                            <Badge bg="warning" text="dark" style={{ fontSize: "0.6rem" }}>
                              Merged: value 1 = selected, BLANK = not
                            </Badge>
                          )}
                          {!isIdentity && !isMergedSection && rows[0]?.type === "question" && (
                            <Badge bg="info" style={{ fontSize: "0.6rem" }}>
                              Cell value: A/B/C/D or Yes/No
                            </Badge>
                          )}
                        </div>
                      </button>
                    </h2>
                    <div className={`accordion-collapse collapse ${isExpanded ? "show" : ""}`}>
                      <div className="accordion-body p-0">
                        <table className="table table-bordered table-sm mb-0">
                          <thead>
                            <tr>
                              <th style={{ width: "55%", backgroundColor: "#f8f9fa" }}>Question / Option / Field</th>
                              <th style={{ width: "45%", backgroundColor: "#f8f9fa" }}>Excel Column</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => {
                              const currentHeader = fieldToHeader[row.key] || "";
                              const isMapped = !!currentHeader;

                              return (
                                <tr key={row.key} className={isMapped ? "" : "text-muted"}>
                                  <td>
                                    {row.label}
                                    {row.type === "identity" && row.key === "id_rollNumber" && uploadMode === "rollnumber" && (
                                      <Badge bg="danger" className="ms-1" style={{ fontSize: "0.6rem" }}>Required</Badge>
                                    )}
                                    {row.type === "identity" && row.key === "id_name" && uploadMode === "name" && (
                                      <Badge bg="danger" className="ms-1" style={{ fontSize: "0.6rem" }}>Required</Badge>
                                    )}
                                    {row.type === "option" && (
                                      <Badge bg="secondary" className="ms-1" style={{ fontSize: "0.6rem" }}>Option</Badge>
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
                                        <option key={h} value={h} disabled={usedHeaders.has(h) && h !== currentHeader}>
                                          {h}{usedHeaders.has(h) && h !== currentHeader ? " (used)" : ""}
                                        </option>
                                      ))}
                                    </Form.Select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 4: Preview ── */}
        {mappingApplied && parsedStudents.length > 0 && stats && (
          <>
            <div className="card card-body bg-light mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0">4. Preview ({parsedStudents.length} students)</h6>
                <div className="d-flex gap-2">
                  <Badge bg="primary">Avg {stats.avgAnswers}/{stats.totalQuestions} answers</Badge>
                  {stats.withWarnings > 0 && <Badge bg="warning">{stats.withWarnings} with warnings</Badge>}
                  <Badge bg={stats.withRollNumber === parsedStudents.length ? "success" : "danger"}>
                    {stats.withRollNumber} have roll numbers
                  </Badge>
                  <Button variant="outline-secondary" size="sm" onClick={() => { setMappingApplied(false); setParsedStudents([]); }}>
                    Back to Mapping
                  </Button>
                  <Button variant="outline-secondary" size="sm" onClick={resetAll}>
                    Clear & Re-upload
                  </Button>
                </div>
              </div>

              <div style={{ maxHeight: "400px", overflow: "auto", border: "1px solid #dee2e6" }}>
                <table className="table table-bordered table-sm table-hover mb-0">
                  <thead style={{ position: "sticky", top: 0, zIndex: 2, backgroundColor: "#212529", color: "#fff" }}>
                    <tr>
                      <th style={{ backgroundColor: "#212529", color: "#fff", minWidth: "40px" }}>#</th>
                      <th style={{ backgroundColor: "#212529", color: "#fff", minWidth: "120px" }}>Roll Number</th>
                      <th style={{ backgroundColor: "#212529", color: "#fff", minWidth: "120px" }}>Name</th>
                      <th style={{ backgroundColor: "#212529", color: "#fff", minWidth: "100px" }}>Mobile</th>
                      <th style={{ backgroundColor: "#212529", color: "#fff", minWidth: "60px" }}>Class</th>
                      <th style={{ backgroundColor: "#212529", color: "#fff", minWidth: "80px" }}>Answers</th>
                      <th style={{ backgroundColor: "#212529", color: "#fff" }}>Warnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedStudents.map((student, idx) => {
                      const hasWarnings = student.warnings.length > 0;
                      const noIdentity = uploadMode === "rollnumber" ? !student.rollNumber.trim() : !student.name.trim();
                      return (
                        <tr key={idx} className={noIdentity ? "table-danger" : hasWarnings ? "table-warning" : ""}>
                          <td>{idx + 1}</td>
                          <td>{student.rollNumber || <span className="text-danger">-</span>}</td>
                          <td>{student.name || "-"}</td>
                          <td>{student.mobile || "-"}</td>
                          <td>{student.studentClass || "-"}</td>
                          <td>
                            <Badge
                              bg={student.answers.length === stats.totalQuestions ? "success" : "warning"}
                              role="button" style={{ cursor: "pointer" }}
                              onClick={() => setAnswerModalStudent(student)}
                            >
                              {student.answers.length}/{stats.totalQuestions}
                            </Badge>
                          </td>
                          <td>
                            {hasWarnings ? (
                              <small className="text-warning" role="button"
                                style={{ cursor: "pointer", textDecoration: "underline" }}
                                onClick={() => setWarningModalStudent(student)}
                              >
                                {student.warnings.length} warning(s)
                              </small>
                            ) : (
                              <small className="text-success">OK</small>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Step 5: Submit ── */}
            <div className="card card-body bg-light">
              <div className="d-flex align-items-center gap-3 flex-wrap">
                <Button variant="success" size="lg" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <><Spinner animation="border" size="sm" className="me-2" />Submitting...</>
                  ) : (
                    <>Submit All ({parsedStudents.length} students)</>
                  )}
                </Button>
                <small className="text-muted">
                  Mode: <strong>{uploadMode === "rollnumber" ? "Match by Roll Number" : "Match/Create by Name"}</strong>
                </small>

                {submitResult && submitResult.status === "success" && (
                  <Alert variant="success" className="mb-0 flex-grow-1">
                    <strong>Upload complete.</strong>
                    <div>Students processed: <strong>{submitResult.studentsProcessed}</strong></div>
                    {submitResult.matchSummary && (
                      <div>
                        Matched: <Badge bg="primary">{submitResult.matchSummary.matched}</Badge>{" "}
                        {submitResult.matchSummary.created != null && (
                          <>Created: <Badge bg="success">{submitResult.matchSummary.created}</Badge>{" "}</>
                        )}
                        Failed: <Badge bg={submitResult.matchSummary.failed > 0 ? "danger" : "secondary"}>
                          {submitResult.matchSummary.failed}
                        </Badge>
                      </div>
                    )}
                    {submitResult.errors?.length > 0 && (
                      <div className="mt-2">
                        <strong>Errors:</strong>
                        {submitResult.errors.slice(0, 10).map((err: any, i: number) => (
                          <div key={i} className="text-danger">
                            Row {(err.rowIndex ?? 0) + 1} ({err.rollNumber || err.name}): {err.error}
                          </div>
                        ))}
                        {submitResult.errors.length > 10 && (
                          <div className="text-muted">...and {submitResult.errors.length - 10} more</div>
                        )}
                      </div>
                    )}
                  </Alert>
                )}
                {submitResult && submitResult.status === "error" && (
                  <Alert variant="danger" className="mb-0 flex-grow-1">
                    Failed: {typeof submitResult.message === "string" ? submitResult.message : JSON.stringify(submitResult.message)}
                  </Alert>
                )}
              </div>
            </div>
          </>
        )}

        {/* ===== Warnings Modal ===== */}
        <Modal show={!!warningModalStudent} onHide={() => setWarningModalStudent(null)} size="lg" centered>
          <Modal.Header closeButton>
            <Modal.Title>
              Warnings - {warningModalStudent?.name || warningModalStudent?.rollNumber || `Row ${(warningModalStudent?.rowIndex ?? 0) + 1}`}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {warningModalStudent && warningModalStudent.warnings.length > 0 ? (
              <Table striped bordered size="sm">
                <thead><tr><th style={{ width: "40px" }}>#</th><th>Warning</th></tr></thead>
                <tbody>
                  {warningModalStudent.warnings.map((w, i) => (
                    <tr key={i}><td>{i + 1}</td><td className="text-warning">{w}</td></tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="text-success mb-0">No warnings.</p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setWarningModalStudent(null)}>Close</Button>
          </Modal.Footer>
        </Modal>

        {/* ===== Answer Mapping Modal ===== */}
        <Modal show={!!answerModalStudent} onHide={() => setAnswerModalStudent(null)} size="xl" centered scrollable>
          <Modal.Header closeButton>
            <Modal.Title>
              Answer Mapping - {answerModalStudent?.name || answerModalStudent?.rollNumber || `Row ${(answerModalStudent?.rowIndex ?? 0) + 1}`}
              {answerModalStudent && stats && (
                <Badge bg="info" className="ms-3" style={{ fontSize: "0.7rem" }}>
                  {answerModalStudent.answers.length}/{stats.totalQuestions} answered
                </Badge>
              )}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ maxHeight: "70vh", overflowY: "auto" }}>
            {answerModalStudent && (() => {
              const details = getAnswerDetails(answerModalStudent);
              const grouped: Record<string, typeof details> = {};
              for (const d of details) {
                const key = `${d.sectionLetter} - ${d.sectionName}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(d);
              }
              return Object.entries(grouped).map(([sectionLabel, questions]) => {
                const answeredCount = questions.filter((q) => q.answered).length;
                return (
                  <div key={sectionLabel} className="mb-4">
                    <h6 className="d-flex align-items-center gap-2 mb-2">
                      <span>Section {sectionLabel}</span>
                      <Badge bg={answeredCount === questions.length ? "success" : "warning"}>
                        {answeredCount}/{questions.length}
                      </Badge>
                    </h6>
                    <Table striped bordered size="sm" className="mb-0">
                      <thead>
                        <tr>
                          <th style={{ width: "50px" }}>Q#</th>
                          <th>Question</th>
                          <th style={{ width: "180px" }}>Selected Option</th>
                          <th style={{ width: "60px" }}>Seq</th>
                        </tr>
                      </thead>
                      <tbody>
                        {questions.map((q, qi) => (
                          <tr key={qi} className={!q.answered ? "table-light text-muted" : ""}>
                            <td>{q.questionNumber}</td>
                            <td style={{ maxWidth: "400px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {q.questionText}
                            </td>
                            <td>
                              {q.answered ? (
                                <Badge bg="primary">{q.selectedOption}</Badge>
                              ) : (
                                <span className="text-muted">Not answered</span>
                              )}
                            </td>
                            <td>
                              {q.answered ? (
                                <Badge bg="secondary">{String.fromCharCode(64 + q.optionSequence)}</Badge>
                              ) : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                );
              });
            })()}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setAnswerModalStudent(null)}>Close</Button>
          </Modal.Footer>
        </Modal>

        {/* ===== Saved Mappings Modal ===== */}
        <Modal show={showSavedMappingsModal} onHide={() => setShowSavedMappingsModal(false)} size="xl" centered scrollable>
          <Modal.Header closeButton>
            <Modal.Title>Saved Column Mappings</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {loadingAllMappings ? (
              <div className="text-center py-4"><Spinner animation="border" /> Loading...</div>
            ) : allSavedMappings.length === 0 ? (
              <p className="text-muted text-center py-4">No saved mappings found.</p>
            ) : (
              <Table striped bordered hover size="sm">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Questionnaire</th>
                    <th>Assessment</th>
                    <th>Mapped Fields</th>
                    <th>Saved On</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {allSavedMappings.map((m: any, idx: number) => (
                    <tr key={m.id}>
                      <td>{idx + 1}</td>
                      <td>
                        {m.questionnaireName || <span className="text-muted">-</span>}
                        {m.questionnaireId && (
                          <Badge bg="secondary" className="ms-1" style={{ fontSize: "0.6rem" }}>
                            ID: {m.questionnaireId}
                          </Badge>
                        )}
                      </td>
                      <td>
                        {m.assessmentName || <span className="text-muted">-</span>}
                        <Badge bg="light" text="dark" className="ms-1" style={{ fontSize: "0.6rem" }}>
                          ID: {m.assessmentId}
                        </Badge>
                      </td>
                      <td>
                        <Badge bg="info">{m.mappedFieldsCount} fields</Badge>
                      </td>
                      <td><small>{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "-"}</small></td>
                      <td><small>{m.updatedAt ? new Date(m.updatedAt).toLocaleDateString() : "-"}</small></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowSavedMappingsModal(false)}>Close</Button>
          </Modal.Footer>
        </Modal>

      </div>
    </div>
  );
};

export default OMRDataUploadPage;
