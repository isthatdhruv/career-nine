import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { showErrorToast } from "../utils/toast"
import {
  getInviteInfoByToken,
  registerInviteByToken,
  InviteInfo,
} from "../api-clients/assessmentMappingAPI"
import { TierStrip, Tier } from "../components/TierCard"
import ParentalConsentSection from "../components/ParentalConsent"
import RegisterShell, { SignInNote } from "../components/RegisterShell"
import { rs } from "../styles/registerStyles"
import { contactTerms } from "../utils/instituteTerms"

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
  // DPDP parental consent — a NEW registration cannot proceed without it (an
  // already-enrolled student continuing to their assessment is not gated).
  const [dpdpConsent, setDpdpConsent] = useState(false)

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
  // The invite is bound to one mapped cohort, so the audience is page-constant.
  const adult = !!info?.audience18Plus
  const { emailLabel, phoneLabel } = contactTerms(adult)

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
    if (!info.alreadyRegistered && !dpdpConsent) {
      showErrorToast(
        adult
          ? "Please confirm the consent to continue."
          : "Please confirm the parental consent to continue."
      )
      return
    }
    setSubmitting(true)
    try {
      // DPDP parental consent travels with the confirm (gated above for new registrations).
      const res = await registerInviteByToken(token, { dpdpConsent })

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
      <RegisterShell narrow>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px", gap: 16 }}>
          <div style={s.spinner} />
          <p style={{ color: "#64748b", fontSize: "0.95rem", margin: 0 }}>Loading assessment information...</p>
        </div>
      </RegisterShell>
    )
  }

  // ── Error / Closed ──
  if (error || registrationClosed) {
    const closed = registrationClosed && !error
    return (
      <RegisterShell narrow>
        <div style={{ textAlign: "center", padding: "28px 8px" }}>
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
      </RegisterShell>
    )
  }

  const alreadyRegistered = info?.alreadyRegistered === true

  // ── Invite card ──
  const footer = (
    <>
      {!alreadyRegistered && <SignInNote />}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="reg-footer-btn"
        style={{ ...s.btnPrimary, opacity: submitting ? 0.7 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
      >
        {submitting
          ? "Processing..."
          : alreadyRegistered
            ? "Continue to Assessment"
            : payableInr > 0
              ? `Register & Pay ₹${payableInr.toLocaleString("en-IN")}`
              : "Register & Start"}
      </button>
    </>
  )

  return (
    <RegisterShell
      eyebrow="Assessment Registration"
      logoUrl={branding?.whitelabel ? branding.logoUrl : undefined}
      title={info?.assessmentName || "Assessment"}
      subtitle={info?.instituteName || undefined}
      footer={footer}
    >
      {selectionTier && <TierStrip tier={selectionTier} />}

      {/* Pre-filled details (read-only) */}
      <div>
        <div className="reg-section-title">Your details</div>
        <div className="reg-grid">
          <Field label="Full Name" value={info?.student?.name} />
          <Field label={emailLabel} value={info?.student?.email} />
          <Field label={phoneLabel} value={info?.student?.phone} />
          <Field label="Date of Birth" value={info?.student?.dob} />

          {/* PAY_FIRST counselling itemisation */}
          {isPayFirst && counsellingFeePerSession > 0 && counsellingFeeTotal > 0 && (
            <div className="reg-span2" style={{
              background: "linear-gradient(135deg, #eef2ff, #f5f3ff)", border: "1.5px solid #c7d2fe",
              borderRadius: 12, padding: "12px 16px", fontSize: "0.88rem", color: "#3730a3",
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
            <div className="reg-span2" style={{
              background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)", border: "1.5px solid #a7f3d0",
              borderRadius: 12, padding: "10px 16px", fontSize: "0.88rem", color: "#065f46",
            }}>
              You are already enrolled in this assessment — continue to start.
            </div>
          )}
        </div>
      </div>

      {!alreadyRegistered && (
        <ParentalConsentSection checked={dpdpConsent} onChange={setDpdpConsent} adult={adult} />
      )}

      <p className="reg-hint" style={{ margin: 0, textAlign: "center" }}>
        By registering, I agree to the Career-9's terms and conditions.
      </p>
    </RegisterShell>
  )
}

const Field = ({ label, value }: { label: string; value?: string | null }) => (
  <div>
    <label style={s.label}>{label}</label>
    <div style={s.readonlyValue}>{value || "—"}</div>
  </div>
)

// ── Styles (shared with the other registration pages) ──
const s = rs

export default AssessmentInviteRegisterPage
