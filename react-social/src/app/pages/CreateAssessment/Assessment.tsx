import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReadAssessmentList } from "./API/Create_Assessment_APIs";
import { AssessmentTable } from "./components";
import AssessmentCreateModal from "./components/assessment/AssessmentCreateModal";

const AssessmentPage = () => {
  const [assessmentData, setAssessmentData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [sections, setSections] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(["false"]);
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsDataLoading(true);
      try {
        const response = await ReadAssessmentList();
        setAssessmentData(response.data || []);
      } catch (error) {
        console.error("Error fetching assessments:", error);
        setAssessmentData([]);
      } finally {
        setIsDataLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (pageLoading[0] === "true") {
      const fetchData = async () => {
        setIsDataLoading(true);
        try {
          const response = await ReadAssessmentList();
          setAssessmentData(response.data || []);
        } catch (error) {
          console.error("Error refreshing assessments:", error);
        } finally {
          setIsDataLoading(false);
          setPageLoading(["false"]);
        }
      };
      fetchData();
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
      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: "12px" }}>
        <div className="card-body p-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-3">
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <i className="bi bi-clipboard-data-fill text-white" style={{ fontSize: "1.2rem" }}></i>
              </div>
              <div>
                <h5 className="mb-0 fw-bold" style={{ color: "#1a1a2e" }}>Assessments</h5>
                <p className="text-muted mb-0" style={{ fontSize: "0.82rem" }}>
                  {(loading || isDataLoading) ? "Loading..." : `${assessmentData.length} assessments`}
                </p>
              </div>
            </div>
            <button
              className="btn btn-sm d-flex align-items-center gap-1"
              onClick={() => navigate("/assessments/create")}
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "6px 14px",
                fontWeight: 600,
                fontSize: "0.82rem",
              }}
            >
              <i className="bi bi-plus-lg"></i>
              Create Assessment
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {(loading || isDataLoading) && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: "12px" }}>
          <div className="card-body text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted">Loading assessments...</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !isDataLoading && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: "12px", overflow: "hidden" }}>
          <div className="card-body p-3">
            <AssessmentTable
              data={assessmentData}
              setLoading={setLoading}
              setPageLoading={setPageLoading}
            />
          </div>
        </div>
      )}

      <AssessmentCreateModal
        show={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        setPageLoading={setPageLoading}
      />
    </div>
  );
};

export default AssessmentPage;
