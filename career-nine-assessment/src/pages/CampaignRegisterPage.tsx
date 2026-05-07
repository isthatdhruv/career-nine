import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { showErrorToast } from "../utils/toast"
import {
  getCampaignInfoBySlug,
  getCampaignInfoByAssessment,
  getCampaignInfoByTier,
  registerForCampaignTier,
} from "../api-clients/campaignAPI"
import { validatePromoCode } from "../api-clients/promoCodeAPI"

type Tier = {
  campaignAssessmentTierId: number
  tierId: number
  name: string
  description?: string
  basePriceInr: number
  priceInr: number
  currency: string
  isDefault: boolean
  includesFinalReport: boolean
  includesDashboard: boolean
  includesCounselling: boolean
  counsellingSessionCount?: number | null
  includesLms: boolean
  lmsValidityDays?: number | null
  dashboardValidityDays?: number | null
}

type Assessment = {
  assessmentId: number
  assessmentName: string
  isActive: boolean
  purchasePath: string
  counsellingModel: string
  tiers: Tier[]
}

type CampaignInfo = {
  campaign: {
    campaignId: number
    name: string
    slug: string
    brandLogoUrl?: string
    targetAudience?: string
    description?: string
    validFrom?: string
    validTo?: string
  }
  assessments: Assessment[]
}

