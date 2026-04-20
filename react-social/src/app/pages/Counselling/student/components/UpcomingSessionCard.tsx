import React, { useEffect, useState } from 'react'
import StatusBadge from '../../shared/StatusBadge'
import CountdownTimer from '../../shared/CountdownTimer'
import '../../Counselling.css'

const JOIN_WINDOW_MS = 5 * 60 * 1000
const RESCHEDULE_CUTOFF_MS = 4 * 60 * 60 * 1000

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'less than a minute'
  const totalMinutes = Math.floor(ms / 60000)
  if (totalMinutes < 1) return 'less than a minute'
  if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) return `${hours} hour${hours === 1 ? '' : 's'}`
  return `${hours} hour${hours === 1 ? '' : 's'} ${minutes} minute${minutes === 1 ? '' : 's'}`
}

function buildSlotDateTime(dateStr: string, timeStr: string): number {
  if (!dateStr || !timeStr) return NaN
  const parts = timeStr.split(':')
  const hh = (parts[0] || '00').padStart(2, '0')
  const mm = (parts[1] || '00').padStart(2, '0')
  const ss = (parts[2] || '00').padStart(2, '0')
  const d = new Date(`${dateStr}T${hh}:${mm}:${ss}`)
  return d.getTime()
}

interface Slot {
  date: string
  startTime: string
  endTime: string
  durationMinutes: number
}

interface Appointment {
  appointmentId: number
  status: string
  reason?: string
  meetingLink?: string
  slot: Slot
  counsellorName?: string
}

interface UpcomingSessionCardProps {
  appointment: Appointment
  onReschedule: (appointmentId: number) => void
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatTime(timeStr: string): string {
  try {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
  } catch {
    return timeStr
  }
}

const UpcomingSessionCard: React.FC<UpcomingSessionCardProps> = ({ appointment, onReschedule }) => {
  const { appointmentId, status, meetingLink, slot, counsellorName, reason } = appointment

  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(interval)
  }, [])

  const startMs = buildSlotDateTime(slot.date, slot.startTime)
  const endMs = buildSlotDateTime(slot.date, slot.endTime)
  const canJoin =
    !!meetingLink &&
    !isNaN(startMs) &&
    !isNaN(endMs) &&
    now >= startMs - JOIN_WINDOW_MS &&
    now < endMs

  const msUntilStart = isNaN(startMs) ? Infinity : startMs - now
  const rescheduleBlocked = msUntilStart < RESCHEDULE_CUTOFF_MS

  return (
    <div className='cl-card cl-card-accent' style={{ marginBottom: 16 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <StatusBadge status={status} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', fontWeight: 500 }}>Starts in</span>
          <CountdownTimer targetDate={slot.date} targetTime={slot.startTime} />
        </div>
      </div>

      {/* Date & Time */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='var(--sp-primary, #0C6B5A)' strokeWidth='2'>
            <rect x='3' y='4' width='18' height='18' rx='2' ry='2' />
            <line x1='16' y1='2' x2='16' y2='6' />
            <line x1='8' y1='2' x2='8' y2='6' />
            <line x1='3' y1='10' x2='21' y2='10' />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--sp-text, #1A2B28)' }}>
            {formatDate(slot.date)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='var(--sp-primary, #0C6B5A)' strokeWidth='2'>
            <circle cx='12' cy='12' r='10' />
            <polyline points='12 6 12 12 16 14' />
          </svg>
          <span style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)' }}>
            {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
            {slot.durationMinutes > 0 && (
              <span style={{ marginLeft: 6, color: 'var(--sp-muted, #5C7A72)', fontSize: 12 }}>
                ({slot.durationMinutes} min)
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Counsellor */}
      {counsellorName && (
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', fontWeight: 500 }}>Counsellor: </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sp-text, #1A2B28)' }}>{counsellorName}</span>
        </div>
      )}

      {/* Reason */}
      {reason && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', fontWeight: 500, marginBottom: 2 }}>Reason</div>
          <div style={{ fontSize: 13, color: 'var(--sp-text, #1A2B28)', lineHeight: 1.5 }}>{reason}</div>
        </div>
      )}

      {/* Meeting Link — visible only within 5 minutes of the session start */}
      {canJoin ? (
        <div style={{ marginBottom: 14 }}>
          <a
            href={meetingLink}
            target='_blank'
            rel='noopener noreferrer'
            className='cl-btn-blue'
            style={{ textDecoration: 'none', fontSize: 13 }}
          >
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.889L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z' />
            </svg>
            Join Meeting
          </a>
        </div>
      ) : meetingLink ? (
        <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--sp-muted, #5C7A72)' }}>
          Join Meeting will be available 5 minutes before the session starts.
        </div>
      ) : null}

      {/* Reschedule cutoff warning (shown when session is within 4 hours) */}
      {rescheduleBlocked && (
        <div
          role='alert'
          style={{
            marginBottom: 12, padding: '10px 12px',
            background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8,
            display: 'flex', alignItems: 'flex-start', gap: 8,
            fontSize: 12.5, color: '#78350F', lineHeight: 1.5,
          }}
        >
          <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' style={{ flexShrink: 0, marginTop: 1 }}>
            <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
            <line x1='12' y1='9' x2='12' y2='13' />
            <line x1='12' y1='17' x2='12.01' y2='17' />
          </svg>
          <span>
            Cannot reschedule — the scheduled session is about to start in{' '}
            <strong>{formatTimeRemaining(msUntilStart)}</strong>.
          </span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--sp-border, #D1E5DF)' }}>
        <button
          className='cl-btn-outline'
          onClick={() => onReschedule(appointmentId)}
          disabled={rescheduleBlocked}
          title={rescheduleBlocked ? 'Session starts in under 4 hours — rescheduling is disabled.' : undefined}
          style={{
            fontSize: 13,
            opacity: rescheduleBlocked ? 0.5 : 1,
            cursor: rescheduleBlocked ? 'not-allowed' : 'pointer',
          }}
        >
          <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <polyline points='23 4 23 10 17 10' />
            <path d='M20.49 15a9 9 0 1 1-2.12-9.36L23 10' />
          </svg>
          Reschedule
        </button>
      </div>
    </div>
  )
}

export default UpcomingSessionCard
