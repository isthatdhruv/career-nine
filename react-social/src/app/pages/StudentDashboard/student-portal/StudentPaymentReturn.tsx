import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCheckoutStatus } from "./checkoutApi";

const STASH_KEY = "c9_pending_dashboard_checkout";
const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 40; // ~2 minutes

type Phase = "confirming" | "paid" | "failed" | "timeout" | "missing";

/**
 * Landing page after a student returns from Razorpay for a dashboard purchase.
 * Polls the payment status (which reconciles + provisions the entitlement even
 * if the webhook is delayed); once paid, routes into the now-unlocked dashboard.
 */
const StudentPaymentReturn: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [phase, setPhase] = useState<Phase>("confirming");
  const [detail, setDetail] = useState<string>("");
  const attemptsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Razorpay appends razorpay_payment_link_id to the callback; fall back to the
  // id we stashed before redirecting.
  const linkId =
    (params.get("razorpay_payment_link_id") || "").trim() ||
    (() => {
      try {
        return localStorage.getItem(STASH_KEY) || "";
      } catch {
        return "";
      }
    })();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
    if (!linkId) {
      setPhase("missing");
      return;
    }

    let cancelled = false;

    const clearStash = () => {
      try {
        localStorage.removeItem(STASH_KEY);
      } catch {
        /* ignore */
      }
    };

    const poll = () => {
      attemptsRef.current += 1;
      getCheckoutStatus(linkId)
        .then((res) => {
          if (cancelled) return;
          const status = res.data?.status;
          if (status === "paid") {
            clearStash();
            setPhase("paid");
            // Brief pause so the student sees the success state, then into the
            // unlocked dashboard.
            timerRef.current = setTimeout(() => navigate("/student/insight"), 1400);
            return;
          }
          if (status === "failed" || status === "expired" || status === "cancelled") {
            clearStash();
            setPhase("failed");
            setDetail(res.data?.failureReason || `Payment ${status}.`);
            return;
          }
          // still "created" — keep polling until the budget runs out.
          if (attemptsRef.current >= MAX_ATTEMPTS) {
            setPhase("timeout");
            return;
          }
          timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        })
        .catch(() => {
          if (cancelled) return;
          if (attemptsRef.current >= MAX_ATTEMPTS) {
            setPhase("timeout");
            return;
          }
          timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        });
    };

    poll();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [linkId, navigate]);

  const wrap: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f6f8f7",
    fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
    padding: 24,
  };
  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: "36px 32px",
    maxWidth: 460,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 8px 28px rgba(16,24,40,0.08)",
  };
  const btn: React.CSSProperties = {
    marginTop: 18,
    background: "#1a6b3c",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "11px 20px",
    fontWeight: 700,
    cursor: "pointer",
  };

  return (
    <div style={wrap}>
      <div style={card}>
        {phase === "confirming" && (
          <>
            <div
              style={{
                width: 40,
                height: 40,
                border: "4px solid #e5e7eb",
                borderTopColor: "#1a6b3c",
                borderRadius: "50%",
                margin: "0 auto 18px",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <h2 style={{ margin: "0 0 6px" }}>Confirming your payment…</h2>
            <p style={{ color: "#6b7280", margin: 0 }}>
              This usually takes a few seconds. Please don't close this window.
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        )}

        {phase === "paid" && (
          <>
            <div style={{ fontSize: 44, color: "#059669" }}>
              <i className="bi bi-check-circle-fill" />
            </div>
            <h2 style={{ margin: "12px 0 6px" }}>Payment successful!</h2>
            <p style={{ color: "#6b7280", margin: 0 }}>Unlocking your dashboard…</p>
          </>
        )}

        {(phase === "failed" || phase === "timeout" || phase === "missing") && (
          <>
            <div style={{ fontSize: 44, color: phase === "failed" ? "#ef4444" : "#f59e0b" }}>
              <i className={phase === "failed" ? "bi bi-x-circle-fill" : "bi bi-hourglass-split"} />
            </div>
            <h2 style={{ margin: "12px 0 6px" }}>
              {phase === "failed"
                ? "Payment not completed"
                : phase === "missing"
                ? "Nothing to confirm"
                : "Still processing"}
            </h2>
            <p style={{ color: "#6b7280", margin: 0 }}>
              {phase === "failed"
                ? detail || "Your payment didn't go through. You can try again from the plans page."
                : phase === "missing"
                ? "We couldn't find a payment to confirm. Head back to your dashboard."
                : "Your payment is taking longer than usual to confirm. If you were charged, your dashboard will unlock shortly — you can check again from your dashboard."}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button style={btn} onClick={() => navigate("/student/dashboard")}>
                Back to dashboard
              </button>
              {(phase === "timeout") && (
                <button
                  style={{ ...btn, background: "#374151" }}
                  onClick={() => navigate("/student/insight")}
                >
                  Open dashboard
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StudentPaymentReturn;
