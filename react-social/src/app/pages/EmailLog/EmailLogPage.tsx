import { useCallback, useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import { showErrorToast } from "../../utils/toast";
import { EmailLog, EmailLogStatus, getEmailLog, getEmailLogs } from "./API/EmailLog_APIs";
import EmailLogDetailModal, { statusColor } from "./components/EmailLogDetailModal";

const PAGE_SIZE = 25;
const STATUS_OPTIONS: EmailLogStatus[] = ["QUEUED", "SENT", "FAILED", "SKIPPED"];

const EmailLogPage = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter inputs (status applies immediately; text filters apply on Search/Enter).
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("");
  // Applied filters actually sent to the server.
  const [applied, setApplied] = useState<{ status: string; type: string; recipient: string }>({
    status: "",
    type: "",
    recipient: "",
  });

  const [page, setPage] = useState(0); // zero-based
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const [detailLog, setDetailLog] = useState<EmailLog | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const { data } = await getEmailLogs({
        status: applied.status || undefined,
        type: applied.type || undefined,
        recipient: applied.recipient || undefined,
        page,
        size: PAGE_SIZE,
      });
      setLogs(data.content || []);
      setTotalPages(data.totalPages ?? 0);
      setTotalElements(data.totalElements ?? 0);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to fetch email logs";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const applyFilters = () => {
    setPage(0);
    setApplied({ status: statusFilter, type: typeFilter.trim(), recipient: recipientFilter.trim() });
  };

  const resetFilters = () => {
    setStatusFilter("");
    setTypeFilter("");
    setRecipientFilter("");
    setPage(0);
    setApplied({ status: "", type: "", recipient: "" });
  };

  const onStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(0);
    setApplied((prev) => ({ ...prev, status: value }));
  };

  const openDetail = async (log: EmailLog) => {
    // Show what we have immediately, then refresh from the single-record endpoint
    // (it may carry fuller data than the list row).
    setDetailLog(log);
    setShowDetail(true);
    try {
      const { data } = await getEmailLog(log.id);
      setDetailLog(data);
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || "Failed to load log detail");
    }
  };

  const safePage = Math.min(page, Math.max(0, totalPages - 1));

  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-envelope-paper-fill" />}
        title="Email Log"
        subtitle={<>{totalElements} total · page {totalPages === 0 ? 0 : safePage + 1} of {totalPages}</>}
      />

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ padding: "16px" }}>
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "10px 14px", marginBottom: "16px", color: "#b91c1c", fontSize: "0.85rem" }} className="d-flex align-items-center">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Filters */}
          <div className="d-flex align-items-end gap-2 mb-3 flex-wrap">
            <div style={{ minWidth: "160px" }}>
              <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.3px" }}>Status</label>
              <select
                className="form-select form-select-sm"
                value={statusFilter}
                onChange={(e) => onStatusChange(e.target.value)}
                style={{ borderRadius: "6px", fontSize: "0.85rem" }}
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: "180px" }}>
              <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.3px" }}>Email Type</label>
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="e.g. WELCOME"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                style={{ borderRadius: "6px", fontSize: "0.85rem" }}
              />
            </div>
            <div style={{ minWidth: "220px" }}>
              <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.3px" }}>Recipient</label>
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="email address"
                value={recipientFilter}
                onChange={(e) => setRecipientFilter(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                style={{ borderRadius: "6px", fontSize: "0.85rem" }}
              />
            </div>
            <button
              className="btn btn-sm"
              onClick={applyFilters}
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600 }}
            >
              <i className="bi bi-funnel-fill me-1"></i>Filter
            </button>
            <button className="btn btn-sm btn-light" onClick={resetFilters} style={{ borderRadius: "6px" }}>
              Reset
            </button>
            <button className="btn btn-sm btn-light ms-auto" onClick={fetchLogs} disabled={loading} style={{ borderRadius: "6px" }}>
              <i className="bi bi-arrow-clockwise me-1"></i>Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border" style={{ color: "#4f46e5" }} role="status"></div>
              <p className="mt-3" style={{ color: "#6b7280" }}>Loading email logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-envelope-x d-block mb-2" style={{ fontSize: "2rem", color: "#d1d5db" }}></i>
              <span style={{ color: "#6b7280" }}>No email logs found.</span>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table table-hover align-middle mb-0" style={{ width: "100%", tableLayout: "auto", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                    {["Created", "Type", "Recipient", "Status", "Account", "Subject", "Mode", "Sent", ""].map((h, i) => (
                      <th key={`${h}-${i}`} style={{ padding: "10px 12px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px", whiteSpace: "nowrap", background: "#f9fafb" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const sc = statusColor(log.status);
                    return (
                      <tr key={log.id} style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }} onClick={() => openDetail(log)}>
                        <td style={{ padding: "8px 12px", color: "#4b5563", whiteSpace: "nowrap" }}>{log.createdAt || "—"}</td>
                        <td style={{ padding: "8px 12px", color: "#111827", fontWeight: 600 }}>{log.emailType || "—"}</td>
                        <td style={{ padding: "8px 12px", color: "#4b5563" }}>{log.recipient || "—"}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "3px 10px", borderRadius: "4px", display: "inline-block", background: sc.bg, color: sc.fg }}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px", color: "#4b5563" }}>{log.accountName || "—"}</td>
                        <td style={{ padding: "8px 12px", color: "#4b5563", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.subject || ""}>
                          {log.subject || "—"}
                        </td>
                        <td style={{ padding: "8px 12px", color: "#4b5563" }}>{log.deliveryMode || "—"}</td>
                        <td style={{ padding: "8px 12px", color: "#4b5563", whiteSpace: "nowrap" }}>{log.sentAt || "—"}</td>
                        <td style={{ padding: "8px 12px", textAlign: "center" }}>
                          <button
                            className="btn btn-sm btn-light"
                            onClick={(e) => { e.stopPropagation(); openDetail(log); }}
                            style={{ borderRadius: "6px", padding: "2px 8px" }}
                            title="View detail"
                          >
                            <i className="bi bi-eye-fill" style={{ color: "#4f46e5" }}></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex align-items-center justify-content-between mt-3 flex-wrap gap-2">
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                Showing page {safePage + 1} of {totalPages} · {totalElements} records
              </span>
              <div className="d-flex align-items-center gap-1">
                <button className="btn btn-sm btn-light" disabled={safePage <= 0} onClick={() => setPage(0)} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>First</button>
                <button className="btn btn-sm btn-light" disabled={safePage <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>Prev</button>
                <span style={{ fontSize: "0.82rem", color: "#374151", padding: "0 8px", fontWeight: 600 }}>{safePage + 1} / {totalPages}</span>
                <button className="btn btn-sm btn-light" disabled={safePage >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>Next</button>
                <button className="btn btn-sm btn-light" disabled={safePage >= totalPages - 1} onClick={() => setPage(totalPages - 1)} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>Last</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <EmailLogDetailModal
        show={showDetail}
        onHide={() => { setShowDetail(false); setDetailLog(null); }}
        log={detailLog}
      />
    </div>
  );
};

export default EmailLogPage;
