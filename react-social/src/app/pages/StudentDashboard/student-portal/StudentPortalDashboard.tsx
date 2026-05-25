import React from 'react'

const STUDENT_PORTAL_URL = 'https://project-mlxjt.vercel.app/'

const StudentPortalDashboard: React.FC = () => {
  return (
    <div style={{ width: '100%', height: 'calc(100vh - 100px)' }}>
      <iframe
        src={STUDENT_PORTAL_URL}
        title="Student Portal"
        style={{ width: '100%', height: '100%', border: 'none' }}
        allow="clipboard-read; clipboard-write; fullscreen; camera; microphone"
      />
    </div>
  )
}

export default StudentPortalDashboard
