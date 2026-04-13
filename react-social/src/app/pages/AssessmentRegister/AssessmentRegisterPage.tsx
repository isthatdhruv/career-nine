import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { showErrorToast } from '../../utils/toast';
import {
  getMappingInfoByToken,
  registerStudentByToken,
} from "../AssessmentMapping/API/AssessmentMapping_APIs";
import { validatePromoCode } from "../PromoCode/API/PromoCode_APIs";

const AssessmentRegisterPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [mappingInfo, setMappingInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");

  // Promo code
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ code: string; discountPercent: number } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);

  useEffect(() => {
    if (token) {
      getMappingInfoByToken(token)
        .then((res) => {
          setMappingInfo(res.data);
          setLoading(false);
        })
        .catch(() => {
          setError("Invalid or expired assessment link.");
          setLoading(false);
        });
    }
  }, [token]);

  const amountPaise: number = mappingInfo?.amount || 0;
  const amountRupees = amountPaise / 100;
  const isPaid = amountPaise > 0;

  const discountedAmountRupees = promoApplied
    ? amountRupees * (100 - promoApplied.discountPercent) / 100
    : amountRupees;

  const handleDobChange = (value: string) => {
    let cleaned = value.replace(/[^0-9-]/g, "");
    const digits = cleaned.replace(/-/g, "");
    if (digits.length <= 2) {
      cleaned = digits;
    } else if (digits.length <= 4) {
      cleaned = digits.slice(0, 2) + "-" + digits.slice(2);
    } else {
      cleaned =
        digits.slice(0, 2) + "-" + digits.slice(2, 4) + "-" + digits.slice(4, 8);
    }
    setDob(cleaned);
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoValidating(true);
    setPromoError("");
    setPromoApplied(null);

    try {
      const res = await validatePromoCode(promoCode.trim());
      setPromoApplied({
        code: res.data.code,
        discountPercent: res.data.discountPercent,
      });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !dob.trim()) {
      showErrorToast("Please fill in all required fields (Name, Email, Date of Birth).");
      return;
    }

    const dobRegex = /^\d{2}-\d{2}-\d{4}$/;
    if (!dobRegex.test(dob)) {
      showErrorToast("Date of Birth must be in dd-mm-yyyy format.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showErrorToast("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const data: any = {
        name: name.trim(),
        email: email.trim(),
        dob: dob,
        phone: phone.trim(),
        gender: gender,
      };

      if (selectedClassId) {
        data.classId = Number(selectedClassId);
      }
      if (selectedSectionId) {
        data.schoolSectionId = Number(selectedSectionId);
      }

      if (promoApplied) {
        data.promoCode = promoApplied.code;
      }

      const res = await registerStudentByToken(token!, data);

      if (res.data.status === "payment_required") {
        if (res.data.paymentUrl) {
          window.location.href = res.data.paymentUrl;
        } else {
          showErrorToast("Payment link could not be generated. Please try again.");
        }
        return;
      }

      setResult(res.data);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data ||
        "Registration failed. Please try again.";
      showErrorToast(typeof msg === "string" ? msg : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const availableClasses: any[] = mappingInfo?.availableClasses || [];
  const availableSections: any[] = mappingInfo?.availableSections || [];

  const selectedClassSections: any[] = selectedClassId
    ? (
        availableClasses.find(
          (c: any) => String(c.id) === selectedClassId
        )?.schoolSections || []
      )
    : [];

  // ── Loading State ──
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
            <p style={{ color: "#64748b", fontSize: "0.95rem", margin: 0 }}>Loading assessment information...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error) {
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
              {error} Please contact your school administrator for a valid link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Success / Already Registered ──
  if (result) {
    const isAlreadyRegistered = result.status === "already_registered";
    return (
      <div style={s.page}>
        <style>{keyframes}</style>
        <div style={s.bgOrb1} />
        <div style={s.bgOrb2} />
        <div style={s.bgOrb3} />
        <div style={s.glassCard}>
          <div style={{ textAlign: "center", padding: "48px 32px" }}>
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
              {isAlreadyRegistered ? "!" : "\u2713"}
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
        </div>
      </div>
    );
  }

  // ── Registration Form ──
  return (
    <div style={s.page}>
      <style>{keyframes}</style>
      <div style={s.bgOrb1} />
      <div style={s.bgOrb2} />
      <div style={s.bgOrb3} />

      <div style={s.glassCard}>
        {/* Header */}
        <div style={s.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: "#34d399", boxShadow: "0 0 12px rgba(52, 211, 153, 0.5)",
            }} />
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Assessment Registration
            </span>
          </div>
          <h2 style={{
            margin: 0, fontWeight: 800, fontSize: "clamp(1.3rem, 4vw, 1.6rem)",
            color: "#0f172a", lineHeight: 1.2,
          }}>
            {mappingInfo?.assessmentName || "Assessment"}
          </h2>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: "0.88rem" }}>
            {mappingInfo?.instituteName || ""}
            {mappingInfo?.className && ` \u00B7 Class ${mappingInfo.className}`}
            {mappingInfo?.sectionName && ` (${mappingInfo.sectionName})`}
            {mappingInfo?.sessionYear && ` \u00B7 ${mappingInfo.sessionYear}`}
          </p>

          {isPaid && (
            <div style={s.priceBadge}>
              {promoApplied && discountedAmountRupees !== amountRupees ? (
                <>
                  <span style={{ textDecoration: "line-through", opacity: 0.5, marginRight: 8, fontWeight: 500 }}>
                    INR {amountRupees}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: "1.15rem" }}>INR {discountedAmountRupees}</span>
                </>
              ) : (
                <span style={{ fontWeight: 800, fontSize: "1.15rem" }}>INR {amountRupees}</span>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #e2e8f0, transparent)", margin: "0 32px" }} />

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "28px 32px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
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
                onFocus={(e) => Object.assign(e.target.style, s.inputFocus)}
                onBlur={(e) => Object.assign(e.target.style, { borderColor: "#e2e8f0", boxShadow: "none" })}
              />
            </div>

            {/* Email + DOB row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={s.label}>
                  Email <span style={{ color: "#f43f5e" }}>*</span>
                </label>
                <input
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

            {/* Phone + Gender row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={s.label}>Phone Number</label>
                <input
                  type="tel"
                  placeholder="Enter phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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

            {/* Class dropdown for SESSION level */}
            {mappingInfo?.mappingLevel === "SESSION" && availableClasses.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: selectedClassSections.length > 0 ? "1fr 1fr" : "1fr", gap: 16 }}>
                <div>
                  <label style={s.label}>
                    Class <span style={{ color: "#f43f5e" }}>*</span>
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => {
                      setSelectedClassId(e.target.value);
                      setSelectedSectionId("");
                    }}
                    required
                    style={{ ...s.input, color: selectedClassId ? "#1e293b" : "#94a3b8" }}
                    onFocus={(e) => Object.assign(e.target.style, s.inputFocus)}
                    onBlur={(e) => Object.assign(e.target.style, { borderColor: "#e2e8f0", boxShadow: "none" })}
                  >
                    <option value="">Select Class</option>
                    {availableClasses.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.className}</option>
                    ))}
                  </select>
                </div>
                {selectedClassSections.length > 0 && (
                  <div>
                    <label style={s.label}>Section</label>
                    <select
                      value={selectedSectionId}
                      onChange={(e) => setSelectedSectionId(e.target.value)}
                      style={{ ...s.input, color: selectedSectionId ? "#1e293b" : "#94a3b8" }}
                      onFocus={(e) => Object.assign(e.target.style, s.inputFocus)}
                      onBlur={(e) => Object.assign(e.target.style, { borderColor: "#e2e8f0", boxShadow: "none" })}
                    >
                      <option value="">Select Section (Optional)</option>
                      {selectedClassSections.map((sc: any) => (
                        <option key={sc.id} value={sc.id}>{sc.sectionName}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Section dropdown for CLASS level */}
            {mappingInfo?.mappingLevel === "CLASS" && availableSections.length > 0 && (
              <div>
                <label style={s.label}>Section</label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  style={{ ...s.input, color: selectedSectionId ? "#1e293b" : "#94a3b8" }}
                  onFocus={(e) => Object.assign(e.target.style, s.inputFocus)}
                  onBlur={(e) => Object.assign(e.target.style, { borderColor: "#e2e8f0", boxShadow: "none" })}
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
              <div style={{
                background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)",
                border: "1.5px solid #a7f3d0", borderRadius: 12,
                padding: "14px 20px", fontSize: "0.88rem", color: "#065f46",
              }}>
                Class: <strong>{mappingInfo.className}</strong> &middot; Section: <strong>{mappingInfo.sectionName}</strong>
              </div>
            )}

            {/* Promo Code */}
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
                      &#10003;
                    </div>
                    <span style={{ color: "#065f46", fontWeight: 700, flex: 1, fontSize: "0.92rem" }}>
                      {promoApplied.code} &mdash; {promoApplied.discountPercent}% off
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
                        setPromoCode(e.target.value.toUpperCase());
                        setPromoError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleApplyPromo())}
                      style={{ ...s.input, flex: 1, marginBottom: 0 }}
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
                  <div style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: 6 }}>
                    {promoError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              ...s.btnPrimary,
              width: "100%",
              marginTop: 28,
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <div style={{ ...s.spinner, width: 18, height: 18, borderWidth: 2 }} />
                {isPaid && discountedAmountRupees > 0 ? "Processing..." : "Registering..."}
              </span>
            ) : isPaid && discountedAmountRupees > 0 ? (
              `Register & Pay INR ${discountedAmountRupees}`
            ) : (
              "Register"
            )}
          </button>

          {/* Footer note */}
          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.78rem", marginTop: 16, marginBottom: 0 }}>
            By registering, you agree to the assessment terms and conditions.
          </p>
        </form>
      </div>

      {/* Branding */}
      <div style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        fontSize: "0.72rem", color: "rgba(100, 116, 139, 0.5)", fontWeight: 500,
        letterSpacing: "0.05em",
      }}>
        CAREER-9
      </div>
    </div>
  );
};

