import React, { useEffect, useState, useMemo } from "react";
import { ReadCollegeList } from "../College/API/College_APIs";
import { getAssessmentIdNameMap } from "../StudentInformation/StudentInfo_APIs";
import {
  GetReportStatusByInstitute,
  SendReportEmail,
  SendWhatsApp,
  SendWhatsAppBulk,
} from "../ContactPerson/API/Contact_Person_APIs";

interface ReportStatusEntry {
  userStudentId: number;
  studentName: string;
  username: string | null;
  email: string | null;
  phoneNumber: string | null;
  reportStatus: string;
  reportUrl: string | null;
  hasReport: boolean;
}

interface EmailComposeData {
  recipients: { email: string; name: string }[];
  subject: string;
  body: string;
  mode: "email" | "whatsapp";
}

const SendReportsPage: React.FC = () => {
  // Institute selection
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [institutesLoading, setInstitutesLoading] = useState(false);
  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");

  // Assessment selection
  const [assessments, setAssessments] = useState<{ id: number; name: string }[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<number | "">("");

  // Report statuses
  const [reportStatuses, setReportStatuses] = useState<ReportStatusEntry[]>([]);
  const [reportStatusLoading, setReportStatusLoading] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Checkbox selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Per-row action states
  const [sendingEmail, setSendingEmail] = useState<Set<number>>(new Set());
  const [sendingWhatsApp, setSendingWhatsApp] = useState<Set<number>>(new Set());

  // Compose modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState<EmailComposeData>({
    recipients: [],
    subject: "",
    body: "",
    mode: "email",
  });
  const [composeSending, setComposeSending] = useState(false);

  // Result messages
  const [actionResult, setActionResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Load institutes and assessments on mount
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
  }, []);

  // Reset downstream when institute changes
  useEffect(() => {
    setSelectedAssessment("");
    setReportStatuses([]);
    setActionResult(null);
  }, [selectedInstitute]);

  // Clear report statuses when assessment changes
  useEffect(() => {
    setReportStatuses([]);
    setSelectedIds(new Set());
    setActionResult(null);
    setSearchQuery("");
  }, [selectedAssessment]);

  // Load report statuses when institute + assessment are selected
  useEffect(() => {
    if (selectedInstitute === "" || selectedAssessment === "") {
      setReportStatuses([]);
      return;
    }
    setReportStatusLoading(true);
    GetReportStatusByInstitute(
      Number(selectedInstitute),
      Number(selectedAssessment),
      "navigator"
    )
      .then((res) => setReportStatuses(res.data || []))
      .catch(() => setReportStatuses([]))
      .finally(() => setReportStatusLoading(false));
  }, [selectedInstitute, selectedAssessment]);

  // Filtered students based on search
  const filteredStatuses = useMemo(() => {
    if (!searchQuery.trim()) return reportStatuses;
    const q = searchQuery.toLowerCase();
    return reportStatuses.filter(
      (r) =>
        r.studentName?.toLowerCase().includes(q) ||
        r.username?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q)
    );
  }, [reportStatuses, searchQuery]);

  const reportsWithReport = filteredStatuses.filter((r) => r.hasReport);
  const selectedCount = filteredStatuses.filter(
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

  // Send email for a single student
  const handleSendEmail = async (student: ReportStatusEntry) => {
    if (!student.email || !student.reportUrl) return;
    // Open compose modal pre-filled for single student
    const assessmentName =
      assessments.find((a) => a.id === selectedAssessment)?.name || "Assessment";
    setComposeData({
      recipients: [{ email: student.email, name: student.studentName }],
      subject: `Your ${assessmentName} Report - Career-9`,
      body: buildEmailTemplate(student.studentName, student.reportUrl, assessmentName),
      mode: "email",
    });
    setComposeOpen(true);
  };

  // Send WhatsApp for a single student
  const handleSendWhatsApp = async (student: ReportStatusEntry) => {
    if (!student.phoneNumber || !student.reportUrl) return;
    setSendingWhatsApp((prev) => new Set(prev).add(student.userStudentId));
    try {
      const assessmentName =
        assessments.find((a) => a.id === selectedAssessment)?.name || "Assessment";
      await SendWhatsApp(student.phoneNumber, "report_notification", [
        student.studentName,
        assessmentName,
        student.reportUrl,
      ]);
      setActionResult({
        type: "success",
        message: `WhatsApp message sent to ${student.studentName} (${student.phoneNumber})`,
      });
    } catch (err: any) {
      setActionResult({
        type: "error",
        message: `Failed to send WhatsApp to ${student.studentName}: ${err?.response?.data?.error || err?.message || "Unknown error"}`,
      });
    } finally {
      setSendingWhatsApp((prev) => {
        const next = new Set(prev);
        next.delete(student.userStudentId);
        return next;
      });
    }
  };

  // Bulk send - opens compose modal
  const handleBulkEmail = () => {
    const selected = filteredStatuses.filter(
      (r) => r.hasReport && selectedIds.has(r.userStudentId) && r.email
    );
    if (selected.length === 0) return;
    const assessmentName =
      assessments.find((a) => a.id === selectedAssessment)?.name || "Assessment";
    setComposeData({
      recipients: selected.map((s) => ({ email: s.email!, name: s.studentName })),
      subject: `Your ${assessmentName} Report - Career-9`,
      body: buildEmailTemplate("{{student_name}}", "{{report_link}}", assessmentName),
      mode: "email",
    });
    setComposeOpen(true);
  };

  // Bulk WhatsApp
  const handleBulkWhatsApp = async () => {
    const selected = filteredStatuses.filter(
      (r) => r.hasReport && selectedIds.has(r.userStudentId) && r.phoneNumber
    );
    if (selected.length === 0) {
      setActionResult({ type: "error", message: "No selected students have phone numbers" });
      return;
    }
    const assessmentName =
      assessments.find((a) => a.id === selectedAssessment)?.name || "Assessment";
    setComposeSending(true);
    try {
      const recipients = selected.map((s) => ({
        phoneNumber: s.phoneNumber!,
        templateParams: [s.studentName, assessmentName, s.reportUrl || ""],
      }));
      const res = await SendWhatsAppBulk("report_notification", recipients);
      const d = res.data;
      setActionResult({
        type: "success",
        message: `WhatsApp: ${d.successCount} sent, ${d.failCount} failed out of ${d.totalRecipients} recipients`,
      });
    } catch (err: any) {
      setActionResult({
        type: "error",
        message: `Bulk WhatsApp failed: ${err?.response?.data?.error || err?.message || "Unknown error"}`,
      });
    } finally {
      setComposeSending(false);
    }
  };

  // Send from compose modal
  const handleComposeSend = async () => {
    if (composeData.recipients.length === 0) return;
    setComposeSending(true);
    try {
      if (composeData.mode === "email") {
        // For bulk emails, send individually with personalized content
        const selectedStudents = filteredStatuses.filter(
          (r) => r.hasReport && selectedIds.has(r.userStudentId) && r.email
        );

        if (composeData.recipients.length === 1) {
          // Single student email
          await SendReportEmail(
            [composeData.recipients[0].email],
            composeData.subject,
            composeData.body
          );
        } else {
          // Bulk: send personalized emails to each recipient
          let sentCount = 0;
          for (const student of selectedStudents) {
            const personalizedBody = composeData.body
              .replace(/\{\{student_name\}\}/g, student.studentName)
              .replace(/\{\{report_link\}\}/g, student.reportUrl || "");
            try {
              await SendReportEmail(
                [student.email!],
                composeData.subject,
                personalizedBody
              );
              sentCount++;
            } catch {
              // Continue with next
            }
          }
          setActionResult({
            type: "success",
            message: `${sentCount} email(s) sent successfully out of ${selectedStudents.length}`,
          });
          setComposeOpen(false);
          setComposeSending(false);
          return;
        }

        setActionResult({
          type: "success",
          message: `Email sent successfully to ${composeData.recipients.map((r) => r.email).join(", ")}`,
        });
      }
      setComposeOpen(false);
    } catch (err: any) {
      setActionResult({
        type: "error",
        message: `Failed to send: ${err?.response?.data || err?.message || "Unknown error"}`,
      });
    } finally {
      setComposeSending(false);
    }
  };

  const removeRecipient = (email: string) => {
    setComposeData((prev) => ({
      ...prev,
      recipients: prev.recipients.filter((r) => r.email !== email),
    }));
  };

  const addRecipient = (email: string) => {
    if (!email || composeData.recipients.find((r) => r.email === email)) return;
    setComposeData((prev) => ({
      ...prev,
      recipients: [...prev.recipients, { email, name: email }],
    }));
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontWeight: 800, fontSize: "1.5rem", color: "#1a1a2e", margin: 0 }}>
          Send Reports
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: "4px 0 0" }}>
          Select a school and assessment, then send report links to students via email or
          WhatsApp
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
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
        </div>
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
            <div style={{ color: "#9ca3af", padding: 16 }}>
              Checking report availability...
            </div>
          ) : reportStatuses.length === 0 ? (
            <div style={{ color: "#9ca3af", padding: 16 }}>
              No students found for this institute.
            </div>
          ) : (
            <>
              {/* Search + Action Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 16,
                  flexWrap: "wrap",
                }}
              >
                {/* Search */}
                <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 360 }}>
                  <input
                    type="text"
                    className="form-control form-control-solid"
                    placeholder="Search by name, username, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: 36 }}
                  />
                  <svg
                    style={{
                      position: "absolute",
                      left: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 18,
                      height: 18,
                      color: "#9ca3af",
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>

                {/* Stats badges */}
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
                  {reportsWithReport.length} of {filteredStatuses.length} reports available
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

                {/* Bulk Actions */}
                {selectedCount > 0 && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleBulkEmail}
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email ({selectedCount})
                    </button>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={handleBulkWhatsApp}
                      disabled={composeSending}
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      WhatsApp ({selectedCount})
                    </button>
                  </div>
                )}
              </div>

              {/* Result Message */}
              {actionResult && (
                <div
                  className={`alert ${actionResult.type === "success" ? "alert-success" : "alert-danger"} py-3`}
                  style={{ fontSize: "0.9rem" }}
                >
                  {actionResult.message}
                  <button
                    type="button"
                    className="btn-close"
                    style={{ float: "right" }}
                    onClick={() => setActionResult(null)}
                  />
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
                      <th style={{ padding: "10px 14px", borderBottom: "2px solid #e0e0e0", width: 50 }}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          disabled={allSelectableIds.length === 0}
                          onChange={toggleSelectAll}
                          style={{ cursor: "pointer", width: 16, height: 16 }}
                        />
                      </th>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>Student Name</th>
                      <th style={thStyle}>Username</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Preview</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStatuses.map((r, idx) => (
                      <tr
                        key={r.userStudentId}
                        style={{ background: idx % 2 === 0 ? "#fff" : "#f9fafb" }}
                      >
                        <td style={tdStyle}>
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
                        <td style={tdStyle}>{idx + 1}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{r.studentName}</td>
                        <td style={tdStyle}>
                          {r.username || <span style={{ color: "#9ca3af" }}>-</span>}
                        </td>
                        <td style={tdStyle}>
                          {r.email ? (
                            <span style={{ color: "#1e40af", fontSize: "0.8rem" }}>
                              {r.email}
                            </span>
                          ) : (
                            <span style={{ color: "#9ca3af" }}>-</span>
                          )}
                        </td>
                        <td style={tdStyle}>
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
                        <td style={tdStyle}>
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
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {r.hasReport && (
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              {/* Email button */}
                              <button
                                className="btn btn-light-primary btn-sm"
                                disabled={!r.email || sendingEmail.has(r.userStudentId)}
                                onClick={() => handleSendEmail(r)}
                                title={r.email ? `Email to ${r.email}` : "No email available"}
                                style={{
                                  padding: "4px 10px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: "0.75rem",
                                }}
                              >
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Email
                              </button>
                              {/* WhatsApp button */}
                              <button
                                className="btn btn-light-success btn-sm"
                                disabled={!r.phoneNumber || sendingWhatsApp.has(r.userStudentId)}
                                onClick={() => handleSendWhatsApp(r)}
                                title={
                                  r.phoneNumber
                                    ? `WhatsApp to ${r.phoneNumber}`
                                    : "No phone number available"
                                }
                                style={{
                                  padding: "4px 10px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: "0.75rem",
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                                {sendingWhatsApp.has(r.userStudentId)
                                  ? "Sending..."
                                  : "WhatsApp"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredStatuses.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}
                        >
                          No students match your search
                        </td>
                      </tr>
                    )}
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

      {/* Gmail Compose-Style Modal */}
      {composeOpen && (
        <ComposeModal
          data={composeData}
          setData={setComposeData}
          onClose={() => setComposeOpen(false)}
          onSend={handleComposeSend}
          sending={composeSending}
          onRemoveRecipient={removeRecipient}
          onAddRecipient={addRecipient}
        />
      )}
    </div>
  );
};

// ============ Compose Modal Component ============

interface ComposeModalProps {
  data: EmailComposeData;
  setData: React.Dispatch<React.SetStateAction<EmailComposeData>>;
  onClose: () => void;
  onSend: () => void;
  sending: boolean;
  onRemoveRecipient: (email: string) => void;
  onAddRecipient: (email: string) => void;
}

const ComposeModal: React.FC<ComposeModalProps> = ({
  data,
  setData,
  onClose,
  onSend,
  sending,
  onRemoveRecipient,
  onAddRecipient,
}) => {
  const [newRecipient, setNewRecipient] = useState("");

  const handleAddRecipient = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newRecipient.trim()) {
      e.preventDefault();
      onAddRecipient(newRecipient.trim());
      setNewRecipient("");
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.3)",
          zIndex: 1040,
        }}
      />
      {/* Modal - Gmail compose style, bottom-right */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          right: 24,
          width: 560,
          maxHeight: "80vh",
          background: "#fff",
          borderRadius: "12px 12px 0 0",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.18)",
          zIndex: 1050,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "#1a1a2e",
            color: "#fff",
            padding: "12px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderRadius: "12px 12px 0 0",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
            New Message
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: "1.2rem",
              padding: "0 4px",
            }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0" }}>
          {/* Recipients */}
          <div
            style={{
              padding: "8px 20px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{ color: "#6b7280", fontSize: "0.85rem", paddingTop: 6, minWidth: 24 }}
            >
              To
            </span>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                flex: 1,
                alignItems: "center",
              }}
            >
              {data.recipients.map((r) => (
                <span
                  key={r.email}
                  style={{
                    background: "#e0e7ff",
                    color: "#3730a3",
                    padding: "2px 8px",
                    borderRadius: 16,
                    fontSize: "0.8rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {r.name !== r.email ? `${r.name} <${r.email}>` : r.email}
                  <button
                    onClick={() => onRemoveRecipient(r.email)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#6366f1",
                      fontWeight: 700,
                      padding: 0,
                      fontSize: "0.85rem",
                      lineHeight: 1,
                    }}
                  >
                    &times;
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                onKeyDown={handleAddRecipient}
                placeholder="Add recipient..."
                style={{
                  border: "none",
                  outline: "none",
                  fontSize: "0.85rem",
                  flex: 1,
                  minWidth: 120,
                  padding: "4px 0",
                }}
              />
            </div>
          </div>

          {/* Subject */}
          <div
            style={{
              padding: "8px 20px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <input
              type="text"
              value={data.subject}
              onChange={(e) => setData((p) => ({ ...p, subject: e.target.value }))}
              placeholder="Subject"
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                fontSize: "0.9rem",
                padding: "4px 0",
              }}
            />
          </div>

          {/* Body */}
          <div style={{ padding: "12px 20px" }}>
            <textarea
              value={data.body}
              onChange={(e) => setData((p) => ({ ...p, body: e.target.value }))}
              placeholder="Write your message..."
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                fontSize: "0.9rem",
                minHeight: 250,
                resize: "vertical",
                lineHeight: 1.6,
              }}
            />
          </div>

          {/* Placeholder info */}
          {data.recipients.length > 1 && (
            <div
              style={{
                padding: "8px 20px",
                background: "#fefce8",
                borderTop: "1px solid #fde68a",
                fontSize: "0.78rem",
                color: "#92400e",
              }}
            >
              Use <code>{"{{student_name}}"}</code> and <code>{"{{report_link}}"}</code> as
              placeholders. Each student will receive a personalized email.
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            className="btn btn-primary"
            onClick={onSend}
            disabled={sending || data.recipients.length === 0}
            style={{ minWidth: 100 }}
          >
            {sending ? "Sending..." : "Send"}
          </button>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#6b7280",
            }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
};

// ============ Helpers ============

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontWeight: 600,
  color: "#1a1a2e",
  borderBottom: "2px solid #e0e0e0",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderBottom: "1px solid #f0f0f0",
};

function buildEmailTemplate(
  studentName: string,
  reportUrl: string,
  assessmentName: string
): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr>
    <td style="background:#1a1a2e;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">Career-9</h1>
    </td>
  </tr>
  <tr>
    <td style="padding:32px;">
      <p style="font-size:16px;color:#333;margin:0 0 16px;">Dear ${studentName},</p>
      <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 24px;">
        Your <strong>${assessmentName}</strong> report is ready. Click the button below to view your report.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${reportUrl}" target="_blank"
           style="background:#4361ee;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
          View Your Report
        </a>
      </div>
      <p style="font-size:13px;color:#999;margin:24px 0 0;line-height:1.5;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="${reportUrl}" style="color:#4361ee;">${reportUrl}</a>
      </p>
    </td>
  </tr>
  <tr>
    <td style="background:#f8fafc;padding:16px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Career-9 | Student Assessment & Career Guidance</p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export default SendReportsPage;
