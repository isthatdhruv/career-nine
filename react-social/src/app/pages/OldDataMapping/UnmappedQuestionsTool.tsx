import { useState, useEffect, useMemo } from "react";
import {
  detectUnmappedQuestions,
  getAllMappedAssessments,
  getAssessmentQuestionnaire,
  saveQuestionMappings,
  getQuestionMappings,
} from "./API/OldDataMapping_APIs";

interface SystemOption {
  optionId: number;
  optionText: string;
}

interface SystemQuestion {
  questionId: number;
  questionText: string;
  options: SystemOption[];
}

interface UnmappedQuestion {
  question: string;
  category: string;
  answers: string[];
  studentCount: number;
  insightCount: number;
  subjectCount: number;
  careerCount: number;
}

interface MappingDraft {
  firebaseQuestion: string;
  category: string;
  systemQuestionId: number | null;
  answerMappings: { firebaseAnswer: string; systemOptionId: number | null }[];
}

interface AssessmentSummary {
  assessmentId: number;
  assessmentName: string;
  totalMappings: number;
}

interface QuestionnaireInfo {
  questionnaireId: number;
  questionnaireName: string;
  assessments: AssessmentSummary[];
}

const CATEGORY_LABELS: Record<string, string> = {
  ability: "Ability",
  multipleintelligence: "Multiple Intelligence",
  personality: "Personality",
  careeraspirations: "Career Aspirations",
  subjectofinterest: "Subject of Interest",
  values: "Values",
};

const CATEGORY_COLORS: Record<string, string> = {
  ability: "#4361ee",
  multipleintelligence: "#0891b2",
  personality: "#7c3aed",
  careeraspirations: "#d97706",
  subjectofinterest: "#059669",
  values: "#dc2626",
};

