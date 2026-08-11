import React, { useState } from 'react'
import StatusBadge from '../../shared/StatusBadge'
import { getSessionNotes } from '../../API/SessionNotesAPI'
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
  slot: Slot
  counsellorName?: string
  cancelledByRole?: string | null
  cancellationReason?: string | null
  cancellationNote?: string | null
  missedByRole?: string | null
}

interface SessionNotes {
  keyDiscussionPoints?: string
  actionItems?: string
  recommendedNextSession?: string
  publicRemarks?: string
}

interface PastSessionCardProps {
  appointment: Appointment
  /** She still has a free change left, so a replacement session can be booked. */
  canBookAgain?: boolean
  onBookAgain?: () => void
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
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

type Outcome = { text: string; bg: string; border: string; color: string }

/**
 * What actually happened to this session, in her words.
 *
 * <p>Without this the history is a list of dates with a coloured badge — "Cancelled" does not
 * say whether she cancelled or it was cancelled on her, and those are entirely different
 * facts: one costs her a free change, the other costs her nothing. The card has the
 * attribution, so it should say it.
 */
function resolveOutcome(a: Appointment): Outcome | null {
  const status = (a.status || '').toUpperCase()
  const cancelledBy = (a.cancelledByRole || '').toUpperCase()
  const missedBy = (a.missedByRole || '').toUpperCase()

  if (status === 'CANCELLED') {
    if (cancelledBy === 'STUDENT') {
      return {
        text: 'You cancelled this session. It counted as one of your free changes.',
        bg: '#FFFBEB', border: '#FDE68A', color: '#92400E',
      }
    }
    if (cancelledBy === 'COUNSELLOR') {
      return {
        text: 'Your counsellor cancelled this session. It did not count against you.',
        bg: '#F1F5F9', border: '#CBD5E1', color: '#334155',
      }
    }
    return {
      text: 'This session was cancelled by the Career-9 team. It did not count against you.',
      bg: '#F1F5F9', border: '#CBD5E1', color: '#334155',
    }
  }

  if (status === 'MISSED') {
    if (missedBy === 'COUNSELLOR') {
      return {
        text: 'Nobody was able to start this session. It did not count against you.',
        bg: '#F1F5F9', border: '#CBD5E1', color: '#334155',
      }
    }
    return {
      text: 'You did not attend this session. It counted as one of your free changes.',
      bg: '#FEF2F2', border: '#FECACA', color: '#991B1B',
    }
  }

  if (status === 'RESCHEDULED') {
    return missedBy === 'COUNSELLOR'
      ? {
          text: 'Your counsellor was unavailable, so this session was moved to a new time. It did not count against you.',
          bg: '#EFF6FF', border: '#BFDBFE', color: '#1E3A8A',
        }
      : {
          text: 'This session was moved to a new time.',
          bg: '#EFF6FF', border: '#BFDBFE', color: '#1E3A8A',
        }
  }

  return null
}

const PastSessionCard: React.FC<PastSessionCardProps> = ({ appointment, canBookAgain, onBookAgain }) => {
  const { appointmentId, slot, counsellorName, reason, status } = appointment
  const outcome = resolveOutcome(appointment)
  // Notes only exist for a sitting that actually happened; offering "View Remarks" on a
  // cancelled one just leads to an empty box.
  const sessionHappened = ['COMPLETED', 'ENDED'].includes((status || '').toUpperCase())
  // Her own no-show — not one the counsellor caused, which costs her nothing and is handled
  // by the parked-session flow instead.
  const missedByStudent =
    (status || '').toUpperCase() === 'MISSED' &&
    (appointment.missedByRole || '').toUpperCase() !== 'COUNSELLOR'
  const [showRemarks, setShowRemarks] = useState(false)
  const [sessionNotes, setSessionNotes] = useState<SessionNotes | null>(null)
  const [notesLoading, setNotesLoading] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)

  const handleToggleRemarks = () => {
    if (!showRemarks && sessionNotes === null && !notesLoading) {
      setNotesLoading(true)
      setNotesError(null)
      getSessionNotes(appointmentId, true)
        .then((res) => {
          setSessionNotes(res.data || {})
        })
        .catch(() => {
          setNotesError('Could not load remarks')
          setSessionNotes({})
        })
        .finally(() => setNotesLoading(false))
    }
    setShowRemarks((prev) => !prev)
  }

