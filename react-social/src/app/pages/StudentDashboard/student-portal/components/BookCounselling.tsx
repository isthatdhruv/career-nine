import React from 'react'
import { useNavigate } from 'react-router-dom'

interface BookCounsellingProps {
  cciLevel: 'HIGH' | 'MEDIUM' | 'LOW'
}

const cciMessages: Record<string, string> = {
  HIGH: 'Your Career Clarity Index is HIGH, but a one-on-one session with your school counsellor can help you explore your top matches more deeply, compare college options, and create a concrete action plan.',
  MEDIUM: 'Your Career Clarity Index is MODERATE. A counselling session can help sharpen your direction, explore options you may not have considered, and build a focused plan.',
  LOW: 'Your Career Clarity Index needs attention. A counselling session is strongly recommended to help you discover your strengths, explore career paths, and build confidence in your direction.',
}

const dummySlots = [
  { day: 'Mon 13 Jan', time: '10:00 AM' },
  { day: 'Tue 14 Jan', time: '11:30 AM' },
  { day: 'Thu 16 Jan', time: '3:00 PM' },
]

const BookCounselling: React.FC<BookCounsellingProps> = ({ cciLevel }) => {
  const navigate = useNavigate()
  return (
    <div className='sp-card'>
      <div className='sp-card-title'>Book a Counselling Session</div>

      <div className='sp-counselling-msg'>{cciMessages[cciLevel]}</div>

      <div className='sp-slot-list'>
        <div
          style={{
            padding: '8px 14px',
            background: '#FAFCFB',
            borderBottom: '1px solid var(--sp-border)',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--sp-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
          }}
        >
          Next Available Slots
        </div>
        {dummySlots.map((slot, i) => (
          <div className='sp-slot-item' key={i}>
            <span className='sp-slot-time'>
              {slot.day} &middot; {slot.time}
            </span>
            <button
              className='btn btn-sm btn-light-primary'
              style={{ fontSize: '11px', padding: '4px 12px' }}
              onClick={() => navigate('/student/counselling/book')}
            >
              Select
            </button>
          </div>
        ))}
      </div>

      <button
        className='sp-report-btn sp-report-btn-primary'
        onClick={() => navigate('/student/counselling')}
      >
        Request Appointment
      </button>
    </div>
  )
}

export default BookCounselling
