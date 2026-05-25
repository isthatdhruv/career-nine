import { FC } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/**
 * Phase 19 (Plan 19-05): standalone permission-denied page for the
 * career-nine-assessment SPA. Mounted at /permission-denied within the SPA's
 * router (App.tsx). Triggered by the http.ts response interceptor on:
 *   - 403 (header-path session rejected OR cookie scope mismatch)
 *   - 401 when cookieAuthRuntimeActive is true (cn_at_asmnt expired/invalid)
 *
 * Persona is always "assessment student" in this SPA — there is no admin /
 * counsellor surface here — so the CTA is fixed: "Return to assessment list".
 * Inline styles only; the SPA does not load Metronic SCSS or Bootstrap
 * utilities, so any kt-* / btn-* classes would render unstyled.
 *
 * Why not reuse the react-social PermissionDeniedPage? Different bundle.
 * Importing across the two SPAs would require a shared package + build
 * pipeline; for ~50 lines of trivial inline-styled JSX, a sibling file is
 * the lowest-coupling option.
 */
const PermissionDeniedPage: FC = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const from = params.get('from')

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
          Your assessment session is no longer valid
        </h2>
        <p style={{ color: '#6B7280', marginBottom: 24, lineHeight: 1.5, fontSize: 15 }}>
          {from ? (
            <>
              We couldn't open{' '}
              <code style={{ background: '#E5E7EB', padding: '2px 6px', borderRadius: 4 }}>{from}</code>{' '}
              with your current assessment session. This usually means your session expired (sessions
              last 4 hours) or the link you used has been re-issued.
            </>
          ) : (
            <>
              Your current session can't open this part of the assessment. This usually means your
              session expired (sessions last 4 hours) or the link you used has been re-issued.
            </>
          )}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type='button'
            onClick={() => navigate('/student-login', { replace: true })}
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
            Return to assessment list
          </button>
          <a
            href='mailto:support@career-9.net?subject=Assessment%20session%20issue'
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
            Contact support
          </a>
        </div>
      </div>
    </div>
  )
}

export default PermissionDeniedPage
