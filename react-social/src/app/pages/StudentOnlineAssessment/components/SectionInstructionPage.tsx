import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAssessment } from "../../StudentLogin/AssessmentContext";
import { usePreventReload } from "../../StudentLogin/usePreventReload";

type Language = {
  languageId: number;
  languageName: string;
};

type Instruction = {
  questionnaireSectionInstructionId: number;
  instructionText: string;
  language: Language;
};

const SectionInstructionPage: React.FC = () => {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const { assessmentData } = useAssessment();
  usePreventReload();

  const [instructions, setInstructions] = useState<Instruction[] | null>(null);

  useEffect(() => {
    if (assessmentData && assessmentData[0]) {
      const questionnaire = assessmentData[0];

      // 🔍 Find section by sectionId
      const section = questionnaire.sections.find(
        (sec: any) => String(sec.section.sectionId) === String(sectionId)
      );

      if (!section || !section.instruction || section.instruction.length === 0) {
        // No instructions available - skip directly to questions
        navigate(`/studentAssessment/sections/${sectionId}/questions/0`, { replace: true });
        return;
      }

      setInstructions(section.instruction);
    }
  }, [sectionId, assessmentData, navigate]);

  // Show loading while checking for instructions
  if (instructions === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="text-center">
          <div className="spinner-border text-light" role="status" style={{ width: "3rem", height: "3rem" }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-white fw-semibold">Loading section...</p>
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
      }}
    >
      <div
        className="card shadow-lg"
        style={{
          width: "1000px",
          maxWidth: "98%",
          borderRadius: "24px",
          border: "none",
        }}
      >
        <div className="card-body p-5">
          {/* Header Icon */}
          <div
            style={{
              width: "80px",
              height: "80px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
              boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
            }}
          >
            <svg
              width="40"
              height="40"
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

          {/* Heading */}
          <h2
            className="text-center mb-2"
            style={{
              fontSize: "2.25rem",
              fontWeight: "700",
              color: "#2d3748",
            }}
          >
            Section Instructions
          </h2>
          <p
            className="text-center mb-5"
            style={{
              color: "#718096",
              fontSize: "1.05rem",
            }}
          >
            Please read the instructions carefully before proceeding
          </p>

          {/* Instructions Content */}
          {instructions.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: instructions.length > 1 ? "1fr 1px 1fr" : "1fr",
                gap: "2rem",
                marginBottom: "2.5rem",
              }}
            >
              {instructions.map((inst, index) => (
                <React.Fragment key={inst.questionnaireSectionInstructionId}>
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
                      {inst.language.languageName}
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
                      {inst.instructionText}
                    </div>
                  </div>

                  {/* Divider only between columns */}
                  {index === 0 && instructions.length > 1 && (
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
              onClick={() =>
                navigate(
                  `/studentAssessment/sections/${sectionId}/questions/0`
                )
              }
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                padding: "1rem 3.5rem",
                borderRadius: "14px",
                fontSize: "1.15rem",
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
              <span>Start Assessment</span>
              <svg
                width="20"
                height="20"
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
            Click the button above when you're ready to begin
          </p>
        </div>
      </div>
    </div>
  );
};

export default SectionInstructionPage;