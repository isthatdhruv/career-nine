import { useEffect, useState } from "react";
import { getReminderLog, searchReminderLogs } from "../API/Reminder_APIs";
import {
  ALL_SERVICE_TYPES,
  ReminderDeliveryStatus,
  ReminderLogDetail,
  ReminderLogRow,
  ReminderServiceType,
  SERVICE_TYPE_LABEL,
} from "../types";

const STATUSES: ReminderDeliveryStatus[] = ["SENT", "FAILED", "SUPPRESSED", "CAPPED", "DRY_RUN"];

const STATUS_VARIANT: Record<ReminderDeliveryStatus, string> = {
  SENT: "success",
  FAILED: "danger",
  SUPPRESSED: "secondary",
  CAPPED: "warning",
  DRY_RUN: "info",
};

const LogsSection = () => {
  const [serviceType, setServiceType] = useState<ReminderServiceType | "">("");
  const [status, setStatus] = useState<ReminderDeliveryStatus | "">("");
  const [recipient, setRecipient] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [size] = useState(25);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReminderLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [detail, setDetail] = useState<ReminderLogDetail | null>(null);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await searchReminderLogs({
        serviceType: serviceType || undefined,
        status: status || undefined,
        recipient: recipient || undefined,
        from: from || undefined,
        to: to || undefined,
        page: p,
        size,
      });
      setRows(res.data.rows);
      setTotal(res.data.totalElements);
      setTotalPages(res.data.totalPages);
      setPage(res.data.page);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (id: number) => {
    try {
      const res = await getReminderLog(id);
      setDetail(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const exportCsv = () => {
    const headers = ["createdAt", "sentAt", "serviceType", "recipient", "subject", "status", "trigger", "reason"];
    const lines = [headers.join(",")];
    rows.forEach((r) => {
      lines.push(
        [
          r.createdAt,
          r.sentAt || "",
          r.serviceType,
          r.recipient || "",
          (r.subject || "").replace(/"/g, '""'),
          r.deliveryStatus,
          r.triggeredBy,
          (r.failureReason || "").replace(/"/g, '""'),
        ]
          .map((v) => `"${v}"`)
          .join(",")
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reminder-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-3">
              <label className="form-label small">Service</label>
              <select
                className="form-select"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as ReminderServiceType | "")}
              >
                <option value="">All services</option>
                {ALL_SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SERVICE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Status</label>
              <select
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as ReminderDeliveryStatus | "")}
              >
                <option value="">All</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small">Recipient contains</label>
              <input
                type="text"
                className="form-control"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small">From</label>
              <input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label small">To</label>
              <input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="d-flex justify-content-between mt-3">
            <div className="text-muted small align-self-center">{total} matching entries</div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={exportCsv}>
                Export CSV
              </button>
              <button className="btn btn-primary btn-sm" disabled={loading} onClick={() => load(0)}>
                {loading ? "Loading…" : "Apply filters"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Created</th>
                  <th>Service</th>
                  <th>Recipient</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Trigger</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-5">
                      No logs match these filters.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="small">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="small">{SERVICE_TYPE_LABEL[r.serviceType]}</td>
                    <td className="small">{r.recipient}</td>
                    <td className="small">{r.subject}</td>
                    <td>
                      <span className={`badge bg-${STATUS_VARIANT[r.deliveryStatus]}`}>{r.deliveryStatus}</span>
                    </td>
                    <td className="small">{r.triggeredBy}</td>
                    <td>
                      <button className="btn btn-sm btn-light" onClick={() => openDetail(r.id)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card-footer d-flex justify-content-between align-items-center">
          <div className="small text-muted">
            Page {page + 1} of {Math.max(1, totalPages)}
          </div>
          <div className="d-flex gap-1">
            <button
              className="btn btn-sm btn-light"
              disabled={page === 0 || loading}
              onClick={() => load(page - 1)}
            >
              Previous
            </button>
            <button
              className="btn btn-sm btn-light"
              disabled={page + 1 >= totalPages || loading}
              onClick={() => load(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {detail && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setDetail(null)}
        >
          <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Delivery log #{detail.id}</h5>
                <button className="btn-close" onClick={() => setDetail(null)} />
              </div>
              <div className="modal-body">
                <div className="row mb-3 small">
                  <div className="col-md-6"><strong>Recipient:</strong> {detail.recipient}</div>
                  <div className="col-md-6"><strong>Status:</strong> {detail.deliveryStatus}</div>
                  <div className="col-md-6"><strong>Service:</strong> {SERVICE_TYPE_LABEL[detail.serviceType]}</div>
                  <div className="col-md-6"><strong>Triggered by:</strong> {detail.triggeredBy}</div>
                  <div className="col-md-6"><strong>Sent at:</strong> {detail.sentAt || "—"}</div>
                  <div className="col-md-6"><strong>Created:</strong> {detail.createdAt}</div>
                  {detail.failureReason && (
                    <div className="col-12 text-danger"><strong>Failure:</strong> {detail.failureReason}</div>
                  )}
                </div>
                <div className="border rounded p-3 bg-light">
                  <div className="fw-semibold mb-2">{detail.subject}</div>
                  <div dangerouslySetInnerHTML={{ __html: detail.body || "" }} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-light" onClick={() => setDetail(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogsSection;
