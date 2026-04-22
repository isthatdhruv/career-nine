import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReadAssessmentList } from "./API/Create_Assessment_APIs";
import { AssessmentTable } from "./components";
import AssessmentCreateModal from "./components/assessment/AssessmentCreateModal";
import PageHeader from "../../components/PageHeader";

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
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-clipboard-check" />}
        title="Assessments"
        subtitle={
          (loading || isDataLoading) ? (
            "Loading..."
          ) : (
            <>
              <strong>{assessmentData.length}</strong> assessments configured
            </>
          )
        }
        actions={[
          {
            label: "Create Assessment",
            iconClass: "bi-plus-lg",
            onClick: () => navigate("/assessments/create"),
            variant: "primary",
          },
        ]}
      />

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
