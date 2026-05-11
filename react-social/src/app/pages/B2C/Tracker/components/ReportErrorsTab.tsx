import { useState } from "react";
import { Button, Form, Pagination, Spinner, Table } from "react-bootstrap";
import { showErrorToast, showSuccessToast } from "../../../../utils/toast";
import {
  ReportErrorRow,
  dismissReportError,
  retryReportGeneration,
} from "../../API/Tracker_APIs";

interface Props {
  rows: ReportErrorRow[];
  total: number;
  page: number;
  pageSize: number;
  statusFilter: "failed" | "resolved" | "all";
  onStatusFilterChange: (s: "failed" | "resolved" | "all") => void;
  onPageChange: (p: number) => void;
  onOpenEntitlement: (id: number) => void;
  onChanged: () => void;
}

const fmtDate = (s?: string) => (s ? s.split(" ").slice(0, 2).join(" ") : "—");

const reportTypeBadge = (rt?: string) => {
  if (rt === "navigator") return <span className="badge bg-info">Navigator</span>;
  if (rt === "bet") return <span className="badge bg-primary">BET</span>;
  return <span className="badge bg-secondary">{rt ?? "—"}</span>;
};

const ReportErrorsTab = ({
  rows, total, page, pageSize,
  statusFilter, onStatusFilterChange,
  onPageChange, onOpenEntitlement, onChanged,
}: Props) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [busy, setBusy] = useState<{ id: number; type: "retry" | "dismiss" } | null>(null);
  const [dismissNote, setDismissNote] = useState<string>("");
  const [dismissingId, setDismissingId] = useState<number | null>(null);

  const onRetry = async (r: ReportErrorRow) => {
    if (r.status !== "failed") return;
    setBusy({ id: r.logId, type: "retry" });
    try {
      const res = await retryReportGeneration(r.logId);
      if (res.data?.status === "resolved") {
        showSuccessToast(
          res.data.emailed
            ? `Report regenerated and emailed`
            : `Report regenerated (${res.data.emailMessage ?? "email not sent"})`
        );
      } else {
        showSuccessToast("Retry submitted");
      }
      onChanged();
    } catch (e: any) {
      const msg = e?.response?.data?.message
        || e?.response?.data
        || "Retry failed";
      showErrorToast(typeof msg === "string" ? msg : "Retry failed");
    } finally {
      setBusy(null);
    }
  };

  const onDismiss = async (r: ReportErrorRow) => {
    if (r.status !== "failed") return;
    setBusy({ id: r.logId, type: "dismiss" });
    try {
      await dismissReportError(r.logId, dismissNote || undefined);
      showSuccessToast("Error dismissed");
      setDismissingId(null);
      setDismissNote("");
      onChanged();
    } catch (e: any) {
      showErrorToast(e?.response?.data?.message ?? "Could not dismiss");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="d-flex align-items-center mb-3 gap-2">
        <Form.Label className="small fw-bold mb-0 me-2">Filter</Form.Label>
        <Form.Select
          size="sm"
          style={{ maxWidth: 160 }}
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as "failed" | "resolved" | "all")}
        >
          <option value="failed">Failed only</option>
          <option value="resolved">Resolved only</option>
          <option value="all">All</option>
        </Form.Select>
        <span className="text-muted small ms-2">{total} record{total === 1 ? "" : "s"}</span>
      </div>

      <Table responsive hover size="sm" className="align-middle">
        <thead>
          <tr>
            <th>When</th>
            <th>Student</th>
            <th>Campaign · Assessment</th>
            <th>Report</th>
            <th>Class</th>
            <th>Attempt</th>
            <th>Error</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center text-muted py-4">
                No report errors match the current filter.
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const isResolved = r.status === "resolved";
            const isBusyRetry = busy?.id === r.logId && busy.type === "retry";
            const isBusyDismiss = busy?.id === r.logId && busy.type === "dismiss";
            const showDismissInput = dismissingId === r.logId;
            return (
              <tr key={r.logId}>
                <td>
                  <div>{fmtDate(r.createdAt)}</div>
                  <small className="text-muted">#{r.logId}</small>
                </td>
                <td>
                  <div>{r.studentName ?? "—"}</div>
                  <small className="text-muted">{r.studentEmail ?? "—"}</small>
                </td>
                <td>
                  <div>{r.campaignName ?? "—"}</div>
                  <small className="text-muted">{r.assessmentName ?? "—"}</small>
                </td>
                <td>{reportTypeBadge(r.reportType)}</td>
                <td>
                  {r.studentClassAtAttempt != null
                    ? <span className="badge bg-light text-dark">{r.studentClassAtAttempt}</span>
                    : <span className="text-muted">—</span>}
                </td>
                <td>
                  <span className="badge bg-secondary">{r.attemptType}</span>
                </td>
                <td style={{ maxWidth: 320 }}>
                  <div
                    className="text-truncate"
                    title={r.errorMessage ?? ""}
                    style={{ maxWidth: 320 }}
                  >
                    {r.errorMessage ?? "—"}
                  </div>
                  {r.errorClass && (
                    <small className="text-muted d-block text-truncate" style={{ maxWidth: 320 }}>
                      {r.errorClass}
                    </small>
                  )}
                </td>
                <td>
                  {isResolved ? (
                    <>
                      <span className="badge bg-success">resolved</span>
                      {r.resolvedBy && (
                        <small className="text-muted d-block">by {r.resolvedBy}</small>
                      )}
                      {r.resolutionNote && (
                        <small className="text-muted d-block fst-italic">"{r.resolutionNote}"</small>
                      )}
                    </>
                  ) : (
                    <span className="badge bg-danger">failed</span>
                  )}
                </td>
                <td>
                  <div className="d-flex flex-column gap-1" style={{ minWidth: 120 }}>
                    {!isResolved && (
                      <Button
                        size="sm"
                        variant="outline-success"
                        disabled={isBusyRetry || isBusyDismiss}
                        onClick={() => onRetry(r)}
                      >
                        {isBusyRetry ? <Spinner animation="border" size="sm" /> : "Retry"}
                      </Button>
                    )}
                    {!isResolved && !showDismissInput && (
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        disabled={isBusyRetry || isBusyDismiss}
                        onClick={() => setDismissingId(r.logId)}
                      >
                        Dismiss
                      </Button>
                    )}
                    {!isResolved && showDismissInput && (
                      <>
                        <Form.Control
                          size="sm"
                          placeholder="reason (optional)"
                          value={dismissNote}
                          onChange={(e) => setDismissNote(e.target.value)}
                        />
                        <div className="d-flex gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={isBusyDismiss}
                            onClick={() => onDismiss(r)}
                          >
                            {isBusyDismiss ? <Spinner animation="border" size="sm" /> : "Confirm"}
                          </Button>
                          <Button
                            size="sm"
                            variant="link"
                            onClick={() => { setDismissingId(null); setDismissNote(""); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() => onOpenEntitlement(r.entitlementId)}
                    >
                      Open entitlement
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {totalPages > 1 && (
        <Pagination className="justify-content-center mb-0">
          <Pagination.First disabled={page === 0} onClick={() => onPageChange(0)} />
          <Pagination.Prev disabled={page === 0} onClick={() => onPageChange(Math.max(0, page - 1))} />
          <Pagination.Item active>{page + 1} / {totalPages}</Pagination.Item>
          <Pagination.Next disabled={page + 1 >= totalPages} onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))} />
          <Pagination.Last disabled={page + 1 >= totalPages} onClick={() => onPageChange(totalPages - 1)} />
        </Pagination>
      )}
    </div>
  );
};

export default ReportErrorsTab;
