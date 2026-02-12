import { useState, useEffect } from "react";
import { Modal, Button } from "react-bootstrap";
import { GetDeletedQuestions, RestoreQuestion, PermanentDeleteQuestion } from "../API/Question_APIs";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { MdRestorePage } from "react-icons/md";

interface QuestionRecycleBinModalProps {
  show: boolean;
  onHide: () => void;
  onRestoreComplete: () => void;
  sections: any[];
}

const QuestionRecycleBinModal = ({
  show,
  onHide,
  onRestoreComplete,
  sections,
}: QuestionRecycleBinModalProps) => {
  const [deletedQuestions, setDeletedQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchDeletedQuestions = async () => {
    setLoading(true);
    try {
      const response = await GetDeletedQuestions();
      setDeletedQuestions(response.data);
    } catch (error) {
      console.error("Error fetching deleted questions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      fetchDeletedQuestions();
    }
  }, [show]);

  const handleRestore = async (id: number) => {
    setActionLoading(id);
    try {
      await RestoreQuestion(id);
      setDeletedQuestions((prev) => prev.filter((q) => q.questionId !== id && q.id !== id));
      onRestoreComplete();
    } catch (error) {
      console.error("Error restoring question:", error);
      alert("Failed to restore question. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this question? This action cannot be undone.")) {
      return;
    }
    setActionLoading(id);
    try {
      await PermanentDeleteQuestion(id);
      setDeletedQuestions((prev) => prev.filter((q) => q.questionId !== id && q.id !== id));
    } catch (error) {
      console.error("Error permanently deleting question:", error);
      alert("Failed to permanently delete question. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const getSectionName = (question: any) => {
    const sectionId = question.section?.sectionId ?? question.sectionId;
    return sections.find((s) => s.sectionId === sectionId)?.sectionName ?? "Unknown";
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Recycle Bin - Deleted Questions</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
        {loading ? (
          <div className="text-center py-4">
            <span className="spinner-border spinner-border-sm me-2" role="status" />
            Loading deleted questions...
          </div>
        ) : deletedQuestions.length === 0 ? (
          <div className="text-center py-4 text-muted">
            No deleted questions found.
          </div>
        ) : (
          <table className="table table-hover">
            <thead>
              <tr>
                <th>#</th>
                <th>Question Text</th>
                <th>Type</th>
                <th>Section</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deletedQuestions.map((question, index) => {
                const qId = question.questionId ?? question.id;
                const isActionLoading = actionLoading === qId;
                return (
                  <tr key={qId}>
                    <td>{index + 1}</td>
                    <td style={{ maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {question.questionText}
                    </td>
                    <td>{question.questionType}</td>
                    <td>{getSectionName(question)}</td>
                    <td>
                      <div className="d-flex gap-1">
                        <button
                          onClick={() => handleRestore(qId)}
                          className="btn btn-icon btn-success btn-sm"
                          title="Restore question"
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

export default QuestionRecycleBinModal;
