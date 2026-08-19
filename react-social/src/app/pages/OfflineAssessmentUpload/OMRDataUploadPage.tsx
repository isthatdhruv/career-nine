import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Spinner, Button, Form, Badge, Alert, Modal, Table } from "react-bootstrap";
import * as XLSX from "xlsx";
import { ReadCollegeData } from "../College/API/College_APIs";
import { getAssessmentMappingsByInstitute, getAssessmentSummaryList } from "../AssessmentMapping/API/AssessmentMapping_APIs";
import { getOfflineMapping, bulkSubmitByRollNumber, bulkSubmitWithStudents, getSavedOmrMapping, saveOmrMapping, getSavedOmrMappingByQuestionnaire, getAllOmrMappings } from "./API/OfflineUpload_APIs";
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import PageHeader from "../../components/PageHeader";
import SearchableSelect from "../../components/SearchableSelect";

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

/**
 * A bubble the student did not fill.
 *
 * Scanned sheets write this as an empty cell, the literal "BLANK", or a zero —
 * which can arrive as "0", "0.0" or "0.00" depending on how the cell is formatted.
 */
function isNotAttempted(value: string): boolean {
  const val = String(value ?? "").trim();
  if (val === "" || val === "-") return true;
  if (val.toUpperCase() === "BLANK") return true;
  const num = Number(val);
  return !isNaN(num) && num === 0;
}

function resolveMultiQuestionAnswer(
  cellValue: string,
  options: OptionInfo[]
): { optionId: number | null; warning?: string } {
  const val = String(cellValue).trim();
  if (isNotAttempted(val)) return { optionId: null };

  if (val.startsWith("(") && val.includes(",")) {
    // Extract first answer from "(Yes,No)" or "(A,B)" format
    const inner = val.replace(/[()]/g, "").split(",")[0].trim();
    if (inner) {
      const result = resolveMultiQuestionAnswer(inner, options);
      return { optionId: result.optionId, warning: result.warning };
    }
    return { optionId: null };
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

/**
 * Resolve a single cell holding SEVERAL selected options for one multi-select question.
 *
 * Accepts "A,C,E", "(A,C,E)", "1,3,5" and option texts ("Honesty, Respect"),
 * separated by comma, semicolon, pipe, slash or newline.
 */
// ============ Display helpers ============

/**
 * Questionnaire sections are often already named "Section D: Personality:", which
 * reads badly once the page adds its own section letter. Strip the redundant
 * prefix and trailing punctuation so only the subject remains.
 */
function cleanSectionName(name: string | null | undefined): string {
  return String(name || "")
    .replace(/^\s*(insight\s+)?section\s*[A-Za-z0-9]*\s*[:\-–]\s*/i, "")
    .replace(/[:\-–\s]+$/, "")
    .trim() || "Untitled section";
}

/** Short, accurate description of the values a question column may hold. */
function optionValueHint(options: OptionInfo[]): string {
  if (!options || options.length === 0) return "";
  const texts = options.map((o) => String(o.optionText || "").trim().toLowerCase());
  if (options.length === 2 && texts.includes("yes") && texts.includes("no")) return "Yes / No";
  if (options.length === 1) return "A";
  return `A–${String.fromCharCode(64 + options.length)}`;
}

// ============ Sheet reading ============

/**
 * Turn a raw sheet (array of rows) into objects keyed by column name.
 *
 * Scanned OMR sheets often start with a title row (the school name) before the
 * real header row, and end with hundreds of empty rows, so the header row is
 * detected as the most-populated of the first few rows rather than assumed to be
 * the first one. Blank rows are dropped and duplicate column names made unique.
 */
function buildRowsFromSheet(matrix: any[][]): { headers: string[]; rows: any[] } {
  if (!matrix || matrix.length === 0) return { headers: [], rows: [] };

  const filledCount = (row: any[]) =>
    (row || []).filter((c) => String(c ?? "").trim() !== "").length;

  /**
   * Column names are distinct by nature, while an answer row repeats the same few
   * values ("Yes", "No", "A", "BLANK") and a title row fills a single cell. Counting
   * distinct values therefore separates the header row from both, and — unlike a
   * plain "most cells filled" test — still finds it when a column is left unnamed.
   */
  const distinctValueCount = (row: any[]) => {
    const seen = new Set<string>();
    for (const cell of row || []) {
      const val = String(cell ?? "").trim().toLowerCase();
      if (val) seen.add(val);
    }
    return seen.size;
  };

  let headerIndex = 0;
  let best = -1;
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const score = distinctValueCount(matrix[i]);
    // Ties go to the earliest row, so a sheet that starts with its header keeps it
    if (score > best) { best = score; headerIndex = i; }
  }

  const seen = new Map<string, number>();
  const headerRow = matrix[headerIndex] || [];
  const columnNames: string[] = [];
  for (const cell of headerRow) {
    const name = String(cell ?? "").trim();
    if (!name) { columnNames.push(""); continue; }
    const previous = seen.get(name) ?? 0;
    seen.set(name, previous + 1);
    columnNames.push(previous === 0 ? name : `${name}_${previous + 1}`);
  }

  const rows: any[] = [];
  for (let r = headerIndex + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || filledCount(row) === 0) continue;
    const obj: Record<string, any> = {};
    for (let c = 0; c < columnNames.length; c++) {
      if (!columnNames[c]) continue;
      obj[columnNames[c]] = row[c] ?? "";
    }
    rows.push(obj);
  }

  return { headers: columnNames.filter(Boolean), rows };
}

