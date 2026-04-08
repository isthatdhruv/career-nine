import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

type PaymentStatus = "paid" | "created" | "failed" | "expired" | "cancelled" | "loading" | "error";

const statusConfig: Record<string, { title: string; subtitle: string; icon: string; gradient: string }> = {
  paid: {
    title: "Payment Successful!",
    subtitle: "Your assessment has been allotted. Check your email for login credentials.",
    icon: "\u2705",
    gradient: "linear-gradient(135deg, #059669 0%, #047857 100%)",
  },
  created: {
    title: "Payment Pending",
    subtitle: "Your payment is being processed. Please wait or try again.",
    icon: "\u23F3",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  },
  failed: {
    title: "Payment Failed",
    subtitle: "Something went wrong with your payment. Please try again.",
    icon: "\u274C",
    gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
  },
  expired: {
    title: "Payment Link Expired",
    subtitle: "This payment link has expired. Please contact the administrator for a new link.",
    icon: "\u23F0",
    gradient: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
  },
  cancelled: {
    title: "Payment Cancelled",
    subtitle: "Your payment was cancelled. Please try again if you wish to proceed.",
    icon: "\u{1F6AB}",
    gradient: "linear-gradient(135deg, #db2777 0%, #be185d 100%)",
  },
};

const PaymentStatusPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus>("loading");
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    const linkId = searchParams.get("razorpay_payment_link_id");
    const linkStatus = searchParams.get("razorpay_payment_link_status");

    if (linkStatus) {
      setStatus(linkStatus as PaymentStatus);
    }

    if (linkId) {
      const params = new URLSearchParams();
      searchParams.forEach((value, key) => params.append(key, value));

      axios
        .get(`${API_URL}/payment/webhook/callback?${params.toString()}`)
        .then((res) => {
          setDetails(res.data);
          if (res.data.status) {
            setStatus(res.data.status as PaymentStatus);
          }
        })
        .catch(() => {
          if (!linkStatus) setStatus("error");
        });
    } else if (!linkStatus) {
      setStatus("error");
    }
  }, [searchParams]);

  if (status === "loading") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <Spinner animation="border" />
        <p style={{ marginTop: 16, color: "#64748b" }}>Verifying payment status...</p>
      </div>
    );
  }

  const config = statusConfig[status] || statusConfig.failed;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh", padding: 24 }}>
      <div style={{ maxWidth: 500, width: "100%", textAlign: "center" }}>
        <div style={{ background: config.gradient, borderRadius: "16px 16px 0 0", padding: "40px 24px", color: "#fff" }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>{config.icon}</div>
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: "1.5rem" }}>{config.title}</h2>
        </div>
        <div style={{ background: "#fff", borderRadius: "0 0 16px 16px", padding: "32px 24px", border: "1px solid #e2e8f0", borderTop: "none" }}>
          <p style={{ color: "#64748b", fontSize: "0.95rem", marginBottom: 24 }}>{config.subtitle}</p>
          {details && details.amount && (
            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: 10, marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                Amount: <strong style={{ color: "#1e293b" }}>INR {details.amount}</strong>
              </p>
            </div>
          )}
          {status === "failed" && (
            <p style={{ color: "#94a3b8", fontSize: "0.82rem" }}>
              If the amount was deducted, it will be refunded within 5-7 business days.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentStatusPage;
