import { useState, useEffect } from "react";
import { Modal, Button } from "react-bootstrap";
import {
  GetDeletedMeasuredQualityTypes,
  RestoreMeasuredQualityType,
  PermanentDeleteMeasuredQualityType,
} from "../API/Measured_Quality_Types_APIs";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { MdRestorePage } from "react-icons/md";
import { showErrorToast } from '../../utils/toast';

interface MeasuredQualityTypesRecycleBinModalProps {
  show: boolean;
  onHide: () => void;
  onRestoreComplete: () => void;
}

const MeasuredQualityTypesRecycleBinModal = ({
  show,
  onHide,
  onRestoreComplete,
}: MeasuredQualityTypesRecycleBinModalProps) => {
  const [deletedItems, setDeletedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchDeletedItems = async () => {
    setLoading(true);
    try {
      const response = await GetDeletedMeasuredQualityTypes();
      setDeletedItems(response.data);
    } catch (error) {
      console.error("Error fetching deleted measured quality types:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      fetchDeletedItems();
    }
  }, [show]);

  const handleRestore = async (id: number) => {
    setActionLoading(id);
    try {
      await RestoreMeasuredQualityType(id);
      setDeletedItems((prev) =>
        prev.filter((item) => item.measured_quality_type_id !== id && item.id !== id)
      );
      onRestoreComplete();
    } catch (error) {
      console.error("Error restoring measured quality type:", error);
      showErrorToast("Failed to restore measured quality type. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (id: number) => {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete this measured quality type? This action cannot be undone."
      )
    ) {
      return;
    }
    setActionLoading(id);
    try {
      await PermanentDeleteMeasuredQualityType(id);
      setDeletedItems((prev) =>
        prev.filter((item) => item.measured_quality_type_id !== id && item.id !== id)
      );
    } catch (error) {
      console.error("Error permanently deleting measured quality type:", error);
      showErrorToast("Failed to permanently delete measured quality type. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Recycle Bin - Deleted Measured Quality Types</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
        {loading ? (
          <div className="text-center py-4">
            <span className="spinner-border spinner-border-sm me-2" role="status" />
            Loading deleted measured quality types...
          </div>
        ) : deletedItems.length === 0 ? (
          <div className="text-center py-4 text-muted">
            No deleted measured quality types found.
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
              {deletedItems.map((item, index) => {
                const itemId = item.measured_quality_type_id ?? item.id;
                const isActionLoading = actionLoading === itemId;
                return (
                  <tr key={itemId}>
                    <td>{index + 1}</td>
                    <td
                      style={{
                        maxWidth: "200px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.name}
                    </td>
                    <td
                      style={{
                        maxWidth: "200px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.displayName}
                    </td>
                    <td
                      style={{
                        maxWidth: "250px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.description}
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <button
                          onClick={() => handleRestore(itemId)}
                          className="btn btn-icon btn-success btn-sm"
                          title="Restore measured quality type"
                          disabled={isActionLoading}
                        >
                          {isActionLoading ? (
                            <span className="spinner-border spinner-border-sm" role="status" />
                          ) : (
                            <MdRestorePage size={16} />
                          )}
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(itemId)}
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

export default MeasuredQualityTypesRecycleBinModal;
