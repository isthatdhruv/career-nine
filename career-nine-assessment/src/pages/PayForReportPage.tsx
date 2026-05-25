import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { showErrorToast } from "../utils/toast"
import { getUpgradeInfo, payForReport } from "../api-clients/campaignAPI"
import { validatePromoCode } from "../api-clients/promoCodeAPI"
import { TierCard, Tier } from "../components/TierCard"

type UpgradeInfo = {
  entitlementId: number
  status: string
  purchasePath: string
  alreadyActive: boolean
  campaign: { campaignId: number; name: string; slug: string; brandLogoUrl?: string }
  assessment: { assessmentId: number; assessmentName: string }
  student: { name?: string; email?: string; phone?: string }
  tiers: Tier[]
}

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "When do I get my report?",
    a: "Your detailed report is generated and emailed within a few minutes of payment. You can also download it from this page or from your dashboard.",
  },
  {
    q: "Is the payment secure?",
    a: "Payments are processed by Razorpay. We never store your card details — all sensitive information goes directly to the payment provider over an encrypted channel.",
  },
  {
    q: "Can I upgrade later?",
    a: "Yes — you can always come back and pick a higher tier. Your existing entitlement gets upgraded; you don't have to retake the assessment.",
  },
]

const PayForReportPage = () => {
  const { entitlementId: eidParam } = useParams<{ entitlementId: string }>()
  const navigate = useNavigate()

  const [info, setInfo] = useState<UpgradeInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")
  const [selectedTierId, setSelectedTierId] = useState<number | null>(null)

  const [promoCode, setPromoCode] = useState("")
  const [promoApplied, setPromoApplied] = useState<{ code: string; discountPercent: number } | null>(null)
  const [promoError, setPromoError] = useState("")
  const [promoValidating, setPromoValidating] = useState(false)

  useEffect(() => {
    if (!eidParam) {
      setLoadError("Invalid link.")
      setLoading(false)
      return
    }
    getUpgradeInfo(eidParam)
      .then((res) => {
        const data = res.data as UpgradeInfo
        setInfo(data)
        setLoading(false)
        if (data.tiers.length > 0) {
          const def = data.tiers.find((t) => t.isDefault) ?? data.tiers[0]
          setSelectedTierId(def.campaignAssessmentTierId)
        }
      })
      .catch(() => {
        setLoadError("Invalid or expired link.")
        setLoading(false)
      })
  }, [eidParam])

  const selectedTier = info?.tiers.find((t) => t.campaignAssessmentTierId === selectedTierId) ?? null
  const discountedPriceInr = promoApplied && selectedTier
    ? Math.round((selectedTier.priceInr * (100 - promoApplied.discountPercent)) / 100)
    : (selectedTier?.priceInr ?? 0)

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || !info) return
    setPromoValidating(true)
    setPromoError("")
    setPromoApplied(null)
    try {
      const res = await validatePromoCode(promoCode.trim(), info.campaign.campaignId)
      setPromoApplied({ code: res.data.code, discountPercent: res.data.discountPercent })
    } catch (err: any) {
      const msg = err.response?.data || "Invalid promo code"
      setPromoError(typeof msg === "string" ? msg : "Invalid promo code")
    } finally {
      setPromoValidating(false)
    }
  }

  const handleRemovePromo = () => {
    setPromoApplied(null)
    setPromoCode("")
    setPromoError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!info || !selectedTier) return
    setFormError("")
    setSubmitting(true)
    try {
      const body: any = {
        entitlementId: info.entitlementId,
        campaignAssessmentTierId: selectedTier.campaignAssessmentTierId,
      }
      if (promoApplied) body.promoCode = promoApplied.code
      const res = await payForReport(body)
      if (res.data.status === "payment_required" && res.data.paymentUrl) {
        window.location.href = res.data.paymentUrl
        return
      }
      showErrorToast("Could not start payment. Please try again.")
    } catch (err: any) {
      const raw = err.response?.data || "Failed to start payment."
      const msg = typeof raw === "string" ? raw : (raw.message || "Failed to start payment.")
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

  if (info.alreadyActive) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ textAlign: "center", padding: "48px 32px" }}>
            <div style={s.successOrb}>✓</div>
            <h3 style={{ color: "#0f172a", fontWeight: 800, marginBottom: 12, fontSize: "1.4rem" }}>
              Report already unlocked
            </h3>
            <p style={{ color: "#64748b", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 24 }}>
              We've sent the access details to <strong>{info.student.email}</strong>. Check your inbox.
            </p>
            <button onClick={() => navigate("/studentAssessment/completed")} style={s.btnPrimary}>
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  const showTierSelector = info.tiers.length > 1

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          {info.campaign.brandLogoUrl && (
            <img src={info.campaign.brandLogoUrl} alt="" style={s.brandLogo} />
          )}
          <span style={s.pillLabel}>Report Purchase</span>
          <h2 style={s.title}>{info.campaign.name}</h2>
          <p style={s.subtitle}>
            Pay for your detailed report for <strong>{info.assessment.assessmentName}</strong>.
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

          <h3 style={s.sectionTitle}>Your details</h3>
          <div style={s.detailsBox}>
            <DetailRow label="Name" value={info.student.name || "—"} />
            <DetailRow label="Email" value={info.student.email || "—"} />
            <DetailRow label="Phone" value={info.student.phone || "—"} />
            <DetailRow label="Assessment" value={info.assessment.assessmentName} />
          </div>

          <h3 style={{ ...s.sectionTitle, marginTop: 24 }}>
            {showTierSelector ? "Choose your plan" : "Selected plan"}
          </h3>
          <div style={s.tierGrid}>
            {info.tiers.map((t) => (
              <TierCard
                key={t.campaignAssessmentTierId}
                tier={t}
                selected={selectedTierId === t.campaignAssessmentTierId}
                onSelect={() => showTierSelector && setSelectedTierId(t.campaignAssessmentTierId)}
                disabled={!showTierSelector}
              />
            ))}
          </div>

          <h3 style={{ ...s.sectionTitle, marginTop: 24 }}>Promo code</h3>
          {promoApplied ? (
            <div style={s.promoApplied}>
              <span style={{ color: "#065f46", fontWeight: 700, flex: 1, fontSize: "0.92rem" }}>
                {promoApplied.code} — {promoApplied.discountPercent}% off
              </span>
              <button type="button" onClick={handleRemovePromo} style={s.btnRemove}>Remove</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="text"
                placeholder="Enter promo code"
                value={promoCode}
                onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError("") }}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleApplyPromo())}
                style={{ ...s.input, flex: 1 }}
              />
              <button
                type="button"
                onClick={handleApplyPromo}
                disabled={promoValidating || !promoCode.trim()}
                style={{ ...s.btnOutline, opacity: promoValidating || !promoCode.trim() ? 0.5 : 1 }}
              >
                {promoValidating ? "..." : "Apply"}
              </button>
            </div>
          )}
          {promoError && <div style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: 6 }}>{promoError}</div>}

          {selectedTier && (
            <div style={s.totalBar}>
              <span style={{ color: "#64748b", fontWeight: 600 }}>Total</span>
              <span>
                {promoApplied && discountedPriceInr !== selectedTier.priceInr && (
                  <span style={{ textDecoration: "line-through", color: "#94a3b8", marginRight: 10, fontSize: "0.95rem" }}>
                    INR {selectedTier.priceInr}
                  </span>
                )}
                <strong style={{ color: "#0f172a", fontSize: "1.25rem" }}>INR {discountedPriceInr}</strong>
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !selectedTier || discountedPriceInr <= 0}
            style={{ ...s.btnPrimary, width: "100%", marginTop: 24, opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? "Processing…" : `Pay INR ${discountedPriceInr}`}
          </button>

          <h3 style={{ ...s.sectionTitle, marginTop: 32 }}>Frequently asked</h3>
          <FaqAccordion items={FAQS} />
        </form>
      </div>
    </div>
  )
}

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: "0.92rem" }}>
    <span style={{ color: "#64748b", fontWeight: 600 }}>{label}</span>
    <span style={{ color: "#0f172a", fontWeight: 600 }}>{value}</span>
  </div>
)

