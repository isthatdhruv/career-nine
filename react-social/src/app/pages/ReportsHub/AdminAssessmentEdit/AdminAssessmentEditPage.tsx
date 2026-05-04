import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import {
  adminSubmitOnBehalfOfStudent,
  AdminAnswerEntry,
  getAssessmentDetails,
  getAssessmentQuestionnaire,
  getStudentAnswers,
} from "./AdminAssessmentEdit_APIs";

type Option = {
  optionId: number;
  optionText: string;
  optionDescription?: string;
  optionImageBase64?: string | null;
  isGame?: boolean;
  game?: { gameCode: number } | null;
};

type Question = {
  questionnaireQuestionId: number;
  question: {
    questionText: string;
    questionType?: string;
    isMQTtyped?: boolean;
    options: Option[];
    maxOptionsAllowed: number;
  };
};

type Section = {
  section: { sectionId: number; sectionName?: string; description?: string };
  questions: Question[];
};

type Questionnaire = {
  sections: Section[];
};

const isGameQuestion = (q: Question) =>
  (q.question.options || []).some((o) => o.isGame === true);

const isTextQuestion = (q: Question) =>
  q.question.questionType === "text" || q.question.isMQTtyped === true;

const isRankingQuestion = (q: Question) => q.question.questionType === "ranking";

