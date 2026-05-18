import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { showErrorToast } from "../utils/toast"
import {
  getCampaignInfoBySlug,
  getCampaignInfoByAssessment,
  getCampaignInfoByTier,
  registerForCampaignTier,
  registerTrial,
} from "../api-clients/campaignAPI"
import { validatePromoCode } from "../api-clients/promoCodeAPI"
import DuplicateEmailDialog, { DuplicateEmailPayload } from "../components/DuplicateEmailDialog"

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
  const [formError, setFormError] = useState("")

  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(aidFromUrl)
  const [selectedTierId, setSelectedTierId] = useState<number | null>(tidFromUrl)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [dob, setDob] = useState("")
  const [phone, setPhone] = useState("")
  const [gender, setGender] = useState("")

  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateEmailPayload | null>(null)
  const emailRef = useRef<HTMLInputElement | null>(null)
  const dobRef = useRef<HTMLInputElement | null>(null)

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

  // Auto-select if there's only one option at any layer.
  useEffect(() => {
    if (!info) return
    if (selectedAssessmentId == null && info.assessments.length === 1) {
      setSelectedAssessmentId(info.assessments[0].assessmentId)
    }
  }, [info, selectedAssessmentId])

  const selectedAssessment: Assessment | null =
    info && selectedAssessmentId != null
      ? info.assessments.find((a) => a.assessmentId === selectedAssessmentId) || null
      : null

  useEffect(() => {
    if (selectedAssessment && selectedTierId == null && selectedAssessment.tiers.length === 1) {
      setSelectedTierId(selectedAssessment.tiers[0].campaignAssessmentTierId)
    }
  }, [selectedAssessment, selectedTierId])

  const selectedTier: Tier | null =
    selectedAssessment && selectedTierId != null
      ? selectedAssessment.tiers.find((t) => t.campaignAssessmentTierId === selectedTierId) || null
      : null

  const isTryFirst = selectedAssessment?.purchasePath === "B"
  const isPaid = !isTryFirst && (selectedTier?.priceInr ?? 0) > 0
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
    if (!info || !selectedAssessment) return
    if (!isTryFirst && !selectedTier) return

    setFormError("")
    if (!name.trim() || !email.trim() || !dob.trim() || !phone.trim()) {
      showErrorToast("Please fill in all required fields (Name, Email, Phone, Date of Birth).")
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
      if (!isTryFirst && promoApplied) data.promoCode = promoApplied.code

      const res = isTryFirst
        ? await registerTrial(info.campaign.slug, selectedAssessment.assessmentId, data)
        : await registerForCampaignTier(
            info.campaign.slug,
            selectedAssessment.assessmentId,
            selectedTier!.campaignAssessmentTierId,
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
        if (res.data.entitlementId) {
          localStorage.setItem("entitlementId", String(res.data.entitlementId))
        }
        if (res.data.campaignId) {
          localStorage.setItem("campaignId", String(res.data.campaignId))
        }
        if (res.data.campaignSlug) {
          localStorage.setItem("campaignSlug", String(res.data.campaignSlug))
        }
        if (res.data.purchasePath) {
          localStorage.setItem("purchasePath", String(res.data.purchasePath))
        }
        navigate("/allotted-assessment")
        return
      }

      showErrorToast("Unexpected response from server. Please try again.")
    } catch (err: any) {
      const payload = err.response?.data
      if (payload && typeof payload === "object" && payload.status === "duplicate_email") {
        setDuplicateInfo(payload as DuplicateEmailPayload)
        setFormError("")
        return
      }
      const raw = payload?.message || payload || "Registration failed. Please try again."
      const msg = typeof raw === "string" ? raw : "Registration failed."
      // 400-class server validation errors render as an inline banner above
      // the form; everything else falls through to the toast.
      if (err.response?.status === 400) {
        setFormError(msg)
      } else {
        showErrorToast(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div style={s.page}>
        <style>{keyframes}</style>
        <div style={s.bgOrb1} />
        <div style={s.bgOrb2} />
        <div style={s.bgOrb3} />
        <div style={s.glassCard}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px", gap: 16 }}>
            <div style={s.spinner} />
            <p style={{ color: "#64748b", fontSize: "0.95rem", margin: 0 }}>Loading campaign...</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (error || !info) {
    return (
      <div style={s.page}>
        <style>{keyframes}</style>
        <div style={s.bgOrb1} />
        <div style={s.bgOrb2} />
        <div style={s.bgOrb3} />
        <div style={s.glassCard}>
          <div style={{ textAlign: "center", padding: "48px 32px" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", margin: "0 auto 20px",
              background: "linear-gradient(135deg, #fee2e2, #fecaca)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "2rem",
            }}>
              !
            </div>
            <h3 style={{ color: "#1e293b", fontWeight: 700, marginBottom: 12 }}>Link Unavailable</h3>
            <p style={{ color: "#64748b", fontSize: "0.92rem", lineHeight: 1.6, maxWidth: 400, margin: "0 auto" }}>
              {error || "This campaign link is unavailable. Please contact the administrator for a valid link."}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const onlyOneAssessmentInUrl = aidFromUrl != null
  const onlyOneTierInUrl = tidFromUrl != null
  const showAssessmentPicker = !onlyOneAssessmentInUrl && info.assessments.length > 1
  const showTierPicker =
    !isTryFirst && !onlyOneTierInUrl && selectedAssessment !== null && selectedAssessment.tiers.length > 1
  const showLockedTier = !isTryFirst && !showTierPicker && selectedTier !== null
  const showForm = isTryFirst ? selectedAssessment !== null : selectedTier !== null

  // ── Main render ──
  return (
    <div style={s.page}>
      <style>{keyframes}</style>
      <div style={s.bgOrb1} />
      <div style={s.bgOrb2} />
      <div style={s.bgOrb3} />

      <div style={s.glassCard}>
        {/* Header */}
        <div style={s.header}>
          {info.campaign.brandLogoUrl && (
            <img src={info.campaign.brandLogoUrl} alt="" style={s.brandLogo} />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: "#34d399", boxShadow: "0 0 12px rgba(52, 211, 153, 0.5)",
            }} />
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Campaign Registration
            </span>
          </div>
          <h2 style={{
            margin: 0, fontWeight: 800, fontSize: "clamp(1.4rem, 4vw, 1.8rem)",
            color: "#0f172a", lineHeight: 1.2,
          }}>
            {info.campaign.name}
          </h2>
          {info.campaign.targetAudience && (
            <p style={{ margin: "10px 0 0", color: "#10b981", fontSize: "0.82rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {info.campaign.targetAudience}
            </p>
          )}
          {info.campaign.description && (
            <p style={{ margin: "12px 0 0", color: "#64748b", fontSize: "0.92rem", lineHeight: 1.55 }}>
              {info.campaign.description}
            </p>
          )}
        </div>

        <div style={s.divider} />

        <div style={{ padding: "24px 32px 32px" }}>
          {/* Assessment picker */}
          {showAssessmentPicker && (
            <section style={{ marginBottom: 24 }}>
              <h3 style={s.sectionTitle}>Choose your assessment</h3>
              <div style={s.assessmentGrid}>
                {info.assessments.map((a) => {
                  const isSel = selectedAssessmentId === a.assessmentId
                  return (
                    <button
                      key={a.assessmentId}
                      type="button"
                      onClick={() => {
                        setSelectedAssessmentId(a.assessmentId)
                        setSelectedTierId(null)
                      }}
                      style={isSel ? { ...s.optionCard, ...s.optionCardSelected } : s.optionCard}
                    >
                      <div style={s.optionCardTitle}>{a.assessmentName}</div>
                      <div style={s.optionCardMeta}>
                        {a.tiers.length} tier{a.tiers.length === 1 ? "" : "s"}
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* Tier picker */}
          {showTierPicker && selectedAssessment && (
            <section style={{ marginBottom: 24 }}>
              <h3 style={s.sectionTitle}>Choose a tier</h3>
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

          {/* Locked-in tier summary (Pay-First only) */}
          {showLockedTier && selectedTier && (
            <section style={{ marginBottom: 24 }}>
              <h3 style={s.sectionTitle}>Your selection</h3>
              <TierCard tier={selectedTier} selected={true} onSelect={() => {}} compact />
            </section>
          )}

          {/* Registration form */}
          {showForm && (
            <form onSubmit={handleSubmit}>
              <h3 style={s.sectionTitle}>Your details</h3>
              {formError && (
                <div style={s.errorBanner}>
                  <div style={s.errorBannerIcon}>!</div>
                  <span style={s.errorBannerText}>{formError}</span>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => setFormError("")}
                    style={s.errorBannerClose}
                  >
                    ×
                  </button>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
                <div>
                  <label style={s.label}>
                    Full Name <span style={{ color: "#f43f5e" }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={s.input}
                    onFocus={(e) => Object.assign(e.target.style, s.inputFocus)}
                    onBlur={(e) => Object.assign(e.target.style, { borderColor: "#e2e8f0", boxShadow: "none" })}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={s.label}>
                      Email <span style={{ color: "#f43f5e" }}>*</span>
                    </label>
                    <input
                      ref={emailRef}
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      style={s.input}
                      onFocus={(e) => Object.assign(e.target.style, s.inputFocus)}
                      onBlur={(e) => Object.assign(e.target.style, { borderColor: "#e2e8f0", boxShadow: "none" })}
                    />
                  </div>
                  <div>
                    <label style={s.label}>
                      Date of Birth <span style={{ color: "#f43f5e" }}>*</span>
                    </label>
                    <input
                      ref={dobRef}
                      type="text"
                      placeholder="dd-mm-yyyy"
                      value={dob}
                      onChange={(e) => handleDobChange(e.target.value)}
                      maxLength={10}
                      required
                      style={s.input}
                      onFocus={(e) => Object.assign(e.target.style, s.inputFocus)}
                      onBlur={(e) => Object.assign(e.target.style, { borderColor: "#e2e8f0", boxShadow: "none" })}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={s.label}>
                      Phone Number <span style={{ color: "#f43f5e" }}>*</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="Enter phone number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      style={s.input}
                      onFocus={(e) => Object.assign(e.target.style, s.inputFocus)}
                      onBlur={(e) => Object.assign(e.target.style, { borderColor: "#e2e8f0", boxShadow: "none" })}
                    />
                  </div>
                  <div>
                    <label style={s.label}>Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      style={{ ...s.input, color: gender ? "#1e293b" : "#94a3b8" }}
                      onFocus={(e) => Object.assign(e.target.style, s.inputFocus)}
                      onBlur={(e) => Object.assign(e.target.style, { borderColor: "#e2e8f0", boxShadow: "none" })}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Promo code */}
                {isPaid && (
                  <div>
                    <label style={s.label}>Promo Code</label>
                    {promoApplied ? (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 12,
                        background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)",
                        border: "1.5px solid #6ee7b7",
                        borderRadius: 12, padding: "12px 18px",
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.85rem", color: "#059669",
                        }}>
                          ✓
                        </div>
                        <span style={{ color: "#065f46", fontWeight: 700, flex: 1, fontSize: "0.92rem" }}>
                          {promoApplied.code} — {promoApplied.discountPercent}% off
                          {promoApplied.discountPercent === 100 && " (Free!)"}
                        </span>
                        <button
                          type="button"
                          onClick={handleRemovePromo}
                          style={{
                            background: "none", border: "1.5px solid #fca5a5",
                            borderRadius: 8, padding: "4px 12px", color: "#ef4444",
                            fontWeight: 600, fontSize: "0.78rem", cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 10 }}>
                        <input
                          type="text"
                          placeholder="Enter promo code"
                          value={promoCode}
                          onChange={(e) => {
                            setPromoCode(e.target.value.toUpperCase())
                            setPromoError("")
                          }}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleApplyPromo())}
                          style={{ ...s.input, flex: 1 }}
                          onFocus={(e) => Object.assign(e.target.style, s.inputFocus)}
                          onBlur={(e) => Object.assign(e.target.style, { borderColor: "#e2e8f0", boxShadow: "none" })}
                        />
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          disabled={promoValidating || !promoCode.trim()}
                          style={{
                            ...s.btnOutline,
                            opacity: promoValidating || !promoCode.trim() ? 0.5 : 1,
                            cursor: promoValidating || !promoCode.trim() ? "not-allowed" : "pointer",
                          }}
                        >
                          {promoValidating ? "..." : "Apply"}
                        </button>
                      </div>
                    )}
                    {promoError && (
                      <div style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: 6 }}>{promoError}</div>
                    )}
                  </div>
                )}

                {/* Price summary when discount applied */}
                {isPaid && promoApplied && discountedPriceInr !== selectedTier!.priceInr && (
                  <div style={s.priceBadge}>
                    <span style={{ textDecoration: "line-through", opacity: 0.5, marginRight: 10, fontWeight: 500 }}>
                      INR {selectedTier!.priceInr}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>INR {discountedPriceInr}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  ...s.btnPrimary,
                  width: "100%",
                  marginTop: 24,
                  opacity: submitting ? 0.7 : 1,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <div style={{ ...s.spinner, width: 18, height: 18, borderWidth: 2 }} />
                    {isPaid && discountedPriceInr > 0 ? "Processing..." : isTryFirst ? "Starting..." : "Registering..."}
                  </span>
                ) : isPaid && discountedPriceInr > 0 ? (
                  `Register & Pay INR ${discountedPriceInr}`
                ) : isTryFirst ? (
                  "Start Assessment"
                ) : (
                  "Register"
                )}
              </button>

              <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.78rem", marginTop: 16, marginBottom: 0 }}>
                By registering, you agree to the campaign terms and conditions.
              </p>
            </form>
          )}
        </div>
      </div>

      <div style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        fontSize: "0.72rem", color: "rgba(100, 116, 139, 0.5)", fontWeight: 500,
        letterSpacing: "0.05em",
      }}>
        CAREER-9
      </div>

      <DuplicateEmailDialog
        open={!!duplicateInfo}
        payload={duplicateInfo}
        onUseRegisteredDob={() => {
          setDuplicateInfo(null)
          setDob("")
          setTimeout(() => dobRef.current?.focus(), 50)
        }}
        onChangeIdentity={() => {
          setDuplicateInfo(null)
          setEmail("")
          setPhone("")
          setTimeout(() => emailRef.current?.focus(), 50)
        }}
        onClose={() => setDuplicateInfo(null)}
      />
    </div>
  )
}

// ── TierCard sub-component ──
function TierCard({
  tier,
  selected,
  onSelect,
  compact = false,
}: {
  tier: Tier
  selected: boolean
  onSelect: () => void
  compact?: boolean
}) {
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
    <button
      type="button"
      onClick={onSelect}
      disabled={compact}
      style={selected ? { ...s.tierCard, ...s.tierCardSelected, cursor: compact ? "default" : "pointer" } : s.tierCard}
    >
      {tier.isDefault && <span style={s.recommendedBadge}>Recommended</span>}
      <div style={s.tierTitle}>{tier.name}</div>
      <div style={s.tierPriceLine}>
        {tier.priceInr !== tier.basePriceInr && (
          <span style={s.tierBasePrice}>INR {tier.basePriceInr}</span>
        )}
        <span style={s.tierPrice}>INR {tier.priceInr}</span>
      </div>
      {tier.description && <p style={s.tierDescription}>{tier.description}</p>}
      {features.length > 0 && (
        <ul style={s.tierFeatures}>
          {features.map((f) => <li key={f}>{f}</li>)}
        </ul>
      )}
    </button>
  )
}

// ── Animations ──
const keyframes = `
  @keyframes float1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(30px, -40px) scale(1.05); }
    66% { transform: translate(-20px, 20px) scale(0.95); }
  }
  @keyframes float2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(-40px, 30px) scale(1.08); }
    66% { transform: translate(25px, -25px) scale(0.92); }
  }
  @keyframes float3 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(35px, 35px) scale(1.04); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`

// ── Styles ──
const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(145deg, #f0fdf4 0%, #ecfeff 30%, #f0f9ff 60%, #faf5ff 100%)",
    padding: "24px 16px",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  bgOrb1: {
    position: "fixed",
    width: 500, height: 500, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(52, 211, 153, 0.15) 0%, transparent 70%)",
    top: "-10%", right: "-5%",
    animation: "float1 20s ease-in-out infinite",
    pointerEvents: "none" as const,
  },
  bgOrb2: {
    position: "fixed",
    width: 600, height: 600, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)",
    bottom: "-15%", left: "-10%",
    animation: "float2 25s ease-in-out infinite",
    pointerEvents: "none" as const,
  },
  bgOrb3: {
    position: "fixed",
    width: 350, height: 350, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)",
    top: "50%", left: "60%",
    animation: "float3 18s ease-in-out infinite",
    pointerEvents: "none" as const,
  },
  glassCard: {
    width: "100%",
    maxWidth: 640,
    background: "rgba(255, 255, 255, 0.78)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderRadius: 24,
    border: "1px solid rgba(255, 255, 255, 0.6)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
    overflow: "hidden",
    position: "relative",
    zIndex: 1,
  },
  header: {
    padding: "32px 32px 24px",
  },
  brandLogo: {
    maxWidth: 120, maxHeight: 56, marginBottom: 16, objectFit: "contain" as const,
  },
  divider: {
    height: 1, background: "linear-gradient(90deg, transparent, #e2e8f0, transparent)", margin: "0 32px",
  },
  sectionTitle: {
    fontSize: "0.92rem", fontWeight: 700, color: "#1e293b", margin: "0 0 12px", letterSpacing: "-0.01em",
  },
  assessmentGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12,
  },
  optionCard: {
    padding: "16px 18px",
    borderRadius: 14,
    border: "1.5px solid #e2e8f0",
    background: "rgba(255, 255, 255, 0.7)",
    cursor: "pointer",
    textAlign: "left" as const,
    fontFamily: "inherit",
    transition: "all 0.15s",
  },
  optionCardSelected: {
    borderColor: "#10b981",
    background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)",
    boxShadow: "0 0 0 3px rgba(16,185,129,0.15)",
  },
  optionCardTitle: {
    fontSize: "0.95rem", fontWeight: 700, color: "#1e293b", marginBottom: 4,
  },
  optionCardMeta: {
    color: "#64748b", fontSize: "0.8rem",
  },
  tierGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14,
  },
  tierCard: {
    padding: "18px 18px 16px",
    borderRadius: 14,
    border: "1.5px solid #e2e8f0",
    background: "rgba(255, 255, 255, 0.7)",
    cursor: "pointer",
    textAlign: "left" as const,
    fontFamily: "inherit",
    position: "relative" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    transition: "all 0.15s",
  },
  tierCardSelected: {
    borderColor: "#10b981",
    background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)",
    boxShadow: "0 0 0 3px rgba(16,185,129,0.15)",
  },
  recommendedBadge: {
    position: "absolute" as const,
    top: -10, right: 14,
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "#fff",
    fontSize: "0.7rem",
    padding: "3px 10px",
    borderRadius: 999,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
  },
  tierTitle: {
    fontSize: "1rem", fontWeight: 700, color: "#1e293b",
  },
  tierPriceLine: {
    display: "flex", alignItems: "baseline", gap: 8, marginTop: 2,
  },
  tierBasePrice: {
    textDecoration: "line-through", color: "#94a3b8", fontSize: "0.85rem",
  },
  tierPrice: {
    fontSize: "1.4rem", fontWeight: 800, color: "#0f172a",
  },
  tierDescription: {
    color: "#64748b", fontSize: "0.83rem", margin: 0,
  },
  tierFeatures: {
    listStyle: "disc",
    paddingLeft: 18,
    color: "#374151",
    fontSize: "0.85rem",
    margin: "4px 0 0",
  },
  label: {
    display: "block",
    fontSize: "0.82rem",
    fontWeight: 600,
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 12,
    border: "1.5px solid #e2e8f0",
    background: "rgba(255, 255, 255, 0.8)",
    fontSize: "0.92rem",
    color: "#1e293b",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  },
  inputFocus: {
    borderColor: "#34d399",
    boxShadow: "0 0 0 3px rgba(52, 211, 153, 0.15)",
  },
  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "14px 32px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)",
    color: "#fff",
    fontSize: "0.95rem",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(16, 185, 129, 0.35), 0 1px 3px rgba(0, 0, 0, 0.1)",
    transition: "transform 0.15s, box-shadow 0.15s",
    letterSpacing: "0.01em",
    fontFamily: "inherit",
  },
  btnOutline: {
    padding: "12px 20px",
    borderRadius: 12,
    border: "1.5px solid #10b981",
    background: "transparent",
    color: "#059669",
    fontSize: "0.88rem",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    transition: "all 0.15s",
    fontFamily: "inherit",
  },
  priceBadge: {
    marginTop: 4,
    display: "inline-flex",
    alignItems: "center",
    background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
    color: "#065f46",
    padding: "8px 20px",
    borderRadius: 12,
    fontSize: "0.95rem",
    fontWeight: 700,
    border: "1px solid #6ee7b7",
    alignSelf: "flex-start",
  },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid #e2e8f0",
    borderTopColor: "#10b981",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  errorBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "14px 16px",
    marginBottom: 18,
    background: "#fff5f5",
    border: "1px solid #fecaca",
    borderRadius: 12,
    borderBottom: "3px solid #fecaca",
    color: "#374151",
    fontSize: "0.95rem",
    lineHeight: 1.5,
    position: "relative",
  },
  errorBannerIcon: {
    flex: "0 0 auto",
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#ef4444",
    color: "#fff",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  errorBannerText: {
    flex: "1 1 auto",
    paddingRight: 24,
    color: "#374151",
  },
  errorBannerClose: {
    position: "absolute",
    top: 6,
    right: 8,
    border: "none",
    background: "transparent",
    fontSize: "1.4rem",
    lineHeight: 1,
    color: "#9ca3af",
    cursor: "pointer",
    padding: "4px 8px",
  },
}

export default CampaignRegisterPage
