import { useState } from "react";
import { Button, Form, Pagination, Spinner, Table } from "react-bootstrap";
import { showErrorToast, showSuccessToast } from "../../../../utils/toast";
import {
  InstituteOption,
  PaymentRow,
  assignStudentInstitute,
  resendEntitlementService,
  sendPaymentLinkEmail,
} from "../../API/Tracker_APIs";

interface Props {
  rows: PaymentRow[];
  total: number;
  page: number;
  pageSize: number;
  institutes: InstituteOption[];
  onPageChange: (p: number) => void;
  onOpenEntitlement: (id: number) => void;
  onInstituteChanged?: () => void;
}

const fmtINR = (rupees?: number) => rupees == null ? "—" : `₹${rupees.toLocaleString("en-IN")}`;
const fmtDate = (s?: string) => s ? s.split(" ")[0] : "—";

const statusVariant = (s?: string) => {
  if (s === "paid") return "success";
  if (s === "failed" || s === "expired" || s === "cancelled") return "danger";
  if (s === "refunded") return "dark";
  return "secondary";
};

const assessmentVariant = (s?: string) => {
  if (s === "completed") return "success";
  if (s === "ongoing") return "info";
  if (s === "notstarted") return "secondary";
  return "light text-muted";
};

const assessmentLabel = (s?: string) => {
  if (s === "completed") return "Completed";
  if (s === "ongoing") return "Ongoing";
  if (s === "notstarted") return "Not started";
  return "—";
};

