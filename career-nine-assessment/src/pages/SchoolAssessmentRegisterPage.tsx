import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { showErrorToast } from "../utils/toast";
import http from "../api/http";
import { getSchoolInfo, registerSchoolStudent, verifyStudentDetails } from "../api-clients/schoolRegistrationAPI";
import { getInstituteTerms, contactTerms } from "../utils/instituteTerms";
import { validatePromoCode } from "../api-clients/promoCodeAPI";
import { validateReferralCode } from "../api-clients/referralCodeAPI";
import ParentalConsentSection from "../components/ParentalConsent";
import RegisterShell, { SignInNote } from "../components/RegisterShell";
import { rs, inputBlurStyle } from "../styles/registerStyles";

const SchoolAssessmentRegisterPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Form fields
  const terms = getInstituteTerms(schoolInfo?.isSchool);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");

  // Promo code
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ code: string; discountPercent: number } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);
  const [showPromo, setShowPromo] = useState(false);
  // DPDP parental consent — registration cannot proceed without it.
  const [dpdpConsent, setDpdpConsent] = useState(false);

  // Referral code
  const [hasReferral, setHasReferral] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referralApplied, setReferralApplied] = useState<{ code: string; name?: string } | null>(null);
  const [referralError, setReferralError] = useState("");
  const [referralValidating, setReferralValidating] = useState(false);

  // Pre-submit duplicate verification
  type VerifyStatus = "idle" | "verifying" | "verified" | "partial" | "duplicate";
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("idle");
  const [verifyResult, setVerifyResult] = useState<{ username?: string; password?: string } | null>(null);

  useEffect(() => {
    if (token) {
      getSchoolInfo(token)
        .then((res) => { setSchoolInfo(res.data); setLoading(false); })
        .catch(() => { setError("Invalid or expired registration link."); setLoading(false); });
    }
  }, [token]);

  useEffect(() => {
    // Functional bail-out: only touch state when it actually changes, so a
    // keystroke doesn't double-render the whole form (react-hooks/set-state-in-effect).
    setVerifyStatus((prev) => (prev === "idle" ? prev : "idle"));
    setVerifyResult((prev) => (prev === null ? prev : null));

    if (!token) return;
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const trimmedDob = dob.trim();
    if (!trimmedEmail || !trimmedPhone || !trimmedDob) return;
    if (!/^\d{2}-\d{2}-\d{4}$/.test(trimmedDob)) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return;

    let cancelled = false;
    const handle = setTimeout(() => {
      if (cancelled) return;
      setVerifyStatus("verifying");
      verifyStudentDetails(token, { email: trimmedEmail, phone: trimmedPhone, dob: trimmedDob })
        .then((res) => {
          if (cancelled) return;
          const data = res.data || {};
          if (data.status === "already_registered") {
            setVerifyStatus("duplicate");
            setVerifyResult({ username: data.username, password: data.dob });
          } else if (data.status === "partial_match") {
            setVerifyStatus("partial");
            setVerifyResult({ username: data.username, password: data.dob });
          } else {
            setVerifyStatus("verified");
            setVerifyResult(null);
          }
        })
        .catch(() => {
          if (cancelled) return;
          // Fall back to verified so a transient backend hiccup doesn't permanently block submission;
          // the existing submit-time duplicate check is still the backstop.
          setVerifyStatus("verified");
          setVerifyResult(null);
        });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [email, phone, dob, token]);

  // Derived: selected class config
  const classes: any[] = schoolInfo?.classes || [];
  const selectedClassConfig = classes.find((c: any) => String(c.classId) === selectedClassId);
  const sections: any[] = selectedClassConfig?.sections || [];
  const assessmentName: string = selectedClassConfig?.assessmentName || "";
  // Backend /public/info returns the active tier amount already in rupees
  // (SchoolAssessmentTier.amount; RazorpayService converts to paise at the API edge).
  const amountRupees: number = selectedClassConfig?.amount || 0;
  const isPaid = amountRupees > 0;
  const unitWord = terms.unit.toLowerCase();

  // The class picker lives outside the form; the details form only renders once
  // a class is chosen, so we always know which cohort (and audience) is filling
  // it in. A lone class is auto-selected below, so its picker is hidden.
  const showClassPicker = classes.length > 1;
  const selectionComplete = !!selectedClassId;

  // 18+ cohorts consent for themselves. The flag is per class row, so it is
  // re-derived on every class change; no class picked yet → minor copy.
  const adult = !!selectedClassConfig?.audience18Plus;
  const { emailLabel, phoneLabel } = contactTerms(adult);

  // The consent wording itself changes with the cohort, so a class re-selection
  // that flips the audience must be re-attested under the new copy. Functional
  // bail-out so an unchanged value doesn't re-render the form.
  useEffect(() => {
    setDpdpConsent((prev) => (prev ? false : prev));
  }, [adult]);

  // Mirror the backend's integer (floor) division so the displayed price matches the charge.
  const discountedAmountRupees = promoApplied
    ? Math.floor(amountRupees * (100 - promoApplied.discountPercent) / 100)
    : amountRupees;

  // The native date picker works in yyyy-mm-dd; everything downstream of this
  // page (validation, payload, localStorage password) expects dd-mm-yyyy.
  const dobToInputValue = (d: string) => {
    const m = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  };

  const handleDobChange = (value: string) => {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    setDob(m ? `${m[3]}-${m[2]}-${m[1]}` : "");
  };

  const handleClassChange = (val: string) => {
    setSelectedClassId(val);
    setSelectedSectionId("");
    // Reset promo when class changes (different assessment/amount)
    setPromoApplied(null);
    setPromoCode("");
    setPromoError("");
  };

  // If there's only one class, select it outright — a one-item dropdown is noise
  // and the details form is gated on a class being chosen.
  useEffect(() => {
    if (!schoolInfo || selectedClassId) return;
    if (classes.length === 1) {
      handleClassChange(String(classes[0].classId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolInfo, selectedClassId]);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoValidating(true);
    setPromoError("");
    setPromoApplied(null);
    try {
      const res = await validatePromoCode(promoCode.trim());
      setPromoApplied({ code: res.data.code, discountPercent: res.data.discountPercent });
    } catch (err: any) {
      const msg = err.response?.data || "Invalid promo code";
      setPromoError(typeof msg === "string" ? msg : "Invalid promo code");
    } finally {
      setPromoValidating(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoApplied(null);
    setPromoCode("");
    setPromoError("");
  };

  const handleApplyReferral = async () => {
    if (!referralCode.trim()) return;
    const assessmentId = selectedClassConfig?.assessmentId;
    if (!assessmentId) {
      setReferralError("Please select your class first.");
      return;
    }
    setReferralValidating(true);
    setReferralError("");
    setReferralApplied(null);
    try {
      const res = await validateReferralCode(referralCode.trim(), Number(assessmentId));
      setReferralApplied({ code: res.data.code, name: res.data.name });
    } catch (err: any) {
      const msg = err.response?.data || "Invalid referral code";
      setReferralError(typeof msg === "string" ? msg : "Invalid referral code");
    } finally {
      setReferralValidating(false);
    }
  };

  const handleRemoveReferral = () => {
    setReferralApplied(null);
    setReferralCode("");
    setReferralError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !phone.trim() || !dob.trim()) {
      showErrorToast("Please fill in all required fields.");
      return;
    }
    if (!selectedClassId) {
      showErrorToast("Please select your class.");
      return;
    }
    if (!dpdpConsent) {
      showErrorToast(
        adult
          ? "Please confirm the consent to continue."
          : "Please confirm the parental consent to continue."
      );
      return;
    }
    if (!/^\d{2}-\d{2}-\d{4}$/.test(dob)) {
      showErrorToast("Date of Birth must be in dd-mm-yyyy format.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showErrorToast("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const data: any = {
        name: name.trim(),
        email: email.trim(),
        dob,
        phone: phone.trim(),
        classId: Number(selectedClassId),
        // DPDP parental consent (submit is gated on the checkbox above).
        dpdpConsent,
      };
      if (selectedSectionId) data.schoolSectionId = Number(selectedSectionId);
      if (promoApplied) data.promoCode = promoApplied.code;
      if (referralApplied) data.referralCode = referralApplied.code;

      const res = await registerSchoolStudent(token!, data);

      // BUG FIX: handle payment_required with null paymentUrl
      if (res.data.status === "payment_required") {
        if (res.data.paymentUrl) {
          window.location.href = res.data.paymentUrl;
        } else {
          showErrorToast("Payment link could not be generated. Please try again.");
        }
        return;
      }

      // Auto-login: the student account exists server-side now (freshly created,
      // or already registered). Reuse the student-login endpoint with the returned
      // username + the DOB they just typed to obtain the session payload, then drop
      // them straight into their allotted assessments — same UX as the
      // assessment-register flow. The credentials card below stays as a fallback
      // for any case where auto-login can't complete.
      if (res.data.username) {
        try {
          const { data: session } = await http.post('/user/auth', {
            dobDate: dob,
            username: res.data.username,
          });
          if (session && session.userStudentId) {
            localStorage.clear();
            localStorage.setItem('userStudentId', String(session.userStudentId));
            localStorage.setItem('allottedAssessments', JSON.stringify(session.assessments));
            // Stored so /auth/assessment-session can verify identity later
            // (DOB requirement) when minting the assessment cookie on Start.
            localStorage.setItem('studentDob', dob);
            navigate('/allotted-assessment');
            return;
          }
        } catch {
          // Fall through to the credentials card on any auto-login failure.
        }
      }

      setResult(res.data);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || "Registration failed. Please try again.";
      showErrorToast(typeof msg === "string" ? msg : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <RegisterShell narrow>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px", gap: 16 }}>
          <div style={s.spinner} />
          <p style={{ color: "#64748b", fontSize: "0.95rem", margin: 0 }}>Loading school information...</p>
        </div>
      </RegisterShell>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <RegisterShell narrow>
        <div style={{ textAlign: "center", padding: "28px 8px" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", margin: "0 auto 20px", background: "linear-gradient(135deg, #fee2e2, #fecaca)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>!</div>
          <h3 style={{ color: "#1e293b", fontWeight: 700, marginBottom: 12 }}>Link Unavailable</h3>
          <p style={{ color: "#64748b", fontSize: "0.92rem", lineHeight: 1.6, maxWidth: 400, margin: "0 auto" }}>
            {error} Please contact your school administrator for a valid link.
          </p>
        </div>
      </RegisterShell>
    );
  }

  // ── Success / Already Registered ──
  if (result) {
    const isAlreadyRegistered = result.status === "already_registered";
    return (
      <RegisterShell narrow>
        <div style={{ textAlign: "center", padding: "28px 8px" }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%", margin: "0 auto 24px",
            background: isAlreadyRegistered ? "linear-gradient(135deg, #fef3c7, #fde68a)" : "linear-gradient(135deg, #d1fae5, #6ee7b7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2.2rem", color: isAlreadyRegistered ? "#92400e" : "#065f46",
            boxShadow: isAlreadyRegistered ? "0 8px 32px rgba(251, 191, 36, 0.3)" : "0 8px 32px rgba(16, 185, 129, 0.3)",
          }}>
            {isAlreadyRegistered ? "!" : "✓"}
          </div>
          <h3 style={{ color: "#1e293b", fontWeight: 700, marginBottom: 8 }}>
            {isAlreadyRegistered ? "Already Registered" : "Registration Successful!"}
          </h3>
          <p style={{ color: "#64748b", fontSize: "0.92rem", marginBottom: 24 }}>{result.message}</p>

          {result.username && (
            <div style={{
              background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
              border: "1.5px solid #a7f3d0", borderRadius: 16, padding: "24px 28px",
              textAlign: "left", marginBottom: 24, maxWidth: 360, marginLeft: "auto", marginRight: "auto",
            }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#059669", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
                Your Login Credentials
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: 4 }}>Username</div>
                  <div style={{ background: "#fff", borderRadius: 10, padding: "10px 16px", fontWeight: 700, fontSize: "1rem", color: "#1e293b", border: "1px solid #d1fae5", fontFamily: "monospace" }}>
                    {result.username}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: 4 }}>Password (Date of Birth)</div>
                  <div style={{ background: "#fff", borderRadius: 10, padding: "10px 16px", fontWeight: 700, fontSize: "1rem", color: "#1e293b", border: "1px solid #d1fae5", fontFamily: "monospace" }}>
                    {result.dob}
                  </div>
                </div>
              </div>
            </div>
          )}

          <p style={{ color: "#94a3b8", fontSize: "0.82rem", marginBottom: 24 }}>
            Please save these credentials. You will need them to log in and take the assessment.
          </p>
          <button onClick={() => window.location.replace("/student-login")} style={s.btnPrimary}>Go to Student Login</button>
        </div>
      </RegisterShell>
    );
  }

  // ── Registration Form ──
  const submitBlocked = submitting || !selectedClassId || verifyStatus !== "verified";
  const footer = (
    <>
      <SignInNote />
      <button
        type="submit"
        form="reg-form"
        disabled={submitBlocked}
        className="reg-footer-btn"
        style={{ ...s.btnPrimary, opacity: submitBlocked ? 0.7 : 1, cursor: submitBlocked ? "not-allowed" : "pointer" }}
      >
        {submitting ? (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ ...s.spinner, width: 18, height: 18, borderWidth: 2 }} />
            {isPaid && discountedAmountRupees > 0 ? "Processing..." : "Registering..."}
          </span>
        ) : !selectedClassId ? (
          `Select a ${unitWord} to continue`
        ) : verifyStatus === "verifying" ? (
          "Verifying details..."
        ) : verifyStatus === "duplicate" ? (
          "Already registered — please login"
        ) : verifyStatus === "partial" ? (
          "Change email or phone to continue"
        ) : verifyStatus === "idle" ? (
          "Fill email, phone and date of birth"
        ) : isPaid && discountedAmountRupees > 0 ? (
          `Register & Pay INR ${discountedAmountRupees}`
        ) : (
          "Register"
        )}
      </button>
    </>
  );

  return (
    <RegisterShell
      eyebrow="Assessment Registration"
      logoUrl={schoolInfo?.branding?.whitelabel ? schoolInfo?.branding?.logoUrl : undefined}
      title={schoolInfo?.instituteName || "School"}
      subtitle={schoolInfo?.sessionYear ? `Session ${schoolInfo.sessionYear}` : undefined}
      footer={footer}
    >
      {/* Cohort picker — outside the <form> so the details form appears only
          once a class is chosen and we know who is registering. */}
      <section>
        <h3 className="reg-section-title">{showClassPicker ? `Choose your ${unitWord}` : `Your ${unitWord}`}</h3>
        <div className="reg-grid reg-grid--auto">
          {showClassPicker && (
            <div>
              <label style={s.label}>{terms.unit} <span style={{ color: "#f43f5e" }}>*</span></label>
              <select
                value={selectedClassId}
                onChange={(e) => handleClassChange(e.target.value)}
                style={{ ...s.input, color: selectedClassId ? "#1e293b" : "#94a3b8" }}
                onFocus={(e) => Object.assign(e.target.style, s.inputFocus)}
                onBlur={(e) => Object.assign(e.target.style, inputBlurStyle)}
              >
                <option value="">{terms.selectUnit}</option>
                {classes.map((c: any) => (
                  <option key={c.classId} value={c.classId}>{c.className}</option>
                ))}
              </select>
            </div>
          )}
          {sections.length > 0 && (
            <div>
              <label style={s.label}>Section</label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                style={{ ...s.input, color: selectedSectionId ? "#1e293b" : "#94a3b8" }}
                onFocus={(e) => Object.assign(e.target.style, s.inputFocus)}
                onBlur={(e) => Object.assign(e.target.style, inputBlurStyle)}
              >
                <option value="">Select Section (Optional)</option>
                {sections.map((sec: any) => (
                  <option key={sec.sectionId} value={sec.sectionId}>{sec.sectionName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Auto-filled assessment info + price, one row */}
          {selectedClassId && assessmentName && (
            <div className="reg-strip reg-span2">
              <div className="reg-strip-main">
                <div className="reg-strip-label">Assessment</div>
                <div className="reg-strip-title">{assessmentName}</div>
                {/* With the picker hidden this is the only place the chosen class is named. */}
                {!showClassPicker && selectedClassConfig?.className && (
                  <div className="reg-strip-sub">
                    {terms.unit}: <strong>{selectedClassConfig.className}</strong>
                  </div>
                )}
              </div>
              <div className="reg-strip-price">
                {promoApplied && discountedAmountRupees !== amountRupees ? (
                  <>
                    <s>INR {amountRupees}</s>
                    INR {discountedAmountRupees}
                  </>
                ) : isPaid ? (
                  `INR ${amountRupees}`
                ) : (
                  "Free"
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {!selectionComplete && (
        <p style={s.waiting}>
          Select your {unitWord} above to continue. The details form appears once we know who is registering.
        </p>
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
            if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
          }}
        >
          <div>
            <h3 className="reg-section-title">Your details</h3>
            <div className="reg-grid">
              {/* Name */}
              <div>
                <label style={s.label}>Full Name <span style={{ color: "#f43f5e" }}>*</span></label>
                <input type="text" placeholder="Enter your full name" value={name} onChange={(e) => setName(e.target.value)} required style={s.input}
                  onFocus={(e) => Object.assign(e.target.style, s.inputFocus)} onBlur={(e) => Object.assign(e.target.style, inputBlurStyle)} />
              </div>

              {/* Email */}
              <div>
                <label style={s.label}>{emailLabel} <span style={{ color: "#f43f5e" }}>*</span></label>
                <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={s.input}
                  onFocus={(e) => Object.assign(e.target.style, s.inputFocus)} onBlur={(e) => Object.assign(e.target.style, inputBlurStyle)} />
              </div>

              {/* Phone */}
              <div>
                {/* Phone is genuinely mandatory: the duplicate-check round-trip
                    (which gates the submit button) only fires once email+phone+dob
                    are all filled — rendering it as optional left students unable
                    to submit with no explanation. */}
                <label style={s.label}>{phoneLabel} <span style={{ color: "#f43f5e" }}>*</span></label>
                <input type="tel" placeholder="Enter phone number" value={phone} onChange={(e) => setPhone(e.target.value)} required style={s.input}
                  onFocus={(e) => Object.assign(e.target.style, s.inputFocus)} onBlur={(e) => Object.assign(e.target.style, inputBlurStyle)} />
              </div>

              {/* DOB */}
              <div>
                <label style={s.label}>Date of Birth <span style={{ color: "#f43f5e" }}>*</span></label>
                <input type="date" value={dobToInputValue(dob)} onChange={(e) => handleDobChange(e.target.value)}
                  max={new Date().toISOString().split("T")[0]} required
                  style={{ ...s.input, color: dob ? "#1e293b" : "#94a3b8" }}
                  onFocus={(e) => Object.assign(e.target.style, s.inputFocus)} onBlur={(e) => Object.assign(e.target.style, inputBlurStyle)} />
                <div className="reg-hint">Also your sign-in password — keep it safe.</div>
              </div>

              {verifyStatus !== "idle" && (
                <div
                  className="reg-span2"
                  style={{
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontSize: "0.85rem",
                    lineHeight: 1.5,
                    ...(verifyStatus === "verifying" && { background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }),
                    ...(verifyStatus === "verified" && { background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" }),
                    ...(verifyStatus === "partial" && { background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }),
                    ...(verifyStatus === "duplicate" && { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }),
                  }}
                >
                  {verifyStatus === "verifying" && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ ...s.spinner, width: 14, height: 14, borderWidth: 2 }} />
                      Verifying details...
                    </span>
                  )}
                  {verifyStatus === "verified" && <span>{"✓"} Verified</span>}
                  {verifyStatus === "partial" && verifyResult && (
                    <span>
                      We found existing details &mdash; username: <strong>{verifyResult.username}</strong>, password:{" "}
                      <strong>{verifyResult.password}</strong>. Please login, or change your email or phone to register a new account.
                    </span>
                  )}
                  {verifyStatus === "duplicate" && verifyResult && (
                    <span>
                      You are already registered. Please login with username <strong>{verifyResult.username}</strong> and password{" "}
                      <strong>{verifyResult.password}</strong>, or use a different email and phone to register.
                    </span>
                  )}
                </div>
              )}

              {/* Promo Code — hidden behind a toggle until the student asks for it */}
              {isPaid && selectedClassId && (
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
                          border: "1.5px solid #6ee7b7", borderRadius: 10, padding: "9px 14px",
                        }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", color: "#059669", flexShrink: 0 }}>&#10003;</div>
                          <span style={{ color: "#065f46", fontWeight: 700, flex: 1, fontSize: "0.88rem" }}>
                            {promoApplied.code} &mdash; {promoApplied.discountPercent}% off
                            {promoApplied.discountPercent === 100 && " (Free!)"}
                          </span>
                          <button type="button" onClick={handleRemovePromo} style={{ background: "none", border: "1.5px solid #fca5a5", borderRadius: 8, padding: "3px 10px", color: "#ef4444", fontWeight: 600, fontSize: "0.76rem", cursor: "pointer" }}>Remove</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="text" placeholder="Enter promo code" value={promoCode}
                            onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(""); }}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleApplyPromo())}
                            style={{ ...s.input, flex: 1, minWidth: 0 }}
                            onFocus={(e) => Object.assign(e.target.style, s.inputFocus)} onBlur={(e) => Object.assign(e.target.style, inputBlurStyle)} />
                          <button type="button" onClick={handleApplyPromo} disabled={promoValidating || !promoCode.trim()}
                            style={{ ...s.btnOutline, opacity: promoValidating || !promoCode.trim() ? 0.5 : 1, cursor: promoValidating || !promoCode.trim() ? "not-allowed" : "pointer" }}>
                            {promoValidating ? "..." : "Apply"}
                          </button>
                        </div>
                      )}
                      {promoError && <div style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: 5 }}>{promoError}</div>}
                    </>
                  )}
                </div>
              )}

              {/* Referral Code — available for free and paid links (needs a class chosen) */}
              {selectedClassId && (
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
                          border: "1.5px solid #6ee7b7", borderRadius: 10, padding: "9px 14px",
                        }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", color: "#059669", flexShrink: 0 }}>&#10003;</div>
                          <span style={{ color: "#065f46", fontWeight: 700, flex: 1, fontSize: "0.88rem" }}>
                            {referralApplied.code}{referralApplied.name ? ` — ${referralApplied.name}` : ""}
                          </span>
                          <button type="button" onClick={handleRemoveReferral} style={{ background: "none", border: "1.5px solid #fca5a5", borderRadius: 8, padding: "3px 10px", color: "#ef4444", fontWeight: 600, fontSize: "0.76rem", cursor: "pointer" }}>Remove</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="text" placeholder="Enter referral code" value={referralCode}
                            onChange={(e) => { setReferralCode(e.target.value.toUpperCase()); setReferralError(""); }}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleApplyReferral())}
                            style={{ ...s.input, flex: 1, minWidth: 0 }}
                            onFocus={(e) => Object.assign(e.target.style, s.inputFocus)} onBlur={(e) => Object.assign(e.target.style, inputBlurStyle)} />
                          <button type="button" onClick={handleApplyReferral} disabled={referralValidating || !referralCode.trim()}
                            style={{ ...s.btnOutline, opacity: referralValidating || !referralCode.trim() ? 0.5 : 1, cursor: referralValidating || !referralCode.trim() ? "not-allowed" : "pointer" }}>
                            {referralValidating ? "..." : "Verify"}
                          </button>
                        </div>
                      )}
                      {referralError && <div style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: 5 }}>{referralError}</div>}
                    </>
                  )}
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
  );
};

// ── Styles (shared with the other registration pages) ──
const s = rs;

export default SchoolAssessmentRegisterPage;
