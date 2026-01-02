import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = process.env.REACT_APP_API_URL;
const readQuestionSection = `${API_URL}/question-sections/getAll`;

type Section = {
  sectionId: string | number;
  sectionName: string;
  sectionDescription?: string;
};

const SelectSectionPage: React.FC = () => {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchSections = async () => {
    setLoading(true);
    try {
      const response = await fetch(readQuestionSection);
      const data = await response.json();
      setSections(data || []);
    } catch (error) {
      console.error("Failed to fetch sections:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const handleSectionClick = (section: Section) => {
    navigate(`/studentAssessment/sections/${section.sectionId}`);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100vw",
        backgroundColor: "#f8f9fa",
        position: "fixed",
        top: 0,
        left: 0,
      }}
    >
      <div className="card shadow-sm" style={{ width: "550px", maxWidth: "92%" }}>
        <div className="card-body p-5">
          <h2
            className="text-center mb-4"
            style={{ fontSize: "2rem", fontWeight: 600 }}
          >
            Select Section
          </h2>

          <p className="text-center text-muted mb-4">
            Choose a section to continue
          </p>

          {loading && (
            <div className="text-center my-4">
              <span className="spinner-border spinner-border-sm me-2" />
              Loading sections...
            </div>
          )}

          {!loading && sections.length === 0 && (
            <div className="text-center text-muted">
              No sections available
            </div>
          )}

          {!loading && sections.length > 0 && (
            <div className="d-flex flex-column gap-3">
              {sections.map((section) => (
                <div
                  key={section.sectionId}
                  className="card border"
                  style={{
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => handleSectionClick(section)}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.boxShadow =
                      "0 4px 12px rgba(0,0,0,0.08)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.boxShadow = "none")
                  }
                >
                  <div className="card-body py-3 px-4 d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="mb-1">{section.sectionName}</h6>
                      {section.sectionDescription && (
                        <small className="text-muted">
                          {section.sectionDescription}
                        </small>
                      )}
                    </div>

                    <span className="text-muted">➜</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectSectionPage;
