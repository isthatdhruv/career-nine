import React from 'react'
import { useNavigate } from 'react-router-dom'
import StatusBadge from '../../shared/StatusBadge'
import '../../Counselling.css'

interface ScheduleCardProps {
  appointment: any
  onConfirm?: (id: number) => void
  onDecline?: (id: number) => void
  onCancel?: (id: number) => void
  onAddNotes?: (id: number) => void
}

const ScheduleCard: React.FC<ScheduleCardProps> = ({
  appointment,
  onConfirm,
  onDecline,
  onCancel,
  onAddNotes,
}) => {
  const navigate = useNavigate()
  const { id, status, slot, student, reason, meetingLink } = appointment

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

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {isConfirmed && (
          <>
            {meetingLink && (
              <a
                href={meetingLink}
                target='_blank'
                rel='noopener noreferrer'
                className='cl-btn-blue'
                style={{ textDecoration: 'none' }}
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
