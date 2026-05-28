import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { resetPasswordWithToken } from "../core/_requests";

const resetSchema = Yup.object().shape({
  newPassword: Yup.string()
    .min(6, "Password must be at least 6 characters")
    .required("New password is required"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("newPassword")], "Passwords do not match")
    .required("Please confirm your new password"),
});

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const formik = useFormik({
    initialValues: { newPassword: "", confirmPassword: "" },
    validationSchema: resetSchema,
    onSubmit: async (values) => {
      if (!token) {
        setStatus({ kind: "error", message: "This reset link is invalid." });
        return;
      }
      setStatus({ kind: "loading" });
      try {
        const { data } = await resetPasswordWithToken(token, values.newPassword);
        setStatus({
          kind: "success",
          message:
            data?.message ||
            "Your password has been reset. Please log in with your new password.",
        });
        setTimeout(() => navigate("/auth/login"), 2500);
      } catch (err: any) {
        const apiMsg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Something went wrong. Please try again.";
        setStatus({ kind: "error", message: apiMsg });
      }
    },
  });

  const isLoading = status.kind === "loading";
  const isSuccess = status.kind === "success";

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2.5rem 1.5rem",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient green/amber glows */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-120px",
          left: "-120px",
          width: "360px",
          height: "360px",
          background:
            "radial-gradient(circle, rgba(16, 185, 129, 0.55) 0%, rgba(16, 185, 129, 0) 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: "-140px",
          right: "-140px",
          width: "420px",
          height: "420px",
          background:
            "radial-gradient(circle, rgba(245, 158, 11, 0.55) 0%, rgba(245, 158, 11, 0) 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      {/* Glassmorphic card */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "480px",
          background: "rgba(255, 255, 255, 0.18)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderRadius: "28px",
          padding: "2.5rem 2.25rem",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          boxShadow:
            "0 25px 70px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              margin: "0 auto 1.25rem",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255, 255, 255, 0.25)",
              backdropFilter: "blur(10px)",
              border: "2px solid rgba(255, 255, 255, 0.4)",
              boxShadow:
                "0 8px 32px rgba(16, 185, 129, 0.35), 0 0 24px rgba(245, 158, 11, 0.3)",
            }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </div>
          <h1
            style={{
              color: "white",
              fontSize: "1.875rem",
              fontWeight: 800,
              margin: 0,
              letterSpacing: "-0.02em",
              textShadow: "0 2px 12px rgba(0, 0, 0, 0.15)",
            }}
          >
            Reset your Password
          </h1>
          <p
            style={{
              color: "rgba(255, 255, 255, 0.85)",
              fontSize: "0.975rem",
              marginTop: "0.5rem",
              marginBottom: 0,
              lineHeight: 1.5,
            }}
          >
            Choose a new password for your Career-9 account.
          </p>
        </div>

        {status.kind === "error" && (
          <div
            style={{
              background: "rgba(220, 38, 38, 0.18)",
              border: "1px solid rgba(248, 113, 113, 0.5)",
              color: "#fee2e2",
              padding: "0.875rem 1rem",
              borderRadius: "14px",
              marginBottom: "1.25rem",
              fontSize: "0.9rem",
              textAlign: "center",
            }}
          >
            {status.message}
          </div>
        )}
        {isSuccess && (
          <div
            style={{
              background: "rgba(16, 185, 129, 0.22)",
              border: "1px solid rgba(110, 231, 183, 0.55)",
              color: "#d1fae5",
              padding: "0.875rem 1rem",
              borderRadius: "14px",
              marginBottom: "1.25rem",
              fontSize: "0.9rem",
              textAlign: "center",
            }}
          >
            {status.message}
          </div>
        )}

        {!isSuccess && (
          <form noValidate onSubmit={formik.handleSubmit}>
            <PasswordField
              id="newPassword"
              label="Enter New Password"
              show={showNew}
              onToggle={() => setShowNew((v) => !v)}
              formik={formik}
              field="newPassword"
            />

            <PasswordField
              id="confirmPassword"
              label="Confirm New Password"
              show={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
              formik={formik}
              field="confirmPassword"
            />

            <button
              type="submit"
              disabled={isLoading || !formik.isValid || !formik.dirty}
              style={{
                width: "100%",
                padding: "0.95rem 1rem",
                marginTop: "0.25rem",
                borderRadius: "14px",
                border: "none",
                color: "white",
                fontSize: "1rem",
                fontWeight: 700,
                letterSpacing: "0.01em",
                cursor:
                  isLoading || !formik.isValid || !formik.dirty
                    ? "not-allowed"
                    : "pointer",
                background:
                  "linear-gradient(135deg, #10b981 0%, #f59e0b 100%)",
                boxShadow:
                  "0 10px 30px rgba(16, 185, 129, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1) inset",
                opacity:
                  isLoading || !formik.isValid || !formik.dirty ? 0.7 : 1,
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (isLoading || !formik.isValid || !formik.dirty) return;
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow =
                  "0 14px 36px rgba(245, 158, 11, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.12) inset";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 10px 30px rgba(16, 185, 129, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1) inset";
              }}
            >
              {isLoading ? "Resetting password…" : "Reset Password"}
            </button>
          </form>
        )}

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <Link
            to="/auth/login"
            style={{
              color: "rgba(255, 255, 255, 0.9)",
              fontSize: "0.9rem",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            ← Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  show: boolean;
  onToggle: () => void;
  field: "newPassword" | "confirmPassword";
  // formik typing kept loose for inline use
  formik: any;
};

function PasswordField({
  id,
  label,
  show,
  onToggle,
  formik,
  field,
}: PasswordFieldProps) {
  const hasError = formik.touched[field] && formik.errors[field];
  return (
    <div style={{ marginBottom: "1.1rem" }}>
      <label
        htmlFor={id}
        style={{
          display: "block",
          color: "rgba(255, 255, 255, 0.92)",
          fontSize: "0.875rem",
          fontWeight: 600,
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          {...formik.getFieldProps(field)}
          style={{
            width: "100%",
            padding: "0.85rem 3rem 0.85rem 1rem",
            borderRadius: "12px",
            border: hasError
              ? "1px solid rgba(248, 113, 113, 0.8)"
              : "1px solid rgba(255, 255, 255, 0.35)",
            background: "rgba(255, 255, 255, 0.92)",
            color: "#1f2937",
            fontSize: "1rem",
            outline: "none",
            boxShadow: "0 2px 12px rgba(0, 0, 0, 0.08)",
          }}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Hide password" : "Show password"}
          style={{
            position: "absolute",
            top: "50%",
            right: "0.65rem",
            transform: "translateY(-50%)",
            background: "transparent",
            border: "none",
            color: "#6b7280",
            cursor: "pointer",
            padding: "0.25rem 0.5rem",
            fontSize: "0.8rem",
            fontWeight: 600,
          }}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {hasError && (
        <div
          style={{
            color: "#fecaca",
            fontSize: "0.825rem",
            marginTop: "0.375rem",
          }}
        >
          {formik.errors[field]}
        </div>
      )}
    </div>
  );
}
