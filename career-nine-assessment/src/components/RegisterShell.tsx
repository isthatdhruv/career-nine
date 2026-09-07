import React from "react"
import { Link } from "react-router-dom"
import { CAREER9_LOGO } from "../hooks/useStudentBranding"
import "../styles/register.css"

/**
 * Shared page shell for the registration pages: gradient background, a compact
 * header (logo · eyebrow · title · subtitle) above ONE wide card whose body
 * scrolls internally on desktop when the content overflows, and an optional
 * footer row (note on the left, primary action on the right).
 *
 * Omit `title` for the loading / error / success screens — they render as a
 * narrow centred card with no header.
 *
 * Fixed-position overlays (dialogs) must be rendered OUTSIDE this component:
 * the card's backdrop-filter would otherwise trap them inside the card.
 */
type Props = {
  eyebrow?: string
  /** Whitelabel / brand logo. Falls back to the Career-9 mark. */
  logoUrl?: string | null
  title?: React.ReactNode
  subtitle?: React.ReactNode
  /** Rendered in the card footer; usually <SignInNote /> + the submit button. */
  footer?: React.ReactNode
  /** Narrow centred card for state screens (loading / error / success). */
  narrow?: boolean
  children: React.ReactNode
}

const RegisterShell = ({ eyebrow, logoUrl, title, subtitle, footer, narrow, children }: Props) => (
  <div className="reg-page">
    <div className="reg-orb reg-orb--1" />
    <div className="reg-orb reg-orb--2" />
    <div className="reg-orb reg-orb--3" />

    <div className={narrow ? "reg-wrap reg-wrap--narrow" : "reg-wrap"}>
      {title !== undefined && (
        <header className="reg-header">
          <div className="reg-header-logo">
            <img src={logoUrl || CAREER9_LOGO} alt="" />
          </div>
          <div className="reg-header-text">
            {eyebrow && <div className="reg-eyebrow">{eyebrow}</div>}
            <h1 className="reg-title">{title}</h1>
            {subtitle && <p className="reg-subtitle">{subtitle}</p>}
          </div>
        </header>
      )}

      <div className="reg-card">
        <div className="reg-card-body">{children}</div>
        {footer && <div className="reg-card-footer">{footer}</div>}
      </div>
    </div>

    <div className="reg-brand">CAREER-9</div>
  </div>
)

export default RegisterShell

/** "Already registered? Sign in" — the left-hand footer note. */
export const SignInNote = () => (
  <span className="reg-footer-note">
    <span aria-hidden="true">🗒</span>
    Already registered?
    <Link to="/student-login" className="reg-link">Sign in</Link>
  </span>
)
