import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReadQuestionSectionData } from "./API/Question_Section_APIs";
import QuestionSectionTable from "./components/QuestionSectionTable";
import QuestionSectionRecycleBinModal from "./components/QuestionSectionRecycleBinModal";

const QuestionSectionPage = () => {
  const [questionSectionData, setQuestionSectionData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(["false"]);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    try {
      ReadQuestionSectionData().then((data) => {
        setQuestionSectionData(data.data);
        setLoading(false);
      });
    } catch (error) {
      console.error(error);
    }
  }, [pageLoading]);

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
                  background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <i className="bi bi-collection-fill text-white" style={{ fontSize: "1.2rem" }}></i>
              </div>
              <div>
                <h5 className="mb-0 fw-bold" style={{ color: "#1a1a2e" }}>
                  Assessment Sections
                </h5>
                <p className="text-muted mb-0" style={{ fontSize: "0.82rem" }}>
                  {loading ? "Loading..." : `${questionSectionData.length} sections`}
                </p>
              </div>
            </div>

            <div className="d-flex gap-2">
              <button
                className="btn btn-sm d-flex align-items-center gap-1"
                onClick={() => setShowRecycleBin(true)}
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
                onClick={() => navigate("/question-sections/create")}
                style={{
                  background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px 14px",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                }}
              >
                <i className="bi bi-plus-lg"></i>
                Add Section
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
            <p className="mt-3 text-muted">Loading sections...</p>
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
            <QuestionSectionTable
              data={questionSectionData}
              setLoading={setLoading}
              setPageLoading={setPageLoading}
            />
          </div>
        </div>
      )}

      <QuestionSectionRecycleBinModal
        show={showRecycleBin}
        onHide={() => setShowRecycleBin(false)}
        onRestoreComplete={() => setPageLoading([String(Date.now())])}
      />
    </div>
  );
};

export default QuestionSectionPage;
