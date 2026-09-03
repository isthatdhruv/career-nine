import { FC, useCallback, useEffect, useState } from "react";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import { formatDateTime, mono } from "../../EmailTemplates/components/MailBadges";
import {
  MailAutomation,
  MailJob,
  MailJobStatus,
  MailQueueResponse,
  cancelMailJob,
  getMailAutomations,
  getMailQueue,
  retryMailJob,
  setMailQueuePaused,
} from "../API/MailAutomation_APIs";
import { JobStatusBadge, OnOffBadge, StatTile, dash } from "./Chips";
import { apiError, card, control, relativeTime, td, th } from "./automationHelpers";

const STATUSES: MailJobStatus[] = ["PENDING", "PROCESSING", "RETRY", "SENT", "FAILED", "CANCELLED", "SKIPPED"];
const REFRESH_MS = 15000;
const COLUMNS = ["Recipient", "Automation", "Event", "Subject", "Fire at", "Attempts", "Status", "Error / reason", "Actions"];

const canCancel = (j: MailJob) => j.status === "PENDING" || j.status === "RETRY";
const canRetry = (j: MailJob) => j.status === "PENDING" || j.status === "RETRY" || j.status === "FAILED";

const JobsTable: FC<{ jobs: MailJob[]; now: number; canEdit: boolean; busyId: string | null; empty: string; onCancel: (j: MailJob) => void; onRetry: (j: MailJob) => void }> = ({ jobs, now, canEdit, busyId, empty, onCancel, onRetry }) => {
  if (jobs.length === 0) return <div className="text-center py-4" style={{ color: "#9ca3af", fontSize: "0.85rem" }}>{empty}</div>;
  const small: React.CSSProperties = { fontSize: "0.72rem", color: "#6b7280" };
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="table table-hover align-middle mb-0" style={{ width: "100%", fontSize: "0.83rem" }}>
        <thead><tr style={{ borderBottom: "2px solid #e5e7eb" }}>{COLUMNS.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {jobs.map((j) => {
            const busy = busyId === j.id;
            const reason = j.lastError || j.skipReason;
            return (
              <tr key={j.id} style={{ borderBottom: "1px solid #f3f4f6", opacity: busy ? 0.6 : 1 }}>
                <td style={td}>
                  <div style={{ color: "#111827", fontWeight: 600 }}>{j.recipient}</div>
                  {j.role && <div style={small}>{j.role}</div>}
                </td>
                <td style={td}>
                  <div style={{ color: "#111827" }}>{j.automationName || (j.automationId != null ? `#${j.automationId}` : dash)}</div>
                  {j.templateName && <div style={small}>{j.templateName}</div>}
                </td>
                <td style={td}>{j.eventKey ? <code style={{ ...mono, color: "#4338ca" }}>{j.eventKey}</code> : dash}</td>
                <td style={td}>{j.subjectKey ? <code style={{ ...mono, color: "#6b7280" }}>{j.subjectKey}</code> : dash}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  <div style={{ color: "#111827" }}>{formatDateTime(j.fireAt)}</div>
                  <div style={small}>{relativeTime(j.fireAt, now)}{j.seq > 1 ? ` · send #${j.seq}` : ""}</div>
                </td>
                <td style={{ ...td, textAlign: "center" }}>{j.attempts}</td>
                <td style={td}><JobStatusBadge status={j.status} /></td>
                <td style={{ ...td, maxWidth: 260 }}>
                  {reason ? <span title={reason} style={{ fontSize: "0.76rem", color: j.lastError ? "#b91c1c" : "#6b7280", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reason}</span> : dash}
                </td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  {canEdit && canRetry(j) && (
                    <button className="btn btn-sm btn-light me-1" style={{ borderRadius: 6, color: "#4f46e5", padding: "2px 7px" }} disabled={busy} onClick={() => onRetry(j)} title="Send now"><i className="bi bi-send-fill"></i></button>
                  )}
                  {canEdit && canCancel(j) && (
                    <button className="btn btn-sm btn-light" style={{ borderRadius: 6, color: "#dc2626", padding: "2px 7px" }} disabled={busy} onClick={() => onCancel(j)} title="Cancel"><i className="bi bi-x-lg"></i></button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const QueueTab: FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const [data, setData] = useState<MailQueueResponse | null>(null);
  const [automations, setAutomations] = useState<MailAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [automationId, setAutomationId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const h = setTimeout(() => setRecipientQuery(recipient.trim()), 400);
    return () => clearTimeout(h);
  }, [recipient]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setError(null);
      const res = await getMailQueue({ status, automationId, recipient: recipientQuery, limit: 200 });
      setData(res.data);
      setNow(Date.now());
    } catch (err: any) {
      setError(apiError(err, "Failed to load the queue"));
    } finally {
      setLoading(false);
    }
  }, [status, automationId, recipientQuery]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getMailAutomations().then((r) => setAutomations(r.data || [])).catch(() => setAutomations([]));
  }, []);

  // Auto-refresh while this tab is mounted and the page is visible.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") load(true); };
    const h = setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(h); document.removeEventListener("visibilitychange", tick); };
  }, [load]);

  const handlePauseToggle = async () => {
    const paused = !data?.summary.paused;
    const msg = paused
      ? "Pause the queue? Jobs stay queued and nothing is sent until you resume. Immediate (inline) sends are not affected."
      : "Resume the queue? Due jobs start sending right away.";
    if (!window.confirm(msg)) return;
    try {
      await setMailQueuePaused(paused);
      showSuccessToast(paused ? "Queue paused" : "Queue resumed");
      load(true);
    } catch (err: any) {
      showErrorToast(apiError(err, "Failed to update the queue"));
    }
  };

  const handleCancel = async (j: MailJob) => {
    if (!window.confirm(`Cancel the job for ${j.recipient}?`)) return;
    setBusyId(j.id);
    try {
      await cancelMailJob(j.id);
      showSuccessToast("Job cancelled");
      load(true);
    } catch (err: any) {
      showErrorToast(apiError(err, "Failed to cancel job"));
    } finally {
      setBusyId(null);
    }
  };

  const handleRetry = async (j: MailJob) => {
    if (!window.confirm(`Send to ${j.recipient} now?`)) return;
    setBusyId(j.id);
    try {
      await retryMailJob(j.id);
      showSuccessToast("Job fired");
      load(true);
    } catch (err: any) {
      showErrorToast(apiError(err, "Failed to retry job"));
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ ...card, padding: "48px", textAlign: "center" }}>
        <div className="spinner-border" style={{ color: "#4f46e5" }} role="status"></div>
        <p className="mt-3" style={{ color: "#6b7280" }}>Loading queue…</p>
      </div>
    );
  }

  const s = data?.summary;
  const sel: React.CSSProperties = { ...control, width: "auto", maxWidth: "240px" };

  return (
    <>
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "10px 14px", marginBottom: "16px", color: "#b91c1c", fontSize: "0.85rem" }} className="d-flex align-items-center">
          <i className="bi bi-exclamation-triangle-fill me-2"></i><span>{error}</span>
        </div>
      )}

      {s && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px", marginBottom: "16px" }}>
          <StatTile label="Engine" value={<OnOffBadge on={s.engineEnabled} />} hint={s.engineEnabled ? "automations run" : "old code paths"} />
          <StatTile label="Queue" value={<OnOffBadge on={!s.paused} onLabel="Running" offLabel="Paused" />} />
          <StatTile label="Pending" value={s.pending} color="#0369a1" />
          <StatTile label="Processing" value={s.processing} color="#4f46e5" />
          <StatTile label="Retrying" value={s.retrying} color={s.retrying ? "#b45309" : undefined} />
          <StatTile label="Sent today" value={s.sentToday} color="#059669" />
          <StatTile label="Failed today" value={s.failedToday} color={s.failedToday ? "#dc2626" : undefined} />
        </div>
      )}

      <div style={card}>
        <div style={{ padding: "16px" }}>
          <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
            <select className="form-select form-select-sm" style={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Any status</option>
              {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
            <select className="form-select form-select-sm" style={sel} value={automationId} onChange={(e) => setAutomationId(e.target.value)}>
              <option value="">All automations</option>
              {automations.map((a) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
            </select>
            <input className="form-control form-control-sm" style={{ ...control, maxWidth: "240px" }} placeholder="Recipient contains…" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            <span style={{ fontSize: "0.76rem", color: "#9ca3af" }}>
              {data ? `${data.jobs.length} job${data.jobs.length === 1 ? "" : "s"}` : ""} · refreshed {relativeTime(new Date(now).toISOString(), Date.now()) || "just now"} · auto every 15s
            </span>
            <button className="btn btn-sm btn-light ms-auto" onClick={() => load()} style={{ borderRadius: "6px" }} title="Refresh"><i className="bi bi-arrow-clockwise"></i></button>
            {canEdit && s && (
              <button className="btn btn-sm" onClick={handlePauseToggle} style={{ borderRadius: 6, fontWeight: 600, border: "none", background: s.paused ? "#059669" : "#fef3c7", color: s.paused ? "#fff" : "#b45309" }}>
                <i className={`bi ${s.paused ? "bi-play-fill" : "bi-pause-fill"} me-1`}></i>{s.paused ? "Resume queue" : "Pause queue"}
              </button>
            )}
          </div>

          <JobsTable jobs={data?.jobs || []} now={now} canEdit={canEdit} busyId={busyId} empty="No jobs match. Pending jobs appear here as automations fire." onCancel={handleCancel} onRetry={handleRetry} />
        </div>
      </div>

      <div style={{ ...card, marginTop: 24 }}>
        <div style={{ padding: "16px" }}>
          <div className="d-flex align-items-center mb-1">
            <i className="bi bi-clock-history me-2" style={{ color: "#4f46e5" }}></i>
            <span style={{ fontWeight: 700, color: "#111827" }}>Recent outcomes</span>
          </div>
          <p style={{ fontSize: "0.82rem", color: "#6b7280", marginBottom: "14px" }}>The latest sent, failed, skipped and cancelled jobs, regardless of the filters above.</p>
          <JobsTable jobs={data?.recent || []} now={now} canEdit={canEdit} busyId={busyId} empty="Nothing has completed yet." onCancel={handleCancel} onRetry={handleRetry} />
        </div>
      </div>
    </>
  );
};

export default QueueTab;
