import { Button, Pagination, Table } from "react-bootstrap";
import { AllotmentRow } from "../../API/Tracker_APIs";

interface Props {
  rows: AllotmentRow[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onOpenEntitlement: (id: number) => void;
}

const fmtDate = (s?: string) => s ? s.split(" ")[0] : "—";
const fmtINR = (paise?: number) => paise == null ? "—" : `₹${(paise / 100).toLocaleString("en-IN")}`;

const statusVariant = (s?: string) => {
  if (s === "active") return "success";
  if (s === "pending") return "secondary";
  if (s === "revoked" || s === "refunded") return "danger";
  if (s === "expired") return "warning";
  return "secondary";
};

const Chip = ({ on, label, used, total }: { on?: boolean; label: string; used?: number; total?: number }) => (
  <span className={`badge me-1 ${on ? "bg-success" : "bg-light text-muted"}`}>
    {on ? "✓" : "—"} {label}
    {on && total != null && total > 0 && <span className="ms-1">({used ?? 0}/{total})</span>}
  </span>
);

const AllotmentsTab = ({ rows, total, page, pageSize, onPageChange, onOpenEntitlement }: Props) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <Table responsive striped hover size="sm" className="align-middle">
        <thead>
          <tr>
            <th>Granted</th>
            <th>Student</th>
            <th>Campaign · Assessment</th>
            <th>Tier · Path · Model</th>
            <th>Services</th>
            <th>Paid</th>
            <th>Expires</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={9} className="text-center text-muted py-4">No allotments match these filters.</td></tr>
          )}
          {rows.map(r => (
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
              <td>
                <Chip on={r.finalReportActive} label="Report" />
                <Chip on={r.dashboardActive} label="Dash" />
                <Chip on={r.counsellingActive} label="Counsel"
                  used={r.counsellingSessionsUsed} total={r.counsellingSessionsTotal} />
                <Chip on={r.lmsActive} label="LMS" />
              </td>
              <td>{fmtINR(r.paidAmount)}</td>
              <td>{fmtDate(r.expiresAt)}</td>
              <td><span className={`badge bg-${statusVariant(r.status)}`}>{r.status}</span></td>
              <td>
                <Button size="sm" variant="outline-primary" onClick={() => onOpenEntitlement(r.entitlementId)}>Manage</Button>
              </td>
            </tr>
          ))}
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

export default AllotmentsTab;
