import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

type PaymentStatus = "paid" | "created" | "failed" | "expired" | "cancelled" | "loading" | "error";

const statusConfig: Record<string, {
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  accentLight: string;
  gradientOrb1: string;
  gradientOrb2: string;
}> = {
  paid: {
    title: "Payment Successful!",
    subtitle: "Your assessment has been allotted. Check your email for login credentials.",
    icon: "\u2705",
    accentColor: "#10b981",
    accentLight: "rgba(16, 185, 129, 0.12)",
    gradientOrb1: "radial-gradient(circle at 20% 50%, rgba(16, 185, 129, 0.15) 0%, transparent 50%)",
    gradientOrb2: "radial-gradient(circle at 80% 20%, rgba(52, 211, 153, 0.1) 0%, transparent 50%)",
  },
  created: {
    title: "Verifying Payment...",
    subtitle: "We're confirming your payment with Razorpay. This usually takes a few seconds.",
    icon: "\u23F3",
    accentColor: "#f59e0b",
    accentLight: "rgba(245, 158, 11, 0.12)",
    gradientOrb1: "radial-gradient(circle at 20% 50%, rgba(245, 158, 11, 0.15) 0%, transparent 50%)",
    gradientOrb2: "radial-gradient(circle at 80% 20%, rgba(251, 191, 36, 0.1) 0%, transparent 50%)",
  },
  failed: {
    title: "Payment Failed",
    subtitle: "Something went wrong with your payment. Please try again using the link sent to your email.",
    icon: "\u274C",
    accentColor: "#ef4444",
    accentLight: "rgba(239, 68, 68, 0.12)",
    gradientOrb1: "radial-gradient(circle at 20% 50%, rgba(239, 68, 68, 0.12) 0%, transparent 50%)",
    gradientOrb2: "radial-gradient(circle at 80% 20%, rgba(248, 113, 113, 0.08) 0%, transparent 50%)",
  },
  expired: {
    title: "Payment Link Expired",
    subtitle: "This payment link has expired. Please contact the administrator for a new link.",
    icon: "\u23F0",
    accentColor: "#64748b",
    accentLight: "rgba(100, 116, 139, 0.12)",
    gradientOrb1: "radial-gradient(circle at 20% 50%, rgba(100, 116, 139, 0.12) 0%, transparent 50%)",
    gradientOrb2: "radial-gradient(circle at 80% 20%, rgba(148, 163, 184, 0.08) 0%, transparent 50%)",
  },
  cancelled: {
    title: "Payment Cancelled",
    subtitle: "Your payment was cancelled. Please try again if you wish to proceed.",
    icon: "\u{1F6AB}",
    accentColor: "#a855f7",
    accentLight: "rgba(168, 85, 247, 0.12)",
    gradientOrb1: "radial-gradient(circle at 20% 50%, rgba(168, 85, 247, 0.12) 0%, transparent 50%)",
    gradientOrb2: "radial-gradient(circle at 80% 20%, rgba(192, 132, 252, 0.08) 0%, transparent 50%)",
  },
  error: {
    title: "Verification Error",
    subtitle: "We couldn't verify your payment status right now. If you completed the payment, don't worry — your account will be set up shortly. Check your email for confirmation.",
    icon: "\u26A0\uFE0F",
    accentColor: "#f59e0b",
    accentLight: "rgba(245, 158, 11, 0.12)",
    gradientOrb1: "radial-gradient(circle at 20% 50%, rgba(245, 158, 11, 0.12) 0%, transparent 50%)",
    gradientOrb2: "radial-gradient(circle at 80% 20%, rgba(251, 191, 36, 0.08) 0%, transparent 50%)",
  },
};

const PaymentStatusPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus>("loading");
  const [details, setDetails] = useState<any>(null);
  const pollCount = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const linkId = searchParams.get("razorpay_payment_link_id");

    if (!linkId) {
      setStatus("error");
      return;
    }

    const pollStatus = () => {
      axios
        .get(`${API_URL}/payment/webhook/status/${linkId}`)
        .then((res) => {
          const data = res.data;
          setDetails(data);

          if (data.status !== "created") {
            setStatus(data.status as PaymentStatus);
          } else {
            // Still processing — keep polling
            pollCount.current += 1;
            if (pollCount.current < 15) {
              pollTimer.current = setTimeout(pollStatus, 2000);
              setStatus("created");
            } else {
              // Max polls reached — trust Razorpay's query param if available
              const linkStatus = searchParams.get("razorpay_payment_link_status");
              setStatus((linkStatus as PaymentStatus) || "created");
            }
          }
        })
        .catch(() => {
          // API error (404, network) — keep retrying instead of showing error immediately
          pollCount.current += 1;
          if (pollCount.current < 15) {
            setStatus("created");
            pollTimer.current = setTimeout(pollStatus, 2000);
          } else {
            // All retries exhausted — check Razorpay query param as fallback
            const linkStatus = searchParams.get("razorpay_payment_link_status");
            if (linkStatus === "paid") {
              setStatus("paid");
            } else {
              setStatus("error");
            }
          }
        });
    };

    pollStatus();

    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [searchParams]);

  const config = statusConfig[status] || statusConfig.failed;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #f0fdf4 0%, #ecfdf5 25%, #f0f9ff 50%, #faf5ff 75%, #fdf2f8 100%)",
        position: "relative",
        overflow: "hidden",
        padding: 24,
        fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Background decorative orbs */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: config.gradientOrb1,
          pointerEvents: "none",
          transition: "background 0.6s ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: config.gradientOrb2,
          pointerEvents: "none",
          transition: "background 0.6s ease",
        }}
      />
      {/* Floating decorative circles */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "5%",
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(59, 130, 246, 0.04) 100%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "15%",
          right: "8%",
          width: 250,
          height: 250,
          borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(236, 72, 153, 0.04) 100%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 480, width: "100%" }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 20px",
              borderRadius: 50,
              background: "rgba(255, 255, 255, 0.7)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.5)",
              boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: "0.75rem",
              }}
            >
              C
            </div>
            <span style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>
              Career<span style={{ color: "#10b981" }}>-9</span>
            </span>
          </div>
        </div>

        {/* Main Glass Card */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.65)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: 24,
            border: "1px solid rgba(255, 255, 255, 0.5)",
            boxShadow: "0 8px 40px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)",
            overflow: "hidden",
            transition: "all 0.4s ease",
          }}
        >
          {/* Status Icon Section */}
          <div
            style={{
              padding: "48px 32px 32px",
              textAlign: "center",
              position: "relative",
            }}
          >
            {/* Accent glow behind icon */}
            <div
              style={{
                position: "absolute",
                top: 30,
                left: "50%",
                transform: "translateX(-50%)",
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: config.accentLight,
                filter: "blur(30px)",
                transition: "background 0.6s ease",
              }}
            />

            {/* Icon circle */}
            <div
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 88,
                height: 88,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.8)",
                border: `2px solid ${config.accentLight}`,
                boxShadow: `0 4px 20px ${config.accentLight}`,
                marginBottom: 24,
                transition: "all 0.4s ease",
              }}
            >
              {status === "loading" || status === "created" ? (
                <div
                  style={{
                    width: 36,
                    height: 36,
                    border: `3px solid ${config.accentLight}`,
                    borderTopColor: config.accentColor,
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
              ) : (
                <span style={{ fontSize: "2.5rem", lineHeight: 1 }}>{config.icon}</span>
              )}
            </div>

            {/* Title */}
            <h1
              style={{
                margin: "0 0 8px",
                fontWeight: 800,
                fontSize: "1.6rem",
                color: "#0f172a",
                letterSpacing: "-0.02em",
                lineHeight: 1.3,
              }}
            >
              {config.title}
            </h1>

            {/* Subtitle */}
            <p
              style={{
                margin: 0,
                color: "#64748b",
                fontSize: "0.92rem",
                lineHeight: 1.6,
                maxWidth: 360,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {config.subtitle}
            </p>
          </div>

          {/* Details Section */}
          {(details?.amount || status === "created") && (
            <div style={{ padding: "0 32px 32px" }}>
              {/* Verifying spinner */}
              {status === "created" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    padding: "14px 20px",
                    borderRadius: 14,
                    background: "rgba(245, 158, 11, 0.08)",
                    border: "1px solid rgba(245, 158, 11, 0.15)",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      border: "2px solid rgba(245, 158, 11, 0.2)",
                      borderTopColor: "#f59e0b",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  <span style={{ color: "#92400e", fontSize: "0.85rem", fontWeight: 600 }}>
                    Confirming with Razorpay...
                  </span>
                </div>
              )}

              {/* Amount & Assessment Card */}
              {details?.amount && (
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.6)",
                    backdropFilter: "blur(10px)",
                    borderRadius: 16,
                    border: "1px solid rgba(255, 255, 255, 0.5)",
                    padding: "20px 24px",
                    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: details.assessmentName ? 12 : 0 }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Amount Paid
                    </span>
                    <span style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8", marginRight: 4 }}>INR</span>
                      {details.amount}
                    </span>
                  </div>
                  {details.assessmentName && (
                    <div
                      style={{
                        paddingTop: 12,
                        borderTop: "1px solid rgba(226, 232, 240, 0.6)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Assessment
                      </span>
                      <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "#334155" }}>
                        {details.assessmentName}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Conditional Bottom Sections */}
          {status === "paid" && (
            <div
              style={{
                padding: "20px 32px 28px",
                borderTop: "1px solid rgba(226, 232, 240, 0.4)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: 12,
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.15)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
                <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#065f46" }}>
                  Login credentials sent to your email
                </span>
              </div>
            </div>
          )}

          {status === "failed" && (
            <div
              style={{
                padding: "20px 32px 28px",
                borderTop: "1px solid rgba(226, 232, 240, 0.4)",
                textAlign: "center",
              }}
            >
              <p style={{ color: "#94a3b8", fontSize: "0.82rem", margin: 0, lineHeight: 1.6 }}>
                If the amount was deducted, it will be refunded within <strong style={{ color: "#64748b" }}>5-7 business days</strong>.
                <br />A retry link has been sent to your email.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 28 }}>
          <p style={{ color: "#94a3b8", fontSize: "0.75rem", margin: 0 }}>
            Powered by <strong style={{ color: "#64748b" }}>Career-9</strong> &middot; Secure payments by <strong style={{ color: "#64748b" }}>Razorpay</strong>
          </p>
        </div>
      </div>

      {/* CSS animation for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PaymentStatusPage;
