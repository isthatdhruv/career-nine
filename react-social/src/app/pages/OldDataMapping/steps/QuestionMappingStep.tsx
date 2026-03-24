import { useEffect, useState, useMemo } from "react";
import {
  getAssessmentQuestionnaire,
  importMappedAnswers,
  getQuestionMappings,
  saveQuestionMappings,
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

  // Mapping state
  const [mappings, setMappings] = useState<AssessmentQuestionMapping[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("ability");
  const [questionSearches, setQuestionSearches] = useState<Record<string, string>>({});

  // Apply state
  const [applying, setApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState(0);
  const [applyResult, setApplyResult] = useState<{
    totalStudents: number;
    totalAnswers: number;
    errors: string[];
  } | null>(null);

  // Helper: get userStudentId from importResults
  const getUserStudentId = (firebaseDocId: string): number | null => {
    const results = importResults?.results || [];
    const match = results.find((r: any) => r.firebaseDocId === firebaseDocId && r.userStudentId);
    return match ? match.userStudentId : null;
  };

  // Fetch system questions for the mapped assessment only
  useEffect(() => {
    const assessmentId = studentAssignments[0]?.assessmentId;
    if (!assessmentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getAssessmentQuestionnaire(assessmentId)
      .then((res) => {
        // Parse questionnaire sections → QuestionnaireQuestion → AssessmentQuestions
        const questionnaire = Array.isArray(res.data) ? res.data[0] : res.data;
        const extracted: SystemQuestion[] = [];
        const seen = new Set<number>();
        // Response structure: questionnaire → sections[] → questions[] → question (AssessmentQuestions)
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

  // Build unique question mappings from all students' responses
  useEffect(() => {
    if (studentAssignments.length === 0) return;

    const questionMap = new Map<string, { category: string; answers: Set<string> }>();

    studentAssignments.forEach((sa) => {
      const addResponses = (responses: DetailedResponse[] | undefined, category: string) => {
        if (!responses || !Array.isArray(responses)) return;
        responses.forEach((r) => {
          const q = (r.question || "").trim();
          if (!q) return;
          const key = `${category}::${q}`;
          const answer = r.selectedOption || r.selectedAnswer || r.answer || r.selected || "";
          if (!questionMap.has(key)) {
            questionMap.set(key, { category, answers: new Set<string>() });
          }
          if (answer) {
            questionMap.get(key)!.answers.add(answer);
          }
        });
      };

      addResponses(sa.abilityDetailedResponses, "ability");
      addResponses(sa.multipleIntelligenceResponses, "multipleIntelligence");
      addResponses(sa.personalityDetailedResponses, "personality");
    });

    const newMappings: AssessmentQuestionMapping[] = [];
    questionMap.forEach(({ category, answers }, key) => {
      const fbQuestion = key.split("::").slice(1).join("::");
      const uniqueAnswers = Array.from(answers).sort();
      newMappings.push({
        firebaseQuestion: fbQuestion,
        category,
        uniqueAnswers,
        systemQuestionId: null,
        systemQuestionText: "",
        answerMappings: uniqueAnswers.map((a) => ({
          firebaseAnswer: a,
          systemOptionId: null,
          systemOptionText: "",
        })),
      });
    });

    // Try to load saved mappings for the assessment
    const assessmentId = studentAssignments[0]?.assessmentId;
    if (assessmentId) {
      getQuestionMappings(assessmentId)
        .then((res) => {
          const saved: any[] = res.data || [];
          if (saved.length > 0) {
            // Apply saved mappings to newMappings
            const applied = newMappings.map((m) => {
              // Find saved entries for this question + category
              const savedForQ = saved.filter(
                (s: any) => s.firebaseQuestion === m.firebaseQuestion && s.category === m.category
              );
              if (savedForQ.length === 0) return m;

              const systemQuestionId = savedForQ[0].systemQuestionId;
              const systemQ = systemQuestionId ? undefined : null; // will look up text later
              const newAnswerMappings = m.answerMappings.map((am) => {
                const savedAm = savedForQ.find((s: any) => s.firebaseAnswer === am.firebaseAnswer);
                if (savedAm && savedAm.systemOptionId) {
                  return {
                    ...am,
                    systemOptionId: savedAm.systemOptionId,
                    systemOptionText: "", // will be filled by UI
                  };
                }
                return am;
              });

              return {
                ...m,
                systemQuestionId: systemQuestionId || null,
                systemQuestionText: "", // will be filled when systemQuestions load
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

    if (newMappings.length > 0) {
      const cats = ["ability", "multipleIntelligence", "personality"];
      setActiveCategory(cats.find((c) => newMappings.some((m) => m.category === c)) || "ability");
    }
  }, [studentAssignments]);

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
    multipleIntelligence: "Multiple Intelligence",
    personality: "Personality",
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

  // Questions with unmapped options (question is mapped but some answers aren't)
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

  const findBestOption = (answerText: string, options: SystemOption[]): SystemOption | null => {
    if (!answerText || !options?.length) return null;
    const al = answerText.toLowerCase().trim();
    const exact = options.find((o) => (o.optionText || "").toLowerCase().trim() === al);
    if (exact) return exact;
    const contains = options.find((o) => {
      const ol = (o.optionText || "").toLowerCase().trim();
      return ol.includes(al) || al.includes(ol);
    });
    return contains || null;
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
      // Auto-map answer options
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

    // Build a lookup: firebaseQuestion+category → { systemQuestionId, answerMap }
    const questionLookup = new Map<string, {
      systemQuestionId: number;
      answerMap: Map<string, number | null>;
    }>();

    mappings.forEach((m) => {
      if (!m.systemQuestionId) return;
      const key = `${m.category}::${m.firebaseQuestion}`;
      const answerMap = new Map<string, number | null>();
      m.answerMappings.forEach((am) => {
        if (am.firebaseAnswer) {
          answerMap.set(am.firebaseAnswer.toLowerCase().trim(), am.systemOptionId);
        }
      });
      questionLookup.set(key, { systemQuestionId: m.systemQuestionId, answerMap });
    });

    let totalStudents = 0;
    let totalAnswers = 0;
    const errors: string[] = [];

    for (let i = 0; i < studentAssignments.length; i++) {
      const sa = studentAssignments[i];
      const userStudentId = getUserStudentId(sa.firebaseDocId);
      if (!userStudentId) {
        errors.push(`${sa.name}: No userStudentId found`);
        continue;
      }

      // Build answers for this student
      const answers: { questionId: number; optionId: number | null; textResponse: string }[] = [];

      const processResponses = (responses: DetailedResponse[] | undefined, category: string) => {
        if (!responses || !Array.isArray(responses)) return;
        responses.forEach((r) => {
          const q = (r.question || "").trim();
          const answer = r.selectedOption || r.selectedAnswer || r.answer || r.selected || "";
          const key = `${category}::${q}`;
          const mapping = questionLookup.get(key);
          if (!mapping) return;
          const optionId = mapping.answerMap.get(answer.toLowerCase().trim()) ?? null;
          answers.push({
            questionId: mapping.systemQuestionId,
            optionId,
            textResponse: answer,
          });
        });
      };

      processResponses(sa.abilityDetailedResponses, "ability");
      processResponses(sa.multipleIntelligenceResponses, "multipleIntelligence");
      processResponses(sa.personalityDetailedResponses, "personality");

      if (answers.length === 0) continue;

      try {
        await importMappedAnswers({
          userStudentId,
          assessmentId: sa.assessmentId,
          answers,
        });
        totalStudents++;
        totalAnswers += answers.length;
      } catch (err: any) {
        const msg = err?.response?.data?.error || err?.message || "Unknown error";
        errors.push(`${sa.name}: ${msg}`);
      }

      setApplyProgress(Math.round(((i + 1) / studentAssignments.length) * 100));
    }

    setApplyResult({ totalStudents, totalAnswers, errors });
    setApplying(false);

    // Save mappings to DB for reuse with next schools/batches
    const assessmentId = studentAssignments[0]?.assessmentId;
    if (assessmentId && totalMapped > 0) {
      const dbMappings: any[] = [];
      mappings.forEach((m) => {
        if (!m.systemQuestionId) return;
        m.answerMappings.forEach((am) => {
          dbMappings.push({
            firebaseQuestion: m.firebaseQuestion,
            category: m.category,
            systemQuestionId: m.systemQuestionId,
            firebaseAnswer: am.firebaseAnswer,
            systemOptionId: am.systemOptionId,
          });
        });
      });
      try {
        await saveQuestionMappings(assessmentId, dbMappings);
      } catch (err) {
        console.warn("Failed to save mappings for reuse:", err);
      }
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

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold text-dark mb-1">Question & Option Mapping</h4>
          <p className="text-muted fs-7 mb-0">
            Map Firebase questions to system questions once — it will auto-apply to all {studentAssignments.length} students.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-light btn-sm" onClick={onBack}>
            <i className="bi bi-arrow-left me-1"></i>Back
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
          <strong>{totalMapped}</strong> / {totalQuestions} unique questions mapped across all categories
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
            {unmappedOptionIssues.map((issue, i) => {
              const globalIdx = mappings.findIndex(
                (m) => m.category === issue.category && m.firebaseQuestion === issue.firebaseQuestion
              );
              return (
                <div
                  key={i}
                  className="d-flex align-items-start gap-2 mb-1 fs-8"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    // Switch to the correct category
                    setActiveCategory(issue.category);
                    // Scroll to the question after a tick (so DOM updates)
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
                    {categoryLabels[issue.category] || issue.category}
                  </span>
                  <span className="text-truncate text-primary" style={{ maxWidth: 400, textDecoration: "underline" }}>
                    {issue.firebaseQuestion}
                  </span>
                  <span className="text-danger fw-semibold ms-auto" style={{ whiteSpace: "nowrap" }}>
                    {issue.unmappedAnswers.map((a) => `"${a}"`).join(", ")}
                  </span>
                </div>
              );
            })}
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
      <div className="d-flex gap-2 mb-3">
        {Object.entries(categoryLabels).map(([key, label]) => {
          const counts = categoryCounts[key];
          if (!counts) return null;
          return (
            <button
              key={key}
              className={`btn btn-sm ${activeCategory === key ? "btn-primary" : "btn-light"}`}
              onClick={() => { setActiveCategory(key); setQuestionSearches({}); }}
            >
              {label}
              <span className={`badge ms-2 ${activeCategory === key ? "badge-light" : "badge-light-primary"} fs-9`}>
                {counts.mapped}/{counts.total}
              </span>
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="d-flex gap-2 mb-4">
        <button className="btn btn-sm btn-success" onClick={handleMapAll}>
          <i className="bi bi-magic me-1"></i>Map All (Auto)
        </button>
        <button className="btn btn-sm btn-light-success" onClick={handleMapCategory}>
          <i className="bi bi-magic me-1"></i>Map {categoryLabels[activeCategory]} (Auto)
        </button>
        <button className="btn btn-sm btn-light-danger" onClick={handleClearCategory}>
          <i className="bi bi-x-circle me-1"></i>Clear {categoryLabels[activeCategory]}
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
                      {/* Firebase side */}
                      <div className="col-md-5">
                        <div className="fs-9 fw-semibold text-muted mb-1">
                          FIREBASE QUESTION #{idx + 1}
                        </div>
                        <div className="bg-light rounded p-3 mb-2">
                          <div className="fs-7">{mapping.firebaseQuestion || "—"}</div>
                        </div>
                        <div className="fs-9 fw-semibold text-muted mb-1">
                          STUDENT ANSWERS ({mapping.uniqueAnswers.length} unique)
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
                            <div className="fs-9 fw-semibold text-muted mb-1">MAP ANSWERS TO OPTIONS</div>
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
  );
};

export default QuestionMappingStep;
