import React, { useEffect, useState } from "react";
import { ReadCollegeList } from "../College/API/College_APIs";
import { getAssessmentIdNameMap } from "../StudentInformation/StudentInfo_APIs";
import {
  ReadContactInformationData,
  GetReportStatusByInstitute,
  SendReportsByInstitute,
} from "../ContactPerson/API/Contact_Person_APIs";

interface ContactPerson {
  id: number;
  name: string;
  email?: string;
  designation?: string;
}

interface ReportStatusEntry {
  userStudentId: number;
  studentName: string;
  reportStatus: string;
  reportUrl: string | null;
  hasReport: boolean;
}

const SendReportsPage: React.FC = () => {
  // Institute selection
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [institutesLoading, setInstitutesLoading] = useState(false);
  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");

  // Assessment selection (id -> name map)
  const [assessments, setAssessments] = useState<{ id: number; name: string }[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<number | "">("");

  // Report type
  const [reportType, setReportType] = useState<"navigator" | "bet">("navigator");

  // Contact person selection
  const [contactPersons, setContactPersons] = useState<ContactPerson[]>([]);
  const [cpLoading, setCpLoading] = useState(false);
  const [selectedCpId, setSelectedCpId] = useState<number | "">("");

  // Report statuses
  const [reportStatuses, setReportStatuses] = useState<ReportStatusEntry[]>([]);
  const [reportStatusLoading, setReportStatusLoading] = useState(false);

  // Checkbox selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Send action
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Load institutes, assessments, and contact persons on mount
  useEffect(() => {
    setInstitutesLoading(true);
    ReadCollegeList()
      .then((res) => setInstitutes(res.data || []))
      .catch(() => setInstitutes([]))
      .finally(() => setInstitutesLoading(false));

    setAssessmentsLoading(true);
    getAssessmentIdNameMap()
      .then((res) => {
        const map = res.data || {};
        const list = Object.entries(map).map(([id, name]) => ({
          id: Number(id),
          name: String(name),
        }));
        setAssessments(list);
      })
      .catch(() => setAssessments([]))
      .finally(() => setAssessmentsLoading(false));

    setCpLoading(true);
    ReadContactInformationData()
      .then((res) => setContactPersons(res.data || []))
      .catch(() => setContactPersons([]))
      .finally(() => setCpLoading(false));
  }, []);

  // Reset downstream when institute changes
  useEffect(() => {
    setSelectedAssessment("");
    setReportStatuses([]);
    setSendResult(null);
  }, [selectedInstitute]);

  // Clear report statuses and send result when assessment or report type changes
  useEffect(() => {
    setReportStatuses([]);
    setSelectedIds(new Set());
    setSendResult(null);
  }, [selectedAssessment, reportType]);

  // Load report statuses when institute + assessment + report type are all selected
  useEffect(() => {
    if (selectedInstitute === "" || selectedAssessment === "") {
      setReportStatuses([]);
      return;
    }
    setReportStatusLoading(true);
    GetReportStatusByInstitute(
      Number(selectedInstitute),
      Number(selectedAssessment),
      reportType
    )
      .then((res) => setReportStatuses(res.data || []))
      .catch(() => setReportStatuses([]))
      .finally(() => setReportStatusLoading(false));
  }, [selectedInstitute, selectedAssessment, reportType]);

  const selectedCp = contactPersons.find((cp) => cp.id === selectedCpId);
  const reportsWithReport = reportStatuses.filter((r) => r.hasReport);
  const selectedCount = reportStatuses.filter(
    (r) => r.hasReport && selectedIds.has(r.userStudentId)
  ).length;
  const allSelectableIds = reportsWithReport.map((r) => r.userStudentId);
  const allSelected =
    allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedIds.has(id));
  const reportsReady = selectedInstitute !== "" && selectedAssessment !== "";

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allSelectableIds));
    }
  };

  const handleSendReports = async () => {
    if (selectedCpId === "" || selectedInstitute === "" || selectedAssessment === "" || selectedCount === 0) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await SendReportsByInstitute(
        Number(selectedCpId),
        Number(selectedInstitute),
        Number(selectedAssessment),
        reportType,
        Array.from(selectedIds)
      );
      const d = res.data;
      let msg = `ZIP with ${d.reportsSent} report(s) sent to ${d.contactPersonEmail}.`;
      if (d.reportsNotAvailable > 0) {
        msg += ` ${d.reportsNotAvailable} student(s) had no report.`;
      }
      if (d.downloadFailed > 0) {
        msg += ` ${d.downloadFailed} report(s) could not be downloaded.`;
      }
      setSendResult({ type: "success", message: msg });
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
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontWeight: 800, fontSize: "1.5rem", color: "#1a1a2e", margin: 0 }}>
          Send Reports to Contact Person
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: "4px 0 0" }}>
          Select a school, assessment, and report type to view student reports, then choose a
          contact person to send them to
        </p>
      </div>

      {/* Selection Card */}
      <div
        style={{
          background: "#fff",
          padding: 24,
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginBottom: 20,
          }}
        >
          {/* Institute */}
          <div>
            <label
              style={{
                fontWeight: 600,
                fontSize: "0.85rem",
                color: "#374151",
                marginBottom: 6,
                display: "block",
              }}
            >
              School / Institute
            </label>
            {institutesLoading ? (
              <div style={{ color: "#9ca3af", padding: "8px 0" }}>Loading...</div>
            ) : (
              <select
                className="form-select form-select-solid"
                value={selectedInstitute}
                onChange={(e) =>
                  setSelectedInstitute(e.target.value === "" ? "" : Number(e.target.value))
                }
              >
                <option value="">-- Select a school --</option>
                {institutes.map((inst: any) => (
                  <option key={inst.instituteCode} value={inst.instituteCode}>
                    {inst.instituteName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Assessment */}
          <div>
            <label
              style={{
                fontWeight: 600,
                fontSize: "0.85rem",
                color: "#374151",
                marginBottom: 6,
                display: "block",
              }}
            >
              Assessment
            </label>
            {assessmentsLoading ? (
              <div style={{ color: "#9ca3af", padding: "8px 0" }}>Loading...</div>
            ) : (
              <select
                className="form-select form-select-solid"
                value={selectedAssessment}
                onChange={(e) =>
                  setSelectedAssessment(e.target.value === "" ? "" : Number(e.target.value))
                }
                disabled={selectedInstitute === ""}
              >
                <option value="">-- Select an assessment --</option>
                {assessments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Report Type */}
          <div>
            <label
              style={{
                fontWeight: 600,
                fontSize: "0.85rem",
                color: "#374151",
                marginBottom: 6,
                display: "block",
              }}
            >
              Report Type
            </label>
            <select
              className="form-select form-select-solid"
              value={reportType}
              onChange={(e) => setReportType(e.target.value as "navigator" | "bet")}
              disabled={selectedInstitute === ""}
            >
              <option value="navigator">Navigator Report</option>
              <option value="bet">BET Report</option>
            </select>
          </div>

          {/* Contact Person */}
          <div>
            <label
              style={{
                fontWeight: 600,
                fontSize: "0.85rem",
                color: "#374151",
                marginBottom: 6,
                display: "block",
              }}
            >
              Send To (Contact Person)
            </label>
            {cpLoading ? (
              <div style={{ color: "#9ca3af", padding: "8px 0" }}>Loading...</div>
            ) : contactPersons.length === 0 ? (
              <div style={{ color: "#d97706", padding: "8px 0", fontSize: "0.85rem" }}>
                No contact persons found. Add one from "Add Contact Person Information".
              </div>
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
                    {cp.email ? ` - ${cp.email}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Contact Person Info Badge */}
        {selectedCp && (
          <div
            style={{
              padding: "12px 20px",
              background: "#f0f4ff",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontWeight: 700, color: "#4361ee" }}>{selectedCp.name}</span>
            {selectedCp.designation && (
              <>
                <span style={{ color: "#cbd5e1" }}>|</span>
                <span style={{ color: "#6b7280" }}>{selectedCp.designation}</span>
              </>
            )}
            {selectedCp.email && (
              <>
                <span style={{ color: "#cbd5e1" }}>|</span>
                <span style={{ color: "#1e293b", fontWeight: 500 }}>{selectedCp.email}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Report Status & Send Section */}
      {reportsReady && (
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            padding: 24,
          }}
        >
          {reportStatusLoading ? (
            <div style={{ color: "#9ca3af", padding: 16 }}>Checking report availability...</div>
          ) : reportStatuses.length === 0 ? (
            <div style={{ color: "#9ca3af", padding: 16 }}>
              No students found for this institute.
            </div>
          ) : (
            <>
              {/* Action Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginBottom: 16,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    background: reportsWithReport.length > 0 ? "#dcfce7" : "#fef3c7",
                    color: reportsWithReport.length > 0 ? "#059669" : "#d97706",
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: "0.85rem",
                  }}
                >
                  {reportsWithReport.length} of {reportStatuses.length} reports available
                </span>
                {selectedCount > 0 && (
                  <span
                    style={{
                      background: "#e0e7ff",
                      color: "#4338ca",
                      padding: "6px 14px",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: "0.85rem",
                    }}
                  >
                    {selectedCount} selected
                  </span>
                )}
                <button
                  className="btn btn-primary"
                  disabled={
                    selectedCount === 0 || selectedCpId === "" || sending
                  }
                  onClick={handleSendReports}
                  style={{ minWidth: 220 }}
                >
                  {sending
                    ? "Downloading & Sending..."
                    : selectedCpId === ""
                    ? "Select a contact person to send"
                    : selectedCount === 0
                    ? "Select reports to send"
                    : `Send ${selectedCount} Report(s) as ZIP to ${selectedCp?.name}`}
                </button>
              </div>

              {/* Send Result */}
              {sendResult && (
                <div
                  className={`alert ${
                    sendResult.type === "success" ? "alert-success" : "alert-danger"
                  } py-3`}
                  style={{ fontSize: "0.9rem" }}
                >
                  {sendResult.message}
                </div>
              )}

              {/* Report Status Table */}
              <div
                style={{
                  overflowX: "auto",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              >
                <table
                  style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}
                >
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th
                        style={{
                          padding: "10px 14px",
                          borderBottom: "2px solid #e0e0e0",
                          width: 120,
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: allSelectableIds.length === 0 ? "not-allowed" : "pointer",
                            margin: 0,
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            color: "#1a1a2e",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={allSelected}
                            disabled={allSelectableIds.length === 0}
                            onChange={toggleSelectAll}
                            style={{ cursor: "pointer", width: 16, height: 16 }}
                          />
                          Select All
                        </label>
                      </th>
                      <th
                        style={{
                          padding: "10px 14px",
                          textAlign: "left",
                          fontWeight: 600,
                          color: "#1a1a2e",
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
                          fontWeight: 600,
                          color: "#1a1a2e",
                          borderBottom: "2px solid #e0e0e0",
                        }}
                      >
                        Student Name
                      </th>
                      <th
                        style={{
                          padding: "10px 14px",
                          textAlign: "left",
                          fontWeight: 600,
                          color: "#1a1a2e",
                          borderBottom: "2px solid #e0e0e0",
                        }}
                      >
                        Report Status
                      </th>
                      <th
                        style={{
                          padding: "10px 14px",
                          textAlign: "left",
                          fontWeight: 600,
                          color: "#1a1a2e",
                          borderBottom: "2px solid #e0e0e0",
                        }}
                      >
                        Preview
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportStatuses.map((r, idx) => (
                      <tr
                        key={r.userStudentId}
                        style={{ background: idx % 2 === 0 ? "#fff" : "#f9fafb" }}
                      >
                        <td
                          style={{
                            padding: "8px 14px",
                            borderBottom: "1px solid #f0f0f0",
                            textAlign: "center",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(r.userStudentId)}
                            disabled={!r.hasReport}
                            onChange={() => toggleSelect(r.userStudentId)}
                            style={{
                              cursor: r.hasReport ? "pointer" : "not-allowed",
                              width: 16,
                              height: 16,
                            }}
                          />
                        </td>
                        <td
                          style={{ padding: "8px 14px", borderBottom: "1px solid #f0f0f0" }}
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
                          style={{ padding: "8px 14px", borderBottom: "1px solid #f0f0f0" }}
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
                          style={{ padding: "8px 14px", borderBottom: "1px solid #f0f0f0" }}
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
                              View
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
        </div>
      )}

      {/* Empty State */}
      {!reportsReady && (
        <div
          style={{
            padding: 48,
            textAlign: "center",
            color: "#9ca3af",
            border: "2px dashed #e5e7eb",
            borderRadius: 12,
            background: "#fff",
          }}
        >
          <div>Select a school and assessment to view student reports</div>
        </div>
      )}
    </div>
  );
};

export default SendReportsPage;
