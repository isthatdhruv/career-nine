import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../portal/PortalLayout'
import { getCounsellorByUserId } from '../Counselling/API/CounsellorAPI'
import { getSlotsByCounsellor } from '../Counselling/API/SlotAPI'
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
  /**
   * Whether they have any bookable time ahead of them. null while unknown, so the prompt
   * never flashes on for a counsellor who does have slots.
   *
   * <p>This is the gate on everything else: an admin cannot appoint a counsellor with no
   * upcoming slots — the server refuses it — so a counsellor who skips this step is simply
   * never given any students, with nothing on screen to say why.
   */
  const [hasSlots, setHasSlots] = useState<boolean | null>(null)

  const checkSlots = React.useCallback((id: number) => {
    getSlotsByCounsellor(id)
      .then((res) => {
        const slots: any[] = Array.isArray(res.data) ? res.data : []
        const now = Date.now()
        setHasSlots(slots.some((s) => {
          if (s?.isBlocked) return false
          if (!s?.date || !s?.endTime) return true
          const end = new Date(`${s.date}T${s.endTime}`)
          return isNaN(end.getTime()) || end.getTime() > now
        }))
      })
      // Unknown rather than "none": telling someone to add slots they may already have is
      // worse than staying quiet.
      .catch(() => setHasSlots(null))
  }, [])

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
        checkSlots(resolvedId)
      })
      .catch(() => setError('Counsellor profile not found.'))
      .finally(() => setLoading(false))
  }, [currentUser, navigate, checkSlots])

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

      {/* Nothing bookable yet — say so plainly and point at the form below, rather than
          leaving them to work out that an empty calendar is the reason no students appear. */}
      {!loading && counsellorId && hasSlots === false && (
        <div style={{
          background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10,
          padding: '14px 18px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#92400E', marginBottom: 4 }}>
            Add your available slots to get started
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: '#92400E' }}>
            You have no upcoming slots yet, so students cannot book you and you cannot be
            assigned to an assessment. Use <strong>Weekly Schedule</strong> below to set the
            days and hours you are available — slots are created for you automatically.
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748B', fontSize: 14 }}>Loading availability...</div>
      ) : counsellorId ? (
        <CounsellorAvailabilityPanel
          counsellorId={counsellorId}
          wrapperClassName='cp-page-card'
          // Adding or removing availability changes the answer, so re-check and let the
          // prompt disappear the moment they have set something up.
          onChanged={() => checkSlots(counsellorId)}
        />
      ) : null}
    </PortalLayout>
  )
}

export default CounsellorAvailabilityPage
