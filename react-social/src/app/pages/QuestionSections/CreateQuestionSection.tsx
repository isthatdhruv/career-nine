import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReadQuestionSectionDataList } from "./API/Question_Section_APIs";
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
      ReadQuestionSectionDataList().then((data) => {
        setQuestionSectionData(data.data);
        setLoading(false);
      });
    } catch (error) {
      console.error(error);
    }
  }, [pageLoading]);

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px" }}>
      {/* Page Header */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3" style={{ marginBottom: "24px" }}>
        <div className="d-flex align-items-center gap-3">
          <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="bi bi-collection-fill text-white" style={{ fontSize: "1.1rem" }}></i>
          </div>
          <div>
            <h4 style={{ margin: 0, color: "#111827", fontWeight: 700, fontSize: "1.3rem" }}>
              Assessment Sections
            </h4>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "0.82rem" }}>
              {loading ? "Loading..." : `${questionSectionData.length} sections`}
            </p>
          </div>
        </div>

        <div className="d-flex gap-2">
          <button
            className="btn btn-sm d-flex align-items-center gap-1"
            onClick={() => setShowRecycleBin(true)}
            style={{ background: "#fff", color: "#dc2626", border: "2px solid #dc2626", borderRadius: "6px", padding: "8px 14px", fontWeight: 600, fontSize: "0.82rem" }}
          >
            <i className="bi bi-recycle"></i>
            Recycle Bin
          </button>
          <button
            className="btn btn-sm d-flex align-items-center gap-1"
            onClick={() => navigate("/question-sections/create")}
            style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: "6px", padding: "8px 14px", fontWeight: 600, fontSize: "0.82rem" }}
          >
            <i className="bi bi-plus-lg"></i>
            Add Section
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "48px", textAlign: "center" }}>
          <div className="spinner-border" style={{ color: "#7c3aed" }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3" style={{ color: "#6b7280" }}>Loading sections...</p>
        </div>
      )}

      {/* Table Card */}
      {!loading && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "16px" }}>
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