const PaymentsTab = ({
  rows, total, page, pageSize, institutes,
  onPageChange, onOpenEntitlement, onInstituteChanged,
}: Props) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [busy, setBusy] = useState<{ id: number; type: string } | null>(null);
  const [savingInstitute, setSavingInstitute] = useState<number | null>(null);

  const changeInstitute = async (r: PaymentRow, instituteCode: number) => {
    if (!r.userStudentId) {
      showErrorToast("This transaction has no linked student yet — student is created on payment.");
      return;
    }
    if (instituteCode === r.instituteCode) return;
    setSavingInstitute(r.transactionId);
    try {
      await assignStudentInstitute(r.userStudentId, instituteCode);
      const inst = institutes.find(i => i.instituteCode === instituteCode);
      showSuccessToast(`Institute set to ${inst?.instituteName ?? instituteCode}`);
      onInstituteChanged?.();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to update institute");
    } finally {
      setSavingInstitute(null);
    }
  };

  const sendLink = async (r: PaymentRow) => {
    if (!r.studentEmail) {
      showErrorToast("No registered email on this transaction.");
      return;
    }
    setBusy({ id: r.transactionId, type: "payment_link" });
    try {
      await sendPaymentLinkEmail(r.transactionId, r.studentEmail, r.studentName);
      showSuccessToast(`Payment link sent to ${r.studentEmail}`);
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to send payment link");
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async (r: PaymentRow) => {
    const link = r.shortUrl || r.paymentLinkUrl;
    if (!link) {
      showErrorToast("No payment link available for this transaction.");
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const ta = document.createElement("textarea");
        ta.value = link;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      showSuccessToast("Payment link copied to clipboard");
    } catch {
      showErrorToast("Could not copy link to clipboard");
    }
  };

  const sendService = async (r: PaymentRow, serviceType: "assessment_invite" | "final_report") => {
    if (!r.entitlementId) {
      showErrorToast("No entitlement linked to this transaction yet.");
      return;
    }
    if (!r.studentEmail) {
      showErrorToast("Student email is missing.");
      return;
    }
    setBusy({ id: r.transactionId, type: serviceType });
    try {
      await resendEntitlementService(r.entitlementId, serviceType, r.studentEmail);
      showSuccessToast(serviceType === "assessment_invite"
        ? `Assessment reminder sent to ${r.studentEmail}`
        : `Report sent to ${r.studentEmail}`);
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to send email");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Table responsive striped hover size="sm" className="align-middle">
        <thead>
          <tr>
            <th>Txn</th>
            <th>Created</th>
            <th>Student</th>
            <th>Campaign · Assessment</th>
            <th>Tier · Path</th>
            <th>Institute</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Assessment</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={10} className="text-center text-muted py-4">No payments match these filters.</td></tr>
          )}
          {rows.map(r => {
            const completed = r.assessmentStatus === "completed";
            const canRemind = r.entitlementId != null && r.status === "paid" && !completed;
            const canSendReport = r.entitlementId != null && r.finalReportActive === true && completed;
            const hasLink = !!(r.shortUrl || r.paymentLinkUrl);
            const canSendLink = r.status === "created" && !!r.studentEmail;
            const remindBusy = busy?.id === r.transactionId && busy.type === "assessment_invite";
            const reportBusy = busy?.id === r.transactionId && busy.type === "final_report";
            const linkBusy = busy?.id === r.transactionId && busy.type === "payment_link";
            return (
              <tr key={r.transactionId}>
                <td><code>#{r.transactionId}</code></td>
                <td>{fmtDate(r.createdAt)}</td>
                <td>
                  <strong>{r.studentName ?? "—"}</strong>
                  <br />
                  <small className="text-muted">{r.studentEmail ?? ""} {r.studentPhone ? `· ${r.studentPhone}` : ""}</small>
                </td>
                <td>
                  {r.campaignName ?? <em className="text-muted">no campaign</em>}
                  <br />
                  <small className="text-muted">{r.assessmentName}</small>
                </td>
                <td>
                  {r.tierName ?? <em className="text-muted">—</em>}
                  {r.purchasePath && <><br /><small>Path {r.purchasePath}</small></>}
                </td>
                <td style={{ minWidth: 180 }}>
                  {r.userStudentId ? (
                    <Form.Select
                      size="sm"
                      value={r.instituteCode ?? ""}
                      disabled={savingInstitute === r.transactionId}
                      onChange={(e) => changeInstitute(r, Number(e.target.value))}
                    >
                      <option value="" disabled>{r.instituteName ?? "— select —"}</option>
                      {institutes.map(i => (
                        <option key={i.instituteCode} value={i.instituteCode}>{i.instituteName}</option>
                      ))}
                    </Form.Select>
                  ) : (
                    <em className="text-muted small">no student yet</em>
                  )}
                </td>
                <td>
                  {fmtINR(r.amount)}
                  {r.promoCode && <><br /><small className="text-muted">promo: {r.promoCode}</small></>}
                </td>
                <td>
                  <span className={`badge bg-${statusVariant(r.status)}`}>{r.status}</span>
                  {r.lastReportError && (
                    <span
                      className="badge bg-danger ms-1"
                      title={r.lastReportError.message}
                    >
                      ⚠ Report error
                    </span>
                  )}
                </td>
                <td>
                  <span className={`badge bg-${assessmentVariant(r.assessmentStatus)}`}>
                    {assessmentLabel(r.assessmentStatus)}
                  </span>
                </td>
                <td>
                  <div className="d-flex flex-wrap gap-1">
                    {canRemind && (
                      <Button size="sm" variant="outline-warning" disabled={remindBusy}
                        onClick={() => sendService(r, "assessment_invite")}>
                        {remindBusy ? <Spinner animation="border" size="sm" /> : "Remind"}
                      </Button>
                    )}
                    {canSendReport && (
                      <Button size="sm" variant="outline-success" disabled={reportBusy}
                        onClick={() => sendService(r, "final_report")}>
                        {reportBusy ? <Spinner animation="border" size="sm" /> : "Send report"}
                      </Button>
                    )}
                    {canSendLink && (
                      <Button size="sm" variant="outline-info" disabled={linkBusy}
                        title={`Send payment link to ${r.studentEmail}`}
                        onClick={() => sendLink(r)}>
                        {linkBusy ? <Spinner animation="border" size="sm" /> : "Send link"}
                      </Button>
                    )}
                    {hasLink && (
                      <Button size="sm" variant="outline-secondary"
                        title="Copy payment link to clipboard"
                        onClick={() => copyLink(r)}>
                        Copy
                      </Button>
                    )}
                    {r.entitlementId
                      ? <Button size="sm" variant="outline-primary" onClick={() => onOpenEntitlement(r.entitlementId!)}>Manage</Button>
                      : (r.shortUrl && <a href={r.shortUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-secondary">Open link</a>)
                    }
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <div className="d-flex justify-content-between align-items-center">
        <small className="text-muted">{total} total · page {page + 1} of {totalPages}</small>
        <Pagination size="sm" className="mb-0">
          <Pagination.First disabled={page === 0} onClick={() => onPageChange(0)} />
          <Pagination.Prev disabled={page === 0} onClick={() => onPageChange(page - 1)} />
          <Pagination.Next disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)} />
          <Pagination.Last disabled={page >= totalPages - 1} onClick={() => onPageChange(totalPages - 1)} />
        </Pagination>
      </div>
    </>
  );
};

export default PaymentsTab;
