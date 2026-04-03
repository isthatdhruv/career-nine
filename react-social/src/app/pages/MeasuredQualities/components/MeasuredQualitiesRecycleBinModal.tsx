import { useState, useEffect } from "react";
import { Modal, Button } from "react-bootstrap";
import { GetDeletedMeasuredQualities, RestoreMeasuredQuality, PermanentDeleteMeasuredQuality } from "../API/Measured_Qualities_APIs";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { MdRestorePage } from "react-icons/md";
import { showErrorToast } from '../../../utils/toast';

interface MeasuredQualitiesRecycleBinModalProps {
  show: boolean;
  onHide: () => void;
  onRestoreComplete: () => void;
}

const MeasuredQualitiesRecycleBinModal = ({
  show,
  onHide,
  onRestoreComplete,
}: MeasuredQualitiesRecycleBinModalProps) => {
  const [deletedQualities, setDeletedQualities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchDeletedQualities = async () => {
    setLoading(true);
    try {
      const response = await GetDeletedMeasuredQualities();
      setDeletedQualities(response.data);
    } catch (error) {
      console.error("Error fetching deleted measured qualities:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      fetchDeletedQualities();
    }
  }, [show]);

  const handleRestore = async (id: number) => {
    setActionLoading(id);
    try {
      await RestoreMeasuredQuality(id);
      setDeletedQualities((prev) => prev.filter((q) => q.measured_quality_id !== id && q.id !== id));
      onRestoreComplete();
    } catch (error) {
      console.error("Error restoring measured quality:", error);
      showErrorToast("Failed to restore measured quality. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this measured quality? This action cannot be undone.")) {
      return;
    }
    setActionLoading(id);
    try {
      await PermanentDeleteMeasuredQuality(id);
      setDeletedQualities((prev) => prev.filter((q) => q.measured_quality_id !== id && q.id !== id));
    } catch (error) {
      console.error("Error permanently deleting measured quality:", error);
      showErrorToast("Failed to permanently delete measured quality. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Recycle Bin - Deleted Measured Qualities</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
        {loading ? (
          <div className="text-center py-4">
            <span className="spinner-border spinner-border-sm me-2" role="status" />
            Loading deleted measured qualities...
          </div>
        ) : deletedQualities.length === 0 ? (
          <div className="text-center py-4 text-muted">
            No deleted measured qualities found.
          </div>
        ) : (
          <table className="table table-hover">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Display Name</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deletedQualities.map((quality, index) => {
                const qId = quality.measured_quality_id ?? quality.id;
                const isActionLoading = actionLoading === qId;
                return (
                  <tr key={qId}>
                    <td>{index + 1}</td>
                    <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {quality.name}
                    </td>
                    <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {quality.displayName}
                    </td>
                    <td style={{ maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {quality.description}
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <button
                          onClick={() => handleRestore(qId)}
                          className="btn btn-icon btn-success btn-sm"
                          title="Restore measured quality"
                          disabled={isActionLoading}
                        >
                          {isActionLoading ? (
                            <span className="spinner-border spinner-border-sm" role="status" />
                          ) : (
                            <MdRestorePage size={16} />
                          )}
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(qId)}
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

export default MeasuredQualitiesRecycleBinModal;
