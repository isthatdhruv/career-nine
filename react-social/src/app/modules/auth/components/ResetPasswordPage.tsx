import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toAbsoluteUrl } from "../../../../_metronic/helpers";
import { resetPasswordWithToken } from "../core/_requests";
import "./PasswordPages.css";

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

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="rp-page">
    <img className="rp-logo" alt="Career-9" src={toAbsoluteUrl("/media/logos/kcc.webp")} />
    <div className="rp-card">{children}</div>
  </div>
);

const PasswordField = ({
  id,
  label,
  help,
  formik,
  field,
}: {
  id: string;
  label: string;
  help?: string;
  field: "newPassword" | "confirmPassword";
  formik: any;
}) => {
  const [show, setShow] = useState(false);
  const hasError = formik.touched[field] && formik.errors[field];
  return (
    <div className={`rp-field${hasError ? " rp-invalid" : ""}`}>
      <label className="rp-label" htmlFor={id}>
        {label}
      </label>
      <div className="rp-inputwrap">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          placeholder="••••••••"
          className="rp-input"
          {...formik.getFieldProps(field)}
        />
        <button
          type="button"
          className="rp-eye"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
            <circle cx="12" cy="12" r="2.6" />
          </svg>
        </button>
      </div>
      {hasError ? (
        <div className="rp-fielderr">{formik.errors[field]}</div>
      ) : (
        help && <div className="rp-help">{help}</div>
      )}
    </div>
  );
};

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const formik = useFormik({
    initialValues: { newPassword: "", confirmPassword: "" },
    validationSchema: resetSchema,
    onSubmit: async (values) => {
      if (!token) return;
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
          (err?.response?.status === 429
            ? "Too many attempts. Please wait a minute and try again."
            : "Something went wrong. Please try again.");
        setStatus({ kind: "error", message: apiMsg });
      }
    },
  });

  // Opened without a token in the URL: the link is unusable, offer the exit.
  if (!token) {
    return (
      <Shell>
        <div className="rp-state">
          <div className="rp-badge rp-bad">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 15l6-6" />
              <path d="M8.5 11.5l-2 2a3.5 3.5 0 1 0 5 5l1-1" />
              <path d="M15.5 12.5l2-2a3.5 3.5 0 1 0-5-5l-1 1" />
              <path d="M4 4l16 16" />
            </svg>
          </div>
          <h1>This link isn't valid</h1>
          <p>
            Reset links expire after 60 minutes, and each one works only once. Request a
            new link and try again.
          </p>
          <button type="button" className="rp-submit" onClick={() => navigate("/auth/forgot-password")}>
            Request a new link
          </button>
        </div>
      </Shell>
    );
  }

  if (status.kind === "success") {
    return (
      <Shell>
        <div className="rp-state">
          <div className="rp-badge rp-ok">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 12.5l5 5 10-11" />
            </svg>
          </div>
          <h1>Password reset</h1>
          <p>You can now log in with your new password.</p>
          <button type="button" className="rp-submit" onClick={() => navigate("/auth/login")}>
            Back to login
          </button>
          <p className="rp-redirect">Taking you to login…</p>
        </div>
      </Shell>
    );
  }

  const isLoading = status.kind === "loading";

  return (
    <div className="rp-page">
      <img className="rp-logo" alt="Career-9" src={toAbsoluteUrl("/media/logos/kcc.webp")} />
      <div className="rp-card">
        <h1 className="rp-title">Set a new password</h1>
        <p className="rp-sub">
          Choose a new password for your Career-9 account. You'll use it the next time you
          log in.
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
          <PasswordField
            id="newPassword"
            label="New password"
            help="At least 6 characters."
            formik={formik}
            field="newPassword"
          />
          <PasswordField
            id="confirmPassword"
            label="Confirm password"
            formik={formik}
            field="confirmPassword"
          />

          <button
            type="submit"
            className="rp-submit"
            disabled={isLoading || !formik.isValid || !formik.dirty}
          >
            {isLoading && <span className="rp-spin" aria-hidden="true" />}
            {isLoading ? "Resetting…" : "Reset password"}
          </button>
        </form>
      </div>

      <div className="rp-back">
        <Link to="/auth/login">← Back to login</Link>
      </div>
    </div>
  );
}
