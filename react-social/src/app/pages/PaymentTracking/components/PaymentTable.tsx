import { Badge, Button, Spinner } from "react-bootstrap";
import { MdNotifications } from "react-icons/md";
import { ActionIcon } from "../../../components/ActionIcon";

export interface PaymentRow {
  transactionId: number;
  razorpayPaymentId: string | null;
  razorpayLinkId: string | null;
  mappingId: number;
  assessmentId: number;
  instituteCode: number;
  amount: number;
  currency: string;
  status: string;
  paymentLinkUrl: string | null;
  shortUrl: string | null;
  studentName: string | null;
  studentEmail: string | null;
  studentPhone: string | null;
  studentDob: string | null;
  userStudentId: number | null;
  failureReason: string | null;
  welcomeEmailSent: boolean;
  nudgeEmailSent: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaymentTableProps {
  transactions: PaymentRow[];
  loading: boolean;
  statusFilter: string;
  onSendNudge: (transactionId: number) => void;
  onResendWelcome: (transactionId: number) => void;
  actionLoading: number | null;
}

const statusColors: Record<string, { bg: string; color: string }> = {
  paid: { bg: "#dcfce7", color: "#059669" },
  created: { bg: "#fef3c7", color: "#d97706" },
  failed: { bg: "#fee2e2", color: "#ef4444" },
  expired: { bg: "#f1f5f9", color: "#64748b" },
  cancelled: { bg: "#fce7f3", color: "#db2777" },
};

const PaymentTable = ({
  transactions,
  loading,
  statusFilter,
  onSendNudge,
  onResendWelcome,
  actionLoading,
}: PaymentTableProps) => {
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0", color: "#64748b" }}>
        <Spinner animation="border" size="sm" style={{ marginRight: 12 }} />
        Loading transactions...
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", border: "2px dashed #e2e8f0", borderRadius: 12, color: "#94a3b8" }}>
        No {statusFilter} transactions found.
      </div>
    );
  }

  return (
    <div style={{ maxHeight: 600, overflowY: "auto", borderRadius: 12, border: "1px solid #e2e8f0" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {["ID", "Student", "Email", "Phone", "DOB", "Amount", "Status", "Razorpay ID", "Date", "Actions"].map((h) => (
              <th key={h} style={{
                padding: "12px 14px", fontWeight: 700, fontSize: "0.75rem", color: "#64748b",
                textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0",
                whiteSpace: "nowrap", position: "sticky", top: 0, background: "#f8fafc", zIndex: 1,
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn, idx) => {
            const sc = statusColors[txn.status] || statusColors.created;
            return (
              <tr key={txn.transactionId} style={{ background: idx % 2 === 0 ? "#fff" : "#fafbfc", transition: "background 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#fafbfc")}
              >
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontSize: "0.82rem", color: "#64748b" }}>
                  #{txn.transactionId}
                </td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>
                  {txn.studentName || "-"}
                </td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontSize: "0.82rem", color: "#475569" }}>
                  {txn.studentEmail || "-"}
                </td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontSize: "0.82rem", color: "#475569" }}>
                  {txn.studentPhone || "-"}
                </td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontSize: "0.82rem", color: "#475569" }}>
                  {txn.studentDob || "-"}
                </td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>
                  INR {txn.amount / 100}
                </td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ background: sc.bg, color: sc.color, padding: "4px 12px", borderRadius: 8, fontWeight: 600, fontSize: "0.75rem" }}>
                    {txn.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontSize: "0.75rem", color: "#94a3b8", fontFamily: "monospace" }}>
                  {txn.razorpayPaymentId || txn.razorpayLinkId || "-"}
                </td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontSize: "0.78rem", color: "#64748b", whiteSpace: "nowrap" }}>
                  {txn.createdAt}
                </td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["failed", "created", "expired", "cancelled"].includes(txn.status) && txn.studentEmail && (
                      <Button size="sm" onClick={() => onSendNudge(txn.transactionId)} disabled={actionLoading === txn.transactionId}
                        style={{ background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e", fontWeight: 600, fontSize: "0.72rem", borderRadius: 6, padding: "4px 10px" }}>
                        {actionLoading === txn.transactionId ? <Spinner animation="border" size="sm" /> : (
                          <><MdNotifications size={12} style={{ marginRight: 4 }} />Nudge</>
                        )}
                      </Button>
                    )}
                    {txn.status === "paid" && txn.studentEmail && (
                      <Button size="sm" onClick={() => onResendWelcome(txn.transactionId)} disabled={actionLoading === txn.transactionId}
                        style={{ background: "#dcfce7", border: "1px solid #86efac", color: "#166534", fontWeight: 600, fontSize: "0.72rem", borderRadius: 6, padding: "4px 10px" }}>
                        {actionLoading === txn.transactionId ? <Spinner animation="border" size="sm" /> : (
                          <><span style={{ marginRight: 4 }}><ActionIcon type="send" size="sm" /></span>Resend Welcome</>
                        )}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PaymentTable;