const CampaignRegisterPage = () => {
  const { slug, assessmentId: aidParam, tierId: tidParam } = useParams<{
    slug: string
    assessmentId?: string
    tierId?: string
  }>()
  const navigate = useNavigate()

  const aidFromUrl = aidParam ? Number(aidParam) : null
  const tidFromUrl = tidParam ? Number(tidParam) : null

  const [info, setInfo] = useState<CampaignInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Selection state — seeded from URL, mutated by pickers
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(aidFromUrl)
  const [selectedTierId, setSelectedTierId] = useState<number | null>(tidFromUrl)

  // Form fields
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [dob, setDob] = useState("")
  const [phone, setPhone] = useState("")
  const [gender, setGender] = useState("")

  // Promo
  const [promoCode, setPromoCode] = useState("")
  const [promoApplied, setPromoApplied] = useState<{ code: string; discountPercent: number } | null>(null)
  const [promoError, setPromoError] = useState("")
  const [promoValidating, setPromoValidating] = useState(false)

  useEffect(() => {
    if (!slug) return
    const fetcher =
      tidFromUrl != null && aidFromUrl != null
        ? getCampaignInfoByTier(slug, aidFromUrl, tidFromUrl)
        : aidFromUrl != null
        ? getCampaignInfoByAssessment(slug, aidFromUrl)
        : getCampaignInfoBySlug(slug)
    fetcher
      .then((res) => {
        setInfo(res.data)
        setLoading(false)
      })
      .catch(() => {
        setError("Invalid or expired campaign link.")
        setLoading(false)
      })
  }, [slug, aidFromUrl, tidFromUrl])

  // Resolve currently selected (assessment, tier) from state + info
  const selectedAssessment: Assessment | null =
    info && selectedAssessmentId != null
      ? info.assessments.find((a) => a.assessmentId === selectedAssessmentId) || null
      : null

  const selectedTier: Tier | null =
    selectedAssessment && selectedTierId != null
      ? selectedAssessment.tiers.find((t) => t.campaignAssessmentTierId === selectedTierId) || null
      : null

  const isPaid = (selectedTier?.priceInr ?? 0) > 0
  const discountedPriceInr = promoApplied && selectedTier
    ? selectedTier.priceInr * (100 - promoApplied.discountPercent) / 100
    : (selectedTier?.priceInr ?? 0)

  const handleDobChange = (value: string) => {
    let cleaned = value.replace(/[^0-9-]/g, "")
    const digits = cleaned.replace(/-/g, "")
    if (digits.length <= 2) cleaned = digits
    else if (digits.length <= 4) cleaned = digits.slice(0, 2) + "-" + digits.slice(2)
    else cleaned = digits.slice(0, 2) + "-" + digits.slice(2, 4) + "-" + digits.slice(4, 8)
    setDob(cleaned)
  }

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
    if (!info || !selectedAssessment || !selectedTier) return

    if (!name.trim() || !email.trim() || !dob.trim()) {
      showErrorToast("Please fill in all required fields (Name, Email, Date of Birth).")
      return
    }
    if (!/^\d{2}-\d{2}-\d{4}$/.test(dob)) {
      showErrorToast("Date of Birth must be in dd-mm-yyyy format.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showErrorToast("Please enter a valid email address.")
      return
    }

    setSubmitting(true)
    try {
      const data: any = {
        name: name.trim(),
        email: email.trim(),
        dob,
        phone: phone.trim(),
        gender,
      }
      if (promoApplied) data.promoCode = promoApplied.code

      const res = await registerForCampaignTier(
        info.campaign.slug,
        selectedAssessment.assessmentId,
        selectedTier.campaignAssessmentTierId,
        data,
      )

      if (res.data.status === "payment_required") {
        if (res.data.paymentUrl) {
          window.location.href = res.data.paymentUrl
        } else {
          showErrorToast("Payment link could not be generated. Please try again.")
        }
        return
      }

      if (res.data.userStudentId && res.data.assessments) {
        localStorage.clear()
        localStorage.setItem("userStudentId", String(res.data.userStudentId))
        localStorage.setItem("allottedAssessments", JSON.stringify(res.data.assessments))
        navigate("/allotted-assessment")
        return
      }

      showErrorToast("Unexpected response from server. Please try again.")
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || "Registration failed. Please try again."
      showErrorToast(typeof msg === "string" ? msg : "Registration failed.")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading / Error states ──
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }
  if (error || !info) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontSize: "3rem", color: "#dc3545" }}>!</div>
          <h3 style={{ color: "#1e293b" }}>Link Unavailable</h3>
          <p style={{ color: "#64748b" }}>
            {error || "This campaign link is unavailable. Please contact the administrator for a valid link."}
          </p>
        </div>
      </div>
    )
  }

  // ── Render ──
  const onlyOneAssessmentInUrl = aidFromUrl != null
  const onlyOneTierInUrl = tidFromUrl != null
  const showAssessmentPicker = !onlyOneAssessmentInUrl && info.assessments.length > 0
  const showTierPicker = !onlyOneTierInUrl && selectedAssessment !== null
  const showForm = selectedTier !== null

  return (
    <div style={s.page}>
      <style>{spinKeyframes}</style>

      {/* Campaign header */}
      <div style={s.header}>
        {info.campaign.brandLogoUrl && (
          <img src={info.campaign.brandLogoUrl} alt="" style={s.logo} />
        )}
        <h1 style={s.campaignName}>{info.campaign.name}</h1>
        {info.campaign.targetAudience && <p style={s.targetAudience}>{info.campaign.targetAudience}</p>}
        {info.campaign.description && <p style={s.description}>{info.campaign.description}</p>}
      </div>

      {/* Assessment picker */}
      {showAssessmentPicker && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Choose your assessment</h2>
          <div style={s.assessmentGrid}>
            {info.assessments.map((a) => {
              const isSelected = selectedAssessmentId === a.assessmentId
              return (
                <button
                  key={a.assessmentId}
                  onClick={() => {
                    setSelectedAssessmentId(a.assessmentId)
                    setSelectedTierId(null)
                  }}
                  style={isSelected ? { ...s.assessmentCard, ...s.assessmentCardSelected } : s.assessmentCard}
                >
                  <h3 style={s.assessmentCardTitle}>{a.assessmentName}</h3>
                  <p style={s.assessmentCardMeta}>
                    {a.tiers.length} tier{a.tiers.length === 1 ? "" : "s"} available
                  </p>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Tier picker */}
      {showTierPicker && selectedAssessment && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Choose a tier{!showAssessmentPicker ? "" : ` — ${selectedAssessment.assessmentName}`}</h2>
          <div style={s.tierGrid}>
            {selectedAssessment.tiers.map((t) => (
              <TierCard
                key={t.campaignAssessmentTierId}
                tier={t}
                selected={selectedTierId === t.campaignAssessmentTierId}
                onSelect={() => setSelectedTierId(t.campaignAssessmentTierId)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Locked-in tier summary (when URL pre-selected) */}
      {onlyOneTierInUrl && selectedTier && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Selected tier</h2>
          <TierCard tier={selectedTier} selected={true} onSelect={() => {}} />
        </section>
      )}

      {/* Registration form */}
      {showForm && selectedTier && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Your details</h2>
          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.row}>
              <label style={s.label}>
                Full Name <span style={s.required}>*</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={s.input} />
              </label>
            </div>
            <div style={s.gridTwo}>
              <label style={s.label}>
                Email <span style={s.required}>*</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={s.input} />
              </label>
              <label style={s.label}>
                Date of Birth <span style={s.required}>*</span>
                <input type="text" placeholder="dd-mm-yyyy" value={dob} maxLength={10}
                       onChange={(e) => handleDobChange(e.target.value)} required style={s.input} />
              </label>
            </div>
            <div style={s.gridTwo}>
              <label style={s.label}>
                Phone Number
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={s.input} />
              </label>
              <label style={s.label}>
                Gender
                <select value={gender} onChange={(e) => setGender(e.target.value)} style={s.input}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </div>

            {/* Promo code */}
            {isPaid && (
              <div style={s.promoBlock}>
                <label style={s.label}>Promo Code</label>
                {promoApplied ? (
                  <div style={s.promoApplied}>
                    <span>{promoApplied.code} — {promoApplied.discountPercent}% off</span>
                    <button type="button" onClick={handleRemovePromo} style={s.promoRemove}>Remove</button>
                  </div>
                ) : (
                  <div style={s.promoInputRow}>
                    <input type="text" placeholder="Enter code" value={promoCode}
                           onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError("") }}
                           onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleApplyPromo())}
                           style={{ ...s.input, marginBottom: 0 }} />
                    <button type="button" onClick={handleApplyPromo}
                            disabled={promoValidating || !promoCode.trim()}
                            style={s.promoApply}>
                      {promoValidating ? "..." : "Apply"}
                    </button>
                  </div>
                )}
                {promoError && <div style={s.promoError}>{promoError}</div>}
              </div>
            )}

            <button type="submit" disabled={submitting} style={s.submit}>
              {submitting
                ? (isPaid && discountedPriceInr > 0 ? "Processing..." : "Registering...")
                : isPaid && discountedPriceInr > 0
                ? `Register & Pay INR ${discountedPriceInr}`
                : "Register"}
            </button>
          </form>
        </section>
      )}
    </div>
  )
}

