// StudentAnswerExcelModal.tsx
import React, { useState, useEffect } from "react";
import { Student } from "./StudentsList";
import { getStudentAnswersWithDetails, StudentAnswerDetail, getStudentScores, StudentScoreDetail } from "./StudentInfo_APIs";
import * as XLSX from "xlsx";

interface StudentAnswerExcelModalProps {
  show: boolean;
  onHide: () => void;
  student: Student;
}

type TabType = "answers" | "scores";

const StudentAnswerExcelModal: React.FC<StudentAnswerExcelModalProps> = ({ show, onHide, student }) => {
  const [activeTab, setActiveTab] = useState<TabType>("answers");
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<StudentAnswerDetail[]>([]);
  const [scores, setScores] = useState<StudentScoreDetail[]>([]);
  const [studentDetails, setStudentDetails] = useState<{
    name: string;
    rollNumber: string;
    studentClass: number | null;
    dob: string;
  } | null>(null);
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

  // Fetch answers when modal opens
  useEffect(() => {
    const fetchStudentAnswers = async () => {
      if (!show || !student.selectedAssessment) return;

      setLoading(true);
      setError("");
      try {
        const response = await getStudentAnswersWithDetails(
          student.userStudentId,
          Number(student.selectedAssessment)
        );

        const normalized = normalizeAnswers(response.data);
        setAnswers(normalized);
      } catch (err: any) {
        console.error("Error fetching answers:", err);
        setError("Failed to load student answers. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (activeTab === "answers") {
      fetchStudentAnswers();
    }
  }, [show, student.userStudentId, student.selectedAssessment, activeTab]);

  // Fetch scores when scores tab is active
  useEffect(() => {
    const fetchStudentScores = async () => {
      if (!show || !student.selectedAssessment || activeTab !== "scores") return;

      setLoading(true);
      setError("");
      try {
        const response = await getStudentScores(
          student.userStudentId,
          Number(student.selectedAssessment)
        );

        setScores(response.data.scores || []);
        setStudentDetails(response.data.student || null);
      } catch (err: any) {
        console.error("Error fetching scores:", err);
        setError("Failed to load student scores. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchStudentScores();
  }, [show, student.userStudentId, student.selectedAssessment, activeTab]);

  const handleDownloadAnswers = () => {
    setDownloading(true);
    try {
      const excelData = answers.map((answer, index) => ({
        "S.No": index + 1,
        "Section": answer.sectionName || "",
        "Excel Header": answer.excelQuestionHeader || "",
        "Question": answer.questionText,
        "Selected Answer": answer.optionText
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      worksheet['!cols'] = [
        { wch: 8 },
        { wch: 25 },
        { wch: 30 },
        { wch: 60 },
        { wch: 30 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Student Answers");

      const filename = `${student.name.replace(/\s+/g, '_')}_Answers_${Date.now()}.xlsx`;
      XLSX.writeFile(workbook, filename);

      alert(`Download successful for ${student.name}!`);
    } catch (error) {
      console.error("Error downloading:", error);
      alert("Failed to download. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadScores = () => {
    setDownloading(true);
    try {
      // Build header row
      const headers = ["Name", "Roll Number", "Class", "DOB"];
      const mqtNames = scores.map(s => s.measuredQualityTypeDisplayName || s.measuredQualityTypeName);
      const allHeaders = [...headers, ...mqtNames];

      // Build data row (single row for individual export)
      const studentData: Record<string, any> = {
        "Name": studentDetails?.name || student.name || "",
        "Roll Number": studentDetails?.rollNumber || student.schoolRollNumber || "",
        "Class": studentDetails?.studentClass || "",
        "DOB": studentDetails?.dob || ""
      };

      // Add MQT scores
      scores.forEach(score => {
        const mqtName = score.measuredQualityTypeDisplayName || score.measuredQualityTypeName;
        studentData[mqtName] = score.rawScore;
      });

      const excelData = [studentData];

      const worksheet = XLSX.utils.json_to_sheet(excelData, { header: allHeaders });

      // Set column widths
      const colWidths = [
        { wch: 25 }, // Name
        { wch: 15 }, // Roll Number
        { wch: 10 }, // Class
        { wch: 15 }, // DOB
        ...mqtNames.map(() => ({ wch: 20 })) // MQT columns
      ];
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Student Scores");

      const filename = `${student.name.replace(/\s+/g, '_')}_Scores_${Date.now()}.xlsx`;
      XLSX.writeFile(workbook, filename);

      alert(`Scores download successful for ${student.name}!`);
    } catch (error) {
      console.error("Error downloading scores:", error);
      alert("Failed to download scores. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownload = () => {
    if (activeTab === "answers") {
      handleDownloadAnswers();
    } else {
      handleDownloadScores();
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
                Student Data Export
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={onHide}
                disabled={downloading}
                aria-label="Close"
              ></button>
            </div>

            {/* Tab Navigation */}
            <div className="px-4 pt-3">
              <ul className="nav nav-tabs" role="tablist">
                <li className="nav-item" role="presentation">
                  <button
                    className={`nav-link ${activeTab === "answers" ? "active" : ""}`}
                    onClick={() => setActiveTab("answers")}
                    type="button"
                    style={{
                      fontWeight: 600,
                      color: activeTab === "answers" ? '#4361ee' : '#666',
                      borderColor: activeTab === "answers" ? '#4361ee #4361ee #fff' : 'transparent'
                    }}
                  >
                    <i className="bi bi-list-check me-2"></i>
                    Answers
                  </button>
                </li>
                <li className="nav-item" role="presentation">
                  <button
                    className={`nav-link ${activeTab === "scores" ? "active" : ""}`}
                    onClick={() => setActiveTab("scores")}
                    type="button"
                    style={{
                      fontWeight: 600,
                      color: activeTab === "scores" ? '#4361ee' : '#666',
                      borderColor: activeTab === "scores" ? '#4361ee #4361ee #fff' : 'transparent'
                    }}
                  >
                    <i className="bi bi-graph-up me-2"></i>
                    Scores
                  </button>
                </li>
              </ul>
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
                            <small className="text-muted d-block">{activeTab === "answers" ? "Total Answers" : "Total Scores"}</small>
                            <strong style={{ color: '#1a1a2e', fontSize: '0.9rem' }}>
                              {activeTab === "answers" ? answers.length : scores.length}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content based on active tab */}
              {activeTab === "answers" ? (
                /* Answers Table */
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
              ) : (
                /* Scores Table */
                <div className="mb-3">
                  <h6 className="mb-3" style={{ color: '#1a1a2e', fontWeight: 600 }}>
                    <i className="bi bi-graph-up me-2"></i>
                    Assessment Scores
                  </h6>

                  {loading ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      <p className="mt-3 text-muted">Loading scores...</p>
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
                  ) : scores.length === 0 ? (
                    <div className="alert alert-info" style={{ borderRadius: '10px' }}>
                      <i className="bi bi-info-circle me-2"></i>
                      No scores found for this student. The student may not have completed the assessment yet.
                    </div>
                  ) : (
                    <div className="table-responsive" style={{ borderRadius: '12px', border: '1px solid #e0e0e0' }}>
                      <table className="table table-hover mb-0">
                        <thead style={{ background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr>
                            <th style={{ padding: '12px 16px', fontWeight: 600, color: '#1a1a2e', width: '60px' }}>S.No</th>
                            <th style={{ padding: '12px 16px', fontWeight: 600, color: '#1a1a2e' }}>Measured Quality</th>
                            <th style={{ padding: '12px 16px', fontWeight: 600, color: '#1a1a2e' }}>Type</th>
                            <th style={{ padding: '12px 16px', fontWeight: 600, color: '#1a1a2e', width: '150px' }}>Raw Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scores.map((score, index) => (
                            <tr key={`${score.measuredQualityTypeName}-${index}`}>
                              <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                                <span className="badge bg-light text-dark" style={{ fontSize: '0.85rem' }}>
                                  {index + 1}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', color: '#333' }}>
                                <span className="badge bg-light text-dark" style={{ fontSize: '0.85rem' }}>
                                  {score.measuredQualityName || 'N/A'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', color: '#333' }}>
                                {score.measuredQualityTypeDisplayName || score.measuredQualityTypeName}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <span
                                  className="badge"
                                  style={{
                                    background: 'rgba(76, 175, 80, 0.1)',
                                    color: '#4caf50',
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    fontSize: '1rem'
                                  }}
                                >
                                  {score.rawScore}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
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
                disabled={downloading || loading || (activeTab === "answers" ? answers.length === 0 : scores.length === 0)}
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
                    Download {activeTab === "answers" ? "Answers" : "Scores"}
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
