import { Button, Pagination, Table } from "react-bootstrap";
import { PaymentRow } from "../../API/Tracker_APIs";

interface Props {
  rows: PaymentRow[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onOpenEntitlement: (id: number) => void;
}

const fmtINR = (paise?: number) => paise == null ? "—" : `₹${(paise / 100).toLocaleString("en-IN")}`;
const fmtDate = (s?: string) => s ? s.split(" ")[0] : "—";

const statusVariant = (s?: string) => {
  if (s === "paid") return "success";
  if (s === "failed" || s === "expired" || s === "cancelled") return "danger";
  if (s === "refunded") return "dark";
  return "secondary";
};

const PaymentsTab = ({ rows, total, page, pageSize, onPageChange, onOpenEntitlement }: Props) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
            <th>Amount</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={8} className="text-center text-muted py-4">No payments match these filters.</td></tr>
          )}
          {rows.map(r => (
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
              <td>
                {fmtINR(r.amount)}
                {r.promoCode && <><br /><small className="text-muted">promo: {r.promoCode}</small></>}
              </td>
              <td>
                <span className={`badge bg-${statusVariant(r.status)}`}>{r.status}</span>
              </td>
              <td>
                {r.entitlementId
                  ? <Button size="sm" variant="outline-primary" onClick={() => onOpenEntitlement(r.entitlementId!)}>Manage</Button>
                  : (r.shortUrl && <a href={r.shortUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-secondary">Open link</a>)
                }
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

export default PaymentsTab;
