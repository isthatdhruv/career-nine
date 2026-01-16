import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAssessment } from "../../StudentLogin/AssessmentContext";

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

  const [instructions, setInstructions] = useState<Instruction[]>([]);

  useEffect(() => {
    if (assessmentData && assessmentData[0]) {
      const questionnaire = assessmentData[0];

      // 🔍 Find section by sectionId
      const section = questionnaire.sections.find(
        (sec: any) => String(sec.section.sectionId) === String(sectionId)
      );

      if (!section || !section.instruction) {
        setInstructions([]);
        return;
      }

      setInstructions(section.instruction);
    }
  }, [sectionId, assessmentData]);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8f9fa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div className="card shadow-sm" style={{ width: 900, maxWidth: "96%" }}>
        <div className="card-body p-5">
          {/* Heading */}
          <h2 className="text-center mb-2 fw-bold">Instructions</h2>
          <p className="text-center text-muted mb-4">
            Please read the instructions carefully before proceeding
          </p>

          {/* 🧩 SIDE BY SIDE INSTRUCTIONS */}
          {instructions.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1px 1fr",
                gap: 20,
              }}
            >
              {instructions.map((inst, index) => (
                <React.Fragment key={inst.questionnaireSectionInstructionId}>
                  <div>
                    <h6 className="fw-bold mb-2">
                      {inst.language.languageName}
                    </h6>
                    <div
                      className="border rounded p-3"
                      style={{
                        backgroundColor: "#ffffff",
                        minHeight: 150,
                        whiteSpace: "pre-line",
                        fontSize: "1rem",
                      }}
                    >
                      {inst.instructionText}
                    </div>
                  </div>

                  {/* Divider only between columns */}
                  {index === 0 && (
                    <div
                      style={{
                        width: 1,
                        backgroundColor: "#dee2e6",
                      }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted mt-4">
              No instructions available
            </div>
          )}

          {/* ▶ Start Button */}
          <div className="text-center mt-5">
            <button
              className="btn btn-success px-5 py-2"
              onClick={() =>
                navigate(
                  `/studentAssessment/sections/${sectionId}/questions/0`
                )
              }
            >
              Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SectionInstructionPage;