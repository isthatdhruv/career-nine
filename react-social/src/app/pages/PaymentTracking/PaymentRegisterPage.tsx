import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

interface TransactionInfo {
  transactionId: number;
  amount: number;
  assessmentName: string;
  instituteName?: string;
  status: string;
  shortUrl: string;
}

const PaymentRegisterPage = () => {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [info, setInfo] = useState<TransactionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [error, setError] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [studentClass, setStudentClass] = useState("");

  useEffect(() => {
    if (!transactionId) return;
    axios
      .get(`${API_URL}/payment/webhook/info/${transactionId}`)
      .then((res) => {
        setInfo(res.data);
        // If already paid, skip registration
        if (res.data.status === "paid") {
          setRegistered(true);
          setPaymentUrl("");
        }
      })
      .catch(() => setError("Invalid or expired payment link"))
      .finally(() => setLoading(false));
  }, [transactionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !dob) {
      setError("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await axios.post(
        `${API_URL}/payment/webhook/register/${transactionId}`,
        { name, email, dob, phone, gender, studentClass }
      );
      setPaymentUrl(res.data.paymentUrl);
      setRegistered(true);
    } catch (err: any) {
      setError(err.response?.data || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageWrapper>
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={spinnerStyle} />
          <p style={{ marginTop: 16, color: "#64748b", fontSize: "0.9rem" }}>Loading...</p>
        </div>
      </PageWrapper>
    );
  }

  if (error && !info) {
    return (
      <PageWrapper>
        <GlassCard>
          <div style={{ textAlign: "center", padding: "48px 32px" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>{"\u274C"}</div>
            <h2 style={{ color: "#0f172a", fontWeight: 800, fontSize: "1.4rem", margin: "0 0 8px" }}>
              Link Not Found
            </h2>
            <p style={{ color: "#64748b", fontSize: "0.9rem" }}>{error}</p>
          </div>
        </GlassCard>
      </PageWrapper>
    );
  }

  if (info?.status === "paid") {
    return (
      <PageWrapper>
        <GlassCard>
          <div style={{ textAlign: "center", padding: "48px 32px" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>{"\u2705"}</div>
            <h2 style={{ color: "#0f172a", fontWeight: 800, fontSize: "1.4rem", margin: "0 0 8px" }}>
              Already Paid
            </h2>
            <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
              This payment has already been completed. Check your email for login credentials.
            </p>
          </div>
        </GlassCard>
      </PageWrapper>
    );
  }

  // After registration — show "Proceed to Payment" button
  if (registered && paymentUrl) {
    return (
      <PageWrapper>
        <BrandPill />
        <GlassCard>
          <div style={{ textAlign: "center", padding: "48px 32px" }}>
            {/* Accent glow */}
            <div style={{
              position: "absolute", top: 30, left: "50%", transform: "translateX(-50%)",
              width: 120, height: 120, borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.12)", filter: "blur(30px)", pointerEvents: "none",
            }} />

            <div style={{
              position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 80, height: 80, borderRadius: "50%",
              background: "rgba(255,255,255,0.8)", border: "2px solid rgba(16, 185, 129, 0.15)",
              boxShadow: "0 4px 20px rgba(16, 185, 129, 0.12)", marginBottom: 24,
            }}>
              <span style={{ fontSize: "2.2rem" }}>{"\u2705"}</span>
            </div>

            <h2 style={{ color: "#0f172a", fontWeight: 800, fontSize: "1.4rem", margin: "0 0 8px" }}>
              Details Saved!
            </h2>
            <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: 8 }}>
              {info?.assessmentName}
            </p>

            {/* Amount badge */}
            <div style={{
              display: "inline-block", padding: "10px 28px", borderRadius: 14,
              background: "rgba(255,255,255,0.6)", backdropFilter: "blur(10px)",
              border: "1px solid rgba(226, 232, 240, 0.5)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.03)", marginBottom: 28,
            }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Amount{" "}
              </span>
              <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a" }}>
                <span style={{ fontSize: "0.85rem", color: "#94a3b8", marginRight: 2 }}>INR</span>
                {info?.amount}
              </span>
            </div>

            <div>
              <a
                href={paymentUrl}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  padding: "16px 40px", borderRadius: 14,
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#fff", fontWeight: 700, fontSize: "1.05rem",
                  textDecoration: "none", border: "none", cursor: "pointer",
                  boxShadow: "0 6px 24px rgba(16, 185, 129, 0.3)",
                  transition: "all 0.2s ease",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                Proceed to Payment
              </a>
            </div>

            <p style={{ color: "#94a3b8", fontSize: "0.78rem", marginTop: 20 }}>
              You will be redirected to Razorpay's secure payment page
            </p>
          </div>
        </GlassCard>
        <Footer />
      </PageWrapper>
    );
  }

  // Registration form
  return (
    <PageWrapper>
      <BrandPill />
      <GlassCard>
        {/* Header */}
        <div style={{ padding: "32px 32px 0", textAlign: "center" }}>
          <h1 style={{ margin: "0 0 4px", fontWeight: 800, fontSize: "1.4rem", color: "#0f172a", letterSpacing: "-0.02em" }}>
            Assessment Registration
          </h1>
          {info?.assessmentName && (
            <p style={{ color: "#10b981", fontWeight: 600, fontSize: "0.9rem", margin: "0 0 4px" }}>
              {info.assessmentName}
            </p>
          )}
          {info?.instituteName && (
            <p style={{ color: "#94a3b8", fontSize: "0.82rem", margin: 0 }}>
              {info.instituteName}
            </p>
          )}
        </div>

        {/* Amount badge */}
        {info?.amount && (
          <div style={{ textAlign: "center", padding: "16px 0 0" }}>
            <div style={{
              display: "inline-block", padding: "8px 24px", borderRadius: 12,
              background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.15)",
            }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#059669" }}>
                Fee:{" "}
              </span>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#059669" }}>
                INR {info.amount}
              </span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "24px 32px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <InputField label="Full Name *" value={name} onChange={setName} placeholder="Enter your name" type="text" fullWidth />
            <InputField label="Email *" value={email} onChange={setEmail} placeholder="your@email.com" type="email" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <InputField label="Date of Birth *" value={dob} onChange={setDob} placeholder="DD-MM-YYYY" type="text" />
            <InputField label="Phone" value={phone} onChange={setPhone} placeholder="9876543210" type="tel" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                style={inputStyle as React.CSSProperties}
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <InputField label="Class" value={studentClass} onChange={setStudentClass} placeholder="e.g. 10, 12" type="text" />
          </div>

          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.15)",
              color: "#dc2626", fontSize: "0.82rem", fontWeight: 500, marginBottom: 16, textAlign: "center",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%", padding: "14px 24px", borderRadius: 14, border: "none",
              background: submitting ? "#94a3b8" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#fff", fontWeight: 700, fontSize: "1rem", cursor: submitting ? "default" : "pointer",
              boxShadow: submitting ? "none" : "0 6px 24px rgba(16, 185, 129, 0.3)",
              transition: "all 0.2s ease", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}
          >
            {submitting ? (
              <><div style={{ ...spinnerStyleSmall, borderTopColor: "#fff" }} /> Saving...</>
            ) : (
              <>
                Continue to Payment
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>

          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.75rem", marginTop: 14 }}>
            Your Date of Birth will be used as your login password
          </p>
        </form>
      </GlassCard>
      <Footer />
    </PageWrapper>
  );
};

// ── Shared components ──

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(160deg, #f0fdf4 0%, #ecfdf5 25%, #f0f9ff 50%, #faf5ff 75%, #fdf2f8 100%)",
    position: "relative", overflow: "hidden", padding: 24,
    fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  }}>
    {/* Background orbs */}
    <div style={{ position: "absolute", top: "10%", left: "5%", width: 200, height: 200, borderRadius: "50%", background: "linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(59, 130, 246, 0.04) 100%)", filter: "blur(40px)", pointerEvents: "none" }} />
    <div style={{ position: "absolute", bottom: "15%", right: "8%", width: 250, height: 250, borderRadius: "50%", background: "linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(236, 72, 153, 0.04) 100%)", filter: "blur(40px)", pointerEvents: "none" }} />
    <div style={{ position: "relative", zIndex: 1, maxWidth: 500, width: "100%" }}>
      {children}
    </div>
  </div>
);

const BrandPill = () => (
  <div style={{ textAlign: "center", marginBottom: 24 }}>
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: "8px 20px", borderRadius: 50,
      background: "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,0.5)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 800, fontSize: "0.75rem",
      }}>C</div>
      <span style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>
        Career<span style={{ color: "#10b981" }}>-9</span>
      </span>
    </div>
  </div>
);

const GlassCard = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    background: "rgba(255,255,255,0.65)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
    borderRadius: 24, border: "1px solid rgba(255,255,255,0.5)",
    boxShadow: "0 8px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
    overflow: "hidden", position: "relative",
  }}>
    {children}
  </div>
);

