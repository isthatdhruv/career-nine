import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAssessment } from "../../StudentLogin/AssessmentContext";
import axios from "axios";

type Section = {
  sectionId: string | number;
  sectionName: string;
  sectionDescription?: string;
};

const SelectSectionPage: React.FC = () => {
  const [sections, setSections] = useState<Section[]>([]);
  const navigate = useNavigate();
  const { assessmentData, loading } = useAssessment();

  useEffect(() => {
    const checkStudentStatus = async () => {
      const assessmentId = localStorage.getItem('assessmentId');
      const userStudentId = localStorage.getItem('userStudentId');

      if (assessmentId && userStudentId) {
        try {
          const response = await axios.get(
            `${process.env.REACT_APP_API_URL}/assessments/${assessmentId}/student/${userStudentId}`
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