import { useState, useEffect } from "react";
import { Modal, Button } from "react-bootstrap";
import {
  GetDeletedQuestionnaires,
  RestoreQuestionnaire,
  PermanentDeleteQuestionnaire,
} from "../../API/Create_Questionaire_APIs";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { MdRestorePage } from "react-icons/md";

interface QuestionnaireRecycleBinModalProps {
  show: boolean;
  onHide: () => void;
  onRestoreComplete: () => void;
}

const QuestionnaireRecycleBinModal = ({
  show,
  onHide,
  onRestoreComplete,
}: QuestionnaireRecycleBinModalProps) => {
  const [deletedQuestionnaires, setDeletedQuestionnaires] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchDeletedQuestionnaires = async () => {
    setLoading(true);
    try {
      const response = await GetDeletedQuestionnaires();
      setDeletedQuestionnaires(response.data);
    } catch (error) {
      console.error("Error fetching deleted questionnaires:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      fetchDeletedQuestionnaires();
    }
  }, [show]);

  const handleRestore = async (id: number) => {
    setActionLoading(id);
    try {
      await RestoreQuestionnaire(id);
      setDeletedQuestionnaires((prev) =>
        prev.filter((q) => q.questionnaireId !== id && q.id !== id)
      );
      onRestoreComplete();
    } catch (error) {
      console.error("Error restoring questionnaire:", error);
      alert("Failed to restore questionnaire. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (id: number) => {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete this questionnaire? This action cannot be undone."
      )
    ) {
      return;
    }
    setActionLoading(id);
    try {
      await PermanentDeleteQuestionnaire(id);
      setDeletedQuestionnaires((prev) =>
        prev.filter((q) => q.questionnaireId !== id && q.id !== id)
      );
    } catch (error) {
      console.error("Error permanently deleting questionnaire:", error);
      alert("Failed to permanently delete questionnaire. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Recycle Bin - Deleted Questionnaires</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
        {loading ? (
          <div className="text-center py-4">
            <span
              className="spinner-border spinner-border-sm me-2"
              role="status"
            />
            Loading deleted questionnaires...
          </div>
        ) : deletedQuestionnaires.length === 0 ? (
          <div className="text-center py-4 text-muted">
            No deleted questionnaires found.
          </div>
        ) : (
          <table className="table table-hover">
            <thead>
              <tr>
                <th>#</th>
                <th>Questionnaire Name</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deletedQuestionnaires.map((questionnaire, index) => {
                const qId =
                  questionnaire.questionnaireId ?? questionnaire.id;
                const isActionLoading = actionLoading === qId;
                return (
                  <tr key={qId}>
                    <td>{index + 1}</td>
                    <td
                      style={{
                        maxWidth: "300px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {questionnaire.name || "-"}
                    </td>
                    <td
                      style={{
                        maxWidth: "300px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {questionnaire.description || "-"}
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <button
                          onClick={() => handleRestore(qId)}
                          className="btn btn-icon btn-success btn-sm"
                          title="Restore questionnaire"
                          disabled={isActionLoading}
                        >
                          {isActionLoading ? (
                            <span
                              className="spinner-border spinner-border-sm"
                              role="status"
                            />
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
                          <UseAnimations
                            animation={trash}
                            size={20}
                            strokeColor={"#EFF8FE"}
                          />
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

export default QuestionnaireRecycleBinModal;
