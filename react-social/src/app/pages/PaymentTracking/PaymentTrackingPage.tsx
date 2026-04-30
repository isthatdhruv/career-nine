import { useEffect, useState, useCallback } from "react";
import { Tab, Tabs, Badge } from "react-bootstrap";
import PaymentTable, { PaymentRow } from "./components/PaymentTable";
import { getPaymentTransactions, sendNudgeEmail, resendWelcomeEmail } from "./API/Payment_APIs";
import { showErrorToast } from "../../utils/toast";
import PageHeader from "../../components/PageHeader";

const PaymentTrackingPage = () => {
  const [activeTab, setActiveTab] = useState<string>("paid");
  const [transactions, setTransactions] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadTransactions = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const res = await getPaymentTransactions(status ? { status } : undefined);
      setTransactions(res.data || []);
    } catch (error) {
      console.error("Failed to load transactions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "all") {
      loadTransactions();
    } else {
      loadTransactions(activeTab);
    }
  }, [activeTab, loadTransactions]);

  const handleSendNudge = async (transactionId: number) => {
    setActionLoading(transactionId);
    try {
      await sendNudgeEmail(transactionId);
      if (activeTab === "all") { loadTransactions(); } else { loadTransactions(activeTab); }
    } catch (err: any) {
      showErrorToast(err.response?.data || "Failed to send nudge");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendWelcome = async (transactionId: number) => {
    setActionLoading(transactionId);
    try {
      await resendWelcomeEmail(transactionId);
      if (activeTab === "all") { loadTransactions(); } else { loadTransactions(activeTab); }
    } catch (err: any) {
      showErrorToast(err.response?.data || "Failed to resend welcome email");
    } finally {
      setActionLoading(null);
    }
  };

  const getTabCount = (status: string) => {
    if (activeTab === "all") {
      return transactions.filter((t) => t.status === status).length;
    }
    return activeTab === status ? transactions.length : 0;
  };

  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-credit-card" />}
        title="Payment Tracking"
        subtitle={<><strong>{transactions.length}</strong> transactions · Razorpay</>}
        actions={[
          {
            label: "Refresh",
            iconClass: "bi-arrow-clockwise",
            onClick: () => (activeTab === "all" ? loadTransactions() : loadTransactions(activeTab)),
            variant: "primary",
            disabled: loading,
          },
        ]}
      />

      <div style={{ background: "#fff", borderRadius: 16, padding: "24px 28px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k || "paid")} className="mb-4">
          <Tab eventKey="paid" title={<span>Successful <Badge bg="" style={{ background: "#dcfce7", color: "#059669", fontSize: "0.7rem" }}>{getTabCount("paid")}</Badge></span>} />
          <Tab eventKey="created" title={<span>Pending <Badge bg="" style={{ background: "#fef3c7", color: "#d97706", fontSize: "0.7rem" }}>{getTabCount("created")}</Badge></span>} />
          <Tab eventKey="failed" title={<span>Failed <Badge bg="" style={{ background: "#fee2e2", color: "#ef4444", fontSize: "0.7rem" }}>{getTabCount("failed")}</Badge></span>} />
          <Tab eventKey="all" title={<span>All Transactions</span>} />
        </Tabs>

        <PaymentTable
          transactions={transactions}
          loading={loading}
          statusFilter={activeTab}
          onSendNudge={handleSendNudge}
          onResendWelcome={handleResendWelcome}
          actionLoading={actionLoading}
        />
      </div>
    </div>
  );
};

export default PaymentTrackingPage;
