import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { showErrorToast } from "../utils/toast"
import {
  getInviteInfoByToken,
  registerInviteByToken,
  InviteInfo,
} from "../api-clients/assessmentMappingAPI"
import { TierCard, Tier } from "../components/TierCard"

/**
 * Student-locked invite registration. The link is bound to one already-known
 * student, so the form is PRE-FILLED and identity fields are read-only. The
 * student confirms, pays the chosen tier's price (PAY_FIRST → Razorpay), and is
 * taken into the assessment — reusing the same payment + provisioning pipeline
 * as the public registration page.
 */
const AssessmentInviteRegisterPage = () => {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) return
    getInviteInfoByToken(token)
      .then((res) => {
        setInfo(res.data)
        setLoading(false)
      })
      .catch(() => {
        setError("Invalid or expired assessment link.")
        setLoading(false)
      })
  }, [token])

  const branding = info?.branding
  const payableInr = info?.payableTotal ?? info?.amount ?? 0
  const counsellingFeePerSession = info?.counsellingFeePerSession || 0
  const counsellingSessionCount = info?.counsellingSessionCount || 0
  const counsellingFeeTotal = info?.counsellingFeeTotal || 0
  const isPayFirst = (info?.paymentTiming ?? "PAY_FIRST") === "PAY_FIRST"
  const registrationClosed = info?.registrationClosed === true || info?.status === "REVOKED"

  const inc = info?.inclusions
  const selectionTier: Tier | null = info
    ? {
        campaignAssessmentTierId: 0,
        name: info.tierName || info.assessmentName || "Assessment",
        basePriceInr: payableInr,
        priceInr: payableInr,
        isDefault: false,
        includesFinalReport: !!inc?.includesFinalReport,
        includesDashboard: !!inc?.includesDashboard,
        includesCounselling: !!inc?.includesCounselling,
        counsellingSessionCount: inc?.counsellingSessionCount ?? null,
        includesLms: !!inc?.includesLms,
        lmsValidityDays: inc?.lmsValidityDays ?? null,
        dashboardValidityDays: inc?.dashboardValidityDays ?? null,
      }
    : null

  const handleSubmit = async () => {
    if (!token || !info) return
    setSubmitting(true)
    try {
      const res = await registerInviteByToken(token)

      if (res.data.status === "payment_required") {
        if (res.data.paymentUrl) {
          window.location.href = res.data.paymentUrl
        } else {
          showErrorToast("Payment link could not be generated. Please try again.")
        }
        return
      }

      // Auto-login: backend returned a session payload → straight to assessments.
      if (res.data.userStudentId && res.data.assessments) {
        localStorage.clear()
        localStorage.setItem("userStudentId", String(res.data.userStudentId))
        localStorage.setItem("allottedAssessments", JSON.stringify(res.data.assessments))
        if (info.student?.dob) localStorage.setItem("studentDob", info.student.dob)
        navigate("/allotted-assessment")
        return
      }

      showErrorToast("Something went wrong. Please try again.")
    } catch (err: any) {
      const raw = err.response?.data?.message || err.response?.data || "Registration failed. Please try again."
      showErrorToast(typeof raw === "string" ? raw : "Registration failed.")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div style={s.page}>
        <style>{keyframes}</style>
        <div style={s.glassCard}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px", gap: 16 }}>
            <div style={s.spinner} />
            <p style={{ color: "#64748b", fontSize: "0.95rem", margin: 0 }}>Loading assessment information...</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Error / Closed ──
  if (error || registrationClosed) {
    const closed = registrationClosed && !error
    return (
      <div style={s.page}>
        <style>{keyframes}</style>
        <div style={s.glassCard}>
          <div style={{ textAlign: "center", padding: "48px 32px" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", margin: "0 auto 20px",
              background: closed ? "linear-gradient(135deg, #fef3c7, #fde68a)" : "linear-gradient(135deg, #fee2e2, #fecaca)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem",
              color: closed ? "#92400e" : "#b91c1c",
            }}>
              {closed ? "⏳" : "!"}
            </div>
            <h3 style={{ color: "#1e293b", fontWeight: 700, marginBottom: 12 }}>
              {closed ? "Link No Longer Active" : "Link Unavailable"}
            </h3>
            <p style={{ color: "#64748b", fontSize: "0.92rem", lineHeight: 1.6, maxWidth: 400, margin: "0 auto" }}>
              {closed
                ? "This invite link has been closed or revoked. Please contact your administrator for a new link."
                : `${error} Please contact your administrator for a valid link.`}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const alreadyRegistered = info?.alreadyRegistered === true

  // ── Invite card ──
  return (
    <div style={s.page}>
      <style>{keyframes}</style>
      <div style={s.glassCard}>
        {/* Header */}
        <div style={s.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 12px rgba(52, 211, 153, 0.5)" }} />
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Assessment Registration
            </span>
          </div>
          {branding?.whitelabel && branding?.logoUrl && (
            <img src={branding.logoUrl} alt={(branding.schoolName || "School") + " logo"}
              style={{ maxHeight: 56, maxWidth: 180, objectFit: "contain", display: "block", marginBottom: 10 }} />
          )}
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: "clamp(1.3rem, 4vw, 1.6rem)", color: "#0f172a", lineHeight: 1.2 }}>
            {info?.assessmentName || "Assessment"}
          </h2>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: "0.88rem" }}>
            {info?.instituteName || ""}
          </p>

          {selectionTier && (
            <div style={{ marginTop: 18 }}>
              <div style={s.selectionLabel}>Your selection</div>
              <TierCard tier={selectionTier} selected disabled onSelect={() => {}} />
            </div>
          )}
        </div>

        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #e2e8f0, transparent)", margin: "0 32px" }} />

        {/* Pre-filled details (read-only) */}
        <div style={{ padding: "28px 32px 32px" }}>
          <div style={s.selectionLabel}>Your details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginTop: 12 }}>
            <Field label="Full Name" value={info?.student?.name} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Email" value={info?.student?.email} />
              <Field label="Date of Birth" value={info?.student?.dob} />
            </div>
            <Field label="Phone Number" value={info?.student?.phone} />
          </div>

          {/* PAY_FIRST counselling itemisation */}
          {isPayFirst && counsellingFeePerSession > 0 && counsellingFeeTotal > 0 && (
            <div style={{
              background: "linear-gradient(135deg, #eef2ff, #f5f3ff)", border: "1.5px solid #c7d2fe",
              borderRadius: 12, padding: "14px 18px", fontSize: "0.88rem", color: "#3730a3", marginTop: 20,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span>Assessment</span><strong>₹{(info?.amount || 0).toLocaleString("en-IN")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span>Counselling (₹{counsellingFeePerSession.toLocaleString("en-IN")} × {counsellingSessionCount})</span>
                <strong>₹{counsellingFeeTotal.toLocaleString("en-IN")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #c7d2fe", paddingTop: 6, marginTop: 2, fontSize: "0.95rem" }}>
                <span style={{ fontWeight: 700 }}>Total</span>
                <strong style={{ fontWeight: 800 }}>₹{payableInr.toLocaleString("en-IN")}</strong>
              </div>
            </div>
          )}

          {alreadyRegistered && (
            <div style={{
              background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)", border: "1.5px solid #a7f3d0",
              borderRadius: 12, padding: "12px 18px", fontSize: "0.88rem", color: "#065f46", marginTop: 20,
            }}>
              You are already enrolled in this assessment — continue to start.
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ ...s.btnPrimary, width: "100%", marginTop: 24, opacity: submitting ? 0.7 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
          >
            {submitting
              ? "Processing..."
              : alreadyRegistered
                ? "Continue to Assessment"
                : payableInr > 0
                  ? `Register & Pay ₹${payableInr.toLocaleString("en-IN")}`
                  : "Register & Start"}
          </button>

          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.78rem", marginTop: 16, marginBottom: 0 }}>
            By registering, you agree to the assessment terms and conditions.
          </p>
        </div>
      </div>

      <div style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        fontSize: "0.72rem", color: "rgba(100, 116, 139, 0.5)", fontWeight: 500, letterSpacing: "0.05em",
      }}>
        CAREER-9
      </div>
    </div>
  )
}

const Field = ({ label, value }: { label: string; value?: string | null }) => (
  <div>
    <label style={s.label}>{label}</label>
    <div style={s.readonlyValue}>{value || "—"}</div>
  </div>
)

const keyframes = `
  @keyframes spin { to { transform: rotate(360deg); } }
`

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(145deg, #f0fdf4 0%, #ecfeff 30%, #f0f9ff 60%, #faf5ff 100%)",
    padding: "24px 16px", position: "relative", overflow: "hidden",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  glassCard: {
    width: "100%", maxWidth: 560, background: "rgba(255, 255, 255, 0.72)",
    backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 24,
    border: "1px solid rgba(255, 255, 255, 0.6)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)",
    overflow: "hidden", position: "relative", zIndex: 1,
  },
  header: { padding: "32px 32px 24px" },
  selectionLabel: {
    fontSize: "0.72rem", fontWeight: 700, color: "#10b981", textTransform: "uppercase",
    letterSpacing: "0.06em", marginBottom: 8,
  },
  label: { display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: 6 },
  readonlyValue: {
    width: "100%", padding: "12px 16px", borderRadius: 12, border: "1.5px solid #e2e8f0",
    background: "rgba(241, 245, 249, 0.7)", fontSize: "0.92rem", color: "#1e293b",
    boxSizing: "border-box" as const, fontWeight: 600,
  },
  btnPrimary: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "14px 32px",
    borderRadius: 14, border: "none",
    background: "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)",
    color: "#fff", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer",
    boxShadow: "0 4px 16px rgba(16, 185, 129, 0.35)", letterSpacing: "0.01em",
  },
  spinner: {
    width: 32, height: 32, border: "3px solid #e2e8f0", borderTopColor: "#10b981",
    borderRadius: "50%", animation: "spin 0.8s linear infinite",
  },
}

export default AssessmentInviteRegisterPage
