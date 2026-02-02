// StudentsList.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStudentsWithMappingByInstituteId, getAllAssessments, bulkAlotAssessment, Assessment } from "./StudentInfo_APIs";
import StudentAnswerExcelModal from "./StudentAnswerExcelModal";
import ResetAssessmentModal from "./ResetAssessmentModal";

export type Student = {
  id: number;
  name: string;
  schoolRollNumber: string;
  selectedAssessment: string;
  userStudentId: number;
  assignedAssessmentIds: number[];
};

export default function StudentsList() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [assessmentsLoading, setAssessmentsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Computed loading state - true if either students or assessments are loading
  const loading = studentsLoading || assessmentsLoading;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Reset modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStudent, setResetStudent] = useState<Student | null>(null);

  useEffect(() => {
    const instituteId = localStorage.getItem('instituteId');

    // Fetch assessments
    setAssessmentsLoading(true);
    getAllAssessments()
      .then(response => {
        setAssessments(response.data);
        console.log("Loaded assessments:", response.data); // Debug log
      })
      .catch(error => {
        console.error("Error fetching assessments:", error);
      })
      .finally(() => {
        setAssessmentsLoading(false);
      });

    // Fetch students
    if (instituteId) {
      setStudentsLoading(true);
      getStudentsWithMappingByInstituteId(Number(instituteId))
        .then(response => {
          const studentData = response.data.map((student: any) => {
            // Ensure assignedAssessmentIds is always an array
            const assignedIds = Array.isArray(student.assignedAssessmentIds)
              ? student.assignedAssessmentIds
              : [];
            return {
              id: student.id,
              name: student.name || "",
              schoolRollNumber: student.schoolRollNumber || "",
              selectedAssessment: "",
              userStudentId: student.userStudentId,
              assignedAssessmentIds: assignedIds,
            };
          });
          console.log("Loaded students:", studentData); // Debug log
          setStudents(studentData);
        })
        .catch(error => {
          console.error("Error fetching student info:", error);
        })
        .finally(() => {
          setStudentsLoading(false);
        });
    } else {
      setStudentsLoading(false);
    }
  }, []);

  const handleAssessmentChange = (studentId: number, assessmentId: string) => {
    setStudents(prev =>
      prev.map(s =>
        s.id === studentId ? { ...s, selectedAssessment: assessmentId } : s
      )
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    // Prevent multiple concurrent submissions
    if (saving) {
      return;
    }

    // Collect all new assignments and deduplicate
    const assignmentMap = new Map<string, { userStudentId: number; assessmentId: number }>();
    students
      .filter(s => s.selectedAssessment && !s.assignedAssessmentIds.includes(Number(s.selectedAssessment)))
      .forEach(s => {
        const key = `${s.userStudentId}-${s.selectedAssessment}`;
        if (!assignmentMap.has(key)) {
          assignmentMap.set(key, {
            userStudentId: s.userStudentId,
            assessmentId: Number(s.selectedAssessment),
          });
        }
      });

    const assignments = Array.from(assignmentMap.values());

    if (assignments.length === 0) {
      alert("No new assessments to save.");
      return;
    }

    setSaving(true);
    try {
      await bulkAlotAssessment(assignments);
      alert(`${assignments.length} assessment(s) saved successfully!`);
      setHasChanges(false);

      // Refresh data
      const instituteId = localStorage.getItem('instituteId');
      if (instituteId) {
        const response = await getStudentsWithMappingByInstituteId(Number(instituteId));
        const studentData = response.data.map((student: any) => {
          const assignedIds = Array.isArray(student.assignedAssessmentIds)
            ? student.assignedAssessmentIds
            : [];
          return {
            id: student.id,
            name: student.name || "",
            schoolRollNumber: student.schoolRollNumber || "",
            selectedAssessment: "",
            userStudentId: student.userStudentId,
            assignedAssessmentIds: assignedIds,
          };
        });
        setStudents(studentData);
      }
    } catch (error) {
      console.error("Error saving assessments:", error);
      alert("Failed to save assessments. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadClick = (student: Student) => {
    console.log("Download clicked for student:", student); // Debug log
    console.log("User Student ID:", student.userStudentId); // Debug log
    console.log("Assessment ID:", student.selectedAssessment); // Debug log
    setSelectedStudent(student);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedStudent(null);
  };

  const handleResetClick = (student: Student) => {
    setResetStudent(student);
    setShowResetModal(true);
  };

  const handleCloseResetModal = () => {
    setShowResetModal(false);
    setResetStudent(null);
  };

  const handleResetSuccess = async () => {
    // Refresh students data
    const instituteId = localStorage.getItem('instituteId');
    if (instituteId) {
      try {
        const response = await getStudentsWithMappingByInstituteId(Number(instituteId));
        const studentData = response.data.map((student: any) => {
          const assignedIds = Array.isArray(student.assignedAssessmentIds)
            ? student.assignedAssessmentIds
            : [];
          return {
            id: student.id,
            name: student.name || "",
            schoolRollNumber: student.schoolRollNumber || "",
            selectedAssessment: "",
            userStudentId: student.userStudentId,
            assignedAssessmentIds: assignedIds,
          };
        });
        setStudents(studentData);
      } catch (error) {
        console.error("Error refreshing students:", error);
      }
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      return (
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.schoolRollNumber.toLowerCase().includes(query.toLowerCase()) ||
        s.userStudentId.toString().includes(query) // Changed from s.id to s.userStudentId
      );
    });
  }, [students, query]);

  return (
    <div className="min-vh-100" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)', padding: '2rem' }}>
      {/* Header Card */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '16px' }}>
        <div className="card-body p-4">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h2 className="mb-1 fw-bold" style={{ color: '#1a1a2e' }}>
                <i className="bi bi-people-fill me-2" style={{ color: '#4361ee' }}></i>
                Students List
              </h2>
              <p className="text-muted mb-0">
                Manage students and assign assessments for your institute
              </p>
            </div>
            <button
              className="btn btn-primary d-flex align-items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)',
                border: 'none',
                borderRadius: '10px',
                padding: '0.6rem 1.2rem',
                fontWeight: 600,
              }}
              onClick={() => navigate("/student/registration-form")}
            >
              <i className="bi bi-plus-lg"></i>
              Add Student
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '16px' }}>
        <div className="card-body p-4">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <div className="position-relative flex-grow-1" style={{ maxWidth: '400px' }}>
              <i className="bi bi-search position-absolute" style={{ left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9e9e9e' }}></i>
              <input
                className="form-control"
                placeholder="Search by name, roll number, or user ID..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  paddingLeft: '42px',
                  borderRadius: '10px',
                  border: '2px solid #e0e0e0',
                  padding: '0.7rem 1rem 0.7rem 42px',
                }}
              />
            </div>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-primary px-3 py-2" style={{ borderRadius: '20px', fontSize: '0.9rem' }}>
                {filteredStudents.length} Students
              </span>
              {hasChanges && (
                <span className="badge bg-warning text-dark px-3 py-2" style={{ borderRadius: '20px', fontSize: '0.9rem' }}>
                  <i className="bi bi-exclamation-circle me-1"></i>
                  Unsaved Changes
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-3 text-muted">Loading students...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-5">
              <div
                className="mx-auto mb-3"
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <i className="bi bi-inbox" style={{ fontSize: '2rem', color: '#bdbdbd' }}></i>
              </div>
              <h5 className="text-muted">No Students Found</h5>
              <p className="text-muted mb-0">Try adjusting your search or add new students</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: '#1a1a2e', borderBottom: '2px solid #e0e0e0' }}>
                      User ID
                    </th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: '#1a1a2e', borderBottom: '2px solid #e0e0e0' }}>
                      Student Name
                    </th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: '#1a1a2e', borderBottom: '2px solid #e0e0e0' }}>
                      Roll Number
                    </th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: '#1a1a2e', borderBottom: '2px solid #e0e0e0', minWidth: '220px' }}>
                      Assessment
                    </th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: '#1a1a2e', borderBottom: '2px solid #e0e0e0' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student, index) => (
                    <tr
                      key={student.userStudentId}
                      style={{
                        background: index % 2 === 0 ? '#fff' : '#fafbfc',
                        transition: 'background 0.2s'
                      }}
                    >
                      <td style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
                        <span
                          className="badge"
                          style={{
                            background: 'rgba(67, 97, 238, 0.1)',
                            color: '#4361ee',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontWeight: 600,
                            fontSize: '0.85rem'
                          }}
                        >
                          #{student.userStudentId}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
                        <div className="d-flex align-items-center gap-3">
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontWeight: 600,
                              fontSize: '0.9rem'
                            }}
                          >
                            {student.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <span className="fw-semibold" style={{ color: '#1a1a2e' }}>{student.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
                        <span style={{ fontWeight: 500, color: '#555' }}>
                          {student.schoolRollNumber || '-'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
                        <select
                          value={student.selectedAssessment}
                          onChange={(e) => handleAssessmentChange(student.id, e.target.value)}
                          style={{
                            width: '100%',
                            minWidth: '200px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '2px solid #e0e0e0',
                            background: student.selectedAssessment ? 'rgba(67, 97, 238, 0.05)' : '#fff',
                            cursor: 'pointer',
                            fontWeight: 500,
                            fontSize: '0.9rem',
                          }}
                        >
                          <option value="">-- Select Assessment --</option>
                          {assessments.map((assessment) => {
                            const isAlreadyAssigned = student.assignedAssessmentIds.includes(assessment.id);
                            return (
                              <option
                                key={assessment.id}
                                value={assessment.id}
                                disabled={isAlreadyAssigned}
                                style={{ color: isAlreadyAssigned ? '#999' : '#333' }}
                              >
                                {assessment.assessmentName}{isAlreadyAssigned ? ' (Assigned)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </td>

                      <td style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
                        <div className="d-flex gap-2">
                          <button
                            className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                            onClick={() => handleDownloadClick(student)}
                            style={{
                              borderRadius: '8px',
                              padding: '6px 12px',
                              fontWeight: 500,
                              transition: 'all 0.2s'
                            }}
                          >
                            <i className="bi bi-download"></i>
                            Download
                          </button>
                          <button
                            className="btn btn-outline-warning btn-sm d-flex align-items-center gap-1"
                            onClick={() => handleResetClick(student)}
                            disabled={student.assignedAssessmentIds.length === 0}
                            title={student.assignedAssessmentIds.length === 0 ? "No assessments assigned" : "Reset assessment"}
                            style={{
                              borderRadius: '8px',
                              padding: '6px 12px',
                              fontWeight: 500,
                              transition: 'all 0.2s'
                            }}
                          >
                            <i className="bi bi-arrow-counterclockwise"></i>
                            Reset
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Save Button Footer */}
        {!loading && filteredStudents.length > 0 && (
          <div
            className="card-footer bg-white border-top p-4"
            style={{ borderRadius: '0 0 16px 16px' }}
          >
            <div className="d-flex justify-content-between align-items-center">
              <span className="text-muted">
                <i className="bi bi-info-circle me-2"></i>
                Select assessments for students and click save to apply changes
              </span>
              <button
                className="btn btn-lg d-flex align-items-center gap-2"
                onClick={handleSave}
                disabled={!hasChanges || saving}
                style={{
                  background: (hasChanges && !saving)
                    ? 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)'
                    : '#e0e0e0',
                  color: (hasChanges && !saving) ? '#fff' : '#9e9e9e',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.8rem 2rem',
                  fontWeight: 600,
                  boxShadow: (hasChanges && !saving) ? '0 8px 20px rgba(76, 175, 80, 0.3)' : 'none',
                  transition: 'all 0.3s ease',
                  cursor: (hasChanges && !saving) ? 'pointer' : 'not-allowed'
                }}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2-circle"></i>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Student Answer Excel Modal */}
      {showModal && selectedStudent && (
        <StudentAnswerExcelModal
          show={showModal}
          onHide={handleCloseModal}
          student={selectedStudent}
        />
      )}

      {/* Reset Assessment Modal */}
      {resetStudent && (
        <ResetAssessmentModal
          show={showResetModal}
          onClose={handleCloseResetModal}
          userStudentId={resetStudent.userStudentId}
          studentName={resetStudent.name}
          onResetSuccess={handleResetSuccess}
        />
      )}
    </div>
  );
}