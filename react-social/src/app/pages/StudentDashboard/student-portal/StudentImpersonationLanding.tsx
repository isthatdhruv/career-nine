import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { toAbsoluteUrl } from '../../../../_metronic/helpers'
import { useAuth } from '../../../modules/auth/core/Auth'
import { IMPERSONATION_STORAGE_KEY } from '../../../modules/auth/core/AuthHelpers'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8091'

/**
 * Admin impersonation landing. Opened in a NEW TAB by the Data Download
 * "Open as Student" button as /student/impersonate?t=<studentJwt>. We move the
 * JWT into per-tab sessionStorage (never a cookie, never localStorage — so the
 * admin's other tabs are untouched), strip it from the URL, hydrate the student
 * user via /auth/me (Bearer, no cookie), and land on /student/dashboard.
 */
const StudentImpersonationLanding: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setCurrentUser } = useAuth()
  const [status, setStatus] = useState<'establishing' | 'failed'>('establishing')
  // StrictMode in dev double-invokes effects; guard so we don't hydrate twice.
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const token = searchParams.get('t')
    if (!token) {
      toast.error('Missing impersonation link.')
      navigate('/auth/login', { replace: true })
      return
    }

    // Store per-tab and strip the token from the URL/history immediately.
    sessionStorage.setItem(IMPERSONATION_STORAGE_KEY, token)
    window.history.replaceState({}, document.title, '/student/impersonate')

    let cancelled = false
    ;(async () => {
      try {
        // Bearer is injected by the global interceptor (reads sessionStorage).
        const { data: me } = await axios.get(`${API_BASE_URL}/auth/me`, {
          headers: { Accept: 'application/json' },
        })
        if (cancelled) return
        if (me) {
          setCurrentUser(me)
          navigate('/student/dashboard', { replace: true })
        } else {
          throw new Error('no user')
        }
      } catch {
        if (cancelled) return
        sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY)
        setStatus('failed')
        toast.error('Could not open the student dashboard. The link may have expired.')
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
          {status === 'establishing' ? 'Opening student dashboard…' : 'Link expired or invalid.'}
        </div>
      </div>
    </div>
  )
}

export default StudentImpersonationLanding
