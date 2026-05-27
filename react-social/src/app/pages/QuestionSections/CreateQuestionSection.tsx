import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuestionSections } from "../../lib/queries/lookups";
import QuestionSectionTable from "./components/QuestionSectionTable";
import QuestionSectionRecycleBinModal from "./components/QuestionSectionRecycleBinModal";
import PageHeader from "../../components/PageHeader";

const QuestionSectionPage = () => {
  const { data: questionSectionData = [], isLoading: loading } = useQuestionSections<any>();
  const [pageLoading, setPageLoading] = useState(["false"]);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const navigate = useNavigate();

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
