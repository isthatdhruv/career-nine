import React, { useEffect, useState } from "react";
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

const SelectSectionPage: React.FC = () => {
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionsReady, setSectionsReady] = useState(false);
  const navigate = useNavigate();
  const { assessmentData, loading } = useAssessment();
  usePreventReload();

  useHeartbeat({
    userStudentId: Number(localStorage.getItem('userStudentId')) || null,
    assessmentId: Number(localStorage.getItem('assessmentId')) || null,
    page: 'section-select',
  });

  // Extract sections immediately when assessmentData is available (no API dependency)
  useEffect(() => {
    if (assessmentData && assessmentData[0]) {
      try {
        const questionnaire = assessmentData[0];
        const sectionsData = questionnaire.sections.map((item: any) => ({
          sectionId: item.section.sectionId,
          sectionName: item.section.sectionName,
          sectionDescription: item.section.sectionDescription || "",
        }));
        setSections(sectionsData || []);
      } catch (error) {
        console.error("Failed to process sections:", error);
      }
      setSectionsReady(true);
    }
  }, [assessmentData]);

  // Status check runs independently — doesn't block section rendering. For
  // an "ongoing" status with partial answers we additionally auto-route the
  // student to the next-unanswered question so they don't have to remember
  // which section they paused in.
  useEffect(() => {
    const checkStudentStatus = async () => {
      const assessmentId = localStorage.getItem('assessmentId');
      const userStudentId = localStorage.getItem('userStudentId');

      if (!assessmentId || !userStudentId) {
        navigate('/student-login', { replace: true });
        return;
      }

      try {
        const response = await http.get(
          `/assessments/${assessmentId}/student/${userStudentId}`
        );
        const { isActive, studentStatus } = response.data;

        if (!isActive) {
          alert("This assessment is not active.");
          navigate("/student-login");
          return;
        }

        if (studentStatus === 'completed') {
          // Student already submitted — send them straight to the
          // thank-you / report page, NOT back to login. The thank-you page
          // resolves entitlement + report state from localStorage; it
          // gracefully no-ops if those keys are absent.
          navigate('/studentAssessment/completed', { replace: true });
          return;
        }

        if (studentStatus === 'ongoing' && assessmentData && assessmentData[0]) {
          // Resume path — pick the first section that still has an
          // unanswered question and jump straight to it. SectionQuestionPage
          // will restore the partial answers on mount and land the student
          // on the within-section next-unanswered.
          try {
            const partial = await restorePartialAnswers(
              Number(userStudentId), Number(assessmentId),
            );
            const answeredIds = collectAnsweredQuestionIds(partial?.data);
            const target = findNextUnansweredSection(assessmentData[0], answeredIds);
            if (target) {
              navigate(
                `/studentAssessment/sections/${target.sectionId}/questions/0`,
                { replace: true },
              );
              return;
            }
            // No unanswered question found — fall through to the section
            // picker (student can re-enter manually if they want).
          } catch (restoreErr) {
            console.warn('Partial restore failed on resume; showing picker:', restoreErr);
          }
        }
      } catch (error) {
        console.error("Error checking student status:", error);
      }
    };

    checkStudentStatus();
    // assessmentData participates in the effect because the resume path needs
    // it to compute the next-unanswered section.
  }, [navigate, assessmentData]);

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
    questionnaire: any,
    answeredIds: Set<number>,
  ): { sectionId: string | number } | null {
    const sectionsList: SectionWithQuestions[] = questionnaire?.sections || [];
    for (const s of sectionsList) {
      const qs = Array.isArray(s.questions) ? s.questions : [];
      const hasUnanswered = qs.some((q) =>
        typeof q?.questionnaireQuestionId === 'number'
          ? !answeredIds.has(q.questionnaireQuestionId)
          : false,
      );
      if (hasUnanswered) return { sectionId: s.section.sectionId };
    }
    return null;
  }

  const handleSectionClick = (section: Section) => {
    navigate(`/studentAssessment/sections/${section.sectionId}`);
  };

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
                {(loading || !sectionsReady) && (
                  <div className="text-center py-5">
                    <div className="spinner-border" role="status" style={{ width: "3rem", height: "3rem", color: "#5DD68D" }}>
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-3" style={{ color: "#718096" }}>Loading sections...</p>
                  </div>
                )}

                {/* Empty State */}
                {!loading && sectionsReady && sections.length === 0 && (
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
                {!loading && sectionsReady && sections.length > 0 && (
                  <div className="d-flex flex-column gap-3">
                    {sections.map((section, index) => (
                      <div
                        key={section.sectionId}
                        className="section-card card"
                        onClick={() => handleSectionClick(section)}
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
                {!loading && sectionsReady && sections.length > 0 && (
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
