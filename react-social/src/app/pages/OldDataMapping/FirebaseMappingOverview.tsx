import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  getAllMappedAssessments,
  getQuestionMappings,
  getAssessmentQuestionnaire,
} from "./API/OldDataMapping_APIs";

type AnswerMapping = {
  firebaseAnswer: string;
  systemOptionId: number | null;
  systemOptionText: string;
};

type MappingRow = {
  firebaseQuestion: string;
  category: string;
  systemQuestionId: number | null;
  systemQuestionText: string;
  answerMappings: AnswerMapping[];
};

type AssessmentSummary = {
  assessmentId: number;
  assessmentName: string;
  totalMappings: number;
  mappedAt: string;
};

type QuestionnaireInfo = {
  questionnaireId: number;
  questionnaireName: string;
  assessments: AssessmentSummary[];
};

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

export default function FirebaseMappingOverview({ onBack }: { onBack: () => void }) {
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireInfo[]>([]);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<number | "">("");
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingQuestionnaires, setLoadingQuestionnaires] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  // Load assessments and group by questionnaire
  useEffect(() => {
    (async () => {
      try {
        const res = await getAllMappedAssessments();
        const assessments: AssessmentSummary[] = res.data || [];

        // For each assessment, fetch its questionnaire info
        const withQuestionnaire = await Promise.all(
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

        // Group by questionnaire
        const byQ = new Map<number, QuestionnaireInfo>();
        for (const item of withQuestionnaire) {
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

  // Get the representative assessment ID for the selected questionnaire
  const selectedQuestionnaire = useMemo(
    () => questionnaires.find((q) => q.questionnaireId === selectedQuestionnaireId),
    [questionnaires, selectedQuestionnaireId]
  );
  const representativeAssessmentId = selectedQuestionnaire?.assessments[0]?.assessmentId;

  useEffect(() => {
    if (!representativeAssessmentId) {
      setMappings([]);
      return;
    }
    setLoading(true);
    setActiveCategory("all");
    setSearchQuery("");
    setExpandedQuestions(new Set());

    Promise.all([
      getQuestionMappings(representativeAssessmentId),
      getAssessmentQuestionnaire(representativeAssessmentId).catch(() => ({ data: null })),
    ])
      .then(([mappingsRes, questionnaireRes]) => {
        // Group raw mappings by firebaseQuestion
        const raw: any[] = mappingsRes.data || [];
        const grouped = new Map<string, MappingRow>();
        for (const m of raw) {
          const key = (m.firebaseQuestion || "").trim();
          if (!key) continue;
          if (!grouped.has(key)) {
            grouped.set(key, {
              firebaseQuestion: key,
              category: m.category || "unknown",
              systemQuestionId: m.systemQuestionId,
              systemQuestionText: "",
              answerMappings: [],
            });
          }
          const row = grouped.get(key)!;
          if (m.firebaseAnswer) {
            row.answerMappings.push({
              firebaseAnswer: m.firebaseAnswer,
              systemOptionId: m.systemOptionId,
              systemOptionText: "",
            });
          }
        }

        // Build question ID -> text and option ID -> text lookup from questionnaire
        const qMap = new Map<number, string>();
        const oMap = new Map<number, string>();

        const qData = Array.isArray(questionnaireRes.data) ? questionnaireRes.data[0] : questionnaireRes.data;
        for (const sec of qData?.sections || qData?.questionnaireSections || []) {
          for (const qq of sec.questions || sec.questionnaireQuestions || []) {
            const question = qq.question;
            if (!question) continue;
            const qId = question.questionId ?? question.id;
            const qText = question.questionText || "";
            if (qId != null) qMap.set(qId, qText);
            for (const opt of question.options || question.assessmentQuestionOptionsList || []) {
              const oId = opt.optionId ?? opt.id;
              if (oId != null) oMap.set(oId, opt.optionText || "");
            }
          }
        }

        // Fill in system question/option texts
        for (const row of grouped.values()) {
          if (row.systemQuestionId != null) {
            row.systemQuestionText = qMap.get(row.systemQuestionId) || `Question #${row.systemQuestionId}`;
          }
          for (const am of row.answerMappings) {
            if (am.systemOptionId != null) {
              am.systemOptionText = oMap.get(am.systemOptionId) || `Option #${am.systemOptionId}`;
            }
          }
        }

        setMappings(Array.from(grouped.values()));
      })
      .catch(() => {
        setMappings([]);
      })
      .finally(() => setLoading(false));
  }, [representativeAssessmentId]);

  // Categories present in the data
  const categories = useMemo(() => {
    const cats = new Map<string, number>();
    for (const m of mappings) {
      cats.set(m.category, (cats.get(m.category) || 0) + 1);
    }
    return cats;
  }, [mappings]);

  // Filtered mappings
  const filteredMappings = useMemo(() => {
    return mappings.filter((m) => {
      if (activeCategory !== "all" && m.category !== activeCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          m.firebaseQuestion.toLowerCase().includes(q) ||
          m.systemQuestionText.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [mappings, activeCategory, searchQuery]);

  // Stats
  const totalMapped = mappings.filter((m) => m.systemQuestionId != null).length;
  const totalUnmapped = mappings.filter((m) => m.systemQuestionId == null).length;

  const toggleExpand = (key: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedQuestions(new Set(filteredMappings.map((m) => m.firebaseQuestion)));
  };
  const collapseAll = () => setExpandedQuestions(new Set());

  const handleDownloadExcel = () => {
    if (mappings.length === 0 || !selectedQuestionnaire) return;

    const rows: Record<string, any>[] = [];
    for (const m of mappings) {
      if (m.answerMappings.length === 0) {
        // Question with no answer mappings — single row
        rows.push({
          "Category": CATEGORY_LABELS[m.category] || m.category,
          "Firebase Question": m.firebaseQuestion,
          "System Question": m.systemQuestionId != null ? m.systemQuestionText : "NOT MAPPED",
          "Firebase Answer": "",
          "System Option": "",
        });
      } else {
        for (const am of m.answerMappings) {
          rows.push({
            "Category": CATEGORY_LABELS[m.category] || m.category,
            "Firebase Question": m.firebaseQuestion,
            "System Question": m.systemQuestionId != null ? m.systemQuestionText : "NOT MAPPED",
            "Firebase Answer": am.firebaseAnswer,
            "System Option": am.systemOptionId != null ? am.systemOptionText : "NOT MAPPED",
          });
        }
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 22 },  // Category
      { wch: 60 },  // Firebase Question
      { wch: 60 },  // System Question
      { wch: 50 },  // Firebase Answer
      { wch: 50 },  // System Option
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Question Mappings");
    const fileName = `${selectedQuestionnaire.questionnaireName.replace(/\s+/g, "_")}_Mapping_Overview.xlsx`;
    XLSX.writeFile(wb, fileName);
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
              <h2 className="fw-bold text-dark mb-0">Firebase Question Mapping Overview</h2>
              <p className="text-muted mb-0 fs-7">
                View all Firebase questions and their mapped system questions, grouped by questionnaire
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
                  onChange={(e) =>
                    setSelectedQuestionnaireId(e.target.value === "" ? "" : Number(e.target.value))
                  }
                >
                  <option value="">-- Select a questionnaire --</option>
                  {questionnaires.map((q) => (
                    <option key={q.questionnaireId} value={q.questionnaireId}>
                      {q.questionnaireName} — {q.assessments[0]?.totalMappings || 0} question mappings — used in {q.assessments.length} assessment{q.assessments.length !== 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              )}
              {selectedQuestionnaire && (
                <div className="mt-3 d-flex flex-wrap gap-2">
                  <span className="text-muted" style={{ fontSize: "0.82rem" }}>Used in:</span>
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
              <p className="mt-3 text-muted">Loading mappings...</p>
            </div>
          )}

          {/* Content */}
          {!loading && selectedQuestionnaireId && mappings.length > 0 && (
            <>
              {/* Stats Bar */}
              <div className="card shadow-sm mb-5">
                <div className="card-body p-4">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div className="d-flex gap-4">
                      <div className="d-flex align-items-center gap-2">
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#059669" }}></div>
                        <span className="fw-semibold text-dark">{totalMapped} Mapped</span>
                      </div>
                      {totalUnmapped > 0 && (
                        <div className="d-flex align-items-center gap-2">
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#dc2626" }}></div>
                          <span className="fw-semibold text-danger">{totalUnmapped} Unmapped</span>
                        </div>
                      )}
                      <span className="text-muted">|</span>
                      <span className="text-muted">{mappings.length} unique questions</span>
                    </div>
                    <div className="d-flex gap-2">
                      <button className="btn btn-sm btn-light-primary" onClick={expandAll}>
                        <i className="bi bi-arrows-expand me-1"></i>Expand All
                      </button>
                      <button className="btn btn-sm btn-light-secondary" onClick={collapseAll}>
                        <i className="bi bi-arrows-collapse me-1"></i>Collapse All
                      </button>
                      <button className="btn btn-sm btn-light-success" onClick={handleDownloadExcel}>
                        <i className="bi bi-file-earmark-spreadsheet me-1"></i>Download Excel
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category Tabs + Search */}
              <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
                <button
                  className={`btn btn-sm ${activeCategory === "all" ? "btn-dark" : "btn-light"}`}
                  onClick={() => setActiveCategory("all")}
                  style={{ borderRadius: "20px", padding: "6px 16px", fontWeight: 600, fontSize: "0.82rem" }}
                >
                  All ({mappings.length})
                </button>
                {Array.from(categories.entries()).map(([cat, count]) => (
                  <button
                    key={cat}
                    className={`btn btn-sm ${activeCategory === cat ? "" : "btn-light"}`}
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      borderRadius: "20px",
                      padding: "6px 16px",
                      fontWeight: 600,
                      fontSize: "0.82rem",
                      background: activeCategory === cat ? (CATEGORY_COLORS[cat] || "#6b7280") : undefined,
                      color: activeCategory === cat ? "#fff" : undefined,
                      border: activeCategory === cat ? "none" : undefined,
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
                      placeholder="Search questions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ paddingLeft: 36, borderRadius: "20px" }}
                    />
                  </div>
                </div>
              </div>

              {/* Mapping Cards */}
              <div className="d-flex flex-column gap-3">
                {filteredMappings.map((m, idx) => {
                  const isExpanded = expandedQuestions.has(m.firebaseQuestion);
                  const isMapped = m.systemQuestionId != null;
                  const catColor = CATEGORY_COLORS[m.category] || "#6b7280";

                  return (
                    <div
                      key={m.firebaseQuestion + idx}
                      className="card shadow-sm"
                      style={{
                        borderRadius: "10px",
                        borderLeft: `4px solid ${isMapped ? catColor : "#dc2626"}`,
                        overflow: "hidden",
                      }}
                    >
                      {/* Question header — clickable to expand */}
                      <div
                        className="card-body p-0"
                        style={{ cursor: "pointer" }}
                        onClick={() => toggleExpand(m.firebaseQuestion)}
                      >
                        <div className="d-flex align-items-center gap-3 p-3">
                          <i
                            className={`bi ${isExpanded ? "bi-chevron-down" : "bi-chevron-right"}`}
                            style={{ color: "#9ca3af", fontSize: "0.85rem", flexShrink: 0 }}
                          ></i>

                          {/* Firebase question */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.5px",
                                  color: catColor,
                                  background: `${catColor}15`,
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  flexShrink: 0,
                                }}
                              >
                                {CATEGORY_LABELS[m.category] || m.category}
                              </span>
                              <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>Firebase</span>
                            </div>
                            <p className="mb-0 fw-semibold text-dark" style={{ fontSize: "0.88rem" }}>
                              {m.firebaseQuestion}
                            </p>
                          </div>

                          {/* Arrow */}
                          <i className="bi bi-arrow-right" style={{ color: "#d1d5db", fontSize: "1.1rem", flexShrink: 0 }}></i>

                          {/* System question */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="mb-1">
                              <span style={{ fontSize: "0.7rem", color: isMapped ? "#059669" : "#dc2626" }}>
                                <i className={`bi ${isMapped ? "bi-check-circle-fill" : "bi-x-circle-fill"} me-1`}></i>
                                {isMapped ? "System Question" : "Not Mapped"}
                              </span>
                            </div>
                            <p className="mb-0" style={{ fontSize: "0.88rem", color: isMapped ? "#1f2937" : "#9ca3af" }}>
                              {isMapped ? m.systemQuestionText : "—"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Expanded: answer mappings */}
                      {isExpanded && m.answerMappings.length > 0 && (
                        <div style={{ borderTop: "1px solid #f3f4f6", background: "#fafbfc", padding: "12px 16px 12px 44px" }}>
                          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.5px" }}>
                            Answer Mappings ({m.answerMappings.length})
                          </div>
                          <div className="d-flex flex-column gap-2">
                            {m.answerMappings.map((am, ai) => (
                              <div
                                key={ai}
                                className="d-flex align-items-center gap-3"
                                style={{ fontSize: "0.82rem" }}
                              >
                                <div style={{ flex: 1, padding: "6px 10px", background: "#fff", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
                                  <span style={{ color: "#6b7280", fontSize: "0.68rem", display: "block" }}>Firebase Answer</span>
                                  <span className="text-dark">{am.firebaseAnswer}</span>
                                </div>
                                <i className="bi bi-arrow-right" style={{ color: "#d1d5db", flexShrink: 0 }}></i>
                                <div style={{ flex: 1, padding: "6px 10px", background: am.systemOptionId ? "#f0fdf4" : "#fef2f2", borderRadius: "6px", border: `1px solid ${am.systemOptionId ? "#bbf7d0" : "#fecaca"}` }}>
                                  <span style={{ color: am.systemOptionId ? "#059669" : "#dc2626", fontSize: "0.68rem", display: "block" }}>
                                    {am.systemOptionId ? "System Option" : "Not Mapped"}
                                  </span>
                                  <span style={{ color: am.systemOptionId ? "#1f2937" : "#9ca3af" }}>
                                    {am.systemOptionText || "—"}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {filteredMappings.length === 0 && (
                <div className="text-center py-10 text-muted">
                  <i className="bi bi-search fs-1 d-block mb-3" style={{ opacity: 0.3 }}></i>
                  No questions match your search or filter.
                </div>
              )}
            </>
          )}

          {/* No questionnaire selected */}
          {!loading && !selectedQuestionnaireId && (
            <div className="text-center py-10 text-muted">
              <i className="bi bi-hand-index-thumb fs-1 d-block mb-3" style={{ opacity: 0.3 }}></i>
              Select a questionnaire above to view its question mappings.
            </div>
          )}

          {/* Questionnaire selected but no mappings */}
          {!loading && selectedQuestionnaireId && mappings.length === 0 && (
            <div className="text-center py-10 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-3" style={{ opacity: 0.3 }}></i>
              No mappings found for this assessment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
