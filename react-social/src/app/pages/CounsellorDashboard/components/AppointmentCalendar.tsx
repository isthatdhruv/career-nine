import React from 'react'

const DEMO_APPOINTMENTS = [
  { time: '10:00 AM', student: 'Aarav Sharma', type: 'Career Guidance - Grade 10A' },
  { time: '11:30 AM', student: 'Priya Patel', type: 'Stream Selection - Grade 9B' },
  { time: '2:00 PM', student: 'Vikram Singh', type: 'Follow-up - Low CCI' },
]

const AppointmentCalendar: React.FC = () => {
  const today = new Date()
  const dateStr = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className='cp-card'>
      <div className='cp-card-title'>Today's Appointments</div>
      <div style={{ fontSize: 12, color: '#5C7A72', marginBottom: 12 }}>{dateStr}</div>

      {DEMO_APPOINTMENTS.map((appt, i) => (
        <div className='cp-appt-item' key={i}>
          <div className='cp-appt-time'>{appt.time}</div>
          <div className='cp-appt-student'>{appt.student}</div>
          <div className='cp-appt-type'>{appt.type}</div>
        </div>
      ))}

      <button
        className='cp-action-btn'
        style={{ width: '100%', marginTop: 8, textAlign: 'center' }}
        onClick={() => alert('Calendar view coming soon!')}
      >
        View Full Calendar
      </button>
    </div>
  )
}

export default AppointmentCalendar
