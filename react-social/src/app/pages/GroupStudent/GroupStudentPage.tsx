import React, { useState, useEffect } from "react";
import { ReadCollegeData } from "../College/API/College_APIs";
import { getStudentsWithMappingByInstituteId, getAllAssessments, Assessment } from "../StudentInformation/StudentInfo_APIs";

type Student = {
  id: number;
  name: string;
  schoolRollNumber: string;
  selectedAssessment: string;
  userStudentId: number;
  assessmentName?: string;
  phoneNumber?: string;
  studentDob?: string;
  username?: string;
};

export default function Users() {
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());

  useEffect(() => {
    ReadCollegeData()
      .then((res: any) => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        console.log("Fetched Institutes:", list);
        setInstitutes(list);
      })
      .catch((err: any) => console.error("Failed to fetch institutes", err));

    // Fetch assessments
    getAllAssessments()
      .then(response => {
        setAssessments(response.data);
      })
      .catch(error => {
        console.error("Error fetching assessments:", error);
      });
  }, []);

  useEffect(() => {
    if (selectedInstitute) {
      setLoading(true);
      getStudentsWithMappingByInstituteId(Number(selectedInstitute))
        .then(response => {
          const studentData = response.data.map((student: any) => {
            const assessmentId = student.assessmentId ? String(student.assessmentId) : "";
            const assessment = assessments.find(a => a.id === Number(assessmentId));
            
            return {
              id: student.id,
              name: student.name || "",
              phoneNumber: student.phoneNumber || "",
              studentDob: student.studentDob || "",
              schoolRollNumber: student.schoolRollNumber || "",
              selectedAssessment: assessmentId,
              userStudentId: student.userStudentId,
              assessmentName: assessment?.assessmentName || "",
              username: student.username || ""
            };
          });
          console.log("Loaded students:", studentData);
          setStudents(studentData);
        })
        .catch(error => {
          console.error("Error fetching student info:", error);
        })
        .finally(() => setLoading(false));
    }
  }, [selectedInstitute, assessments]);

  const filteredStudents = students.filter((s) => {
    return (
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.schoolRollNumber.toLowerCase().includes(query.toLowerCase()) ||
      s.userStudentId.toString().includes(query)
    );
  });

  const getSelectedInstituteName = () => {
    const institute = institutes.find(inst => inst.instituteCode === selectedInstitute);
    return institute?.instituteName || "";
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    
    // Extract just the date part (YYYY-MM-DD) from the ISO string
    const datePart = dateString.split('T')[0];
    
    // Convert to a more readable format (DD-MM-YYYY)
    const date = new Date(datePart);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
  };

  const handleCheckboxChange = (userStudentId: number) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userStudentId)) {
        newSet.delete(userStudentId);
      } else {
        newSet.add(userStudentId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.userStudentId)));
    }
  };

  return (
    <div className="min-vh-100" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)', padding: '2rem' }}>
      <style>{`
        .form-select-custom {
          width: 100%;
          padding: 0.7rem 1rem;
          font-size: 0.95rem;
          font-weight: 500;
          border: 2px solid #e0e0e0;
          border-radius: 10px;
          transition: all 0.3s ease;
          background-color: white;
          cursor: pointer;
        }

        .form-select-custom:focus {
          outline: none;
          border-color: #4361ee;
          box-shadow: 0 0 0 4px rgba(67, 97, 238, 0.1);
        }

        .form-select-custom:hover {
          border-color: #4361ee;
        }

        .custom-checkbox {
          width: 20px;
          height: 20px;
          cursor: pointer;
          accent-color: #4361ee;
        }

        .institute-dropdown-container {
          max-width: 350px;
          margin-bottom: 1.5rem;
        }
      `}</style>

      {/* Institute Dropdown - Always visible at top left */}
      <div className="institute-dropdown-container">
        <label className="form-label mb-2 d-flex align-items-center gap-2" style={{ fontWeight: 600, color: '#1a1a2e', fontSize: '0.95rem' }}>
          <i className="bi bi-building" style={{ color: '#4361ee' }}></i>
          Select Institute
        </label>
        <select
          className="form-select-custom"
          value={selectedInstitute}
          onChange={(e) => {
            console.log("Selected value:", e.target.value);
            const newValue = e.target.value ? Number(e.target.value) : "";
            setSelectedInstitute(newValue);
            if (!newValue) {
              setStudents([]);
              setQuery("");
              setSelectedStudents(new Set());
            }
          }}
        >
          <option value="">🏫 Select Institute</option>
          {institutes.map((inst) => (
            <option key={inst.instituteCode} value={inst.instituteCode}>
              {inst.instituteName}
            </option>
          ))}
        </select>
      </div>

      {/* Students List Section - Only shown when institute is selected */}
      {selectedInstitute && (
        <>
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
                    View all students enrolled in {getSelectedInstituteName()}
                  </p>
                </div>
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
                  {selectedStudents.size > 0 && (
                    <span className="badge bg-success px-3 py-2" style={{ borderRadius: '20px', fontSize: '0.9rem' }}>
                      {selectedStudents.size} Selected
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
                        <th style={{ padding: '16px 24px', fontWeight: 600, color: '#1a1a2e', borderBottom: '2px solid #e0e0e0', width: '60px' }}>
                          <input
                            type="checkbox"
                            className="custom-checkbox"
                            checked={selectedStudents.size === filteredStudents.length && filteredStudents.length > 0}
                            onChange={handleSelectAll}
                          />
                        </th>
                        <th style={{ padding: '16px 24px', fontWeight: 600, color: '#1a1a2e', borderBottom: '2px solid #e0e0e0' }}>
                          User ID
                        </th>
                        <th style={{ padding: '16px 24px', fontWeight: 600, color: '#1a1a2e', borderBottom: '2px solid #e0e0e0' }}>
                          Username
                        </th>
                        <th style={{ padding: '16px 24px', fontWeight: 600, color: '#1a1a2e', borderBottom: '2px solid #e0e0e0' }}>
                          Roll Number
                        </th>
                        <th style={{ padding: '16px 24px', fontWeight: 600, color: '#1a1a2e', borderBottom: '2px solid #e0e0e0' }}>
                          Student Name
                        </th>
                        <th style={{ padding: '16px 24px', fontWeight: 600, color: '#1a1a2e', borderBottom: '2px solid #e0e0e0' }}>
                          Allotted Assessment
                        </th>
                        <th style={{ padding: '16px 24px', fontWeight: 600, color: '#1a1a2e', borderBottom: '2px solid #e0e0e0' }}>
                          Phone Number
                        </th>
                        <th style={{ padding: '16px 24px', fontWeight: 600, color: '#1a1a2e', borderBottom: '2px solid #e0e0e0' }}>
                          DOB
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
                            <input
                              type="checkbox"
                              className="custom-checkbox"
                              checked={selectedStudents.has(student.userStudentId)}
                              onChange={() => handleCheckboxChange(student.userStudentId)}
                            />
                          </td>
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
                            <span className="fw-semibold" style={{ color: '#1a1a2e' }}>{student.username}</span>
                          </td>
                          <td style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
                            <span style={{ fontWeight: 500, color: '#555' }}>
                              {student.schoolRollNumber || '-'}
                            </span>
                          </td>
                          <td style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
                            <span className="fw-semibold" style={{ color: '#1a1a2e' }}>{student.name}</span>
                          </td>
                          <td style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
                            {student.assessmentName ? (
                              <span 
                                className="badge"
                                style={{ 
                                  background: 'rgba(67, 97, 238, 0.1)', 
                                  color: '#4361ee',
                                  padding: '8px 16px',
                                  borderRadius: '8px',
                                  fontWeight: 600,
                                  fontSize: '0.85rem'
                                }}
                              >
                                {student.assessmentName}
                              </span>
                            ) : (
                              <span className="text-muted">
                                <i className="bi bi-dash-circle me-1"></i>
                                Not Assigned
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
                            {student.phoneNumber ? (
                              <div className="d-flex align-items-center gap-2">
                                <i className="bi bi-telephone-fill" style={{ color: '#4361ee' }}></i>
                                <span style={{ fontWeight: 500, color: '#555' }}>
                                  {student.phoneNumber}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted">
                                <i className="bi bi-dash-circle me-1"></i>
                                Not Available
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
                            {student.studentDob ? (
                              <div className="d-flex align-items-center gap-2">
                                <i className="bi bi-calendar-event-fill" style={{ color: '#4361ee' }}></i>
                                <span style={{ fontWeight: 500, color: '#555' }}>
                                  {formatDate(student.studentDob)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted">
                                <i className="bi bi-dash-circle me-1"></i>
                                Not Available
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* No Institute Selected Message */}
      {!selectedInstitute && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
          <div className="card-body text-center py-5">
            <div 
              className="mx-auto mb-4"
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 30px rgba(67, 97, 238, 0.3)'
              }}
            >
              <i className="bi bi-buildings-fill text-white" style={{ fontSize: '2.5rem' }}></i>
            </div>
            <h4 className="mb-3 fw-semibold" style={{ color: '#1a1a2e' }}>
              Select an Institute
            </h4>
            <p className="text-muted mb-0">
              Please select an institute from the dropdown above to view students
            </p>
          </div>
        </div>
      )}
    </div>
  );
}