// StudentAnswerExcelModal.tsx
import React, { useState, useEffect } from "react";
import { Student } from "./StudentsList";
import { getStudentAnswersWithDetails, StudentAnswerDetail } from "./StudentInfo_APIs";
import * as XLSX from "xlsx";

interface StudentAnswerExcelModalProps {
  show: boolean;
  onHide: () => void;
  student: Student;
}

const StudentAnswerExcelModal: React.FC<StudentAnswerExcelModalProps> = ({ show, onHide, student }) => {
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<StudentAnswerDetail[]>([]);
  const [error, setError] = useState<string>("");

  const normalizeAnswers = (data: any): StudentAnswerDetail[] => {
    const rawList = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : data && typeof data === "object"
          ? Object.values(data)
          : [];

    return rawList
      .map((item: any) => {
        const questionText =
          item.questionText?.questionText ??
          item.questionText?.text ??
          item.question?.questionText ??
          item.question?.text ??
          item.questionText ??
          item.questiontext ??
          item.question_text;

        const optionText =
          item.optionText?.optionText ??
          item.optionText?.text ??
          item.option?.optionText ??
          item.option?.text ??
          item.optionText ??
          item.optiontext ??
          item.option_text;

        const sectionName =
          item.sectionName?.sectionName ??
          item.sectionName?.text ??
          item.section?.sectionName ??
          item.section?.name ??
          item.sectionName ??
          item.sectionname ??
          item.section_name;

        const excelQuestionHeader =
          item.excelQuestionHeader?.excelQuestionHeader ??
          item.excelQuestionHeader?.text ??
          item.excelQuestionHeader ??
          item.excelquestionheader ??
          item.excel_question_header;

        return {
          questionId: item.questionId ?? item.questionid ?? item.question_id,
          questionText,
          optionId: item.optionId ?? item.optionid ?? item.option_id,
          optionText,
          sectionName,
          excelQuestionHeader,
        };
      })
      .filter((item) => item.questionText || item.optionText || item.sectionName || item.excelQuestionHeader);
  };

  useEffect(() => {
    const fetchStudentAnswers = async () => {
      if (!show || !student.selectedAssessment) return;

      setLoading(true);
      setError("");
      try {
        console.log("Fetching answers for:", {
          userStudentId: student.userStudentId,
          assessmentId: student.selectedAssessment
        });

        const response = await getStudentAnswersWithDetails(
          student.userStudentId,
          Number(student.selectedAssessment)
        );

        console.log("API Response:", response);
        const normalized = normalizeAnswers(response.data);
        console.log("Normalized answers count:", normalized.length);
        setAnswers(normalized);
      } catch (err: any) {
        console.error("Error fetching answers:", err);
        console.error("Error details:", err.response?.data);
        setError("Failed to load student answers. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchStudentAnswers();
  }, [show, student.userStudentId, student.selectedAssessment]);

  const handleDownload = () => {
    setDownloading(true);
    try {
      // Prepare data for Excel
      const excelData = answers.map((answer, index) => ({
        "S.No": index + 1,
        "Section": answer.sectionName || "",
        "Excel Header": answer.excelQuestionHeader || "",
        "Question": answer.questionText,
        "Selected Answer": answer.optionText
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      worksheet['!cols'] = [
        { wch: 8 },   // S.No
        { wch: 25 },  // Section
        { wch: 30 },  // Excel Header
        { wch: 60 },  // Question
        { wch: 30 }   // Selected Answer
      ];

      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Student Answers");

      // Generate filename
      const filename = `${student.name.replace(/\s+/g, '_')}_Answers_${Date.now()}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      alert(`Download successful for ${student.name}!`);
      onHide();
    } catch (error) {
      console.error("Error downloading:", error);
      alert("Failed to download. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop fade show"
        onClick={onHide}
        style={{ zIndex: 1040 }}
      ></div>

      {/* Modal */}
      <div
        className="modal fade show"
        style={{
          display: 'block',
          zIndex: 1050,
        }}
        tabIndex={-1}
        role="dialog"
      >
        <div className="modal-dialog modal-dialog-centered modal-xl" role="document">
          <div className="modal-content" style={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            {/* Header */}
            <div className="modal-header" style={{ borderBottom: '2px solid #f0f0f0', padding: '1.5rem' }}>
              <h5 className="modal-title" style={{ color: '#1a1a2e', fontWeight: 700 }}>
                <i className="bi bi-file-earmark-excel me-2" style={{ color: '#4361ee' }}></i>
                Student Answer Sheet
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={onHide}
                disabled={downloading}
                aria-label="Close"
              ></button>
            </div>

            {/* Body */}
            <div className="modal-body" style={{ padding: '2rem', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Student Details */}
              <div className="mb-4">
                <h6 className="mb-3" style={{ color: '#1a1a2e', fontWeight: 600 }}>Student Details</h6>
                <div className="card border-0" style={{ background: '#f8f9fa', borderRadius: '12px' }}>
                  <div className="card-body p-3">
                    <div className="row g-3">
                      <div className="col-md-3">
                        <div className="d-flex align-items-center gap-2">
                          <i className="bi bi-person-fill" style={{ color: '#4361ee' }}></i>
                          <div>
                            <small className="text-muted d-block">Student Name</small>
                            <strong style={{ color: '#1a1a2e', fontSize: '0.9rem' }}>{student.name}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="d-flex align-items-center gap-2">
                          <i className="bi bi-card-text" style={{ color: '#4361ee' }}></i>
                          <div>
                            <small className="text-muted d-block">Roll Number</small>
                            <strong style={{ color: '#1a1a2e', fontSize: '0.9rem' }}>{student.schoolRollNumber || 'N/A'}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="d-flex align-items-center gap-2">
                          <i className="bi bi-hash" style={{ color: '#4361ee' }}></i>
                          <div>
                            <small className="text-muted d-block">User ID</small>
                            <strong style={{ color: '#1a1a2e', fontSize: '0.9rem' }}>#{student.userStudentId}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="d-flex align-items-center gap-2">
                          <i className="bi bi-clipboard-check" style={{ color: '#4361ee' }}></i>
                          <div>
                            <small className="text-muted d-block">Total Answers</small>
                            <strong style={{ color: '#1a1a2e', fontSize: '0.9rem' }}>{answers.length}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Answers Table */}
              <div className="mb-3">
                <h6 className="mb-3" style={{ color: '#1a1a2e', fontWeight: 600 }}>
                  <i className="bi bi-table me-2"></i>
                  Student Answers
                </h6>

                {loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-3 text-muted">Loading answers...</p>
                  </div>
                ) : error ? (
                  <div className="alert alert-danger" style={{ borderRadius: '10px' }}>
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    {error}
                  </div>
                ) : !student.selectedAssessment ? (
                  <div className="alert alert-warning" style={{ borderRadius: '10px' }}>
                    <i className="bi bi-exclamation-circle me-2"></i>
                    No assessment assigned to this student.
                  </div>
                ) : answers.length === 0 ? (
                  <div className="alert alert-info" style={{ borderRadius: '10px' }}>
                    <i className="bi bi-info-circle me-2"></i>
                    No answers found for this student.
                  </div>
                ) : (
                  <div className="table-responsive" style={{ borderRadius: '12px', border: '1px solid #e0e0e0' }}>
                    <table className="table table-hover mb-0">
                      <thead style={{ background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr>
                          <th style={{ padding: '12px 16px', fontWeight: 600, color: '#1a1a2e', width: '60px' }}>S.No</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600, color: '#1a1a2e', width: '200px' }}>Section</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600, color: '#1a1a2e', width: '220px' }}>Excel Header</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600, color: '#1a1a2e' }}>Question Text</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600, color: '#1a1a2e', width: '250px' }}>Selected Answer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {answers.map((answer, index) => (
                          <tr key={`${answer.questionId}-${answer.optionId}`}>
                            <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                              <span className="badge bg-light text-dark" style={{ fontSize: '0.85rem' }}>
                                {index + 1}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#333' }}>
                              <span className="badge bg-light text-dark" style={{ fontSize: '0.85rem' }}>
                                {answer.sectionName || 'N/A'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#333' }}>
                              {answer.excelQuestionHeader || 'N/A'}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#333' }}>
                              {answer.questionText}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span
                                className="badge"
                                style={{
                                  background: 'rgba(67, 97, 238, 0.1)',
                                  color: '#4361ee',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontWeight: 500,
                                  fontSize: '0.85rem'
                                }}
                              >
                                {answer.optionText}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer" style={{ borderTop: '2px solid #f0f0f0', padding: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={onHide}
                disabled={downloading}
                style={{
                  borderRadius: '10px',
                  padding: '0.6rem 1.5rem',
                  fontWeight: 600,
                }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDownload}
                disabled={downloading || loading || answers.length === 0}
                style={{
                  background: 'linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.6rem 1.5rem',
                  fontWeight: 600,
                }}
              >
                {downloading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Downloading...
                  </>
                ) : (
                  <>
                    <i className="bi bi-download me-2"></i>
                    Download Excel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentAnswerExcelModal;
