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
    <div style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px" }}>
      {/* Page Header */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3" style={{ marginBottom: "24px" }}>
        <div className="d-flex align-items-center gap-3">
          <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="bi bi-clipboard-data-fill text-white" style={{ fontSize: "1.1rem" }}></i>
          </div>
          <div>
            <h4 style={{ margin: 0, color: "#111827", fontWeight: 700, fontSize: "1.3rem" }}>Assessments</h4>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "0.82rem" }}>
              {(loading || isDataLoading) ? "Loading..." : `${assessmentData.length} assessments configured`}
            </p>
          </div>
        </div>
        <button
          className="btn d-flex align-items-center gap-2"
          onClick={() => navigate("/assessments/create")}
          style={{ background: "#059669", color: "#fff", border: "none", borderRadius: "6px", padding: "8px 16px", fontWeight: 600, fontSize: "0.85rem" }}
        >
          <i className="bi bi-plus-lg"></i>
          Create Assessment
        </button>
      </div>

      {/* Loading */}
      {(loading || isDataLoading) && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "48px", textAlign: "center" }}>
          <div className="spinner-border" style={{ color: "#059669" }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3" style={{ color: "#6b7280" }}>Loading assessments...</p>
        </div>
      )}

      {/* Table */}
      {!loading && !isDataLoading && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "16px" }}>
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