const Footer = () => (
  <div style={{ textAlign: "center", marginTop: 24 }}>
    <p style={{ color: "#94a3b8", fontSize: "0.75rem", margin: 0 }}>
      Powered by <strong style={{ color: "#64748b" }}>Career-9</strong> &middot; Secure payments by <strong style={{ color: "#64748b" }}>Razorpay</strong>
    </p>
  </div>
);

const InputField = ({ label, value, onChange, placeholder, type, fullWidth }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; type: string; fullWidth?: boolean;
}) => (
  <div style={fullWidth ? { gridColumn: "1 / -1" } : {}}>
    <label style={labelStyle}>{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
    />
  </div>
);

const labelStyle: React.CSSProperties = {
  display: "block", fontWeight: 600, fontSize: "0.78rem", color: "#475569",
  marginBottom: 6, letterSpacing: "0.01em",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 12,
  border: "1.5px solid rgba(226, 232, 240, 0.8)",
  background: "rgba(255,255,255,0.5)", backdropFilter: "blur(8px)",
  fontSize: "0.9rem", color: "#0f172a", outline: "none",
  transition: "border-color 0.2s ease", boxSizing: "border-box",
};

const spinnerStyle: React.CSSProperties = {
  width: 32, height: 32, border: "3px solid rgba(16, 185, 129, 0.15)",
  borderTopColor: "#10b981", borderRadius: "50%",
  animation: "spin 1s linear infinite", display: "inline-block",
};

const spinnerStyleSmall: React.CSSProperties = {
  width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)",
  borderTopColor: "#10b981", borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

export default PaymentRegisterPage;
