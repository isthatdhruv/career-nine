import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { showErrorToast } from "../utils/toast"
import {
  getUpgradeInfo,
  payForUpgrade,
  UpgradeInfo,
} from "../api-clients/assessmentMappingAPI"

/**
 * B2B upgrade screen. Mirrors PayForReportPage but for an institute-mapping
 * entitlement: there is no tier picker — a single resolved upgrade price is
 * shown along with the services it adds (the tier's inclusions minus whatever
 * the entitlement already has active). On confirm it POSTs pay-for-upgrade and
 * redirects to the Razorpay payment URL.
 */
const AssessmentUpgradePage = () => {
  const { entitlementId } = useParams<{ entitlementId: string }>()
  const navigate = useNavigate()

  const [info, setInfo] = useState<UpgradeInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  useEffect(() => {
    if (!entitlementId) {
      setLoadError("Invalid link.")
      setLoading(false)
      return
    }
    getUpgradeInfo(entitlementId)
      .then((res) => {
        setInfo(res.data)
        setLoading(false)
      })
      .catch(() => {
        setLoadError("Invalid or expired link.")
        setLoading(false)
      })
  }, [entitlementId])

  // Services the upgrade ADDS = tier inclusions the entitlement does not
  // already have active. This keeps the upsell honest (no charging for what's
  // already unlocked).
  const addedServices: string[] = (() => {
    if (!info?.inclusions) return []
    const inc = info.inclusions
    const cur = info.current
    const lines: string[] = []
    if (inc.includesFinalReport && !cur.finalReportActive) {
      lines.push("Detailed report")
    }
    if (inc.includesDashboard && !cur.dashboardActive) {
      lines.push(
        inc.dashboardValidityDays
          ? `Dashboard (${inc.dashboardValidityDays} days)`
          : "Dashboard access"
      )
    }
    if (inc.includesCounselling && !cur.counsellingActive && inc.counsellingSessionCount) {
      lines.push(
        `${inc.counsellingSessionCount}× counselling session${
          inc.counsellingSessionCount > 1 ? "s" : ""
        }`
      )
    }
    if (inc.includesLms && !cur.lmsActive) {
      lines.push(inc.lmsValidityDays ? `LMS (${inc.lmsValidityDays} days)` : "LMS access")
    }
    return lines
  })()

  const amountInr = info?.amount ?? 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!info) return
    setFormError("")
    setSubmitting(true)
    try {
      const res = await payForUpgrade(info.entitlementId)
      if (res.data.status === "payment_required" && res.data.paymentUrl) {
        window.location.href = res.data.paymentUrl
        return
      }
      showErrorToast("Could not start payment. Please try again.")
    } catch (err: any) {
      const raw = err.response?.data || "Failed to start payment."
      const msg = typeof raw === "string" ? raw : raw.message || "Failed to start payment."
      if (err.response?.status === 400) setFormError(msg)
      else showErrorToast(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>Loading…</div>
        </div>
      </div>
    )
  }

  if (loadError || !info) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ textAlign: "center", padding: "48px 32px" }}>
            <div style={s.errorOrb}>!</div>
            <h3 style={{ color: "#1e293b", fontWeight: 700, marginBottom: 12 }}>Link Unavailable</h3>
            <p style={{ color: "#64748b", fontSize: "0.92rem", lineHeight: 1.6 }}>
              {loadError || "Could not load this link."}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // No upgrade available — already maxed out, or institute hasn't configured one.
  if (!info.available) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ textAlign: "center", padding: "48px 32px" }}>
            <div style={s.successOrb}>✓</div>
            <h3 style={{ color: "#0f172a", fontWeight: 800, marginBottom: 12, fontSize: "1.4rem" }}>
              No upgrade available
            </h3>
            <p style={{ color: "#64748b", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 24 }}>
              {info.assessmentName
                ? `There is no upgrade available for ${info.assessmentName} right now.`
                : "There is no upgrade available for this entitlement right now."}
            </p>
            <button onClick={() => navigate("/studentAssessment/completed")} style={s.btnPrimary}>
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <span style={s.pillLabel}>Upgrade</span>
          <h2 style={s.title}>{info.tierName || "Upgrade your access"}</h2>
          <p style={s.subtitle}>
            Add more to your{" "}
            <strong>{info.assessmentName || "assessment"}</strong> package.
          </p>
        </div>

        <div style={s.divider} />

        <form onSubmit={handleSubmit} style={{ padding: "24px 32px 32px" }}>
          {formError && (
            <div style={s.errorBanner}>
              <div style={s.errorBannerIcon}>!</div>
              <span style={s.errorBannerText}>{formError}</span>
              <button type="button" onClick={() => setFormError("")} style={s.errorBannerClose}>×</button>
            </div>
          )}

          <h3 style={s.sectionTitle}>What you'll get</h3>
          {addedServices.length > 0 ? (
            <ul style={s.featureList}>
              {addedServices.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : (
            <div style={s.detailsBox}>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
                This upgrade extends your current access.
              </p>
            </div>
          )}

          <div style={s.totalBar}>
            <span style={{ color: "#64748b", fontWeight: 600 }}>Total</span>
            <strong style={{ color: "#0f172a", fontSize: "1.25rem" }}>INR {amountInr}</strong>
          </div>

          <button
            type="submit"
            disabled={submitting || amountInr <= 0}
            style={{ ...s.btnPrimary, width: "100%", marginTop: 24, opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? "Processing…" : `Pay INR ${amountInr}`}
          </button>
        </form>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "linear-gradient(160deg, #f0fdf4 0%, #ecfdf5 25%, #f0f9ff 50%, #faf5ff 100%)",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  card: {
    background: "rgba(255,255,255,0.92)",
    borderRadius: 24,
    boxShadow: "0 8px 40px rgba(0,0,0,0.07)",
    width: "100%",
    maxWidth: 560,
    overflow: "hidden",
  },
  header: { padding: "32px 32px 16px", textAlign: "center" },
  pillLabel: {
    fontSize: "0.75rem", fontWeight: 700, color: "#10b981",
    textTransform: "uppercase", letterSpacing: "0.08em",
  },
  title: { margin: "8px 0 0", fontWeight: 800, fontSize: "1.6rem", color: "#0f172a" },
  subtitle: { margin: "10px 0 0", color: "#64748b", fontSize: "0.95rem" },
  divider: { height: 1, background: "linear-gradient(90deg, transparent, #e2e8f0, transparent)" },
  sectionTitle: {
    fontSize: "0.78rem", fontWeight: 700, color: "#94a3b8",
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12,
  },
  detailsBox: {
    background: "#f8fafc", border: "1px solid #e2e8f0",
    borderRadius: 14, padding: "14px 18px",
  },
  featureList: {
    margin: 0,
    paddingLeft: 18,
    color: "#475569",
    fontSize: "0.92rem",
    lineHeight: 1.8,
  },
  totalBar: {
    marginTop: 24, padding: "14px 18px",
    background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12,
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  btnPrimary: {
    border: "none",
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "white", fontWeight: 700, fontSize: "0.95rem",
    padding: "13px 22px", borderRadius: 12, cursor: "pointer",
  },
  errorBanner: {
    display: "flex", alignItems: "flex-start", gap: 10,
    background: "linear-gradient(135deg, #fef2f2, #fff7f7)",
    border: "1.5px solid #fecaca", borderRadius: 12, padding: "12px 16px", marginBottom: 18,
  },
  errorBannerIcon: {
    width: 22, height: 22, borderRadius: "50%", background: "#ef4444", color: "white",
    fontSize: "0.85rem", fontWeight: 800,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  errorBannerText: { color: "#991b1b", fontSize: "0.88rem", flex: 1, lineHeight: 1.5 },
  errorBannerClose: {
    background: "none", border: "none", color: "#991b1b", cursor: "pointer",
    fontSize: "1.1rem", padding: 0, width: 22, height: 22,
  },
  errorOrb: {
    width: 72, height: 72, borderRadius: "50%", margin: "0 auto 20px",
    background: "linear-gradient(135deg, #fee2e2, #fecaca)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "2rem", color: "#dc2626", fontWeight: 800,
  },
  successOrb: {
    width: 80, height: 80, borderRadius: "50%", margin: "0 auto 20px",
    background: "linear-gradient(135deg, #d1fae5, #a7f3d0)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "2.2rem", color: "#059669", fontWeight: 800,
  },
}

export default AssessmentUpgradePage