// ============ Header normalization for fuzzy matching ============

/** Normalize a header string for comparison: lowercase, strip dashes/underscores/spaces */
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[-_\s]+/g, "");
}

/**
 * Match saved mapping headers to actual Excel headers using normalized comparison.
 * Identity fields (id_*) are skipped — they vary too much between schools.
 * Returns a new mapping with matched Excel headers.
 */
function matchMappingToHeaders(
  saved: Record<string, string>,
  excelHeaders: string[]
): Record<string, string> {
  // Build a normalized → actual header lookup
  const normalizedMap = new Map<string, string>();
  for (const h of excelHeaders) {
    normalizedMap.set(normalizeHeader(h), h);
  }

  const result: Record<string, string> = {};
  for (const [key, savedHeader] of Object.entries(saved)) {
    // Skip identity fields — they differ between schools (Name vs Student Name, etc.)
    if (key.startsWith("id_")) continue;

    // Exact match first
    if (excelHeaders.includes(savedHeader)) {
      result[key] = savedHeader;
      continue;
    }
    // Normalized match (ignores dashes/underscores/spaces/case)
    const actual = normalizedMap.get(normalizeHeader(savedHeader));
    if (actual) {
      result[key] = actual;
    }
  }
  return result;
}

// ============ Auto-mapping from questionnaire headers ============

/**
 * Identity columns are not part of the questionnaire, so they are matched
 * against a list of commonly used Excel header names instead.
 */
const IDENTITY_SYNONYMS: Record<string, string[]> = {
  id_rollNumber: [
    "rollnumber", "rollno", "roll", "careerninerollnumber", "careerninerollno",
    "c9rollnumber", "studentrollnumber", "admissionnumber", "admissionno", "admno",
    "enrollmentnumber", "enrollmentno",
  ],
  id_name: ["name", "studentname", "fullname", "studentfullname", "nameofstudent", "candidatename"],
  id_mobile: ["mobile", "mobileno", "mobilenumber", "phone", "phoneno", "phonenumber", "contact", "contactno", "contactnumber"],
  id_dob: ["dob", "dateofbirth", "birthdate", "birthday"],
  id_class: ["class", "grade", "standard", "std", "classgrade", "classsection"],
};

/**
 * Column names a scanned OMR sheet uses for a given section letter and position,
 * e.g. section C question 7 → "SeC_C_7".
 *
 * Scanners in use write a literal "BLANK" in place of the digit 0, so question 10
 * arrives as "SeC_C_1BLANK" — both spellings are offered. Matching itself ignores
 * case, spaces, dashes and underscores, so "Sec C 7" and "SEC_C_7" match too.
 */
function omrHeaderCandidates(sectionLetter: string, position: number): string[] {
  const candidates = [`SeC_${sectionLetter}_${position}`];
  const withBlank = String(position).replace(/0/g, "BLANK");
  if (withBlank !== String(position)) candidates.push(`SeC_${sectionLetter}_${withBlank}`);
  return candidates;
}

