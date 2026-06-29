import { EmailLog, EmailLogStatus } from "../API/EmailLog_APIs";

interface Props {
  show: boolean;
  onHide: () => void;
  log: EmailLog | null;
}

// Color-coding shared with the table: SENT green, FAILED red, QUEUED amber, SKIPPED muted.
export const statusColor = (status: EmailLogStatus): { bg: string; fg: string } => {
  switch (status) {
    case "SENT":
      return { bg: "#059669", fg: "#fff" };
    case "FAILED":
      return { bg: "#dc2626", fg: "#fff" };
    case "QUEUED":
      return { bg: "#f59e0b", fg: "#fff" };
    case "SKIPPED":
    default:
      return { bg: "#e5e7eb", fg: "#6b7280" };
  }
};

const fmt = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : String(v);

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="d-flex" style={{ borderBottom: "1px solid #f3f4f6", padding: "8px 0" }}>
    <div style={{ width: "40%", fontSize: "0.78rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.3px" }}>
      {label}
    </div>
    <div style={{ width: "60%", fontSize: "0.85rem", color: "#111827", wordBreak: "break-word" }}>{value}</div>
  </div>
);

const EmailLogDetailModal = ({ show, onHide, log }: Props) => {
  if (!show || !log) return null;
  const sc = statusColor(log.status);

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 9999,
      }}
      onClick={onHide}
    >
      <div
        style={{
          backgroundColor: "#fff", borderRadius: "16px", maxWidth: "680px",
          width: "94%", maxHeight: "88vh", display: "flex", flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
          padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <h6 className="mb-0 text-white fw-bold" style={{ fontSize: "1rem" }}>
              <i className="bi bi-envelope-paper-fill me-2"></i>Email Log #{log.id}
            </h6>
            <p className="mb-0 text-white" style={{ fontSize: "0.82rem", opacity: 0.85 }}>
              {fmt(log.emailType)} → {fmt(log.recipient)}
            </p>
          </div>
          <button type="button" className="btn-close btn-close-white" onClick={onHide}></button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
          <Row label="Status" value={
            <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "3px 10px", borderRadius: "4px", background: sc.bg, color: sc.fg }}>
              {log.status}
            </span>
          } />
          <Row label="Email Type" value={fmt(log.emailType)} />
          <Row label="Recipient" value={fmt(log.recipient)} />
          <Row label="Subject" value={fmt(log.subject)} />
          <Row label="Account" value={fmt(log.accountName ?? log.accountId)} />
          <Row label="Delivery Mode" value={fmt(log.deliveryMode)} />
          <Row label="Template ID" value={fmt(log.templateId)} />
          <Row label="Institute Code" value={fmt(log.instituteCode)} />
          <Row label="User / Student ID" value={fmt(log.userStudentId)} />
          <Row label="Created At" value={fmt(log.createdAt)} />
          <Row label="Sent At" value={fmt(log.sentAt)} />
          {log.errorMessage && (
            <div style={{ marginTop: "12px" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#b91c1c", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 4 }}>
                Error Message
              </div>
              <pre style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", color: "#b91c1c", fontSize: "0.8rem", whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 0 }}>
                {log.errorMessage}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "0.75rem 1.5rem", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "flex-end" }}>
          <button className="btn btn-sm btn-light" onClick={onHide} style={{ borderRadius: "6px" }}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default EmailLogDetailModal;
