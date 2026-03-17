import React, { useState, useEffect } from "react";
import { ReadCollegeData } from "../College/API/College_APIs";
import { getAllAssessments, getBetReport, BetReportResponse, exportScoresByInstitute } from "../StudentInformation/StudentInfo_APIs";

interface Institute {
  instituteCode: number;
  instituteName: string;
}

interface AssessmentFull {
  id: number;
  assessmentName: string;
  isActive?: boolean;
  questionnaire?: {
    questionnaireId: number;
    name: string;
    type: boolean | null;
  };
}

const ReportsPage: React.FC = () => {
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [betAssessments, setBetAssessments] = useState<AssessmentFull[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");
  const [selectedAssessment, setSelectedAssessment] = useState<number | "">("");
  const [reportData, setReportData] = useState<BetReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string>("");

  // Fetch institutes and assessments on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [instituteRes, assessmentRes] = await Promise.all([
          ReadCollegeData(),
          getAllAssessments()
        ]);

        const instituteList = Array.isArray(instituteRes.data)
          ? instituteRes.data
          : instituteRes.data?.data || [];
        setInstitutes(instituteList);

        // Filter to only BET assessments (questionnaire.type === true)
        const allAssessments = assessmentRes.data || [];
        const betOnly = allAssessments.filter(
          (a: any) => a.questionnaire?.type === true
        );
        setBetAssessments(betOnly);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load institutes or assessments.");
      }
    };

    fetchData();
  }, []);

  // Fetch report data when both selections are made
  useEffect(() => {
    if (!selectedInstitute || !selectedAssessment) {
      setReportData(null);
      return;
    }

    const fetchReport = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getBetReport(
          Number(selectedInstitute),
          Number(selectedAssessment)
        );
        setReportData(response.data);
      } catch (err: any) {
        console.error("Error fetching BET report:", err);
        setError(
          err.response?.data?.error || "Failed to fetch report data."
        );
        setReportData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [selectedInstitute, selectedAssessment]);

  const handleInstituteChange = (value: string) => {
    setSelectedInstitute(value ? Number(value) : "");
    setSelectedAssessment("");
    setReportData(null);
  };

  const handleAssessmentChange = (value: string) => {
    setSelectedAssessment(value ? Number(value) : "");
    setReportData(null);
  };

  const handleDownloadRawScores = async () => {
    if (!selectedInstitute || !selectedAssessment) return;

    setDownloading(true);
    setError("");
    try {
      const response = await exportScoresByInstitute(
        Number(selectedInstitute),
        Number(selectedAssessment)
      );

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const instituteName =
        institutes.find((i) => i.instituteCode === selectedInstitute)
          ?.instituteName || "institute";
      const assessmentName =
        betAssessments.find((a) => a.id === selectedAssessment)
          ?.assessmentName || "assessment";
      link.download = `${instituteName.replace(/\s+/g, "_")}_${assessmentName.replace(/\s+/g, "_")}_raw_scores.xlsx`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Error downloading raw scores:", err);
      setError(
        err.response?.data?.error || "Failed to download raw scores."
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="min-vh-100"
      style={{
        background: "linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)",
        padding: "2rem",
      }}
    >
      {/* Header */}
      <div
        className="card border-0 shadow-sm mb-4"
        style={{ borderRadius: "16px", overflow: "hidden" }}
      >
        <div className="card-body p-4">
          <h2 className="mb-1 fw-bold" style={{ color: "#1a1a2e" }}>
            <i
              className="bi bi-file-earmark-bar-graph me-2"
              style={{ color: "#4361ee" }}
            ></i>
            BET Assessment Reports
          </h2>
          <p className="text-muted mb-0">
            View student answers for BET assessments by institute
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          className="alert alert-danger alert-dismissible fade show mb-4"
          style={{ borderRadius: "12px" }}
        >
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
          <button
            type="button"
            className="btn-close"
            onClick={() => setError("")}
          ></button>
        </div>
      )}

      {/* Filter Card */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: "16px" }}>
        <div className="card-body p-4">
          <div className="row g-4">
            {/* Institute Selection */}
            <div className="col-md-6">
              <label
                className="form-label fw-semibold"
                style={{ color: "#1a1a2e" }}
              >
                <i
                  className="bi bi-building me-2"
                  style={{ color: "#4361ee" }}
                ></i>
                Select Institute
              </label>
              <select
                className="form-select"
                style={{
                  borderRadius: "10px",
                  border: "2px solid #e0e0e0",
                  padding: "0.75rem 1rem",
                  fontWeight: 500,
                }}
                value={selectedInstitute}
                onChange={(e) => handleInstituteChange(e.target.value)}
              >
                <option value="">-- Select Institute --</option>
                {institutes.map((inst) => (
                  <option key={inst.instituteCode} value={inst.instituteCode}>
                    {inst.instituteName}
                  </option>
                ))}
              </select>
            </div>

            {/* Assessment Selection (BET only) */}
            <div className="col-md-6">
              <label
                className="form-label fw-semibold"
                style={{ color: "#1a1a2e" }}
              >
                <i
                  className="bi bi-clipboard-check me-2"
                  style={{ color: "#4361ee" }}
                ></i>
                Select BET Assessment
              </label>
              <select
                className="form-select"
                style={{
                  borderRadius: "10px",
                  border: "2px solid #e0e0e0",
                  padding: "0.75rem 1rem",
                  fontWeight: 500,
                }}
                value={selectedAssessment}
                onChange={(e) => handleAssessmentChange(e.target.value)}
              >
                <option value="">-- Select Assessment --</option>
                {betAssessments.map((assessment) => (
                  <option key={assessment.id} value={assessment.id}>
                    {assessment.assessmentName}
                  </option>
                ))}
              </select>
              {betAssessments.length === 0 && (
                <p className="text-muted mt-2 mb-0 small">
                  <i className="bi bi-info-circle me-1"></i>
                  No BET assessments found.
                </p>
              )}
            </div>
          </div>

          {/* Info bar */}
          {selectedInstitute && selectedAssessment && reportData && (
            <div
              className="mt-4 p-3 rounded-3"
              style={{ background: "#f8f9fa", border: "1px solid #e0e0e0" }}
            >
              <div className="d-flex align-items-center gap-3">
                <div
                  className="d-flex align-items-center justify-content-center"
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: "rgba(67, 97, 238, 0.1)",
                  }}
                >
                  <i
                    className="bi bi-people-fill"
                    style={{ color: "#4361ee", fontSize: "1.25rem" }}
                  ></i>
                </div>
                <div>
                  <p className="mb-0 text-muted small">
                    Completed Students
                  </p>
                  <h4 className="mb-0 fw-bold" style={{ color: "#1a1a2e" }}>
                    {reportData.rows.length}
                  </h4>
                </div>
                <div className="ms-4">
                  <p className="mb-0 text-muted small">Dynamic Columns</p>
                  <h4 className="mb-0 fw-bold" style={{ color: "#1a1a2e" }}>
                    {reportData.columns.length}
                  </h4>
                </div>
                <div className="ms-auto">
                  <button
                    className="btn"
                    onClick={handleDownloadRawScores}
                    disabled={downloading}
                    style={{
                      background: downloading
                        ? "#6c757d"
                        : "linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)",
                      border: "none",
                      borderRadius: "10px",
                      padding: "0.6rem 1.5rem",
                      fontWeight: 600,
                      color: "white",
                      boxShadow: downloading
                        ? "none"
                        : "0 4px 12px rgba(76, 175, 80, 0.3)",
                    }}
                  >
                    {downloading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        ></span>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-file-earmark-excel me-2"></i>
                        Download Raw Scores
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted mt-3">Loading report data...</p>
        </div>
      )}

      {/* Data Table */}
      {!loading && reportData && (
        <div
          className="card border-0 shadow-sm"
          style={{ borderRadius: "16px" }}
        >
          <div className="card-header bg-white border-0 p-4 pb-0">
            <h4 className="mb-1 fw-bold" style={{ color: "#1a1a2e" }}>
              <i
                className="bi bi-table me-2"
                style={{ color: "#4361ee" }}
              ></i>
              Student Answers
            </h4>
            <p className="text-muted mb-0">
              {reportData.rows.length > 0
                ? `Showing ${reportData.rows.length} student(s) who completed the assessment`
                : "No students have completed this assessment for the selected institute"}
            </p>
          </div>

          <div className="card-body p-4">
            {reportData.rows.length === 0 ? (
              <div className="text-center py-5">
                <i
                  className="bi bi-inbox"
                  style={{ fontSize: "3rem", color: "#ccc" }}
                ></i>
                <p className="text-muted mt-3">
                  No completed assessments found for this institute.
                </p>
              </div>
            ) : (
              <div
                className="table-responsive"
                style={{ maxHeight: "70vh", overflow: "auto" }}
              >
                <table className="table table-bordered table-hover table-sm mb-0">
                  <thead
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 2,
                    }}
                  >
                    <tr>
                      <th
                        style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 3,
                          background: "#f0f2f5",
                          fontWeight: 600,
                          color: "#1a1a2e",
                          minWidth: "150px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Name
                      </th>
                      <th
                        style={{
                          position: "sticky",
                          left: "150px",
                          zIndex: 3,
                          background: "#f0f2f5",
                          fontWeight: 600,
                          color: "#1a1a2e",
                          minWidth: "150px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Institute
                      </th>
                      {reportData.columns.map((col) => (
                        <th
                          key={col.key}
                          style={{
                            background: col.isMQT ? "#e8edf5" : "#f0f2f5",
                            fontWeight: 600,
                            color: col.isMQT ? "#4361ee" : "#1a1a2e",
                            whiteSpace: "nowrap",
                            fontSize: "0.8rem",
                            minWidth: "100px",
                          }}
                        >
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows.map((row, idx) => (
                      <tr key={idx}>
                        <td
                          style={{
                            position: "sticky",
                            left: 0,
                            background: "#fff",
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                            zIndex: 1,
                          }}
                        >
                          {row.name}
                        </td>
                        <td
                          style={{
                            position: "sticky",
                            left: "150px",
                            background: "#fff",
                            whiteSpace: "nowrap",
                            zIndex: 1,
                          }}
                        >
                          {row.institute}
                        </td>
                        {reportData.columns.map((col) => (
                          <td
                            key={col.key}
                            style={{
                              whiteSpace: "nowrap",
                              fontSize: "0.85rem",
                              textAlign: col.isMQT ? "center" : "left",
                            }}
                          >
                            {col.isMQT ? (
                              row[col.key] !== "" && row[col.key] !== undefined ? (
                                <span className="badge bg-primary">
                                  {row[col.key]}
                                </span>
                              ) : (
                                <span className="text-muted">-</span>
                              )
                            ) : (
                              row[col.key] || (
                                <span className="text-muted">-</span>
                              )
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prompt to select */}
      {!loading && !reportData && selectedInstitute && selectedAssessment && !error && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}
      {!loading && !reportData && (!selectedInstitute || !selectedAssessment) && (
        <div
          className="card border-0 shadow-sm"
          style={{ borderRadius: "16px" }}
        >
          <div className="card-body p-5 text-center">
            <i
              className="bi bi-arrow-up-circle"
              style={{ fontSize: "3rem", color: "#ccc" }}
            ></i>
            <p className="text-muted mt-3 mb-0">
              Select both an institute and a BET assessment to view the report.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