// ── TierCard sub-component ──
function TierCard({ tier, selected, onSelect }: { tier: Tier; selected: boolean; onSelect: () => void }) {
  const features: string[] = []
  if (tier.includesFinalReport) features.push("Final report")
  if (tier.includesCounselling && tier.counsellingSessionCount) {
    features.push(`${tier.counsellingSessionCount}× counselling session${tier.counsellingSessionCount > 1 ? "s" : ""}`)
  }
  if (tier.includesDashboard) {
    features.push(tier.dashboardValidityDays ? `Dashboard (${tier.dashboardValidityDays} days)` : "Dashboard access")
  }
  if (tier.includesLms) {
    features.push(tier.lmsValidityDays ? `LMS (${tier.lmsValidityDays} days)` : "LMS access")
  }

  return (
    <button onClick={onSelect} style={selected ? { ...s.tierCard, ...s.tierCardSelected } : s.tierCard}>
      {tier.isDefault && <span style={s.recommendedBadge}>Recommended</span>}
      <h3 style={s.tierTitle}>{tier.name}</h3>
      <div style={s.tierPriceLine}>
        {tier.priceInr !== tier.basePriceInr && (
          <span style={s.tierBasePrice}>INR {tier.basePriceInr}</span>
        )}
        <span style={s.tierPrice}>INR {tier.priceInr}</span>
      </div>
      {tier.description && <p style={s.tierDescription}>{tier.description}</p>}
      <ul style={s.tierFeatures}>
        {features.map((f) => <li key={f}>{f}</li>)}
      </ul>
    </button>
  )
}

