import React, { useEffect, useState } from 'react'
import StatusBadge from '../../shared/StatusBadge'
import CountdownTimer from '../../shared/CountdownTimer'
import {
  getStudentCancellationInfo,
  studentCancelAppointment,
  disputeAttendance,
} from '../../API/AppointmentAPI'
import '../../Counselling.css'

// One cutoff for BOTH cancel and reschedule. Two different numbers would make the looser
// one a loophole for the tighter: blocked from rescheduling, she could cancel and rebook
// instead — same outcome, minus the once-only reschedule cap.
const CHANGE_CUTOFF_MS = 2 * 60 * 60 * 1000

const CANCEL_REASONS: { value: string; label: string }[] = [
  { value: 'SCHEDULE_CLASH', label: 'Schedule clash' },
  { value: 'UNWELL', label: 'Unwell' },
  { value: 'DIFFERENT_TIME', label: 'Need a different time' },
  { value: 'NO_LONGER_NEEDED', label: 'No longer need the session' },
  { value: 'OTHER', label: 'Other' },
]
/** How early the Join button appears before the session's start time. */
const JOIN_OPENS_BEFORE_MS = 10 * 60 * 1000

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
  studentRescheduleCount?: number
  forceShifted?: boolean
  shiftedFromStart?: string | null
}

interface UpcomingSessionCardProps {
  appointment: Appointment
  onReschedule: (appointmentId: number) => void
  /** Refetch the list after a cancel or dispute so the card moves tab. */
  onChanged?: () => void
}

/** "1:00 PM on 12 Aug" — the deadline, shown from booking onward rather than sprung later. */
function formatDeadline(startMs: number, cutoffMs: number): string {
  if (isNaN(startMs)) return ''
  const d = new Date(startMs - cutoffMs)
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
  const day = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return `${time} on ${day}`
}

