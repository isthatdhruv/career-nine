import { useEffect, useState, useMemo } from "react";
import {
  getAllAssessments,
  getAllAssessmentQuestions,
  getQuestionMappings,
  saveQuestionMappings,
  deleteQuestionMappings,
  findAssessmentsBySameQuestionnaire,
} from "./API/OldDataMapping_APIs";

interface SystemOption {
  optionId: number;
  optionText: string;
}

interface SystemQuestion {
  questionId: number;
  questionText: string;
  options?: SystemOption[];
}

interface SavedMapping {
  id: number;
  assessmentId: number;
  firebaseQuestion: string;
  category: string;
  systemQuestionId: number | null;
  firebaseAnswer: string;
  systemOptionId: number | null;
}

interface GroupedMapping {
  firebaseQuestion: string;
  category: string;
  systemQuestionId: number | null;
  systemQuestionText: string;
  answerMappings: {
    firebaseAnswer: string;
    systemOptionId: number | null;
    systemOptionText: string;
  }[];
}

interface Props {
  onBack: () => void;
}

const categoryLabels: Record<string, string> = {
  ability: "Ability",
  multipleIntelligence: "Multiple Intelligence",
  personality: "Personality",
};

const ExistingMappingView = ({ onBack }: Props) => {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [systemQuestions, setSystemQuestions] = useState<SystemQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);
  const [mappings, setMappings] = useState<GroupedMapping[]>([]);
  const [mappingsLoading, setMappingsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("ability");

  // Edit state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Search per question
  const [questionSearches, setQuestionSearches] = useState<Record<string, string>>({});

  // Copy to similar assessments
  const [similarAssessments, setSimilarAssessments] = useState<{id: number; assessmentName: string}[]>([]);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<Set<number>>(new Set());
  const [copying, setCopying] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([getAllAssessments(), getAllAssessmentQuestions()])
      .then(([assessRes, questionsRes]) => {
        setAssessments(assessRes.data || []);
        setSystemQuestions(questionsRes.data || []);
      })
      .catch(() => setError("Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  const loadMappings = (assessmentId: number) => {
    setMappingsLoading(true);
    setMappings([]);
    setSaveMsg("");
    getQuestionMappings(assessmentId)
      .then((res) => {
        const saved: SavedMapping[] = res.data || [];
        if (saved.length === 0) {
          setMappings([]);
          return;
        }

        // Group by firebaseQuestion + category
        const groupMap = new Map<string, GroupedMapping>();
        saved.forEach((s) => {
          const key = `${s.category}::${s.firebaseQuestion}`;
          if (!groupMap.has(key)) {
            const sq = systemQuestions.find((q) => q.questionId === s.systemQuestionId);
            groupMap.set(key, {
              firebaseQuestion: s.firebaseQuestion,
              category: s.category,
              systemQuestionId: s.systemQuestionId,
              systemQuestionText: sq?.questionText || "",
              answerMappings: [],
            });
          }
          const opt = s.systemOptionId
            ? systemQuestions
                .find((q) => q.questionId === s.systemQuestionId)
                ?.options?.find((o) => o.optionId === s.systemOptionId)
            : null;
          groupMap.get(key)!.answerMappings.push({
            firebaseAnswer: s.firebaseAnswer,
            systemOptionId: s.systemOptionId,
            systemOptionText: opt?.optionText || "",
          });
        });

        const grouped = Array.from(groupMap.values());
        setMappings(grouped);
        if (grouped.length > 0) {
          const cats = ["ability", "multipleIntelligence", "personality"];
          setActiveCategory(cats.find((c) => grouped.some((m) => m.category === c)) || "ability");
        }
      })
      .catch(() => setError("Failed to load mappings"))
      .finally(() => setMappingsLoading(false));
  };

  const handleSelectAssessment = (id: number) => {
    setSelectedAssessmentId(id);
    setEditing(false);
    setSimilarAssessments([]);
    setCopyMsg("");
    loadMappings(id);
    findAssessmentsBySameQuestionnaire(id)
      .then((res) => setSimilarAssessments(res.data || []))
      .catch(() => {});
  };

  const handleOpenCopyModal = () => {
    setSelectedTargets(new Set(similarAssessments.map((a) => a.id)));
    setCopyMsg("");
    setShowCopyModal(true);
  };

  const handleCopyToSimilar = async () => {
    if (!selectedAssessmentId || selectedTargets.size === 0) return;
    setCopying(true);
    setCopyMsg("");
    // Build raw mappings from grouped mappings
    const rawMappings = mappings.flatMap((m) =>
      m.answerMappings.map((am) => ({
        firebaseQuestion: m.firebaseQuestion,
        category: m.category,
        systemQuestionId: m.systemQuestionId,
        firebaseAnswer: am.firebaseAnswer,
        systemOptionId: am.systemOptionId,
      }))
    );
    let successCount = 0;
    let failCount = 0;
    for (const targetId of Array.from(selectedTargets)) {
      try {
        await saveQuestionMappings(targetId, rawMappings);
        successCount++;
      } catch {
        failCount++;
      }
    }
    setCopying(false);
    setCopyMsg(
      failCount === 0
        ? `Mappings copied to ${successCount} assessment(s) successfully.`
        : `Copied to ${successCount}, failed for ${failCount}.`
    );
    setTimeout(() => setShowCopyModal(false), 1500);
  };

  const filteredMappings = useMemo(() => {
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

  // Edit handlers
  const handleChangeQuestion = (idx: number, sq: SystemQuestion) => {
    setMappings((prev) => {
      const catMappings = prev.filter((m) => m.category === activeCategory);
      const otherMappings = prev.filter((m) => m.category !== activeCategory);
      const updated = [...catMappings];
      updated[idx] = {
        ...updated[idx],
        systemQuestionId: sq.questionId,
        systemQuestionText: sq.questionText,
        answerMappings: updated[idx].answerMappings.map((am) => {
          // Try auto-match option
          const matched = sq.options?.find(
            (o) => o.optionText.toLowerCase().trim() === am.firebaseAnswer.toLowerCase().trim()
          );
          return matched
            ? { ...am, systemOptionId: matched.optionId, systemOptionText: matched.optionText }
            : { ...am, systemOptionId: null, systemOptionText: "" };
        }),
      };
      return [...otherMappings, ...updated];
    });
  };

  const handleChangeOption = (qIdx: number, aIdx: number, opt: SystemOption) => {
    setMappings((prev) => {
      const catMappings = prev.filter((m) => m.category === activeCategory);
      const otherMappings = prev.filter((m) => m.category !== activeCategory);
      const updated = [...catMappings];
      const newAm = [...updated[qIdx].answerMappings];
      newAm[aIdx] = { ...newAm[aIdx], systemOptionId: opt.optionId, systemOptionText: opt.optionText };
      updated[qIdx] = { ...updated[qIdx], answerMappings: newAm };
      return [...otherMappings, ...updated];
    });
  };

  const handleSave = async () => {
    if (!selectedAssessmentId) return;
    setSaving(true);
    setSaveMsg("");

    const dbMappings: any[] = [];
    mappings.forEach((m) => {
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
      await saveQuestionMappings(selectedAssessmentId, dbMappings);
      setSaveMsg(`Saved ${dbMappings.length} mappings successfully.`);
      setEditing(false);
    } catch (err) {
      setSaveMsg("Failed to save mappings.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!selectedAssessmentId) return;
    if (!window.confirm("Delete all mappings for this assessment? This cannot be undone.")) return;
    try {
      await deleteQuestionMappings(selectedAssessmentId);
      setMappings([]);
      setSaveMsg("All mappings deleted.");
    } catch {
      setSaveMsg("Failed to delete mappings.");
    }
  };

  const getFilteredSystemQuestions = (searchKey: string): SystemQuestion[] => {
    const term = (questionSearches[searchKey] || "").toLowerCase().trim();
    if (!term) return systemQuestions;
    return systemQuestions.filter((q) =>
      (q.questionText || "").toLowerCase().includes(term)
    );
  };

  if (loading) {
    return (
      <div className="container mt-8 text-center py-10">
        <span className="spinner-border spinner-border-sm me-2" />
        Loading...
      </div>
    );
  }

  return (
    <>
    <div className="container mt-8">
      <div className="row justify-content-center">
        <div className="col-12">
          <div className="d-flex align-items-center mb-6">
            <button className="btn btn-light-primary btn-sm me-4" onClick={onBack}>
              <i className="bi bi-arrow-left me-1"></i> Back
            </button>
            <h2 className="fw-bold text-dark mb-0">Existing Question Mappings</h2>
          </div>

          {error && <div className="alert alert-danger py-2 mb-4">{error}</div>}

          {/* Assessment selector */}
          <div className="card shadow-sm mb-4">
            <div className="card-body p-4">
              <label className="form-label fw-semibold">Select Assessment</label>
              <select
                className="form-select"
                value={selectedAssessmentId ?? ""}
                onChange={(e) => e.target.value && handleSelectAssessment(Number(e.target.value))}
              >
                <option value="">-- Select Assessment --</option>
                {assessments.map((a: any) => (
                  <option key={a.id ?? a.assessmentId} value={a.id ?? a.assessmentId}>
                    {a.AssessmentName ?? a.assessmentName} (ID: {a.id ?? a.assessmentId})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mappings */}
          {selectedAssessmentId && (
            <>
              {mappingsLoading ? (
                <div className="text-center py-6">
                  <span className="spinner-border spinner-border-sm me-2" />
                  Loading mappings...
                </div>
              ) : mappings.length === 0 ? (
                <div className="alert alert-info py-3">
                  <i className="bi bi-info-circle me-2"></i>
                  No saved mappings found for this assessment.
                </div>
              ) : (
                <>
                  {saveMsg && (
                    <div className="alert alert-info py-2 mb-3">{saveMsg}</div>
                  )}

                  {/* Action bar */}
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <span className="fw-semibold text-muted fs-7">
                      {mappings.length} questions mapped
                    </span>
                    <div className="ms-auto d-flex gap-2">
                      {similarAssessments.length > 0 && !editing && (
                        <button className="btn btn-sm btn-light-success" onClick={handleOpenCopyModal}>
                          <i className="bi bi-files me-1"></i>Copy to Similar ({similarAssessments.length})
                        </button>
                      )}
                      {!editing ? (
                        <button className="btn btn-sm btn-light-primary" onClick={() => setEditing(true)}>
                          <i className="bi bi-pencil me-1"></i>Edit Mappings
                        </button>
                      ) : (
                        <>
                          <button className="btn btn-sm btn-light" onClick={() => { setEditing(false); loadMappings(selectedAssessmentId); }}>
                            Cancel
                          </button>
                          <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</> : <><i className="bi bi-check me-1"></i>Save Changes</>}
                          </button>
                        </>
                      )}
                      <button className="btn btn-sm btn-light-danger" onClick={handleDeleteAll}>
                        <i className="bi bi-trash me-1"></i>Delete All
                      </button>
                    </div>
                  </div>

                  {/* Category tabs */}
                  <div className="d-flex gap-2 mb-3">
                    {Object.entries(categoryLabels).map(([key, label]) => {
                      const counts = categoryCounts[key];
                      if (!counts) return null;
                      return (
                        <button
                          key={key}
                          className={`btn btn-sm ${activeCategory === key ? "btn-primary" : "btn-light"}`}
                          onClick={() => setActiveCategory(key)}
                        >
                          {label}
                          <span className={`badge ms-2 ${activeCategory === key ? "badge-light" : "badge-light-primary"} fs-9`}>
                            {counts.mapped}/{counts.total}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Mapping table */}
                  <div className="card shadow-sm">
                    <div className="card-body p-0">
                      <div style={{ maxHeight: 600, overflowY: "auto" }}>
                        {filteredMappings.map((mapping, idx) => {
                          const mappedSysQuestion = mapping.systemQuestionId
                            ? systemQuestions.find((q) => q.questionId === mapping.systemQuestionId)
                            : null;
                          const searchKey = `${activeCategory}-${idx}`;

                          return (
                            <div key={idx} className="border-bottom p-4">
                              <div className="row g-3">
                                {/* Firebase side */}
                                <div className="col-md-5">
                                  <div className="fs-9 fw-semibold text-muted mb-1">FIREBASE QUESTION</div>
                                  <div className="bg-light rounded p-3 mb-2 fs-7">
                                    {mapping.firebaseQuestion}
                                  </div>
                                  <div className="fs-9 fw-semibold text-muted mb-1">ANSWERS</div>
                                  <div className="d-flex flex-wrap gap-1">
                                    {mapping.answerMappings.map((am, ai) => (
                                      <span
                                        key={ai}
                                        className={`badge ${am.systemOptionId ? "badge-light-success" : "badge-light-warning"} fs-9`}
                                      >
                                        {am.firebaseAnswer}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div className="col-md-1 d-flex align-items-center justify-content-center">
                                  <i className={`bi bi-arrow-right fs-4 ${mapping.systemQuestionId ? "text-success" : "text-muted"}`}></i>
                                </div>

                                {/* System side */}
                                <div className="col-md-6">
                                  {mapping.systemQuestionId && !editing ? (
                                    <div>
                                      <div className="fs-9 fw-semibold text-success mb-1">
                                        <i className="bi bi-check-circle me-1"></i>SYSTEM QUESTION
                                      </div>
                                      <div className="bg-light-success rounded p-3 mb-2 fs-7">
                                        {mapping.systemQuestionText || `Question #${mapping.systemQuestionId}`}
                                      </div>
                                      <div className="d-flex flex-wrap gap-1">
                                        {mapping.answerMappings.map((am, ai) => (
                                          <div key={ai} className="d-flex align-items-center gap-1 me-3 mb-1">
                                            <span className="badge badge-light-warning fs-9">{am.firebaseAnswer}</span>
                                            <i className="bi bi-arrow-right text-muted fs-9"></i>
                                            <span className={`badge ${am.systemOptionId ? "badge-light-success" : "badge-light-danger"} fs-9`}>
                                              {am.systemOptionText || (am.systemOptionId ? `Option #${am.systemOptionId}` : "Unmapped")}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : editing ? (
                                    <div>
                                      <div className="fs-9 fw-semibold text-muted mb-1">
                                        <i className="bi bi-search me-1"></i>SYSTEM QUESTION {mapping.systemQuestionText && `(${mapping.systemQuestionText.slice(0, 30)}...)`}
                                      </div>
                                      <input
                                        type="text"
                                        className="form-control form-control-sm mb-2"
                                        placeholder="Search questions..."
                                        value={questionSearches[searchKey] || ""}
                                        onChange={(e) => setQuestionSearches((prev) => ({ ...prev, [searchKey]: e.target.value }))}
                                      />
                                      {(() => {
                                        const filtered = getFilteredSystemQuestions(searchKey);
                                        return (
                                          <div className="border rounded mb-2" style={{ maxHeight: 150, overflowY: "auto" }}>
                                            {filtered.slice(0, 30).map((sq) => (
                                              <div
                                                key={sq.questionId}
                                                className={`px-3 py-1 border-bottom fs-8 d-flex align-items-center justify-content-between ${mapping.systemQuestionId === sq.questionId ? "bg-light-success" : ""}`}
                                                style={{ cursor: "pointer" }}
                                                onClick={() => handleChangeQuestion(idx, sq)}
                                                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = mapping.systemQuestionId === sq.questionId ? "" : "#f5f8fa")}
                                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = mapping.systemQuestionId === sq.questionId ? "" : "transparent")}
                                              >
                                                <span className="text-truncate" style={{ maxWidth: "85%" }}>{sq.questionText}</span>
                                                <span className="badge badge-light fs-9">#{sq.questionId}</span>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      })()}
                                      {mappedSysQuestion && (
                                        <div>
                                          <div className="fs-9 fw-semibold text-muted mb-1">MAP ANSWERS</div>
                                          {mapping.answerMappings.map((am, ai) => (
                                            <div key={ai} className="d-flex align-items-center gap-2 mb-1">
                                              <span className="badge badge-light-warning fs-9 px-2" style={{ minWidth: 60 }}>{am.firebaseAnswer}</span>
                                              <i className="bi bi-arrow-right text-muted fs-9"></i>
                                              <div className="d-flex flex-wrap gap-1">
                                                {mappedSysQuestion.options?.map((opt) => (
                                                  <button
                                                    key={opt.optionId}
                                                    className={`btn btn-sm px-2 py-0 ${am.systemOptionId === opt.optionId ? "btn-success" : "btn-outline-secondary"}`}
                                                    onClick={() => handleChangeOption(idx, ai, opt)}
                                                    style={{ fontSize: "0.7rem" }}
                                                  >
                                                    {opt.optionText}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-muted fs-8">Not mapped</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>

    {/* Copy to Similar Assessments Modal */}
    {showCopyModal && (
      <div className="modal d-block" style={{ background: "rgba(0,0,0,0.4)" }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Copy Mappings to Similar Assessments</h5>
              <button className="btn-close" onClick={() => setShowCopyModal(false)} />
            </div>
            <div className="modal-body">
              <p className="text-muted fs-7 mb-3">
                These assessments use the same questionnaire. Select which ones to copy the current mappings to:
              </p>
              {similarAssessments.map((a) => (
                <div key={a.id} className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`target-${a.id}`}
                    checked={selectedTargets.has(a.id)}
                    onChange={(e) => {
                      setSelectedTargets((prev) => {
                        const next = new Set(prev);
                        e.target.checked ? next.add(a.id) : next.delete(a.id);
                        return next;
                      });
                    }}
                  />
                  <label className="form-check-label" htmlFor={`target-${a.id}`}>
                    {a.assessmentName} <span className="text-muted">(ID: {a.id})</span>
                  </label>
                </div>
              ))}
              {copyMsg && (
                <div className={`alert ${copyMsg.includes("failed") ? "alert-warning" : "alert-success"} py-2 mt-3`}>
                  {copyMsg}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-light" onClick={() => setShowCopyModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleCopyToSimilar}
                disabled={copying || selectedTargets.size === 0}
              >
                {copying ? <><span className="spinner-border spinner-border-sm me-1" />Copying...</> : `Copy to ${selectedTargets.size} Assessment(s)`}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default ExistingMappingView;
