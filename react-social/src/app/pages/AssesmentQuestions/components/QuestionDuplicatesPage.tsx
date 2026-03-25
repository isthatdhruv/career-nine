import React, { useEffect, useState, useMemo } from "react";
import { ReadQuestionsData, DeleteQuestionData } from "../API/Question_APIs";

interface OptionScore {
  scoreId: number;
  score: number;
  measuredQualityType: {
    measured_quality_type_id: number;
    measured_quality_type_name: string;
    measured_quality_type_description: string;
    measured_quality_type_display_name: string;
  };
}

interface QuestionOption {
  optionId: number;
  optionText: string;
  optionDescription: string;
  isCorrect: boolean;
  optionScores: OptionScore[];
}

interface Question {
  questionId: number;
  questionText: string;
  section: { sectionId: number; sectionName: string } | null;
  options: QuestionOption[];
}

type SimilarityGroup = {
  questions: Question[];
  maxSimilarity: number;
};

// --- Trigram-based similarity (Sørensen–Dice coefficient) ---
function trigrams(s: string): Set<string> {
  const normalized = s.toLowerCase().replace(/\s+/g, " ").trim();
  const t = new Set<string>();
  for (let i = 0; i <= normalized.length - 3; i++) {
    t.add(normalized.substring(i, i + 3));
  }
  return t;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  ta.forEach((t) => {
    if (tb.has(t)) intersection++;
  });
  return (2 * intersection) / (ta.size + tb.size);
}

// Union-Find for grouping
function buildGroups(questions: Question[], threshold: number): SimilarityGroup[] {
  const n = questions.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const groupMaxSim = new Array(n).fill(0);

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = similarity(questions[i].questionText, questions[j].questionText);
      if (sim >= threshold) {
        union(i, j);
        groupMaxSim[i] = Math.max(groupMaxSim[i], sim);
        groupMaxSim[j] = Math.max(groupMaxSim[j], sim);
      }
    }
  }

  const groups: Record<number, { indices: number[]; maxSim: number }> = {};
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups[root]) groups[root] = { indices: [], maxSim: 0 };
    groups[root].indices.push(i);
    groups[root].maxSim = Math.max(groups[root].maxSim, groupMaxSim[i]);
  }

  // Only return groups with more than 1 question (actual duplicates)
  return Object.values(groups)
    .filter((g) => g.indices.length > 1)
    .map((g) => ({
      questions: g.indices.map((i) => questions[i]),
      maxSimilarity: g.maxSim,
    }))
    .sort((a, b) => b.maxSimilarity - a.maxSimilarity);
}

