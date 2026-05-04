import React, { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toAbsoluteUrl, KTSVG } from '../../../_metronic/helpers'
import CounsellorLoginPanel from './CounsellorLoginPanel'
import CounsellorRegisterPanel from './CounsellorRegisterPanel'

type Mode = 'login' | 'register'

const CounsellorAuthPage: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const mode: Mode = useMemo(
    () => (location.pathname.endsWith('/register') ? 'register' : 'login'),
    [location.pathname]
  )

  useEffect(() => {
    document.body.style.margin = '0'
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const switchTo = (next: Mode) => {
    navigate(next === 'register' ? '/counsellor/register' : '/counsellor/login')
  }

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* Left Panel — Static Branding */}
      <div style={{
        flex: '0 0 45%', background: 'linear-gradient(145deg, #064E3B, #0C6B5A, #10B981)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        padding: '60px 48px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', top: '40%', right: '10%', width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 380 }}>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: '#fff', padding: '12px 20px', borderRadius: 14,
              marginBottom: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
            }}
          >
            <img src={toAbsoluteUrl('/media/logos/kcc.jpg')} alt='Career-9' style={{ height: 48, display: 'block' }} />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#fff', margin: '0 0 12px', lineHeight: 1.2 }}>
            Counsellor Portal
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, margin: '0 0 40px' }}>
            Empower students with personalised career guidance. Manage your sessions, availability, and student interactions.
          </p>

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

      {/* Right Panel — Animated Mode Swap */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', padding: '24px 48px', background: '#FAFCFB',
        position: 'relative', overflow: 'hidden', height: '100vh',
      }}>
        <div
          style={{
            position: 'relative', width: '100%', maxWidth: 560,
            height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center',
          }}
        >
          {/* Login panel */}
          <div
            aria-hidden={mode !== 'login'}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              opacity: mode === 'login' ? 1 : 0,
              transform: `translateX(${mode === 'login' ? '0' : '-40px'})`,
              transition: 'opacity 320ms ease, transform 320ms ease',
              pointerEvents: mode === 'login' ? 'auto' : 'none',
            }}
          >
            <CounsellorLoginPanel onSwitchToRegister={() => switchTo('register')} />
          </div>

          {/* Register panel */}
          <div
            aria-hidden={mode !== 'register'}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              opacity: mode === 'register' ? 1 : 0,
              transform: `translateX(${mode === 'register' ? '0' : '40px'})`,
              transition: 'opacity 320ms ease, transform 320ms ease',
              pointerEvents: mode === 'register' ? 'auto' : 'none',
            }}
          >
            <CounsellorRegisterPanel onSwitchToLogin={() => switchTo('login')} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default CounsellorAuthPage
