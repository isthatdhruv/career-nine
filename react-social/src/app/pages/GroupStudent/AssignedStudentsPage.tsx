import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { GetInstituteMappings } from "../College/API/College_APIs";
import { getAllAssessments, Assessment } from "../StudentInformation/StudentInfo_APIs";
import {
  GetReportStatus,
  SendReportsToContactPerson,
} from "../ContactPerson/API/Contact_Person_APIs";

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

interface ReportStatusEntry {
  userStudentId: number;
  studentName: string;
  reportStatus: string;
  reportUrl: string | null;
  hasReport: boolean;
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

  // Send Reports state
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<number | "">("");
  const [reportType, setReportType] = useState<"navigator" | "bet">("navigator");
  const [reportStatuses, setReportStatuses] = useState<ReportStatusEntry[]>([]);
  const [reportStatusLoading, setReportStatusLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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

  // Load assessments
  useEffect(() => {
    setAssessmentsLoading(true);
    getAllAssessments()
      .then((res) => setAssessments(res.data || []))
      .catch(() => setAssessments([]))
      .finally(() => setAssessmentsLoading(false));
  }, []);

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

  // Load report statuses when assessment + contact person + report type are selected
  useEffect(() => {
    if (selectedCpId === "" || selectedAssessment === "") {
      setReportStatuses([]);
      return;
    }
    setReportStatusLoading(true);
    setSendResult(null);
    GetReportStatus(Number(selectedCpId), Number(selectedAssessment), reportType)
      .then((res) => setReportStatuses(res.data || []))
      .catch(() => setReportStatuses([]))
      .finally(() => setReportStatusLoading(false));
  }, [selectedCpId, selectedAssessment, reportType]);

  const selectedCp = contactPersons.find((cp) => cp.id === selectedCpId);
  const reportsAvailable = reportStatuses.filter((r) => r.hasReport).length;

  const handleSendReports = async () => {
    if (selectedCpId === "" || selectedAssessment === "") return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await SendReportsToContactPerson(
        Number(selectedCpId),
        Number(selectedAssessment),
        reportType
      );
      setSendResult({
        type: "success",
        message: `${res.data.reportsSent} report(s) sent to ${res.data.contactPersonEmail}.${
          res.data.reportsNotAvailable > 0
            ? ` ${res.data.reportsNotAvailable} student(s) had no report.`
            : ""
        }`,
      });
    } catch (err: any) {
      const errData = err?.response?.data;
      const errMsg =
        typeof errData === "string"
          ? errData
          : errData?.message || errData?.error || err?.message || "Failed to send reports";
      setSendResult({ type: "error", message: errMsg });
    } finally {
      setSending(false);
    }
  };

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
                  onChange={(e) => {
                    setSelectedCpId(e.target.value === "" ? "" : Number(e.target.value));
                    setSendResult(null);
                  }}
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

