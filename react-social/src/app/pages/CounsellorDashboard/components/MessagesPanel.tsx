import React from 'react'
import { showSuccessToast } from '../../../utils/toast'

const DEMO_MESSAGES = [
  { from: 'Principal', body: 'Please prepare the career guidance report for Grade 10 by end of this week. Board review meeting on Monday.', time: '2 hours ago', unread: true },
  { from: 'Class Teacher - 9B', body: 'Vikram Singh has been absent for 3 days. His parents mentioned he is anxious about upcoming assessments. Could you schedule a session?', time: '1 day ago', unread: true },
  { from: 'Parent - Priya Patel', body: 'Thank you for the career counselling session last week. Priya is very excited about the Science stream now.', time: '3 days ago', unread: false },
]

const MessagesPanel: React.FC = () => {
  return (
    <div className='cp-card'>
      <div className='cp-card-title' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Messages</span>
        <span style={{ background: '#DC2626', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>
          {DEMO_MESSAGES.filter((m) => m.unread).length} new
        </span>
      </div>

      {DEMO_MESSAGES.map((msg, i) => (
        <div className='cp-msg-item' key={i}>
          <div className='cp-msg-from'>
            {msg.unread && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#DC2626', marginRight: 6, verticalAlign: 'middle' }} />}
            {msg.from}
          </div>
          <div className='cp-msg-body'>{msg.body}</div>
          <div className='cp-msg-time'>{msg.time}</div>
        </div>
      ))}

      <button
        className='cp-action-btn'
        style={{ width: '100%', marginTop: 8, textAlign: 'center' }}
        onClick={() => showSuccessToast('Messaging coming soon!')}
      >
        View All Messages
      </button>
    </div>
  )
}

export default MessagesPanel
