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
  /** She still has a free change left, so the missed session can be rescheduled. */
  canReschedule?: boolean
  onReschedule?: (appointmentId: number) => void
  /**
   * Where to send her once the allowance is gone. Rescheduling is what a free change buys;
   * with none left the session cannot be moved, and a new booking is the only way forward —
   * so the card offers that rather than nothing at all.
   */
  onBookSession?: () => void
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
 * What happened to this session, in one line.
 *
 * <p>A coloured badge alone does not say whether she cancelled or it was cancelled on her,
 * and those are entirely different facts: one costs her a free change, the other costs her
 * nothing. The card has the attribution, so it should say it — but in a few words. Whole
 * sentences of explanation on every row turned the history into a wall of text.
 */
function resolveOutcome(a: Appointment): Outcome | null {
  const status = (a.status || '').toUpperCase()
  const cancelledBy = (a.cancelledByRole || '').toUpperCase()
  const missedBy = (a.missedByRole || '').toUpperCase()

  const COST: Omit<Outcome, 'text'> = { bg: '#FEF2F2', border: '#FECACA', color: '#991B1B' }
  const HER_CHOICE: Omit<Outcome, 'text'> = { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E' }
  const FREE: Omit<Outcome, 'text'> = { bg: '#F1F5F9', border: '#CBD5E1', color: '#334155' }
  const MOVED: Omit<Outcome, 'text'> = { bg: '#EFF6FF', border: '#BFDBFE', color: '#1E3A8A' }

  if (status === 'CANCELLED') {
    if (cancelledBy === 'STUDENT') return { text: 'You cancelled. Used 1 free change.', ...HER_CHOICE }
    if (cancelledBy === 'COUNSELLOR') return { text: 'Cancelled by your counsellor. Not counted against you.', ...FREE }
    return { text: 'Cancelled by Career-9. Not counted against you.', ...FREE }
  }

  if (status === 'MISSED') {
    if (missedBy === 'COUNSELLOR') return { text: 'Session could not start. Not counted against you.', ...FREE }
    return { text: 'You did not attend. Used 1 free change.', ...COST }
  }

  // A moved session keeps BOTH halves of its story: why it ended, and that it was replaced.
  // Reporting only the move erased the part that cost her something — a session she failed
  // to attend read as a neutral "moved to a new time", so the history showed nothing she had
  // done wrong while her allowance was quietly being spent.
  if (status === 'RESCHEDULED') {
    if (missedBy === 'STUDENT') return { text: 'You did not attend, then moved. Used 1 free change.', ...COST }
    if (missedBy === 'COUNSELLOR') return { text: 'Counsellor unavailable, so moved. Not counted against you.', ...MOVED }
    if (cancelledBy === 'STUDENT') return { text: 'You cancelled and moved it. Used 1 free change.', ...HER_CHOICE }
    if (cancelledBy === 'COUNSELLOR') return { text: 'Counsellor cancelled, so moved. Not counted against you.', ...MOVED }
    return { text: 'Moved to a new time.', ...MOVED }
  }

  return null
}

const PastSessionCard: React.FC<PastSessionCardProps> = ({
  appointment,
  canReschedule,
  onReschedule,
  onBookSession,
}) => {
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

      {/* A missed session is rescheduled rather than left as a dead end: this opens the same
          slot picker rescheduling uses, already limited to the counsellors mapped to her
          assessment, so she lands on this counsellor's next free slots. Hidden once her free
          changes are used up — booking then is chargeable, which is an administrator's call. */}
      {missedByStudent && canReschedule && onReschedule && (
        <div style={{ paddingTop: 10, borderTop: '1px solid var(--sp-border, #D1E5DF)' }}>
          <button
            className='cl-btn-primary'
            onClick={() => onReschedule(appointmentId)}
            style={{ fontSize: 13 }}
          >
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <polyline points='23 4 23 10 17 10' />
              <path d='M20.49 15a9 9 0 1 1-2.12-9.36L23 10' />
            </svg>
            Reschedule
          </button>
        </div>
      )}

      {/* Allowance spent. Rescheduling IS the free change, so it is gone — but leaving the
          card with no route at all read as "this is over, and there is nothing you can do",
          which is not true: she can still book. Say why the button went, then offer the
          thing that is still open to her. */}
      {missedByStudent && !canReschedule && (
        <div style={{ paddingTop: 10, borderTop: '1px solid var(--sp-border, #D1E5DF)' }}>
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: '#991B1B', marginBottom: onBookSession ? 10 : 0 }}>
            No free changes left — this cannot be moved.
          </div>
          {onBookSession && (
            <button className='cl-btn-primary' onClick={onBookSession} style={{ fontSize: 13 }}>
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                <line x1='12' y1='5' x2='12' y2='19' />
                <line x1='5' y1='12' x2='19' y2='12' />
              </svg>
              Book a Session
            </button>
          )}
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