                      {/* ─── Send Reports Section ─── */}
                      <div
                        className="mt-8 p-6"
                        style={{
                          background: "#f8fafc",
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        <h4 className="fw-bold fs-4 mb-4">Send Reports to Contact Person</h4>
                        <p className="text-muted mb-5" style={{ fontSize: "0.9rem" }}>
                          Select an assessment and report type, then send all generated report links
                          to <strong>{selectedCp?.name}</strong> ({selectedCp?.email}).
                        </p>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 16,
                            marginBottom: 20,
                            maxWidth: 600,
                          }}
                        >
                          <div>
                            <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>
                              Assessment
                            </label>
                            {assessmentsLoading ? (
                              <div className="text-muted">Loading...</div>
                            ) : (
                              <select
                                className="form-select form-select-solid"
                                value={selectedAssessment}
                                onChange={(e) => {
                                  setSelectedAssessment(
                                    e.target.value === "" ? "" : Number(e.target.value)
                                  );
                                  setSendResult(null);
                                }}
                              >
                                <option value="">-- Select assessment --</option>
                                {assessments.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.assessmentName}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          <div>
                            <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>
                              Report Type
                            </label>
                            <select
                              className="form-select form-select-solid"
                              value={reportType}
                              onChange={(e) => {
                                setReportType(e.target.value as "navigator" | "bet");
                                setSendResult(null);
                              }}
                            >
                              <option value="navigator">Navigator Report</option>
                              <option value="bet">BET Report</option>
                            </select>
                          </div>
                        </div>

                        {/* Report Status Table */}
                        {selectedAssessment !== "" && (
                          <>
                            {reportStatusLoading ? (
                              <div className="text-muted py-3">Checking report availability...</div>
                            ) : reportStatuses.length === 0 ? (
                              <div className="text-muted py-3">
                                No assigned students found for this assessment.
                              </div>
                            ) : (
                              <>
                                <div
                                  className="mb-3"
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 16,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <span
                                    style={{
                                      background: reportsAvailable > 0 ? "#dcfce7" : "#fef3c7",
                                      color: reportsAvailable > 0 ? "#059669" : "#d97706",
                                      padding: "6px 14px",
                                      borderRadius: 8,
                                      fontWeight: 600,
                                      fontSize: "0.85rem",
                                    }}
                                  >
                                    {reportsAvailable} of {reportStatuses.length} reports available
                                  </span>
                                  <button
                                    className="btn btn-sm btn-primary"
                                    disabled={reportsAvailable === 0 || sending}
                                    onClick={handleSendReports}
                                    style={{ minWidth: 180 }}
                                  >
                                    {sending
                                      ? "Sending..."
                                      : `Send ${reportsAvailable} Report(s) to ${selectedCp?.name}`}
                                  </button>
                                </div>

                                {sendResult && (
                                  <div
                                    className={`alert ${
                                      sendResult.type === "success"
                                        ? "alert-success"
                                        : "alert-danger"
                                    } py-3`}
                                    style={{ fontSize: "0.9rem" }}
                                  >
                                    {sendResult.message}
                                  </div>
                                )}

                                <div
                                  style={{
                                    overflowX: "auto",
                                    borderRadius: 8,
                                    border: "1px solid #e5e7eb",
                                  }}
                                >
                                  <table
                                    style={{
                                      width: "100%",
                                      borderCollapse: "collapse",
                                      fontSize: "0.85rem",
                                    }}
                                  >
                                    <thead>
                                      <tr style={{ background: "#f0f4ff" }}>
                                        <th
                                          style={{
                                            padding: "10px 14px",
                                            textAlign: "left",
                                            borderBottom: "2px solid #e0e0e0",
                                            width: 40,
                                          }}
                                        >
                                          #
                                        </th>
                                        <th
                                          style={{
                                            padding: "10px 14px",
                                            textAlign: "left",
                                            borderBottom: "2px solid #e0e0e0",
                                          }}
                                        >
                                          Student Name
                                        </th>
                                        <th
                                          style={{
                                            padding: "10px 14px",
                                            textAlign: "left",
                                            borderBottom: "2px solid #e0e0e0",
                                          }}
                                        >
                                          Report Status
                                        </th>
                                        <th
                                          style={{
                                            padding: "10px 14px",
                                            textAlign: "left",
                                            borderBottom: "2px solid #e0e0e0",
                                          }}
                                        >
                                          Report
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {reportStatuses.map((r, idx) => (
                                        <tr
                                          key={r.userStudentId}
                                          style={{
                                            background: idx % 2 === 0 ? "#fff" : "#f9fafb",
                                          }}
                                        >
                                          <td
                                            style={{
                                              padding: "8px 14px",
                                              borderBottom: "1px solid #f0f0f0",
                                            }}
                                          >
                                            {idx + 1}
                                          </td>
                                          <td
                                            style={{
                                              padding: "8px 14px",
                                              borderBottom: "1px solid #f0f0f0",
                                              fontWeight: 600,
                                            }}
                                          >
                                            {r.studentName}
                                          </td>
                                          <td
                                            style={{
                                              padding: "8px 14px",
                                              borderBottom: "1px solid #f0f0f0",
                                            }}
                                          >
                                            <span
                                              style={{
                                                padding: "3px 10px",
                                                borderRadius: 6,
                                                fontWeight: 600,
                                                fontSize: "0.75rem",
                                                background: r.hasReport
                                                  ? "#dcfce7"
                                                  : r.reportStatus === "notGenerated"
                                                  ? "#fee2e2"
                                                  : "#fef3c7",
                                                color: r.hasReport
                                                  ? "#059669"
                                                  : r.reportStatus === "notGenerated"
                                                  ? "#dc2626"
                                                  : "#d97706",
                                              }}
                                            >
                                              {r.hasReport
                                                ? "Generated"
                                                : r.reportStatus === "notGenerated"
                                                ? "Not Generated"
                                                : r.reportStatus}
                                            </span>
                                          </td>
                                          <td
                                            style={{
                                              padding: "8px 14px",
                                              borderBottom: "1px solid #f0f0f0",
                                            }}
                                          >
                                            {r.reportUrl ? (
                                              <a
                                                href={r.reportUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                  color: "#4361ee",
                                                  fontWeight: 500,
                                                  textDecoration: "none",
                                                }}
                                              >
                                                View Report
                                              </a>
                                            ) : (
                                              <span style={{ color: "#9ca3af" }}>-</span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
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
