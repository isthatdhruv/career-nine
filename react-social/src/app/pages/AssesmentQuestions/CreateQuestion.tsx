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
    <div style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px" }}>
      {/* Page Header */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3" style={{ marginBottom: "24px" }}>
        <div className="d-flex align-items-center gap-3">
          <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="bi bi-question-circle-fill text-white" style={{ fontSize: "1.1rem" }}></i>
          </div>
          <div>
            <h4 style={{ margin: 0, color: "#111827", fontWeight: 700, fontSize: "1.3rem" }}>
              Assessment Questions
            </h4>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "0.82rem" }}>
              {loading ? "Loading..." : `${questionsData.length} questions across ${sections.length} sections`}
            </p>
          </div>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <button
            className="btn btn-sm d-flex align-items-center gap-1"
            onClick={() => navigate("/assessment-questions/duplicates")}
            style={{ background: "#fff", color: "#d97706", border: "2px solid #d97706", borderRadius: "6px", padding: "8px 14px", fontWeight: 600, fontSize: "0.82rem" }}
          >
            <i className="bi bi-files"></i>
            Find Duplicates
          </button>
          <button
            className="btn btn-sm d-flex align-items-center gap-1"
            onClick={() => setShowRecycleBinModal(true)}
            style={{ background: "#fff", color: "#dc2626", border: "2px solid #dc2626", borderRadius: "6px", padding: "8px 14px", fontWeight: 600, fontSize: "0.82rem" }}
          >
            <i className="bi bi-recycle"></i>
            Recycle Bin
          </button>
          <button
            className="btn btn-sm d-flex align-items-center gap-1"
            onClick={() => navigate("/assessment-questions/create")}
            style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", padding: "8px 14px", fontWeight: 600, fontSize: "0.82rem" }}
          >
            <i className="bi bi-plus-lg"></i>
            Add Question
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "48px", textAlign: "center" }}>
          <div className="spinner-border" style={{ color: "#2563eb" }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3" style={{ color: "#6b7280" }}>Loading questions...</p>
        </div>
      )}

      {/* Table Card */}
      {!loading && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "16px" }}>
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
