import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStudentEligibility, EligibilityResponse } from '../../../Counselling/API/EligibilityAPI'
import { useRefreshInterval } from '../../../../utils/useAutoRefresh'

interface BookCounsellingProps {
  cciLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  userStudentId: number
}

const cciMessages: Record<string, string> = {
  HIGH: 'Your Career Clarity Index is HIGH, but a one-on-one session with your school counsellor can help you explore your top matches more deeply, compare college options, and create a concrete action plan.',
  MEDIUM: 'Your Career Clarity Index is MODERATE. A counselling session can help sharpen your direction, explore options you may not have considered, and build a focused plan.',
  LOW: 'Your Career Clarity Index needs attention. A counselling session is strongly recommended to help you discover your strengths, explore career paths, and build confidence in your direction.',
}

const BookCounselling: React.FC<BookCounsellingProps> = ({ cciLevel, userStudentId }) => {
  const navigate = useNavigate()
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userStudentId) {
      setLoading(false)
      return
    }
    getStudentEligibility(userStudentId)
      .then((res) => setEligibility(res.data))
      .catch(() => setEligibility(null))
      .finally(() => setLoading(false))
  }, [userStudentId])

  useRefreshInterval(() => {
    if (!userStudentId) return
    getStudentEligibility(userStudentId)
      .then((res) => setEligibility(res.data))
      .catch(() => {})
  }, { skip: !userStudentId })

  if (loading) {
    return (
      <div className='sp-card'>
        <div className='sp-card-title'>Counselling</div>
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--sp-muted)' }}>
          Loading...
        </div>
      </div>
    )
  }

  // ── NO_ASSESSMENT: Student hasn't completed any assessment ──
  if (!eligibility || eligibility.track === 'NO_ASSESSMENT') {
    return (
      <div className='sp-card'>
        <div className='sp-card-title'>Counselling</div>
        <div style={{ padding: '16px 0' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              background: '#FFF8E1',
              borderRadius: '10px',
              border: '1px solid #FFE082',
            }}
          >
            <span style={{ fontSize: '28px' }}>&#128221;</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#E65100' }}>
                Assessment Required
              </div>
              <div style={{ fontSize: '12px', color: '#795548', marginTop: '4px' }}>
                Complete an assessment first to unlock counselling sessions and personalised career guidance.
              </div>
            </div>
          </div>
        </div>
        <button
          className='sp-report-btn sp-report-btn-primary'
          onClick={() => navigate('/student/assessments')}
        >
          Take Assessment
        </button>
      </div>
    )
  }

  // ── REPORT_PENDING: Assessment done, report still generating ──
  if (eligibility.track === 'REPORT_PENDING') {
    return (
      <div className='sp-card'>
        <div className='sp-card-title'>Counselling</div>
        <div style={{ padding: '16px 0' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              background: '#E3F2FD',
              borderRadius: '10px',
              border: '1px solid #90CAF9',
            }}
          >
            <span style={{ fontSize: '28px' }}>&#9203;</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#1565C0' }}>
                Report Being Generated
              </div>
              <div style={{ fontSize: '12px', color: '#546E7A', marginTop: '4px' }}>
                Your assessment is complete! Your report is being generated. Counselling will be available once your report is ready.
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── EVENT: School-sponsored counselling ──
  if (eligibility.track === 'EVENT') {
    return (
      <div className='sp-card'>
        <div className='sp-card-title'>Book a Counselling Session</div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 14px',
            background: '#E8F5E9',
            borderRadius: '10px',
            border: '1px solid #A5D6A7',
            marginBottom: '12px',
          }}
        >
          <span style={{ fontSize: '20px' }}>&#127891;</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#2E7D32' }}>
              School-Sponsored Counselling
            </div>
            <div style={{ fontSize: '11px', color: '#558B2F', marginTop: '2px' }}>
              {eligibility.payload.instituteName} has provided counselling for you.
              {eligibility.payload.sessionsRemaining != null && (
                <> {eligibility.payload.sessionsRemaining} session{eligibility.payload.sessionsRemaining !== 1 ? 's' : ''} remaining.</>
              )}
            </div>
          </div>
        </div>

        <div className='sp-counselling-msg'>{cciMessages[cciLevel]}</div>

        <button
          className='sp-report-btn sp-report-btn-primary'
          onClick={() => navigate('/student/counselling/book')}
        >
          Book Session
        </button>
      </div>
    )
  }

  // ── PAID: Student has paid for counselling ──
  if (eligibility.track === 'PAID') {
    return (
      <div className='sp-card'>
        <div className='sp-card-title'>Book a Counselling Session</div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 14px',
            background: '#E8F5E9',
            borderRadius: '10px',
            border: '1px solid #A5D6A7',
            marginBottom: '12px',
          }}
        >
          <span style={{ fontSize: '20px' }}>&#9989;</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#2E7D32' }}>
              Counselling Unlocked
            </div>
            <div style={{ fontSize: '11px', color: '#558B2F', marginTop: '2px' }}>
              {eligibility.payload.sessionsRemaining} session{eligibility.payload.sessionsRemaining !== 1 ? 's' : ''} remaining out of {eligibility.payload.sessionsPurchased} purchased.
            </div>
          </div>
        </div>

        <div className='sp-counselling-msg'>{cciMessages[cciLevel]}</div>

        <button
          className='sp-report-btn sp-report-btn-primary'
          onClick={() => navigate('/student/counselling/book')}
        >
          Book Session
        </button>
      </div>
    )
  }

  // ── REPORT: Student only has report access — show pay prompt ──
  return (
    <div className='sp-card'>
      <div className='sp-card-title'>Counselling</div>

      <div className='sp-counselling-msg'>{cciMessages[cciLevel]}</div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px',
          background: 'linear-gradient(135deg, #FFF3E0, #FFF8E1)',
          borderRadius: '10px',
          border: '1px solid #FFE0B2',
          marginTop: '8px',
        }}
      >
        <span style={{ fontSize: '28px' }}>&#128172;</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '14px', color: '#E65100' }}>
            Want Expert Guidance?
          </div>
          <div style={{ fontSize: '12px', color: '#795548', marginTop: '4px' }}>
            Your report is ready to download. Unlock a one-on-one counselling session with a career expert for personalised guidance.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
        <button
          className='sp-report-btn sp-report-btn-outline'
          style={{ flex: 1 }}
          onClick={() => navigate('/student/reports')}
        >
          View Report
        </button>
        <button
          className='sp-report-btn sp-report-btn-primary'
          style={{ flex: 1 }}
          onClick={() => alert('Payment for counselling is coming soon!')}
        >
          Pay for Counselling
        </button>
      </div>
    </div>
  )
}

export default BookCounselling
