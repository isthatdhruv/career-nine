import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toAbsoluteUrl } from "../../../../_metronic/helpers";
import { requestPasswordReset } from "../core/_requests";
import "./PasswordPages.css";

const forgotPasswordSchema = Yup.object().shape({
  email: Yup.string()
    .email("Please enter a valid email address")
    .required("Email is required"),
});

/** Matches the backend's per-IP rate-limit window (10 req / 60s). */
const RESEND_COOLDOWN_SECONDS = 60;

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

export function ForgotPassword() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<number | null>(null);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setCooldown((left) => {
        if (left <= 1 && timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return Math.max(0, left - 1);
      });
    }, 1000);
  };
  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    },
    []
  );

  const send = async (email: string) => {
    setStatus({ kind: "loading" });
    try {
      await requestPasswordReset(email);
      setStatus({ kind: "sent", email });
      startCooldown();
    } catch (err: any) {
      const apiMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (err?.response?.status === 404
          ? "This email is not registered."
          : err?.response?.status === 429
          ? "Too many requests. Please wait a minute and try again."
          : "Something went wrong. Please try again.");
      setStatus({ kind: "error", message: apiMsg });
    }
  };

  const formik = useFormik({
    initialValues: { email: "" },
    validationSchema: forgotPasswordSchema,
    onSubmit: (values) => send(values.email.trim()),
  });

  const isLoading = status.kind === "loading";

  if (status.kind === "sent") {
    return (
      <div className="rp-page">
        <img className="rp-logo" alt="Career-9" src={toAbsoluteUrl("/media/logos/kcc.webp")} />
        <div className="rp-card">
          <div className="rp-state">
            <div className="rp-badge rp-mail">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
                <path d="M3.5 7l8.5 6 8.5-6" />
              </svg>
            </div>
            <h1>Check your email</h1>
            <p>
              We sent a reset link to <b>{status.email}</b>. It works once and expires in
              60 minutes.
            </p>
            <button
              type="button"
              className="rp-submit rp-ghost"
              disabled={cooldown > 0}
              onClick={() => send(status.email)}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
            </button>
            <p className="rp-switch">
              Wrong address?{" "}
              <a
                href="#retry"
                onClick={(e) => {
                  e.preventDefault();
                  setStatus({ kind: "idle" });
                }}
              >
                Use a different email
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const emailInvalid = formik.touched.email && formik.errors.email;

  return (
    <div className="rp-page">
      <img className="rp-logo" alt="Career-9" src={toAbsoluteUrl("/media/logos/kcc.webp")} />
      <div className="rp-card">
        <h1 className="rp-title">Forgot your password?</h1>
        <p className="rp-sub">
          Enter your account email and we'll send you a reset link. Each link works once
          and expires in 60 minutes.
        </p>

        {status.kind === "error" && (
          <div className="rp-banner" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5" />
              <path d="M12 16.5v.01" />
            </svg>
            <span>{status.message}</span>
          </div>
        )}

        <form noValidate onSubmit={formik.handleSubmit}>
          <div className={`rp-field${emailInvalid ? " rp-invalid" : ""}`}>
            <label className="rp-label" htmlFor="email">
              Email
            </label>
            <div className="rp-inputwrap">
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@school.edu"
                className="rp-input rp-noicon"
                {...formik.getFieldProps("email")}
              />
            </div>
            {emailInvalid && <div className="rp-fielderr">{formik.errors.email}</div>}
          </div>

          <button
            type="submit"
            className="rp-submit"
            disabled={isLoading || !formik.isValid || !formik.dirty}
          >
            {isLoading && <span className="rp-spin" aria-hidden="true" />}
            {isLoading ? "Sending…" : "Email me a reset link"}
          </button>
        </form>
      </div>

      <div className="rp-back">
        <Link to="/auth/login">← Back to login</Link>
      </div>
    </div>
  );
}
