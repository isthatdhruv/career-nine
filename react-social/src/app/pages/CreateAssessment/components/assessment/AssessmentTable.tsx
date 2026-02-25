import { useState } from "react";
import { MDBDataTableV5 } from "mdbreact";
import { AiFillEdit } from "react-icons/ai";
import { FaLock, FaLockOpen } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { DeactivateAssessment, LockAssessment, UnlockAssessment } from "../../API/Create_Assessment_APIs";

const AssessmentTable = (props: {
  data: any;
  setLoading: any;
  setPageLoading: any;
}) => {
  const navigate = useNavigate();
  const [showLockedModal, setShowLockedModal] = useState(false);

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
      alert("Failed to update lock status. Please try again.");
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
              if (!window.confirm(`Are you sure you want to deactivate "${data.AssessmentName || data.assessmentName}"?`)) return;
              props.setLoading(true);
              try {
                await DeactivateAssessment(data.id || data.assessmentId, data);
                props.setPageLoading(["true"]);
              } catch (error) {
                console.error("Deactivate failed:", error);
                alert("Failed to deactivate assessment. Please try again.");
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
        </>
      ),
    })),
  };

  return (
    <>
      <MDBDataTableV5
        hover
        scrollY
        maxHeight="160vh"
        entriesOptions={[5, 20, 25]}
        entries={25}
        pagesAmount={4}
        data={datatable}
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