/**
 * Map Excel columns straight onto the questionnaire, without needing a saved mapping.
 *
 * Questions carry an `excelQuestionHeader` (set on the questionnaire) which is the
 * column name the sheet is expected to use — that is the primary match. Merged-section
 * options have no stored header, so they are matched on option text and on the
 * conventional "<question header> <option>" / "<question header>_<sequence>" forms.
 * Matching ignores case, spaces, dashes and underscores; a column is claimed once.
 */
function autoMapFromQuestionHeaders(
  data: MappingData,
  excelHeaders: string[]
): { mapping: Record<string, string>; questionMatches: number } {
  const normalizedMap = new Map<string, string>();
  for (const h of excelHeaders) {
    const n = normalizeHeader(h);
    if (n && !normalizedMap.has(n)) normalizedMap.set(n, h);
  }

  const mapping: Record<string, string> = {};
  const used = new Set<string>();

  /** Claim the first candidate name that exists as an unused Excel column. */
  const claim = (fieldKey: string, candidates: (string | null | undefined)[]): boolean => {
    if (mapping[fieldKey]) return true;
    for (const candidate of candidates) {
      if (!candidate) continue;
      const actual = normalizedMap.get(normalizeHeader(candidate));
      if (actual && !used.has(actual)) {
        mapping[fieldKey] = actual;
        used.add(actual);
        return true;
      }
    }
    return false;
  };

  const sortedSections = [...(data.sections || [])].sort(
    (a, b) => parseInt(a.sectionOrder || "0") - parseInt(b.sectionOrder || "0")
  );

  // Questions and options first — the questionnaire is authoritative about its columns.
  for (let si = 0; si < sortedSections.length; si++) {
    const section = sortedSections[si];
    // Sections are lettered in the same order the mapping table shows them
    const sLetter = String.fromCharCode(65 + si);
    const isMerged = section.questions.length === 1;

    if (isMerged) {
      const q = section.questions[0];
      const qHeader = q.excelQuestionHeader;
      for (const opt of q.options) {
        claim(`opt_${q.questionnaireQuestionId}_${opt.optionId}`, [
          ...omrHeaderCandidates(sLetter, opt.sequence),
          opt.optionText,
          qHeader && opt.optionText ? `${qHeader} ${opt.optionText}` : null,
          qHeader ? `${qHeader}_${opt.sequence}` : null,
          qHeader ? `${qHeader}${opt.sequence}` : null,
        ]);
      }
    } else {
      for (let qi = 0; qi < section.questions.length; qi++) {
        const q = section.questions[qi];
        claim(`q_${q.questionnaireQuestionId}`, [
          ...omrHeaderCandidates(sLetter, qi + 1),
          q.excelQuestionHeader,
          q.questionText,
        ]);
      }
    }
  }

  const questionMatches = Object.keys(mapping).length;

  // Identity columns take whatever is left, so they can never steal a question column.
  for (const [fieldKey, synonyms] of Object.entries(IDENTITY_SYNONYMS)) {
    claim(fieldKey, synonyms);
  }

  return { mapping, questionMatches };
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
  const [autoMappedCount, setAutoMappedCount] = useState(0);
  const [showUnmappedFields, setShowUnmappedFields] = useState(false);
  const [showAllErrors, setShowAllErrors] = useState(false);
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
  const [expandedMappingIdx, setExpandedMappingIdx] = useState<number | null>(null);

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
      const sectionLabel = `Section ${sLetter} — ${cleanSectionName(section.sectionName)}`;
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

  // A field the upload cannot proceed without stays visible even with no column
  const isRequiredField = useCallback(
    (row: MappingRow) =>
      (row.key === "id_rollNumber" && uploadMode === "rollnumber") ||
      (row.key === "id_name" && uploadMode === "name"),
    [uploadMode]
  );

  /** Fields with no column in the uploaded sheet — hidden unless asked for. */
  const hiddenFieldCount = useMemo(
    () => mappingRows.filter((r) => !fieldToHeader[r.key] && !isRequiredField(r)).length,
    [mappingRows, fieldToHeader, isRequiredField]
  );

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
      showErrorToast("Failed to load assessment mapping.");
    } finally {
      setLoadingMapping(false);
    }
  };

  const applyMappingFromJson = (saved: Record<string, string>, headers: string[]) => {
    if (headers.length > 0) {
      const matched = matchMappingToHeaders(saved, headers);
      setFieldToHeader(matched);
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
      showErrorToast("No saved mapping found.");
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
      showSuccessToast("Mapping saved successfully!");
    } catch {
      showErrorToast("Failed to save mapping.");
    } finally {
      setSavingMapping(false);
    }
  };

  const resetAll = () => {
    setExcelHeaders([]); setRawExcelData([]); setFieldToHeader({});
    setMappingApplied(false); setParsedStudents([]);
    setFileName(""); setSubmitResult(null); setExpandedSections(new Set());
    setSavedMappingExists(false); setAutoLoadedMapping(false); setAutoMappedCount(0); setShowUnmappedFields(false);
    savedMappingJsonRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ============ File Upload ============

  const [parsingFile, setParsingFile] = useState(false);

  /**
   * Map the uploaded sheet onto the questionnaire automatically.
   * Anything the questionnaire headers could not resolve is filled in from a
   * saved mapping, if one exists, so nothing that used to work is lost.
   */
  const applyAutoMapping = (headers: string[], data: MappingData) => {
    const { mapping, questionMatches } = autoMapFromQuestionHeaders(data, headers);
    const merged: Record<string, string> = { ...mapping };
    const used = new Set(Object.values(merged));
    let savedFilledGap = false;

    if (savedMappingJsonRef.current) {
      const matched = matchMappingToHeaders(savedMappingJsonRef.current, headers);
      for (const [key, header] of Object.entries(matched)) {
        if (merged[key] || used.has(header)) continue;
        merged[key] = header;
        used.add(header);
        savedFilledGap = true;
      }
    }

    setFieldToHeader(merged);
    setAutoMappedCount(questionMatches);
    setAutoLoadedMapping(savedFilledGap);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mappingData) return;

    setFileName(file.name);
    setSubmitResult(null);
    setMappingApplied(false);
    setParsedStudents([]);
    setParsingFile(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const arrayBuffer = evt.target?.result as ArrayBuffer;

      // Parse Excel in a Web Worker to avoid blocking the UI
      const workerCode = `
        importScripts("https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js");
        self.onmessage = function(e) {
          var data = new Uint8Array(e.data);
          var workbook = XLSX.read(data, { type: "array", cellDates: true });
          var sheet = workbook.Sheets[workbook.SheetNames[0]];
          var matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false, blankrows: false });
          self.postMessage(matrix);
        };
      `;
      const blob = new Blob([workerCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      worker.onmessage = (workerEvt) => {
        const matrix: any[][] = workerEvt.data;
        worker.terminate();
        URL.revokeObjectURL(workerUrl);

        const { headers, rows } = buildRowsFromSheet(matrix);
        if (rows.length === 0) { showErrorToast("Excel file has no data rows."); setParsingFile(false); return; }

        setExcelHeaders(headers);
        setRawExcelData(rows);
        setAutoLoadedMapping(false);
        setParsingFile(false);

        // Map the sheet onto the questionnaire straight away
        applyAutoMapping(headers, mappingData);
      };

      worker.onerror = () => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        // Fallback: parse on main thread if worker fails
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false, blankrows: false });

        const { headers, rows } = buildRowsFromSheet(matrix);
        if (rows.length === 0) { showErrorToast("Excel file has no data rows."); setParsingFile(false); return; }

        setExcelHeaders(headers);
        setRawExcelData(rows);
        setAutoLoadedMapping(false);
        setParsingFile(false);

        applyAutoMapping(headers, mappingData);
      };

      worker.postMessage(arrayBuffer);
    };
    reader.readAsArrayBuffer(file);
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

  const [parsing, setParsing] = useState(false);

  const handleApplyMapping = () => {
    if (!mappingData || rawExcelData.length === 0) return;

    setParsing(true);

    // Pre-compute everything outside the row loop
    const sortedSections = [...mappingData.sections].sort(
      (a, b) => parseInt(a.sectionOrder || "0") - parseInt(b.sectionOrder || "0")
    );

    // Pre-build section metadata to avoid recomputation per row
    const sectionMeta = sortedSections.map((section, si) => {
      const sLetter = String.fromCharCode(65 + si);
      const isMerged = section.questions.length === 1;

      if (isMerged) {
        const q = section.questions[0];
        // Pre-resolve option headers
        const optMappings: { optionId: number; header: string }[] = [];
        for (const opt of q.options) {
          const header = fieldToHeader[`opt_${q.questionnaireQuestionId}_${opt.optionId}`];
          if (header) optMappings.push({ optionId: opt.optionId, header });
        }
        return { isMerged: true as const, sLetter, questionnaireQuestionId: q.questionnaireQuestionId, optMappings };
      } else {
        const qMappings = section.questions.map((q, qi) => {
          const header = fieldToHeader[`q_${q.questionnaireQuestionId}`];
          return { questionnaireQuestionId: q.questionnaireQuestionId, header, options: q.options, qi, sLetter };
        }).filter((qm) => qm.header);
        return { isMerged: false as const, sLetter, qMappings };
      }
    });

    // Pre-resolve identity field headers
    const rollHeader = fieldToHeader["id_rollNumber"] || "";
    const nameHeader = fieldToHeader["id_name"] || "";
    const mobileHeader = fieldToHeader["id_mobile"] || "";
    const dobHeader = fieldToHeader["id_dob"] || "";
    const classHeader = fieldToHeader["id_class"] || "";

    // Process a single row
    const parseRow = (row: any, rowIdx: number): ParsedStudent => {
      const warnings: string[] = [];
      const answers: ParsedAnswer[] = [];

      const rollNumber = rollHeader ? String(row[rollHeader] ?? "").trim() : "";
      const name = nameHeader ? String(row[nameHeader] ?? "").trim() : "";
      const mobile = mobileHeader ? String(row[mobileHeader] ?? "").trim() : "";
      const dob = dobHeader ? String(row[dobHeader] ?? "").trim() : "";
      const studentClass = classHeader ? String(row[classHeader] ?? "").trim() : "";

      for (const meta of sectionMeta) {
        if (meta.isMerged) {
          for (const om of meta.optMappings) {
            const val = String(row[om.header] ?? "").trim();
            // Selected bubble = 1 (or "1.0"); anything else, incl. BLANK, is unselected
            if (!isNotAttempted(val) && Number(val) === 1) {
              answers.push({ questionnaireQuestionId: meta.questionnaireQuestionId, optionId: om.optionId });
            }
          }
        } else {
          for (const qm of meta.qMappings) {
            const cellValue = String(row[qm.header!] ?? "").trim();
            const result = resolveMultiQuestionAnswer(cellValue, qm.options);
            if (result.warning) warnings.push(`${qm.sLetter}-Q${qm.qi + 1}: ${result.warning}`);
            if (result.optionId) {
              answers.push({ questionnaireQuestionId: qm.questionnaireQuestionId, optionId: result.optionId });
            }
          }
        }
      }

      return { rowIndex: rowIdx, rollNumber, name, mobile, dob, studentClass, answers, warnings };
    };

    // Process in batches to avoid blocking the UI
    const BATCH_SIZE = 20;
    const allStudents: ParsedStudent[] = [];
    let offset = 0;

    const processBatch = () => {
      const end = Math.min(offset + BATCH_SIZE, rawExcelData.length);
      for (let i = offset; i < end; i++) {
        allStudents.push(parseRow(rawExcelData[i], i));
      }
      offset = end;

      if (offset < rawExcelData.length) {
        setTimeout(processBatch, 0);
      } else {
        setParsedStudents(allStudents);
        setMappingApplied(true);
        setParsing(false);
      }
    };

    processBatch();
  };

  // ============ Helpers ============

  const countUniqueQuestions = (answers: ParsedAnswer[]) =>
    new Set(answers.map((a) => a.questionnaireQuestionId)).size;

  // ============ Stats ============

  const stats = useMemo(() => {
    if (!parsedStudents.length || !mappingData) return null;
    const totalQuestions = mappingData.questions.length;
    const withWarnings = parsedStudents.filter((s) => s.warnings.length > 0).length;
    const withRollNumber = parsedStudents.filter((s) => s.rollNumber.trim()).length;
    const avgAnswers = Math.round(
      parsedStudents.reduce((sum, s) => sum + countUniqueQuestions(s.answers), 0) / parsedStudents.length
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
          const matchingAnswers = student.answers.filter((a) => a.questionnaireQuestionId === q.questionnaireQuestionId);
          if (matchingAnswers.length > 0) {
            const selectedOpts = matchingAnswers
              .map((a) => q.options.find((o) => o.optionId === a.optionId))
              .filter(Boolean);
            details.push({
              sectionName: section.sectionName, sectionLetter: sLetter, questionNumber: qi + 1,
              questionText: q.questionText || `Question ${q.questionnaireQuestionId}`,
              selectedOption: selectedOpts.map((o) => o!.optionText).join(", ") || "-",
              optionSequence: selectedOpts[0]?.sequence || 0,
              answered: true,
            });
          } else {
            details.push({
              sectionName: section.sectionName, sectionLetter: sLetter, questionNumber: qi + 1,
              questionText: q.questionText || `Question ${q.questionnaireQuestionId}`,
              selectedOption: "-",
              optionSequence: 0,
              answered: false,
            });
          }
        }
      }
      return details;
    },
    [mappingData]
  );

  /** Put the full error list on the clipboard — easier than reading it in the panel. */
  const copyErrorsToClipboard = (errors: any[]) => {
    const text = errors
      .map((e) => `Row ${(e.rowIndex ?? 0) + 1} (${e.rollNumber || e.name}): ${e.error}`)
      .join("\n");
    navigator.clipboard?.writeText(text).then(
      () => showSuccessToast(`${errors.length} errors copied`),
      () => showErrorToast("Could not copy to clipboard")
    );
  };

  // ============ Submit ============

  const handleSubmit = async () => {
    if (!mappingData || parsedStudents.length === 0) return;

    if (uploadMode === "rollnumber") {
      const noRoll = parsedStudents.filter((s) => !s.rollNumber.trim());
      if (noRoll.length > 0) {
        showErrorToast(`${noRoll.length} row(s) have no roll number.`);
        return;
      }
    } else {
      const noName = parsedStudents.filter((s) => !s.name.trim());
      if (noName.length > 0) {
        showErrorToast(`${noName.length} row(s) have no name.`);
        return;
      }
    }

    setSubmitting(true);
    setSubmitResult(null);
    setShowAllErrors(false);

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

  const handleExpandMapping = async (idx: number) => {
    if (expandedMappingIdx === idx) {
      setExpandedMappingIdx(null);
      return;
    }
    setExpandedMappingIdx(idx);

    const m = allSavedMappings[idx];
    // If already fully loaded with question texts, skip
    if (m.questionLookup && Object.keys(m.questionLookup).length > 0) return;

    const updated = [...allSavedMappings];
    let mappingObj = m.mapping;

    // Fetch mapping JSON if not present
    if (!mappingObj || Object.keys(mappingObj).length === 0) {
      if (m.questionnaireId) {
        try {
          const res = await getSavedOmrMappingByQuestionnaire(m.questionnaireId);
          if (res.data?.mappingJson) {
            mappingObj = JSON.parse(res.data.mappingJson);
          }
        } catch {}
      }
    }

    // Fetch questionnaire structure to get question texts
    // Try using assessmentId from getAll response, or find an assessment that uses this questionnaire
    const questionLookup: Record<string, string> = {};
    let assessmentIdToUse = m.assessmentId;

    // If no assessmentId from getAll, find one from assessmentMappings or the currently selected assessment
    if (!assessmentIdToUse && assessmentMappings.length > 0) {
      assessmentIdToUse = assessmentMappings[0]?.id;
    }

    if (assessmentIdToUse) {
      try {
        const res = await getOfflineMapping(Number(assessmentIdToUse));
        const data = res.data as MappingData;
        if (data?.sections) {
          for (const section of data.sections) {
            for (const q of section.questions) {
              questionLookup[`q_${q.questionnaireQuestionId}`] = q.questionText || "";
              for (const opt of (q.options || [])) {
                questionLookup[`opt_${q.questionnaireQuestionId}_${opt.optionId}`] = `${q.questionText?.substring(0, 40) || ""} → Option ${opt.sequence}: ${opt.optionText}`;
              }
            }
          }
        }
      } catch {}
    }

    updated[idx] = { ...m, mapping: mappingObj, questionLookup };
    setAllSavedMappings(updated);
  };

  // ============ Render ============

  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-upc-scan" />}
        title="OMR Data Upload"
        subtitle={
          parsedStudents.length > 0 ? (
            <><strong>{parsedStudents.length}</strong> students parsed · Upload scanned OMR data with manual column mapping</>
          ) : (
            <>Upload scanned OMR data with manual column mapping</>
          )
        }
        actions={[
          {
            label: submitting ? "Submitting..." : `Submit${parsedStudents.length ? ` (${parsedStudents.length})` : ""}`,
            iconClass: "bi-upload",
            onClick: handleSubmit,
            variant: "primary",
            disabled: submitting || parsedStudents.length === 0,
          },
          {
            label: "View Saved Mappings",
            iconClass: "bi-clipboard",
            onClick: handleShowSavedMappings,
            variant: "ghost",
          },
        ]}
      />
      <div className="card">
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
                <SearchableSelect
                  options={institutes.map((inst: any) => ({
                    value: String(inst.instituteCode),
                    label: String(inst.instituteName ?? ""),
                  }))}
                  value={selectedInstitute}
                  onChange={(v) => setSelectedInstitute(v)}
                  placeholder="Select an institute..."
                />
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
                {parsingFile && <div><Spinner animation="border" size="sm" className="me-1" />Parsing Excel...</div>}
                {!parsingFile && excelHeaders.length > 0 && (
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
                {autoMappedCount > 0 && (
                  <Badge bg="success" style={{ fontSize: "0.7rem" }}>
                    {autoMappedCount} columns matched automatically
                  </Badge>
                )}
                {autoLoadedMapping && (
                  <Badge bg="secondary" style={{ fontSize: "0.7rem" }}>Saved mapping used for the rest</Badge>
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
                {hiddenFieldCount > 0 && (
                  <Button variant="outline-secondary" size="sm" onClick={() => setShowUnmappedFields((v) => !v)}>
                    {showUnmappedFields ? "Hide unmatched fields" : `Show ${hiddenFieldCount} unmatched field${hiddenFieldCount === 1 ? "" : "s"}`}
                  </Button>
                )}
                <Button variant="outline-secondary" size="sm" onClick={expandAllSections}>Expand All</Button>
                <Button variant="outline-secondary" size="sm" onClick={collapseAllSections}>Collapse All</Button>
                <Button variant="primary" size="sm" onClick={handleApplyMapping} disabled={!mappingValidation.canApply || parsing}>
                  {parsing ? <><Spinner animation="border" size="sm" className="me-1" />Parsing...</> : "Apply Mapping & Preview"}
                </Button>
              </div>
            </div>

            {/* Collapsible sections */}
            <div className="accordion" id="mappingAccordion">
              {Object.entries(groupedMappingRows).map(([sectionLabel, rows]) => {
                const isExpanded = expandedSections.has(sectionLabel);
                const isIdentity = rows[0]?.type === "identity";
                const isMergedSection = rows[0]?.type === "option";

                // Show only the fields the uploaded sheet actually has a column for
                const visibleRows = showUnmappedFields
                  ? rows
                  : rows.filter((r) => !!fieldToHeader[r.key] || isRequiredField(r));
                if (visibleRows.length === 0) return null;
                const mappedCount = visibleRows.filter((r) => !!fieldToHeader[r.key]).length;

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
                            {visibleRows.length} fields
                          </Badge>
                          <Badge bg={mappedCount === visibleRows.length ? "success" : mappedCount > 0 ? "warning" : "danger"} style={{ fontSize: "0.65rem" }}>
                            {mappedCount}/{visibleRows.length} mapped
                          </Badge>
                          {isMergedSection && (
                            <Badge
                              bg="warning" text="dark" style={{ fontSize: "0.6rem" }}
                              title="One column per option. 1 = selected, blank = not selected."
                            >
                              1 = selected
                            </Badge>
                          )}
                          {!isIdentity && !isMergedSection && rows[0]?.type === "question" && (
                            <Badge
                              bg="info" style={{ fontSize: "0.6rem" }}
                              title="One column per question. The cell holds the option chosen; 0 means not attempted."
                            >
                              {optionValueHint(rows[0]?.options || [])}
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
                            {visibleRows.map((row) => {
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
                              bg={countUniqueQuestions(student.answers) === stats.totalQuestions ? "success" : "warning"}
                              role="button" style={{ cursor: "pointer" }}
                              onClick={() => setAnswerModalStudent(student)}
                            >
                              {countUniqueQuestions(student.answers)}/{stats.totalQuestions}
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
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <strong>Errors ({submitResult.errors.length}):</strong>
                          {submitResult.errors.length > 10 && (
                            <Button variant="link" size="sm" className="p-0"
                              onClick={() => setShowAllErrors((v) => !v)}>
                              {showAllErrors ? "Show first 10" : `Show all ${submitResult.errors.length}`}
                            </Button>
                          )}
                          <Button variant="link" size="sm" className="p-0"
                            onClick={() => copyErrorsToClipboard(submitResult.errors)}>
                            Copy
                          </Button>
                        </div>
                        <div style={showAllErrors ? { maxHeight: 260, overflowY: "auto" } : undefined}>
                          {(showAllErrors ? submitResult.errors : submitResult.errors.slice(0, 10))
                            .map((err: any, i: number) => (
                              <div key={i} className="text-danger">
                                Row {(err.rowIndex ?? 0) + 1} ({err.rollNumber || err.name}): {err.error}
                              </div>
                            ))}
                        </div>
                        {!showAllErrors && submitResult.errors.length > 10 && (
                          <div className="text-muted">…and {submitResult.errors.length - 10} more</div>
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
                  {countUniqueQuestions(answerModalStudent.answers)}/{stats.totalQuestions} answered
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
        <Modal show={showSavedMappingsModal} onHide={() => { setShowSavedMappingsModal(false); setExpandedMappingIdx(null); }} size="lg" centered scrollable>
          <Modal.Header closeButton>
            <Modal.Title>Questionnaires with Saved Mappings</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {loadingAllMappings ? (
              <div className="text-center py-4"><Spinner animation="border" /> Loading...</div>
            ) : allSavedMappings.length === 0 ? (
              <p className="text-muted text-center py-4">No saved mappings found.</p>
            ) : (
              <div className="accordion">
                {allSavedMappings.map((m: any, idx: number) => {
                  const isExpanded = expandedMappingIdx === idx;
                  const mapping: Record<string, string> = m.mapping || {};
                  const questionLookup: Record<string, string> = m.questionLookup || {};
                  const identityFields = Object.entries(mapping).filter(([k]) => k.startsWith("id_"));
                  const questionFields = Object.entries(mapping).filter(([k]) => !k.startsWith("id_"));

                  return (
                    <div className="accordion-item" key={idx}>
                      <h2 className="accordion-header">
                        <button
                          className={`accordion-button ${!isExpanded ? "collapsed" : ""}`}
                          type="button"
                          onClick={() => handleExpandMapping(idx)}
                          style={{ padding: "0.75rem 1rem" }}
                        >
                          <div className="d-flex align-items-center gap-2 w-100">
                            <strong>{m.questionnaireName || "Unknown Questionnaire"}</strong>
                            <Badge bg="info" className="ms-auto me-2">{m.mappedFieldsCount} fields mapped</Badge>
                          </div>
                        </button>
                      </h2>
                      <div className={`accordion-collapse collapse ${isExpanded ? "show" : ""}`}>
                        <div className="accordion-body p-0">
                          {Object.keys(mapping).length === 0 ? (
                            <p className="text-muted text-center py-3 mb-0">No mapping data available.</p>
                          ) : (
                            <table className="table table-sm table-bordered mb-0">
                              <thead>
                                <tr style={{ backgroundColor: "#212529", color: "#fff" }}>
                                  <th style={{ width: "50%", backgroundColor: "#212529", color: "#fff" }}>Mapped Field</th>
                                  <th style={{ width: "50%", backgroundColor: "#212529", color: "#fff" }}>Excel Column</th>
                                </tr>
                              </thead>
                              <tbody>
                                {identityFields.length > 0 && (
                                  <tr style={{ backgroundColor: "#e8f4fd" }}>
                                    <td colSpan={2}><strong style={{ color: "#0d6efd" }}>Student Identity</strong></td>
                                  </tr>
                                )}
                                {identityFields.map(([key, header]) => (
                                  <tr key={key}>
                                    <td className="fw-semibold">{key.replace("id_", "").replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</td>
                                    <td><Badge bg="primary">{header}</Badge></td>
                                  </tr>
                                ))}
                                {questionFields.length > 0 && (
                                  <tr style={{ backgroundColor: "#e8f4fd" }}>
                                    <td colSpan={2}><strong style={{ color: "#0d6efd" }}>Questions / Options</strong></td>
                                  </tr>
                                )}
                                {questionFields.map(([key, header]) => (
                                  <tr key={key}>
                                    <td style={{ color: "#333" }}>
                                      <span className="fw-semibold">{questionLookup[key] || key}</span>
                                    </td>
                                    <td><Badge bg="success">{header}</Badge></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowSavedMappingsModal(false); setExpandedMappingIdx(null); }}>Close</Button>
          </Modal.Footer>
        </Modal>

      </div>
    </div>
    </div>
  );
};

export default OMRDataUploadPage;
