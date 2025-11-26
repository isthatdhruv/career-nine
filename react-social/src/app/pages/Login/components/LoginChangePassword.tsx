import React, { useState } from "react";

export default function LoginChangePassword(): JSX.Element {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      alert("Please fill both fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    console.log("Password changed:", newPassword);
    alert("Password updated successfully!");
    // Navigate back to login page
    window.location.href = '/login';
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
      <div className="card shadow" style={{ width: 420, borderRadius: 12 }}>
        <div className="card-body p-5 position-relative">
          <div style={{
            position: "absolute",
            inset: 0,
            opacity: 0.03,
            transform: "rotate(-6deg)",
            background: "linear-gradient(135deg,#e9e9e9 0%,#ffffff 100%)",
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative" }}>
            <h4 className="text-center mb-2" style={{ fontSize: '1.5rem', fontWeight: '600' }}>
              Reset Password
            </h4>
            <p className="text-center text-muted mb-4" style={{ fontSize: '0.95rem' }}>
              Enter your new password
            </p>

            <div>
              <div className="mb-4">
                <label className="form-label mb-2" style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                  New Password
                </label>
                <div className="input-group">
                  <input
                    type={showNew ? "text" : "password"}
                    className="form-control"
                    placeholder="Enter a new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    style={{ padding: '0.65rem', fontSize: '0.95rem' }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowNew((s) => !s)}
                    style={{ border: '1px solid #ced4da' }}
                  >
                    {showNew ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M2 2l20 20" strokeWidth="1.5" />
                        <path d="M17.94 17.94A10.94 10.94 0 0 0 22 12" strokeWidth="1.5" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" strokeWidth="1.5" />
                        <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label mb-2" style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                  Confirm New Password
                </label>
                <div className="input-group">
                  <input
                    type={showConfirm ? "text" : "password"}
                    className="form-control"
                    placeholder="Re-enter a new Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={{ padding: '0.65rem', fontSize: '0.95rem' }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowConfirm((s) => !s)}
                    style={{ border: '1px solid #ced4da' }}
                  >
                    {showConfirm ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M2 2l20 20" strokeWidth="1.5" />
                        <path d="M17.94 17.94A10.94 10.94 0 0 0 22 12" strokeWidth="1.5" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" strokeWidth="1.5" />
                        <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button 
                type="button" 
                className="btn btn-primary w-100"
                onClick={handleSubmit}
                style={{ padding: '0.65rem', fontSize: '1rem', fontWeight: '500' }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}