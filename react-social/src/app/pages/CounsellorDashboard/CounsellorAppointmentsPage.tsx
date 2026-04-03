import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PortalLayout, { MenuItem } from '../portal/PortalLayout'
import {
  getCounsellorAppointments,
  confirmAppointment,
  declineAppointment,
  cancelAppointment,
} from '../Counselling/API/AppointmentAPI'
import { getCounsellorByUserId } from '../Counselling/API/CounsellorAPI'
import './CounsellorPortal.css'

const COUNSELLOR_MENU_ITEMS: MenuItem[] = [
  {
    label: 'Dashboard',
    path: '/counsellor/dashboard',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <rect x='3' y='3' width='7' height='7' rx='1' />
        <rect x='14' y='3' width='7' height='7' rx='1' />
        <rect x='3' y='14' width='7' height='7' rx='1' />
        <rect x='14' y='14' width='7' height='7' rx='1' />
      </svg>
    ),
  },
  {
    label: 'Students',
    path: '/counsellor/students',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
        <circle cx='9' cy='7' r='4' />
        <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
        <path d='M16 3.13a4 4 0 0 1 0 7.75' />
      </svg>
    ),
  },
  {
    label: 'Appointments',
    path: '/counsellor/appointments',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <rect x='3' y='4' width='18' height='18' rx='2' ry='2' />
        <line x1='16' y1='2' x2='16' y2='6' />
        <line x1='8' y1='2' x2='8' y2='6' />
        <line x1='3' y1='10' x2='21' y2='10' />
      </svg>
    ),
  },
  {
    label: 'Session Notes',
    path: '/counsellor/notes',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
        <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
      </svg>
    ),
  },
  {
    label: 'Availability',
    path: '/counsellor/availability',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <circle cx='12' cy='12' r='10' />
        <polyline points='12 6 12 12 16 14' />
      </svg>
    ),
  },
  {
    label: 'Messages',
    path: '/counsellor/messages',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
      </svg>
    ),
  },
  {
    label: 'Reports',
    path: '/counsellor/reports',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <line x1='18' y1='20' x2='18' y2='10' />
        <line x1='12' y1='20' x2='12' y2='4' />
        <line x1='6' y1='20' x2='6' y2='14' />
      </svg>
    ),
  },
]

const COUNSELLOR_STORAGE_KEYS = ['counsellorPortalToken', 'counsellorPortalUser', 'counsellorPortalLoggedIn']

type FilterTab = 'all' | 'today' | 'upcoming' | 'completed' | 'pending'

function getStatusBadgeStyle(status: string): React.CSSProperties {
  switch ((status || '').toUpperCase()) {
    case 'CONFIRMED':
      return { background: '#D1FAE5', color: '#065F46', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }
    case 'ASSIGNED':
      return { background: '#FEF3C7', color: '#92400E', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }
    case 'PENDING':
      return { background: '#DBEAFE', color: '#1E40AF', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }
    case 'COMPLETED':
      return { background: '#F3F4F6', color: '#374151', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }
    case 'CANCELLED':
    case 'DECLINED':
      return { background: '#FEE2E2', color: '#991B1B', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }
    default:
      return { background: '#F3F4F6', color: '#374151', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }
  }
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function getStudentName(appt: any): string {
  if (!appt) return 'Unknown Student'
  if (appt.student) {
    return appt.student.studentInfo?.name || appt.student.name || 'Unknown Student'
  }
  return appt.studentName || 'Unknown Student'
}

function isToday(dateStr: string): boolean {
  if (!dateStr) return false
  try {
    const d = new Date(dateStr)
    const now = new Date()
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    )
  } catch {
    return false
  }
}

function isUpcoming(appt: any): boolean {
  const status = (appt.status || '').toUpperCase()
  if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'DECLINED') return false
  const slotDate = appt.slot?.startTime || appt.scheduledAt || ''
  if (!slotDate) return false
  try {
    return new Date(slotDate) > new Date()
  } catch {
    return false
  }
}

