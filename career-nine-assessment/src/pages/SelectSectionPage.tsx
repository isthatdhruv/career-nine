import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAssessment } from '../contexts/AssessmentContext';
import { usePreventReload } from '../hooks/usePreventReload';
import { useHeartbeat } from '../hooks/useHeartbeat';
import http from '../api/http';
import { restorePartialAnswers } from '../api/assessmentApi';

type Section = {
  sectionId: string | number;
  sectionName: string;
  sectionDescription?: string;
};

type SectionWithQuestions = {
  section: { sectionId: string | number };
  questions: { questionnaireQuestionId: number }[];
};

/**
 * How long to wait for the questionnaire before showing a recovery screen.
 * fetchAssessmentData can legitimately take a while (axios 60s timeout + up to
 * 3 backed-off retries on 5xx), so this does NOT abort the request — if the data
 * lands later the page recovers on its own and the error screen disappears.
 */
const LOAD_WATCHDOG_MS = 20_000;

const SelectSectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { assessmentData, fetchAssessmentData } = useAssessment();
  usePreventReload();

  /**
   * Explicit load state for THIS page.
   *
   * Deliberately not derived from the context's shared `loading` flag, and no
   * one-way `sectionsReady` latch: the previous version rendered its spinner on
   * `loading || !sectionsReady`, where `sectionsReady` only ever flipped inside
   * `if (assessmentData && assessmentData[0])`. That made the page a purely
   * passive consumer — if the questionnaire was absent for ANY reason the
   * spinner ran forever with no fetch, no timeout, no error and no retry, and a
   * manual browser reload (which re-hydrates the provider from sessionStorage)
   * was the only escape. That is the state students kept hitting.
   */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const assessmentId = localStorage.getItem('assessmentId');
  const userStudentId = localStorage.getItem('userStudentId');

  useHeartbeat({
    userStudentId: Number(userStudentId) || null,
    assessmentId: Number(assessmentId) || null,
    page: 'section-select',
  });

  const questionnaire = assessmentData?.[0] ?? null;

  // Sections are DERIVED, never latched. The moment the questionnaire exists the
  // list renders; there is no intermediate flag that can get stuck behind it.
  const sections: Section[] = useMemo(() => {
    if (!questionnaire?.sections) return [];
    try {
      return questionnaire.sections.map((item: any) => ({
        sectionId: item.section.sectionId,
        sectionName: item.section.sectionName,
        sectionDescription: item.section.sectionDescription || "",
      }));
    } catch (error) {
      console.error("Failed to process sections:", error);
      return [];
    }
  }, [questionnaire]);

  /**
   * Self-sufficient load. If the shared context has no questionnaire — cold tab,
   * restored tab, a sessionStorage write that hit quota in cacheToSession, a
   * failed earlier fetch — this page loads it itself from the assessmentId in
   * localStorage instead of waiting for a caller that may never come.
   */
  const loadAttemptRef = useRef<string | null>(null);
  useEffect(() => {
    if (!assessmentId || !userStudentId) {
      navigate('/student-login', { replace: true });
      return;
    }
    if (questionnaire) {
      // Data arrived (possibly late, after the watchdog fired) — clear any
      // recovery screen so the student proceeds without touching anything.
      setLoadError(null);
      return;
    }

    const attemptKey = `${assessmentId}:${retryTick}`;
    if (loadAttemptRef.current === attemptKey) return;
    loadAttemptRef.current = attemptKey;

    let cancelled = false;
    fetchAssessmentData(assessmentId)
      .then((ok) => {
        if (cancelled) return;
        if (!ok) {
          setLoadError('We could not load your assessment questions.');
          return;
        }
        // Loaded successfully but the payload carries no questionnaire (empty
        // list from /assessments/getby, or a locked snapshot without one). The
        // effect above won't re-run for this attempt, so say so explicitly
        // rather than letting the watchdog claim it is "taking longer".
        const loaded = JSON.parse(sessionStorage.getItem('assessmentData') || 'null');
        if (!loaded?.[0]) {
          setLoadError('This assessment has no questions configured yet.');
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('We could not load your assessment questions.');
      });

    return () => { cancelled = true; };
  }, [assessmentId, userStudentId, questionnaire, retryTick, fetchAssessmentData, navigate]);

  // Watchdog: never leave the student on an indefinite spinner.
  useEffect(() => {
    if (questionnaire || loadError) return;
    const timer = window.setTimeout(() => {
      setLoadError('Loading your assessment is taking longer than expected.');
    }, LOAD_WATCHDOG_MS);
    return () => window.clearTimeout(timer);
  }, [questionnaire, loadError, retryTick]);

  /**
   * Status check — runs ONCE per mount. The previous version listed
   * `assessmentData` in its deps, so it re-fired the request every time the
   * questionnaire landed, doubling the call with no cancellation.
   */
  const [studentStatus, setStudentStatus] = useState<string | null>(null);
  const statusCheckedRef = useRef(false);
  useEffect(() => {
    if (!assessmentId || !userStudentId) return;
    if (statusCheckedRef.current) return;
    statusCheckedRef.current = true;

    let cancelled = false;
    http.get(`/assessments/${assessmentId}/student/${userStudentId}`)
      .then(({ data }) => {
        if (cancelled) return;
        const { isActive, studentStatus: status } = data;

        if (!isActive) {
          alert("This assessment is not active.");
          navigate("/student-login");
          return;
        }

        if (status === 'completed') {
          // Already submitted — straight to the thank-you / report page, NOT
          // back to login. ThankYouPage resolves entitlement + report state from
          // localStorage and no-ops gracefully if those keys are absent.
          navigate('/studentAssessment/completed', { replace: true });
          return;
        }

        setStudentStatus(status ?? null);
      })
      .catch((error) => {
        // Non-fatal: the student can still pick a section manually. Re-arm so a
        // Retry from the recovery screen re-checks.
        console.error("Error checking student status:", error);
        statusCheckedRef.current = false;
      });

    return () => { cancelled = true; };
  }, [assessmentId, userStudentId, navigate, retryTick]);

  /**
   * Resume path — only once both the status and the questionnaire are known.
   * Jumps to the first section that still has an unanswered question so the
   * student doesn't have to remember where they paused. SectionQuestionPage
   * restores the partial answers on mount and lands them on the exact
   * next-unanswered question within that section.
   */
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    if (studentStatus !== 'ongoing' || !questionnaire) return;
    if (!assessmentId || !userStudentId) return;
    resumedRef.current = true;

    let cancelled = false;
    restorePartialAnswers(Number(userStudentId), Number(assessmentId))
      .then((partial) => {
        if (cancelled) return;
        const answeredIds = collectAnsweredQuestionIds(partial);
        const target = findNextUnansweredSection(questionnaire, answeredIds);
        if (target) {
          navigate(
            `/studentAssessment/sections/${target.sectionId}/questions/0`,
            { replace: true },
          );
        }
        // No unanswered question found — fall through to the section picker.
      })
      .catch((restoreErr) => {
        console.warn('Partial restore failed on resume; showing picker:', restoreErr);
      });

    return () => { cancelled = true; };
  }, [studentStatus, questionnaire, assessmentId, userStudentId, navigate]);

  // Pulls the set of answered questionnaireQuestionIds out of the
  // /partial-restore response shape ({ answers: [{ questionnaireQuestionId, ... }] }).
  function collectAnsweredQuestionIds(restored: any): Set<number> {
    const out = new Set<number>();
    const list = restored?.answers;
    if (Array.isArray(list)) {
      for (const a of list) {
        const qid = a?.questionnaireQuestionId;
        if (typeof qid === 'number') out.add(qid);
      }
    }
    return out;
  }

  // Walks sections in order; returns the first one that still has any
  // unanswered question. Section shape mirrors what AssessmentContext loads.
  function findNextUnansweredSection(
    q: any,
    answeredIds: Set<number>,
  ): { sectionId: string | number } | null {
    const sectionsList: SectionWithQuestions[] = q?.sections || [];
    for (const s of sectionsList) {
      const qs = Array.isArray(s.questions) ? s.questions : [];
      const hasUnanswered = qs.some((qq) =>
        typeof qq?.questionnaireQuestionId === 'number'
          ? !answeredIds.has(qq.questionnaireQuestionId)
          : false,
      );
      if (hasUnanswered) return { sectionId: s.section.sectionId };
    }
    return null;
  }

  const handleSectionClick = (section: Section) => {
    navigate(`/studentAssessment/sections/${section.sectionId}`);
  };

  const handleRetry = () => {
    setLoadError(null);
    loadAttemptRef.current = null;
    resumedRef.current = false;
    setRetryTick((t) => t + 1);
  };

  // Three mutually exclusive states — no combination can produce a silent hang.
  const showError = !questionnaire && !!loadError;
  const showSpinner = !questionnaire && !loadError;

  return (
    <div className="assessment-bg">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-md-10 col-lg-8 col-xl-7">
            <div className="assessment-card card shadow-lg">
              <div className="card-body p-3 p-sm-3 p-md-4" style={{ paddingTop: '1.25rem' }}>
                <h2 className="text-center assessment-heading" style={{ fontSize: '1.5rem' }}>Select Section</h2>
                <p className="text-center assessment-subheading" style={{ marginBottom: '0.75rem' }}>
                  Choose a section to begin your assessment
                </p>

                {/* Loading State */}
                {showSpinner && (
                  <div className="text-center py-5">
                    <div className="spinner-border" role="status" style={{ width: "3rem", height: "3rem", color: "#5DD68D" }}>
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-3" style={{ color: "#718096" }}>Loading sections...</p>
                  </div>
                )}

                {/* Recovery State — replaces the old indefinite spinner */}
                {showError && (
                  <div className="text-center py-4 py-md-5">
                    <div
                      style={{
                        width: "80px",
                        height: "80px",
                        background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.12) 100%)",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 1.25rem",
                      }}
                    >
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                        <path d="M23 4v6h-6" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                      </svg>
                    </div>
                    <h4 style={{ color: "#4a5568", fontSize: "1.15rem", fontWeight: "600", marginBottom: "0.5rem" }}>
                      {loadError}
                    </h4>
                    <p style={{ color: "#9ca3af", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
                      Check your internet connection and try again. Nothing you have already answered is lost.
                    </p>
                    <div className="d-flex gap-2 justify-content-center flex-wrap">
                      <button className="btn btn-assessment-primary px-4" onClick={handleRetry}>
                        Try again
                      </button>
                      <button
                        className="btn px-4"
                        onClick={() => navigate('/allotted-assessment')}
                        style={{ border: '1px solid #e2e8f0', color: '#4a5568', background: '#fff', borderRadius: '10px' }}
                      >
                        Back to my assessments
                      </button>
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {!!questionnaire && sections.length === 0 && (
                  <div className="text-center py-4 py-md-5">
                    <div
                      style={{
                        width: "80px",
                        height: "80px",
                        background: "linear-gradient(135deg, rgba(93, 214, 141,0.1) 0%, rgba(63, 184, 118,0.1) 100%)",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 1.25rem",
                      }}
                    >
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#5DD68D" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <h4 style={{ color: "#4a5568", fontSize: "1.15rem", fontWeight: "600", marginBottom: "0.5rem" }}>
                      No Sections Available
                    </h4>
                    <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
                      There are no sections to display at this time.
                    </p>
                  </div>
                )}

                {/* Sections List */}
                {sections.length > 0 && (
                  <div className="d-flex flex-column gap-3">
                    {sections.map((section, index) => (
                      <div
                        key={section.sectionId}
                        className="section-card card"
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSectionClick(section)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSectionClick(section);
                          }
                        }}
                      >
                        <div className="card-body p-3 d-flex align-items-center gap-3">
                          {/* Section Number Badge */}
                          <div
                            style={{
                              width: "42px",
                              height: "42px",
                              minWidth: "42px",
                              background: "linear-gradient(135deg, #5DD68D 0%, #3FB876 100%)",
                              borderRadius: "10px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "white",
                              fontSize: "1.1rem",
                              fontWeight: "700",
                              boxShadow: "0 4px 12px rgba(93, 214, 141, 0.3)",
                            }}
                          >
                            {index + 1}
                          </div>

                          {/* Section Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h6 style={{ marginBottom: section.sectionDescription ? "0.3rem" : "0", fontSize: "1.05rem", fontWeight: "600", color: "#2d3748" }}>
                              {section.sectionName}
                            </h6>
                            {section.sectionDescription && (
                              <p style={{ margin: 0, fontSize: "0.85rem", color: "#718096", lineHeight: "1.4" }}>
                                {section.sectionDescription}
                              </p>
                            )}
                          </div>

                          {/* Arrow Icon */}
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              minWidth: "36px",
                              background: "#f7fafc",
                              borderRadius: "8px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5DD68D" strokeWidth="2.5">
                              <line x1="5" y1="12" x2="19" y2="12" />
                              <polyline points="12 5 19 12 12 19" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer Note */}
                {sections.length > 0 && (
                  <div className="text-center mt-3 mt-md-4 p-2 p-md-3" style={{ background: "#f7fafc", borderRadius: "10px" }}>
                    <p style={{ margin: 0, color: "#718096", fontSize: "0.85rem" }}>Click on any section to begin</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectSectionPage;
