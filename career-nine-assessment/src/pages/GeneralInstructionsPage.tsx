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

  // Extract general instructions from questionnaire languages, excluding NA
  const questionnaire = assessmentData?.[0];
  const languageInstructions: QuestionnaireLanguage[] = questionnaire?.languages?.filter(
    (lang: QuestionnaireLanguage) => lang.instructions && lang.instructions.trim() && !isNA(lang.instructions)
  ) || [];

  // Auto-skip if all instructions are NA or empty
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
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          colorScheme: "light",
        }}
      >
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
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        colorScheme: "light",
      }}
    >
      <div
        className="card shadow-lg"
        style={{
          width: languageInstructions.length > 1 ? "1000px" : "800px",
          maxWidth: "98%",
          borderRadius: "24px",
          border: "none",
          background: "#ffffff",
          colorScheme: "light",
        }}
      >
        <div className="card-body p-5" style={{ background: "#ffffff", color: "#2d3748", borderRadius: "24px" }}>
          {/* Header Icon */}
          <div
            style={{
              width: "100px",
              height: "100px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 2rem",
              boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
            }}
          >
            <svg
              width="50"
              height="50"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>

          {/* Welcome Message */}
          <h2
            className="text-center mb-2"
            style={{
              fontSize: "2.5rem",
              fontWeight: "700",
              color: "#2d3748",
              lineHeight: "1.2",
            }}
          >
            General Instructions
          </h2>

          <p
            className="text-center mb-5"
            style={{
              color: "#718096",
              fontSize: "1.1rem",
              marginTop: "1rem",
            }}
          >
            Please read the instructions carefully before proceeding
          </p>

          {/* Instructions from DB */}
          {languageInstructions.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: languageInstructions.length > 1 ? "1fr 1px 1fr" : "1fr",
                gap: "2rem",
                marginBottom: "3rem",
              }}
            >
              {languageInstructions.map((lang, index) => (
                <React.Fragment key={lang.id}>
                  <div>
                    {/* Language Badge */}
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        backgroundColor: "#eef2ff",
                        color: "#667eea",
                        padding: "0.5rem 1rem",
                        borderRadius: "50px",
                        fontSize: "0.9rem",
                        fontWeight: "600",
                        marginBottom: "1rem",
                        border: "2px solid #667eea30",
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                      {lang.language.languageName}
                    </div>

                    {/* Instruction Box */}
                    <div
                      style={{
                        backgroundColor: "#f7fafc",
                        border: "2px solid #e2e8f0",
                        borderRadius: "16px",
                        padding: "2rem",
                        minHeight: "200px",
                        whiteSpace: "pre-line",
                        fontSize: "1.05rem",
                        lineHeight: "1.8",
                        color: "#2d3748",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                      }}
                    >
                      {lang.instructions}
                    </div>
                  </div>

                  {/* Divider only between columns */}
                  {index === 0 && languageInstructions.length > 1 && (
                    <div
                      style={{
                        width: "1px",
                        backgroundColor: "#e2e8f0",
                        alignSelf: "stretch",
                      }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          ) : (
            /* Fallback when no instructions exist in DB */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
                marginBottom: "3rem",
              }}
            >
              {[
                {
                  icon: "\u{1F4DD}",
                  text: 'This is <strong style="color: #667eea">NOT a school exam</strong>. You won\'t get a "grade" like A or B.',
                },
                {
                  icon: "\u{1F4AD}",
                  text: 'There are <strong style="color: #667eea">no wrong answers</strong>. We just want to see how you think and how you feel.',
                },
                {
                  icon: "\u{2728}",
                  text: 'Just <strong style="color: #667eea">be yourself</strong>! Some parts are games and some parts are questions. Take your time and have fun!',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "linear-gradient(135deg, #667eea10 0%, #764ba210 100%)",
                    border: "2px solid #667eea30",
                    borderRadius: "16px",
                    padding: "1.5rem",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "1.25rem",
                  }}
                >
                  <div
                    style={{
                      width: "50px",
                      height: "50px",
                      minWidth: "50px",
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.75rem",
                      boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
                    }}
                  >
                    {item.icon}
                  </div>
                  <div style={{ flex: 1, paddingTop: "0.25rem" }}>
                    <p
                      style={{
                        margin: 0,
                        color: "#2d3748",
                        fontSize: "1.5rem",
                        lineHeight: "1.7",
                        fontWeight: "500",
                      }}
                      dangerouslySetInnerHTML={{ __html: item.text }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info Box */}
          <div
            style={{
              background: "linear-gradient(135deg, #667eea10 0%, #764ba210 100%)",
              border: "2px solid #667eea30",
              borderRadius: "16px",
              padding: "1.25rem 1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              marginBottom: "2.5rem",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                minWidth: "40px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  color: "#4a5568",
                  fontSize: "0.95rem",
                  fontWeight: "500",
                }}
              >
                <strong style={{ color: "#2d3748" }}>Ready to begin?</strong> Make sure you've
                read and understood all the instructions before starting.
              </p>
            </div>
          </div>

          {/* Start Button */}
          <div className="text-center">
            <button
              className="btn"
              onClick={() => navigate("/studentAssessment")}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                padding: "1.15rem 4rem",
                borderRadius: "14px",
                fontSize: "1.2rem",
                fontWeight: "600",
                border: "none",
                boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
                transition: "all 0.3s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.4)";
              }}
            >
              <span>I'm Ready to Start!</span>
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>

          {/* Footer Note */}
          <p
            className="text-center mt-4"
            style={{
              color: "#9ca3af",
              fontSize: "0.9rem",
              margin: "1.5rem 0 0 0",
            }}
          >
            Click the button above when you're ready to begin your journey
          </p>
        </div>
      </div>
    </div>
  );
};

export default GeneralInstructionsPage;
