import React, { useState, useEffect } from "react";
import { Assessment, resetAssessment } from "./StudentInfo_APIs";
import axios from "axios";

type StudentAssessmentInfo = {
  assessmentId: number;
  assessmentName: string;
  status: string;
};

type Props = {
  show: boolean;
  onClose: () => void;
  userStudentId: number;
  studentName: string;
  onResetSuccess: () => void;
};

export default function ResetAssessmentModal({
  show,
  onClose,
  userStudentId,
  studentName,
  onResetSuccess,
}: Props) {
  const [studentAssessments, setStudentAssessments] = useState<StudentAssessmentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState<number | null>(null);
  const [confirmAssessment, setConfirmAssessment] = useState<StudentAssessmentInfo | null>(null);

  useEffect(() => {
    if (show && userStudentId) {
      fetchAssessments();
    }
  }, [show, userStudentId]);

  const fetchAssessments = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/assessments/student/${userStudentId}`
      );
      setStudentAssessments(response.data || []);
    } catch (error) {
      console.error("Error fetching student assessments:", error);
      setStudentAssessments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetClick = (assessment: StudentAssessmentInfo) => {
    setConfirmAssessment(assessment);
  };

  const handleConfirmReset = async () => {
    if (!confirmAssessment) return;

    setResetting(confirmAssessment.assessmentId);
    try {
      await resetAssessment(userStudentId, confirmAssessment.assessmentId);
      alert("Assessment reset successfully!");
      setConfirmAssessment(null);
      fetchAssessments(); // Refresh the list
      onResetSuccess();
    } catch (error: any) {
      console.error("Error resetting assessment:", error);
      alert(error.response?.data?.error || "Failed to reset assessment");
    } finally {
      setResetting(null);
    }
  };

  const handleClose = () => {
    setConfirmAssessment(null);
    onClose();
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      completed: { bg: "#d1fae5", text: "#059669" },
      ongoing: { bg: "#dbeafe", text: "#2563eb" },
      notstarted: { bg: "#fef3c7", text: "#d97706" },
    };
    const style = colors[status] || colors.notstarted;
    return (
      <span
        style={{
          backgroundColor: style.bg,
          color: style.text,
          padding: "4px 12px",
          borderRadius: "20px",
          fontSize: "0.75rem",
          fontWeight: 600,
          textTransform: "capitalize",
        }}
      >
        {status === "notstarted" ? "Not Started" : status}
      </span>
    );
  };

  if (!show) return null;

  return (
    <>
      {/* Confirmation Dialog */}
      {confirmAssessment && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "400px" }}>
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: "16px" }}>
              <div className="modal-body text-center p-4">
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 1rem",
                  }}
                >
                  <i className="bi bi-exclamation-triangle-fill text-white fs-4"></i>
                </div>
                <h5 className="mb-2 fw-bold">Confirm Reset</h5>
                <p className="text-muted mb-4">
                  Are you sure you want to reset{" "}
                  <strong>{confirmAssessment.assessmentName}</strong>? This will delete all
                  saved answers and scores.
                </p>
                <div className="d-flex gap-2 justify-content-center">
                  <button
                    className="btn btn-outline-secondary px-4"
                    onClick={() => setConfirmAssessment(null)}
                    disabled={resetting !== null}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-danger px-4"
                    onClick={handleConfirmReset}
                    disabled={resetting !== null}
                  >
                    {resetting === confirmAssessment.assessmentId ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        ></span>
                        Resetting...
                      </>
                    ) : (
                      "Reset Assessment"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Modal */}
      <div
        className="modal show d-block"
        style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}
        onClick={handleClose}
      >
        <div
          className="modal-dialog modal-dialog-centered"
          style={{ maxWidth: "550px" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: "20px" }}>
            {/* Header */}
            <div
              className="modal-header border-0 pb-0"
              style={{
                background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                borderRadius: "20px 20px 0 0",
                padding: "1.5rem",
              }}
            >
              <div>
                <h5 className="mb-1 text-white fw-bold">
                  <i className="bi bi-arrow-counterclockwise me-2"></i>
                  Reset Assessment
                </h5>
                <p className="mb-0 text-white-50" style={{ fontSize: "0.9rem" }}>
                  {studentName}
                </p>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={handleClose}
              ></button>
            </div>

            {/* Body */}
            <div className="modal-body p-4">
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3 text-muted">Loading assessments...</p>
                </div>
              ) : studentAssessments.length === 0 ? (
                <div className="text-center py-5">
                  <i
                    className="bi bi-inbox text-muted"
                    style={{ fontSize: "3rem", opacity: 0.5 }}
                  ></i>
                  <p className="mt-3 text-muted mb-0">No assessments assigned to this student</p>
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {studentAssessments.map((assessment) => (
                    <div
                      key={assessment.assessmentId}
                      className="d-flex align-items-center justify-content-between p-3"
                      style={{
                        backgroundColor: "#f8fafc",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div>
                        <h6 className="mb-1 fw-semibold" style={{ color: "#1a1a2e" }}>
                          {assessment.assessmentName}
                        </h6>
                        <div className="d-flex align-items-center gap-2">
                          {getStatusBadge(assessment.status)}
                          <span className="text-muted" style={{ fontSize: "0.8rem" }}>
                            ID: {assessment.assessmentId}
                          </span>
                        </div>
                      </div>
                      <button
                        className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
                        onClick={() => handleResetClick(assessment)}
                        disabled={assessment.status === "notstarted" || resetting !== null}
                        title={
                          assessment.status === "notstarted"
                            ? "Already not started"
                            : "Reset this assessment"
                        }
                      >
                        <i className="bi bi-arrow-counterclockwise"></i>
                        Reset
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="modal-footer border-0 pt-0">
              <button className="btn btn-secondary" onClick={handleClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
