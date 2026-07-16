import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toAbsoluteUrl } from '../../../_metronic/helpers'
import PortalLayout from '../portal/PortalLayout'
import AppointmentCalendar from './components/AppointmentCalendar'
import SessionNotes from './components/SessionNotes'
import CounsellorEngagements from './components/CounsellorEngagements'
import { getCounsellorByUserId } from '../Counselling/API/CounsellorAPI'
import { useAuth } from '../../modules/auth'
import { COUNSELLOR_MENU_ITEMS } from './counsellorMenu'
import PageHeader from '../../components/PageHeader'
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
      <PageHeader
        icon={
          profileImageUrl ? (
            <img src={profileImageUrl} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
          ) : (
            <i className='bi bi-person-circle' />
          )
        }
        title={`Welcome, ${currentUser?.name || 'Counsellor'}`}
        subtitle='Career-9 · Counsellor Dashboard'
      />
      <div style={{ height: 16 }} />

      {/* Institutes & assessments — conducted and upcoming sessions */}
      <CounsellorEngagements counsellorId={counsellorId} />

      {/* Appointments + Session Notes */}
      <div className='cp-page-card'>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <AppointmentCalendar counsellorId={counsellorId} />
          <SessionNotes counsellorId={counsellorId} />
        </div>
      </div>
    </PortalLayout>
  )
}

export default CounsellorPortalDashboard
