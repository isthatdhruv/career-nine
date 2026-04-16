import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../Counselling.css'
import { showErrorToast } from '../../../utils/toast'
import PortalLayout, { MenuItem } from '../../portal/PortalLayout'
import { getAvailableSlots } from '../API/SlotAPI'
import { bookSlot } from '../API/AppointmentAPI'
import SlotGrid from './components/SlotGrid'
import BookingForm from './components/BookingForm'

const STUDENT_MENU_ITEMS: MenuItem[] = [
  { label: 'Dashboard', path: '/student/dashboard', icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><rect x='3' y='3' width='7' height='7' rx='1'/><rect x='14' y='3' width='7' height='7' rx='1'/><rect x='3' y='14' width='7' height='7' rx='1'/><rect x='14' y='14' width='7' height='7' rx='1'/></svg> },
  { label: 'Assessments', path: '/student/assessments', icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M9 11l3 3L22 4'/><path d='M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'/></svg> },
  { label: 'My Reports', path: '/student/reports', icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><polyline points='14 2 14 8 20 8'/><line x1='16' y1='13' x2='8' y2='13'/><line x1='16' y1='17' x2='8' y2='17'/></svg> },
  { label: 'Counselling', path: '/student/counselling', icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/></svg> },
]
const STUDENT_STORAGE_KEYS = ['studentPortalProfile', 'studentPortalDashboard', 'studentPortalLoggedIn']

interface Slot {
  slotId: number
  date: string
  startTime: string
  endTime: string
  durationMinutes: number
  counsellorName?: string
}

/** Returns ISO date string for the Monday of the current week */
function getMonday(referenceDate?: Date): string {
  const d = referenceDate ? new Date(referenceDate) : new Date()
  const day = d.getDay() // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** Advance or retreat weekStart by N weeks */
function shiftWeek(weekStart: string, weeks: number): string {
  try {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + weeks * 7)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  } catch {
    return weekStart
  }
}

/** Format a week label like "31 Mar – 4 Apr 2026" */
function formatWeekLabel(weekStart: string): string {
  try {
    const start = new Date(weekStart + 'T00:00:00')
    const end = new Date(weekStart + 'T00:00:00')
    end.setDate(start.getDate() + 4)

    const startStr = start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    const endStr = end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${startStr} – ${endStr}`
  } catch {
    return weekStart
  }
}

const SlotBookingPage: React.FC = () => {
  const navigate = useNavigate()

  const { studentId, instituteCode } = (() => {
    try {
      const profile = JSON.parse(localStorage.getItem('studentPortalProfile') || '{}')
      const dashboard = JSON.parse(localStorage.getItem('studentPortalDashboard') || '{}')
      return {
        studentId: dashboard?.userStudentId || 0,
        instituteCode: profile?.instituteCode || profile?.institute?.instituteCode || 0,
      }
    } catch {
      return { studentId: 0, instituteCode: 0 }
    }
  })()

  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [weekStart, setWeekStart] = useState<string>(() => getMonday())
  const [reason, setReason] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [booked, setBooked] = useState(false)

  useEffect(() => {
    setSlotsLoading(true)
    setSlotsError(null)
    setSelectedSlot(null)

    getAvailableSlots(weekStart, instituteCode || undefined)
      .then((res) => {
        const data: Slot[] = Array.isArray(res.data) ? res.data : []
        setSlots(data)
      })
      .catch(() => {
        setSlotsError('Could not load available slots. Please try again.')
        setSlots([])
      })
      .finally(() => setSlotsLoading(false))
  }, [weekStart, instituteCode])

  const handlePrevWeek = () => {
    setWeekStart((prev) => shiftWeek(prev, -1))
  }

  const handleNextWeek = () => {
    setWeekStart((prev) => shiftWeek(prev, 1))
  }

  const handleSelectSlot = (slot: Slot) => {
    setSelectedSlot(slot)
  }

  const handleCancelForm = () => {
    setSelectedSlot(null)
    setReason('')
  }

  const handleSubmit = () => {
    if (!selectedSlot || !reason.trim() || !studentId) return
    setLoading(true)
    bookSlot(selectedSlot.slotId, studentId, reason.trim())
      .then(() => {
        setBooked(true)
      })
      .catch(() => {
        showErrorToast('Could not complete the booking. Please try again.')
      })
      .finally(() => setLoading(false))
  }

  if (booked) {
    return (
      <PortalLayout title='Career Navigator 360' menuItems={STUDENT_MENU_ITEMS} storageKeys={STUDENT_STORAGE_KEYS} loginPath='/student/login'>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
          <div className='cl-card' style={{ maxWidth: 480, width: '100%', textAlign: 'center', padding: 40 }}>
            <div
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--sp-primary-light, #EEFABD)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <svg width='28' height='28' viewBox='0 0 24 24' fill='none' stroke='var(--sp-primary, #263B6A)' strokeWidth='2.5'>
                <path d='M20 6L9 17l-5-5' />
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--sp-text)', margin: '0 0 8px' }}>
              Session Booked!
            </h2>
            <p style={{ fontSize: 13, color: 'var(--sp-muted)', marginBottom: 28, lineHeight: 1.6 }}>
              Your counselling session has been confirmed. A counsellor has been assigned automatically. You will receive a notification with session details.
            </p>
            <button className='cl-btn-primary' onClick={() => navigate('/student/counselling')} style={{ fontSize: 13 }}>
              Back to My Sessions
            </button>
          </div>
        </div>
      </PortalLayout>
    )
  }

  return (
    <PortalLayout
      title='Career Navigator 360'
      menuItems={STUDENT_MENU_ITEMS}
      storageKeys={STUDENT_STORAGE_KEYS}
      loginPath='/student/login'
    >
      <div style={{ maxWidth: 860 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button
            onClick={() => navigate('/student/counselling')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 8,
              border: '1.5px solid var(--sp-border, #D1E5DF)',
              background: 'var(--sp-card, #fff)',
              cursor: 'pointer',
              color: 'var(--sp-text, #1A2B28)',
              flexShrink: 0,
            }}
            title='Back'
          >
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <polyline points='15 18 9 12 15 6' />
            </svg>
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--sp-text, #1A2B28)', margin: 0 }}>
              Book a Counselling Session
            </h1>
            <p style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)', marginTop: 3, marginBottom: 0 }}>
              Select an available slot below
            </p>
          </div>
        </div>

        {/* Week navigation */}
        <div className='cl-card' style={{ marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            <button
              className='cl-btn-outline'
              onClick={handlePrevWeek}
              disabled={slotsLoading}
              style={{ fontSize: 13, padding: '6px 14px' }}
            >
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                <polyline points='15 18 9 12 15 6' />
              </svg>
              Prev
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--sp-text, #1A2B28)' }}>
              {formatWeekLabel(weekStart)}
            </span>
            <button
              className='cl-btn-outline'
              onClick={handleNextWeek}
              disabled={slotsLoading}
              style={{ fontSize: 13, padding: '6px 14px' }}
            >
              Next
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                <polyline points='9 18 15 12 9 6' />
              </svg>
            </button>
          </div>

          {slotsLoading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--sp-muted, #5C7A72)', fontSize: 13 }}>
              Loading available slots...
            </div>
          ) : slotsError ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--sp-danger, #EF4444)', fontSize: 13 }}>
              {slotsError}
            </div>
          ) : (
            <SlotGrid
              slots={slots}
              selectedSlotId={selectedSlot?.slotId ?? null}
              onSelectSlot={handleSelectSlot}
              weekStart={weekStart}
            />
          )}
        </div>

        {/* Booking form */}
        {selectedSlot && (
          <BookingForm
            selectedSlot={selectedSlot}
            reason={reason}
            onReasonChange={setReason}
            onSubmit={handleSubmit}
            onCancel={handleCancelForm}
            loading={loading}
          />
        )}
      </div>
    </PortalLayout>
  )
}

export default SlotBookingPage
