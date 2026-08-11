import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../modules/auth/core/Auth'
import { IMPERSONATION_STORAGE_KEY, IMPERSONATION_MODE_KEY } from '../../modules/auth/core/AuthHelpers'
import { showErrorToast } from '../../utils/toast'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8091'

/**
 * Admin impersonation landing for the counsellor portal — the counsellor-side twin of
 * StudentImpersonationLanding.
 *
 * <p>Opened in a NEW TAB by "Open as Counsellor" on Manage Counsellors, as
 * {@code /counsellor/impersonate?t=<jwt>}. The token goes into per-tab sessionStorage —
 * never a cookie, never localStorage — so the admin's own session in every other tab is
 * untouched, and closing this tab ends the impersonation. The token is stripped from the
 * URL immediately so it cannot be shared or left in history.
 */
const CounsellorImpersonationLanding: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setCurrentUser } = useAuth()
  const [status, setStatus] = useState<'establishing' | 'failed'>('establishing')
  // StrictMode double-invokes effects in dev; guard so we don't hydrate twice.
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const token = searchParams.get('t')
    if (!token) {
      showErrorToast('Missing impersonation link.')
      navigate('/counsellor/login', { replace: true })
      return
    }

    sessionStorage.setItem(IMPERSONATION_STORAGE_KEY, token)
    // Marks this tab as the counsellor portal, so the sidebar shows the counsellor menu
    // even when the impersonated account also holds admin roles.
    sessionStorage.setItem(IMPERSONATION_MODE_KEY, 'counsellor')
    window.history.replaceState({}, document.title, '/counsellor/impersonate')

    ;(async () => {
      try {
        // Bearer is injected by the global interceptor, which reads sessionStorage.
        const { data: me } = await axios.get(`${API_BASE_URL}/auth/me`, {
          headers: { Accept: 'application/json' },
        })
        if (me) {
          setCurrentUser(me)
          navigate('/counsellor/dashboard', { replace: true })
        } else {
          throw new Error('no user')
        }
      } catch {
        sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY)
        sessionStorage.removeItem(IMPERSONATION_MODE_KEY)
        setStatus('failed')
      }
    })()
  }, [searchParams, navigate, setCurrentUser])

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: '#475569',
      }}
    >
      {status === 'establishing' ? (
        <>
          <div className='spinner-border text-primary' role='status' aria-hidden='true' />
          <div style={{ fontSize: 14 }}>Opening the counsellor portal…</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#B91C1C' }}>
            Could not open this counsellor's portal.
          </div>
          <div style={{ fontSize: 13 }}>
            The link may have expired. Close this tab and try again from Manage Counsellors.
          </div>
        </>
      )}
    </div>
  )
}

export default CounsellorImpersonationLanding
