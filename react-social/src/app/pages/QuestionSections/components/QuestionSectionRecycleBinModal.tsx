import { useState, useEffect } from "react";
import { Modal, Button } from "react-bootstrap";
import { GetDeletedQuestionSections, RestoreQuestionSection, PermanentDeleteQuestionSection } from "../API/Question_Section_APIs";
import { showErrorToast } from '../../../utils/toast';
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { MdRestorePage } from "react-icons/md";

interface QuestionSectionRecycleBinModalProps {
  show: boolean;
  onHide: () => void;
  onRestoreComplete: () => void;
}

const QuestionSectionRecycleBinModal = ({
  show,
  onHide,
  onRestoreComplete,
}: QuestionSectionRecycleBinModalProps) => {
  const [deletedSections, setDeletedSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchDeletedSections = async () => {
    setLoading(true);
    try {
      const response = await GetDeletedQuestionSections();
      setDeletedSections(response.data);
    } catch (error) {
      console.error("Error fetching deleted sections:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      fetchDeletedSections();
    }
  }, [show]);

  const handleRestore = async (id: number) => {
    setActionLoading(id);
    try {
      await RestoreQuestionSection(id);
      setDeletedSections((prev) => prev.filter((s) => s.sectionId !== id && s.id !== id));
      onRestoreComplete();
    } catch (error) {
      console.error("Error restoring section:", error);
      showErrorToast("Failed to restore section. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this section? This action cannot be undone.")) {
      return;
    }
    setActionLoading(id);
    try {
      await PermanentDeleteQuestionSection(id);
      setDeletedSections((prev) => prev.filter((s) => s.sectionId !== id && s.id !== id));
    } catch (error) {
      console.error("Error permanently deleting section:", error);
      showErrorToast("Failed to permanently delete section. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Recycle Bin - Deleted Sections</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
        {loading ? (
          <div className="text-center py-4">
            <span className="spinner-border spinner-border-sm me-2" role="status" />
            Loading deleted sections...
          </div>
        ) : deletedSections.length === 0 ? (
          <div className="text-center py-4 text-muted">
            No deleted sections found.
          </div>
        ) : (
          <table className="table table-hover">
            <thead>
              <tr>
                <th>#</th>
                <th>Section Name</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deletedSections.map((section, index) => {
                const sId = section.sectionId ?? section.id;
                const isActionLoading = actionLoading === sId;
                return (
                  <tr key={sId}>
                    <td>{index + 1}</td>
                    <td>{section.sectionName}</td>
                    <td style={{ maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {section.description}
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <button
                          onClick={() => handleRestore(sId)}
                          className="btn btn-icon btn-success btn-sm"
                          title="Restore section"
                          disabled={isActionLoading}
                        >
                          {isActionLoading ? (
                            <span className="spinner-border spinner-border-sm" role="status" />
                          ) : (
                            <MdRestorePage size={16} />
                          )}
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(sId)}
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

export default QuestionSectionRecycleBinModal;
