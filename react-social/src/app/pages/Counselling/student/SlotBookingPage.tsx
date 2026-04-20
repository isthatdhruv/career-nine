import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import '../Counselling.css'
import { showErrorToast } from '../../../utils/toast'
import PortalLayout, { MenuItem } from '../../portal/PortalLayout'
import { getAvailableSlots } from '../API/SlotAPI'
import { bookSlot, rescheduleAppointment } from '../API/AppointmentAPI'
import { getStudentEligibility, EligibilityResponse } from '../API/EligibilityAPI'
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

/** True if a slot's start time has already passed. */
function isSlotInPast(slot: { date: string; startTime: string }): boolean {
  if (!slot?.date || !slot?.startTime) return false
  const start = new Date(`${slot.date}T${slot.startTime}`)
  return !isNaN(start.getTime()) && start.getTime() <= Date.now()
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
  const location = useLocation()
  const rescheduleAppointmentId: number | null =
    (location.state as { rescheduleAppointmentId?: number } | null)?.rescheduleAppointmentId ?? null
  const isReschedule = rescheduleAppointmentId != null

  const { studentId, userId, instituteCode } = (() => {
    try {
      const profile = JSON.parse(localStorage.getItem('studentPortalProfile') || '{}')
      const dashboard = JSON.parse(localStorage.getItem('studentPortalDashboard') || '{}')
      return {
        studentId: profile?.userStudentId || dashboard?.userStudentId || dashboard?.studentInfo?.userStudentId || 0,
        userId: profile?.userId || 0,
        instituteCode: profile?.instituteCode || profile?.institute?.instituteCode || 0,
      }
    } catch {
      return { studentId: 0, userId: 0, instituteCode: 0 }
    }
  })()

  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null)
  const [eligibilityLoading, setEligibilityLoading] = useState(true)
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [weekStart, setWeekStart] = useState<string>(() => getMonday())
  const [reason, setReason] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [booked, setBooked] = useState(false)

  // Check eligibility first — rescheduling bypasses the check
  // since the student already has a confirmed booking.
  useEffect(() => {
    if (isReschedule) { setEligibilityLoading(false); return }
    if (!studentId) { setEligibilityLoading(false); return }
    getStudentEligibility(studentId)
      .then((res) => setEligibility(res.data))
      .catch(() => setEligibility(null))
      .finally(() => setEligibilityLoading(false))
  }, [studentId, isReschedule])

  useEffect(() => {
    setSlotsLoading(true)
    setSlotsError(null)
    setSelectedSlot(null)

    getAvailableSlots(weekStart, instituteCode || undefined)
      .then((res) => {
        const raw = Array.isArray(res.data) ? res.data : []
        // Backend returns `id`; the frontend uses `slotId`. Normalize here.
        const data: Slot[] = raw
          .map((s: any) => ({
            slotId: s.id || s.slotId,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            durationMinutes: s.durationMinutes,
            counsellorName: s.counsellor?.name,
          }))
          .filter((s: Slot) => !isSlotInPast(s))
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
    if (!selectedSlot) return
    if (isReschedule) {
      if (!userId) {
        showErrorToast('Your session has expired. Please log in again to reschedule.')
        return
      }
      setLoading(true)
      rescheduleAppointment(rescheduleAppointmentId!, selectedSlot.slotId, userId)
        .then(() => setBooked(true))
        .catch(() => showErrorToast('Could not reschedule the session. Please try again.'))
        .finally(() => setLoading(false))
      return
    }
    if (!reason.trim() || !studentId) return
    setLoading(true)
    bookSlot(selectedSlot.slotId, studentId, reason.trim())
      .then(() => setBooked(true))
      .catch(() => showErrorToast('Could not complete the booking. Please try again.'))
      .finally(() => setLoading(false))
  }

  // Block access if not eligible
  if (eligibilityLoading) {
    return (
      <PortalLayout title='Career Navigator 360' menuItems={STUDENT_MENU_ITEMS} storageKeys={STUDENT_STORAGE_KEYS} loginPath='/student/login'>
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--sp-muted, #5C7A72)', fontSize: 14 }}>
          Checking eligibility...
        </div>
      </PortalLayout>
    )
  }

  if (!isReschedule && (!eligibility || eligibility.action !== 'BOOK_COUNSELLING')) {
    return (
      <PortalLayout title='Career Navigator 360' menuItems={STUDENT_MENU_ITEMS} storageKeys={STUDENT_STORAGE_KEYS} loginPath='/student/login'>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <button onClick={() => navigate('/student/counselling')} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 8, border: '1.5px solid var(--sp-border, #D1E5DF)',
              background: 'var(--sp-card, #fff)', cursor: 'pointer', color: 'var(--sp-text, #1A2B28)', flexShrink: 0,
            }} title='Back'>
              <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                <polyline points='15 18 9 12 15 6' />
              </svg>
            </button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--sp-text, #1A2B28)', margin: 0 }}>Counselling</h1>
            </div>
          </div>

          {/* Recommendation Card */}
          <div style={{
            background: 'linear-gradient(135deg, #FFF7ED, #FFF3E0)', border: '1.5px solid #FED7AA',
            borderRadius: 14, padding: '32px 28px', textAlign: 'center',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: '#FEF3C7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width='30' height='30' viewBox='0 0 24 24' fill='none' stroke='#D97706' strokeWidth='2'>
                <path d='M12 2L2 7l10 5 10-5-10-5z' /><path d='M2 17l10 5 10-5' /><path d='M2 12l10 5 10-5' />
              </svg>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#92400E', margin: '0 0 10px' }}>
              Unlock Expert Career Guidance
            </h2>
            <p style={{ fontSize: 14, color: '#78350F', lineHeight: 1.7, margin: '0 0 24px', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
              {eligibility?.track === 'NO_ASSESSMENT'
                ? 'Complete your career assessment first to unlock personalised counselling with our experts.'
                : eligibility?.track === 'REPORT_PENDING'
                ? 'Your assessment report is being generated. Once ready, you can pay for a one-on-one counselling session.'
                : 'Get a one-on-one session with a certified career counsellor who will review your assessment report and help you plan your future.'}
            </p>

            {/* Benefits */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28, textAlign: 'left', maxWidth: 360, margin: '0 auto 28px' }}>
              {[
                'Personalised career roadmap based on your assessment',
                'Expert guidance on stream & college selection',
                'One-on-one session with a certified counsellor',
              ].map((text, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#78350F' }}>
                  <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#D97706' strokeWidth='2.5' style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d='M20 6L9 17l-5-5' />
                  </svg>
                  <span>{text}</span>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {eligibility?.track === 'NO_ASSESSMENT' ? (
                <button onClick={() => navigate('/student/assessments')} style={{
                  padding: '12px 28px', fontSize: 14, fontWeight: 600, border: 'none', borderRadius: 10,
                  background: '#D97706', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(217,119,6,0.3)',
                }}>
                  Take Assessment
                </button>
              ) : eligibility?.track === 'REPORT_PENDING' ? (
                <button onClick={() => navigate('/student/dashboard')} style={{
                  padding: '12px 28px', fontSize: 14, fontWeight: 600, border: 'none', borderRadius: 10,
                  background: '#D97706', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(217,119,6,0.3)',
                }}>
                  Back to Dashboard
                </button>
              ) : (
                <>
                  <button onClick={() => alert('Payment for counselling is coming soon!')} style={{
                    padding: '12px 28px', fontSize: 14, fontWeight: 600, border: 'none', borderRadius: 10,
                    background: '#D97706', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(217,119,6,0.3)',
                  }}>
                    Pay for Counselling
                  </button>
                  <button onClick={() => navigate('/student/reports')} style={{
                    padding: '12px 28px', fontSize: 14, fontWeight: 600, border: '1.5px solid #FED7AA',
                    borderRadius: 10, background: '#fff', color: '#92400E', cursor: 'pointer',
                  }}>
                    View Report
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </PortalLayout>
    )
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
              {isReschedule ? 'Session Rescheduled!' : 'Session Booked!'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--sp-muted)', marginBottom: 28, lineHeight: 1.6 }}>
              {isReschedule
                ? 'Your counselling session has been moved to the new slot. You will receive a notification with the updated details.'
                : 'Your counselling session has been confirmed. A counsellor has been assigned automatically. You will receive a notification with session details.'}
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
              {isReschedule ? 'Reschedule Your Session' : 'Book a Counselling Session'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)', marginTop: 3, marginBottom: 0 }}>
              {isReschedule ? 'Select a new slot for your session' : 'Select an available slot below'}
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

      </div>

      {/* Booking modal */}
      {selectedSlot && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => !loading && handleCancelForm()}
        >
          <div
            style={{
              width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 12px 40px rgba(0,0,0,0.2)', borderRadius: 12,
              background: '#fff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <BookingForm
              selectedSlot={selectedSlot}
              reason={reason}
              onReasonChange={setReason}
              onSubmit={handleSubmit}
              onCancel={handleCancelForm}
              loading={loading}
              mode={isReschedule ? 'reschedule' : 'book'}
            />
          </div>
        </div>
      )}
    </PortalLayout>
  )
}

export default SlotBookingPage