// ── Keyframes ──
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
  @media (max-width: 600px) {
    .glass-card-responsive {
      margin: 12px !important;
      max-width: 100% !important;
    }
  }
`;

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
    width: 500,
    height: 500,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(52, 211, 153, 0.15) 0%, transparent 70%)",
    top: "-10%",
    right: "-5%",
    animation: "float1 20s ease-in-out infinite",
    pointerEvents: "none" as const,
  },
  bgOrb2: {
    position: "fixed",
    width: 600,
    height: 600,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)",
    bottom: "-15%",
    left: "-10%",
    animation: "float2 25s ease-in-out infinite",
    pointerEvents: "none" as const,
  },
  bgOrb3: {
    position: "fixed",
    width: 350,
    height: 350,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)",
    top: "50%",
    left: "60%",
    animation: "float3 18s ease-in-out infinite",
    pointerEvents: "none" as const,
  },
  glassCard: {
    width: "100%",
    maxWidth: 560,
    background: "rgba(255, 255, 255, 0.72)",
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
  priceBadge: {
    marginTop: 16,
    display: "inline-flex",
    alignItems: "center",
    background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
    color: "#065f46",
    padding: "8px 20px",
    borderRadius: 12,
    fontSize: "0.95rem",
    fontWeight: 700,
    border: "1px solid #6ee7b7",
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
  },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid #e2e8f0",
    borderTopColor: "#10b981",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};

export default AssessmentRegisterPage;