const QuestionDuplicatesPage: React.FC = () => {
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [threshold, setThreshold] = useState(0.7);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await ReadQuestionsData();
      setAllQuestions(res.data || []);
    } catch (e) {
      console.error("Failed to load questions", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const groups = useMemo(
    () => buildGroups(allQuestions, threshold),
    [allQuestions, threshold]
  );

  const totalDuplicates = useMemo(
    () => groups.reduce((sum, g) => sum + g.questions.length, 0),
    [groups]
  );

  const toggleGroup = (idx: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedGroups(new Set(groups.map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  const handleDelete = async (questionId: number) => {
    if (!window.confirm(`Delete question #${questionId}? This cannot be undone.`)) return;
    setDeleting(questionId);
    try {
      await DeleteQuestionData(questionId);
      setAllQuestions((prev) => prev.filter((q) => q.questionId !== questionId));
    } catch (e) {
      console.error("Delete failed", e);
      alert("Failed to delete question. Please try again.");
    }
    setDeleting(null);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 400 }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header border-0 pt-6">
        <div className="card-title">
          <h2>Duplicate Question Finder</h2>
        </div>
        <div className="card-toolbar d-flex align-items-center gap-3">
          <div className="d-flex align-items-center gap-2">
            <label className="fw-bold text-muted fs-7">Similarity Threshold:</label>
            <input
              type="range"
              className="form-range"
              min={0.5}
              max={1.0}
              step={0.05}
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              style={{ width: 140 }}
            />
            <span className="badge badge-primary fs-7">{(threshold * 100).toFixed(0)}%</span>
          </div>
          <button className="btn btn-sm btn-light-primary" onClick={expandAll}>
            Expand All
          </button>
          <button className="btn btn-sm btn-light-secondary" onClick={collapseAll}>
            Collapse All
          </button>
        </div>
      </div>

      <div className="card-body pt-0">
        {/* Summary */}
        <div className="d-flex gap-4 mb-6">
          <div className="border rounded p-4 flex-fill text-center">
            <div className="fs-2 fw-bold text-primary">{allQuestions.length}</div>
            <div className="text-muted fs-7">Total Questions</div>
          </div>
          <div className="border rounded p-4 flex-fill text-center">
            <div className="fs-2 fw-bold text-danger">{groups.length}</div>
            <div className="text-muted fs-7">Duplicate Groups</div>
          </div>
          <div className="border rounded p-4 flex-fill text-center">
            <div className="fs-2 fw-bold text-warning">{totalDuplicates}</div>
            <div className="text-muted fs-7">Questions in Groups</div>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-10 text-muted fs-5">
            No duplicate groups found at {(threshold * 100).toFixed(0)}% similarity threshold.
          </div>
        ) : (
          groups.map((group, groupIdx) => {
            const isExpanded = expandedGroups.has(groupIdx);
            return (
              <div
                key={groupIdx}
                className="border rounded mb-4"
                style={{ overflow: "hidden" }}
              >
                {/* Group header */}
                <div
                  className="d-flex align-items-center justify-content-between px-4 py-3"
                  style={{
                    background: "#f8f9fa",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  onClick={() => toggleGroup(groupIdx)}
                >
                  <div className="d-flex align-items-center gap-3">
                    <span style={{ fontSize: 18, fontWeight: "bold" }}>
                      {isExpanded ? "▾" : "▸"}
                    </span>
                    <span className="fw-bold fs-6">
                      Group {groupIdx + 1}
                    </span>
                    <span className="badge badge-light-danger">
                      {group.questions.length} questions
                    </span>
                    <span className="badge badge-light-warning">
                      {(group.maxSimilarity * 100).toFixed(0)}% max similarity
                    </span>
                  </div>
                  <div className="text-muted fs-7" style={{ maxWidth: "50%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {group.questions[0]?.questionText?.substring(0, 80)}...
                  </div>
                </div>

                {/* Group body */}
                {isExpanded && (
                  <div className="px-4 py-3">
                    {group.questions.map((q, qIdx) => (
                      <div
                        key={q.questionId}
                        className={`border rounded p-3 mb-3 ${qIdx > 0 ? "border-warning" : ""}`}
                        style={qIdx === 0 ? { borderLeft: "4px solid #009ef7" } : { borderLeft: "4px solid #ffc700" }}
                      >
                        {/* Question header */}
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="flex-fill">
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <span className="badge badge-light fs-8">ID: {q.questionId}</span>
                              {q.section && (
                                <span className="badge badge-light-info fs-8">
                                  {q.section.sectionName}
                                </span>
                              )}
                              {qIdx === 0 && (
                                <span className="badge badge-light-primary fs-8">Reference</span>
                              )}
                            </div>
                            <div className="fs-6 fw-semibold">{q.questionText}</div>
                          </div>
                          <button
                            className="btn btn-sm btn-light-danger ms-3"
                            disabled={deleting === q.questionId}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(q.questionId);
                            }}
                          >
                            {deleting === q.questionId ? (
                              <span className="spinner-border spinner-border-sm" />
                            ) : (
                              "Delete"
                            )}
                          </button>
                        </div>

                        {/* Options table */}
                        {q.options && q.options.length > 0 && (
                          <div className="table-responsive mt-2">
                            <table className="table table-sm table-bordered table-striped mb-0 align-middle">
                              <thead>
                                <tr className="bg-light">
                                  <th style={{ minWidth: 40 }}>#</th>
                                  <th style={{ minWidth: 200 }}>Option Text</th>
                                  <th>MQT</th>
                                  <th style={{ minWidth: 60 }}>Score</th>
                                </tr>
                              </thead>
                              <tbody>
                                {q.options.map((opt, optIdx) => {
                                  const scores = opt.optionScores || [];
                                  if (scores.length === 0) {
                                    return (
                                      <tr key={opt.optionId}>
                                        <td>{optIdx + 1}</td>
                                        <td>{opt.optionText || <em className="text-muted">(image)</em>}</td>
                                        <td colSpan={2} className="text-muted fs-8">No scores</td>
                                      </tr>
                                    );
                                  }
                                  return scores.map((os, osIdx) => (
                                    <tr key={`${opt.optionId}-${os.scoreId}`}>
                                      {osIdx === 0 && (
                                        <>
                                          <td rowSpan={scores.length}>{optIdx + 1}</td>
                                          <td rowSpan={scores.length}>{opt.optionText || <em className="text-muted">(image)</em>}</td>
                                        </>
                                      )}
                                      <td>
                                        <span
                                          className="badge badge-light-info"
                                          title={os.measuredQualityType?.measured_quality_type_description || ""}
                                        >
                                          {os.measuredQualityType?.measured_quality_type_name || "-"}
                                        </span>
                                      </td>
                                      <td className="fw-bold">{os.score}</td>
                                    </tr>
                                  ));
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Similarity to other questions in group */}
                        {qIdx > 0 && (
                          <div className="mt-2 fs-8 text-muted">
                            Similarity to #{group.questions[0].questionId}:{" "}
                            <strong>
                              {(
                                similarity(
                                  group.questions[0].questionText,
                                  q.questionText
                                ) * 100
                              ).toFixed(1)}
                              %
                            </strong>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default QuestionDuplicatesPage;
