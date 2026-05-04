import React, { useEffect, useState } from 'react'
import { createRating, PendingRatingAppointment } from '../../API/RatingAPI'

interface Props {
  appointment: PendingRatingAppointment
  onSubmitted: () => void
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return ''
  try {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
  } catch {
    return timeStr
  }
}

const Star: React.FC<{ filled: boolean; hovered: boolean; onClick: () => void; onEnter: () => void; onLeave: () => void }> = ({ filled, hovered, onClick, onEnter, onLeave }) => (
  <button
    type='button'
    onClick={onClick}
    onMouseEnter={onEnter}
    onMouseLeave={onLeave}
    style={{
      background: 'transparent',
      border: 'none',
      padding: 4,
      cursor: 'pointer',
      lineHeight: 0,
    }}
    aria-label={filled ? 'star filled' : 'star empty'}
  >
    <svg width='34' height='34' viewBox='0 0 24 24' fill={filled || hovered ? '#F59E0B' : 'none'} stroke={filled || hovered ? '#F59E0B' : '#94A3B8'} strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' />
    </svg>
  </button>
)

const RATING_LABELS: Record<number, string> = {
  1: 'Very poor',
  2: 'Poor',
  3: 'Okay',
  4: 'Good',
  5: 'Excellent',
}

const SessionRatingModal: React.FC<Props> = ({ appointment, onSubmitted }) => {
  const [rating, setRating] = useState<number>(0)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [review, setReview] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  const handleSubmit = () => {
    if (rating < 1) {
      setError('Please select a rating from 1 to 5 stars.')
      return
    }
    setSubmitting(true)
    setError(null)
    createRating(appointment.id, rating, review.trim())
      .then(() => onSubmitted())
      .catch((err) => {
        const msg = err?.response?.data || 'Could not submit your rating. Please try again.'
        setError(typeof msg === 'string' ? msg : 'Could not submit your rating. Please try again.')
        setSubmitting(false)
      })
  }

  const displayRating = hoverRating || rating
  const counsellorName = appointment.counsellor?.name || 'your counsellor'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      role='dialog'
      aria-modal='true'
      aria-labelledby='rating-modal-title'
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          width: '100%',
          maxWidth: 460,
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 22px 14px',
            borderBottom: '1px solid #E2E8F0',
            background: 'linear-gradient(135deg, #0C6B5A 0%, #0EA5A3 100%)',
            color: '#fff',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 6 }}>
            Session Feedback Required
          </div>
          <h2 id='rating-modal-title' style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            How was your session with {counsellorName}?
          </h2>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>
            {formatDate(appointment.slot?.date)}
            {appointment.slot?.startTime && ` · ${formatTime(appointment.slot.startTime)} – ${formatTime(appointment.slot.endTime)}`}
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 18 }}>
            Your feedback helps us improve the counselling experience.
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginBottom: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                filled={rating >= n}
                hovered={hoverRating >= n}
                onClick={() => { setRating(n); setError(null) }}
                onEnter={() => setHoverRating(n)}
                onLeave={() => setHoverRating(0)}
              />
            ))}
          </div>
          <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: displayRating ? '#0C6B5A' : '#94A3B8', minHeight: 20, marginBottom: 16 }}>
            {displayRating ? RATING_LABELS[displayRating] : 'Tap a star to rate'}
          </div>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 6 }}>
            Write a review (optional)
          </label>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder='Share what went well or what could be better...'
            rows={4}
            maxLength={1000}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 13,
              border: '1px solid #CBD5E1',
              borderRadius: 8,
              resize: 'vertical',
              fontFamily: 'inherit',
              color: '#1E293B',
              outline: 'none',
            }}
          />
          <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'right', marginTop: 4 }}>
            {review.length}/1000
          </div>

          {error && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#FEE2E2', color: '#991B1B', fontSize: 12, borderRadius: 8 }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px 20px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          <button
            onClick={handleSubmit}
            disabled={submitting || rating < 1}
            style={{
              width: '100%',
              padding: '11px 16px',
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              background: rating < 1 || submitting ? '#94A3B8' : '#0C6B5A',
              border: 'none',
              borderRadius: 8,
              cursor: rating < 1 || submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Rating'}
          </button>
          <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 10 }}>
            Rating is required to continue using counselling features.
          </div>
        </div>
      </div>
    </div>
  )
}

export default SessionRatingModal
