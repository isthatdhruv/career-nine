import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { toAbsoluteUrl } from '../../../../_metronic/helpers'
import { useAuth } from '../../../modules/auth/core/Auth'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8091'

/**
 * Tokenised SSO landing for the assessment Thank-You page's "Go to Dashboard"
 * button. The student lands here at /student/sso?t=<accessToken>&e=<entitlementId>
 * with no session cookie; we POST those params to /entitlement/redeem-dashboard-token,
 * which validates the token against StudentEntitlement and issues cn_at + cn_csrf
 * for the dashboard domain. We then hydrate currentUser via /auth/me and
 * navigate to /student/dashboard.
 *
 * Failure modes — all redirect to /student/login with a toast so a tampered link
 * cannot silently fail:
 *   - missing t/e in URL
 *   - 401 from redeem-dashboard-token (invalid/expired token)
 *   - 403 (dashboard access not included in this entitlement)
 *   - /auth/me failure after cookie write (cookie domain misconfigured)
 */
const StudentSsoLanding: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setCurrentUser } = useAuth()
  const [status, setStatus] = useState<'redeeming' | 'failed'>('redeeming')
  // StrictMode in dev double-invokes effects; guard so we don't POST twice.
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const token = searchParams.get('t')
    const entitlementId = searchParams.get('e')

    if (!token || !entitlementId) {
      toast.error('Missing session link. Please log in.')
      navigate('/student/login', { replace: true })
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        await axios.post(
          `${API_BASE_URL}/entitlement/redeem-dashboard-token`,
          { token, entitlementId: Number(entitlementId) },
          {
            withCredentials: true,
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          }
        )

        // Cookies are set. Pull the canonical user shape from /auth/me so the
        // permissions/roles/scopes on currentUser match what the regular login
        // path produces — anything we synthesised client-side would diverge.
        const { data: me } = await axios.get(`${API_BASE_URL}/auth/me`, {
          withCredentials: true,
          headers: { Accept: 'application/json' },
        })

        if (cancelled) return

        if (me) {
          setCurrentUser(me)
          navigate('/student/dashboard', { replace: true })
        } else {
          setStatus('failed')
          toast.error('Session could not be established. Please log in.')
          navigate('/student/login', { replace: true })
        }
      } catch (err: any) {
        if (cancelled) return
        const code = err?.response?.status
        if (code === 401) {
          toast.error('Your session link has expired. Please log in.')
        } else if (code === 403) {
          toast.error('Dashboard access is not included in your plan.')
        } else {
          toast.error('We could not sign you in. Please log in manually.')
        }
        setStatus('failed')
        navigate('/student/login', { replace: true })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [navigate, searchParams, setCurrentUser])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F5F7FA',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <img
          src={toAbsoluteUrl('/media/logos/kcc.jpg')}
          alt='Career-9'
          style={{ height: 32, marginBottom: 16 }}
        />
        <div style={{ color: '#6B7A8D', fontSize: 14 }}>
          {status === 'redeeming' ? 'Signing you in…' : 'Redirecting…'}
        </div>
      </div>
    </div>
  )
}

export default StudentSsoLanding
