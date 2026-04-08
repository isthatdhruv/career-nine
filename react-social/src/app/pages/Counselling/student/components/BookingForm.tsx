import React from 'react'
import '../../Counselling.css'

interface Slot {
  slotId: number
  date: string
  startTime: string
  endTime: string
  durationMinutes: number
  counsellorName?: string
}

interface BookingFormProps {
  selectedSlot: Slot
  reason: string
  onReasonChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
  loading: boolean
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

const BookingForm: React.FC<BookingFormProps> = ({
  selectedSlot,
  reason,
  onReasonChange,
  onSubmit,
  onCancel,
  loading,
}) => {
  return (
    <div className='cl-card' style={{ marginTop: 24 }}>
      <h3
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--sp-text, #1A2B28)',
          marginBottom: 16,
          marginTop: 0,
        }}
      >
        Confirm Booking
      </h3>

      {/* Slot summary */}
      <div
        className='cl-remarks-box'
        style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='var(--sp-primary, #0C6B5A)' strokeWidth='2'>
            <rect x='3' y='4' width='18' height='18' rx='2' ry='2' />
            <line x1='16' y1='2' x2='16' y2='6' />
            <line x1='8' y1='2' x2='8' y2='6' />
            <line x1='3' y1='10' x2='21' y2='10' />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sp-text, #1A2B28)' }}>
            {formatDate(selectedSlot.date)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='var(--sp-primary, #0C6B5A)' strokeWidth='2'>
            <circle cx='12' cy='12' r='10' />
            <polyline points='12 6 12 12 16 14' />
          </svg>
          <span style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)' }}>
            {formatTime(selectedSlot.startTime)} – {formatTime(selectedSlot.endTime)}
            {selectedSlot.durationMinutes > 0 && (
              <span style={{ marginLeft: 6, fontSize: 12 }}>({selectedSlot.durationMinutes} min)</span>
            )}
          </span>
        </div>
        {selectedSlot.counsellorName && (
          <div style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)' }}>
            <span style={{ fontWeight: 500 }}>Counsellor: </span>
            {selectedSlot.counsellorName}
          </div>
        )}
      </div>

      {/* Reason textarea */}
      <div style={{ marginBottom: 20 }}>
        <label
          htmlFor='booking-reason'
          style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--sp-text, #1A2B28)',
            marginBottom: 6,
          }}
        >
          Reason for Counselling <span style={{ color: 'var(--sp-danger, #EF4444)' }}>*</span>
        </label>
        <textarea
          id='booking-reason'
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder='Briefly describe what you would like to discuss...'
          rows={4}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 13,
            border: '1.5px solid var(--sp-border, #D1E5DF)',
            borderRadius: 8,
            resize: 'vertical',
            outline: 'none',
            color: 'var(--sp-text, #1A2B28)',
            background: 'var(--sp-bg, #F2F7F5)',
            fontFamily: 'inherit',
            lineHeight: 1.5,
            boxSizing: 'border-box',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--sp-primary, #0C6B5A)'
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--sp-border, #D1E5DF)'
          }}
          disabled={loading}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button
          className='cl-btn-outline'
          onClick={onCancel}
          disabled={loading}
          style={{ fontSize: 13 }}
        >
          Cancel
        </button>
        <button
          className='cl-btn-primary'
          onClick={onSubmit}
          disabled={loading || !reason.trim()}
          style={{ fontSize: 13 }}
        >
          {loading ? (
            'Booking...'
          ) : (
            <>
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                <path d='M20 6L9 17l-5-5' />
              </svg>
              Book Slot
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default BookingForm
