import { useEffect, useRef, useState } from "react"
import DuplicateEmailDialog, { DuplicateEmailPayload } from "../components/DuplicateEmailDialog"
import ParentalConsentSection from "../components/ParentalConsent"
import { useParams, useNavigate } from "react-router-dom"
import { showErrorToast } from '../utils/toast'
import {
  getMappingInfoByToken,
  registerStudentByToken,
  MappingInfo,
} from "../api-clients/assessmentMappingAPI"
import { validatePromoCode } from "../api-clients/promoCodeAPI"
import { validateReferralCode } from "../api-clients/referralCodeAPI"
import { TierStrip, Tier } from "../components/TierCard"
import { getInstituteTerms, contactTerms } from "../utils/instituteTerms"
import RegisterShell, { SignInNote } from "../components/RegisterShell"
import { rs, inputBlurStyle } from "../styles/registerStyles"

const AssessmentRegisterPage = () => {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [mappingInfo, setMappingInfo] = useState<MappingInfo | null>(null)
  const terms = getInstituteTerms(mappingInfo?.isSchool)
  // The B2B link maps one cohort, so the audience is constant for the whole page.
  const adult = !!mappingInfo?.audience18Plus
  const { emailLabel, phoneLabel } = contactTerms(adult)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [formError, setFormError] = useState("")
  // DPDP parental consent — registration cannot proceed without it.
  const [dpdpConsent, setDpdpConsent] = useState(false)

  // Form fields
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [dob, setDob] = useState("")
  const [phone, setPhone] = useState("")

  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateEmailPayload | null>(null)
  const emailRef = useRef<HTMLInputElement | null>(null)
  const dobRef = useRef<HTMLInputElement | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState("")
  const [selectedClassId, setSelectedClassId] = useState("")
  const [selectedSectionId, setSelectedSectionId] = useState("")

  // Promo code
  const [promoCode, setPromoCode] = useState("")
  const [promoApplied, setPromoApplied] = useState<{ code: string; discountPercent: number } | null>(null)
  const [promoError, setPromoError] = useState("")
  const [promoValidating, setPromoValidating] = useState(false)
  const [showPromo, setShowPromo] = useState(false)

  // Referral code
  const [hasReferral, setHasReferral] = useState(false)
  const [referralCode, setReferralCode] = useState("")
  const [referralApplied, setReferralApplied] = useState<{ code: string; name?: string } | null>(null)
  const [referralError, setReferralError] = useState("")
  const [referralValidating, setReferralValidating] = useState(false)

  useEffect(() => {
    if (token) {
      getMappingInfoByToken(token)
        .then((res) => {
          setMappingInfo(res.data)
          setLoading(false)
        })
        .catch(() => {
          setError("Invalid or expired assessment link.")
          setLoading(false)
        })
    }
  }, [token])

  const regBranding = mappingInfo?.branding
  // Base assessment/report price (the tier amount) — the "Assessment" line item.
  const amountInr: number = mappingInfo?.amount || 0
  // What the student actually pays at registration. PAY_FIRST folds the counselling
  // fee into this total; PAY_LATER charges only the assessment price (counselling is
  // paid per slot after the assessment). Falls back to the base amount.
  const payableInr: number = mappingInfo?.payableTotal ?? amountInr
  // Counselling fee breakdown (PAY_FIRST itemisation / PAY_LATER note).
  const counsellingFeePerSession = mappingInfo?.counsellingFeePerSession || 0
  const counsellingSessionCount = mappingInfo?.counsellingSessionCount || 0
  const counsellingFeeTotal = mappingInfo?.counsellingFeeTotal || 0
  const isPayFirst = (mappingInfo?.paymentTiming ?? "PAY_FIRST") === "PAY_FIRST"
  // Branch on the backend-resolved linkType, never on amount>0. A PAID link is
  // the single resolved wave price (one active tier — no picker).
  const isPaid = mappingInfo?.linkType === "PAID"
  const registrationClosed = mappingInfo?.registrationClosed === true

  // Mirror the backend's integer (floor) division so the displayed price matches the
  // charge. Discount applies to the full payable total (incl. any PAY_FIRST counselling fee).
  const discountedAmountInr = promoApplied
    ? Math.floor(payableInr * (100 - promoApplied.discountPercent) / 100)
    : payableInr

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
    if (!promoCode.trim()) return
    setPromoValidating(true)
    setPromoError("")
    setPromoApplied(null)

    try {
      const res = await validatePromoCode(promoCode.trim())
      setPromoApplied({
        code: res.data.code,
        discountPercent: res.data.discountPercent,
      })
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

  const handleApplyReferral = async () => {
    if (!referralCode.trim()) return
    const assessmentId = mappingInfo?.assessmentId
    if (!assessmentId) {
      setReferralError("Could not determine the assessment. Please reload.")
      return
    }
    setReferralValidating(true)
    setReferralError("")
    setReferralApplied(null)
    try {
      const res = await validateReferralCode(referralCode.trim(), assessmentId)
      setReferralApplied({ code: res.data.code, name: res.data.name })
    } catch (err: any) {
      const msg = err.response?.data || "Invalid referral code"
      setReferralError(typeof msg === "string" ? msg : "Invalid referral code")
    } finally {
      setReferralValidating(false)
    }
  }

  const handleRemoveReferral = () => {
    setReferralApplied(null)
    setReferralCode("")
    setReferralError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setFormError("")
    // Backstop for the cohort pickers, which now live outside the <form> and so
    // no longer take part in native form validation. The form only renders when
    // `selectionComplete` is already true, so this is defence in depth.
    if (!selectionComplete) {
      showErrorToast(
        mappingInfo?.mappingLevel === "INSTITUTE"
          ? `Please select your session and ${terms.unit.toLowerCase()}.`
          : `Please select your ${terms.unit.toLowerCase()}.`
      )
      return
    }
    if (!name.trim() || !email.trim() || !dob.trim() || !phone.trim()) {
      showErrorToast("Please fill in all required fields (Name, Email, Phone, Date of Birth).")
      return
    }

    const dobRegex = /^\d{2}-\d{2}-\d{4}$/
    if (!dobRegex.test(dob)) {
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      showErrorToast("Please enter a valid email address.")
      return
    }

    setSubmitting(true)
    try {
      const data: any = {
        name: name.trim(),
        email: email.trim(),
        dob: dob,
        phone: phone.trim(),
        // DPDP parental consent (submit is gated on the checkbox above).
        dpdpConsent,
      }

      if (selectedClassId) {
        data.classId = Number(selectedClassId)
      }
      if (selectedSectionId) {
        data.schoolSectionId = Number(selectedSectionId)
      }

      if (promoApplied) {
        data.promoCode = promoApplied.code
      }

      if (referralApplied) {
        data.referralCode = referralApplied.code
      }

      const res = await registerStudentByToken(token!, data)

      if (res.data.status === "payment_required") {
        if (res.data.paymentUrl) {
          window.location.href = res.data.paymentUrl
        } else {
          showErrorToast("Payment link could not be generated. Please try again.")
        }
        return
      }

      // Auto-login: backend returned a session payload. Write localStorage and
      // navigate the student straight to their allotted assessments. The success
      // "credentials card" UI below remains as a defensive fallback in case the
      // backend (during a partial rollout) returns success without a session.
      if (res.data.userStudentId && res.data.assessments) {
        localStorage.clear()
        localStorage.setItem('userStudentId', String(res.data.userStudentId))
        localStorage.setItem('allottedAssessments', JSON.stringify(res.data.assessments))
        // Required by mintAssessmentSessionCookie — /auth/assessment-session
        // verifies DOB against the stored record before issuing cn_at_asmnt.
        localStorage.setItem('studentDob', dob)
        navigate('/allotted-assessment')
        return
      }

      setResult(res.data)
    } catch (err: any) {
      const payload = err.response?.data
      if (payload && typeof payload === "object" && payload.status === "duplicate_email") {
        setDuplicateInfo(payload as DuplicateEmailPayload)
        setFormError("")
        return
      }
      const raw =
        payload?.message ||
        payload ||
        "Registration failed. Please try again."
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

  const availableClasses: any[] = mappingInfo?.availableClasses || []
  const availableSections: any[] = mappingInfo?.availableSections || []
  const availableSessions: any[] = mappingInfo?.availableSessions || []

  // INSTITUTE level: session → class → section cascade. The chosen session's
  // classes drive the class dropdown; the chosen class's sections drive the
  // section dropdown.
  const selectedSession: any = selectedSessionId
    ? availableSessions.find((sess: any) => String(sess.id) === selectedSessionId)
    : null
  const instituteClasses: any[] = selectedSession?.classes || []
  const instituteClassSections: any[] = selectedClassId
    ? (
        instituteClasses.find(
          (c: any) => String(c.id) === selectedClassId
        )?.sections || []
      )
    : []

  // Human-readable summary of what the link entitles the student to.
  const inclusionLines: string[] = (() => {
    const inc = mappingInfo?.inclusions
    if (!inc) return []
    const lines: string[] = []
    if (inc.includesFinalReport) lines.push("Detailed report")
    if (inc.includesDashboard) {
      lines.push(
        inc.dashboardValidityDays
          ? `Dashboard (${inc.dashboardValidityDays} days)`
          : "Dashboard access"
      )
    }
    if (inc.includesCounselling && inc.counsellingSessionCount) {
      lines.push(
        `${inc.counsellingSessionCount}× counselling session${
          inc.counsellingSessionCount > 1 ? "s" : ""
        }`
      )
    }
    if (inc.includesLms) {
      lines.push(inc.lmsValidityDays ? `LMS (${inc.lmsValidityDays} days)` : "LMS access")
    }
    return lines
  })()

  // The single resolved tier for this link, rendered as a B2C-style "Your
  // selection" card (one active tier — no picker on the B2B side).
  const inc = mappingInfo?.inclusions
  const selectionTier: Tier | null = mappingInfo
    ? {
        campaignAssessmentTierId: 0,
        name: mappingInfo.activeTierName || mappingInfo.assessmentName || "Assessment",
        basePriceInr: payableInr,
        priceInr: discountedAmountInr,
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

  // Show the selection card when there is anything meaningful to convey
  // (a named tier, a price, or at least one included feature).
  const showSelectionCard =
    !!selectionTier && (!!mappingInfo?.activeTierName || isPaid || inclusionLines.length > 0)

  // SESSION level: class dropdown from availableClasses, sections nested as
  // schoolSections under the chosen class.
  const selectedClassSections: any[] = selectedClassId
    ? (
        availableClasses.find(
          (c: any) => String(c.id) === selectedClassId
        )?.schoolSections || []
      )
    : []

  // ── Cohort picker (outside the form) ──
  const unitWord = terms.unit.toLowerCase()
  // A layer with a single option is auto-selected below, so its dropdown is hidden.
  const showSessionPicker = availableSessions.length > 1
  const showInstituteClassPicker = instituteClasses.length > 1
  const showSessionClassPicker = availableClasses.length > 1

  // Names of what was picked. With a single-option dropdown hidden, the summary
  // line below is the only place the resolved cohort is spelled out.
  const selectedSessionName: string = selectedSession?.sessionYear || ""
  const pickedClass: any =
    mappingInfo?.mappingLevel === "INSTITUTE"
      ? instituteClasses.find((c: any) => String(c.id) === selectedClassId)
      : availableClasses.find((c: any) => String(c.id) === selectedClassId)
  const selectedClassName: string = pickedClass?.className || ""
  const pickedSections: any[] =
    mappingInfo?.mappingLevel === "INSTITUTE" ? instituteClassSections : selectedClassSections
  const selectedSectionName: string =
    pickedSections.find((sc: any) => String(sc.id) === selectedSectionId)?.sectionName || ""

  // Auto-select the only option at each layer of the cascade.
  useEffect(() => {
    if (!mappingInfo) return
    if (mappingInfo.mappingLevel === "INSTITUTE") {
      if (!selectedSessionId) {
        // Resolve the session first; the class layer follows on the next pass,
        // once the chosen session's classes are derived.
        if (availableSessions.length === 1) {
          setSelectedSessionId(String(availableSessions[0].id))
          setSelectedClassId("")
          setSelectedSectionId("")
        }
        return
      }
      if (!selectedClassId && instituteClasses.length === 1) {
        setSelectedClassId(String(instituteClasses[0].id))
        setSelectedSectionId("")
      }
    } else if (mappingInfo.mappingLevel === "SESSION") {
      if (!selectedClassId && availableClasses.length === 1) {
        setSelectedClassId(String(availableClasses[0].id))
        setSelectedSectionId("")
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappingInfo, selectedSessionId, selectedClassId])

  // Title reflects what is actually pickable — a hidden single-option dropdown
  // turns "Choose your ..." into a plain "Your ..." restatement.
  const pickerTitle =
    mappingInfo?.mappingLevel === "INSTITUTE"
      ? showSessionPicker && showInstituteClassPicker
        ? `Choose your session and ${unitWord}`
        : showSessionPicker
          ? "Choose your session"
          : showInstituteClassPicker
            ? `Choose your ${unitWord}`
            : `Your ${unitWord}`
      : mappingInfo?.mappingLevel === "SESSION"
        ? showSessionClassPicker
          ? `Choose your ${unitWord}`
          : `Your ${unitWord}`
        : mappingInfo?.mappingLevel === "CLASS" && availableSections.length > 0
          ? "Choose your section"
          : ""

  const showPickerSection =
    (mappingInfo?.mappingLevel === "INSTITUTE" && availableSessions.length > 0) ||
    (mappingInfo?.mappingLevel === "SESSION" && availableClasses.length > 0) ||
    (mappingInfo?.mappingLevel === "CLASS" && availableSections.length > 0) ||
    mappingInfo?.mappingLevel === "SECTION"

  // The details form only renders once the cohort is resolved. An empty option
  // list is not a dead end: there is nothing to pick, so the gate is satisfied
  // (the old layout rendered no picker at all in that case).
  const selectionComplete =
    mappingInfo?.mappingLevel === "INSTITUTE"
      ? availableSessions.length === 0 ||
        (!!selectedSessionId && (instituteClasses.length === 0 || !!selectedClassId))
      : mappingInfo?.mappingLevel === "SESSION"
        ? availableClasses.length === 0 || !!selectedClassId
        : true // CLASS and SECTION: nothing required to pick; section is optional

  const waitingCopy =
    mappingInfo?.mappingLevel === "INSTITUTE"
      ? `Select your session and ${unitWord} above to continue. The details form appears once we know who is registering.`
      : `Select your ${unitWord} above to continue. The details form appears once we know who is registering.`

  // ── Loading State ──
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

  // ── Error State ──
  if (error) {
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
            {error} Please contact your school administrator for a valid link.
          </p>
        </div>
      </RegisterShell>
    )
  }

  // ── Registration Closed / Sold Out ──
  // HONOR registrationClosed from the backend. This fixes a bug where a
  // sold-out PAID link used to fall through and render as a free registration.
  if (registrationClosed) {
    return (
      <RegisterShell narrow>
        <div style={{ textAlign: "center", padding: "28px 8px" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%", margin: "0 auto 20px",
            background: "linear-gradient(135deg, #fef3c7, #fde68a)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2rem", color: "#92400e",
          }}>
            ⏳
          </div>
          <h3 style={{ color: "#1e293b", fontWeight: 700, marginBottom: 12 }}>
            Registration Closed
          </h3>
          <p style={{ color: "#64748b", fontSize: "0.92rem", lineHeight: 1.6, maxWidth: 400, margin: "0 auto" }}>
            Registrations for{" "}
            <strong>{mappingInfo?.assessmentName || "this assessment"}</strong>{" "}
            are currently closed or sold out. Please contact your school
            administrator for assistance.
          </p>
        </div>
      </RegisterShell>
    )
  }

  // ── Success / Already Registered ──
  // Defensive fallback only — auto-login above usually skips this branch.
  if (result) {
    const isAlreadyRegistered = result.status === "already_registered"
    return (
      <RegisterShell narrow>
        <div style={{ textAlign: "center", padding: "28px 8px" }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%", margin: "0 auto 24px",
            background: isAlreadyRegistered
              ? "linear-gradient(135deg, #fef3c7, #fde68a)"
              : "linear-gradient(135deg, #d1fae5, #6ee7b7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2.2rem", color: isAlreadyRegistered ? "#92400e" : "#065f46",
            boxShadow: isAlreadyRegistered
              ? "0 8px 32px rgba(251, 191, 36, 0.3)"
              : "0 8px 32px rgba(16, 185, 129, 0.3)",
          }}>
            {isAlreadyRegistered ? "!" : "✓"}
          </div>

          <h3 style={{ color: "#1e293b", fontWeight: 700, marginBottom: 8 }}>
            {isAlreadyRegistered ? "Already Registered" : "Registration Successful!"}
          </h3>
          <p style={{ color: "#64748b", fontSize: "0.92rem", marginBottom: 24 }}>
            {result.message}
          </p>

          {result.username && (
            <div style={{
              background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
              border: "1.5px solid #a7f3d0",
              borderRadius: 16, padding: "24px 28px", textAlign: "left",
              marginBottom: 24, maxWidth: 360, marginLeft: "auto", marginRight: "auto",
            }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#059669", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
                Your Login Credentials
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: 4 }}>Username</div>
                  <div style={{
                    background: "#fff", borderRadius: 10, padding: "10px 16px",
                    fontWeight: 700, fontSize: "1rem", color: "#1e293b",
                    border: "1px solid #d1fae5",
                    fontFamily: "monospace",
                  }}>
                    {result.username}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: 4 }}>Password (Date of Birth)</div>
                  <div style={{
                    background: "#fff", borderRadius: 10, padding: "10px 16px",
                    fontWeight: 700, fontSize: "1rem", color: "#1e293b",
                    border: "1px solid #d1fae5",
                    fontFamily: "monospace",
                  }}>
                    {result.dob}
                  </div>
                </div>
              </div>
            </div>
          )}

          <p style={{ color: "#94a3b8", fontSize: "0.82rem", marginBottom: 24 }}>
            Please save these credentials. You will need them to log in and take the assessment.
          </p>

          <button
            onClick={() => navigate("/student-login")}
            style={s.btnPrimary}
          >
            Go to Student Login
          </button>
        </div>
      </RegisterShell>
    )
  }

  // ── Registration Form ──
  const submitDisabled = submitting || !selectionComplete
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
            {isPaid && discountedAmountInr > 0 ? "Processing..." : "Registering..."}
          </span>
        ) : !selectionComplete ? (
          `Select your ${unitWord} to continue`
        ) : isPaid && discountedAmountInr > 0 ? (
          `Register & Pay INR ${discountedAmountInr}`
        ) : (
          "Register"
        )}
      </button>
    </>
  )

  // The class picker is hidden when there is a single option; the resolved
  // cohort is then spelled out in a chip so the student still sees it.
  const classPickerHidden =
    mappingInfo?.mappingLevel === "INSTITUTE"
      ? !showInstituteClassPicker
      : mappingInfo?.mappingLevel === "SESSION"
        ? !showSessionClassPicker
        : true

  const selectStyle = (value: string) => ({ ...s.input, color: value ? "#1e293b" : "#94a3b8" })
  const onFocus = (e: React.FocusEvent<HTMLElement>) => Object.assign(e.target.style, s.inputFocus)
  const onBlur = (e: React.FocusEvent<HTMLElement>) => Object.assign(e.target.style, inputBlurStyle)

  return (
    <>
      <RegisterShell
        eyebrow="Assessment Registration"
        logoUrl={regBranding?.whitelabel ? regBranding.logoUrl : undefined}
        title={mappingInfo?.assessmentName || "Assessment"}
        subtitle={
          <>
            {mappingInfo?.instituteName || ""}
            {mappingInfo?.className && ` · ${terms.unit} ${mappingInfo.className}`}
            {mappingInfo?.sectionName && ` (${mappingInfo.sectionName})`}
            {mappingInfo?.sessionYear && ` · ${mappingInfo.sessionYear}`}
          </>
        }
        footer={footer}
      >
        {/* Your selection — the resolved tier, its price and inclusions, one row. */}
        {showSelectionCard && selectionTier && <TierStrip tier={selectionTier} />}

        {/* Cohort picker — outside the <form> so the details form appears only
            once the session/class cascade has resolved who is registering. */}
        {showPickerSection && (
          <section>
            {pickerTitle && <h3 className="reg-section-title">{pickerTitle}</h3>}

            <div className="reg-grid reg-grid--auto">
              {/* Session → Class → Section cascade for INSTITUTE level */}
              {mappingInfo?.mappingLevel === "INSTITUTE" && availableSessions.length > 0 && (
                <>
                  {showSessionPicker && (
                    <div>
                      <label style={s.label}>
                        Session <span style={{ color: "#f43f5e" }}>*</span>
                      </label>
                      <select
                        value={selectedSessionId}
                        onChange={(e) => {
                          setSelectedSessionId(e.target.value)
                          setSelectedClassId("")
                          setSelectedSectionId("")
                        }}
                        style={selectStyle(selectedSessionId)}
                        onFocus={onFocus}
                        onBlur={onBlur}
                      >
                        <option value="">Select Session</option>
                        {availableSessions.map((sess: any) => (
                          <option key={sess.id} value={sess.id}>{sess.sessionYear}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {selectedSessionId && instituteClasses.length > 0 && showInstituteClassPicker && (
                    <div>
                      <label style={s.label}>
                        {terms.unit} <span style={{ color: "#f43f5e" }}>*</span>
                      </label>
                      <select
                        value={selectedClassId}
                        onChange={(e) => {
                          setSelectedClassId(e.target.value)
                          setSelectedSectionId("")
                        }}
                        style={selectStyle(selectedClassId)}
                        onFocus={onFocus}
                        onBlur={onBlur}
                      >
                        <option value="">{terms.selectUnit}</option>
                        {instituteClasses.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.className}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {selectedSessionId && instituteClasses.length > 0 && instituteClassSections.length > 0 && (
                    <div>
                      <label style={s.label}>Section</label>
                      <select
                        value={selectedSectionId}
                        onChange={(e) => setSelectedSectionId(e.target.value)}
                        style={selectStyle(selectedSectionId)}
                        onFocus={onFocus}
                        onBlur={onBlur}
                      >
                        <option value="">Select Section (Optional)</option>
                        {instituteClassSections.map((sc: any) => (
                          <option key={sc.id} value={sc.id}>{sc.sectionName}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* Class (+ Section) dropdowns for SESSION level */}
              {mappingInfo?.mappingLevel === "SESSION" && availableClasses.length > 0 && (
                <>
                  {showSessionClassPicker && (
                    <div>
                      <label style={s.label}>
                        {terms.unit} <span style={{ color: "#f43f5e" }}>*</span>
                      </label>
                      <select
                        value={selectedClassId}
                        onChange={(e) => {
                          setSelectedClassId(e.target.value)
                          setSelectedSectionId("")
                        }}
                        style={selectStyle(selectedClassId)}
                        onFocus={onFocus}
                        onBlur={onBlur}
                      >
                        <option value="">{terms.selectUnit}</option>
                        {availableClasses.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.className}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {selectedClassSections.length > 0 && (
                    <div>
                      <label style={s.label}>Section</label>
                      <select
                        value={selectedSectionId}
                        onChange={(e) => setSelectedSectionId(e.target.value)}
                        style={selectStyle(selectedSectionId)}
                        onFocus={onFocus}
                        onBlur={onBlur}
                      >
                        <option value="">Select Section (Optional)</option>
                        {selectedClassSections.map((sc: any) => (
                          <option key={sc.id} value={sc.id}>{sc.sectionName}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* Section dropdown for CLASS level */}
              {mappingInfo?.mappingLevel === "CLASS" && availableSections.length > 0 && (
                <div>
                  <label style={s.label}>Section</label>
                  <select
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                    style={selectStyle(selectedSectionId)}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  >
                    <option value="">Select Section (Optional)</option>
                    {availableSections.map((sc: any) => (
                      <option key={sc.id} value={sc.id}>{sc.sectionName}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Pre-filled info for SECTION level */}
              {mappingInfo?.mappingLevel === "SECTION" && (
                <div className="reg-strip reg-span2" style={{ padding: "10px 16px" }}>
                  <div className="reg-strip-sub" style={{ marginTop: 0, fontSize: "0.88rem" }}>
                    {terms.unit}: <strong>{mappingInfo.className}</strong> &middot; Section: <strong>{mappingInfo.sectionName}</strong>
                  </div>
                </div>
              )}

              {/* What was picked — only needed when the class dropdown itself is
                  hidden (single option), otherwise the dropdown already shows it. */}
              {selectedClassName && classPickerHidden && (
                <div className="reg-strip reg-span2" style={{ padding: "10px 16px" }}>
                  <div className="reg-strip-sub" style={{ marginTop: 0, fontSize: "0.88rem" }}>
                    {terms.unit}: <strong>{selectedClassName}</strong>
                    {mappingInfo?.mappingLevel === "INSTITUTE" && selectedSessionName && (
                      <> &middot; Session <strong>{selectedSessionName}</strong></>
                    )}
                    {selectedSectionName && (
                      <> &middot; Section <strong>{selectedSectionName}</strong></>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {!selectionComplete && (
          <p style={s.waiting}>{waitingCopy}</p>
        )}

        {selectionComplete && (
          <form
            id="reg-form"
            className="reg-form"
            onSubmit={handleSubmit}
            // Enter in a text field must never submit the registration — only the
            // explicit submit button does. Field-level handlers (promo/referral apply)
            // still run first, since the event bubbles from the input up to the form.
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
                {/* Name */}
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

                {/* Email */}
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

                {/* Phone */}
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

                {/* DOB */}
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

                {/* Counselling fee itemisation. PAY_FIRST: the fee is added to the
                    registration total and paid upfront. PAY_LATER: only the assessment
                    price is paid now; counselling is paid per slot after the assessment. */}
                {isPaid && counsellingFeePerSession > 0 && isPayFirst && counsellingFeeTotal > 0 && (
                  <div className="reg-span2" style={{
                    background: "linear-gradient(135deg, #eef2ff, #f5f3ff)",
                    border: "1.5px solid #c7d2fe", borderRadius: 12,
                    padding: "12px 16px", fontSize: "0.88rem", color: "#3730a3",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span>Assessment</span><strong>₹{amountInr.toLocaleString("en-IN")}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span>Counselling (₹{counsellingFeePerSession.toLocaleString("en-IN")} × {counsellingSessionCount})</span>
                      <strong>₹{counsellingFeeTotal.toLocaleString("en-IN")}</strong>
                    </div>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      borderTop: "1px solid #c7d2fe", paddingTop: 6, marginTop: 2, fontSize: "0.95rem",
                    }}>
                      <span style={{ fontWeight: 700 }}>Total</span>
                      <strong style={{ fontWeight: 800 }}>₹{payableInr.toLocaleString("en-IN")}</strong>
                    </div>
                  </div>
                )}
                {isPaid && counsellingFeePerSession > 0 && !isPayFirst && (
                  <div className="reg-span2" style={{ fontSize: "0.82rem", color: "#64748b" }}>
                    Counselling is ₹{counsellingFeePerSession.toLocaleString("en-IN")}/session — pay later when you book your slot after the assessment.
                  </div>
                )}

                {/* Promo Code — hidden behind a toggle until the student asks for it */}
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
                              &#10003;
                            </div>
                            <span style={{ color: "#065f46", fontWeight: 700, flex: 1, fontSize: "0.88rem" }}>
                              {promoApplied.code} &mdash; {promoApplied.discountPercent}% off
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
                          <div style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: 5 }}>
                            {promoError}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Referral Code — available for free and paid links */}
                <div>
                  {!hasReferral && !referralApplied ? (
                    <button type="button" className="reg-inline-link" onClick={() => setHasReferral(true)}>
                      + Have a referral code?
                    </button>
                  ) : (
                    <>
                      <label style={s.label}>Referral Code</label>
                      {referralApplied ? (
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
                            &#10003;
                          </div>
                          <span style={{ color: "#065f46", fontWeight: 700, flex: 1, fontSize: "0.88rem" }}>
                            {referralApplied.code}{referralApplied.name ? ` — ${referralApplied.name}` : ""}
                          </span>
                          <button
                            type="button"
                            onClick={handleRemoveReferral}
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
                            placeholder="Enter referral code"
                            value={referralCode}
                            onChange={(e) => {
                              setReferralCode(e.target.value.toUpperCase())
                              setReferralError("")
                            }}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleApplyReferral())}
                            style={{ ...s.input, flex: 1, minWidth: 0 }}
                            onFocus={onFocus}
                            onBlur={onBlur}
                          />
                          <button
                            type="button"
                            onClick={handleApplyReferral}
                            disabled={referralValidating || !referralCode.trim()}
                            style={{
                              ...s.btnOutline,
                              opacity: referralValidating || !referralCode.trim() ? 0.5 : 1,
                              cursor: referralValidating || !referralCode.trim() ? "not-allowed" : "pointer",
                            }}
                          >
                            {referralValidating ? "..." : "Verify"}
                          </button>
                        </div>
                      )}
                      {referralError && (
                        <div style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: 5 }}>
                          {referralError}
                        </div>
                      )}
                    </>
                  )}
                </div>
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

// ── Styles (shared with the other registration pages) ──
const s = rs

export default AssessmentRegisterPage