export default function UnmappedQuestionsTool({ onBack }: { onBack: () => void }) {
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireInfo[]>([]);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<number | "">("");
  const [unmappedQuestions, setUnmappedQuestions] = useState<UnmappedQuestion[]>([]);
  const [systemQuestions, setSystemQuestions] = useState<SystemQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingQuestionnaires, setLoadingQuestionnaires] = useState(true);
  const [stats, setStats] = useState<{ totalFirebase: number; totalMapped: number; totalUnmapped: number } | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [drafts, setDrafts] = useState<Map<string, MappingDraft>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  // Load assessments and group by questionnaire
  useEffect(() => {
    (async () => {
      try {
        const res = await getAllMappedAssessments();
        const assessments: AssessmentSummary[] = res.data || [];
        const withQ = await Promise.all(
          assessments.map(async (a) => {
            try {
              const qRes = await getAssessmentQuestionnaire(a.assessmentId);
              const qData = Array.isArray(qRes.data) ? qRes.data[0] : qRes.data;
              return { ...a, questionnaireId: qData?.questionnaireId, questionnaireName: qData?.name };
            } catch {
              return { ...a, questionnaireId: null, questionnaireName: null };
            }
          })
        );
        const byQ = new Map<number, QuestionnaireInfo>();
        for (const item of withQ) {
          const qId = item.questionnaireId;
          if (qId == null) continue;
          if (!byQ.has(qId)) {
            byQ.set(qId, { questionnaireId: qId, questionnaireName: item.questionnaireName || `Questionnaire #${qId}`, assessments: [] });
          }
          byQ.get(qId)!.assessments.push(item);
        }
        setQuestionnaires(Array.from(byQ.values()));
      } catch {
        setQuestionnaires([]);
      } finally {
        setLoadingQuestionnaires(false);
      }
    })();
  }, []);

  const selectedQuestionnaire = useMemo(
    () => questionnaires.find((q) => q.questionnaireId === selectedQuestionnaireId),
    [questionnaires, selectedQuestionnaireId]
  );
  const representativeAssessmentId = selectedQuestionnaire?.assessments[0]?.assessmentId;

  // Load unmapped questions + system questions when questionnaire is selected
  useEffect(() => {
    if (!representativeAssessmentId) {
      setUnmappedQuestions([]);
      setSystemQuestions([]);
      setStats(null);
      setDrafts(new Map());
      return;
    }
    setLoading(true);
    setSaveResult(null);
    setActiveCategory("all");
    setSearchQuery("");

    Promise.all([
      detectUnmappedQuestions(representativeAssessmentId),
      getAssessmentQuestionnaire(representativeAssessmentId).catch(() => ({ data: null })),
    ])
      .then(([unmappedRes, questionnaireRes]) => {
        const data = unmappedRes.data;
        setStats({
          totalFirebase: data.totalFirebaseQuestions,
          totalMapped: data.totalMapped,
          totalUnmapped: data.totalUnmapped,
        });

        const unmapped: UnmappedQuestion[] = (data.unmappedQuestions || []).map((q: any) => ({
          question: q.question,
          category: q.category,
          answers: Array.isArray(q.answers) ? q.answers : Array.from(q.answers || []),
          studentCount: q.studentCount || 0,
          insightCount: q.insightCount || 0,
          subjectCount: q.subjectCount || 0,
          careerCount: q.careerCount || 0,
        }));
        setUnmappedQuestions(unmapped);

        // Parse questionnaire for system questions + options
        const qData = Array.isArray(questionnaireRes.data) ? questionnaireRes.data[0] : questionnaireRes.data;
        const sysQs: SystemQuestion[] = [];
        for (const sec of qData?.sections || qData?.questionnaireSections || []) {
          for (const qq of sec.questions || sec.questionnaireQuestions || []) {
            const question = qq.question;
            if (!question) continue;
            const qId = question.questionId ?? question.id;
            const qText = question.questionText || "";
            const options: SystemOption[] = (question.options || question.assessmentQuestionOptionsList || []).map((o: any) => ({
              optionId: o.optionId ?? o.id,
              optionText: o.optionText || "",
            }));
            sysQs.push({ questionId: qId, questionText: qText, options });
          }
        }
        setSystemQuestions(sysQs);

        // Initialize drafts
        const newDrafts = new Map<string, MappingDraft>();
        for (const uq of unmapped) {
          const key = `${uq.category}::${uq.question}`;
          newDrafts.set(key, {
            firebaseQuestion: uq.question,
            category: uq.category,
            systemQuestionId: null,
            answerMappings: uq.answers.map((a) => ({ firebaseAnswer: a, systemOptionId: null })),
          });
        }
        setDrafts(newDrafts);
      })
      .catch(() => {
        setUnmappedQuestions([]);
        setSystemQuestions([]);
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, [representativeAssessmentId]);

  // Categories in unmapped questions
  const categories = useMemo(() => {
    const cats = new Map<string, number>();
    for (const q of unmappedQuestions) {
      cats.set(q.category, (cats.get(q.category) || 0) + 1);
    }
    return cats;
  }, [unmappedQuestions]);

  // Filtered questions
  const filtered = useMemo(() => {
    return unmappedQuestions.filter((q) => {
      if (activeCategory !== "all" && q.category !== activeCategory) return false;
      if (searchQuery) {
        return q.question.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [unmappedQuestions, activeCategory, searchQuery]);

  // How many drafts have a system question mapped
  const mappedDraftCount = useMemo(() => {
    let count = 0;
    for (const d of drafts.values()) {
      if (d.systemQuestionId != null) count++;
    }
    return count;
  }, [drafts]);

  // System question search per unmapped question
  const [questionSearches, setQuestionSearches] = useState<Map<string, string>>(new Map());

  const getFilteredSystemQuestions = (key: string) => {
    const search = (questionSearches.get(key) || "").toLowerCase();
    if (!search) return systemQuestions.slice(0, 20);
    return systemQuestions.filter((q) => q.questionText.toLowerCase().includes(search));
  };

  const selectSystemQuestion = (key: string, sysQ: SystemQuestion) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      const draft = next.get(key);
      if (!draft) return prev;

      // Auto-match answers by text similarity
      const answerMappings = draft.answerMappings.map((am) => {
        const fbNorm = am.firebaseAnswer.toLowerCase().trim();
        const match = sysQ.options.find((o) => o.optionText.toLowerCase().trim() === fbNorm);
        return { ...am, systemOptionId: match ? match.optionId : null };
      });

      next.set(key, { ...draft, systemQuestionId: sysQ.questionId, answerMappings });
      return next;
    });
  };

  const selectOptionMapping = (key: string, firebaseAnswer: string, systemOptionId: number | null) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      const draft = next.get(key);
      if (!draft) return prev;
      const answerMappings = draft.answerMappings.map((am) =>
        am.firebaseAnswer === firebaseAnswer ? { ...am, systemOptionId } : am
      );
      next.set(key, { ...draft, answerMappings });
      return next;
    });
  };

  const clearMapping = (key: string) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      const draft = next.get(key);
      if (!draft) return prev;
      next.set(key, {
        ...draft,
        systemQuestionId: null,
        answerMappings: draft.answerMappings.map((am) => ({ ...am, systemOptionId: null })),
      });
      return next;
    });
  };

  // Save mapped drafts to ALL assessments using this questionnaire
  const handleSave = async () => {
    if (!selectedQuestionnaire || !representativeAssessmentId) return;
    setSaving(true);
    setSaveResult(null);

    try {
      // Build flat mappings from new drafts (only those with systemQuestionId)
      const newMappings: any[] = [];
      for (const draft of drafts.values()) {
        if (draft.systemQuestionId == null) continue;
        if (draft.answerMappings.length === 0) {
          newMappings.push({
            firebaseQuestion: draft.firebaseQuestion,
            category: draft.category,
            systemQuestionId: draft.systemQuestionId,
            firebaseAnswer: null,
            systemOptionId: null,
          });
        } else {
          for (const am of draft.answerMappings) {
            newMappings.push({
              firebaseQuestion: draft.firebaseQuestion,
              category: draft.category,
              systemQuestionId: draft.systemQuestionId,
              firebaseAnswer: am.firebaseAnswer,
              systemOptionId: am.systemOptionId,
            });
          }
        }
      }

      if (newMappings.length === 0) {
        setSaveResult("No mappings to save. Select system questions first.");
        setSaving(false);
        return;
      }

      // Save to ALL assessments using this questionnaire
      let savedCount = 0;
      for (const assessment of selectedQuestionnaire.assessments) {
        const existingRes = await getQuestionMappings(assessment.assessmentId);
        const existingRaw: any[] = existingRes.data || [];

        const combined = [...existingRaw.map((m: any) => ({
          firebaseQuestion: m.firebaseQuestion,
          category: m.category,
          systemQuestionId: m.systemQuestionId,
          firebaseAnswer: m.firebaseAnswer,
          systemOptionId: m.systemOptionId,
        })), ...newMappings];

        await saveQuestionMappings(assessment.assessmentId, combined);
        savedCount++;
      }

      const uniqueQuestions = new Set(newMappings.map((m) => `${m.category}::${m.firebaseQuestion}`));
      setSaveResult(`Saved ${uniqueQuestions.size} new question mappings across ${savedCount} assessments.`);

      // Remove saved questions from unmapped list
      setUnmappedQuestions((prev) => prev.filter((q) => !uniqueQuestions.has(`${q.category}::${q.question}`)));
      setStats((prev) => prev ? {
        ...prev,
        totalMapped: prev.totalMapped + uniqueQuestions.size,
        totalUnmapped: prev.totalUnmapped - uniqueQuestions.size,
      } : prev);

    } catch (err: any) {
      setSaveResult("Error: " + (err?.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  // Expanded state
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div className="container mt-8">
      <div className="row justify-content-center">
        <div className="col-12">
          {/* Header */}
          <div className="d-flex align-items-center mb-6">
            <button className="btn btn-light-primary btn-sm me-4" onClick={onBack}>
              <i className="bi bi-arrow-left me-1"></i> Back
            </button>
            <div>
              <h2 className="fw-bold text-dark mb-0">Detect & Map Unmapped Questions</h2>
              <p className="text-muted mb-0 fs-7">
                Find Firebase questions not yet mapped in an assessment and map them to system questions
              </p>
            </div>
          </div>

          {/* Questionnaire Selector */}
          <div className="card shadow-sm mb-6">
            <div className="card-body p-5">
              <label className="form-label fw-bold fs-6">Select Questionnaire</label>
              {loadingQuestionnaires ? (
                <div className="text-muted">Loading questionnaires...</div>
              ) : (
                <select
                  className="form-select form-select-solid"
                  value={selectedQuestionnaireId}
                  onChange={(e) => setSelectedQuestionnaireId(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="">-- Select a questionnaire --</option>
                  {questionnaires.map((q) => (
                    <option key={q.questionnaireId} value={q.questionnaireId}>
                      {q.questionnaireName} — {q.assessments[0]?.totalMappings || 0} existing mappings — {q.assessments.length} assessment{q.assessments.length !== 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              )}
              {selectedQuestionnaire && (
                <div className="mt-3 d-flex flex-wrap gap-2">
                  <span className="text-muted" style={{ fontSize: "0.82rem" }}>Will save to:</span>
                  {selectedQuestionnaire.assessments.map((a) => (
                    <span
                      key={a.assessmentId}
                      className="badge"
                      style={{ background: "rgba(67, 97, 238, 0.1)", color: "#4361ee", fontSize: "0.78rem", fontWeight: 500, padding: "4px 10px", borderRadius: "12px" }}
                    >
                      {a.assessmentName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="text-center py-10">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="mt-3 text-muted">Scanning Firebase data for unmapped questions...</p>
            </div>
          )}

          {/* Stats */}
          {!loading && stats && (
            <div className="card shadow-sm mb-5">
              <div className="card-body p-4">
                <div className="d-flex align-items-center gap-4 flex-wrap">
                  <div className="d-flex align-items-center gap-2">
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#6b7280" }}></div>
                    <span className="text-muted">{stats.totalFirebase} total Firebase questions</span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#059669" }}></div>
                    <span className="fw-semibold" style={{ color: "#059669" }}>{stats.totalMapped} already mapped</span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#dc2626" }}></div>
                    <span className="fw-semibold" style={{ color: "#dc2626" }}>{stats.totalUnmapped} unmapped</span>
                  </div>
                  <span className="text-muted">|</span>
                  <span className="fw-semibold" style={{ color: "#4361ee" }}>
                    {mappedDraftCount} selected to map
                  </span>

                  <button
                    className="btn btn-sm btn-success ms-auto"
                    disabled={mappedDraftCount === 0 || saving}
                    onClick={handleSave}
                  >
                    {saving ? (
                      <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                    ) : (
                      <><i className="bi bi-check2-circle me-1"></i>Save {mappedDraftCount} Mappings</>
                    )}
                  </button>
                </div>
                {saveResult && (
                  <div className={`alert mt-3 mb-0 py-2 ${saveResult.startsWith("Error") ? "alert-danger" : "alert-success"}`}>
                    {saveResult}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Category tabs + search */}
          {!loading && unmappedQuestions.length > 0 && (
            <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
              <button
                className={`btn btn-sm ${activeCategory === "all" ? "btn-dark" : "btn-light"}`}
                onClick={() => setActiveCategory("all")}
                style={{ borderRadius: "20px", padding: "6px 16px", fontWeight: 600, fontSize: "0.82rem" }}
              >
                All ({unmappedQuestions.length})
              </button>
              {Array.from(categories.entries()).map(([cat, count]) => (
                <button
                  key={cat}
                  className="btn btn-sm"
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    borderRadius: "20px",
                    padding: "6px 16px",
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    background: activeCategory === cat ? (CATEGORY_COLORS[cat] || "#6b7280") : "#f1f5f9",
                    color: activeCategory === cat ? "#fff" : "#374151",
                    border: "none",
                  }}
                >
                  {CATEGORY_LABELS[cat] || cat} ({count})
                </button>
              ))}
              <div className="ms-auto" style={{ maxWidth: "280px", flex: "1 0 200px" }}>
                <div className="position-relative">
                  <i className="bi bi-search position-absolute" style={{ left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}></i>
                  <input
                    className="form-control form-control-sm form-control-solid"
                    placeholder="Search unmapped questions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: 36, borderRadius: "20px" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Question cards */}
          {!loading && (
            <div className="d-flex flex-column gap-3">
              {filtered.map((uq) => {
                const key = `${uq.category}::${uq.question}`;
                const draft = drafts.get(key);
                const isExpanded = expanded.has(key);
                const isMapped = draft?.systemQuestionId != null;
                const selectedSysQ = isMapped ? systemQuestions.find((q) => q.questionId === draft!.systemQuestionId) : null;
                const catColor = CATEGORY_COLORS[uq.category] || "#6b7280";

                return (
                  <div
                    key={key}
                    className="card shadow-sm"
                    style={{
                      borderRadius: "10px",
                      borderLeft: `4px solid ${isMapped ? "#059669" : catColor}`,
                    }}
                  >
                    {/* Question header */}
                    <div
                      className="card-body p-3"
                      style={{ cursor: "pointer" }}
                      onClick={() => toggleExpand(key)}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <i className={`bi ${isExpanded ? "bi-chevron-down" : "bi-chevron-right"}`} style={{ color: "#9ca3af", flexShrink: 0 }}></i>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <span style={{
                              fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
                              letterSpacing: "0.5px", color: catColor,
                              background: `${catColor}15`, padding: "2px 8px", borderRadius: "4px",
                            }}>
                              {CATEGORY_LABELS[uq.category] || uq.category}
                            </span>
                            <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>
                              {uq.studentCount} total · {uq.answers.length} answer{uq.answers.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="d-flex gap-2" style={{ fontSize: "0.68rem" }}>
                            {uq.insightCount > 0 && (
                              <span style={{ padding: "1px 6px", borderRadius: "4px", background: "rgba(8, 145, 178, 0.1)", color: "#0891b2", fontWeight: 600 }}>
                                Insight (6-8): {uq.insightCount}
                              </span>
                            )}
                            {uq.subjectCount > 0 && (
                              <span style={{ padding: "1px 6px", borderRadius: "4px", background: "rgba(124, 58, 237, 0.1)", color: "#7c3aed", fontWeight: 600 }}>
                                Subject (9-10): {uq.subjectCount}
                              </span>
                            )}
                            {uq.careerCount > 0 && (
                              <span style={{ padding: "1px 6px", borderRadius: "4px", background: "rgba(245, 158, 11, 0.1)", color: "#d97706", fontWeight: 600 }}>
                                Career (11-12): {uq.careerCount}
                              </span>
                            )}
                          </div>
                          <p className="mb-0 fw-semibold text-dark" style={{ fontSize: "0.88rem" }}>
                            {uq.question}
                          </p>
                        </div>
                        {isMapped ? (
                          <span className="badge bg-success" style={{ fontSize: "0.75rem" }}>
                            <i className="bi bi-check2 me-1"></i>Mapped
                          </span>
                        ) : (
                          <span className="badge bg-light text-muted" style={{ fontSize: "0.75rem" }}>
                            Unmapped
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expanded: select system question + map answers */}
                    {isExpanded && (
                      <div style={{ borderTop: "1px solid #f3f4f6", background: "#fafbfc", padding: "16px" }}>
                        {/* System question selector */}
                        <div className="mb-3">
                          <label className="form-label fw-bold" style={{ fontSize: "0.82rem", color: "#374151" }}>
                            Map to System Question
                          </label>
                          {isMapped && selectedSysQ ? (
                            <div className="d-flex align-items-center gap-2">
                              <div style={{
                                flex: 1, padding: "8px 12px", background: "#f0fdf4",
                                borderRadius: "8px", border: "1px solid #bbf7d0",
                              }}>
                                <span style={{ fontSize: "0.7rem", color: "#059669", display: "block" }}>
                                  <i className="bi bi-check-circle-fill me-1"></i>Selected: ID {selectedSysQ.questionId}
                                </span>
                                <span className="text-dark" style={{ fontSize: "0.85rem" }}>{selectedSysQ.questionText}</span>
                              </div>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => clearMapping(key)}
                                style={{ borderRadius: "6px", padding: "4px 10px", fontSize: "0.78rem" }}
                              >
                                <i className="bi bi-x-lg"></i>
                              </button>
                            </div>
                          ) : (
                            <>
                              <input
                                className="form-control form-control-sm form-control-solid mb-2"
                                placeholder="Search system questions..."
                                value={questionSearches.get(key) || ""}
                                onChange={(e) => setQuestionSearches((prev) => new Map(prev).set(key, e.target.value))}
                                style={{ borderRadius: "8px" }}
                              />
                              <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                                {getFilteredSystemQuestions(key).map((sysQ) => (
                                  <div
                                    key={sysQ.questionId}
                                    onClick={() => selectSystemQuestion(key, sysQ)}
                                    style={{
                                      padding: "8px 12px", borderRadius: "6px", cursor: "pointer",
                                      border: "1px solid #e5e7eb", background: "#fff",
                                      fontSize: "0.82rem", transition: "all 0.15s",
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f9ff"; e.currentTarget.style.borderColor = "#4361ee"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#e5e7eb"; }}
                                  >
                                    <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>ID: {sysQ.questionId}</span>
                                    <span className="d-block text-dark">{sysQ.questionText}</span>
                                    <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{sysQ.options.length} options</span>
                                  </div>
                                ))}
                                {getFilteredSystemQuestions(key).length === 0 && (
                                  <div className="text-muted text-center py-2" style={{ fontSize: "0.82rem" }}>No matching questions</div>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Answer mappings (only when system question is selected) */}
                        {isMapped && selectedSysQ && draft && (
                          <div>
                            <label className="form-label fw-bold" style={{ fontSize: "0.82rem", color: "#374151" }}>
                              Answer Mappings
                            </label>
                            <div className="d-flex flex-column gap-2">
                              {draft.answerMappings.map((am, ai) => {
                                const matchedOpt = selectedSysQ.options.find((o) => o.optionId === am.systemOptionId);
                                return (
                                  <div key={ai} className="d-flex align-items-center gap-2" style={{ fontSize: "0.82rem" }}>
                                    <div style={{
                                      flex: 1, padding: "6px 10px", background: "#fff",
                                      borderRadius: "6px", border: "1px solid #e5e7eb",
                                    }}>
                                      <span style={{ fontSize: "0.68rem", color: "#6b7280", display: "block" }}>Firebase</span>
                                      {am.firebaseAnswer}
                                    </div>
                                    <i className="bi bi-arrow-right" style={{ color: "#d1d5db" }}></i>
                                    <select
                                      className="form-select form-select-sm form-select-solid"
                                      style={{ flex: 1, borderRadius: "6px", fontSize: "0.8rem" }}
                                      value={am.systemOptionId ?? ""}
                                      onChange={(e) => selectOptionMapping(key, am.firebaseAnswer, e.target.value ? Number(e.target.value) : null)}
                                    >
                                      <option value="">-- Select option --</option>
                                      {selectedSysQ.options.map((o) => (
                                        <option key={o.optionId} value={o.optionId}>
                                          {o.optionText}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* No unmapped */}
          {!loading && selectedQuestionnaireId && unmappedQuestions.length === 0 && stats && (
            <div className="text-center py-10">
              <i className="bi bi-check-circle fs-1 d-block mb-3" style={{ color: "#059669", opacity: 0.5 }}></i>
              <h5 className="text-muted">All Firebase questions are mapped for this assessment!</h5>
              <p className="text-muted">{stats.totalMapped} questions mapped</p>
            </div>
          )}

          {/* No questionnaire selected */}
          {!loading && !selectedQuestionnaireId && (
            <div className="text-center py-10 text-muted">
              <i className="bi bi-hand-index-thumb fs-1 d-block mb-3" style={{ opacity: 0.3 }}></i>
              Select a questionnaire above to scan for unmapped questions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
