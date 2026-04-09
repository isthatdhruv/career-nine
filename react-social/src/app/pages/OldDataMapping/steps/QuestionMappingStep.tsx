import { useEffect, useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  getAssessmentQuestionnaire,
  importMappedAnswers,
  getQuestionMappings,
  saveQuestionMappings,
  forceCompleteStatus,
  getAllMappedAssessments,
} from "../API/OldDataMapping_APIs";
import { StudentAssignment, DetailedResponse } from "./AssessmentMappingStep";

// ── Types ────────────────────────────────────────────────────────────────

interface SystemOption {
  optionId: number;
  optionText: string;
  optionDescription?: string;
}

interface SystemQuestion {
  questionId: number;
  questionText: string;
  questionType?: string;
  options?: SystemOption[];
  section?: { sectionId: number; sectionName: string } | null;
}

interface AnswerOptionMapping {
  firebaseAnswer: string;
  systemOptionId: number | null;
  systemOptionText: string;
}

interface AssessmentQuestionMapping {
  firebaseQuestion: string;
  category: string;
  uniqueAnswers: string[];
  systemQuestionId: number | null;
  systemQuestionText: string;
  answerMappings: AnswerOptionMapping[];
}

interface PartialStudentInfo {
  name: string;
  firebaseDocId: string;
  userStudentId: number;
  assessmentId: number;
  answeredCount: number;
  totalMapped: number;
  missingQuestions: string[];
}

interface Props {
  studentAssignments: StudentAssignment[];
  importResults?: any;
  onDone: () => void;
  onBack: () => void;
}

// ── Component ────────────────────────────────────────────────────────────

