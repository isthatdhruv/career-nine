import { useEffect, useState } from "react";
import { Button, Form, Modal, Spinner, Table } from "react-bootstrap";
import { showErrorToast, showSuccessToast } from "../../../../utils/toast";
import {
  AdminAnswersResponse,
  dismissReportError,
  extendEntitlement,
  getAllotmentDetail,
  getStudentAssessmentAnswers,
  resendEntitlementService,
  retryReportGeneration,
  revokeEntitlement,
} from "../../API/Tracker_APIs";

interface Props {
  entitlementId: number | null;
  onClose: () => void;
  onChanged: () => void;
}

const fmtDate = (s?: string) => s ? s.split(" ")[0] : "—";
const fmtINR = (rupees?: number) => rupees == null ? "—" : `₹${rupees.toLocaleString("en-IN")}`;

const EntitlementDrawer = ({ entitlementId, onClose, onChanged }: Props) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busyService, setBusyService] = useState<string | null>(null);
  const [extendDate, setExtendDate] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [busyReportLogId, setBusyReportLogId] = useState<number | null>(null);
  const [answersOpen, setAnswersOpen] = useState(false);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answers, setAnswers] = useState<AdminAnswersResponse | null>(null);

  const load = async () => {
    if (entitlementId == null) return;
    setLoading(true);
    try {
      const res = await getAllotmentDetail(entitlementId);
      setData(res.data);
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to load entitlement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [entitlementId]);

  const handleResend = async (serviceType: string) => {
    if (!entitlementId || !data) return;
    const recipient = data.studentEmail;
    if (!recipient) { showErrorToast("Student has no email on file"); return; }
    setBusyService(serviceType);
    try {
      await resendEntitlementService(entitlementId, serviceType, recipient);
      showSuccessToast(`Sent: ${serviceType}`);
      load();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to resend");
    } finally {
      setBusyService(null);
    }
  };

  const handleExtend = async () => {
    if (!entitlementId || !extendDate) return;
    try {
      await extendEntitlement(entitlementId, extendDate);
      showSuccessToast("Expiry extended");
      setExtendDate("");
      load();
      onChanged();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed");
    }
  };

  const handleRetryReport = async (logId: number) => {
    setBusyReportLogId(logId);
    try {
      const res = await retryReportGeneration(logId);
      const ok = res.data?.status === "resolved";
      if (ok) {
        showSuccessToast(
          res.data.emailed
            ? "Report regenerated and emailed"
            : `Report regenerated (${res.data.emailMessage ?? "email not sent"})`
        );
      } else {
        showSuccessToast("Retry submitted");
      }
      load();
      onChanged();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data || "Retry failed";
      showErrorToast(typeof msg === "string" ? msg : "Retry failed");
    } finally {
      setBusyReportLogId(null);
    }
  };

  const handleDismissReport = async (logId: number) => {
    const note = window.prompt("Dismiss reason (optional):") ?? undefined;
    setBusyReportLogId(logId);
    try {
      await dismissReportError(logId, note);
      showSuccessToast("Error dismissed");
      load();
      onChanged();
    } catch (e: any) {
      showErrorToast(e?.response?.data?.message ?? "Could not dismiss");
    } finally {
      setBusyReportLogId(null);
    }
  };

  const handleRevoke = async () => {
    if (!entitlementId) return;
    if (!window.confirm("Revoke this entitlement? Student will lose access immediately.")) return;
    try {
      await revokeEntitlement(entitlementId, revokeReason || "manual revocation");
      showSuccessToast("Entitlement revoked");
      load();
      onChanged();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed");
    }
  };

  const handleViewAnswers = async () => {
    if (!data?.userStudentId || !data?.assessmentId) {
      showErrorToast("Missing student / assessment IDs");
      return;
    }
    setAnswersOpen(true);
    setAnswersLoading(true);
    setAnswers(null);
    try {
      const res = await getStudentAssessmentAnswers(data.userStudentId, data.assessmentId);
      setAnswers(res.data);
    } catch (e: any) {
      showErrorToast(e?.response?.data?.error || e?.response?.data || "Failed to load answers");
      setAnswersOpen(false);
    } finally {
      setAnswersLoading(false);
    }
  };

  // Opens the assessment app's /studentAssessment/completed page for this
  // student, passing the IDs via query params so the ThankYouPage can
  // bootstrap upgrade-info + report generation without an in-progress
  // assessment session. Testing aid only.
  const handleOpenCompletedPage = () => {
    if (!data?.entitlementId || !data?.userStudentId || !data?.assessmentId) {
      showErrorToast("Missing entitlement / student / assessment IDs");
      return;
    }
    const base =
      process.env.REACT_APP_ASSESSMENT_APP_URL ||
      "https://assessment.career-9.com";
    const url =
      `${base}/studentAssessment/completed` +
      `?e=${data.entitlementId}` +
      `&userStudentId=${data.userStudentId}` +
      `&assessmentId=${data.assessmentId}`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <Modal show={entitlementId != null} onHide={onClose} size="xl" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>Entitlement #{entitlementId}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading && <Spinner animation="border" />}
        {!loading && data && (
          <>
            <div className="row mb-3">
              <div className="col-md-6">
                <h5>{data.studentName ?? "—"}</h5>
                <div className="text-muted">{data.studentEmail} {data.studentPhone ? `· ${data.studentPhone}` : ""}</div>
                <div className="mt-2">
                  <strong>{data.campaignName ?? "—"}</strong> · {data.assessmentName}
                </div>
                <div className="mt-1 text-muted small">
                  Tier: {data.tierName ?? "—"} · Path {data.purchasePath ?? "—"} · Model {data.counsellingModel ?? "—"}
                </div>
                <div className="mt-1 text-muted small">
                  Granted: {fmtDate(data.grantedAt)} · Expires: {fmtDate(data.expiresAt)}
                </div>
              </div>
              <div className="col-md-6">
                <div className="text-end">
                  <span className={`badge bg-${data.status === "active" ? "success" : "secondary"} fs-6`}>
                    {data.status}
                  </span>
                </div>
                <div className="mt-2 text-end">
                  Paid: <strong>{fmtINR(data.paidAmount)}</strong>
                  {data.payment?.razorpayPaymentId && <><br /><small className="text-muted">{data.payment.razorpayPaymentId}</small></>}
                </div>
              </div>
            </div>

            <hr />

            <h6 className="mb-3">Services</h6>
            <Table size="sm" className="align-middle">
              <thead>
                <tr><th>Service</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Assessment</td>
                  <td>{data.assessment?.status ?? "no mapping"}</td>
                  <td>
                    <div className="d-flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline-primary"
                        disabled={busyService === "assessment_invite"}
                        onClick={() => handleResend("assessment_invite")}>
                        {busyService === "assessment_invite" ? <Spinner size="sm" animation="border" /> : "Resend assessment link"}
                      </Button>
                      <Button size="sm" variant="outline-info"
                        onClick={handleOpenCompletedPage}
                        title="Opens /studentAssessment/completed for this student in a new tab — same flow as a real submission (upgrade tiers, report generation, etc.)">
                        Open completed page (test)
                      </Button>
                      <Button size="sm" variant="outline-secondary"
                        onClick={handleViewAnswers}
                        title="Shows every answer this student has submitted so far. Works for both ongoing and completed attempts.">
                        View answers
                      </Button>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>1-pager</td>
                  <td>—</td>
                  <td>
                    <Button size="sm" variant="outline-primary" disabled={busyService === "one_pager"} onClick={() => handleResend("one_pager")}>
                      {busyService === "one_pager" ? <Spinner size="sm" animation="border" /> : "Resend 1-pager"}
                    </Button>
                  </td>
                </tr>
                <tr>
                  <td>Final report</td>
                  <td>{data.finalReportActive ? <span className="badge bg-success">Active</span> : <span className="badge bg-light text-muted">Not in tier</span>}</td>
                  <td>
                    <Button size="sm" variant="outline-primary" disabled={!data.finalReportActive || busyService === "final_report"} onClick={() => handleResend("final_report")}>
                      {busyService === "final_report" ? <Spinner size="sm" animation="border" /> : "Resend final report"}
                    </Button>
                  </td>
                </tr>
                <tr>
                  <td>Dashboard</td>
                  <td>{data.dashboardActive ? <>Active · expires {fmtDate(data.dashboardExpiresAt)}</> : "—"}</td>
                  <td>
                    <Button size="sm" variant="outline-primary" disabled={!data.dashboardActive || busyService === "dashboard_access"} onClick={() => handleResend("dashboard_access")}>
                      {busyService === "dashboard_access" ? <Spinner size="sm" animation="border" /> : "Resend dashboard"}
                    </Button>
                  </td>
                </tr>
                <tr>
                  <td>Counselling</td>
                  <td>{data.counsellingActive ? <>{data.counsellingSessionsUsed ?? 0}/{data.counsellingSessionsTotal ?? 0} used</> : "—"}</td>
                  <td>
                    <Button size="sm" variant="outline-primary" disabled={!data.counsellingActive || busyService === "counselling_book"} onClick={() => handleResend("counselling_book")}>
                      {busyService === "counselling_book" ? <Spinner size="sm" animation="border" /> : "Resend booking link"}
                    </Button>
                  </td>
                </tr>
                <tr>
                  <td>LMS</td>
                  <td>{data.lmsActive ? <>Active · expires {fmtDate(data.lmsExpiresAt)}</> : "—"}</td>
                  <td>
                    <Button size="sm" variant="outline-primary" disabled={!data.lmsActive || busyService === "lms_access"} onClick={() => handleResend("lms_access")}>
                      {busyService === "lms_access" ? <Spinner size="sm" animation="border" /> : "Resend LMS link"}
                    </Button>
                  </td>
                </tr>
              </tbody>
            </Table>

            <hr />

            <h6 className="mb-3">Report generation errors</h6>
            {(data.reportErrors ?? []).length === 0 ? (
              <p className="text-muted small mb-3">No report generation issues recorded for this entitlement.</p>
            ) : (
              <Table size="sm" striped className="align-middle mb-3">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Report</th>
                    <th>Class</th>
                    <th>Attempt</th>
                    <th>Error</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(data.reportErrors ?? []).map((err: any) => {
                    const isResolved = err.status === "resolved";
                    const isBusy = busyReportLogId === err.logId;
                    return (
                      <tr key={err.logId}>
                        <td>{fmtDate(err.createdAt)}</td>
                        <td>
                          <span className={`badge bg-${err.reportType === "navigator" ? "info" : "primary"}`}>
                            {err.reportType ?? "—"}
                          </span>
                        </td>
                        <td>{err.studentClassAtAttempt ?? "—"}</td>
                        <td><span className="badge bg-secondary">{err.attemptType}</span></td>
                        <td style={{ maxWidth: 280 }}>
                          <div className="text-truncate" title={err.errorMessage ?? ""} style={{ maxWidth: 280 }}>
                            {err.errorMessage ?? "—"}
                          </div>
                          {err.errorClass && (
                            <small className="text-muted d-block text-truncate" style={{ maxWidth: 280 }}>
                              {err.errorClass}
                            </small>
                          )}
                        </td>
                        <td>
                          {isResolved ? (
                            <>
                              <span className="badge bg-success">resolved</span>
                              {err.resolvedBy && <small className="text-muted d-block">by {err.resolvedBy}</small>}
                            </>
                          ) : (
                            <span className="badge bg-danger">failed</span>
                          )}
                        </td>
                        <td>
                          {!isResolved && (
                            <div className="d-flex gap-1">
                              <Button
                                size="sm"
                                variant="outline-success"
                                disabled={isBusy}
                                onClick={() => handleRetryReport(err.logId)}
                              >
                                {isBusy ? <Spinner size="sm" animation="border" /> : "Retry"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                disabled={isBusy}
                                onClick={() => handleDismissReport(err.logId)}
                              >
                                Dismiss
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}

            <hr />

            <div className="row">
              <div className="col-md-6 mb-3">
                <h6>Extend expiry</h6>
                <div className="d-flex gap-2">
                  <Form.Control size="sm" placeholder="dd-MM-yyyy" value={extendDate} onChange={e => setExtendDate(e.target.value)} />
                  <Button size="sm" variant="primary" disabled={!extendDate} onClick={handleExtend}>Extend</Button>
                </div>
              </div>
              <div className="col-md-6 mb-3">
                <h6>Revoke entitlement</h6>
                <div className="d-flex gap-2">
                  <Form.Control size="sm" placeholder="reason (optional)" value={revokeReason} onChange={e => setRevokeReason(e.target.value)} />
                  <Button size="sm" variant="danger" onClick={handleRevoke}>Revoke</Button>
                </div>
              </div>
            </div>

            <hr />

            <h6 className="mb-3">Communications log</h6>
            <Table size="sm" striped className="align-middle">
              <thead><tr><th>When</th><th>Service</th><th>Channel</th><th>To</th><th>Status</th></tr></thead>
              <tbody>
                {(data.communications ?? []).length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted py-3">No communications yet.</td></tr>
                )}
                {(data.communications ?? []).map((c: any) => (
                  <tr key={c.id}>
                    <td>{fmtDate(c.createdAt)}</td>
                    <td>{c.serviceType}</td>
                    <td>{c.channel}</td>
                    <td>{c.recipient}</td>
                    <td><span className={`badge bg-${c.deliveryStatus === "sent" ? "success" : c.deliveryStatus === "failed" ? "danger" : "secondary"}`}>{c.deliveryStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </Modal.Footer>

      <AnswersModal
        show={answersOpen}
        loading={answersLoading}
        answers={answers}
        onHide={() => setAnswersOpen(false)}
      />
    </Modal>
  );
};

interface AnswersModalProps {
  show: boolean;
  loading: boolean;
  answers: AdminAnswersResponse | null;
  onHide: () => void;
}

const renderSelections = (q: AdminAnswersResponse["questions"][number]) => {
  if (!q.selections || q.selections.length === 0) {
    return <span className="text-muted fst-italic">— no selections recorded —</span>;
  }
  const isRanking = q.selections.some(s => s.rankOrder != null);
  const ordered = isRanking
    ? [...q.selections].sort((a, b) => (a.rankOrder ?? 0) - (b.rankOrder ?? 0))
    : q.selections;

  return (
    <ul className="list-unstyled mb-0">
      {ordered.map((s, idx) => (
        <li key={`${s.optionId ?? "txt"}-${idx}`} className="mb-1">
          {s.rankOrder != null && (
            <span className="badge bg-secondary me-2">#{s.rankOrder}</span>
          )}
          {s.optionText && <span>{s.optionText}</span>}
          {s.textResponse && (
            <div className="ms-3 small text-muted">
              <em>Text:</em> {s.textResponse}
              {s.mappedOptionText && (
                <span className="ms-2 text-success">→ mapped to "{s.mappedOptionText}"</span>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
};

const AnswersModal = ({ show, loading, answers, onHide }: AnswersModalProps) => (
  <Modal show={show} onHide={onHide} size="lg" scrollable>
    <Modal.Header closeButton>
      <Modal.Title>
        Student answers
        {answers?.studentName && <small className="text-muted ms-2">· {answers.studentName}</small>}
      </Modal.Title>
    </Modal.Header>
    <Modal.Body>
      {loading && (
        <div className="text-center py-4">
          <Spinner animation="border" />
        </div>
      )}
      {!loading && answers && (
        <>
          <div className="mb-3 small text-muted d-flex flex-wrap gap-3">
            <span><strong>Assessment:</strong> {answers.assessmentName ?? answers.assessmentId}</span>
            <span><strong>Status:</strong>{" "}
              <span className={`badge bg-${answers.status === "completed" ? "success" : answers.status === "ongoing" ? "warning" : "secondary"}`}>
                {answers.status}
              </span>
            </span>
            <span><strong>Answered:</strong> {answers.answeredQuestions} / {answers.totalQuestions}</span>
            {answers.hasRedisDraft && (
              <span>
                <strong>Redis draft:</strong>{" "}
                <span className="badge bg-info">{answers.redisAnswerCount ?? "?"} entries (in flight)</span>
              </span>
            )}
          </div>

          {answers.questions.length === 0 ? (
            <p className="text-muted">No answers persisted yet. {answers.hasRedisDraft && "Draft data exists in Redis but hasn't been flushed to the DB."}</p>
          ) : (
            <Table size="sm" striped className="align-middle">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>#</th>
                  <th>Question</th>
                  <th style={{ width: "45%" }}>Answer</th>
                </tr>
              </thead>
              <tbody>
                {answers.questions.map((q, idx) => (
                  <tr key={q.questionnaireQuestionId}>
                    <td>
                      <div>{q.orderIndex ?? idx + 1}</div>
                      {q.sectionName && (
                        <small className="text-muted d-block">{q.sectionName}</small>
                      )}
                    </td>
                    <td>
                      <div>{q.questionText ?? "—"}</div>
                      {q.questionType && (
                        <small className="text-muted">{q.questionType}</small>
                      )}
                    </td>
                    <td>{renderSelections(q)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}
    </Modal.Body>
    <Modal.Footer>
      <Button variant="secondary" onClick={onHide}>Close</Button>
    </Modal.Footer>
  </Modal>
);

export default EntitlementDrawer;