function formatIsoTime(iso?: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch {
    return ''
  }
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

const UpcomingSessionCard: React.FC<UpcomingSessionCardProps> = ({ appointment, onReschedule, onChanged }) => {
  const {
    appointmentId, status, meetingLink, slot, counsellorName, reason,
    forceShifted, shiftedFromStart,
  } = appointment

  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(interval)
  }, [])

  const [missesRemaining, setMissesRemaining] = useState<number | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelNote, setCancelNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [disputed, setDisputed] = useState(false)

  const startMs = buildSlotDateTime(slot.date, slot.startTime)
  const endMs = buildSlotDateTime(slot.date, slot.endTime)
  // Join opens shortly before the slot and stays open until it ends: the student needs
  // to be in the meeting to read the check-in code out to the counsellor, who enters it
  // to mark the session started. Teams' lobby is what actually holds them back until
  // the counsellor admits them, so the link alone gives no early access.
  const upperStatus = (status || '').toUpperCase()
  const sessionLive = upperStatus === 'IN_PROGRESS'
  // A cancelled, declined or finished session never offers Join, whatever the clock says.
  const sessionActive = ['CONFIRMED', 'ASSIGNED', 'PENDING', 'IN_PROGRESS'].includes(upperStatus)
  const withinJoinWindow =
    !isNaN(startMs) && !isNaN(endMs) && now >= startMs - JOIN_OPENS_BEFORE_MS && now < endMs
  const canJoin = !!meetingLink && sessionActive && (sessionLive || withinJoinWindow)

  const awaitingReschedule = upperStatus === 'AWAITING_RESCHEDULE'
  const underReview = upperStatus === 'UNDER_REVIEW'
  const isMissed = upperStatus === 'MISSED'

  const msUntilStart = isNaN(startMs) ? Infinity : startMs - now
  // Two exemptions from the cutoff, both for times she did not choose:
  //
  //  - forceShifted: the counsellor moved her here. The cutoff protects the counsellor's
  //    diary from late student changes, not the other way round.
  //  - awaitingReschedule: the session is PARKED. Its old slot time is meaningless — the
  //    whole point is that she must pick a new one. Applying the cutoff here locked her out
  //    of the only action available to her, on a session she had already lost once.
  const cutoffApplies = !forceShifted && !awaitingReschedule
  const withinCutoff = msUntilStart < CHANGE_CUTOFF_MS && cutoffApplies
  // A parked session always offers its pick-a-new-time, whatever her reschedule history:
  // she is not rescheduling by choice, she is replacing a session the counsellor dropped.
  // One currency governs how often she can change a session: her free changes. Moving a
  // session to a time that suits her spends one, exactly as cancelling does — so with none
  // left, neither action is offered. A parked session is exempt from both: she is replacing
  // a session the counsellor dropped, not choosing to move one.
  const outOfChanges = missesRemaining !== null && missesRemaining <= 0 && !awaitingReschedule
  const rescheduleBlocked = withinCutoff || outOfChanges
  const cancelBlocked = withinCutoff || outOfChanges

  useEffect(() => {
    let cancelled = false
    getStudentCancellationInfo(appointmentId)
      .then((res) => { if (!cancelled) setMissesRemaining(res.data?.missesRemaining ?? null) })
      .catch(() => { /* the card still works without the count */ })
    return () => { cancelled = true }
  }, [appointmentId])

  const submitCancel = () => {
    if (!cancelReason) { setActionError('Please choose a reason.'); return }
    if (cancelReason === 'OTHER' && !cancelNote.trim()) {
      setActionError('Please tell us briefly why you are cancelling.')
      return
    }
    setSubmitting(true)
    setActionError(null)
    studentCancelAppointment(appointmentId, cancelReason, cancelNote.trim() || undefined)
      .then(() => { setCancelOpen(false); onChanged?.() })
      .catch((err) => {
        // The client gate and the server can legitimately disagree at the boundary: she can
        // open this at 2h05m and confirm at 1h58m. Surface the refusal rather than a raw
        // error, and refresh so the card reflects reality.
        const msg = err?.response?.data?.error || err?.response?.data
          || 'Could not cancel. Please try again.'
        setActionError(typeof msg === 'string' ? msg : 'Could not cancel. Please try again.')
        onChanged?.()
      })
      .finally(() => setSubmitting(false))
  }

  const submitDispute = () => {
    setSubmitting(true)
    disputeAttendance(appointmentId)
      .then(() => { setDisputed(true); onChanged?.() })
      .catch((err) => setActionError(err?.response?.data?.error || 'Could not raise this. Please try again.'))
      .finally(() => setSubmitting(false))
  }

  return (
    <div className='cl-card cl-card-accent' style={{ marginBottom: 16 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <StatusBadge status={status} />
        {/* A parked session has no start to count down to — the slot on the card is the OLD
            one the counsellor dropped, and counting down to it contradicts the badge next to
            it. The card's own "pick a new time" panel is the honest statement of where it
            stands. Same for a session already missed or under review. */}
        {!awaitingReschedule && !underReview && !isMissed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', fontWeight: 500 }}>Starts in</span>
            <CountdownTimer targetDate={slot.date} targetTime={slot.startTime} endTime={slot.endTime} />
          </div>
        )}
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

      {/* Meeting link — opens 10 minutes before the slot, or as soon as the session is live */}
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
      ) : meetingLink && sessionActive ? (
        // Only worth saying while the session is still going to happen. On a parked, missed or
        // under-review session there is nothing left to join, and promising a Join button that
        // will never appear reads as the card not knowing its own state.
        <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--sp-muted, #5C7A72)' }}>
          The Join button opens 10 minutes before your session. Once you're in, read out the
          4-digit check-in code from your report so your counsellor can begin.
        </div>
      ) : null}

      {/* Why the time changed. A silently different hour reads as a bug. */}
      {forceShifted && shiftedFromStart && (
        <div
          style={{
            marginBottom: 12, padding: '10px 12px',
            background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8,
            fontSize: 12.5, color: '#1E3A8A', lineHeight: 1.5,
          }}
        >
          This session was moved from <strong>{formatIsoTime(shiftedFromStart)}</strong> because your
          counsellor was unavailable. If the new time does not suit you, changing it will not count
          against your free changes.
        </div>
      )}

      {/* Parked: her session is safe, but it needs her to pick a time. */}
      {awaitingReschedule && (
        <div
          style={{
            marginBottom: 12, padding: '10px 12px',
            background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8,
            fontSize: 12.5, color: '#78350F', lineHeight: 1.5,
          }}
        >
          <strong>Awaiting your new time.</strong> Your counsellor is no longer available, so this
          session is on hold — your session has not been lost. Pick a new slot whenever suits you;
          it costs you nothing. If you no longer need this session, contact your administrator.
        </div>
      )}

      {/* Disputed absent mark: nothing counts against her while it is open. */}
      {underReview && (
        <div
          style={{
            marginBottom: 12, padding: '10px 12px',
            background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 8,
            fontSize: 12.5, color: '#334155', lineHeight: 1.5,
          }}
        >
          <strong>Under review.</strong> We are checking what happened with this session. Nothing
          counts against you until it is settled.
        </div>
      )}

      {/* The deadline, visible from booking onward so the greyed button is never a surprise. */}
      {!awaitingReschedule && !underReview && !isNaN(startMs) && !forceShifted && (
        <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--sp-muted, #5C7A72)' }}>
          You can cancel or reschedule until{' '}
          <strong>{formatDeadline(startMs, CHANGE_CUTOFF_MS)}</strong>.
          {missesRemaining !== null && (
            <>
              {' '}
              {missesRemaining > 0
                ? `${missesRemaining} free change${missesRemaining === 1 ? '' : 's'} remaining.`
                : 'No free changes remaining — a new session would need to be paid for.'}
            </>
          )}
        </div>
      )}

      {actionError && (
        <div role='alert' style={{ marginBottom: 12, fontSize: 12.5, color: '#B91C1C' }}>
          {actionError}
        </div>
      )}

      {/* Cutoff warning — the control stays visible and disabled, not hidden. A button that
          disappears reads as a bug, and she calls anyway. */}
      {withinCutoff && (
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
            Changes closed — sessions cannot be cancelled or rescheduled within 2 hours of the
            start time. This one begins in <strong>{formatTimeRemaining(msUntilStart)}</strong>.
            Please contact support if you cannot attend.
          </span>
        </div>
      )}

      {/* No free changes left — cancelling and rescheduling both spend one, so neither is
          offered until an administrator steps in. */}
      {!withinCutoff && outOfChanges && (
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
            <circle cx='12' cy='12' r='10' />
            <line x1='12' y1='8' x2='12' y2='12' />
            <line x1='12' y1='16' x2='12.01' y2='16' />
          </svg>
          <span>
            You have no free changes left, so this session cannot be cancelled or moved. Please attend it, or contact your administrator.
          </span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 10, borderTop: '1px solid var(--sp-border, #D1E5DF)' }}>
        {isMissed && !underReview && !disputed && (
          <button
            className='cl-btn-outline'
            onClick={submitDispute}
            disabled={submitting}
            style={{ fontSize: 13 }}
            title='If you attended this session, tell us and we will review it.'
          >
            I was there
          </button>
        )}

        {/* A parked session offers no Cancel: the counsellor dropped out and nothing was
            given in return, so there is no booking to call off — only a new time to pick.
            Her paid session stays attached to it until she does. */}
        {!isMissed && !underReview && !awaitingReschedule && (
          <button
            className='cl-btn-outline'
            onClick={() => { setActionError(null); setCancelOpen(true) }}
            disabled={cancelBlocked}
            title={
              withinCutoff
                ? 'Session starts in under 2 hours — cancelling is disabled.'
                : outOfChanges
                  ? 'No free changes left. Please attend this session or contact your administrator.'
                  : undefined
            }
            style={{
              fontSize: 13,
              opacity: cancelBlocked ? 0.5 : 1,
              cursor: cancelBlocked ? 'not-allowed' : 'pointer',
            }}
          >
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <circle cx='12' cy='12' r='10' />
              <line x1='15' y1='9' x2='9' y2='15' />
              <line x1='9' y1='9' x2='15' y2='15' />
            </svg>
            Cancel
          </button>
        )}

        {!isMissed && !underReview && (
          <button
            className='cl-btn-outline'
            onClick={() => onReschedule(appointmentId)}
            disabled={rescheduleBlocked}
            title={
              withinCutoff
                ? 'Session starts in under 2 hours — rescheduling is disabled.'
                : outOfChanges
                  ? 'No free changes left. Please attend this session or contact your administrator.'
                  : awaitingReschedule
                    ? undefined
                    : 'Choosing your own time uses one of your free changes.'
            }
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
            {awaitingReschedule ? 'Pick a new time' : 'Reschedule'}
          </button>
        )}
      </div>

      {/* Confirm modal. Shows what is about to be cancelled and what it costs — the warning
          confirms something already on the card rather than springing it at the last moment. */}
      {cancelOpen && (
        <div
          role='dialog'
          aria-modal='true'
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
          }}
          onClick={() => !submitting && setCancelOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12, padding: 22, maxWidth: 460, width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#1A2B28' }}>
              Cancel this session?
            </h3>
            <p style={{ fontSize: 13.5, color: '#475569', marginTop: 8, marginBottom: 14, lineHeight: 1.5 }}>
              {formatDate(slot.date)} at {formatTime(slot.startTime)}
              {counsellorName ? ` with ${counsellorName}` : ''}.
            </p>

            {missesRemaining !== null && (
              <div
                style={{
                  marginBottom: 14, padding: '10px 12px', borderRadius: 8,
                  background: missesRemaining > 1 ? '#F0FDF4' : '#FEF3C7',
                  border: `1px solid ${missesRemaining > 1 ? '#BBF7D0' : '#FCD34D'}`,
                  fontSize: 12.5, color: missesRemaining > 1 ? '#166534' : '#78350F', lineHeight: 1.5,
                }}
              >
                {forceShifted
                  ? 'Your counsellor moved this session, so cancelling it will not count against your free changes.'
                  : missesRemaining > 1
                    ? `You have ${missesRemaining} free changes remaining.`
                    : missesRemaining === 1
                      ? 'This is your last free change. If you cancel again you will need to pay for a new session.'
                      : 'You have no free changes left — a new session will need to be paid for.'}
              </div>
            )}

            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              Why are you cancelling?
            </label>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              style={{
                width: '100%', padding: '9px 10px', fontSize: 13, borderRadius: 8,
                border: '1px solid #CBD5E1', marginBottom: 10,
              }}
            >
              <option value=''>Select a reason…</option>
              {CANCEL_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            {cancelReason === 'OTHER' && (
              <textarea
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                placeholder='Tell us briefly what happened'
                rows={3}
                style={{
                  width: '100%', padding: '9px 10px', fontSize: 13, borderRadius: 8,
                  border: '1px solid #CBD5E1', marginBottom: 10, resize: 'vertical',
                }}
              />
            )}

            {actionError && (
              <div role='alert' style={{ fontSize: 12.5, color: '#B91C1C', marginBottom: 10 }}>
                {actionError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                className='cl-btn-outline'
                onClick={() => setCancelOpen(false)}
                disabled={submitting}
                style={{ fontSize: 13 }}
              >
                Keep my session
              </button>
              <button
                className='cl-btn-primary'
                onClick={submitCancel}
                disabled={submitting}
                style={{ fontSize: 13 }}
              >
                {submitting ? 'Cancelling…' : 'Cancel session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UpcomingSessionCard
