import React from 'react'

const MessagesPanel: React.FC = () => {
  return (
    <div className='cp-card'>
      <div className='cp-card-header'>
        <h3 className='cp-card-title'>Messages</h3>
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '32px 16px', textAlign: 'center',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', background: '#E8F5E9',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}>
          <svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='#0C6B5A' strokeWidth='1.5'>
            <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
          </svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1A2B28', marginBottom: 4 }}>
          Messaging Coming Soon
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.6 }}>
          You will be able to communicate with students and administrators here.
        </div>
      </div>
    </div>
  )
}

export default MessagesPanel
