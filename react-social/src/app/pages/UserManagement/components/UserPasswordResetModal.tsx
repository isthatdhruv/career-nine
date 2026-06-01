import { FC, useEffect, useState } from "react";
import axios from "axios";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";

const API_URL = process.env.REACT_APP_API_URL;

interface Props {
  show: boolean;
  onHide: () => void;
  user: { id: number; name: string; email: string } | null;
}

/**
 * Admin-driven password reset. The admin types a new password for the target
 * user, optionally checks "Email password", and submits. Backend hashes the
 * password and (best-effort) emails the plaintext to the user with a prompt
 * to change it on first login.
 */
const UserPasswordResetModal: FC<Props> = ({ show, onHide, user }) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (show) {
      setPassword("");
      setConfirm("");
      setSendEmail(true);
      setShowPassword(false);
    }
  }, [show]);

  const hasEmail = Boolean(user?.email);
  const passwordsMatch = password === confirm;
  const passwordValid = password.length >= 6;
  const canSubmit = !!user && passwordValid && passwordsMatch && !submitting;

  const generateRandom = () => {
    // 10-char password from a safe alphabet (no easily-confused chars).
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let out = "";
    for (let i = 0; i < 10; i++) {
      out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    setPassword(out);
    setConfirm(out);
    setShowPassword(true);
  };

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    try {
      const res = await axios.post(
        `${API_URL}/user/${user.id}/admin-reset-password`,
        { password, sendEmail: sendEmail && hasEmail }
      );
      const data = res.data || {};
      if (sendEmail && hasEmail) {
        if (data.emailSent) {
          showSuccessToast("Password reset and emailed to user");
        } else {
          showErrorToast(
            "Password reset, but email failed: " + (data.emailError || "unknown error")
          );
        }
      } else {
        showSuccessToast("Password reset successfully");
      }
      onHide();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data ||
        err.message ||
        "Failed to reset password";
      showErrorToast(typeof msg === "string" ? msg : "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered backdrop={submitting ? "static" : true}>
      <Modal.Header closeButton={!submitting}>
        <Modal.Title>
          <i className="bi bi-key-fill me-2" style={{ color: "#d97706" }} />
          Reset Password
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {user ? (
          <>
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: "0.85rem", color: "#374151" }}>
              <div><strong>User:</strong> {user.name || "—"}</div>
              <div><strong>Email:</strong> {user.email || <span style={{ color: "#dc2626" }}>(none on file)</span>}</div>
            </div>

            <Form.Group className="mb-3">
              <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                New Password <span style={{ color: "#dc2626" }}>*</span>
              </Form.Label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Form.Control
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: "#6b7280", fontSize: "0.85rem", cursor: "pointer" }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <i className={`bi bi-${showPassword ? "eye-slash" : "eye"}`} />
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline-secondary"
                  size="sm"
                  onClick={generateRandom}
                  disabled={submitting}
                  title="Generate a random password"
                >
                  <i className="bi bi-shuffle" />
                </Button>
              </div>
              {password && !passwordValid && (
                <Form.Text style={{ color: "#dc2626" }}>
                  Password must be at least 6 characters.
                </Form.Text>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                Confirm Password <span style={{ color: "#dc2626" }}>*</span>
              </Form.Label>
              <Form.Control
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter the new password"
                autoComplete="new-password"
                disabled={submitting}
              />
              {confirm && !passwordsMatch && (
                <Form.Text style={{ color: "#dc2626" }}>Passwords don't match.</Form.Text>
              )}
            </Form.Group>

            <Form.Group>
              <Form.Check
                type="checkbox"
                id="reset-pw-send-email"
                label={
                  hasEmail
                    ? `Email this password to ${user.email}`
                    : "Email this password to user (no email on file)"
                }
                checked={sendEmail && hasEmail}
                disabled={!hasEmail || submitting}
                onChange={(e) => setSendEmail(e.target.checked)}
              />
              <Form.Text style={{ color: "#6b7280", fontSize: "0.78rem" }}>
                The email will include the plaintext password and prompt the user to change it after logging in.
              </Form.Text>
            </Form.Group>
          </>
        ) : (
          <div className="text-muted">No user selected.</div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Resetting...
            </>
          ) : (
            "Reset Password"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default UserPasswordResetModal;