const CounsellorAppointmentsPage: React.FC = () => {
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<any[]>([])
  const [counsellorId, setCounsellorId] = useState<number | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [declineModal, setDeclineModal] = useState<{ appointmentId: number } | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [cancelModal, setCancelModal] = useState<{ appointmentId: number } | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('counsellorPortalLoggedIn')
    if (!isLoggedIn) {
      navigate('/counsellor/login')
      return
    }
    try {
      const userStr = localStorage.getItem('counsellorPortalUser')
      if (userStr) {
        const user = JSON.parse(userStr)
        setUserId(user.id)
        getCounsellorByUserId(user.id)
          .then((res) => {
            const cId = res.data?.id
            if (!cId) {
              setError('Counsellor profile not linked yet. Please contact admin to set up your profile.')
              setLoading(false)
              return
            }
            setCounsellorId(cId)
            return getCounsellorAppointments(cId).then((apptRes) => {
              setAppointments(apptRes.data || [])
            })
          })
          .catch(() => setError('Counsellor profile not found. Please contact admin to set up your profile.'))
          .finally(() => setLoading(false))
      }
    } catch {
      navigate('/counsellor/login')
    }
  }, [navigate])

  const reload = () => {
    if (!counsellorId) return
    getCounsellorAppointments(counsellorId)
      .then((res) => setAppointments(res.data || []))
      .catch(() => setError('Failed to reload appointments.'))
  }

  const handleConfirm = async (appointmentId: number) => {
    if (!userId) return
    setActionLoading(appointmentId)
    try {
      await confirmAppointment(appointmentId, userId)
      reload()
    } catch {
      setError('Failed to confirm appointment.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDecline = async () => {
    if (!declineModal || !userId) return
    setActionLoading(declineModal.appointmentId)
    try {
      await declineAppointment(declineModal.appointmentId, userId, declineReason || 'Declined by counsellor')
      setDeclineModal(null)
      setDeclineReason('')
      reload()
    } catch {
      setError('Failed to decline appointment.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async () => {
    if (!cancelModal || !userId) return
    setActionLoading(cancelModal.appointmentId)
    try {
      await cancelAppointment(cancelModal.appointmentId, userId, cancelReason || 'Cancelled by counsellor')
      setCancelModal(null)
      setCancelReason('')
      reload()
    } catch {
      setError('Failed to cancel appointment.')
    } finally {
      setActionLoading(null)
    }
  }

  // Stats
  const today = appointments.filter((a) => isToday(a.slot?.startTime || a.scheduledAt || ''))
  const thisWeek = appointments.filter((a) => {
    const d = a.slot?.startTime || a.scheduledAt || ''
    if (!d) return false
    try {
      const apptDate = new Date(d)
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 7)
      return apptDate >= startOfWeek && apptDate < endOfWeek
    } catch {
      return false
    }
  })
  const pending = appointments.filter(
    (a) => (a.status || '').toUpperCase() === 'ASSIGNED' || (a.status || '').toUpperCase() === 'PENDING'
  )
  const completed = appointments.filter((a) => (a.status || '').toUpperCase() === 'COMPLETED')

  // Filter
  const filtered = appointments.filter((a) => {
    const status = (a.status || '').toUpperCase()
    const slotDate = a.slot?.startTime || a.scheduledAt || ''
    switch (activeTab) {
      case 'today':
        return isToday(slotDate)
      case 'upcoming':
        return isUpcoming(a)
      case 'completed':
        return status === 'COMPLETED'
      case 'pending':
        return status === 'ASSIGNED' || status === 'PENDING'
      default:
        return true
    }
  })

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'today', label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
    { key: 'pending', label: 'Pending' },
  ]

  return (
    <PortalLayout
      title='Counsellor Dashboard'
      menuItems={COUNSELLOR_MENU_ITEMS}
      storageKeys={COUNSELLOR_STORAGE_KEYS}
      loginPath='/counsellor/login'
    >
      <div className='cp-welcome'>
        <h2 className='cp-welcome-title'>Appointments</h2>
        <p className='cp-welcome-sub'>Manage your counselling appointments</p>
      </div>

      {error && (
        <div
          style={{
            background: '#FEE2E2',
            color: '#991B1B',
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
          <button
            onClick={() => setError('')}
            style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontWeight: 700 }}
          >
            x
          </button>
        </div>
      )}

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: "Today's Appointments", value: today.length, color: '#263B6A' },
          { label: 'This Week', value: thisWeek.length, color: '#6984A9' },
          { label: 'Pending Confirmation', value: pending.length, color: '#D97706' },
          { label: 'Completed', value: completed.length, color: '#059669' },
        ].map((stat) => (
          <div key={stat.label} className='cp-card' style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: '#6B7A8D', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === tab.key ? '#263B6A' : '#F3F4F6',
              color: activeTab === tab.key ? '#fff' : '#374151',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Appointment List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6B7A8D', fontSize: 14 }}>
          Loading appointments...
        </div>
      ) : filtered.length === 0 ? (
        <div className='cp-card' style={{ textAlign: 'center', padding: 40, color: '#6B7A8D', fontSize: 14 }}>
          No appointments found for this filter.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((appt) => {
            const status = (appt.status || '').toUpperCase()
            const slotDate = appt.slot?.startTime || appt.scheduledAt || ''
            const studentName = getStudentName(appt)
            const meetingLink = appt.meetingLink || appt.slot?.meetingLink || ''

            return (
              <div
                key={appt.id}
                className='cp-card'
                style={{ padding: '16px 20px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  {/* Left: Info */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#263B6A' }}>
                        {formatDateTime(slotDate)}
                      </span>
                      <span style={getStatusBadgeStyle(status)}>{status}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1F2E', marginBottom: 4 }}>
                      {studentName}
                    </div>
                    {appt.reason && (
                      <div style={{ fontSize: 12, color: '#6B7A8D' }}>
                        Reason: {appt.reason}
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {status === 'ASSIGNED' && (
                      <>
                        <button
                          className='cp-action-btn cp-action-btn-primary'
                          onClick={() => handleConfirm(appt.id)}
                          disabled={actionLoading === appt.id}
                        >
                          {actionLoading === appt.id ? 'Confirming...' : 'Confirm'}
                        </button>
                        <button
                          className='cp-action-btn'
                          onClick={() => {
                            setDeclineModal({ appointmentId: appt.id })
                            setDeclineReason('')
                          }}
                          disabled={actionLoading === appt.id}
                          style={{ color: '#DC2626', borderColor: '#FCA5A5' }}
                        >
                          Decline
                        </button>
                      </>
                    )}

                    {status === 'CONFIRMED' && (
                      <>
                        {meetingLink && (
                          <a
                            href={meetingLink}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='cp-action-btn cp-action-btn-primary'
                            style={{ textDecoration: 'none', display: 'inline-block' }}
                          >
                            Join Meet
                          </a>
                        )}
                        <button
                          className='cp-action-btn'
                          onClick={() => {
                            setCancelModal({ appointmentId: appt.id })
                            setCancelReason('')
                          }}
                          disabled={actionLoading === appt.id}
                          style={{ color: '#DC2626', borderColor: '#FCA5A5' }}
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {status === 'COMPLETED' && (
                      <button
                        className='cp-action-btn'
                        onClick={() => navigate('/counsellor/notes')}
                      >
                        View Notes
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Decline Modal */}
      {declineModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            className='cp-card'
            style={{ width: '100%', maxWidth: 420, padding: 28 }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#263B6A', marginBottom: 12 }}>Decline Appointment</h3>
            <p style={{ fontSize: 13, color: '#6B7A8D', marginBottom: 12 }}>Please provide a reason for declining:</p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder='Reason for declining...'
              rows={3}
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid #DDE3EC',
                borderRadius: 8, fontSize: 13, resize: 'vertical', outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                className='cp-action-btn'
                onClick={() => setDeclineModal(null)}
              >
                Cancel
              </button>
              <button
                className='cp-action-btn'
                onClick={handleDecline}
                disabled={actionLoading === declineModal.appointmentId}
                style={{ background: '#DC2626', color: '#fff', borderColor: '#DC2626' }}
              >
                {actionLoading === declineModal.appointmentId ? 'Declining...' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            className='cp-card'
            style={{ width: '100%', maxWidth: 420, padding: 28 }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#263B6A', marginBottom: 12 }}>Cancel Appointment</h3>
            <p style={{ fontSize: 13, color: '#6B7A8D', marginBottom: 12 }}>Please provide a reason for cancelling:</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder='Reason for cancelling...'
              rows={3}
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid #DDE3EC',
                borderRadius: 8, fontSize: 13, resize: 'vertical', outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                className='cp-action-btn'
                onClick={() => setCancelModal(null)}
              >
                Go Back
              </button>
              <button
                className='cp-action-btn'
                onClick={handleCancel}
                disabled={actionLoading === cancelModal.appointmentId}
                style={{ background: '#DC2626', color: '#fff', borderColor: '#DC2626' }}
              >
                {actionLoading === cancelModal.appointmentId ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  )
}

export default CounsellorAppointmentsPage
