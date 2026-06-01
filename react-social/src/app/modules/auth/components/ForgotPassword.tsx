import { useState } from "react";
import { Link } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { requestPasswordReset } from "../core/_requests";

const forgotPasswordSchema = Yup.object().shape({
  email: Yup.string()
    .email("Please enter a valid email address")
    .required("Email is required"),
});

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function ForgotPassword() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const formik = useFormik({
    initialValues: { email: "" },
    validationSchema: forgotPasswordSchema,
    onSubmit: async (values) => {
      setStatus({ kind: "loading" });
      try {
        const { data } = await requestPasswordReset(values.email.trim());
        setStatus({
          kind: "success",
          message:
            data?.message ||
            "A link to reset your password has been sent to your email.",
        });
      } catch (err: any) {
        const apiMsg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          (err?.response?.status === 404
            ? "This email is not registered."
            : "Something went wrong. Please try again.");
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
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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
            Forgot your password?
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
            Enter your registered email and we'll send you a link to reset it.
          </p>
        </div>

        {/* Status banners */}
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
            <div style={{ marginBottom: "1.25rem" }}>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  color: "rgba(255, 255, 255, 0.92)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginBottom: "0.5rem",
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...formik.getFieldProps("email")}
                style={{
                  width: "100%",
                  padding: "0.85rem 1rem",
                  borderRadius: "12px",
                  border:
                    formik.touched.email && formik.errors.email
                      ? "1px solid rgba(248, 113, 113, 0.8)"
                      : "1px solid rgba(255, 255, 255, 0.35)",
                  background: "rgba(255, 255, 255, 0.92)",
                  color: "#1f2937",
                  fontSize: "1rem",
                  outline: "none",
                  boxShadow: "0 2px 12px rgba(0, 0, 0, 0.08)",
                }}
              />
              {formik.touched.email && formik.errors.email && (
                <div
                  style={{
                    color: "#fecaca",
                    fontSize: "0.825rem",
                    marginTop: "0.375rem",
                  }}
                >
                  {formik.errors.email}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !formik.isValid}
              style={{
                width: "100%",
                padding: "0.95rem 1rem",
                borderRadius: "14px",
                border: "none",
                color: "white",
                fontSize: "1rem",
                fontWeight: 700,
                letterSpacing: "0.01em",
                cursor:
                  isLoading || !formik.isValid ? "not-allowed" : "pointer",
                background:
                  "linear-gradient(135deg, #10b981 0%, #f59e0b 100%)",
                boxShadow:
                  "0 10px 30px rgba(16, 185, 129, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1) inset",
                opacity: isLoading || !formik.isValid ? 0.7 : 1,
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (isLoading || !formik.isValid) return;
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
              {isLoading ? "Sending link…" : "Send reset link"}
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
