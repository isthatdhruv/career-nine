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
}

interface SessionNotes {
  keyDiscussionPoints?: string
  actionItems?: string
  recommendedNextSession?: string
  publicRemarks?: string
}

interface PastSessionCardProps {
  appointment: Appointment
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

const PastSessionCard: React.FC<PastSessionCardProps> = ({ appointment }) => {
  const { appointmentId, slot, counsellorName, reason } = appointment
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
        <StatusBadge status='COMPLETED' />
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

      {/* Toggle Remarks */}
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
    </div>
  )
}

export default PastSessionCard
