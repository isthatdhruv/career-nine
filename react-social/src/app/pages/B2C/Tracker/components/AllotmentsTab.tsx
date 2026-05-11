import { useState } from "react";
import { Button, Form, Pagination, Spinner, Table } from "react-bootstrap";
import { showErrorToast, showSuccessToast } from "../../../../utils/toast";
import {
  AllotmentRow,
  InstituteOption,
  assignStudentInstitute,
  resendEntitlementService,
} from "../../API/Tracker_APIs";

interface Props {
  rows: AllotmentRow[];
  total: number;
  page: number;
  pageSize: number;
  institutes: InstituteOption[];
  onPageChange: (p: number) => void;
  onOpenEntitlement: (id: number) => void;
  onInstituteChanged?: () => void;
}

const fmtDate = (s?: string) => s ? s.split(" ")[0] : "—";
const fmtINR = (rupees?: number) => rupees == null ? "—" : `₹${rupees.toLocaleString("en-IN")}`;

const statusVariant = (s?: string) => {
  if (s === "active") return "success";
  if (s === "pending") return "secondary";
  if (s === "revoked" || s === "refunded") return "danger";
  if (s === "expired") return "warning";
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

const Chip = ({ on, label, used, total }: { on?: boolean; label: string; used?: number; total?: number }) => (
  <span className={`badge me-1 ${on ? "bg-success" : "bg-light text-muted"}`}>
    {on ? "✓" : "—"} {label}
    {on && total != null && total > 0 && <span className="ms-1">({used ?? 0}/{total})</span>}
  </span>
);

const AllotmentsTab = ({
  rows, total, page, pageSize, institutes,
  onPageChange, onOpenEntitlement, onInstituteChanged,
}: Props) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [busy, setBusy] = useState<{ id: number; type: string } | null>(null);
  const [savingInstitute, setSavingInstitute] = useState<number | null>(null);

  const changeInstitute = async (r: AllotmentRow, instituteCode: number) => {
    if (!r.userStudentId) {
      showErrorToast("This allotment has no linked student.");
      return;
    }
    if (instituteCode === r.instituteCode) return;
    setSavingInstitute(r.entitlementId);
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

  const sendService = async (r: AllotmentRow, serviceType: "assessment_invite" | "final_report") => {
    if (!r.studentEmail) {
      showErrorToast("Student email is missing.");
      return;
    }
    setBusy({ id: r.entitlementId, type: serviceType });
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
      <Table responsive striped hover size="sm" className="align-middle" style={{ minWidth: 1200 }}>
        <thead>
          <tr>
            <th style={{ whiteSpace: "nowrap" }}>Granted</th>
            <th style={{ minWidth: 180 }}>Student</th>
            <th style={{ minWidth: 180 }}>Campaign · Assessment</th>
            <th style={{ minWidth: 160 }}>Tier · Path · Model</th>
            <th>Institute</th>
            <th style={{ minWidth: 220 }}>Services</th>
            <th style={{ whiteSpace: "nowrap" }}>Paid</th>
            <th style={{ whiteSpace: "nowrap" }}>Expires</th>
            <th style={{ whiteSpace: "nowrap" }}>Status</th>
            <th style={{ whiteSpace: "nowrap" }}>Assessment</th>
            <th style={{ minWidth: 160 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={11} className="text-center text-muted py-4">No allotments match these filters.</td></tr>
          )}
          {rows.map(r => {
            const completed = r.assessmentStatus === "completed";
            const canRemind = r.status === "active" && !completed;
            const canSendReport = r.finalReportActive === true && completed && r.status === "active";
            const remindBusy = busy?.id === r.entitlementId && busy.type === "assessment_invite";
            const reportBusy = busy?.id === r.entitlementId && busy.type === "final_report";
            return (
              <tr key={r.entitlementId}>
                <td>{fmtDate(r.grantedAt) ?? fmtDate(r.createdAt)}</td>
                <td>
                  <strong>{r.studentName ?? "—"}</strong>
                  <br />
                  <small className="text-muted">{r.studentEmail ?? ""}</small>
                </td>
                <td>
                  {r.campaignName ?? <em className="text-muted">—</em>}
                  <br />
                  <small className="text-muted">{r.assessmentName}</small>
                </td>
                <td>
                  {r.tierName ?? <em className="text-muted">—</em>}
                  <br />
                  <small>Path {r.purchasePath ?? "—"} · Model {r.counsellingModel ?? "—"}</small>
                </td>
                <td style={{ minWidth: 180 }}>
                  {r.userStudentId ? (
                    <Form.Select
                      size="sm"
                      value={r.instituteCode ?? ""}
                      disabled={savingInstitute === r.entitlementId}
                      onChange={(e) => changeInstitute(r, Number(e.target.value))}
                    >
                      <option value="" disabled>{r.instituteName ?? "— select —"}</option>
                      {institutes.map(i => (
                        <option key={i.instituteCode} value={i.instituteCode}>{i.instituteName}</option>
                      ))}
                    </Form.Select>
                  ) : (
                    <em className="text-muted small">—</em>
                  )}
                </td>
                <td>
                  <Chip on={r.finalReportActive} label="Report" />
                  <Chip on={r.dashboardActive} label="Dash" />
                  <Chip on={r.counsellingActive} label="Counsel"
                    used={r.counsellingSessionsUsed} total={r.counsellingSessionsTotal} />
                  <Chip on={r.lmsActive} label="LMS" />
                </td>
                <td>{fmtINR(r.paidAmount)}</td>
                <td>{fmtDate(r.expiresAt)}</td>
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
                    <Button size="sm" variant="outline-primary" onClick={() => onOpenEntitlement(r.entitlementId)}>Manage</Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <small className="text-muted">{total} total · page {page + 1} of {totalPages}</small>
        <Pagination size="sm" className="mb-0 flex-wrap">
          <Pagination.First disabled={page === 0} onClick={() => onPageChange(0)} />
          <Pagination.Prev disabled={page === 0} onClick={() => onPageChange(page - 1)} />
          <Pagination.Next disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)} />
          <Pagination.Last disabled={page >= totalPages - 1} onClick={() => onPageChange(totalPages - 1)} />
        </Pagination>
      </div>
    </>
  );
};

export default AllotmentsTab;