  const hasAnyNote =
    sessionNotes &&
    (sessionNotes.keyDiscussionPoints ||
      sessionNotes.actionItems ||
      sessionNotes.recommendedNextSession ||
      sessionNotes.publicRemarks)

  return (
    <div className='cl-card cl-card-info' style={{ marginBottom: 16 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <StatusBadge status={status || 'COMPLETED'} />
        <span style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)' }}>
          {slot.durationMinutes > 0 && `${slot.durationMinutes} min session`}
        </span>
      </div>

      {/* Date & Time */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='var(--sp-info, #3B82F6)' strokeWidth='2'>
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
          <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='var(--sp-info, #3B82F6)' strokeWidth='2'>
            <circle cx='12' cy='12' r='10' />
            <polyline points='12 6 12 12 16 14' />
          </svg>
          <span style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)' }}>
            {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
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
          <div style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', fontWeight: 500, marginBottom: 2 }}>Topic</div>
          <div style={{ fontSize: 13, color: 'var(--sp-text, #1A2B28)', lineHeight: 1.5 }}>{reason}</div>
        </div>
      )}

      {/* What happened, and whether it cost her anything. */}
      {outcome && (
        <div
          style={{
            marginBottom: 12, padding: '10px 12px', borderRadius: 8,
            background: outcome.bg, border: `1px solid ${outcome.border}`,
            fontSize: 12.5, lineHeight: 1.5, color: outcome.color,
          }}
        >
          {outcome.text}
          {appointment.cancellationReason && (
            <div style={{ marginTop: 6 }}>
              <strong>Reason:</strong> {appointment.cancellationReason}
              {appointment.cancellationNote ? ` — ${appointment.cancellationNote}` : ''}
            </div>
          )}
        </div>
      )}

      {/* A session she missed is closed and cannot be moved — but her seat comes back while
          a free change remains, so offer the one route forward rather than leaving the card
          as a dead end. Hidden once the allowance is used up: booking then is chargeable and
          that is a conversation for an administrator. */}
      {missedByStudent && canBookAgain && onBookAgain && (
        <div style={{ paddingTop: 10, borderTop: '1px solid var(--sp-border, #D1E5DF)' }}>
          <button className='cl-btn-primary' onClick={onBookAgain} style={{ fontSize: 13 }}>
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <rect x='3' y='4' width='18' height='18' rx='2' ry='2' />
              <line x1='16' y1='2' x2='16' y2='6' />
              <line x1='8' y1='2' x2='8' y2='6' />
              <line x1='3' y1='10' x2='21' y2='10' />
            </svg>
            Book another session
          </button>
        </div>
      )}

      {/* Toggle Remarks */}
      {sessionHappened && (
      <div style={{ paddingTop: 10, borderTop: '1px solid var(--sp-border, #D1E5DF)' }}>
        <button
          className='cl-btn-outline'
          onClick={handleToggleRemarks}
          style={{ fontSize: 13 }}
        >
          {notesLoading ? (
            'Loading...'
          ) : showRemarks ? (
            <>
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                <polyline points='18 15 12 9 6 15' />
              </svg>
              Hide Remarks
            </>
          ) : (
            <>
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                <polyline points='6 9 12 15 18 9' />
              </svg>
              View Remarks
            </>
          )}
        </button>

        {showRemarks && !notesLoading && (
          <div style={{ marginTop: 14 }}>
            {notesError ? (
              <div className='cl-remarks-box empty'>{notesError}</div>
            ) : !hasAnyNote ? (
              <div className='cl-remarks-box empty'>No remarks have been added yet for this session.</div>
            ) : (
              <div className='cl-remarks-box'>
                {sessionNotes?.keyDiscussionPoints && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sp-primary, #0C6B5A)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Key Discussion Points
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>{sessionNotes.keyDiscussionPoints}</div>
                  </div>
                )}
                {sessionNotes?.actionItems && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sp-primary, #0C6B5A)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Action Items
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>{sessionNotes.actionItems}</div>
                  </div>
                )}
                {sessionNotes?.recommendedNextSession && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sp-primary, #0C6B5A)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Recommended Next Session
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>{sessionNotes.recommendedNextSession}</div>
                  </div>
                )}
                {sessionNotes?.publicRemarks && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sp-primary, #0C6B5A)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Remarks
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>{sessionNotes.publicRemarks}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  )
}

export default PastSessionCard
