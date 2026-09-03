import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "react-query";
import { useQuestionSections, lookupKeys } from "../../lib/queries/lookups";
import QuestionSectionTable from "./components/QuestionSectionTable";
import QuestionSectionRecycleBinModal from "./components/QuestionSectionRecycleBinModal";
import PageHeader from "../../components/PageHeader";

const QuestionSectionPage = () => {
  const { data: questionSectionData = [], isLoading } = useQuestionSections<any>();
  const queryClient = useQueryClient();
  const [pageLoading, setPageLoading] = useState(["false"]);
  // Busy state for the table's delete action (QuestionSectionTable calls setLoading around it).
  const [deleting, setDeleting] = useState(false);
  const loading = isLoading || deleting;
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (pageLoading[0] === "true") {
      queryClient.invalidateQueries(lookupKeys.questionSections);
      setPageLoading(["false"]);
    }
  }, [pageLoading, queryClient]);

  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-collection" />}
        title="Assessment Sections"
        subtitle={
          loading ? (
            "Loading..."
          ) : (
            <>
              <strong>{questionSectionData.length}</strong> sections
            </>
          )
        }
        actions={[
          {
            label: "Add Section",
            iconClass: "bi-plus-lg",
            onClick: () => navigate("/question-sections/create"),
            variant: "primary",
          },
          {
            label: "Recycle Bin",
            iconClass: "bi-recycle",
            onClick: () => setShowRecycleBin(true),
            variant: "danger",
          },
        ]}
      />

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
              setLoading={setDeleting}
              setPageLoading={setPageLoading}
            />
          </div>
        </div>
      )}

      <QuestionSectionRecycleBinModal
        show={showRecycleBin}
        onHide={() => setShowRecycleBin(false)}
        onRestoreComplete={() => queryClient.invalidateQueries(lookupKeys.questionSections)}
      />
    </div>
  );
};

export default QuestionSectionPage;
