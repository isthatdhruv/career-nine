import React from 'react'
import StatusBadge from '../../shared/StatusBadge'
import CountdownTimer from '../../shared/CountdownTimer'
import '../../Counselling.css'

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
  onCancel: (appointmentId: number) => void
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

const UpcomingSessionCard: React.FC<UpcomingSessionCardProps> = ({ appointment, onCancel }) => {
  const { appointmentId, status, meetingLink, slot, counsellorName, reason } = appointment

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

      {/* Meeting Link */}
      {meetingLink && (
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
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--sp-border, #D1E5DF)' }}>
        <button
          className='cl-btn-danger'
          onClick={() => onCancel(appointmentId)}
          style={{ fontSize: 13 }}
        >
          <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <line x1='18' y1='6' x2='6' y2='18' />
            <line x1='6' y1='6' x2='18' y2='18' />
          </svg>
          Cancel Session
        </button>
      </div>
    </div>
  )
}

export default UpcomingSessionCard
