import { useState } from "react";
import { showErrorToast } from '../../../../utils/toast';
import { MDBDataTableV5 } from "mdbreact";
import { useNavigate } from "react-router-dom";
import { SoftDeleteAssessment, LockAssessment, UnlockAssessment } from "../../API/Create_Assessment_APIs";
import { generateOMRSheet } from "../../utils/generateOMRSheet";
import AssessmentRecycleBinModal from "./AssessmentRecycleBinModal";
import { generateQuestionnairePDF } from "../../utils/generateQuestionnairePDF";
import { ActionIcon } from "../../../../components/ActionIcon";

const AssessmentTable = (props: {
  data: any;
  setLoading: any;
  setPageLoading: any;
}) => {
  const navigate = useNavigate();
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [omrLoading, setOmrLoading] = useState<number | null>(null);
  const [pdfLoading, setPdfLoading] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");

  const handleDownloadQuestionnaire = async (data: any) => {
    const id = data.id || data.assessmentId;
    const name = data.AssessmentName || data.assessmentName || "Assessment";
    setPdfLoading(id);
    try {
      await generateQuestionnairePDF(id, name);
    } catch (error) {
      console.error("Questionnaire PDF generation failed:", error);
      showErrorToast("Failed to generate questionnaire PDF. Please try again.");
    } finally {
      setPdfLoading(null);
    }
  };

  const handleDownloadOMR = async (data: any) => {
    const id = data.id || data.assessmentId;
    const name = data.AssessmentName || data.assessmentName || "Assessment";
    setOmrLoading(id);
    try {
      await generateOMRSheet(id, name);
    } catch (error) {
      console.error("OMR generation failed:", error);
      showErrorToast("Failed to generate OMR sheet. Please try again.");
    } finally {
      setOmrLoading(null);
    }
  };

  const handleToggleLock = async (data: any) => {
    const id = data.id || data.assessmentId;
    const isCurrentlyLocked = data.isLocked;
    const name = data.AssessmentName || data.assessmentName;

    if (isCurrentlyLocked) {
      if (!window.confirm(`Are you sure you want to unlock "${name}"?`)) return;
    }

    props.setLoading(true);
    try {
      if (isCurrentlyLocked) {
        await UnlockAssessment(id);
      } else {
        await LockAssessment(id);
      }
      props.setPageLoading(["true"]);
    } catch (error) {
      console.error("Lock/unlock failed:", error);
      showErrorToast("Failed to update lock status. Please try again.");
    } finally {
      props.setLoading(false);
    }
  };

  const filteredData = props.data.filter((item: any) => {
    if (!searchText.trim()) return true;
    const q = searchText.trim().toLowerCase();
    return (item.AssessmentName || item.assessmentName || "").toLowerCase().includes(q);
  });

  const actionBtnStyle = (color: string) => ({
    width: "34px", height: "34px", padding: 0,
    display: "flex" as const, alignItems: "center" as const, justifyContent: "center" as const,
    background: "transparent", color: color, border: "none", borderRadius: "8px",
    cursor: "pointer" as const,
    transition: "background-color 150ms ease",
  });

  const datatable = {
    columns: [
      { label: "#", field: "serialNo", width: 50, sort: "disabled" },
      { label: "Assessment Name", field: "assessmentName", width: 300, sort: "asc" },
      { label: "Start Date", field: "startDate", width: 120 },
      { label: "Status", field: "lockStatus", width: 80, sort: "disabled" },
      { label: "Actions", field: "actions", sort: "disabled", width: 200 },
    ],

    rows: filteredData.map((data: any, index: number) => {
      const id = data.id || data.assessmentId;
      return {
        serialNo: <span style={{ color: "#9ca3af", fontSize: "0.82rem" }}>{index + 1}</span>,
        assessmentName: (
          <span style={{ fontSize: "0.88rem", color: "#111827", fontWeight: 600 }}>
            {data.AssessmentName || data.assessmentName || "N/A"}
          </span>
        ),
        startDate: (
          <span style={{ fontSize: "0.82rem", color: "#4b5563" }}>
            {data.starDate || data.startDate || "N/A"}
          </span>
        ),
        lockStatus: data.isLocked ? (
          <span style={{ fontSize: "0.8rem", fontWeight: 700, padding: "5px 12px", borderRadius: "4px", background: "#d97706", color: "#fff", display: "inline-block" }}>
            <i className="bi bi-lock-fill me-1"></i>Locked
          </span>
        ) : (
          <span style={{ fontSize: "0.8rem", fontWeight: 700, padding: "5px 12px", borderRadius: "4px", background: "#059669", color: "#fff", display: "inline-block" }}>
            <i className="bi bi-unlock-fill me-1"></i>Open
          </span>
        ),
        actions: (
          <div className="d-flex gap-1">
            <button
              onClick={() => {
                if (data.isLocked) { setShowLockedModal(true); return; }
                navigate(`/assessments/edit/${id}`, { state: { data } });
              }}
              className="btn btn-sm" title="Edit"
              style={actionBtnStyle("#2563eb")}
            >
              <ActionIcon type="edit" size="sm" />
            </button>
            <button
              onClick={() => handleToggleLock(data)}
              className="btn btn-sm" title={data.isLocked ? "Unlock" : "Lock"}
              style={actionBtnStyle(data.isLocked ? "#d97706" : "#6b7280")}
            >
              <ActionIcon type={data.isLocked ? "lock" : "unlock"} size="sm" />
            </button>
            <button
              onClick={async () => {
                if (data.isLocked) { setShowLockedModal(true); return; }
                if (!window.confirm(`Delete "${data.AssessmentName || data.assessmentName}"? It will be moved to recycle bin.`)) return;
                props.setLoading(true);
                try {
                  await SoftDeleteAssessment(id);
                  props.setPageLoading(["true"]);
                } catch (error) {
                  console.error("Delete failed:", error);
                  showErrorToast("Failed to delete assessment.");
                } finally {
                  props.setLoading(false);
                }
              }}
              className="btn btn-sm" title="Delete"
              style={actionBtnStyle("#dc2626")}
            >
              <ActionIcon type="delete" size="sm" />
            </button>
            <button
              onClick={() => handleDownloadQuestionnaire(data)}
              className="btn btn-sm" title="Download Questionnaire PDF"
              disabled={pdfLoading === id}
              style={actionBtnStyle("#059669")}
            >
              {pdfLoading === id ? <span className="spinner-border spinner-border-sm" style={{ width: "14px", height: "14px" }} /> : <ActionIcon type="pdf" size="sm" />}
            </button>
            <button
              onClick={() => handleDownloadOMR(data)}
              className="btn btn-sm" title="Download OMR Sheet"
              disabled={omrLoading === id}
              style={actionBtnStyle("#0369a1")}
            >
              {omrLoading === id ? <span className="spinner-border spinner-border-sm" style={{ width: "14px", height: "14px" }} /> : <ActionIcon type="download" size="sm" />}
            </button>
          </div>
        ),
      };
    }),
  };

  return (
    <>
      {/* Toolbar */}
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <div className="position-relative" style={{ flex: "1 0 200px", maxWidth: "320px" }}>
          <i className="bi bi-search position-absolute" style={{ left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: "0.85rem" }}></i>
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Search assessments..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ paddingLeft: 32, borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.85rem" }}
          />
        </div>
        <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
          {filteredData.length} of {props.data.length} assessments
        </span>
        <div className="ms-auto">
          <button
            className="btn btn-sm d-flex align-items-center gap-1"
            onClick={() => setShowRecycleBin(true)}
            style={{ background: "#fff", color: "#dc2626", border: "2px solid #dc2626", borderRadius: "6px", padding: "6px 12px", fontWeight: 600, fontSize: "0.82rem" }}
          >
            <ActionIcon type="delete" size="sm" />
            Recycle Bin
          </button>
        </div>
      </div>

      <MDBDataTableV5
        hover
        scrollY
        maxHeight="160vh"
        entriesOptions={[10, 25, 50]}
        entries={25}
        pagesAmount={4}
        searchTop={false}
        searchBottom={false}
        data={datatable}
      />

      <AssessmentRecycleBinModal
        show={showRecycleBin}
        onHide={() => setShowRecycleBin(false)}
        onRestoreComplete={() => props.setPageLoading(["true"])}
      />

      {showLockedModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <div className="modal-header" style={{ borderBottom: "1px solid #e5e7eb" }}>
                <h6 className="modal-title fw-bold" style={{ color: "#111827" }}>
                  <i className="bi bi-lock-fill me-2" style={{ color: "#d97706" }}></i>Assessment Locked
                </h6>
                <button type="button" className="btn-close" onClick={() => setShowLockedModal(false)}></button>
              </div>
              <div className="modal-body">
                <p className="mb-0" style={{ color: "#4b5563" }}>This assessment is locked and cannot be edited as there is an active assessment going on.</p>
              </div>
              <div className="modal-footer" style={{ borderTop: "1px solid #e5e7eb" }}>
                <button type="button" className="btn btn-sm" onClick={() => setShowLockedModal(false)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: "6px", fontWeight: 600 }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AssessmentTable;
