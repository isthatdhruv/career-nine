import { useState, useEffect } from "react";
import { Modal, Button } from "react-bootstrap";
import { GetDeletedAssessments, RestoreAssessment, PermanentDeleteAssessment } from "../../API/Create_Assessment_APIs";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { MdRestorePage } from "react-icons/md";

interface AssessmentRecycleBinModalProps {
  show: boolean;
  onHide: () => void;
  onRestoreComplete: () => void;
}

const AssessmentRecycleBinModal = ({
  show,
  onHide,
  onRestoreComplete,
}: AssessmentRecycleBinModalProps) => {
  const [deletedAssessments, setDeletedAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchDeleted = async () => {
    setLoading(true);
    try {
      const response = await GetDeletedAssessments();
      setDeletedAssessments(response.data);
    } catch (error) {
      console.error("Error fetching deleted assessments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      fetchDeleted();
    }
  }, [show]);

  const handleRestore = async (id: number) => {
    setActionLoading(id);
    try {
      await RestoreAssessment(id);
      setDeletedAssessments((prev) => prev.filter((a) => (a.id || a.assessmentId) !== id));
      onRestoreComplete();
    } catch (error) {
      console.error("Error restoring assessment:", error);
      alert("Failed to restore assessment. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this assessment? This action cannot be undone.")) {
      return;
    }
    setActionLoading(id);
    try {
      await PermanentDeleteAssessment(id);
      setDeletedAssessments((prev) => prev.filter((a) => (a.id || a.assessmentId) !== id));
    } catch (error) {
      console.error("Error permanently deleting assessment:", error);
      alert("Failed to permanently delete assessment. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Recycle Bin - Deleted Assessments</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
        {loading ? (
          <div className="text-center py-4">
            <span className="spinner-border spinner-border-sm me-2" role="status" />
            Loading deleted assessments...
          </div>
        ) : deletedAssessments.length === 0 ? (
          <div className="text-center py-4 text-muted">
            No deleted assessments found.
          </div>
        ) : (
          <table className="table table-hover">
            <thead>
              <tr>
                <th>#</th>
                <th>Assessment Name</th>
                <th>Start Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deletedAssessments.map((assessment, index) => {
                const aId = assessment.id || assessment.assessmentId;
                const isActionLoading = actionLoading === aId;
                return (
                  <tr key={aId}>
                    <td>{index + 1}</td>
                    <td>{assessment.AssessmentName || assessment.assessmentName || "N/A"}</td>
                    <td>{assessment.starDate || assessment.startDate || "N/A"}</td>
                    <td>
                      <div className="d-flex gap-1">
                        <button
                          onClick={() => handleRestore(aId)}
                          className="btn btn-icon btn-success btn-sm"
                          title="Restore assessment"
                          disabled={isActionLoading}
                        >
                          {isActionLoading ? (
                            <span className="spinner-border spinner-border-sm" role="status" />
                          ) : (
                            <MdRestorePage size={16} />
                          )}
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(aId)}
                          className="btn btn-icon btn-danger btn-sm"
                          title="Permanently delete"
                          disabled={isActionLoading}
                        >
                          <UseAnimations animation={trash} size={20} strokeColor={"#EFF8FE"} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AssessmentRecycleBinModal;