const QuestionMappingStep = ({ studentAssignments, importResults, onDone, onBack }: Props) => {
  const [systemQuestions, setSystemQuestions] = useState<SystemQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Excel upload state
  const [phase, setPhase] = useState<"upload" | "mapping">("upload");
  const [parsing, setParsing] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<{ category: string; question: string; options: string[] }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Existing mapping state
  const [existingMappedAssessments, setExistingMappedAssessments] = useState<any[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [selectedExistingId, setSelectedExistingId] = useState<number | null>(null);
  const [loadingFromExisting, setLoadingFromExisting] = useState(false);

  // Mapping state
  const [mappings, setMappings] = useState<AssessmentQuestionMapping[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [questionSearches, setQuestionSearches] = useState<Record<string, string>>({});

  // Apply state
  const [applying, setApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState(0);
  const [applyResult, setApplyResult] = useState<{
    totalStudents: number;
    totalAnswers: number;
    partialStudents: number;
    errors: string[];
  } | null>(null);

  // Partial students modal
  const [partialStudentDetails, setPartialStudentDetails] = useState<PartialStudentInfo[]>([]);
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [forceCompleting, setForceCompleting] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());

  // Helper: get userStudentId from importResults
  const getUserStudentId = (firebaseDocId: string): number | null => {
    const results = importResults?.results || [];
    const match = results.find((r: any) => r.firebaseDocId === firebaseDocId && r.userStudentId);
    return match ? match.userStudentId : null;
  };

  // Fetch system questions for the mapped assessment
  useEffect(() => {
    const assessmentId = studentAssignments[0]?.assessmentId;
    if (!assessmentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getAssessmentQuestionnaire(assessmentId)
      .then((res) => {
        const questionnaire = Array.isArray(res.data) ? res.data[0] : res.data;
        const extracted: SystemQuestion[] = [];
        const seen = new Set<number>();
        const sections = questionnaire?.sections || questionnaire?.section || [];
        sections.forEach((sec: any) => {
          const questions = sec.questions || sec.question || [];
          questions.forEach((qq: any) => {
            const aq = qq.question || qq;
            const qId = aq.questionId;
            if (!qId || seen.has(qId)) return;
            seen.add(qId);
            extracted.push({
              questionId: qId,
              questionText: aq.questionText || "",
              questionType: aq.questionType,
              options: (aq.options || []).map((o: any) => ({
                optionId: o.optionId,
                optionText: o.optionText || "",
                optionDescription: o.optionDescription,
              })),
              section: sec.sectionId ? { sectionId: sec.sectionId, sectionName: sec.sectionName || "" } : null,
            });
          });
        });
        setSystemQuestions(extracted);
      })
      .catch(() => setError("Failed to load assessment questions"))
      .finally(() => setLoading(false));
  }, [studentAssignments]);

  // Fetch existing mapped assessments for the dropdown
  useEffect(() => {
    setLoadingExisting(true);
    getAllMappedAssessments()
      .then((res) => setExistingMappedAssessments(res.data || []))
      .catch(() => {})
      .finally(() => setLoadingExisting(false));
  }, []);

  // Load mappings from an existing assessment
  const handleLoadFromExisting = () => {
    if (!selectedExistingId) return;
    setLoadingFromExisting(true);
    setError("");

    getQuestionMappings(selectedExistingId)
      .then((res) => {
        const saved: any[] = res.data || [];
        if (saved.length === 0) {
          setError("No mappings found for the selected assessment.");
          setLoadingFromExisting(false);
          return;
        }

        // Normalize old DB category keys
        const normalizeCat = (key: string): string => {
          const mapping: Record<string, string> = {
            multipleIntelligence: "multipleintelligence",
            careerAspiration: "careeraspirations",
            subjectOfInterest: "subjectofinterest",
            value: "values",
          };
          return mapping[key] || key;
        };

        // Normalize old question labels for string array categories
        // e.g. "Career Aspiration" (singular from old wizard) → "Career Aspirations" (plural)
        const normalizeQuestionLabel = (question: string, category: string): string => {
          const labelMap: Record<string, Record<string, string>> = {
            careeraspirations: { "career aspiration": "Career Aspirations", "career aspirations": "Career Aspirations" },
            subjectofinterest: { "subject of interest": "Subject of Interest" },
            values: { "values": "Values", "value": "Values" },
          };
          const catMap = labelMap[category];
          if (catMap) {
            const normalized = question.toLowerCase().trim();
            if (catMap[normalized]) return catMap[normalized];
          }
          return question;
        };

        // Group by firebaseQuestion + category
        const groupMap = new Map<string, {
          firebaseQuestion: string;
          category: string;
          systemQuestionId: number | null;
          answers: Map<string, number | null>;
        }>();

        saved.forEach((s: any) => {
          const cat = normalizeCat(s.category);
          const fbQuestion = normalizeQuestionLabel(s.firebaseQuestion || "", cat);
          const key = `${cat}::${fbQuestion}`;
          if (!groupMap.has(key)) {
            groupMap.set(key, {
              firebaseQuestion: fbQuestion,
              category: cat,
              systemQuestionId: s.systemQuestionId || null,
              answers: new Map(),
            });
          }
          if (s.firebaseAnswer) {
            groupMap.get(key)!.answers.set(s.firebaseAnswer, s.systemOptionId || null);
          }
        });

        const newMappings: AssessmentQuestionMapping[] = [];
        groupMap.forEach((group) => {
          const uniqueAnswers = Array.from(group.answers.keys());
          newMappings.push({
            firebaseQuestion: group.firebaseQuestion,
            category: group.category,
            uniqueAnswers,
            systemQuestionId: group.systemQuestionId,
            systemQuestionText: "",
            answerMappings: uniqueAnswers.map((ans) => ({
              firebaseAnswer: ans,
              systemOptionId: group.answers.get(ans) || null,
              systemOptionText: "",
            })),
          });
        });

        setMappings(newMappings);

        // Set active category
        if (newMappings.length > 0) {
          const categories = Array.from(new Set(newMappings.map((m) => m.category)));
          setActiveCategory(categories[0] || "");
        }

        setPhase("mapping");
      })
      .catch(() => setError("Failed to load existing mappings."))
      .finally(() => setLoadingFromExisting(false));
  };

  // ── Excel parsing ─────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setParsedPreview([]);
    setError("");
    if (file) {
      parseExcelFile(file);
    }
  };

  // Section header pattern → category key mapping
  const sectionCategoryMap: Record<string, string> = {
    "subjects of interest": "subjectofinterest",
    "values": "values",
    "ability assessment": "ability",
    "personality assessment": "personality",
    "multiple intelligence": "multipleintelligence",
    "career aspirations": "careeraspirations",
  };

  const detectSectionCategory = (headerText: string): string | null => {
    const lower = headerText.toLowerCase();
    for (const [keyword, category] of Object.entries(sectionCategoryMap)) {
      if (lower.includes(keyword)) return category;
    }
    return null;
  };

  const parseExcelFile = (file: File) => {
    setParsing(true);
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        if (rows.length === 0) {
          setError("Excel file is empty. Please upload a file with data.");
          setParsing(false);
          return;
        }

        const parsed: { category: string; question: string; options: string[] }[] = [];

        // Selection-type sections accumulate items as options under one question
        const selectionSections: Record<string, string[]> = {};
        const selectionLabels: Record<string, string> = {
          subjectofinterest: "Subject of Interest",
          values: "Values",
          careeraspirations: "Career Aspirations",
        };

        let currentCategory: string | null = null;
        let isSubHeader = false; // next row after section header is the sub-header

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const firstCell = String(row[0] || "").trim();

          // Skip empty rows
          if (!row.some((c) => c !== "" && c !== undefined && c !== null)) continue;

          // Detect section header (e.g., "SECTION A — Subjects of Interest (Select 5)")
          if (/^section\s+[a-z]/i.test(firstCell)) {
            currentCategory = detectSectionCategory(firstCell);
            isSubHeader = true; // next non-empty row is the sub-header
            continue;
          }

          // Skip sub-header row (column labels like "#", "Subject", "Question", etc.)
          if (isSubHeader) {
            isSubHeader = false;
            continue;
          }

          if (!currentCategory) continue;

          // Parse row based on section type
          const col0 = String(row[0] || "").trim();
          const col1 = String(row[1] || "").trim();
          const col2 = String(row[2] || "").trim();
          const col3 = String(row[3] || "").trim();

          // Skip if first column is not a number (data rows start with #)
          if (!col0 || isNaN(Number(col0))) continue;

          if (currentCategory === "subjectofinterest" || currentCategory === "values" || currentCategory === "careeraspirations") {
            // Selection sections: col1 is the item name (subject/value/career)
            if (col1) {
              if (!selectionSections[currentCategory]) selectionSections[currentCategory] = [];
              selectionSections[currentCategory].push(col1);
            }
          } else if (currentCategory === "ability") {
            // Ability: col1=Ability type, col2=Question, col3-6=Options
            const question = col2;
            if (!question) continue;
            const options: string[] = [];
            for (let c = 3; c <= 6 && c < row.length; c++) {
              const val = String(row[c] || "").trim();
              if (val) options.push(val);
            }
            parsed.push({ category: currentCategory, question, options });
          } else if (currentCategory === "personality") {
            // Personality: col1=Question, col2=Domain, col3=Yes, col4=No
            const question = col1;
            if (!question) continue;
            const options: string[] = [];
            if (col3) options.push(col3);
            const col4 = String(row[4] || "").trim();
            if (col4) options.push(col4);
            parsed.push({ category: currentCategory, question, options });
          } else if (currentCategory === "multipleintelligence") {
            // MI: col1=Question, col2=Intelligence Type, col3-6=Options
            const question = col1;
            if (!question) continue;
            const options: string[] = [];
            for (let c = 3; c <= 6 && c < row.length; c++) {
              const val = String(row[c] || "").trim();
              if (val) options.push(val);
            }
            parsed.push({ category: currentCategory, question, options });
          }
        }

        // Convert selection sections into single-question mappings
        for (const [cat, items] of Object.entries(selectionSections)) {
          if (items.length > 0) {
            parsed.push({
              category: cat,
              question: selectionLabels[cat] || cat,
              options: items,
            });
          }
        }

        if (parsed.length === 0) {
          setError("No valid questions found. Ensure the Excel has section headers like 'SECTION A — Subjects of Interest'.");
          setParsing(false);
          return;
        }

        setParsedPreview(parsed);
      } catch (err) {
        setError("Failed to parse Excel file. Please check the file format.");
      } finally {
        setParsing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmUpload = () => {
    if (parsedPreview.length === 0) return;

    // Build mappings from parsed Excel data
    const newMappings: AssessmentQuestionMapping[] = parsedPreview.map((item) => ({
      firebaseQuestion: item.question,
      category: item.category.toLowerCase().replace(/\s+/g, ""),
      uniqueAnswers: item.options,
      systemQuestionId: null,
      systemQuestionText: "",
      answerMappings: item.options.map((opt) => ({
        firebaseAnswer: opt,
        systemOptionId: null,
        systemOptionText: "",
      })),
    }));

    // Try to load saved mappings for the assessment
    const assessmentId = studentAssignments[0]?.assessmentId;
    if (assessmentId) {
      getQuestionMappings(assessmentId)
        .then((res) => {
          const saved: any[] = res.data || [];
          if (saved.length > 0) {
            const normalize = (s: string) => (s || "").toLowerCase().trim().replace(/\s+/g, " ");
            // Normalize old DB category keys to match current lowercase format
            const normCat = (cat: string): string => {
              const map: Record<string, string> = {
                multipleintelligence: "multipleintelligence",
                multipleIntelligence: "multipleintelligence",
                careeraspirations: "careeraspirations",
                careerAspiration: "careeraspirations",
                subjectofinterest: "subjectofinterest",
                subjectOfInterest: "subjectofinterest",
                values: "values",
                value: "values",
              };
              return map[cat] || cat;
            };
            const applied = newMappings.map((m) => {
              const savedForQ = saved.filter(
                (s: any) => normalize(s.firebaseQuestion) === normalize(m.firebaseQuestion) && normCat(s.category) === m.category
              );
              if (savedForQ.length === 0) return m;

              const systemQuestionId = savedForQ[0].systemQuestionId;
              const newAnswerMappings = m.answerMappings.map((am) => {
                const savedAm = savedForQ.find((s: any) => normalize(s.firebaseAnswer) === normalize(am.firebaseAnswer));
                if (savedAm && savedAm.systemOptionId) {
                  return { ...am, systemOptionId: savedAm.systemOptionId, systemOptionText: "" };
                }
                return am;
              });

              return {
                ...m,
                systemQuestionId: systemQuestionId || null,
                systemQuestionText: "",
                answerMappings: newAnswerMappings,
              };
            });
            setMappings(applied);
          } else {
            setMappings(newMappings);
          }
        })
        .catch(() => setMappings(newMappings));
    } else {
      setMappings(newMappings);
    }

    // Set active category
    if (newMappings.length > 0) {
      const categories = Array.from(new Set(newMappings.map((m) => m.category)));
      setActiveCategory(categories[0] || "");
    }

    setPhase("mapping");
  };

  // Fill in display names from systemQuestions when both are loaded
  useEffect(() => {
    if (systemQuestions.length === 0 || mappings.length === 0) return;
    const needsUpdate = mappings.some((m) => m.systemQuestionId && !m.systemQuestionText);
    if (!needsUpdate) return;

    setMappings((prev) =>
      prev.map((m) => {
        if (!m.systemQuestionId || m.systemQuestionText) return m;
        const sq = systemQuestions.find((q) => q.questionId === m.systemQuestionId);
        if (!sq) return m;
        return {
          ...m,
          systemQuestionText: sq.questionText || "",
          answerMappings: m.answerMappings.map((am) => {
            if (!am.systemOptionId || am.systemOptionText) return am;
            const opt = sq.options?.find((o) => o.optionId === am.systemOptionId);
            return opt ? { ...am, systemOptionText: opt.optionText } : am;
          }),
        };
      })
    );
  }, [systemQuestions, mappings]);

  // Filtered system questions
  const getFilteredSystemQuestions = (searchKey: string): SystemQuestion[] => {
    const term = (questionSearches[searchKey] || "").toLowerCase().trim();
    if (!term) return systemQuestions;
    return systemQuestions.filter((q) =>
      (q.questionText || "").toLowerCase().includes(term)
    );
  };

  // Category data
  const categoryLabels: Record<string, string> = {
    ability: "Ability",
    multipleintelligence: "Multiple Intelligence",
    personality: "Personality",
    careeraspirations: "Career Aspirations",
    subjectofinterest: "Subject of Interest",
    values: "Values",
    general: "General",
  };

  const getCategoryLabel = (cat: string): string => {
    return categoryLabels[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
  };

  const categoryMappings = useMemo(() => {
    return mappings.filter((m) => m.category === activeCategory);
  }, [mappings, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, { total: number; mapped: number }> = {};
    mappings.forEach((m) => {
      if (!counts[m.category]) counts[m.category] = { total: 0, mapped: 0 };
      counts[m.category].total++;
      if (m.systemQuestionId) counts[m.category].mapped++;
    });
    return counts;
  }, [mappings]);

  const totalMapped = useMemo(() => mappings.filter((m) => m.systemQuestionId).length, [mappings]);
  const totalQuestions = mappings.length;

  // Questions with unmapped options
  const unmappedOptionIssues = useMemo(() => {
    return mappings
      .filter((m) => m.systemQuestionId !== null)
      .map((m) => {
        const unmappedAnswers = m.answerMappings.filter((am) => am.systemOptionId === null);
        if (unmappedAnswers.length === 0) return null;
        return {
          firebaseQuestion: m.firebaseQuestion,
          category: m.category,
          unmappedAnswers: unmappedAnswers.map((am) => am.firebaseAnswer),
          totalAnswers: m.answerMappings.length,
        };
      })
      .filter(Boolean) as { firebaseQuestion: string; category: string; unmappedAnswers: string[]; totalAnswers: number }[];
  }, [mappings]);

  // ── Auto-map helpers ──────────────────────────────────────────────────

  const textSimilarity = (a: string, b: string): number => {
    const al = a.toLowerCase().trim();
    const bl = b.toLowerCase().trim();
    if (al === bl) return 1;
    if (al.includes(bl) || bl.includes(al)) return 0.9;
    const aWords = al.split(/\s+/).filter(Boolean);
    const bWords = bl.split(/\s+/).filter(Boolean);
    const common = aWords.filter((w) => bWords.includes(w)).length;
    const total = Math.max(aWords.length, bWords.length);
    return total > 0 ? common / total : 0;
  };

  const findBestSystemQuestion = (fbQuestion: string): SystemQuestion | null => {
    if (!fbQuestion) return null;
    let best: SystemQuestion | null = null;
    let bestScore = 0;
    for (const sq of systemQuestions) {
      const score = textSimilarity(fbQuestion, sq.questionText || "");
      if (score > bestScore) {
        bestScore = score;
        best = sq;
      }
    }
    return bestScore >= 0.7 ? best : null;
  };

  const normText = (s: string) =>
    (s || "").replace(/[^\x00-\x7F]/g, " ").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

  const findBestOption = (answerText: string, options: SystemOption[]): SystemOption | null => {
    if (!answerText || !options?.length) return null;
    const al = normText(answerText);
    // Pass 1: normalized exact match
    const exact = options.find((o) => normText(o.optionText || "") === al);
    if (exact) return exact;
    // Pass 2: one contains the other (normalized)
    const contains = options.find((o) => {
      const ol = normText(o.optionText || "");
      return ol.includes(al) || al.includes(ol);
    });
    if (contains) return contains;
    // Pass 3: word overlap similarity (handles minor wording differences)
    let bestOpt: SystemOption | null = null;
    let bestScore = 0;
    for (const o of options) {
      const score = textSimilarity(answerText, o.optionText || "");
      if (score > bestScore) { bestScore = score; bestOpt = o; }
    }
    return bestScore >= 0.8 ? bestOpt : null;
  };

  const handleMapAll = () => {
    setMappings((prev) =>
      prev.map((m) => {
        if (m.systemQuestionId) return m;
        const bestQ = findBestSystemQuestion(m.firebaseQuestion);
        if (!bestQ) return m;
        const newAnswerMappings = m.answerMappings.map((am) => {
          const bestOpt = findBestOption(am.firebaseAnswer, bestQ.options || []);
          return bestOpt
            ? { ...am, systemOptionId: bestOpt.optionId, systemOptionText: bestOpt.optionText }
            : am;
        });
        return {
          ...m,
          systemQuestionId: bestQ.questionId,
          systemQuestionText: bestQ.questionText,
          answerMappings: newAnswerMappings,
        };
      })
    );
  };

  const handleMapCategory = () => {
    setMappings((prev) =>
      prev.map((m) => {
        if (m.category !== activeCategory || m.systemQuestionId) return m;
        const bestQ = findBestSystemQuestion(m.firebaseQuestion);
        if (!bestQ) return m;
        const newAnswerMappings = m.answerMappings.map((am) => {
          const bestOpt = findBestOption(am.firebaseAnswer, bestQ.options || []);
          return bestOpt
            ? { ...am, systemOptionId: bestOpt.optionId, systemOptionText: bestOpt.optionText }
            : am;
        });
        return {
          ...m,
          systemQuestionId: bestQ.questionId,
          systemQuestionText: bestQ.questionText,
          answerMappings: newAnswerMappings,
        };
      })
    );
  };

  const handleClearCategory = () => {
    setMappings((prev) =>
      prev.map((m) => {
        if (m.category !== activeCategory) return m;
        return {
          ...m,
          systemQuestionId: null,
          systemQuestionText: "",
          answerMappings: m.answerMappings.map((am) => ({
            ...am,
            systemOptionId: null,
            systemOptionText: "",
          })),
        };
      })
    );
  };

  // Map a question
  const handleMapQuestion = (idx: number, sq: SystemQuestion) => {
    setMappings((prev) => {
      const catMappings = prev.filter((m) => m.category === activeCategory);
      const otherMappings = prev.filter((m) => m.category !== activeCategory);
      const updated = [...catMappings];
      const mapping = updated[idx];
      const newAnswerMappings = mapping.answerMappings.map((am) => {
        const bestOpt = findBestOption(am.firebaseAnswer, sq.options || []);
        return bestOpt
          ? { ...am, systemOptionId: bestOpt.optionId, systemOptionText: bestOpt.optionText }
          : am;
      });
      updated[idx] = {
        ...mapping,
        systemQuestionId: sq.questionId,
        systemQuestionText: sq.questionText,
        answerMappings: newAnswerMappings,
      };
      return [...otherMappings, ...updated];
    });
  };

  // Map an answer option
  const handleMapAnswerOption = (qIdx: number, answerIdx: number, opt: SystemOption) => {
    setMappings((prev) => {
      const catMappings = prev.filter((m) => m.category === activeCategory);
      const otherMappings = prev.filter((m) => m.category !== activeCategory);
      const updated = [...catMappings];
      const newAnswerMappings = [...updated[qIdx].answerMappings];
      newAnswerMappings[answerIdx] = {
        ...newAnswerMappings[answerIdx],
        systemOptionId: opt.optionId,
        systemOptionText: opt.optionText,
      };
      updated[qIdx] = { ...updated[qIdx], answerMappings: newAnswerMappings };
      return [...otherMappings, ...updated];
    });
  };

  // Clear a question mapping
  const handleClearMapping = (idx: number) => {
    setMappings((prev) => {
      const catMappings = prev.filter((m) => m.category === activeCategory);
      const otherMappings = prev.filter((m) => m.category !== activeCategory);
      const updated = [...catMappings];
      updated[idx] = {
        ...updated[idx],
        systemQuestionId: null,
        systemQuestionText: "",
        answerMappings: updated[idx].answerMappings.map((am) => ({
          ...am,
          systemOptionId: null,
          systemOptionText: "",
        })),
      };
      return [...otherMappings, ...updated];
    });
  };

  // ── Apply to all students ──────────────────────────────────────────────

  const handleApplyToAllStudents = async () => {
    if (totalMapped === 0) {
      setError("Map at least one question before applying.");
      return;
    }

    setApplying(true);
    setApplyProgress(0);
    setError("");
    setApplyResult(null);
    setPartialStudentDetails([]);

    // Build a lookup: firebaseQuestion+category → { systemQuestionId, answerMap }
    const questionLookup = new Map<string, {
      systemQuestionId: number;
      firebaseQuestion: string;
      category: string;
      answerMap: Map<string, number | null>;
    }>();

    // Normalize: lowercase, replace non-ASCII and non-alphanumeric with space, collapse whitespace
    const normQ = (s: string) =>
      (s || "")
        .replace(/[^\x00-\x7F]/g, " ") // replace non-ASCII with space (smart quotes, ellipsis, etc.)
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")   // replace punctuation with space
        .replace(/\s+/g, " ")
        .trim();

    // All mapped question keys for tracking what each student answered
    const allMappedKeys = new Set<string>();
    // Unique systemQuestionIds for sending to backend (matches backend's uniqueQuestionsAnswered count)
    const allMappedQuestionIds = new Set<number>();

    mappings.forEach((m) => {
      if (!m.systemQuestionId) return;
      const key = `${m.category}::${normQ(m.firebaseQuestion)}`;
      allMappedKeys.add(key);
      allMappedQuestionIds.add(m.systemQuestionId);
      const answerMap = new Map<string, number | null>();
      m.answerMappings.forEach((am) => {
        if (am.firebaseAnswer) {
          answerMap.set(normQ(am.firebaseAnswer), am.systemOptionId);
        }
      });
      questionLookup.set(key, {
        systemQuestionId: m.systemQuestionId,
        firebaseQuestion: m.firebaseQuestion,
        category: m.category,
        answerMap,
      });
    });

    let totalStudents = 0;
    let totalAnswers = 0;
    let partialStudents = 0;
    const errors: string[] = [];
    const partialDetails: PartialStudentInfo[] = [];

    for (let i = 0; i < studentAssignments.length; i++) {
      const sa = studentAssignments[i];
      const userStudentId = getUserStudentId(sa.firebaseDocId);
      if (!userStudentId) {
        errors.push(`${sa.name}: No userStudentId found`);
        continue;
      }

      // Track which mapped questions this student answered
      const answeredKeys = new Set<string>();

      // Build answers for this student
      const answers: { questionId: number; optionId: number | null; textResponse: string }[] = [];

      const processResponses = (responses: DetailedResponse[] | undefined, category: string) => {
        if (!responses || !Array.isArray(responses)) return;
        responses.forEach((r) => {
          const q = normQ(r.question || "");
          const answer = r.selectedOption || r.selectedAnswer || r.answer || r.selected || "";
          const key = `${category}::${q}`;
          const mapping = questionLookup.get(key);
          if (!mapping) return;
          answeredKeys.add(key);
          const optionId = mapping.answerMap.get(normQ(answer)) ?? null;
          answers.push({
            questionId: mapping.systemQuestionId,
            optionId,
            textResponse: answer,
          });
        });
      };

      processResponses(sa.abilityDetailedResponses, "ability");
      processResponses(sa.multipleIntelligenceResponses, "multipleintelligence");
      processResponses(sa.personalityDetailedResponses, "personality");

      // Multi-select categories: find mapping by category prefix, not hardcoded label,
      // because the mapping's firebaseQuestion may differ (e.g. "Career Aspiration" vs "Career Aspirations")
      const processStringArray = (arr: string[] | undefined, category: string) => {
        if (!arr || !Array.isArray(arr)) return;
        // Find the mapping key that matches this category (there should be exactly one)
        const matchingKey = Array.from(questionLookup.keys()).find((k) => k.startsWith(category + "::"));
        if (!matchingKey) return;
        const mapping = questionLookup.get(matchingKey)!;
        answeredKeys.add(matchingKey);
        arr.forEach((val) => {
          if (!val) return;
          const optionId = mapping.answerMap.get(normQ(val)) ?? null;
          answers.push({
            questionId: mapping.systemQuestionId,
            optionId,
            textResponse: val,
          });
        });
      };

      processStringArray(sa.careerAspirations, "careeraspirations");
      processStringArray(sa.subjectsOfInterest, "subjectofinterest");
      processStringArray(sa.values, "values");

      if (answers.length === 0) {
        // Student has no matching answers at all — treat as partial with all questions missing
        partialStudents++;
        const allMissingLabels = Array.from(allMappedKeys).map((key) => {
          const lookup = questionLookup.get(key);
          return lookup ? lookup.firebaseQuestion : key.split("::")[1] || key;
        });
        partialDetails.push({
          name: sa.name || "Unknown",
          firebaseDocId: sa.firebaseDocId,
          userStudentId,
          assessmentId: sa.assessmentId,
          answeredCount: 0,
          totalMapped: allMappedKeys.size,
          missingQuestions: allMissingLabels,
        });
        setApplyProgress(Math.round(((i + 1) / studentAssignments.length) * 100));
        continue;
      }

      try {
        const res = await importMappedAnswers({
          userStudentId,
          assessmentId: sa.assessmentId,
          answers,
          totalMappedQuestions: allMappedQuestionIds.size,
        });
        totalStudents++;
        totalAnswers += answers.length;

        // Check if this student has missing questions (partial answers)
        const resData = res?.data || {};
        const missingKeys = Array.from(allMappedKeys).filter((k) => !answeredKeys.has(k));
        if (resData.status === "ongoing" || missingKeys.length > 0) {
          partialStudents++;
          const missingQuestionLabels = missingKeys.map((key) => {
            const lookup = questionLookup.get(key);
            return lookup ? lookup.firebaseQuestion : key.split("::")[1] || key;
          });
          partialDetails.push({
            name: sa.name || "Unknown",
            firebaseDocId: sa.firebaseDocId,
            userStudentId,
            assessmentId: sa.assessmentId,
            answeredCount: answers.length,
            totalMapped: allMappedKeys.size,
            missingQuestions: missingQuestionLabels,
          });
        }
      } catch (err: any) {
        const msg = err?.response?.data?.error || err?.message || "Unknown error";
        errors.push(`${sa.name}: ${msg}`);
      }

      setApplyProgress(Math.round(((i + 1) / studentAssignments.length) * 100));
    }

    setApplyResult({ totalStudents, totalAnswers, partialStudents, errors });
    setApplying(false);

    // Show partial modal if there are partial students
    if (partialDetails.length > 0) {
      setPartialStudentDetails(partialDetails);
      setShowPartialModal(true);
    }

    // Save mappings to DB for reuse — merge with existing so we don't
    // overwrite mappings saved earlier (e.g. from Detect Unmapped tool)
    const assessmentId = studentAssignments[0]?.assessmentId;
    if (assessmentId && totalMapped > 0) {
      const newMappings: any[] = [];
      mappings.forEach((m) => {
        if (!m.systemQuestionId) return;
        m.answerMappings.forEach((am) => {
          newMappings.push({
            firebaseQuestion: m.firebaseQuestion,
            category: m.category,
            systemQuestionId: m.systemQuestionId,
            firebaseAnswer: am.firebaseAnswer,
            systemOptionId: am.systemOptionId,
          });
        });
      });
      try {
        // Load existing mappings first
        const existingRes = await getQuestionMappings(assessmentId);
        const existingRaw: any[] = (existingRes.data || []).map((m: any) => ({
          firebaseQuestion: m.firebaseQuestion,
          category: m.category,
          systemQuestionId: m.systemQuestionId,
          firebaseAnswer: m.firebaseAnswer,
          systemOptionId: m.systemOptionId,
        }));

        // Build a set of keys from the new mappings to replace matches
        const newKeys = new Set(
          newMappings.map((m) => `${m.category}::${m.firebaseQuestion}::${m.firebaseAnswer}`)
        );

        // Keep existing mappings that aren't being replaced by new ones
        const kept = existingRaw.filter(
          (m) => !newKeys.has(`${m.category}::${m.firebaseQuestion}::${m.firebaseAnswer}`)
        );

        await saveQuestionMappings(assessmentId, [...kept, ...newMappings]);
      } catch (err) {
        console.warn("Failed to save mappings for reuse:", err);
      }
    }
  };

  const handleForceComplete = async () => {
    if (partialStudentDetails.length === 0) return;
    setForceCompleting(true);
    try {
      await forceCompleteStatus(
        partialStudentDetails.map((p) => ({
          userStudentId: p.userStudentId,
          assessmentId: p.assessmentId,
        }))
      );
      setShowPartialModal(false);
      setApplyResult((prev) => prev ? { ...prev, partialStudents: 0 } : prev);
      // Move to Done screen after marking all as completed
      onDone();
    } catch (err) {
      setError("Failed to force-complete status.");
    } finally {
      setForceCompleting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="text-center py-10">
        <span className="spinner-border spinner-border-sm me-2" />
        Loading system questions...
      </div>
    );
  }

  // ── Phase 1: Excel Upload ──────────────────────────────────────────────
  if (phase === "upload") {
    return (
      <div>
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div>
            <h4 className="fw-bold text-dark mb-1">Question & Option Mapping</h4>
            <p className="text-muted fs-7 mb-0">
              Upload an Excel file with Firebase questions and options to map them to system questions.
            </p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-light btn-sm" onClick={onBack}>
              <i className="bi bi-arrow-left me-1"></i>Back
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 mb-4">{error}</div>}

        {/* Upload card */}
        <div className="card border border-primary border-2 mb-4">
          <div className="card-body p-6">
            <div className="text-center mb-4">
              <i className="bi bi-file-earmark-spreadsheet fs-3x text-primary d-block mb-3"></i>
              <h5 className="fw-bold mb-2">Upload Firebase Questions Excel</h5>
              <p className="text-muted fs-7 mb-0">
                Upload the Firebase assessment Excel file (e.g., insight navigator, career navigator, subject navigator).
              </p>
            </div>

            {/* Load from existing mapping */}
            {existingMappedAssessments.length > 0 && (
              <div className="mb-4">
                <div className="fw-semibold fs-7 mb-2">
                  <i className="bi bi-diagram-3 me-1 text-primary"></i>
                  Load from Existing Mapping
                </div>
                <div className="d-flex gap-2 align-items-center">
                  <select
                    className="form-select form-select-sm"
                    style={{ maxWidth: 400 }}
                    value={selectedExistingId ?? ""}
                    onChange={(e) => setSelectedExistingId(e.target.value ? Number(e.target.value) : null)}
                    disabled={loadingFromExisting}
                  >
                    <option value="">-- Select an existing mapping --</option>
                    {existingMappedAssessments.map((a: any) => (
                      <option key={a.assessmentId} value={a.assessmentId}>
                        {a.assessmentName} ({a.totalMappings} mappings)
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-sm btn-primary text-nowrap"
                    onClick={handleLoadFromExisting}
                    disabled={!selectedExistingId || loadingFromExisting}
                  >
                    {loadingFromExisting ? (
                      <><span className="spinner-border spinner-border-sm me-1"></span>Loading...</>
                    ) : (
                      <><i className="bi bi-box-arrow-in-down me-1"></i>Load Mapping</>
                    )}
                  </button>
                </div>
              </div>
            )}
            {loadingExisting && (
              <div className="text-muted fs-8 mb-4">
                <span className="spinner-border spinner-border-sm me-1"></span>
                Loading existing mappings...
              </div>
            )}

            {/* OR divider */}
            {existingMappedAssessments.length > 0 && (
              <div className="d-flex align-items-center mb-4">
                <div className="flex-grow-1" style={{ height: 1, backgroundColor: "#e4e6ef" }}></div>
                <span className="px-3 text-muted fw-semibold fs-7">OR upload Excel</span>
                <div className="flex-grow-1" style={{ height: 1, backgroundColor: "#e4e6ef" }}></div>
              </div>
            )}

            {/* Expected format */}
            <div className="alert alert-light border mb-4">
              <div className="fw-semibold fs-7 mb-2">Supported Excel Format:</div>
              <p className="text-muted fs-8 mb-2">
                The Excel should contain sections separated by headers like <code>SECTION A — Subjects of Interest</code>.
                Each section is auto-detected and parsed:
              </p>
              <div className="fs-8">
                <div className="mb-1"><strong>Section A</strong> — Subjects of Interest (selection items)</div>
                <div className="mb-1"><strong>Section B</strong> — Values (selection items)</div>
                <div className="mb-1"><strong>Section C</strong> — Ability Assessment (questions with 4 options)</div>
                <div className="mb-1"><strong>Section D</strong> — Personality Assessment (Yes/No questions)</div>
                <div className="mb-1"><strong>Section E</strong> — Multiple Intelligence (Strongly Agree to Strongly Disagree)</div>
                <div className="mb-1"><strong>Section F</strong> — Career Aspirations (selection items)</div>
              </div>
            </div>

            {/* File input */}
            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="form-control"
                onChange={handleFileChange}
              />
            </div>

            {parsing && (
              <div className="text-center py-4">
                <span className="spinner-border spinner-border-sm me-2" />
                Parsing Excel file...
              </div>
            )}

            {/* Preview parsed data */}
            {parsedPreview.length > 0 && (
              <div>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h6 className="fw-bold mb-0">
                    <i className="bi bi-eye me-2"></i>
                    Preview: {parsedPreview.length} questions found
                  </h6>
                  <div className="d-flex gap-2">
                    {Object.entries(
                      parsedPreview.reduce<Record<string, number>>((acc, p) => {
                        const cat = p.category.toLowerCase().replace(/\s+/g, "") || "general";
                        acc[cat] = (acc[cat] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([cat, count]) => (
                      <span key={cat} className="badge badge-light-primary fs-9">
                        {getCategoryLabel(cat)}: {count}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="card border mb-4">
                  <div className="card-body p-0">
                    <div style={{ maxHeight: 350, overflowY: "auto" }}>
                      <table className="table table-row-bordered table-hover mb-0">
                        <thead className="bg-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                          <tr className="fw-semibold text-muted fs-8">
                            <th className="ps-4 py-2" style={{ width: 40 }}>#</th>
                            <th className="py-2" style={{ width: 120 }}>Category</th>
                            <th className="py-2">Question</th>
                            <th className="py-2 pe-4">Options</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedPreview.map((item, i) => (
                            <tr key={i}>
                              <td className="ps-4 py-2 fs-8 text-muted">{i + 1}</td>
                              <td className="py-2">
                                <span className="badge badge-light fs-9">{item.category || "general"}</span>
                              </td>
                              <td className="py-2 fs-7">{item.question}</td>
                              <td className="py-2 pe-4">
                                <div className="d-flex flex-wrap gap-1">
                                  {item.options.map((opt, oi) => (
                                    <span key={oi} className="badge badge-light-warning fs-9">{opt}</span>
                                  ))}
                                  {item.options.length === 0 && (
                                    <span className="text-muted fs-9">No options</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="d-flex gap-3">
                  <button
                    className="btn btn-light"
                    onClick={() => {
                      setParsedPreview([]);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Clear
                  </button>
                  <button className="btn btn-primary" onClick={handleConfirmUpload}>
                    <i className="bi bi-check2 me-1"></i>
                    Proceed to Mapping ({parsedPreview.length} questions)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Phase 2: Mapping UI ───────────────────────────────────────────────
  return (
    <>
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold text-dark mb-1">Question & Option Mapping</h4>
          <p className="text-muted fs-7 mb-0">
            Map Excel questions to system questions — it will auto-apply to all {studentAssignments.length} students.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-light btn-sm" onClick={() => { setPhase("upload"); setMappings([]); setApplyResult(null); }}>
            <i className="bi bi-arrow-left me-1"></i>Re-upload Excel
          </button>
          <button className="btn btn-primary btn-sm" onClick={onDone}>
            Next <i className="bi bi-arrow-right ms-1"></i>
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 mb-4">{error}</div>}

      {/* Summary bar */}
      <div className="alert alert-info py-2 mb-4 d-flex align-items-center justify-content-between">
        <span>
          <strong>{totalMapped}</strong> / {totalQuestions} questions mapped across all categories
          &nbsp;|&nbsp;
          Will apply to <strong>{studentAssignments.length}</strong> students
        </span>
        {totalMapped > 0 && !applyResult && (
          <button
            className="btn btn-sm btn-success"
            onClick={handleApplyToAllStudents}
            disabled={applying}
          >
            {applying ? (
              <><span className="spinner-border spinner-border-sm me-1"></span>Applying ({applyProgress}%)</>
            ) : (
              <><i className="bi bi-check2-all me-1"></i>Apply to All Students</>
            )}
          </button>
        )}
      </div>

      {/* Unmapped options warning */}
      {unmappedOptionIssues.length > 0 && (
        <div className="alert alert-warning py-2 mb-4">
          <div className="d-flex align-items-center mb-2">
            <i className="bi bi-exclamation-triangle me-2 text-warning"></i>
            <strong>{unmappedOptionIssues.length} question{unmappedOptionIssues.length !== 1 ? "s" : ""} with unmapped options</strong>
          </div>
          <div style={{ maxHeight: 150, overflowY: "auto" }}>
            {unmappedOptionIssues.map((issue, i) => (
              <div
                key={i}
                className="d-flex align-items-start gap-2 mb-1 fs-8"
                style={{ cursor: "pointer" }}
                onClick={() => {
                  setActiveCategory(issue.category);
                  setTimeout(() => {
                    const catIdx = mappings
                      .filter((m) => m.category === issue.category)
                      .findIndex((m) => m.firebaseQuestion === issue.firebaseQuestion);
                    const el = document.getElementById(`question-card-${issue.category}-${catIdx}`);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }, 100);
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#fff3cd")}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span className="badge badge-light fs-9" style={{ minWidth: 40 }}>
                  {getCategoryLabel(issue.category)}
                </span>
                <span className="text-truncate text-primary" style={{ maxWidth: 400, textDecoration: "underline" }}>
                  {issue.firebaseQuestion}
                </span>
                <span className="text-danger fw-semibold ms-auto" style={{ whiteSpace: "nowrap" }}>
                  {issue.unmappedAnswers.map((a) => `"${a}"`).join(", ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Apply result */}
      {applyResult && (
        <div className={`alert ${applyResult.errors.length > 0 ? "alert-warning" : "alert-success"} py-3 mb-4`}>
          <h6 className="fw-bold mb-2">
            <i className={`bi ${applyResult.errors.length > 0 ? "bi-exclamation-triangle" : "bi-check-circle"} me-2`}></i>
            Mapping Applied
          </h6>
          <div className="mb-2">
            <strong>{applyResult.totalStudents}</strong> students processed,
            <strong> {applyResult.totalAnswers}</strong> answers saved with raw scores calculated.
            {applyResult.partialStudents > 0 && (
              <span className="text-warning ms-1">
                ({applyResult.partialStudents} with incomplete data — marked as ongoing)
              </span>
            )}
          </div>
          {applyResult.errors.length > 0 && (
            <div>
              <strong>Errors ({applyResult.errors.length}):</strong>
              <ul className="mb-0 mt-1">
                {applyResult.errors.slice(0, 10).map((e, i) => (
                  <li key={i} className="text-danger fs-8">{e}</li>
                ))}
                {applyResult.errors.length > 10 && (
                  <li className="text-muted fs-8">...and {applyResult.errors.length - 10} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Progress bar */}
      {applying && (
        <div className="progress mb-4" style={{ height: 20 }}>
          <div
            className="progress-bar progress-bar-striped progress-bar-animated"
            style={{ width: `${applyProgress}%` }}
          >
            {applyProgress}%
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div className="d-flex gap-2 mb-3 flex-wrap">
        {Object.entries(categoryCounts).map(([key, counts]) => (
          <button
            key={key}
            className={`btn btn-sm ${activeCategory === key ? "btn-primary" : "btn-light"}`}
            onClick={() => { setActiveCategory(key); setQuestionSearches({}); }}
          >
            {getCategoryLabel(key)}
            <span className={`badge ms-2 ${activeCategory === key ? "badge-light" : "badge-light-primary"} fs-9`}>
              {counts.mapped}/{counts.total}
            </span>
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="d-flex gap-2 mb-4">
        <button className="btn btn-sm btn-success" onClick={handleMapAll}>
          <i className="bi bi-magic me-1"></i>Map All (Auto)
        </button>
        <button className="btn btn-sm btn-light-success" onClick={handleMapCategory}>
          <i className="bi bi-magic me-1"></i>Map {getCategoryLabel(activeCategory)} (Auto)
        </button>
        <button className="btn btn-sm btn-light-danger" onClick={handleClearCategory}>
          <i className="bi bi-x-circle me-1"></i>Clear {getCategoryLabel(activeCategory)}
        </button>
      </div>

      {/* Mapping cards */}
      <div className="card shadow-sm">
        <div className="card-body p-0">
          <div style={{ maxHeight: 600, overflowY: "auto" }}>
            {categoryMappings.length === 0 ? (
              <div className="text-center text-muted py-10 fs-7">
                No questions found in this category
              </div>
            ) : (
              categoryMappings.map((mapping, idx) => {
                const mappedSysQuestion = mapping.systemQuestionId
                  ? systemQuestions.find((q) => q.questionId === mapping.systemQuestionId)
                  : null;
                const searchKey = `${activeCategory}-${idx}`;

                return (
                  <div key={idx} id={`question-card-${activeCategory}-${idx}`} className="border-bottom p-4">
                    <div className="row g-3">
                      {/* Firebase/Excel side */}
                      <div className="col-md-5">
                        <div className="fs-9 fw-semibold text-muted mb-1">
                          EXCEL QUESTION #{idx + 1}
                        </div>
                        <div className="bg-light rounded p-3 mb-2">
                          <div className="fs-7">{mapping.firebaseQuestion || "—"}</div>
                        </div>
                        <div className="fs-9 fw-semibold text-muted mb-1">
                          OPTIONS ({mapping.uniqueAnswers.length})
                        </div>
                        <div className="d-flex flex-wrap gap-1">
                          {mapping.uniqueAnswers.map((ans, ai) => {
                            const am = mapping.answerMappings[ai];
                            return (
                              <span
                                key={ai}
                                className={`badge ${am?.systemOptionId ? "badge-light-success" : "badge-light-warning"} fs-9 px-2 py-1`}
                              >
                                {ans}
                                {am?.systemOptionId && <i className="bi bi-check ms-1"></i>}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="col-md-1 d-flex align-items-center justify-content-center">
                        <i className={`bi bi-arrow-right fs-4 ${mapping.systemQuestionId ? "text-success" : "text-muted"}`}></i>
                      </div>

                      {/* System side */}
                      <div className="col-md-6">
                        {mapping.systemQuestionId ? (
                          <div>
                            <div className="d-flex align-items-start justify-content-between mb-2">
                              <div className="fs-9 fw-semibold text-success">
                                <i className="bi bi-check-circle me-1"></i>MAPPED TO SYSTEM QUESTION
                              </div>
                              <button
                                className="btn btn-sm btn-icon btn-light-danger"
                                onClick={() => handleClearMapping(idx)}
                                title="Clear mapping"
                              >
                                <i className="bi bi-x fs-7"></i>
                              </button>
                            </div>
                            <div className="bg-light-success rounded p-3 mb-3">
                              <div className="fs-7">{mapping.systemQuestionText}</div>
                            </div>

                            {/* Answer-to-option mappings */}
                            <div className="fs-9 fw-semibold text-muted mb-1">MAP OPTIONS</div>
                            {mapping.answerMappings.map((am, ai) => (
                              <div key={ai} className="d-flex align-items-center gap-2 mb-2">
                                <span className="badge badge-light-warning fs-9 px-2" style={{ minWidth: 80 }}>
                                  {am.firebaseAnswer}
                                </span>
                                <i className="bi bi-arrow-right text-muted fs-9"></i>
                                <div className="d-flex flex-wrap gap-1">
                                  {mappedSysQuestion?.options?.map((opt) => (
                                    <button
                                      key={opt.optionId}
                                      className={`btn btn-sm px-2 py-0 ${
                                        am.systemOptionId === opt.optionId
                                          ? "btn-success"
                                          : "btn-outline-secondary"
                                      }`}
                                      onClick={() => handleMapAnswerOption(idx, ai, opt)}
                                      title={opt.optionDescription || opt.optionText}
                                      style={{ fontSize: "0.75rem" }}
                                    >
                                      {opt.optionText}
                                    </button>
                                  )) || (
                                    <span className="text-muted fs-9">No options</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div>
                            <div className="fs-9 fw-semibold text-muted mb-1">
                              <i className="bi bi-search me-1"></i>SELECT SYSTEM QUESTION
                            </div>
                            <input
                              type="text"
                              className="form-control form-control-sm mb-2"
                              placeholder="Search questions..."
                              value={questionSearches[searchKey] || ""}
                              onChange={(e) =>
                                setQuestionSearches((prev) => ({ ...prev, [searchKey]: e.target.value }))
                              }
                            />
                            {(() => {
                              const filtered = getFilteredSystemQuestions(searchKey);
                              return (
                                <div className="border rounded" style={{ maxHeight: 200, overflowY: "auto" }}>
                                  {filtered.slice(0, 50).map((sq) => (
                                    <div
                                      key={sq.questionId}
                                      className="px-3 py-2 border-bottom fs-8 d-flex align-items-center justify-content-between"
                                      style={{ cursor: "pointer" }}
                                      onClick={() => {
                                        handleMapQuestion(idx, sq);
                                        setQuestionSearches((prev) => ({ ...prev, [searchKey]: "" }));
                                      }}
                                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f5f8fa")}
                                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                    >
                                      <span className="text-truncate" style={{ maxWidth: "85%" }}>
                                        {sq.questionText}
                                      </span>
                                      <span className="badge badge-light fs-9">#{sq.questionId}</span>
                                    </div>
                                  ))}
                                  {filtered.length === 0 && (
                                    <div className="text-muted text-center py-3 fs-8">No questions match</div>
                                  )}
                                  {filtered.length > 50 && (
                                    <div className="text-muted text-center py-2 fs-9">
                                      Showing 50 of {filtered.length} — refine search
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Partial Students Modal */}
    {showPartialModal && (
      <div className="modal d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-warning">
              <h5 className="modal-title fw-bold">
                <i className="bi bi-exclamation-triangle me-2"></i>
                Partial Answers Detected
              </h5>
              <button className="btn-close" onClick={() => setShowPartialModal(false)} />
            </div>
            <div className="modal-body">
              <p className="text-muted fs-7 mb-4">
                {partialStudentDetails.length} student{partialStudentDetails.length !== 1 ? "s" : ""} did not have
                answers for all mapped questions. Click on a student to see which questions are missing.
              </p>

              {partialStudentDetails.map((student) => {
                const isExpanded = expandedStudents.has(student.firebaseDocId);
                return (
                  <div key={student.firebaseDocId} className="card border mb-3">
                    <div
                      className="card-header bg-light py-3 d-flex align-items-center justify-content-between"
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        setExpandedStudents((prev) => {
                          const next = new Set(prev);
                          if (next.has(student.firebaseDocId)) next.delete(student.firebaseDocId);
                          else next.add(student.firebaseDocId);
                          return next;
                        });
                      }}
                    >
                      <div>
                        <span className="fw-bold fs-7">{student.name}</span>
                        <span className="text-muted fs-8 ms-2">
                          ({student.answeredCount} / {student.totalMapped} answers)
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge badge-light-danger fs-9">
                          {student.missingQuestions.length} missing
                        </span>
                        <i className={`bi ${isExpanded ? "bi-chevron-up" : "bi-chevron-down"} fs-8 text-muted`}></i>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="card-body p-0">
                        <div style={{ maxHeight: 250, overflowY: "auto" }}>
                          <table className="table table-row-bordered mb-0">
                            <thead className="bg-light">
                              <tr className="fw-semibold text-muted fs-8">
                                <th className="ps-4 py-2" style={{ width: 40 }}>#</th>
                                <th className="py-2 pe-4">Missing Question</th>
                              </tr>
                            </thead>
                            <tbody>
                              {student.missingQuestions.map((q, qi) => (
                                <tr key={qi}>
                                  <td className="ps-4 py-2 fs-8 text-muted">{qi + 1}</td>
                                  <td className="py-2 pe-4 fs-8">{q}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="modal-footer d-flex justify-content-between">
              <button className="btn btn-light" onClick={() => setShowPartialModal(false)}>
                Close
              </button>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-warning"
                  onClick={() => {
                    setShowPartialModal(false);
                    onDone();
                  }}
                  disabled={forceCompleting}
                >
                  Skip These Students & Continue <i className="bi bi-arrow-right ms-1"></i>
                </button>
                <button
                  className="btn btn-success"
                  onClick={handleForceComplete}
                  disabled={forceCompleting}
                >
                  {forceCompleting ? (
                    <><span className="spinner-border spinner-border-sm me-1"></span>Updating...</>
                  ) : (
                    <>Next: Mark All as Completed <i className="bi bi-arrow-right ms-1"></i></>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default QuestionMappingStep;
