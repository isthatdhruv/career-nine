import { useEffect, useState, useRef } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import http from "../api/http"

type PaymentStatus = "paid" | "created" | "failed" | "expired" | "cancelled" | "loading" | "error"

const statusConfig: Record<string, {
  title: string
  subtitle: string
  icon: string
  accentColor: string
  accentLight: string
  gradientOrb1: string
  gradientOrb2: string
}> = {
  paid: {
    title: "Payment Successful!",
    subtitle: "Your assessment has been allotted. Redirecting you in a moment...",
    icon: "✅",
    accentColor: "#10b981",
    accentLight: "rgba(16, 185, 129, 0.12)",
    gradientOrb1: "radial-gradient(circle at 20% 50%, rgba(16, 185, 129, 0.15) 0%, transparent 50%)",
    gradientOrb2: "radial-gradient(circle at 80% 20%, rgba(52, 211, 153, 0.1) 0%, transparent 50%)",
  },
  created: {
    title: "Verifying Payment...",
    subtitle: "We're confirming your payment with Razorpay. This usually takes a few seconds.",
    icon: "⏳",
    accentColor: "#f59e0b",
    accentLight: "rgba(245, 158, 11, 0.12)",
    gradientOrb1: "radial-gradient(circle at 20% 50%, rgba(245, 158, 11, 0.15) 0%, transparent 50%)",
    gradientOrb2: "radial-gradient(circle at 80% 20%, rgba(251, 191, 36, 0.1) 0%, transparent 50%)",
  },
  failed: {
    title: "Payment Failed",
    subtitle: "Something went wrong with your payment. Please try again using the link sent to your email.",
    icon: "❌",
    accentColor: "#ef4444",
    accentLight: "rgba(239, 68, 68, 0.12)",
    gradientOrb1: "radial-gradient(circle at 20% 50%, rgba(239, 68, 68, 0.12) 0%, transparent 50%)",
    gradientOrb2: "radial-gradient(circle at 80% 20%, rgba(248, 113, 113, 0.08) 0%, transparent 50%)",
  },
  expired: {
    title: "Payment Link Expired",
    subtitle: "This payment link has expired. Please contact the administrator for a new link.",
    icon: "⏰",
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
    icon: "⚠️",
    accentColor: "#f59e0b",
    accentLight: "rgba(245, 158, 11, 0.12)",
    gradientOrb1: "radial-gradient(circle at 20% 50%, rgba(245, 158, 11, 0.12) 0%, transparent 50%)",
    gradientOrb2: "radial-gradient(circle at 80% 20%, rgba(251, 191, 36, 0.08) 0%, transparent 50%)",
  },
}

const PaymentStatusPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<PaymentStatus>("loading")
  const [details, setDetails] = useState<any>(null)
  const pollCount = useRef(0)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Cached on every successful poll so the fallback redirect can still build
  // a self-contained /studentAssessment/completed?... URL even when polling
  // exhausts (Razorpay unreachable and webhook hasn't landed).
  const lastSeenAssessmentId = useRef<number | null>(null)
  const lastSeenUserStudentId = useRef<number | null>(null)

  useEffect(() => {
    const linkId = searchParams.get("razorpay_payment_link_id")
    const isUpgrade = searchParams.get("upgrade") === "1"
    const eid = searchParams.get("eid")
    const urlSaysPaid = searchParams.get("razorpay_payment_link_status") === "paid"

    if (!linkId) {
      setStatus("error")
      return
    }

    // Builds /studentAssessment/completed?e=…&userStudentId=…&assessmentId=…
    // from whatever we have. ThankYouPage reads all three keys and seeds
    // localStorage on mount, so passing them in the URL keeps the flow
    // resilient to fresh tabs, incognito, or any localStorage gap.
    const buildCompletedUrl = (
      userStudentId?: number | string | null,
      assessmentId?: number | string | null,
    ) => {
      const params = new URLSearchParams({ e: String(eid) })
      if (userStudentId != null) params.set("userStudentId", String(userStudentId))
      if (assessmentId != null) params.set("assessmentId", String(assessmentId))
      return `/studentAssessment/completed?${params.toString()}`
    }

    // Upgrade-path safety net: if polling exhausts without ever seeing "paid"
    // from the DB but Razorpay's redirect URL claims paid, still send the
    // student to the completed page. The reconcile=1 call below normally
    // makes this unnecessary, but it's the last-ditch escape hatch when
    // Razorpay's API itself is unreachable from the backend.
    const navigateToCompletedIfUpgrade = () => {
      if (isUpgrade && eid && urlSaysPaid) {
        localStorage.setItem("entitlementId", eid)
        if (lastSeenUserStudentId.current != null) {
          localStorage.setItem("userStudentId", String(lastSeenUserStudentId.current))
        }
        if (lastSeenAssessmentId.current != null) {
          localStorage.setItem("assessmentId", String(lastSeenAssessmentId.current))
        }
        setStatus("paid")
        setTimeout(
          () => navigate(
            buildCompletedUrl(lastSeenUserStudentId.current, lastSeenAssessmentId.current),
            { replace: true },
          ),
          1200,
        )
        return true
      }
      return false
    }

    const pollStatus = () => {
      // On the very first request, ask the backend to reconcile against
      // Razorpay if the DB is still "created" — this short-circuits the
      // 30-second poll loop when the webhook is delayed or misconfigured.
      const url = pollCount.current === 0 && urlSaysPaid
        ? `/payment/webhook/status/${linkId}?reconcile=1`
        : `/payment/webhook/status/${linkId}`

      http
        .get(url)
        .then((res) => {
          const data = res.data
          setDetails(data)
          // Cache the latest known ids so the fallback path can use them.
          if (data?.assessmentId != null) lastSeenAssessmentId.current = data.assessmentId
          if (data?.userStudentId != null) lastSeenUserStudentId.current = data.userStudentId

          if (data.status === "paid" && isUpgrade && eid) {
            // Try-First upgrade: student already logged in. Stamp all three
            // ids into both the redirect URL and localStorage so ThankYouPage
            // picks them up regardless of whether it reads URL or storage first.
            localStorage.setItem("entitlementId", eid)
            if (data.userStudentId != null) {
              localStorage.setItem("userStudentId", String(data.userStudentId))
            }
            if (data.assessmentId != null) {
              localStorage.setItem("assessmentId", String(data.assessmentId))
            }
            setStatus("paid")
            setTimeout(
              () => navigate(
                buildCompletedUrl(data.userStudentId, data.assessmentId),
                { replace: true },
              ),
              1500,
            )
            return
          }

          if (data.status === "paid" && data.userStudentId && data.assessments) {
            // Auto-login: webhook completed AND student was provisioned.
            localStorage.clear()
            localStorage.setItem("userStudentId", String(data.userStudentId))
            localStorage.setItem("allottedAssessments", JSON.stringify(data.assessments))
            setStatus("paid")
            setTimeout(() => navigate("/allotted-assessment"), 1500)
            return
          }

          if (data.status === "paid") {
            // Webhook says paid but provisioning is still racing. Keep polling so we
            // can pick up userStudentId once it lands.
            pollCount.current += 1
            if (pollCount.current < 15) {
              pollTimer.current = setTimeout(pollStatus, 2000)
              setStatus("created")
            } else {
              // Provisioning didn't catch up. Show the "Payment Successful!" card
              // without auto-redirect. Email with credentials has already been sent
              // (Path A: from welcome email; covered by issue #5 in the audit).
              setStatus("paid")
            }
            return
          }

          if (data.status !== "created") {
            setStatus(data.status as PaymentStatus)
            return
          }

          // status === "created" — keep polling
          pollCount.current += 1
          if (pollCount.current < 15) {
            pollTimer.current = setTimeout(pollStatus, 2000)
            setStatus("created")
          } else if (!navigateToCompletedIfUpgrade()) {
            // Path A fallback: polling exhausted without the txn ever flipping
            // to "paid" in DB. If Razorpay's redirect URL says paid, the
            // webhook is just delayed and the welcome email with credentials
            // is already sent — surface a graceful "we're confirming, check
            // your email" state with a Continue-to-Login CTA (rendered below).
            // If the URL doesn't say paid, fall back to the original
            // "verifying" state so the student knows the payment isn't
            // confirmed.
            setStatus(urlSaysPaid ? "paid" : "created")
          }
        })
        .catch(() => {
          // API error (404, network) — keep retrying instead of showing error immediately
          pollCount.current += 1
          if (pollCount.current < 15) {
            setStatus("created")
            pollTimer.current = setTimeout(pollStatus, 2000)
          } else if (!navigateToCompletedIfUpgrade()) {
            setStatus(urlSaysPaid ? "paid" : "error")
          }
        })
    }

    pollStatus()

    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [searchParams, navigate])

  const config = statusConfig[status] || statusConfig.failed

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
                  Sign-in link & credentials sent to your email
                </span>
              </div>
              {/* Path A fallback CTA: when polling exhausted without webhook
                  provisioning, the auto-redirect to /allotted-assessment never
                  fires. Give the student a clear way forward — they can sign
                  in with the credentials we already emailed (welcome email is
                  fired from EntitlementService.sendWelcomeAssessmentLink
                  before the webhook even returns). */}
              {pollCount.current >= 15 && (
                <div style={{ marginTop: 16 }}>
                  <button
                    onClick={() => navigate("/student-login", { replace: true })}
                    style={{
                      padding: "10px 22px",
                      borderRadius: 10,
                      border: "none",
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#fff",
                      fontSize: "0.88rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(16, 185, 129, 0.32)",
                    }}
                  >
                    Continue to sign-in
                  </button>
                  <p style={{
                    margin: "10px 0 0",
                    color: "#94a3b8",
                    fontSize: "0.75rem",
                    lineHeight: 1.5,
                  }}>
                    Use the credentials from your welcome email, or click the
                    magic link in the email to skip sign-in.
                  </p>
                </div>
              )}
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
  )
}

export default PaymentStatusPage
