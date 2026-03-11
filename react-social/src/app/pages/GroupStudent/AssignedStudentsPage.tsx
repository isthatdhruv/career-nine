import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { GetInstituteMappings } from "../College/API/College_APIs";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

interface ContactPerson {
  id: number;
  name: string;
  email?: string;
  designation?: string;
}

interface AssignedStudent {
  assignmentId: number;
  userStudentId: number;
  name?: string;
  schoolRollNumber?: string;
  controlNumber?: number;
  phoneNumber?: string;
  email?: string;
  studentDob?: string;
  className?: string;
  sectionName?: string;
  username?: string;
  assignedAt?: string;
}

const AssignedStudentsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const instituteId = searchParams.get("instituteId") || "";

  const [contactPersons, setContactPersons] = useState<ContactPerson[]>([]);
  const [cpLoading, setCpLoading] = useState(false);

  const [selectedCpId, setSelectedCpId] = useState<number | "">("");
  const [students, setStudents] = useState<AssignedStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string>("");

  // Load contact persons for the institute
  useEffect(() => {
    if (!instituteId) return;
    setCpLoading(true);
    GetInstituteMappings(Number(instituteId))
      .then((res) => {
        const cps: ContactPerson[] = res.data?.contactPersons || [];
        setContactPersons(cps);
      })
      .catch(() => setContactPersons([]))
      .finally(() => setCpLoading(false));
  }, [instituteId]);

  // Load assigned students when a contact person is selected
  useEffect(() => {
    if (selectedCpId === "") {
      setStudents([]);
      setStudentsError("");
      return;
    }
    setStudentsLoading(true);
    setStudentsError("");
    axios
      .get(`${API_URL}/contact-person/${selectedCpId}/assigned-students`)
      .then((res) => setStudents(res.data || []))
      .catch((err) => {
        const errData = err?.response?.data;
        const errMsg =
          typeof errData === "string"
            ? errData
            : errData?.message || errData?.error || err?.message || "Failed to load students";
        setStudentsError(errMsg);
        setStudents([]);
      })
      .finally(() => setStudentsLoading(false));
  }, [selectedCpId]);

  const selectedCp = contactPersons.find((cp) => cp.id === selectedCpId);

  return (
    <div className="card">
      <div className="card-header border-0 pt-6">
        <div className="card-title">
          <h3 className="card-label fw-bold fs-3">Assigned Students</h3>
        </div>
      </div>

      <div className="card-body pt-0">
        {!instituteId && (
          <div className="alert alert-warning">
            No institute selected. Please navigate here from the institute dashboard.
          </div>
        )}

        {instituteId && (
          <>
            <div className="mb-6" style={{ maxWidth: 400 }}>
              <label className="form-label fw-semibold">Select Contact Person</label>
              {cpLoading ? (
                <div className="text-muted">Loading contact persons...</div>
              ) : contactPersons.length === 0 ? (
                <div className="text-muted">No contact persons found for this institute.</div>
              ) : (
                <select
                  className="form-select form-select-solid"
                  value={selectedCpId}
                  onChange={(e) =>
                    setSelectedCpId(e.target.value === "" ? "" : Number(e.target.value))
                  }
                >
                  <option value="">-- Select a contact person --</option>
                  {contactPersons.map((cp) => (
                    <option key={cp.id} value={cp.id}>
                      {cp.name}
                      {cp.designation ? ` (${cp.designation})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedCp && (
              <div className="mb-4 p-4 bg-light-primary rounded">
                <div className="fw-bold text-primary fs-5">{selectedCp.name}</div>
                {selectedCp.designation && (
                  <div className="text-muted">{selectedCp.designation}</div>
                )}
                {selectedCp.email && (
                  <div className="text-muted">{selectedCp.email}</div>
                )}
              </div>
            )}

            {selectedCpId !== "" && (
              <>
                {studentsLoading && (
                  <div className="text-muted py-4">Loading students...</div>
                )}
                {studentsError && (
                  <div className="alert alert-danger">{studentsError}</div>
                )}
                {!studentsLoading && !studentsError && students.length === 0 && (
                  <div className="text-muted py-4">
                    No students assigned to this contact person.
                  </div>
                )}
                {!studentsLoading && students.length > 0 && (() => {
                  const showUsername = students.some(s => !!s.username);
                  const showRollNumber = students.some(s => !!s.schoolRollNumber);
                  const showControlNumber = students.some(s => s.controlNumber != null);
                  const showClass = students.some(s => !!s.className);
                  const showSection = students.some(s => !!s.sectionName);
                  const showDob = students.some(s => !!s.studentDob);
                  const showPhone = students.some(s => !!s.phoneNumber);
                  const tdStyle = { padding: "12px 16px", whiteSpace: "nowrap" as const };
                  return (
                    <>
                      <div className="text-muted mb-3 fs-6">
                        {students.length} student(s) assigned
                      </div>
                      <table
                        className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4"
                        style={{ width: "100%" }}
                      >
                        <thead>
                          <tr className="fw-bold text-muted bg-light">
                            <th style={{ ...tdStyle, width: 50 }}>#</th>
                            <th style={tdStyle}>Name</th>
                            {showUsername && <th style={tdStyle}>Username</th>}
                            {showRollNumber && <th style={tdStyle}>Roll No.</th>}
                            {showControlNumber && <th style={tdStyle}>Control No.</th>}
                            {showClass && <th style={tdStyle}>Class</th>}
                            {showSection && <th style={tdStyle}>Section</th>}
                            {showDob && <th style={tdStyle}>Date of Birth</th>}
                            {showPhone && <th style={tdStyle}>Phone</th>}
                            <th style={tdStyle}>Assigned At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((s, idx) => (
                            <tr key={s.assignmentId}>
                              <td style={tdStyle}>{idx + 1}</td>
                              <td style={tdStyle}>{s.name || "-"}</td>
                              {showUsername && <td style={tdStyle}>{s.username || "-"}</td>}
                              {showRollNumber && <td style={tdStyle}>{s.schoolRollNumber || "-"}</td>}
                              {showControlNumber && <td style={tdStyle}>{s.controlNumber ?? "-"}</td>}
                              {showClass && <td style={tdStyle}>{s.className || "-"}</td>}
                              {showSection && <td style={tdStyle}>{s.sectionName || "-"}</td>}
                              {showDob && <td style={tdStyle}>{s.studentDob ? new Date(s.studentDob).toLocaleDateString() : "-"}</td>}
                              {showPhone && <td style={tdStyle}>{s.phoneNumber || "-"}</td>}
                              <td style={tdStyle}>
                                {s.assignedAt
                                  ? new Date(s.assignedAt).toLocaleDateString()
                                  : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  );
                })()}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AssignedStudentsPage;