// ── Styles ──
const spinKeyframes = `@keyframes spin { to { transform: rotate(360deg); } }`

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(145deg, #f0fdf4 0%, #ecfeff 30%, #f0f9ff 60%, #faf5ff 100%)",
    padding: "32px 24px",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  header: { maxWidth: 720, margin: "0 auto 32px", textAlign: "center" },
  logo: { maxWidth: 180, marginBottom: 16 },
  campaignName: { fontSize: "2rem", fontWeight: 800, margin: "0 0 8px", color: "#0f172a" },
  targetAudience: { color: "#10b981", fontWeight: 600, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 },
  description: { color: "#64748b", marginTop: 12 },
  section: { maxWidth: 720, margin: "0 auto 32px" },
  sectionTitle: { fontSize: "1.3rem", fontWeight: 700, color: "#1e293b", marginBottom: 16 },
  assessmentGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 },
  assessmentCard: {
    padding: 20, borderRadius: 12, border: "2px solid #e2e8f0",
    background: "#fff", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
  },
  assessmentCardSelected: { borderColor: "#10b981", boxShadow: "0 0 0 3px rgba(16,185,129,0.15)" },
  assessmentCardTitle: { fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", margin: "0 0 6px" },
  assessmentCardMeta: { color: "#64748b", fontSize: "0.85rem", margin: 0 },
  tierGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 },
  tierCard: {
    padding: 20, borderRadius: 14, border: "2px solid #e2e8f0",
    background: "#fff", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
    position: "relative", display: "flex", flexDirection: "column", gap: 8,
  },
  tierCardSelected: { borderColor: "#10b981", boxShadow: "0 0 0 3px rgba(16,185,129,0.15)" },
  recommendedBadge: {
    position: "absolute", top: -10, right: 16, background: "#10b981", color: "#fff",
    fontSize: "0.72rem", padding: "3px 10px", borderRadius: 999, fontWeight: 700,
  },
  tierTitle: { fontSize: "1.15rem", fontWeight: 700, color: "#1e293b", margin: 0 },
  tierPriceLine: { display: "flex", alignItems: "baseline", gap: 8 },
  tierBasePrice: { textDecoration: "line-through", color: "#94a3b8", fontSize: "0.85rem" },
  tierPrice: { fontSize: "1.4rem", fontWeight: 800, color: "#0f172a" },
  tierDescription: { color: "#64748b", fontSize: "0.85rem", margin: 0 },
  tierFeatures: { listStyle: "disc", paddingLeft: 18, color: "#374151", fontSize: "0.88rem", margin: 0 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  row: {},
  gridTwo: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  label: { display: "flex", flexDirection: "column", fontSize: "0.85rem", color: "#374151", fontWeight: 600 },
  required: { color: "#f43f5e" },
  input: {
    marginTop: 6, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0",
    background: "#fff", fontSize: "0.95rem", outline: "none", fontFamily: "inherit", color: "#1e293b",
  },
  promoBlock: { display: "flex", flexDirection: "column", gap: 8 },
  promoApplied: {
    display: "flex", alignItems: "center", gap: 12,
    background: "#ecfdf5", border: "1.5px solid #6ee7b7", borderRadius: 10, padding: "10px 14px",
    color: "#065f46", fontWeight: 600, fontSize: "0.9rem",
  },
  promoRemove: {
    marginLeft: "auto", background: "transparent", border: "1.5px solid #fca5a5",
    color: "#ef4444", borderRadius: 8, padding: "4px 10px", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer",
  },
  promoInputRow: { display: "flex", gap: 8 },
  promoApply: {
    border: "1.5px solid #10b981", color: "#10b981", background: "transparent",
    borderRadius: 10, padding: "0 18px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  },
  promoError: { color: "#ef4444", fontSize: "0.82rem" },
  submit: {
    marginTop: 8, padding: "14px 22px", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff",
    fontSize: "1rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  },
}

export default CampaignRegisterPage
