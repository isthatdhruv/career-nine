import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAssessment } from '../contexts/AssessmentContext';
import { usePreventReload } from '../hooks/usePreventReload';
import http from '../api/http';

type Section = {
  sectionId: string | number;
  sectionName: string;
  sectionDescription?: string;
};

const SelectSectionPage: React.FC = () => {
  const [sections, setSections] = useState<Section[]>([]);
  const navigate = useNavigate();
  const { assessmentData, loading } = useAssessment();
  usePreventReload();

  useEffect(() => {
    const checkStudentStatus = async () => {
      const assessmentId = localStorage.getItem('assessmentId');
      const userStudentId = localStorage.getItem('userStudentId');

      if (assessmentId && userStudentId) {
        try {
          const response = await http.get(
            `/assessments/${assessmentId}/student/${userStudentId}`
          );
          const { isActive, studentStatus } = response.data;

          // If assessment is not active OR student has already completed it, redirect
          if (!isActive) {
            alert("This assessment is not active.");
            navigate("/student-login");
            return;
          }

          if (studentStatus === 'completed') {
            alert("You have already completed this assessment.");
            navigate("/student-login");
            return;
          }
        } catch (error) {
          console.error("Error checking student status:", error);
        }
      }

      // Process assessment data if checks pass
      if (assessmentData && assessmentData[0]) {
        try {
          const questionnaire = assessmentData[0];

          // Extract sections from assessmentData
          const sectionsData = questionnaire.sections.map((item: any) => ({
            sectionId: item.section.sectionId,
            sectionName: item.section.sectionName,
            sectionDescription: item.section.sectionDescription || "",
          }));

          setSections(sectionsData || []);
        } catch (error) {
          console.error("Failed to process sections:", error);
        }
      }
    };

    checkStudentStatus();
  }, [assessmentData, navigate]);

  const handleSectionClick = (section: Section) => {
    navigate(`/studentAssessment/sections/${section.sectionId}`);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "2rem 1rem",
        overflowY: "auto",
        colorScheme: "light",
      }}
    >
      <div
        className="card shadow-lg"
        style={{
          width: "700px",
          maxWidth: "95%",
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
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>

          {/* Title */}
          <h2
            className="text-center mb-2"
            style={{
              fontSize: "2.25rem",
              fontWeight: "700",
              color: "#2d3748",
            }}
          >
            Select Section
          </h2>

          {/* Subtitle */}
          <p
            className="text-center mb-5"
            style={{
              color: "#718096",
              fontSize: "1.05rem",
            }}
          >
            Choose a section to begin your assessment
          </p>

          {/* Loading State */}
          {loading && (
            <div
              className="text-center my-5"
              style={{
                padding: "3rem 2rem",
              }}
            >
              <div
                className="spinner-border"
                role="status"
                style={{
                  width: "3rem",
                  height: "3rem",
                  color: "#667eea",
                  marginBottom: "1rem",
                }}
              >
                <span className="visually-hidden">Loading...</span>
              </div>
              <p style={{ color: "#718096", fontSize: "1rem", marginTop: "1rem" }}>
                Loading sections...
              </p>
            </div>
          )}

          {/* Empty State */}
          {!loading && sections.length === 0 && (
            <div
              className="text-center my-5"
              style={{
                padding: "3rem 2rem",
              }}
            >
              <div
                style={{
                  width: "100px",
                  height: "100px",
                  background: "linear-gradient(135deg, #667eea15 0%, #764ba215 100%)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1.5rem",
                }}
              >
                <svg
                  width="50"
                  height="50"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#667eea"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h4 style={{ color: "#4a5568", fontSize: "1.25rem", fontWeight: "600", marginBottom: "0.5rem" }}>
                No Sections Available
              </h4>
              <p style={{ color: "#9ca3af", fontSize: "0.95rem" }}>
                There are no sections to display at this time.
              </p>
            </div>
          )}

          {/* Sections List */}
          {!loading && sections.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {sections.map((section, index) => (
                <div
                  key={section.sectionId}
                  className="card"
                  style={{
                    cursor: "pointer",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    border: "2px solid #e2e8f0",
                    borderRadius: "16px",
                    overflow: "hidden",
                    background: "white",
                  }}
                  onClick={() => handleSectionClick(section)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "0 12px 24px rgba(102, 126, 234, 0.15)";
                    e.currentTarget.style.borderColor = "#667eea";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.borderColor = "#e2e8f0";
                  }}
                >
                  <div
                    className="card-body"
                    style={{
                      padding: "1.5rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1.5rem",
                    }}
                  >
                    {/* Section Number Badge */}
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        minWidth: "48px",
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: "1.25rem",
                        fontWeight: "700",
                        boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
                      }}
                    >
                      {index + 1}
                    </div>

                    {/* Section Content */}
                    <div style={{ flex: 1 }}>
                      <h6
                        style={{
                          marginBottom: section.sectionDescription ? "0.5rem" : "0",
                          fontSize: "1.15rem",
                          fontWeight: "600",
                          color: "#2d3748",
                        }}
                      >
                        {section.sectionName}
                      </h6>
                      {section.sectionDescription && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.9rem",
                            color: "#718096",
                            lineHeight: "1.5",
                          }}
                        >
                          {section.sectionDescription}
                        </p>
                      )}
                    </div>

                    {/* Arrow Icon */}
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        minWidth: "40px",
                        background: "#f7fafc",
                        borderRadius: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.3s ease",
                      }}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#667eea"
                        strokeWidth="2.5"
                      >
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
          {!loading && sections.length > 0 && (
            <div
              className="text-center mt-4"
              style={{
                padding: "1rem",
                background: "#f7fafc",
                borderRadius: "12px",
                marginTop: "2rem",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#718096",
                  fontSize: "0.9rem",
                }}
              >
                💡 Click on any section to begin
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectSectionPage;
