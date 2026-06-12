import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toAbsoluteUrl } from '../../../_metronic/helpers'
import PortalLayout from '../portal/PortalLayout'
import AppointmentCalendar from './components/AppointmentCalendar'
import SessionNotes from './components/SessionNotes'
import { getCounsellorByUserId } from '../Counselling/API/CounsellorAPI'
import { useAuth } from '../../modules/auth'
import { COUNSELLOR_MENU_ITEMS } from './counsellorMenu'
import './CounsellorPortal.css'

const CounsellorPortalDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [counsellorId, setCounsellorId] = useState<number | null>(null)
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)

  // Phase 19: replaced the legacy localStorage JSON-blob reads with useAuth().
  // CounsellorRoutes' guard already enforces COUNSELLOR-role + currentUser presence;
  // if we reach here without currentUser, the guard navigated us away. The fallback
  // navigate below is a defensive belt-and-braces for the race between mount and
  // guard re-evaluation.
  // TODO(phase-19-followup): /auth/me does not yet expose `counsellorId`.
  // Until it does, we resolve counsellorId via the existing
  // getCounsellorByUserId(currentUser.id) lookup — same as the legacy fallback path.
  useEffect(() => {
    if (!currentUser) {
      navigate('/counsellor/login', { replace: true })
      return
    }
    getCounsellorByUserId(currentUser.id)
      .then((res) => {
        setCounsellorId(res.data?.id || null)
        setProfileImageUrl(res.data?.profileImageUrl || null)
      })
      .catch(() => setCounsellorId(null))
      .finally(() => setLoading(false))
  }, [currentUser, navigate])


  if (loading) {
    return (
      <div className='cp-loading'>
        <img src={toAbsoluteUrl('/media/logos/kcc.jpg')} alt='Career-9' />
        <span className='cp-loading-text'>Loading ...</span>
      </div>
    )
  }

  return (
    <PortalLayout
      title='Counsellor Dashboard'
      menuItems={COUNSELLOR_MENU_ITEMS}
      storageKeys={[]}
      loginPath='/counsellor/login'
    >
      {/* Welcome Header */}
      <div className='cp-welcome'>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', overflow: 'hidden',
              background: '#E8F5E9', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, border: '2px solid #D1E5DF',
            }}>
              {profileImageUrl ? (
                <img src={profileImageUrl} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 20, fontWeight: 700, color: '#0C6B5A' }}>
                  {currentUser?.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              )}
            </div>
            <div>
              <h2 className='cp-welcome-title'>
                Welcome, {currentUser?.name || 'Counsellor'}
              </h2>
              <p className='cp-welcome-sub'>
                Career-9 &middot; Counsellor Dashboard
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Appointments + Session Notes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <AppointmentCalendar counsellorId={counsellorId} />
        <SessionNotes counsellorId={counsellorId} />
      </div>
    </PortalLayout>
  )
}

export default CounsellorPortalDashboard
