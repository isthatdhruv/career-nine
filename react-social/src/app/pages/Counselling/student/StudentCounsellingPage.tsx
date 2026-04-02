import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../Counselling.css'
import PortalLayout, { MenuItem } from '../../portal/PortalLayout'
import StatusBadge from '../shared/StatusBadge'
import NotificationBell from '../shared/NotificationBell'
import { getStudentAppointments, cancelAppointment } from '../API/AppointmentAPI'
import UpcomingSessionCard from './components/UpcomingSessionCard'
import PastSessionCard from './components/PastSessionCard'

const STUDENT_MENU_ITEMS: MenuItem[] = [
  { label: 'Dashboard', path: '/student/dashboard', icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><rect x='3' y='3' width='7' height='7' rx='1'/><rect x='14' y='3' width='7' height='7' rx='1'/><rect x='3' y='14' width='7' height='7' rx='1'/><rect x='14' y='14' width='7' height='7' rx='1'/></svg> },
  { label: 'Assessments', path: '/student/assessments', icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M9 11l3 3L22 4'/><path d='M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'/></svg> },
  { label: 'My Reports', path: '/student/reports', icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><polyline points='14 2 14 8 20 8'/><line x1='16' y1='13' x2='8' y2='13'/><line x1='16' y1='17' x2='8' y2='17'/></svg> },
  { label: 'Counselling', path: '/student/counselling', icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/></svg> },
]
const STUDENT_STORAGE_KEYS = ['studentPortalProfile', 'studentPortalDashboard', 'studentPortalLoggedIn']

interface Slot {
  date: string
  startTime: string
  endTime: string
  durationMinutes: number
}

interface Appointment {
  appointmentId: number
  status: string
  reason?: string
  meetingLink?: string
  slot: Slot
  counsellorName?: string
}

type TabKey = 'upcoming' | 'past' | 'pending'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past Sessions' },
  { key: 'pending', label: 'Pending Requests' },
]

function getTodayISODate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
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

