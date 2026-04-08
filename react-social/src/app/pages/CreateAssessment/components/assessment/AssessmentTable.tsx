import { useState } from "react";
import { showErrorToast } from '../../../../utils/toast';
import { MDBDataTableV5 } from "mdbreact";
import { AiFillEdit } from "react-icons/ai";
import { FaLock, FaLockOpen, FaFileDownload, FaRecycle ,FaFilePdf } from "react-icons/fa";
// import { FaLock, FaLockOpen, FaFileDownload, FaFilePdf } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { SoftDeleteAssessment, LockAssessment, UnlockAssessment } from "../../API/Create_Assessment_APIs";
import { generateOMRSheet } from "../../utils/generateOMRSheet";
import AssessmentRecycleBinModal from "./AssessmentRecycleBinModal";
import { generateQuestionnairePDF } from "../../utils/generateQuestionnairePDF";

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

  const datatable = {
    columns: [
      {
        label: "Assessment Name",
        field: "assessmentName",
        width: 300,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Assessment Name",
        },
      },
      {
        label: "Start Date",
        field: "startDate",
        sort: "asc",
        width: 150,
      },
      {
        label: "Actions",
        field: "actions",
        sort: "disabled",
        width: 250,
      },
    ],

    rows: props.data.map((data: any) => ({
      assessmentName: data.AssessmentName || data.assessmentName || "N/A",
      startDate: data.starDate || data.startDate || "N/A",
      actions: (
        <>
          <button
            onClick={() => {
              if (data.isLocked) {
                setShowLockedModal(true);
                return;
              }
              navigate(`/assessments/edit/${data.id || data.assessmentId}`, {
                state: { data },
              });
            }}
            className="btn btn-icon btn-primary btn-sm me-3"
          >
            <AiFillEdit size={16} />
          </button>
          <button
            onClick={() => handleToggleLock(data)}
            className={`btn btn-icon btn-sm me-3 ${data.isLocked ? "btn-warning" : "btn-secondary"}`}
            title={data.isLocked ? "Unlock Assessment" : "Lock Assessment"}
          >
            {data.isLocked ? <FaLock size={14} /> : <FaLockOpen size={14} />}
          </button>
          <button
            onClick={async () => {
              if (data.isLocked) {
                setShowLockedModal(true);
                return;
              }
              if (!window.confirm(`Are you sure you want to delete "${data.AssessmentName || data.assessmentName}"? It will be moved to the recycle bin.`)) return;
              props.setLoading(true);
              try {
                await SoftDeleteAssessment(data.id || data.assessmentId);
                props.setPageLoading(["true"]);
              } catch (error) {
                console.error("Delete failed:", error);
                showErrorToast("Failed to delete assessment. Please try again.");
              } finally {
                props.setLoading(false);
              }
            }}
            className="btn btn-icon btn-danger btn-sm me-3"
          >
            <UseAnimations
              animation={trash}
              size={22}
              strokeColor={"#EFF8FE"}
            />
          </button>
          <button
            onClick={() => handleDownloadQuestionnaire(data)}
            className="btn btn-icon btn-success btn-sm me-3"
            title="Download Questionnaire PDF"
            disabled={pdfLoading === (data.id || data.assessmentId)}
          >
            {pdfLoading === (data.id || data.assessmentId) ? (
              <span className="spinner-border spinner-border-sm" />
            ) : (
              <FaFilePdf size={14} />
            )}
          </button>
          <button
            onClick={() => handleDownloadOMR(data)}
            className="btn btn-icon btn-info btn-sm"
            title="Download OMR Sheet"
            disabled={omrLoading === (data.id || data.assessmentId)}
          >
            {omrLoading === (data.id || data.assessmentId) ? (
              <span className="spinner-border spinner-border-sm" />
            ) : (
              <FaFileDownload size={14} />
            )}
          </button>
        </>
      ),
    })),
  };

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <button
          className="btn btn-danger btn-sm"
          onClick={() => setShowRecycleBin(true)}
        >
          <FaRecycle size={16} className="me-2" /> Recycle Bin
        </button>
      </div>

      <MDBDataTableV5
        hover
        scrollY
        maxHeight="160vh"
        entriesOptions={[5, 20, 25]}
        entries={25}
        pagesAmount={4}
        data={datatable}
      />

      <AssessmentRecycleBinModal
        show={showRecycleBin}
        onHide={() => setShowRecycleBin(false)}
        onRestoreComplete={() => props.setPageLoading(["true"])}
      />

      {/* Locked Assessment Modal */}
      {showLockedModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Assessment Locked</h5>
                <button type="button" className="btn-close" onClick={() => setShowLockedModal(false)}></button>
              </div>
              <div className="modal-body">
                <p>This assessment is locked and cannot be edited as there is an active assessment going on.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowLockedModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AssessmentTable;
