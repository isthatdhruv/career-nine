import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toAbsoluteUrl, KTSVG } from '../../../_metronic/helpers'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8091'

const CounsellorDashboardLogin: React.FC = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    document.body.style.margin = '0'
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

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
      if (err.response?.status === 401) {
        setError('Invalid email or password.')
      } else if (err.response?.status === 403) {
        setError(err.response?.data?.error || 'Your account is not active.')
      } else {
        setError('An error occurred. Please try again later.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* Left Panel — Branding */}
      <div style={{
        flex: '0 0 45%', background: 'linear-gradient(145deg, #064E3B, #0C6B5A, #10B981)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        padding: '60px 48px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Background decorative circles */}
        <div style={{
          position: 'absolute', top: -80, right: -80, width: 300, height: 300,
          borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -60, width: 220, height: 220,
          borderRadius: '50%', background: 'rgba(255,255,255,0.04)',
        }} />
        <div style={{
          position: 'absolute', top: '40%', right: '10%', width: 120, height: 120,
          borderRadius: '50%', background: 'rgba(255,255,255,0.03)',
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 380 }}>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: '#fff', padding: '12px 20px', borderRadius: 14,
              marginBottom: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
            }}
          >
            <img
              src={toAbsoluteUrl('/media/logos/kcc.jpg')}
              alt='Career-9'
              style={{ height: 48, display: 'block' }}
            />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#fff', margin: '0 0 12px', lineHeight: 1.2 }}>
            Counsellor Portal
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, margin: '0 0 40px' }}>
            Empower students with personalised career guidance. Manage your sessions, availability, and student interactions.
          </p>

          {/* Feature highlights */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}>
            {[
              { iconPath: '/media/icons/duotune/general/gen014.svg', text: 'Manage your schedule and availability' },
              { iconPath: '/media/icons/duotune/communication/com014.svg', text: 'Access student assessment reports' },
              { iconPath: '/media/icons/duotune/communication/com007.svg', text: 'Track sessions and add notes' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 18px', borderRadius: 10,
                background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)',
              }}>
                <KTSVG path={item.iconPath} className='svg-icon-2x' svgClassName='text-white' />
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', padding: '40px 48px', background: '#FAFCFB',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative SVG illustrations */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.06 }} viewBox='0 0 500 700' fill='none' xmlns='http://www.w3.org/2000/svg'>
          {/* Curved path top-right */}
          <path d='M420 20 C380 80, 450 140, 400 200 S350 280, 420 320' stroke='#0C6B5A' strokeWidth='2.5' strokeLinecap='round' fill='none' />
          {/* Wavy line top-left */}
          <path d='M30 60 Q60 30, 90 60 T150 60 T210 60' stroke='#10B981' strokeWidth='2' strokeLinecap='round' fill='none' />
          {/* Circle cluster top-right */}
          <circle cx='440' cy='80' r='24' stroke='#0C6B5A' strokeWidth='2' />
          <circle cx='460' cy='60' r='8' fill='#10B981' />
          <circle cx='420' cy='55' r='5' fill='#0C6B5A' />
          {/* Leaf shape left */}
          <path d='M40 250 Q70 210, 80 250 Q70 290, 40 250Z' stroke='#0C6B5A' strokeWidth='2' fill='none' />
          <path d='M60 250 L40 250' stroke='#0C6B5A' strokeWidth='1.5' />
          {/* Dotted arc mid-left */}
          <path d='M20 400 Q80 350, 140 400' stroke='#10B981' strokeWidth='2' strokeDasharray='6 6' strokeLinecap='round' fill='none' />
          {/* Abstract person/counsellor bottom-right */}
          <circle cx='420' cy='520' r='16' stroke='#0C6B5A' strokeWidth='2.5' fill='none' />
          <path d='M404 550 Q420 570, 436 550' stroke='#0C6B5A' strokeWidth='2.5' strokeLinecap='round' fill='none' />
          <line x1='420' y1='536' x2='420' y2='560' stroke='#0C6B5A' strokeWidth='2.5' />
          {/* Book/report shape bottom-left */}
          <rect x='30' y='560' width='40' height='50' rx='4' stroke='#10B981' strokeWidth='2' fill='none' />
          <line x1='50' y1='560' x2='50' y2='610' stroke='#10B981' strokeWidth='1.5' />
          <line x1='38' y1='575' x2='48' y2='575' stroke='#10B981' strokeWidth='1.5' />
          <line x1='38' y1='585' x2='48' y2='585' stroke='#10B981' strokeWidth='1.5' />
          <line x1='38' y1='595' x2='45' y2='595' stroke='#10B981' strokeWidth='1.5' />
          {/* Scattered dots */}
          <circle cx='100' cy='140' r='3' fill='#0C6B5A' />
          <circle cx='350' cy='180' r='4' fill='#10B981' />
          <circle cx='150' cy='480' r='3' fill='#0C6B5A' />
          <circle cx='300' cy='600' r='4' fill='#10B981' />
          <circle cx='380' cy='400' r='3' fill='#0C6B5A' />
          <circle cx='80' cy='340' r='2.5' fill='#10B981' />
          <circle cx='460' cy='300' r='3' fill='#0C6B5A' />
          {/* Graduation cap top-center */}
          <path d='M250 100 L230 112 L250 124 L270 112 Z' stroke='#0C6B5A' strokeWidth='2' fill='none' />
          <line x1='250' y1='124' x2='250' y2='140' stroke='#0C6B5A' strokeWidth='1.5' />
          <path d='M237 118 L237 132 Q250 140, 263 132 L263 118' stroke='#0C6B5A' strokeWidth='1.5' fill='none' />
          {/* Chat bubble mid-right */}
          <rect x='380' cy='380' y='370' width='50' height='35' rx='8' stroke='#10B981' strokeWidth='2' fill='none' />
          <path d='M395 405 L390 415 L405 405' stroke='#10B981' strokeWidth='2' fill='none' />
          <line x1='392' y1='382' x2='418' y2='382' stroke='#10B981' strokeWidth='1.5' strokeLinecap='round' />
          <line x1='392' y1='390' x2='412' y2='390' stroke='#10B981' strokeWidth='1.5' strokeLinecap='round' />
          {/* Curved swoosh bottom */}
          <path d='M0 650 Q150 600, 300 640 T500 620' stroke='#0C6B5A' strokeWidth='2' strokeLinecap='round' fill='none' />
          {/* Star/sparkle */}
          <path d='M320 50 L323 58 L331 58 L325 63 L327 71 L320 66 L313 71 L315 63 L309 58 L317 58 Z' stroke='#10B981' strokeWidth='1.5' fill='none' />
          {/* Calendar icon left */}
          <rect x='60' y='440' width='36' height='32' rx='4' stroke='#0C6B5A' strokeWidth='2' fill='none' />
          <line x1='60' y1='450' x2='96' y2='450' stroke='#0C6B5A' strokeWidth='2' />
          <line x1='70' y1='436' x2='70' y2='444' stroke='#0C6B5A' strokeWidth='2' strokeLinecap='round' />
          <line x1='86' y1='436' x2='86' y2='444' stroke='#0C6B5A' strokeWidth='2' strokeLinecap='round' />
          <circle cx='72' cy='460' r='2' fill='#0C6B5A' />
          <circle cx='84' cy='460' r='2' fill='#0C6B5A' />
        </svg>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: '#1A2B28', margin: '0 0 6px' }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 15, color: '#5C7A72', margin: 0 }}>
              Sign in to your counsellor account
            </p>
          </div>

          {/* Error */}
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

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Email address
              </label>
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

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Password
              </label>
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

            {/* Sign In Button */}
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

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, margin: '28px 0',
          }}>
            <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
            <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              New here?
            </span>
            <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
          </div>

          {/* Create Account */}
          <button
            type='button'
            onClick={() => navigate('/counsellor/register')}
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

          {/* Footer */}
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 28 }}>
            Need help? Contact support@career-9.com
          </p>
        </div>
      </div>
    </div>
  )
}

export default CounsellorDashboardLogin
