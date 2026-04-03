import React, { useState, useEffect } from 'react'
import { useAuth } from '../../../modules/auth'
import { showErrorToast } from '../../../utils/toast'
import { getSlotsByCounsellor, deleteSlot } from '../API/SlotAPI'
import { getCounsellorByUserId } from '../API/CounsellorAPI'
import axios from 'axios'
import RecurringTemplateForm from './components/RecurringTemplateForm'
import ManualSlotForm from './components/ManualSlotForm'
import BlockDateForm from './components/BlockDateForm'
import '../Counselling.css'

const API_URL = process.env.REACT_APP_API_URL
const TEMPLATE_BASE = `${API_URL}/api/availability-template`

const AvailabilityManagerPage: React.FC = () => {
  const { currentUser } = useAuth()

  const [counsellor, setCounsellor] = useState<any>(null)
  const [templates, setTemplates] = useState<any[]>([])
  const [manualSlots, setManualSlots] = useState<any[]>([])
  const [blockedDates, setBlockedDates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const userId: number | undefined =
    currentUser?.id ??
    (() => {
      try {
        const stored = localStorage.getItem('counsellorPortalUser')
        if (stored) return JSON.parse(stored)?.id
      } catch {
        return undefined
      }
    })()

  const fetchAll = async (counsellorId: number) => {
    try {
      // Fetch recurring templates
      const tmplRes = await axios.get(`${TEMPLATE_BASE}/by-counsellor/${counsellorId}`)
      const allTemplates = tmplRes.data || []
      setTemplates(allTemplates.filter((t: any) => !t.isManual && !t.isBlocked))

      // Fetch all slots
      const slotsRes = await getSlotsByCounsellor(counsellorId)
      const allSlots: any[] = slotsRes.data || []
      setManualSlots(allSlots.filter((s: any) => s.isManual && !s.isBlocked))
      setBlockedDates(allSlots.filter((s: any) => s.isBlocked))
    } catch {
      setError('Failed to load availability data.')
    }
  }

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const init = async () => {
      try {
        const res = await getCounsellorByUserId(userId)
        const counsellorData = res.data
        setCounsellor(counsellorData)
        await fetchAll(counsellorData.id)
      } catch {
        setError('Failed to load counsellor profile.')
      } finally {
        setLoading(false)
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const handleRefresh = () => {
    if (counsellor?.id) fetchAll(counsellor.id)
  }

  const handleDeleteSlot = async (id: number) => {
    try {
      await deleteSlot(id)
      handleRefresh()
    } catch {
      showErrorToast('Failed to delete slot.')
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--sp-muted, #5C7A72)' }}>
        Loading availability...
      </div>
    )
  }

  if (!userId || !counsellor) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--sp-danger, #EF4444)' }}>
        {error || 'Could not load counsellor profile. Please log in.'}
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--sp-text, #1A2B28)', margin: 0 }}>
          Availability Manager
        </h2>
        <p style={{ fontSize: 14, color: 'var(--sp-muted, #5C7A72)', margin: '4px 0 0' }}>
          Manage your recurring schedule and one-off overrides.
        </p>
        {error && (
          <p style={{ fontSize: 13, color: 'var(--sp-danger, #EF4444)', marginTop: 8 }}>{error}</p>
        )}
      </div>

      {/* Two-column layout */}
      <div
        className='cl-availability-grid'
        style={{ alignItems: 'start' }}
      >
        {/* Left column: Recurring Templates */}
        <div className='cl-card'>
          <RecurringTemplateForm
            counsellorId={counsellor.id}
            templates={templates}
            onSaved={handleRefresh}
          />
        </div>

        {/* Right column: Manual Overrides */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Manual slots section */}
          <div className='cl-card'>
            <ManualSlotForm counsellorId={counsellor.id} onSaved={handleRefresh} />

            {manualSlots.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h5 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sp-text, #1A2B28)', marginBottom: 10 }}>
                  Existing Extra Slots
                </h5>
                {manualSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className='cl-card'
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      marginBottom: 8,
                      background: 'var(--sp-bg, #F2F7F5)',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--sp-text, #1A2B28)' }}>
                        {slot.date}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)', marginLeft: 8 }}>
                        {slot.startTime} – {slot.endTime}
                      </span>
                    </div>
                    <button
                      className='cl-btn-danger'
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => handleDeleteSlot(slot.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Blocked dates section */}
          <div className='cl-card'>
            <BlockDateForm counsellorId={counsellor.id} onSaved={handleRefresh} />

            {blockedDates.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h5 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sp-text, #1A2B28)', marginBottom: 10 }}>
                  Blocked Dates
                </h5>
                {blockedDates.map((b) => (
                  <div
                    key={b.id}
                    className='cl-card'
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      marginBottom: 8,
                      background: '#FEF2F2',
                      borderColor: '#FECACA',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--sp-text, #1A2B28)' }}>
                        {b.date}
                      </span>
                      {b.reason && (
                        <span style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', marginLeft: 8 }}>
                          {b.reason}
                        </span>
                      )}
                    </div>
                    <button
                      className='cl-btn-danger'
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => handleDeleteSlot(b.id)}
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AvailabilityManagerPage
