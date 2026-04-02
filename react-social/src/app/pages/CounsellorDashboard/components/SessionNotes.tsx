import React from 'react'

const DEMO_NOTES = [
  { student: 'Aarav Sharma', date: '28 Mar 2026', text: 'Discussed CS career path. Strong interest in AI/ML. Recommended exploring B.Tech CS options at IITs and NITs. Follow up on college application timeline.' },
  { student: 'Vikram Singh', date: '25 Mar 2026', text: 'Low CCI follow-up. Student unsure about career direction. Suggested completing the full Navigator assessment. Scheduled parent meeting next week.' },
  { student: 'Rohan Kumar', date: '22 Mar 2026', text: 'Stream selection counselling. Moderate interest in both Science and Commerce. Recommended exploring hybrid options.' },
]

const SessionNotes: React.FC = () => {
  return (
    <div className='cp-card'>
      <div className='cp-card-title'>Recent Session Notes</div>

      {DEMO_NOTES.map((note, i) => (
        <div className='cp-note-item' key={i}>
          <div className='cp-note-meta'>
            <span style={{ fontWeight: 600, color: '#263B6A' }}>{note.student}</span>
            <span>{note.date}</span>
          </div>
          <div className='cp-note-text'>{note.text}</div>
        </div>
      ))}

      <button
        className='cp-action-btn'
        style={{ width: '100%', marginTop: 8, textAlign: 'center' }}
        onClick={() => alert('Notes management coming soon!')}
      >
        View All Notes
      </button>
    </div>
  )
}

export default SessionNotes
