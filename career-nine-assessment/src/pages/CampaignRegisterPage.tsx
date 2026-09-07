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
import ParentalConsentSection from "../components/ParentalConsent"
import { contactTerms } from "../utils/instituteTerms"
import { CAREER9_LOGO } from "../hooks/useStudentBranding"
import { TierStrip } from "../components/TierCard"
import RegisterShell, { SignInNote } from "../components/RegisterShell"
import { rs, inputBlurStyle } from "../styles/registerStyles"

// The campaign's brand logo when one is set (http(s) only — same guard as
// brandLogoSrc), otherwise the default Career-9 logo.
const campaignLogoSrc = (url?: string | null): string =>
  url && /^https?:\/\//i.test(url) ? url : CAREER9_LOGO

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
  description?: string | null
  /** true → this assessment's cohort is 18+ (deep-link mode's audience flag). */
  audience18Plus?: boolean | null
  tiers: Tier[]
}

type CampaignClass = {
  classId: number
  className: string
  assessmentId: number
  sortOrder?: number
  /** true → this class route is an 18+ cohort (class mode's audience flag). */
  audience18Plus?: boolean | null
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
  // Present for class-based campaigns: the student picks a class and the routed
  // assessment (+ its default tier) auto-selects. Omitted on assessment/tier deep-links.
  classes?: CampaignClass[]
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
  // DPDP parental consent — registration cannot proceed without it.
  const [dpdpConsent, setDpdpConsent] = useState(false)

  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(aidFromUrl)
  const [selectedTierId, setSelectedTierId] = useState<number | null>(tidFromUrl)
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [dob, setDob] = useState("")
  const [phone, setPhone] = useState("")

  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateEmailPayload | null>(null)
  const emailRef = useRef<HTMLInputElement | null>(null)
  const dobRef = useRef<HTMLInputElement | null>(null)

  const [promoCode, setPromoCode] = useState("")
  const [promoApplied, setPromoApplied] = useState<{ code: string; discountPercent: number } | null>(null)
  const [promoError, setPromoError] = useState("")
  const [promoValidating, setPromoValidating] = useState(false)
  const [showPromo, setShowPromo] = useState(false)

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

  // Class-based campaigns route a class → assessment. When present, the student
  // picks a class (not an assessment) and the routed assessment auto-selects.
  const classMode = !!info && Array.isArray(info.classes) && info.classes.length > 0

  const selectClass = (cls: CampaignClass) => {
    setSelectedClassId(cls.classId)
    setSelectedAssessmentId(cls.assessmentId)
    setSelectedTierId(null)
  }

  // Auto-select if there's only one option at any layer.
  useEffect(() => {
    if (!info || classMode) return
    if (selectedAssessmentId == null && info.assessments.length === 1) {
      setSelectedAssessmentId(info.assessments[0].assessmentId)
    }
  }, [info, selectedAssessmentId, classMode])

  // Class mode: if there's only one class, select it (and its assessment) outright.
  useEffect(() => {
    if (!info || !classMode || selectedClassId != null) return
    if (info.classes!.length === 1) {
      const only = info.classes![0]
      setSelectedClassId(only.classId)
      setSelectedAssessmentId(only.assessmentId)
    }
  }, [info, classMode, selectedClassId])

  // A stale or garbled deep-link id (deleted tier, retargeted link, NaN) must
  // not suppress the pickers and dead-end the page — drop it and fall back to
  // normal selection.
  useEffect(() => {
    if (!info || selectedAssessmentId == null) return
    if (!info.assessments.some((a) => a.assessmentId === selectedAssessmentId)) {
      setSelectedAssessmentId(null)
    }
  }, [info, selectedAssessmentId])

  const selectedAssessment: Assessment | null =
    info && selectedAssessmentId != null
      ? info.assessments.find((a) => a.assessmentId === selectedAssessmentId) || null
      : null

  useEffect(() => {
    if (!selectedAssessment || selectedTierId == null) return
    if (!selectedAssessment.tiers.some((t) => t.campaignAssessmentTierId === selectedTierId)) {
      setSelectedTierId(null)
    }
  }, [selectedAssessment, selectedTierId])

  useEffect(() => {
    if (selectedAssessment && selectedTierId == null && selectedAssessment.tiers.length === 1) {
      setSelectedTierId(selectedAssessment.tiers[0].campaignAssessmentTierId)
    }
  }, [selectedAssessment, selectedTierId])

  const selectedTier: Tier | null =
    selectedAssessment && selectedTierId != null
      ? selectedAssessment.tiers.find((t) => t.campaignAssessmentTierId === selectedTierId) || null
      : null

  const selectedClassRoute: CampaignClass | null =
    info && selectedClassId != null
      ? info.classes?.find((c) => c.classId === selectedClassId) || null
      : null

  // 18+ cohorts consent for themselves: class mode takes the flag off the picked
  // class route, deep-link mode off the selected assessment. Nothing picked yet
  // (or a legacy/null flag) → minor copy.
  const adult = !!(classMode ? selectedClassRoute?.audience18Plus : selectedAssessment?.audience18Plus)
  const { emailLabel, phoneLabel } = contactTerms(adult)

  // The consent wording itself changes with the cohort, so a re-selection that
  // flips the audience must be re-attested under the new copy. Functional
  // bail-out so an unchanged value doesn't re-render the form.
  useEffect(() => {
    setDpdpConsent((prev) => (prev ? false : prev))
  }, [adult])

  const isTryFirst = selectedAssessment?.purchasePath === "B"
  const isPaid = !isTryFirst && (selectedTier?.priceInr ?? 0) > 0
  // Match backend integer-truncation math (Java long division) so the price
  // shown here equals the amount actually charged by Razorpay.
  const discountedPriceInr = promoApplied && selectedTier
    ? Math.floor(selectedTier.priceInr * (100 - promoApplied.discountPercent) / 100)
    : (selectedTier?.priceInr ?? 0)

  // The native date picker works in yyyy-mm-dd; everything downstream of this
  // page (validation, payload, localStorage password) expects dd-mm-yyyy.
  const dobToInputValue = (d: string) => {
    const m = d.match(/^(\d{2})-(\d{2})-(\d{4})$/)
    return m ? `${m[3]}-${m[2]}-${m[1]}` : ""
  }

  const handleDobChange = (value: string) => {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    setDob(m ? `${m[3]}-${m[2]}-${m[1]}` : "")
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
    if (!dpdpConsent) {
      showErrorToast(
        adult
          ? "Please confirm the consent to continue."
          : "Please confirm the parental consent to continue."
      )
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showErrorToast("Please enter a valid email address.")
      return
    }
    // Allow optional leading +, digits, spaces, hyphens. 7-15 chars covers the
    // E.164 length range (intl) and common Indian 10-digit forms.
    if (!/^[+]?[\d\s-]{7,15}$/.test(phone.trim())) {
      showErrorToast("Please enter a valid phone number (7–15 digits).")
      return
    }

    setSubmitting(true)
    try {
      const data: any = {
        name: name.trim(),
        email: email.trim(),
        dob,
        phone: phone.trim(),
        // DPDP parental consent (submit is gated on the checkbox above).
        dpdpConsent,
      }
      if (!isTryFirst && promoApplied) data.promoCode = promoApplied.code
      if (selectedClassId != null) data.classId = selectedClassId

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
        // Required by mintAssessmentSessionCookie — /auth/assessment-session
        // verifies DOB against the stored record before issuing cn_at_asmnt.
        localStorage.setItem("studentDob", dob)
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
      <RegisterShell narrow>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px", gap: 16 }}>
          <div style={s.spinner} />
          <p style={{ color: "#64748b", fontSize: "0.95rem", margin: 0 }}>Loading campaign...</p>
        </div>
      </RegisterShell>
    )
  }

  // ── Error state ──
  if (error || !info) {
    return (
      <RegisterShell narrow>
        <div style={{ textAlign: "center", padding: "28px 8px" }}>
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
      </RegisterShell>
    )
  }

  const onlyOneAssessmentInUrl =
    aidFromUrl != null && info.assessments.some((a) => a.assessmentId === aidFromUrl)
  const onlyOneTierInUrl =
    tidFromUrl != null && selectedAssessment != null &&
    selectedAssessment.tiers.some((t) => t.campaignAssessmentTierId === tidFromUrl)
  // In class mode the class picker drives assessment selection, so the raw
  // assessment picker is hidden.
  const showClassPicker = classMode && info.classes!.length > 1
  const showAssessmentPicker = !classMode && !onlyOneAssessmentInUrl && info.assessments.length > 1
  const showTierPicker =
    !isTryFirst && !onlyOneTierInUrl && selectedAssessment !== null && selectedAssessment.tiers.length > 1
  const showLockedTier = !isTryFirst && !showTierPicker && selectedTier !== null
  const showForm = isTryFirst ? selectedAssessment !== null : selectedTier !== null

  // ── Main render ──
  const submitDisabled = submitting || !showForm
  const footer = (
    <>
      <SignInNote />
      <button
        type="submit"
        form="reg-form"
        disabled={submitDisabled}
        className="reg-footer-btn"
        style={{ ...s.btnPrimary, opacity: submitDisabled ? 0.7 : 1, cursor: submitDisabled ? "not-allowed" : "pointer" }}
      >
        {submitting ? (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ ...s.spinner, width: 18, height: 18, borderWidth: 2 }} />
            {isPaid && discountedPriceInr > 0 ? "Processing..." : isTryFirst ? "Starting..." : "Registering..."}
          </span>
        ) : !showForm ? (
          classMode ? "Select your class to continue" : "Choose an option to continue"
        ) : isPaid && discountedPriceInr > 0 ? (
          `Register & Pay INR ${discountedPriceInr}`
        ) : isTryFirst ? (
          "Start Assessment"
        ) : (
          "Register"
        )}
      </button>
    </>
  )

  const subtitle =
    info.campaign.targetAudience || info.campaign.description ? (
      <>
        {info.campaign.targetAudience && (
          <span style={{ color: "#10b981", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.78rem" }}>
            {info.campaign.targetAudience}
          </span>
        )}
        {info.campaign.targetAudience && info.campaign.description && " · "}
        {info.campaign.description}
      </>
    ) : undefined

  const selectStyle = (value: string) => ({ ...s.input, color: value ? "#1e293b" : "#94a3b8" })
  const onFocus = (e: React.FocusEvent<HTMLElement>) => Object.assign(e.target.style, s.inputFocus)
  const onBlur = (e: React.FocusEvent<HTMLElement>) => Object.assign(e.target.style, inputBlurStyle)

  return (
    <>
      <RegisterShell
        eyebrow="Campaign Registration"
        logoUrl={campaignLogoSrc(info.campaign.brandLogoUrl)}
        title={info.campaign.name}
        subtitle={subtitle}
        footer={footer}
      >
        {/* Class picker (class-based campaigns) — picking a class auto-selects
            its assessment and default tier. */}
        {showClassPicker && (
          <section>
            <h3 className="reg-section-title">Choose your class</h3>
            <div className="reg-grid">
              <div>
                <select
                  value={selectedClassId ?? ""}
                  onChange={(e) => {
                    const cid = e.target.value === "" ? null : Number(e.target.value)
                    const cls = cid == null ? null : info.classes!.find((c) => c.classId === cid) ?? null
                    if (cls) {
                      selectClass(cls)
                    } else {
                      setSelectedClassId(null)
                      setSelectedAssessmentId(null)
                      setSelectedTierId(null)
                    }
                  }}
                  style={selectStyle(selectedClassId ? String(selectedClassId) : "")}
                  onFocus={onFocus}
                  onBlur={onBlur}
                >
                  <option value="">Select your class</option>
                  {info.classes!.map((c) => {
                    const routed = info.assessments.find((a) => a.assessmentId === c.assessmentId)
                    return (
                      <option key={c.classId} value={c.classId}>
                        {c.className}{routed ? ` — ${routed.assessmentName}` : ""}
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>
          </section>
        )}

        {/* Assessment picker */}
        {showAssessmentPicker && (
          <section>
            <h3 className="reg-section-title">Choose your assessment</h3>
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
                    {a.description && (
                      <div style={s.optionCardDescription}>{a.description}</div>
                    )}
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
          <section>
            <h3 className="reg-section-title">Choose a tier</h3>
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

        {/* Locked-in tier summary (Pay-First only) — one row instead of a card */}
        {showLockedTier && selectedTier && (
          <TierStrip tier={selectedTier} label="Limited Time - Early Bird Offer" />
        )}

        {/* Registration form */}
        {showForm && (
          <form
            id="reg-form"
            className="reg-form"
            onSubmit={handleSubmit}
            // Enter in a text field must never submit the registration — only the
            // explicit submit button does. Field-level handlers (promo apply) still
            // run first, since the event bubbles from the input up to the form.
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault()
            }}
          >
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

            <div>
              <h3 className="reg-section-title">Your details</h3>
              <div className="reg-grid">
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
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>

                <div>
                  <label style={s.label}>
                    {emailLabel} <span style={{ color: "#f43f5e" }}>*</span>
                  </label>
                  <input
                    ref={emailRef}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={s.input}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>

                <div>
                  <label style={s.label}>
                    {phoneLabel} <span style={{ color: "#f43f5e" }}>*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="Enter phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    style={s.input}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>

                <div>
                  <label style={s.label}>
                    Date of Birth <span style={{ color: "#f43f5e" }}>*</span>
                  </label>
                  <input
                    ref={dobRef}
                    type="date"
                    value={dobToInputValue(dob)}
                    onChange={(e) => handleDobChange(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    required
                    style={selectStyle(dob)}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                  <div className="reg-hint">Also your sign-in password — keep it safe.</div>
                </div>

                {/* Promo code — hidden behind a toggle until the student asks for it */}
                {isPaid && (
                  <div>
                    {!showPromo && !promoApplied ? (
                      <button type="button" className="reg-inline-link" onClick={() => setShowPromo(true)}>
                        Do you have a promo code?
                      </button>
                    ) : (
                      <>
                        <label style={s.label}>Promo Code</label>
                        {promoApplied ? (
                          <div style={{
                            display: "flex", alignItems: "center", gap: 12,
                            background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)",
                            border: "1.5px solid #6ee7b7",
                            borderRadius: 10, padding: "9px 14px",
                          }}>
                            <div style={{
                              width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                              background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "0.8rem", color: "#059669",
                            }}>
                              ✓
                            </div>
                            <span style={{ color: "#065f46", fontWeight: 700, flex: 1, fontSize: "0.88rem" }}>
                              {promoApplied.code} — {promoApplied.discountPercent}% off
                              {promoApplied.discountPercent === 100 && " (Free!)"}
                            </span>
                            <button
                              type="button"
                              onClick={handleRemovePromo}
                              style={{
                                background: "none", border: "1.5px solid #fca5a5",
                                borderRadius: 8, padding: "3px 10px", color: "#ef4444",
                                fontWeight: 600, fontSize: "0.76rem", cursor: "pointer",
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              type="text"
                              placeholder="Enter promo code"
                              value={promoCode}
                              onChange={(e) => {
                                setPromoCode(e.target.value.toUpperCase())
                                setPromoError("")
                              }}
                              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleApplyPromo())}
                              style={{ ...s.input, flex: 1, minWidth: 0 }}
                              onFocus={onFocus}
                              onBlur={onBlur}
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
                          <div style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: 5 }}>{promoError}</div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Price summary when discount applied */}
                {isPaid && promoApplied && discountedPriceInr !== selectedTier!.priceInr && (
                  <div>
                    <div style={s.priceBadge}>
                      <span style={{ textDecoration: "line-through", opacity: 0.5, marginRight: 10, fontWeight: 500 }}>
                        INR {selectedTier!.priceInr}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>INR {discountedPriceInr}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <ParentalConsentSection checked={dpdpConsent} onChange={setDpdpConsent} adult={adult} />

            <p className="reg-hint" style={{ margin: 0, textAlign: "center" }}>
              By registering, I agree to the Career-9's terms and conditions.
            </p>
          </form>
        )}
      </RegisterShell>

      {/* Rendered outside the shell: the card's backdrop-filter would trap a
          fixed-position overlay inside the card. */}
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
    </>
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

// ── Styles: shared registration tokens + this page's picker/tier cards ──
const s: { [key: string]: React.CSSProperties } = {
  ...rs,
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
  optionCardDescription: {
    color: "#475569", fontSize: "0.82rem", lineHeight: 1.4, marginBottom: 6, whiteSpace: "pre-wrap" as const,
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
}

export default CampaignRegisterPage
