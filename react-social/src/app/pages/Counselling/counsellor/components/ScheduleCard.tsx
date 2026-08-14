import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StatusBadge from '../../shared/StatusBadge'
import SessionReportLink from '../../shared/SessionReportLink'
import '../../Counselling.css'

/**
 * How early the counsellor's time-based actions unlock, across the whole portal.
 *
 * <p>Join was previously always live, so a counsellor could open the meeting room days ahead
 * of the session. Fifteen minutes is enough to be set up before the student arrives without
 * the link being permanently open.
 */
const OPENS_BEFORE_MS = 15 * 60 * 1000

/** Milliseconds until the session starts; Infinity when it has no usable date+time. */
function msUntilStart(appointment: any, now: number): number {
  const date = appointment?.slot?.date || appointment?.date
  const time = appointment?.slot?.startTime || appointment?.startTime
  if (!date || !time) return Infinity
  const d = new Date(`${date}T${String(time).slice(0, 8)}`)
  return isNaN(d.getTime()) ? Infinity : d.getTime() - now
}

function formatWait(ms: number): string {
  const mins = Math.max(1, Math.ceil(ms / 60000))
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'}`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return `${hrs}h${rem ? ` ${rem}m` : ''}`
}

interface ScheduleCardProps {
  appointment: any
  /** The student's assessment report; null while it is still being generated. */
  reportLink?: string | null
  onConfirm?: (id: number) => void
  onDecline?: (id: number) => void
  onCancel?: (id: number) => void
  onAddNotes?: (id: number) => void
}

const ScheduleCard: React.FC<ScheduleCardProps> = ({
  appointment,
  reportLink,
  onConfirm,
  onDecline,
  onCancel,
  onAddNotes,
}) => {
  const navigate = useNavigate()
  const { id, status, slot, student, reason, meetingLink } = appointment

  // Ticks so Join unlocks on its own as the session approaches, without a reload.
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const untilStart = msUntilStart(appointment, now)
  const joinOpen = untilStart <= OPENS_BEFORE_MS

  const startTime = slot?.startTime || appointment.startTime || ''
  const endTime = slot?.endTime || appointment.endTime || ''
  const studentName =
    student?.name ||
    student?.studentName ||
    appointment.studentName ||
    'Unknown Student'

  const isConfirmed = status === 'CONFIRMED'
  const isAssigned = status === 'ASSIGNED'
  const isCompleted = status === 'COMPLETED'
  const needsNotes = isCompleted && !appointment.sessionNotes

  const cardClass = `cl-card ${isConfirmed ? 'cl-card-accent' : needsNotes ? 'cl-card-warning' : ''}`

  const handleAddNotes = () => {
    if (onAddNotes) {
      onAddNotes(id)
    } else {
      navigate(`/counsellor/session-notes/${id}`)
    }
  }

  return (
    <div className={cardClass} style={{ marginBottom: 12 }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <StatusBadge status={status} />
        <span style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)', fontWeight: 500 }}>
          {startTime} {endTime ? `– ${endTime}` : ''}
        </span>
      </div>

      {/* Student and reason */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--sp-text, #1A2B28)', marginBottom: 2 }}>
          {studentName}
        </div>
        {reason && (
          <div style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)', lineHeight: 1.4 }}>
            {reason}
          </div>
        )}
      </div>

      {/* Action buttons. The report sits first: it is what the session is about, and the
          counsellor wants it before deciding to join, reschedule or anything else. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SessionReportLink link={reportLink} />
        {isConfirmed && (
          <>
            {meetingLink && (
              <a
                href={joinOpen ? meetingLink : undefined}
                target='_blank'
                rel='noopener noreferrer'
                className='cl-btn-blue'
                aria-disabled={!joinOpen}
                title={joinOpen
                  ? undefined
                  : `Opens 15 minutes before the session — ${formatWait(untilStart - OPENS_BEFORE_MS)} to go.`}
                onClick={(e) => { if (!joinOpen) e.preventDefault() }}
                style={{
                  textDecoration: 'none',
                  opacity: joinOpen ? 1 : 0.45,
                  cursor: joinOpen ? 'pointer' : 'not-allowed',
                }}
              >
                <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.361a1 1 0 0 1-1.447.894L15 14' />
                  <rect x='3' y='6' width='12' height='12' rx='2' />
                </svg>
                Join Meet
              </a>
            )}
            <button
              className='cl-btn-warning'
              onClick={() => navigate(`/counsellor/reschedule/${id}`)}
            >
              Reschedule
            </button>
            <button
              className='cl-btn-danger'
              onClick={() => onCancel && onCancel(id)}
            >
              Cancel
            </button>
          </>
        )}

        {isAssigned && (
          <>
            <button
              className='cl-btn-primary'
              onClick={() => onConfirm && onConfirm(id)}
            >
              Confirm
            </button>
            <button
              className='cl-btn-danger'
              onClick={() => onDecline && onDecline(id)}
            >
              Decline
            </button>
          </>
        )}

        {needsNotes && (
          <button className='cl-btn-warning' onClick={handleAddNotes}>
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
              <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
            </svg>
            Add Notes
          </button>
        )}
      </div>
    </div>
  )
}

export default ScheduleCard
