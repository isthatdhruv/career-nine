import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAssessment } from '../contexts/AssessmentContext';
import { usePreventReload } from '../hooks/usePreventReload';

type Language = {
  languageId: number;
  languageName: string;
};

type Instruction = {
  questionnaireSectionInstructionId: number;
  instructionText: string;
  language: Language;
};

const isNA = (text: string | null | undefined): boolean => {
  if (!text) return false;
  const trimmed = text.trim().toUpperCase();
  return trimmed === 'NA' || trimmed === 'N/A';
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
      const section = questionnaire.sections.find(
        (sec: any) => String(sec.section.sectionId) === String(sectionId)
      );

      if (!section || !section.instruction || section.instruction.length === 0) {
        navigate(`/studentAssessment/sections/${sectionId}/questions/0`, { replace: true });
        return;
      }

      const nonNAInstructions = section.instruction.filter(
        (inst: any) => inst.instructionText && !isNA(inst.instructionText)
      );

      if (nonNAInstructions.length === 0) {
        navigate(`/studentAssessment/sections/${sectionId}/questions/0`, { replace: true });
        return;
      }

      setInstructions(nonNAInstructions);
    }
  }, [sectionId, assessmentData, navigate]);

  if (instructions === null) {
    return (
      <div className="assessment-bg">
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
    <div className="assessment-bg">
      <div className="container">
        <div className="row justify-content-center">
          <div className={`col-12 ${instructions.length > 1 ? 'col-xl-10' : 'col-lg-8 col-xl-7'}`}>
            <div className="assessment-card card shadow-lg">
              <div className="card-body p-3 p-sm-4 p-md-5">
                {/* Header Icon */}
                <div className="assessment-icon-circle--lg mx-auto">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>

                <h2 className="text-center assessment-heading">Section Instructions</h2>
                <p className="text-center assessment-subheading mb-4">
                  Please read the instructions carefully before proceeding
                </p>

                {/* Instructions Content */}
                {instructions.length > 0 && (
                  <div className={`instructions-grid ${instructions.length > 1 ? 'instructions-grid--dual' : 'instructions-grid--single'}`} style={{ marginBottom: '2rem' }}>
                    {instructions.map((inst, index) => (
                      <React.Fragment key={inst.questionnaireSectionInstructionId}>
                        <div>
                          <div className="language-badge">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="2" y1="12" x2="22" y2="12" />
                              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                            {inst.language.languageName}
                          </div>
                          <div className="instruction-box">{inst.instructionText}</div>
                        </div>
                        {index === 0 && instructions.length > 1 && (
                          <div className="instructions-divider" />
                        )}
                      </React.Fragment>
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
                    onClick={() => navigate(`/studentAssessment/sections/${sectionId}/questions/0`)}
                    style={{ fontSize: '1.05rem', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}
                  >
                    <span>Start Assessment</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
                </div>

                <p className="text-center mt-3" style={{ color: "#9ca3af", fontSize: "0.85rem" }}>
                  Click the button above when you're ready to begin
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SectionInstructionPage;
