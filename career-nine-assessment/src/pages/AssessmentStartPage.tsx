import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { redeemAssessmentStartToken } from '../api-clients/campaignAPI'

/**
 * Landing target for the welcome-email "Start Assessment" magic link.
 *
 * URL shape: /assessment/start?t=<accessToken>&e=<entitlementId>
 *
 * Calls POST /entitlement/redeem-token which:
 *   1. Validates the token (server-side via EntitlementService.redeemAccessToken)
 *   2. Issues the cn_at_asmnt HttpOnly cookie in the same response
 *   3. Returns the session payload (userStudentId, assessments, campaignSlug)
 *
 * We seed localStorage from the response and navigate to /allotted-assessment.
 * On token failure (404 / expired) we route back to /student-login so the
 * student can use the credentials we also sent in the welcome email.
 */
const AssessmentStartPage = () => {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [message, setMessage] = useState('Validating your assessment link...')
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const token = params.get('t')
    const entitlementId = params.get('e')
    if (!token || !entitlementId) {
      setStatus('error')
      setMessage('This link is missing required parameters.')
      return
    }

    redeemAssessmentStartToken(token, entitlementId)
      .then(res => {
        const data = res.data || {}
        localStorage.clear()
        if (data.userStudentId != null) {
          localStorage.setItem('userStudentId', String(data.userStudentId))
        }
        if (Array.isArray(data.assessments)) {
          localStorage.setItem('allottedAssessments', JSON.stringify(data.assessments))
        }
        if (data.entitlementId != null) {
          localStorage.setItem('entitlementId', String(data.entitlementId))
        }
        if (data.campaignId != null) {
          localStorage.setItem('campaignId', String(data.campaignId))
        }
        if (data.campaignSlug) {
          localStorage.setItem('campaignSlug', String(data.campaignSlug))
        }
        if (data.purchasePath) {
          localStorage.setItem('purchasePath', String(data.purchasePath))
        }
        navigate('/allotted-assessment', { replace: true })
      })
      .catch(() => {
        setStatus('error')
        setMessage('This link is invalid or has expired. Please sign in with the credentials from your welcome email.')
        setTimeout(() => navigate('/student-login', { replace: true }), 4000)
      })
  }, [params, navigate])

  return (
    <div style={styles.page}>
      <div style={styles.bgOrb1} />
      <div style={styles.bgOrb2} />
      <div style={styles.card}>
        <div style={styles.logoBar}>
          <div style={styles.logoMark}>C</div>
          <span style={styles.logoText}>Career<span style={{ color: '#10b981' }}>-9</span></span>
        </div>

        {status === 'loading' && (
          <>
            <div style={styles.spinner} />
            <h2 style={styles.title}>Signing you in...</h2>
            <p style={styles.subtitle}>{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={styles.errorIcon}>!</div>
            <h2 style={styles.title}>Link unavailable</h2>
            <p style={styles.subtitle}>{message}</p>
            <p style={styles.subtle}>Redirecting you to sign-in...</p>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

const styles: { [k: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #fef3c7 0%, #d1fae5 100%)',
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
  bgOrb1: {
    position: 'absolute',
    top: '-10%',
    right: '-5%',
    width: 400,
    height: 400,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  bgOrb2: {
    position: 'absolute',
    bottom: '-15%',
    left: '-10%',
    width: 500,
    height: 500,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 440,
    width: '100%',
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: 24,
    border: '1px solid rgba(255,255,255,0.6)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
    padding: '40px 32px 36px',
    textAlign: 'center',
  },
  logoBar: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 18px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.5)',
    marginBottom: 28,
  },
  logoMark: {
    width: 26,
    height: 26,
    borderRadius: 8,
    background: 'linear-gradient(135deg,#f59e0b 0%,#10b981 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '0.78rem',
  },
  logoText: {
    fontWeight: 700,
    fontSize: '0.95rem',
    color: '#1e293b',
  },
  spinner: {
    width: 48,
    height: 48,
    margin: '0 auto 18px',
    border: '3px solid #fef3c7',
    borderTopColor: '#10b981',
    borderRadius: '50%',
    animation: 'spin 0.9s linear infinite',
  },
  errorIcon: {
    width: 56,
    height: 56,
    margin: '0 auto 18px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
    color: '#dc2626',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '1.6rem',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '1.35rem',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.01em',
  },
  subtitle: {
    margin: 0,
    fontSize: '0.92rem',
    color: '#475569',
    lineHeight: 1.55,
  },
  subtle: {
    margin: '14px 0 0',
    fontSize: '0.8rem',
    color: '#94a3b8',
  },
}

export default AssessmentStartPage
