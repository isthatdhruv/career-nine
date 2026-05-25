import { useCallback, useEffect, useState } from "react";
import {
  getCommunicationLogs,
  CommunicationLogEntry,
  CommunicationLogFilters,
} from "./API/CommunicationLogs_APIs";
import { showErrorToast } from "../../utils/toast";
import PageHeader from "../../components/PageHeader";

const MESSAGE_TYPES = [
  "REPORT",
  "CONTACT_ASSIGNMENT",
  "ID_CARD",
  "EMAIL_OTP",
  "WELCOME",
  "OTHER",
];

const channelBadge = (channel: string) => {
  if (channel === "EMAIL") {
    return <span className="badge bg-primary px-3 py-2"><i className="bi bi-envelope me-1" /> Email</span>;
  }
  if (channel === "WHATSAPP") {
    return <span className="badge bg-success px-3 py-2"><i className="bi bi-chat-dots me-1" /> WhatsApp</span>;
  }
  return <span className="badge bg-secondary px-3 py-2">{channel}</span>;
};

const statusBadge = (status: string) => {
  if (status === "SENT") {
    return <span className="badge bg-success">Sent</span>;
  }
  return <span className="badge bg-danger">Failed</span>;
};

const formatDate = (iso: string) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
};

const formatMessageType = (t: string) =>
  t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const CommunicationLogsPage = () => {
  const [logs, setLogs] = useState<CommunicationLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Filters
  const [channel, setChannel] = useState("");
  const [messageType, setMessageType] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Detail modal
  const [detailLog, setDetailLog] = useState<CommunicationLogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const filters: CommunicationLogFilters = {
        channel: channel || undefined,
        messageType: messageType || undefined,
        status: status || undefined,
        search: search || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        size: 50,
      };
      const res = await getCommunicationLogs(filters);
      setLogs(res.data.content || []);
      setTotalPages(res.data.totalPages || 0);
      setTotalElements(res.data.totalElements || 0);
    } catch (err) {
      console.error("Failed to load communication logs:", err);
      showErrorToast("Failed to load communication logs");
    } finally {
      setLoading(false);
    }
  }, [channel, messageType, status, search, fromDate, toDate, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const resetFilters = () => {
    setChannel("");
    setMessageType("");
    setStatus("");
    setSearch("");
    setFromDate("");
    setToDate("");
    setPage(0);
  };

  const applyFilters = () => {
    setPage(0);
    fetchLogs();
  };

  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-envelope-paper" />}
        title="Communication Logs"
        subtitle={
          <><strong>{totalElements}</strong> total logs · Every email and WhatsApp message sent from the app is recorded here</>
        }
        actions={[
          {
            label: loading ? "Refreshing..." : "Apply Filters",
            iconClass: "bi-funnel",
            onClick: applyFilters,
            variant: "primary",
            disabled: loading,
          },
          {
            label: "Reset",
            iconClass: "bi-arrow-counterclockwise",
            onClick: resetFilters,
            variant: "ghost",
          },
        ]}
      />
      <div className="card shadow-sm">
        <div className="card-body">
          {/* Filter Bar */}
          <div className="row g-2 mb-3">
            <div className="col-md-2">
              <label className="form-label small text-muted mb-1">Channel</label>
              <select
                className="form-select form-select-sm"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                <option value="">All</option>
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted mb-1">Message Type</label>
              <select
                className="form-select form-select-sm"
                value={messageType}
                onChange={(e) => setMessageType(e.target.value)}
              >
                <option value="">All</option>
                {MESSAGE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {formatMessageType(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted mb-1">Status</label>
              <select
                className="form-select form-select-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted mb-1">From</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted mb-1">To</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted mb-1">Search</label>
              <input
                type="text"
                placeholder="Name / email / phone"
                className="form-control form-control-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
              />
            </div>
          </div>

          <div className="mb-3 d-flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={applyFilters}>
              Apply Filters
            </button>
            <button className="btn btn-light btn-sm" onClick={resetFilters}>
              Reset
            </button>
            <div className="ms-auto text-muted small d-flex align-items-center">
              {loading ? "Loading..." : `${totalElements} total logs`}
            </div>
          </div>

          {/* Table */}
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Channel</th>
                  <th>Recipient</th>
                  <th>Contact</th>
                  <th>Message Type</th>
                  <th>Sent At</th>
                  <th>Status</th>
                  <th>Sent By</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No communication logs found
                    </td>
                  </tr>
                )}
                {logs.map((log) => (
                  <tr
                    key={log.logId}
                    onClick={() => log.errorMessage && setDetailLog(log)}
                    style={{ cursor: log.errorMessage ? "pointer" : "default" }}
                  >
                    <td>{channelBadge(log.channel)}</td>
                    <td>{log.recipientName || <span className="text-muted">—</span>}</td>
                    <td>
                      {log.channel === "EMAIL"
                        ? log.recipientEmail || "—"
                        : log.recipientPhone || "—"}
                    </td>
                    <td>
                      <span className="badge bg-info text-dark">
                        {formatMessageType(log.messageType)}
                      </span>
                    </td>
                    <td className="small">{formatDate(log.createdAt)}</td>
                    <td>{statusBadge(log.status)}</td>
                    <td className="small text-muted">{log.sentBy || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="text-muted small">
                Page {page + 1} of {totalPages}
              </span>
              <div className="btn-group">
                <button
                  className="btn btn-sm btn-outline-primary"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-sm btn-outline-primary"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error detail modal */}
      {detailLog && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setDetailLog(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              maxWidth: 600,
              width: "90%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h5 className="mb-3">Failure Details</h5>
            <dl className="row small">
              <dt className="col-sm-4">Channel:</dt>
              <dd className="col-sm-8">{detailLog.channel}</dd>
              <dt className="col-sm-4">Recipient:</dt>
              <dd className="col-sm-8">
                {detailLog.recipientName || "—"}
                <br />
                <span className="text-muted">
                  {detailLog.recipientEmail || detailLog.recipientPhone || ""}
                </span>
              </dd>
              <dt className="col-sm-4">Message Type:</dt>
              <dd className="col-sm-8">{formatMessageType(detailLog.messageType)}</dd>
              <dt className="col-sm-4">Sent At:</dt>
              <dd className="col-sm-8">{formatDate(detailLog.createdAt)}</dd>
              <dt className="col-sm-4">Error:</dt>
              <dd className="col-sm-8 text-danger">{detailLog.errorMessage}</dd>
            </dl>
            <div className="text-end">
              <button className="btn btn-primary btn-sm" onClick={() => setDetailLog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunicationLogsPage;
