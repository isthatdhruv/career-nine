import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_URL = process.env.REACT_APP_API_URL;

type Language = {
  languageId: string; // EN, HI, FR, etc
  languageName?: string; // English, Hindi, French
};

type Instruction = {
  questionnaireSectionInstructionId: number;
  instructionText: string;
  languageName: Language;
};

const SectionInstructionPage: React.FC = () => {
  const { sectionId } = useParams();
  const navigate = useNavigate();

  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>([]);
  const [selectedLang, setSelectedLang] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // ✅ FETCH INSTRUCTIONS
  const fetchInstructions = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/questionnaire-section-instructions/by-section/${sectionId}`
      );

      const result = await response.json();

      const instructionArray: Instruction[] = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
        ? result.data
        : [];

      setInstructions(instructionArray);

      // ✅ Extract unique languages from DB response
      const langsMap = new Map<string, Language>();
      instructionArray.forEach((inst) => {
        if (inst.languageName?.languageId) {
          langsMap.set(inst.languageName.languageId, inst.languageName);
        }
      });

      const langs = Array.from(langsMap.values());
      setAvailableLanguages(langs);

      // ✅ Auto select first available language
      if (langs.length > 0) {
        setSelectedLang(langs[0].languageId);
      }
    } catch (error) {
      console.error("Failed to fetch instructions:", error);
      setInstructions([]);
      setAvailableLanguages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstructions();
  }, [sectionId]);

  // ✅ SAFE FIND BASED ON SELECTED LANGUAGE
  const activeInstruction =
    instructions.find(
      (i) => i.languageName?.languageId === selectedLang
    ) || null;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8f9fa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div className="card shadow-sm" style={{ width: "720px", maxWidth: "96%" }}>
        <div className="card-body p-5">
          {/* Heading */}
          <h2 className="text-center mb-3 fw-bold">Instructions</h2>

          <p className="text-center text-muted mb-4">
            Please read the instructions carefully before proceeding
          </p>

          {/* ✅ Dynamic Language Buttons */}
          {availableLanguages.length > 0 && (
            <div className="d-flex justify-content-center gap-3 mb-4 flex-wrap">
              {availableLanguages.map((lang) => (
                <button
                  key={lang.languageId}
                  className={`btn ${
                    selectedLang === lang.languageId
                      ? "btn-primary"
                      : "btn-outline-primary"
                  }`}
                  onClick={() => setSelectedLang(lang.languageId)}
                >
                  {lang.languageName || lang.languageId}
                </button>
              ))}
            </div>
          )}

          {/* Loader */}
          {loading && (
            <div className="text-center my-4">
              <span className="spinner-border spinner-border-sm me-2" />
              Loading instructions...
            </div>
          )}

          {/* Instruction Content */}
          {!loading && activeInstruction && (
            <div
              className="border rounded p-4"
              style={{
                backgroundColor: "#ffffff",
                minHeight: "180px",
                whiteSpace: "pre-line",
                fontSize: "1rem",
              }}
            >
              {activeInstruction.instructionText}
            </div>
          )}

          {!loading && !activeInstruction && (
            <div className="text-center text-muted mt-4">
              No instructions available for selected language
            </div>
          )}

          {/* Start Button */}
          <div className="text-center mt-5">
            <button
              className="btn btn-success px-5 py-2"
              disabled={!activeInstruction}
              onClick={() =>
                navigate(`/studentAssessment/sections/${sectionId}/questions`)
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
