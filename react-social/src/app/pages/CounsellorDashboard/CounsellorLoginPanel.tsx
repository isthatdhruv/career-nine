import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8091'

interface CounsellorLoginPanelProps {
  onSwitchToRegister: () => void
}

const CounsellorLoginPanel: React.FC<CounsellorLoginPanelProps> = ({ onSwitchToRegister }) => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/counsellor/login`,
        { email: email.trim(), password },
        { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } }
      )
      localStorage.setItem('counsellorPortalUser', JSON.stringify(data))
      localStorage.setItem('counsellorPortalLoggedIn', 'true')
      navigate('/counsellor/dashboard')
    } catch (err: any) {
      if (err.response?.status === 401) setError('Invalid email or password.')
      else if (err.response?.status === 403) setError(err.response?.data?.error || 'Your account is not active.')
      else setError('An error occurred. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 400 }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: '#1A2B28', margin: '0 0 6px' }}>Welcome back</h2>
        <p style={{ fontSize: 15, color: '#5C7A72', margin: 0 }}>Sign in to your counsellor account</p>
      </div>

      {error && (
        <div style={{
          marginBottom: 20, padding: '12px 16px', borderRadius: 10,
          background: '#FEF2F2', border: '1px solid #FECACA',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#DC2626' strokeWidth='2' style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx='12' cy='12' r='10' /><line x1='15' y1='9' x2='9' y2='15' /><line x1='9' y1='9' x2='15' y2='15' />
          </svg>
          <span style={{ fontSize: 13, color: '#991B1B', lineHeight: 1.5 }}>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email address</label>
          <div style={{ position: 'relative' }}>
            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#9CA3AF' strokeWidth='2'
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
              <path d='M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z' />
              <polyline points='22,6 12,13 2,6' />
            </svg>
            <input
              type='email'
              placeholder='name@example.com'
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              style={{
                width: '100%', padding: '12px 14px 12px 44px',
                border: '1.5px solid #D1D5DB', borderRadius: 10, fontSize: 14,
                outline: 'none', background: '#fff', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#0C6B5A'}
              onBlur={(e) => e.target.style.borderColor = '#D1D5DB'}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password</label>
          <div style={{ position: 'relative' }}>
            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#9CA3AF' strokeWidth='2'
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
              <rect x='3' y='11' width='18' height='11' rx='2' ry='2' /><path d='M7 11V7a5 5 0 0 1 10 0v4' />
            </svg>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder='Enter your password'
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              style={{
                width: '100%', padding: '12px 44px 12px 44px',
                border: '1.5px solid #D1D5DB', borderRadius: 10, fontSize: 14,
                outline: 'none', background: '#fff', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#0C6B5A'}
              onBlur={(e) => e.target.style.borderColor = '#D1D5DB'}
            />
            <button
              type='button'
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                color: '#9CA3AF', display: 'flex',
              }}
            >
              {showPassword ? (
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24' />
                  <line x1='1' y1='1' x2='23' y2='23' />
                </svg>
              ) : (
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' /><circle cx='12' cy='12' r='3' />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button
          type='submit'
          disabled={loading}
          style={{
            width: '100%', padding: '13px 0', fontSize: 15, fontWeight: 600,
            border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? '#9CA3AF' : 'linear-gradient(135deg, #064E3B, #0C6B5A)',
            color: '#fff', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(12,107,90,0.3)',
            marginTop: 4,
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '28px 0' }}>
        <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
        <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>New here?</span>
        <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
      </div>

      <button
        type='button'
        onClick={onSwitchToRegister}
        style={{
          width: '100%', padding: '13px 0', fontSize: 15, fontWeight: 600,
          border: '1.5px solid #D1E5DF', borderRadius: 10, cursor: 'pointer',
          background: '#fff', color: '#0C6B5A', transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#F0FFF4'; e.currentTarget.style.borderColor = '#0C6B5A' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#D1E5DF' }}
      >
        Create Account
      </button>

      <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 28 }}>
        Need help? Contact support@career-9.com
      </p>
    </div>
  )
}

export default CounsellorLoginPanel
