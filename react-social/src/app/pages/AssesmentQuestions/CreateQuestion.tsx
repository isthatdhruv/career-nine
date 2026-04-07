import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReadQuestionSectionData } from "../QuestionSections/API/Question_Section_APIs";
import { ReadQuestionsDataList } from "./API/Question_APIs";
import { QuestionTable } from "./components";
import QuestionRecycleBinModal from "./components/QuestionRecycleBinModal";

const AssessmentQuestionsPage = () => {
  const [questionsData, setQuestionsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(["false"]);
  const [showRecycleBinModal, setShowRecycleBinModal] = useState(false);
  const navigate = useNavigate();

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const response = await ReadQuestionsDataList();
      setQuestionsData(response.data);
    } catch (error) {
      console.error("Failed to fetch questions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchSections = async () => {
      setLoading(true);
      try {
        const response = await ReadQuestionSectionData();
        setSections(response.data);
      } catch (error) {
        console.error("Error fetching sections:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSections();
  }, []);

  useEffect(() => {
    fetchQuestions();
    if (pageLoading[0] === "true") {
      setPageLoading(["false"]);
    }
  }, [pageLoading[0]]);

  return (
    <div
      className="min-vh-100"
      style={{
        background: "linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)",
        padding: "1rem 1.25rem",
      }}
    >
      {/* Header Card */}
      <div
        className="card border-0 shadow-sm mb-3"
        style={{ borderRadius: "12px" }}
      >
        <div className="card-body p-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-3">
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <i className="bi bi-question-circle-fill text-white" style={{ fontSize: "1.2rem" }}></i>
              </div>
              <div>
                <h5 className="mb-0 fw-bold" style={{ color: "#1a1a2e" }}>
                  Assessment Questions
                </h5>
                <p className="text-muted mb-0" style={{ fontSize: "0.82rem" }}>
                  {loading ? "Loading..." : `${questionsData.length} questions · ${sections.length} sections`}
                </p>
              </div>
            </div>

            <div className="d-flex gap-2 flex-wrap">
              <button
                className="btn btn-sm d-flex align-items-center gap-1"
                onClick={() => navigate("/assessment-questions/duplicates")}
                style={{
                  background: "rgba(245, 158, 11, 0.1)",
                  color: "#d97706",
                  border: "1px solid rgba(245, 158, 11, 0.2)",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                }}
              >
                <i className="bi bi-files"></i>
                Find Duplicates
              </button>
              <button
                className="btn btn-sm d-flex align-items-center gap-1"
                onClick={() => setShowRecycleBinModal(true)}
                style={{
                  background: "rgba(220, 38, 38, 0.1)",
                  color: "#dc2626",
                  border: "1px solid rgba(220, 38, 38, 0.2)",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                }}
              >
                <i className="bi bi-recycle"></i>
                Recycle Bin
              </button>
              <button
                className="btn btn-sm d-flex align-items-center gap-1"
                onClick={() => navigate("/assessment-questions/create")}
                style={{
                  background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px 14px",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                }}
              >
                <i className="bi bi-plus-lg"></i>
                Add Question
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: "12px" }}>
          <div className="card-body text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted">Loading questions...</p>
          </div>
        </div>
      )}

      {/* Table Card */}
      {!loading && (
        <div
          className="card border-0 shadow-sm"
          style={{ borderRadius: "12px", overflow: "hidden" }}
        >
          <div className="card-body p-3">
            <QuestionTable
              data={questionsData}
              sections={sections}
              setPageLoading={setPageLoading}
            />
          </div>
        </div>
      )}

      <QuestionRecycleBinModal
        show={showRecycleBinModal}
        onHide={() => setShowRecycleBinModal(false)}
        onRestoreComplete={() => setPageLoading(["true"])}
        sections={sections}
      />
    </div>
  );
};

export default AssessmentQuestionsPage;
