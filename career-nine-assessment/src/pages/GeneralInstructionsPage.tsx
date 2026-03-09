import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAssessment } from '../contexts/AssessmentContext';
import { usePreventReload } from '../hooks/usePreventReload';

const isNA = (text: string | null | undefined): boolean => {
  if (!text) return false;
  const trimmed = text.trim().toUpperCase();
  return trimmed === 'NA' || trimmed === 'N/A';
};

type Language = {
  languageId: number;
  languageName: string;
};

type QuestionnaireLanguage = {
  id: number;
  language: Language;
  instructions: string;
};

const GeneralInstructionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { assessmentData, loading } = useAssessment();
  usePreventReload();

  const questionnaire = assessmentData?.[0];
  const languageInstructions: QuestionnaireLanguage[] = questionnaire?.languages?.filter(
    (lang: QuestionnaireLanguage) => lang.instructions && lang.instructions.trim() && !isNA(lang.instructions)
  ) || [];

  useEffect(() => {
    if (!loading && questionnaire) {
      const validInstructions = questionnaire.languages?.filter(
        (lang: any) => lang.instructions && lang.instructions.trim() && !isNA(lang.instructions)
      ) || [];

      if (validInstructions.length === 0) {
        navigate("/studentAssessment", { replace: true });
      }
    }
  }, [loading, questionnaire, navigate]);

  if (loading) {
    return (
      <div className="assessment-bg">
        <div className="text-center">
          <div className="spinner-border text-light" role="status" style={{ width: "3rem", height: "3rem" }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-white fw-semibold">Loading instructions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assessment-bg">
      <div className="container">
        <div className="row justify-content-center">
          <div className={`col-12 ${languageInstructions.length > 1 ? 'col-xl-10' : 'col-lg-8 col-xl-7'}`}>
            <div className="assessment-card card shadow-lg">
              <div className="card-body p-3 p-sm-4 p-md-5">
                {/* Header Icon */}
                <div className="assessment-icon-circle--lg mx-auto">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>

                <h2 className="text-center assessment-heading">General Instructions</h2>
                <p className="text-center assessment-subheading mb-4">
                  Please read the instructions carefully before proceeding
                </p>

                {/* Instructions from DB */}
                {languageInstructions.length > 0 ? (
                  <div className={`instructions-grid ${languageInstructions.length > 1 ? 'instructions-grid--dual' : 'instructions-grid--single'}`} style={{ marginBottom: '2rem' }}>
                    {languageInstructions.map((lang, index) => (
                      <React.Fragment key={lang.id}>
                        <div>
                          <div className="language-badge">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="2" y1="12" x2="22" y2="12" />
                              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                            {lang.language.languageName}
                          </div>
                          <div className="instruction-box">{lang.instructions}</div>
                        </div>
                        {index === 0 && languageInstructions.length > 1 && (
                          <div className="instructions-divider" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3 mb-4">
                    {[
                      { icon: "\u{1F4DD}", text: 'This is <strong style="color: #667eea">NOT a school exam</strong>. You won\'t get a "grade" like A or B.' },
                      { icon: "\u{1F4AD}", text: 'There are <strong style="color: #667eea">no wrong answers</strong>. We just want to see how you think and how you feel.' },
                      { icon: "\u{2728}", text: 'Just <strong style="color: #667eea">be yourself</strong>! Some parts are games and some parts are questions. Take your time and have fun!' },
                    ].map((item, idx) => (
                      <div key={idx} className="instruction-card-item">
                        <div
                          className="icon-box"
                          style={{
                            width: "45px",
                            height: "45px",
                            minWidth: "45px",
                            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                            borderRadius: "12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.5rem",
                            boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
                          }}
                        >
                          {item.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, color: "#2d3748" }} dangerouslySetInnerHTML={{ __html: item.text }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Info Box */}
                <div className="assessment-info-box">
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      minWidth: "36px",
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                  <p style={{ margin: 0, color: "#4a5568", fontSize: "0.9rem", fontWeight: "500" }}>
                    <strong style={{ color: "#2d3748" }}>Ready to begin?</strong> Make sure you've read and understood all the instructions before starting.
                  </p>
                </div>

                {/* Start Button */}
                <div className="text-center">
                  <button
                    className="btn btn-assessment-primary px-4 px-md-5 py-2 py-md-3"
                    onClick={() => navigate("/studentAssessment")}
                    style={{ fontSize: '1.05rem', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}
                  >
                    <span>I'm Ready to Start!</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
                </div>

                <p className="text-center mt-3" style={{ color: "#9ca3af", fontSize: "0.85rem" }}>
                  Click the button above when you're ready to begin your journey
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralInstructionsPage;
