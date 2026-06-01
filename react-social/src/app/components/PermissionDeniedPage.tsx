import { FC } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../modules/auth/core/Auth'

/**
 * Phase 19 (Plan 19-05): Shared "permission-denied" page rendered when an
 * authenticated user hits a 403 from any react-social persona surface
 * (admin, student portal, counsellor portal). Mounted at:
 *   - /permission-denied             (admin / staff variant)
 *   - /student/permission-denied     (student variant — within StudentRoutes)
 *   - /counsellor/permission-denied  (counsellor variant — within CounsellorRoutes)
 *
 * The page chooses a persona-appropriate CTA based on `useAuth().currentUser`:
 *   - STUDENT / B2C_STUDENT  → "Return to dashboard" + "Contact your counsellor"
 *                              (B2C_STUDENT downgrades the secondary CTA to
 *                              mailto:support@career-9.net since they have no
 *                              counsellor relationship by definition).
 *   - COUNSELLOR             → "Return to dashboard" + "Contact admin"
 *   - admin / staff (default) → "Return home" + "Contact admin"
 *   - unknown / signed-out   → "Sign in"
 *
 * Why this is distinct from <RequestAccessPage> (Phase 17-01):
 *   <RequestAccessPage> is rendered INLINE by <RequirePermission> when the
 *   developer knows the exact permission code being checked — it surfaces the
 *   permission code to the admin via a mailto subject line. This component
 *   handles the OUT-OF-BAND case where the axios 403 interceptor only knows
 *   the URL the user tried to reach (no permission code).
 *
 * Inline styles (not Bootstrap / Metronic classes) so the page renders
 * identically across all three persona layouts — student/counsellor portals
 * do NOT load Metronic SCSS, so any kt-* / btn-* classes would render unstyled.
 */
type Persona = 'admin' | 'student' | 'b2c_student' | 'counsellor' | 'unknown'

function inferPersona(currentUser: unknown): Persona {
  if (!currentUser) return 'unknown'
  // currentUser may carry a single `role` or a `roles[]` array — both shapes
  // are tolerated by the auth context. Phase 17-01 widened User.roles to
  // string[], but older code paths sometimes still set `role` singular.
  const cu = currentUser as { role?: string; roles?: string[] }
  const role = cu.role
  const roles = cu.roles
  const has = (r: string) =>
    role === r || (Array.isArray(roles) && roles.includes(r))
  if (has('B2C_STUDENT') || has('ROLE_B2C_STUDENT')) return 'b2c_student'
  if (has('STUDENT') || has('ROLE_STUDENT')) return 'student'
  if (has('COUNSELLOR') || has('ROLE_COUNSELLOR')) return 'counsellor'
  // Default everything else (SUPER_ADMIN, INSTITUTE_ADMIN, TEACHER, PRINCIPAL, …)
  // to the admin variant.
  return 'admin'
}

type Cta = {
  primaryLabel: string
  primaryHref: string
  secondary?: { label: string; href: string }
}

function ctaFor(persona: Persona): Cta {
  switch (persona) {
    case 'student':
      return {
        primaryLabel: 'Return to dashboard',
        primaryHref: '/student/dashboard',
        secondary: { label: 'Contact your counsellor', href: '/student/dashboard/counselling' },
      }
    case 'b2c_student':
      // B2C students have no counsellor relationship; route to support email.
      return {
        primaryLabel: 'Return to dashboard',
        primaryHref: '/student/dashboard',
        secondary: { label: 'Contact support', href: 'mailto:support@career-9.net?subject=Access%20request' },
      }
    case 'counsellor':
      return {
        primaryLabel: 'Return to dashboard',
        primaryHref: '/counsellor/dashboard',
        secondary: { label: 'Contact admin', href: 'mailto:admin@career-9.net?subject=Access%20request' },
      }
    case 'admin':
      return {
        primaryLabel: 'Return home',
        primaryHref: '/',
        secondary: { label: 'Contact admin', href: 'mailto:admin@career-9.net?subject=Access%20request' },
      }
    case 'unknown':
    default:
      return {
        primaryLabel: 'Sign in',
        primaryHref: '/auth',
      }
  }
}

const PermissionDeniedPage: FC = () => {
  const { currentUser } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const from = params.get('from')
  const persona = inferPersona(currentUser)
  const cta = ctaFor(persona)

  const goPrimary = () => {
    if (cta.primaryHref.startsWith('mailto:')) {
      window.location.href = cta.primaryHref
    } else {
      navigate(cta.primaryHref, { replace: true })
    }
  }

  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#F5F7FA',
      }}
    >
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 8, color: '#9CA3AF' }} aria-hidden>
          403
        </div>
        <h2 style={{ marginBottom: 12, color: '#1F2937', fontSize: 24, fontWeight: 600 }}>
          You don't have permission for this
        </h2>
        <p style={{ color: '#6B7280', marginBottom: 24, lineHeight: 1.5, fontSize: 15 }}>
          {from ? (
            <>
              The page you tried to open (<code style={{ background: '#E5E7EB', padding: '2px 6px', borderRadius: 4 }}>{from}</code>)
              requires an access level your account doesn't currently have. If you think this is a
              mistake, reach out using the link below.
            </>
          ) : (
            <>
              This account doesn't have the access level required for that action. If you think this
              is a mistake, reach out using the link below.
            </>
          )}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type='button'
            onClick={goPrimary}
            style={{
              padding: '10px 20px',
              background: '#2563EB',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {cta.primaryLabel}
          </button>
          {cta.secondary && (
            <a
              href={cta.secondary.href}
              style={{
                padding: '10px 20px',
                border: '1px solid #D1D5DB',
                borderRadius: 6,
                color: '#374151',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 14,
                background: 'white',
              }}
            >
              {cta.secondary.label}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default PermissionDeniedPage