const StudentCounsellingPage: React.FC = () => {
  const navigate = useNavigate()

  const studentId: number = (() => {
    try {
      return JSON.parse(localStorage.getItem('studentPortalDashboard') || '{}')?.userStudentId || 0
    } catch {
      return 0
    }
  })()

  const userId: number = (() => {
    try {
      return JSON.parse(localStorage.getItem('studentPortalProfile') || '{}')?.userId || 0
    } catch {
      return 0
    }
  })()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  useEffect(() => {
    if (!studentId) {
      setLoading(false)
      return
    }
    setLoading(true)
    getStudentAppointments(studentId)
      .then((res) => {
        const data: Appointment[] = Array.isArray(res.data) ? res.data : []
        setAppointments(data)
      })
      .catch(() => {
        setError('Failed to load appointments. Please try again.')
      })
      .finally(() => setLoading(false))
  }, [studentId])

  const today = getTodayISODate()

  const upcomingAppointments = appointments.filter(
    (a) => a.status === 'CONFIRMED' && a.slot?.date >= today
  )
  const pastAppointments = appointments.filter((a) => a.status === 'COMPLETED')
  const pendingAppointments = appointments.filter(
    (a) => a.status === 'PENDING' || a.status === 'ASSIGNED'
  )

  const handleCancel = (appointmentId: number) => {
    if (!window.confirm('Are you sure you want to cancel this session?')) return
    setCancellingId(appointmentId)
    cancelAppointment(appointmentId, userId, 'Cancelled by student')
      .then(() => {
        setAppointments((prev) =>
          prev.map((a) =>
            a.appointmentId === appointmentId ? { ...a, status: 'CANCELLED' } : a
          )
        )
      })
      .catch(() => {
        alert('Could not cancel the session. Please try again.')
      })
      .finally(() => setCancellingId(null))
  }

  const handleBookSession = () => {
    navigate('/student/counselling/book')
  }

  const getTabCount = (key: TabKey): number => {
    if (key === 'upcoming') return upcomingAppointments.length
    if (key === 'past') return pastAppointments.length
    if (key === 'pending') return pendingAppointments.length
    return 0
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--sp-muted, #5C7A72)', fontSize: 14 }}>
          Loading sessions...
        </div>
      )
    }

    if (error) {
      return (
        <div
          className='cl-card'
          style={{
            textAlign: 'center',
            padding: '32px 24px',
            color: 'var(--sp-danger, #EF4444)',
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )
    }

    if (activeTab === 'upcoming') {
      if (upcomingAppointments.length === 0) {
        return (
          <div className='cl-card' style={{ textAlign: 'center', padding: '48px 24px' }}>
            <svg width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='#B0BEC5' strokeWidth='1.5' style={{ marginBottom: 16 }}>
              <rect x='3' y='4' width='18' height='18' rx='2' ry='2' />
              <line x1='16' y1='2' x2='16' y2='6' />
              <line x1='8' y1='2' x2='8' y2='6' />
              <line x1='3' y1='10' x2='21' y2='10' />
            </svg>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#455A64', marginBottom: 6 }}>
              No upcoming sessions
            </div>
            <div style={{ fontSize: 13, color: '#78909C', marginBottom: 20 }}>
              Book a counselling session to get started
            </div>
            <button className='cl-btn-primary' onClick={handleBookSession} style={{ fontSize: 13 }}>
              Book a Session
            </button>
          </div>
        )
      }
      return (
        <div>
          {upcomingAppointments.map((appt) => (
            <UpcomingSessionCard
              key={appt.appointmentId}
              appointment={appt}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )
    }

    if (activeTab === 'past') {
      if (pastAppointments.length === 0) {
        return (
          <div className='cl-card' style={{ textAlign: 'center', padding: '48px 24px' }}>
            <svg width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='#B0BEC5' strokeWidth='1.5' style={{ marginBottom: 16 }}>
              <circle cx='12' cy='12' r='10' />
              <polyline points='12 6 12 12 16 14' />
            </svg>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#455A64' }}>No past sessions</div>
            <div style={{ fontSize: 13, color: '#78909C', marginTop: 4 }}>
              Completed sessions will appear here
            </div>
          </div>
        )
      }
      return (
        <div>
          {pastAppointments.map((appt) => (
            <PastSessionCard key={appt.appointmentId} appointment={appt} />
          ))}
        </div>
      )
    }

    if (activeTab === 'pending') {
      if (pendingAppointments.length === 0) {
        return (
          <div className='cl-card' style={{ textAlign: 'center', padding: '48px 24px' }}>
            <svg width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='#B0BEC5' strokeWidth='1.5' style={{ marginBottom: 16 }}>
              <circle cx='12' cy='12' r='10' />
              <line x1='12' y1='8' x2='12' y2='12' />
              <line x1='12' y1='16' x2='12.01' y2='16' />
            </svg>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#455A64' }}>No pending requests</div>
            <div style={{ fontSize: 13, color: '#78909C', marginTop: 4 }}>
              Requests awaiting counsellor assignment will appear here
            </div>
          </div>
        )
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pendingAppointments.map((appt) => (
            <div key={appt.appointmentId} className='cl-card cl-card-warning'>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <StatusBadge status={appt.status} />
                {appt.slot?.date && (
                  <span style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)' }}>
                    Requested for {formatDate(appt.slot.date)}
                  </span>
                )}
              </div>
              {appt.slot && (
                <div style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)', marginBottom: 8 }}>
                  <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' style={{ verticalAlign: 'middle', marginRight: 4 }}>
                    <circle cx='12' cy='12' r='10' />
                    <polyline points='12 6 12 12 16 14' />
                  </svg>
                  {formatTime(appt.slot.startTime)} – {formatTime(appt.slot.endTime)}
                </div>
              )}
              {appt.reason && (
                <div style={{ fontSize: 13, color: 'var(--sp-text, #1A2B28)', lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 500 }}>Reason: </span>
                  {appt.reason}
                </div>
              )}
              {appt.status === 'ASSIGNED' && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#1E40AF', fontStyle: 'italic' }}>
                  A counsellor has been assigned — awaiting confirmation
                </div>
              )}
            </div>
          ))}
        </div>
      )
    }

    return null
  }

  return (
    <PortalLayout
      title='Career Navigator 360'
      menuItems={STUDENT_MENU_ITEMS}
      storageKeys={STUDENT_STORAGE_KEYS}
      loginPath='/student/login'
    >
      <div style={{ maxWidth: 760 }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 28,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--sp-text, #1A2B28)', margin: 0 }}>
              My Counselling
            </h1>
            <p style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)', marginTop: 4, marginBottom: 0 }}>
              Manage your counselling sessions and bookings
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {userId > 0 && <NotificationBell userId={userId} />}
            <button
              className='cl-btn-primary'
              onClick={handleBookSession}
              style={{ fontSize: 13 }}
            >
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                <line x1='12' y1='5' x2='12' y2='19' />
                <line x1='5' y1='12' x2='19' y2='12' />
              </svg>
              Book Session
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className='cl-tabs'>
          {TABS.map((tab) => {
            const count = getTabCount(tab.key)
            return (
              <button
                key={tab.key}
                className={`cl-tab${activeTab === tab.key ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    style={{
                      marginLeft: 6,
                      background:
                        activeTab === tab.key
                          ? 'var(--sp-primary, #0C6B5A)'
                          : 'var(--sp-border, #D1E5DF)',
                      color:
                        activeTab === tab.key
                          ? '#fff'
                          : 'var(--sp-muted, #5C7A72)',
                      borderRadius: '999px',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '1px 7px',
                      display: 'inline-block',
                      lineHeight: '18px',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        {renderContent()}
      </div>
    </PortalLayout>
  )
}

export default StudentCounsellingPage
