import React from 'react'
import '../Counselling.css'

interface Props {
  /** The student's assessment report, or null/undefined while it is still being generated. */
  link?: string | null
}

/**
 * The student's assessment report, as an action on a session.
 *
 * <p>The report is the subject of the session, and until now the counsellor's portal never
 * showed it: they knew who was coming and when, and had to go looking for the results
 * separately. It is the same link the booking email carries and the same one the admin sees
 * under Manage Sessions, resolved once on the server so all three agree.
 *
 * <p>The "still being prepared" state is stated rather than rendered as nothing. An absent
 * button reads as "this session has no report", which sends a counsellor hunting for one; a
 * report is generated for every student, so the honest answer is that it has not arrived yet.
 */
const SessionReportLink: React.FC<Props> = ({ link }) => {
  if (!link) {
    return (
      <span
        style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', fontStyle: 'italic' }}
        title='The report is generated automatically once the student completes the assessment.'
      >
        Assessment report — being prepared
      </span>
    )
  }

  return (
    <a
      href={link}
      target='_blank'
      rel='noopener noreferrer'
      className='cl-btn-outline'
      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
      title="Open this student's assessment report"
    >
      <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
        <polyline points='14 2 14 8 20 8' />
        <line x1='8' y1='13' x2='16' y2='13' />
        <line x1='8' y1='17' x2='13' y2='17' />
      </svg>
      View Report
    </a>
  )
}

export default SessionReportLink