const FaqAccordion = ({ items }: { items: Array<{ q: string; a: string }> }) => {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, idx) => {
        const isOpen = open === idx
        return (
          <div key={item.q} style={s.faqItem}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : idx)}
              style={s.faqHeader}
              aria-expanded={isOpen}
            >
              <span>{item.q}</span>
              <span style={{ fontSize: "1.2rem", color: "#10b981" }}>{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && <div style={s.faqBody}>{item.a}</div>}
          </div>
        )
      })}
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
    maxWidth: 720,
    overflow: "hidden",
  },
  header: { padding: "32px 32px 16px", textAlign: "center" },
  brandLogo: { maxHeight: 50, marginBottom: 12 },
  pillLabel: {
    fontSize: "0.75rem", fontWeight: 700, color: "#10b981",
    textTransform: "uppercase", letterSpacing: "0.08em",
  },
  title: { margin: "8px 0 0", fontWeight: 800, fontSize: "1.6rem", color: "#0f172a" },
  subtitle: { margin: "10px 0 0", color: "#64748b", fontSize: "0.95rem" },
  divider: { height: 1, background: "linear-gradient(90deg, transparent, #e2e8f0, transparent)" },
  sectionTitle: { fontSize: "0.78rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 },
  detailsBox: {
    background: "#f8fafc", border: "1px solid #e2e8f0",
    borderRadius: 14, padding: "8px 18px",
  },
  tierGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  faqItem: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    background: "#fff",
    overflow: "hidden",
  },
  faqHeader: {
    width: "100%",
    background: "transparent",
    border: "none",
    padding: "12px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "0.92rem",
    fontWeight: 600,
    color: "#0f172a",
    cursor: "pointer",
    textAlign: "left",
  },
  faqBody: {
    padding: "0 16px 14px",
    color: "#475569",
    fontSize: "0.88rem",
    lineHeight: 1.55,
  },
  input: {
    border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "10px 14px",
    fontSize: "0.92rem", color: "#0f172a", background: "#fff",
  },
  btnPrimary: {
    border: "none",
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "white", fontWeight: 700, fontSize: "0.95rem",
    padding: "13px 22px", borderRadius: 12, cursor: "pointer",
  },
  btnOutline: {
    background: "transparent", border: "1.5px solid #10b981",
    color: "#10b981", fontWeight: 700, padding: "10px 18px",
    borderRadius: 12, cursor: "pointer", fontSize: "0.88rem",
  },
  btnRemove: {
    background: "none", border: "1.5px solid #fca5a5", borderRadius: 8,
    padding: "4px 12px", color: "#ef4444", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer",
  },
  promoApplied: {
    display: "flex", alignItems: "center", gap: 12,
    background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)",
    border: "1.5px solid #6ee7b7", borderRadius: 12, padding: "10px 16px",
  },
  totalBar: {
    marginTop: 24, padding: "14px 18px",
    background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12,
    display: "flex", justifyContent: "space-between", alignItems: "center",
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

export default PayForReportPage
