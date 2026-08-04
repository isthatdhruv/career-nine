import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../portal/PortalLayout'
import { getCounsellorByUserId } from '../Counselling/API/CounsellorAPI'
import CounsellorAvailabilityPanel from '../Counselling/shared/CounsellorAvailabilityPanel'
import { useAuth } from '../../modules/auth'
import { COUNSELLOR_MENU_ITEMS } from './counsellorMenu'
import PageHeader from '../../components/PageHeader'
import './CounsellorPortal.css'

/**
 * Counsellor's own availability screen. The workspace itself lives in
 * CounsellorAvailabilityPanel, which the admin also renders from Manage
 * Counsellors — so both sides get exactly the same tools.
 */
const CounsellorAvailabilityPage: React.FC = () => {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [counsellorId, setCounsellorId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Phase 19: derive counsellorId from useAuth().currentUser.
    // TODO(phase-19-followup): /auth/me does not yet expose counsellorId;
    // resolve it via getCounsellorByUserId until the backend payload includes it.
    if (!currentUser) {
      navigate('/counsellor/login', { replace: true })
      return
    }

    getCounsellorByUserId(currentUser.id)
      .then((res) => {
        const resolvedId = res.data?.id
        if (!resolvedId) {
          setError('Counsellor profile not found.')
          return
        }
        setCounsellorId(resolvedId)
      })
      .catch(() => setError('Counsellor profile not found.'))
      .finally(() => setLoading(false))
  }, [currentUser, navigate])

  return (
    <PortalLayout
      title='Counsellor Dashboard'
      menuItems={COUNSELLOR_MENU_ITEMS}
      storageKeys={[]}
      loginPath='/counsellor/login'
    >
      {/* Header */}
      <PageHeader
        icon={<i className='bi bi-calendar2-week' />}
        title='My Availability'
        subtitle='View your assigned slots and block unavailable dates'
      />
      <div style={{ height: 16 }} />

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '10px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748B', fontSize: 14 }}>Loading availability...</div>
      ) : counsellorId ? (
        <CounsellorAvailabilityPanel counsellorId={counsellorId} wrapperClassName='cp-page-card' />
      ) : null}
    </PortalLayout>
  )
}

export default CounsellorAvailabilityPage