const AdminAssessmentEditPage: React.FC = () => {
  const { assessmentId, studentId } = useParams<{ assessmentId: string; studentId: string }>();
  const navigate = useNavigate();

  const aId = Number(assessmentId);
  const sId = Number(studentId);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [assessmentName, setAssessmentName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // single/multi-select: sectionId -> questionId -> optionId[]
  const [answers, setAnswers] = useState<Record<number, Record<number, number[]>>>({});
  // ranking: sectionId -> questionId -> optionId -> rank
  const [rankingAnswers, setRankingAnswers] = useState<Record<number, Record<number, Record<number, number>>>>({});
  // text: sectionId -> questionId -> text
  const [textAnswers, setTextAnswers] = useState<Record<number, Record<number, string>>>({});
  // questions admin has touched (for the override banner)
  const [touched, setTouched] = useState<Set<number>>(new Set());
  // questions that already had a student answer when the page loaded
  const [originallyAnswered, setOriginallyAnswered] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!aId || !sId) return;
    setLoading(true);
    Promise.all([
      getAssessmentQuestionnaire(aId),
      getAssessmentDetails(aId),
      getStudentAnswers(sId),
    ])
      .then(([qRes, detailRes, ansRes]) => {
        const data = qRes.data;
        const questionnaireData: Questionnaire | null =
          Array.isArray(data) ? (data[0] || null) : (data || null);
        setQuestionnaire(questionnaireData);
        setAssessmentName(detailRes.data?.assessmentName || `Assessment #${aId}`);

        // Hydrate state from existing student answers
        const a: Record<number, Record<number, number[]>> = {};
        const r: Record<number, Record<number, Record<number, number>>> = {};
        const t: Record<number, Record<number, string>> = {};
        const seenQuestions = new Set<number>();

        const sectionLookup = new Map<number, number>(); // questionnaireQuestionId -> sectionId
        for (const sec of questionnaireData?.sections || []) {
          for (const q of sec.questions || []) {
            sectionLookup.set(q.questionnaireQuestionId, sec.section.sectionId);
          }
        }

        for (const ans of ansRes.data || []) {
          const ansAssessmentId = ans?.assessment?.id ?? ans?.assessment?.assessmentId;
          if (Number(ansAssessmentId) !== aId) continue;
          const qq = ans?.questionnaireQuestion;
          if (!qq) continue;
          const qId: number = qq.questionnaireQuestionId;
          const secId = sectionLookup.get(qId);
          if (secId == null) continue;
          seenQuestions.add(qId);

          if (ans.textResponse) {
            if (!t[secId]) t[secId] = {};
            t[secId][qId] = String(ans.textResponse);
            continue;
          }
          const optionId = ans?.option?.optionId;
          if (optionId == null) continue;
          if (ans.rankOrder != null) {
            if (!r[secId]) r[secId] = {};
            if (!r[secId][qId]) r[secId][qId] = {};
            r[secId][qId][optionId] = Number(ans.rankOrder);
          } else {
            if (!a[secId]) a[secId] = {};
            if (!a[secId][qId]) a[secId][qId] = [];
            if (!a[secId][qId].includes(optionId)) a[secId][qId].push(optionId);
          }
        }
        setAnswers(a);
        setRankingAnswers(r);
        setTextAnswers(t);
        setOriginallyAnswered(seenQuestions);

        if (ansRes.data && ansRes.data.length > 0) {
          const us = ansRes.data[0]?.userStudent;
          const sName = us?.studentInfo?.firstName
            ? `${us.studentInfo.firstName}${us.studentInfo.lastName ? " " + us.studentInfo.lastName : ""}`
            : us?.username || `Student #${sId}`;
          setStudentName(sName);
        } else {
          setStudentName(`Student #${sId}`);
        }
      })
      .catch((err) => {
        console.error(err);
        showErrorToast("Failed to load assessment data");
      })
      .finally(() => setLoading(false));
  }, [aId, sId]);

  const markTouched = useCallback((qId: number) => {
    setTouched((prev) => {
      if (prev.has(qId)) return prev;
      const next = new Set(prev);
      next.add(qId);
      return next;
    });
  }, []);

  const toggleOption = (sectionId: number, q: Question, optionId: number) => {
    markTouched(q.questionnaireQuestionId);
    setAnswers((prev) => {
      const sec = { ...(prev[sectionId] || {}) };
      const arr = sec[q.questionnaireQuestionId] || [];
      const max = q.question.maxOptionsAllowed;
      if (arr.includes(optionId)) {
        sec[q.questionnaireQuestionId] = arr.filter((x) => x !== optionId);
      } else if (max === 1) {
        sec[q.questionnaireQuestionId] = [optionId];
      } else if (max === 0 || arr.length < max) {
        sec[q.questionnaireQuestionId] = [...arr, optionId];
      } else {
        return prev;
      }
      return { ...prev, [sectionId]: sec };
    });
  };

  const setRanking = (sectionId: number, q: Question, optionId: number, rankStr: string) => {
    markTouched(q.questionnaireQuestionId);
    const rank = rankStr === "" ? 0 : Number(rankStr);
    setRankingAnswers((prev) => {
      const sec = { ...(prev[sectionId] || {}) };
      const qMap = { ...(sec[q.questionnaireQuestionId] || {}) };
      if (rank === 0) delete qMap[optionId];
      else qMap[optionId] = rank;
      sec[q.questionnaireQuestionId] = qMap;
      return { ...prev, [sectionId]: sec };
    });
  };

  const setText = (sectionId: number, q: Question, text: string) => {
    markTouched(q.questionnaireQuestionId);
    setTextAnswers((prev) => {
      const sec = { ...(prev[sectionId] || {}) };
      sec[q.questionnaireQuestionId] = text;
      return { ...prev, [sectionId]: sec };
    });
  };

  const visibleSections = useMemo<Section[]>(() => {
    if (!questionnaire) return [];
    return (questionnaire.sections || []).map((sec) => ({
      ...sec,
      questions: (sec.questions || []).filter((q) => !isGameQuestion(q)),
    })).filter((sec) => sec.questions.length > 0);
  }, [questionnaire]);

  const buildPayload = (): AdminAnswerEntry[] => {
    const out: AdminAnswerEntry[] = [];
    for (const sec of visibleSections) {
      const secId = sec.section.sectionId;
      for (const q of sec.questions) {
        const qId = q.questionnaireQuestionId;
        if (isTextQuestion(q)) {
          const text = (textAnswers[secId]?.[qId] || "").trim();
          if (!text) continue;
          const norm = text.replace(/\s+/g, " ").toLowerCase();
          const matched = (q.question.options || []).find(
            (o) => (o.optionText || "").trim().replace(/\s+/g, " ").toLowerCase() === norm
          );
          if (matched) out.push({ questionnaireQuestionId: qId, optionId: matched.optionId });
          else out.push({ questionnaireQuestionId: qId, textResponse: text });
        } else if (isRankingQuestion(q)) {
          const ranks = rankingAnswers[secId]?.[qId] || {};
          for (const [optIdStr, rank] of Object.entries(ranks)) {
            if (!rank) continue;
            out.push({ questionnaireQuestionId: qId, optionId: Number(optIdStr), rankOrder: Number(rank) });
          }
        } else {
          const opts = answers[secId]?.[qId] || [];
          for (const optId of opts) {
            out.push({ questionnaireQuestionId: qId, optionId: optId });
          }
        }
      }
    }
    return out;
  };

  const handleSubmit = async () => {
    const payload = buildPayload();
    if (payload.length === 0) {
      showErrorToast("No answers to submit");
      return;
    }
    setSubmitting(true);
    try {
      await adminSubmitOnBehalfOfStudent({
        userStudentId: sId,
        assessmentId: aId,
        answers: payload,
        reason: "Filled by admin from Reports Hub",
      });
      showSuccessToast("Submitted on behalf of student");
      navigate("/reports-hub");
    } catch (err: any) {
      console.error(err);
      showErrorToast(err?.response?.data?.error || err?.message || "Submission failed");
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const stats = useMemo(() => {
    let total = 0;
    let answered = 0;
    for (const sec of visibleSections) {
      const secId = sec.section.sectionId;
      for (const q of sec.questions) {
        total += 1;
        const qId = q.questionnaireQuestionId;
        const has = isTextQuestion(q)
          ? !!(textAnswers[secId]?.[qId] || "").trim()
          : isRankingQuestion(q)
          ? Object.values(rankingAnswers[secId]?.[qId] || {}).some((v) => v && v > 0)
          : (answers[secId]?.[qId] || []).length > 0;
        if (has) answered += 1;
      }
    }
    return { total, answered };
  }, [visibleSections, answers, rankingAnswers, textAnswers]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
        Loading assessment...
      </div>
    );
  }

  if (!questionnaire || visibleSections.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
        No questions found for this assessment.
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/reports-hub")}>
            Back to Reports Hub
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 980, margin: "0 auto" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#92400e", letterSpacing: 1, marginBottom: 4 }}>
            ADMIN EDIT ON BEHALF OF STUDENT
          </div>
          <h2 style={{ margin: 0, fontSize: "1.4rem", color: "#1a1a2e", fontWeight: 700 }}>
            {assessmentName}
          </h2>
          <div style={{ color: "#6b7280", fontSize: "0.85rem", marginTop: 4 }}>
            Student: <strong>{studentName}</strong> &middot; {stats.answered} / {stats.total} answered
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-light btn-sm" onClick={() => navigate("/reports-hub")}>
            Cancel
          </button>
          <button
            className="btn btn-sm"
            disabled={submitting || stats.answered === 0}
            onClick={() => setConfirmOpen(true)}
            style={{
              background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
              border: "none", borderRadius: 8, padding: "8px 20px",
              fontWeight: 600, color: "white", fontSize: "0.85rem",
            }}
          >
            {submitting ? "Submitting..." : "Submit on behalf of student"}
          </button>
        </div>
      </div>

      {visibleSections.map((sec) => (
        <div key={sec.section.sectionId} style={{
          background: "white", border: "1px solid #e5e7eb", borderRadius: 12,
          padding: 20, marginBottom: 16,
        }}>
          <h3 style={{ margin: "0 0 4px", fontSize: "1.1rem", color: "#1a1a2e", fontWeight: 700 }}>
            {sec.section.sectionName || `Section ${sec.section.sectionId}`}
          </h3>
          {sec.section.description && (
            <p style={{ margin: "0 0 16px", color: "#6b7280", fontSize: "0.85rem" }}>
              {sec.section.description}
            </p>
          )}

          {sec.questions.map((q, idx) => {
            const qId = q.questionnaireQuestionId;
            const secId = sec.section.sectionId;
            const wasAnswered = originallyAnswered.has(qId);
            const wasTouched = touched.has(qId);

            return (
              <div key={qId} style={{
                padding: "16px 0",
                borderTop: idx === 0 ? "none" : "1px dashed #e5e7eb",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, fontWeight: 600, color: "#1a1a2e", fontSize: "0.95rem" }}>
                    {idx + 1}. {q.question.questionText}
                  </div>
                  <span style={{
                    padding: "2px 10px", borderRadius: 999, fontSize: "0.7rem", fontWeight: 700,
                    background: wasAnswered ? "#dcfce7" : "#fef3c7",
                    color: wasAnswered ? "#166534" : "#92400e",
                    whiteSpace: "nowrap",
                  }}>
                    {wasAnswered ? (wasTouched ? "Edited" : "Marked") : "Unanswered"}
                  </span>
                </div>

                {q.question.maxOptionsAllowed > 0 && !isTextQuestion(q) && !isRankingQuestion(q) && (
                  <div style={{ color: "#9ca3af", fontSize: "0.75rem", marginTop: 4 }}>
                    Choose up to {q.question.maxOptionsAllowed}
                  </div>
                )}

                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {isTextQuestion(q) ? (
                    <textarea
                      value={textAnswers[secId]?.[qId] || ""}
                      onChange={(e) => setText(secId, q, e.target.value)}
                      placeholder="Type the student's answer..."
                      style={{
                        width: "100%", minHeight: 70, padding: 10, fontSize: "0.9rem",
                        border: "1px solid #d1d5db", borderRadius: 8, resize: "vertical",
                      }}
                    />
                  ) : isRankingQuestion(q) ? (
                    (q.question.options || []).map((opt) => {
                      const rank = rankingAnswers[secId]?.[qId]?.[opt.optionId] || 0;
                      return (
                        <div key={opt.optionId} style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: 10, border: "1px solid #e5e7eb", borderRadius: 8,
                        }}>
                          <span style={{ flex: 1, fontSize: "0.9rem" }}>{opt.optionText}</span>
                          <input
                            type="number"
                            min={0}
                            max={(q.question.options || []).length}
                            value={rank || ""}
                            onChange={(e) => setRanking(secId, q, opt.optionId, e.target.value)}
                            placeholder="rank"
                            style={{
                              width: 80, padding: "6px 8px", border: "1px solid #d1d5db",
                              borderRadius: 6, fontSize: "0.85rem", textAlign: "center",
                            }}
                          />
                        </div>
                      );
                    })
                  ) : (
                    (q.question.options || []).map((opt) => {
                      const checked = (answers[secId]?.[qId] || []).includes(opt.optionId);
                      const isMulti = q.question.maxOptionsAllowed !== 1;
                      return (
                        <label key={opt.optionId} style={{
                          display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
                          padding: 10, border: `1px solid ${checked ? "#3b82f6" : "#e5e7eb"}`,
                          borderRadius: 8, background: checked ? "#eff6ff" : "white",
                        }}>
                          <input
                            type={isMulti ? "checkbox" : "radio"}
                            name={`q-${qId}`}
                            checked={checked}
                            onChange={() => toggleOption(secId, q, opt.optionId)}
                            style={{ marginTop: 2 }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "0.9rem", color: "#1a1a2e" }}>
                              {opt.optionText}
                            </div>
                            {opt.optionDescription && (
                              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 2 }}>
                                {opt.optionDescription}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {confirmOpen && (
        <div
          onClick={() => !submitting && setConfirmOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white", borderRadius: 12, padding: 24, maxWidth: 440, width: "90%",
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 700, color: "#1a1a2e" }}>
              Submit on behalf of student?
            </h3>
            <p style={{ margin: "0 0 16px", color: "#6b7280", fontSize: "0.9rem" }}>
              This will overwrite the student's existing submission for <strong>{assessmentName}</strong> and
              mark their assessment as completed. This action will be logged in the admin audit trail.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                className="btn btn-light btn-sm"
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm"
                disabled={submitting}
                onClick={handleSubmit}
                style={{
                  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                  border: "none", borderRadius: 8, padding: "8px 20px",
                  fontWeight: 600, color: "white", fontSize: "0.85rem",
                }}
              >
                {submitting ? "Submitting..." : "Yes, submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAssessmentEditPage;
