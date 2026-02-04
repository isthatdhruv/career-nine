import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginEnterEmail() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Reset request for:", email);
    alert("If this email exists, you'll receive reset instructions (mock).");
  };
  const goToCheckEmail = () => {
    navigate('/login/reset-password/check-email');
};

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      overflow: 'hidden',
      background: 'linear-gradient(135deg,#f6f6f7 0%, #ffffff 100%)',
      position: 'fixed',
      top: 0,
      left: 0
    }}>
      <div className="card shadow" style={{ width: 504, borderRadius: 12 }}>
        <div className="card-body p-5 position-relative">
          {/* very faint textured/diagonal background mimic */}
          <div style={{ 
            position: "absolute", 
            inset: 0, 
            opacity: 0.03, 
            transform: "rotate(-6deg)", 
            background: "linear-gradient(135deg,#e9e9e9 0%,#ffffff 100%)", 
            pointerEvents: "none" 
          }} />

          <div style={{ position: "relative" }}>
            <h5 className="text-center mb-1">Your Email</h5>
            <p className="text-center text-muted small mb-4">Enter your email to reset password</p>

            <div>
              <div className="mb-3">
                <label className="form-label small mb-1">Email</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="email@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button 
                type="button" 
                className="btn btn-primary w-100 d-flex align-items-center justify-content-center"
                onClick={goToCheckEmail}
                >
                <span>Continue</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="ms-2">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
                </button>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}