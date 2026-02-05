import React, { useState, useEffect } from "react";
import { ReadCollegeData } from "../College/API/College_APIs";
import { getAllAssessments, Assessment, exportScoresByInstitute, getStudentsWithMappingByInstituteId } from "../StudentInformation/StudentInfo_APIs";

interface Institute {
  instituteCode: number;
  instituteName: string;
}

const ReportsPage: React.FC = () => {
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");
  const [selectedAssessment, setSelectedAssessment] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string>("");
  const [studentCount, setStudentCount] = useState<number | null>(null);

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

        setAssessments(assessmentRes.data || []);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load institutes or assessments.");
      }
    };

    fetchData();
  }, []);

  // Fetch student count when institute changes
  useEffect(() => {
    const fetchStudentCount = async () => {
      if (!selectedInstitute) {
        setStudentCount(null);
        return;
      }

      setLoading(true);
      try {
        const response = await getStudentsWithMappingByInstituteId(Number(selectedInstitute));
        setStudentCount(response.data?.length || 0);
      } catch (err) {
        console.error("Error fetching student count:", err);
        setStudentCount(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentCount();
  }, [selectedInstitute]);

  const handleExport = async () => {
    if (!selectedInstitute || !selectedAssessment) {
      setError("Please select both institute and assessment.");
      return;
    }

    setDownloading(true);
    setError("");

    try {
      const response = await exportScoresByInstitute(
        Number(selectedInstitute),
        Number(selectedAssessment)
      );

      // Create blob and download
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const instituteName = institutes.find(i => i.instituteCode === selectedInstitute)?.instituteName || "institute";
      const assessmentName = assessments.find(a => a.id === selectedAssessment)?.assessmentName || "assessment";
      link.download = `${instituteName.replace(/\s+/g, '_')}_${assessmentName.replace(/\s+/g, '_')}_scores.xlsx`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert("Export successful!");
    } catch (err: any) {
      console.error("Error exporting scores:", err);
      setError(err.response?.data?.error || "Failed to export scores. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-vh-100" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)', padding: '2rem' }}>
      {/* Header */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div className="card-body p-4">
          <h2 className="mb-1 fw-bold" style={{ color: '#1a1a2e' }}>
            <i className="bi bi-file-earmark-bar-graph me-2" style={{ color: '#4361ee' }}></i>
            Reports & Exports
          </h2>
          <p className="text-muted mb-0">Export student assessment scores in bulk</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-4" style={{ borderRadius: '12px' }}>
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError("")}></button>
        </div>
      )}

      {/* Bulk Score Export Card */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
        <div className="card-header bg-white border-0 p-4 pb-0">
          <h4 className="mb-1 fw-bold" style={{ color: '#1a1a2e' }}>
            <i className="bi bi-download me-2" style={{ color: '#4361ee' }}></i>
            Bulk Score Export
          </h4>
          <p className="text-muted mb-0">Export all student scores for an institute and assessment</p>
        </div>

        <div className="card-body p-4">
          <div className="row g-4">
            {/* Institute Selection */}
            <div className="col-md-6">
              <label className="form-label fw-semibold" style={{ color: '#1a1a2e' }}>
                <i className="bi bi-building me-2" style={{ color: '#4361ee' }}></i>
                Select Institute
              </label>
              <select
                className="form-select"
                style={{
                  borderRadius: '10px',
                  border: '2px solid #e0e0e0',
                  padding: '0.75rem 1rem',
                  fontWeight: 500
                }}
                value={selectedInstitute}
                onChange={(e) => setSelectedInstitute(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">-- Select Institute --</option>
                {institutes.map((inst) => (
                  <option key={inst.instituteCode} value={inst.instituteCode}>
                    {inst.instituteName}
                  </option>
                ))}
              </select>
            </div>

            {/* Assessment Selection */}
            <div className="col-md-6">
              <label className="form-label fw-semibold" style={{ color: '#1a1a2e' }}>
                <i className="bi bi-clipboard-check me-2" style={{ color: '#4361ee' }}></i>
                Select Assessment
              </label>
              <select
                className="form-select"
                style={{
                  borderRadius: '10px',
                  border: '2px solid #e0e0e0',
                  padding: '0.75rem 1rem',
                  fontWeight: 500
                }}
                value={selectedAssessment}
                onChange={(e) => setSelectedAssessment(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">-- Select Assessment --</option>
                {assessments.map((assessment) => (
                  <option key={assessment.id} value={assessment.id}>
                    {assessment.assessmentName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Info Box */}
          {selectedInstitute && (
            <div className="mt-4 p-3 rounded-3" style={{ background: '#f8f9fa', border: '1px solid #e0e0e0' }}>
              <div className="d-flex align-items-center gap-3">
                <div
                  className="d-flex align-items-center justify-content-center"
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'rgba(67, 97, 238, 0.1)'
                  }}
                >
                  <i className="bi bi-people-fill" style={{ color: '#4361ee', fontSize: '1.25rem' }}></i>
                </div>
                <div>
                  <p className="mb-0 text-muted small">Total Students in Institute</p>
                  <h4 className="mb-0 fw-bold" style={{ color: '#1a1a2e' }}>
                    {loading ? (
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    ) : (
                      studentCount !== null ? studentCount : '--'
                    )}
                  </h4>
                </div>
              </div>
            </div>
          )}

          {/* Export Button */}
          <div className="mt-4 pt-3 border-top">
            <button
              className="btn btn-lg"
              onClick={handleExport}
              disabled={!selectedInstitute || !selectedAssessment || downloading}
              style={{
                background: (!selectedInstitute || !selectedAssessment || downloading)
                  ? '#6c757d'
                  : 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
                border: 'none',
                borderRadius: '12px',
                padding: '0.8rem 2rem',
                fontWeight: 600,
                color: 'white',
                boxShadow: (!selectedInstitute || !selectedAssessment || downloading)
                  ? 'none'
                  : '0 8px 20px rgba(76, 175, 80, 0.3)'
              }}
            >
              {downloading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Exporting...
                </>
              ) : (
                <>
                  <i className="bi bi-file-earmark-excel me-2"></i>
                  Export All Scores to Excel
                </>
              )}
            </button>

            {(!selectedInstitute || !selectedAssessment) && (
              <p className="text-muted mt-2 mb-0 small">
                <i className="bi bi-info-circle me-1"></i>
                Please select both institute and assessment to export.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Export Format Info */}
      <div className="card border-0 shadow-sm mt-4" style={{ borderRadius: '16px' }}>
        <div className="card-body p-4">
          <h5 className="fw-bold mb-3" style={{ color: '#1a1a2e' }}>
            <i className="bi bi-info-circle me-2" style={{ color: '#4361ee' }}></i>
            Export Format
          </h5>
          <p className="text-muted mb-3">
            The exported Excel file will contain the following columns:
          </p>
          <div className="table-responsive">
            <table className="table table-bordered mb-0" style={{ borderRadius: '8px', overflow: 'hidden' }}>
              <thead style={{ background: '#f8f9fa' }}>
                <tr>
                  <th style={{ fontWeight: 600, color: '#1a1a2e' }}>Name</th>
                  <th style={{ fontWeight: 600, color: '#1a1a2e' }}>Roll Number</th>
                  <th style={{ fontWeight: 600, color: '#1a1a2e' }}>Class</th>
                  <th style={{ fontWeight: 600, color: '#1a1a2e' }}>DOB</th>
                  <th style={{ fontWeight: 600, color: '#4361ee' }}>MQT 1</th>
                  <th style={{ fontWeight: 600, color: '#4361ee' }}>MQT 2</th>
                  <th style={{ fontWeight: 600, color: '#4361ee' }}>...</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Student Name</td>
                  <td>101</td>
                  <td>10</td>
                  <td>15-05-2010</td>
                  <td><span className="badge bg-success">85</span></td>
                  <td><span className="badge bg-success">72</span></td>
                  <td>...</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-muted mt-3 mb-0 small">
            <i className="bi bi-lightbulb me-1"></i>
            MQT columns are dynamically generated based on the Measured Quality Types associated with the assessment.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
