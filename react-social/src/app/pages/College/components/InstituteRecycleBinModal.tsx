import { useState, useEffect } from "react";
import { Modal, Button } from "react-bootstrap";
import { GetDeletedInstitutes, RestoreInstitute } from "../API/College_APIs";
import { MdRestorePage } from "react-icons/md";

interface InstituteRecycleBinModalProps {
  show: boolean;
  onHide: () => void;
  onRestoreComplete: () => void;
}

const InstituteRecycleBinModal = ({
  show,
  onHide,
  onRestoreComplete,
}: InstituteRecycleBinModalProps) => {
  const [deletedInstitutes, setDeletedInstitutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchDeletedInstitutes = async () => {
    setLoading(true);
    try {
      const response = await GetDeletedInstitutes();
      setDeletedInstitutes(response.data);
    } catch (error) {
      console.error("Error fetching deleted institutes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      fetchDeletedInstitutes();
    }
  }, [show]);

  const handleRestore = async (id: number) => {
    setActionLoading(id);
    try {
      await RestoreInstitute(id);
      setDeletedInstitutes((prev) =>
        prev.filter((inst) => inst.instituteCode !== id)
      );
      onRestoreComplete();
    } catch (error) {
      console.error("Error restoring institute:", error);
      alert("Failed to restore institute. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Recycle Bin - Deleted Institutes</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
        {loading ? (
          <div className="text-center py-4">
            <span className="spinner-border spinner-border-sm me-2" role="status" />
            Loading deleted institutes...
          </div>
        ) : deletedInstitutes.length === 0 ? (
          <div className="text-center py-4 text-muted">
            No deleted institutes found.
          </div>
        ) : (
          <table className="table table-hover">
            <thead>
              <tr>
                <th>#</th>
                <th>Code</th>
                <th>Name</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deletedInstitutes.map((inst, index) => {
                const isActionLoading = actionLoading === inst.instituteCode;
                return (
                  <tr key={inst.instituteCode}>
                    <td>{index + 1}</td>
                    <td>{inst.instituteCode}</td>
                    <td>{inst.instituteName}</td>
                    <td>{inst.instituteAddress || "-"}</td>
                    <td>
                      <button
                        onClick={() => handleRestore(inst.instituteCode)}
                        className="btn btn-icon btn-success btn-sm"
                        title="Restore institute"
                        disabled={isActionLoading}
                      >
                        {isActionLoading ? (
                          <span className="spinner-border spinner-border-sm" role="status" />
                        ) : (
                          <MdRestorePage size={16} />
                        )}
                      </button>
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

export default InstituteRecycleBinModal;
