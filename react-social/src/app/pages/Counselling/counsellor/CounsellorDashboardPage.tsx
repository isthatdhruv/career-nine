import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../modules/auth'
import { showErrorToast } from '../../../utils/toast'
import StatusBadge from '../shared/StatusBadge'
import ScheduleCard from './components/ScheduleCard'
import {
  getCounsellorAppointments,
  confirmAppointment,
  declineAppointment,
  cancelAppointment,
  startSession,
  verifyCheckin,
  getDashboardSummary,
} from '../API/AppointmentAPI'
import { getCounsellorByUserId } from '../API/CounsellorAPI'
import { useRefreshInterval } from '../../../utils/useAutoRefresh'
import '../Counselling.css'

type TabKey = 'schedule' | 'availability' | 'history' | 'pending'

const CounsellorDashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const { currentUser } = useAuth()

  const [counsellor, setCounsellor] = useState<any>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('schedule')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Per-appointment check-in UI state: whether a code was sent + the typed code.
  const [otpSent, setOtpSent] = useState<Record<number, boolean>>({})
  const [otpCode, setOtpCode] = useState<Record<number, string>>({})
  const [checkinMsg, setCheckinMsg] = useState<Record<number, string>>({})

  // Phase 19: userId resolves from useAuth().currentUser only — the legacy
  // localStorage JSON-blob fallback is gone.
  const userId: number | undefined = currentUser?.id

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        const counsellorRes = await getCounsellorByUserId(userId)
        const counsellorData = counsellorRes.data
        setCounsellor(counsellorData)

        const apptRes = await getCounsellorAppointments(counsellorData.id)
        setAppointments(apptRes.data || [])

        try {
          const sumRes = await getDashboardSummary(counsellorData.id)
          setSummary(sumRes.data)
        } catch {
          // summary is best-effort — fall back to client-computed stats
        }
      } catch {
        setError('Failed to load dashboard data. Please refresh.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [userId])

  useRefreshInterval(() => {
    if (!counsellor?.id) return
    getCounsellorAppointments(counsellor.id)
      .then((res) => setAppointments(res.data || []))
      .catch(() => {})
  }, { skip: !counsellor?.id })

  const refreshAppointments = async () => {
    if (!counsellor?.id) return
    try {
      const res = await getCounsellorAppointments(counsellor.id)
      setAppointments(res.data || [])
      getDashboardSummary(counsellor.id).then((r) => setSummary(r.data)).catch(() => {})
    } catch {
      // silent refresh failure
    }
  }

  // ── Session check-in (OTP) ──
  const handleStartSession = async (appointmentId: number) => {
    try {
      await startSession(appointmentId)
      setOtpSent((p) => ({ ...p, [appointmentId]: true }))
      setCheckinMsg((p) => ({ ...p, [appointmentId]: 'Code sent to the student. Ask them for it.' }))
    } catch (e: any) {
      const body = e?.response?.data
      showErrorToast(typeof body === 'string' ? body : 'Could not start the session.')
    }
  }

  const handleVerifyCheckin = async (appointmentId: number) => {
    const code = (otpCode[appointmentId] || '').trim()
    if (!code) {
      setCheckinMsg((p) => ({ ...p, [appointmentId]: 'Enter the code shared with the student.' }))
      return
    }
    try {
      await verifyCheckin(appointmentId, code)
      setCheckinMsg((p) => ({ ...p, [appointmentId]: '' }))
      await refreshAppointments()
    } catch (e: any) {
      const body = e?.response?.data
      setCheckinMsg((p) => ({ ...p, [appointmentId]: typeof body === 'string' ? body : 'Verification failed.' }))
    }
  }

  const handleConfirm = async (appointmentId: number) => {
    if (!userId) return
    try {
      await confirmAppointment(appointmentId, userId)
      await refreshAppointments()
    } catch {
      showErrorToast('Failed to confirm appointment.')
    }
  }

  const handleDecline = async (appointmentId: number) => {
    const reason = prompt('Reason for declining:')
    if (reason === null) return
    if (!userId) return
    try {
      await declineAppointment(appointmentId, userId, reason)
      await refreshAppointments()
    } catch {
      showErrorToast('Failed to decline appointment.')
    }
  }

  const handleCancel = async (appointmentId: number) => {
    const reason = prompt('Reason for cancellation:')
    if (reason === null) return
    if (!userId) return
    try {
      await cancelAppointment(appointmentId, userId, reason)
      await refreshAppointments()
    } catch {
      showErrorToast('Failed to cancel appointment.')
    }
  }

  // ── Date helpers ──
  const todayStr = new Date().toISOString().slice(0, 10)

  const isToday = (appt: any): boolean => {
    const slotDate = appt.slot?.date || appt.date || appt.appointmentDate || ''
    return slotDate && slotDate.slice(0, 10) === todayStr
  }

  const isPast = (appt: any): boolean => {
    const slotDate = appt.slot?.date || appt.date || appt.appointmentDate || ''
    return slotDate && slotDate.slice(0, 10) < todayStr
  }

  // ── Tab content ──
  const todaySchedule = appointments.filter(
    (a) => isToday(a) && a.status !== 'CANCELLED' && a.status !== 'DECLINED'
  )

  const historyAppointments = appointments.filter(
    (a) => a.status === 'COMPLETED' || (isPast(a) && a.status === 'CONFIRMED')
  )

  const pendingAppointments = appointments.filter((a) => a.status === 'ASSIGNED')

  // ── Stats ── (prefer the server summary; fall back to client-computed)
  const stats = summary
    ? [
        { label: "Today's Sessions", value: summary.todayCount ?? todaySchedule.length },
        { label: 'Booked Slots (7d)', value: summary.bookedSlotsThisWeek ?? 0 },
        { label: 'Free Slots (7d)', value: summary.freeSlotsThisWeek ?? 0 },
        { label: 'Upcoming', value: summary.upcomingCount ?? 0 },
        { label: 'Completed', value: summary.completedCount ?? 0 },
      ]
    : [
        { label: "Today's Sessions", value: todaySchedule.length },
        { label: 'Pending Confirmation', value: pendingAppointments.length },
        { label: 'Completed', value: appointments.filter((a) => a.status === 'COMPLETED').length },
        { label: 'Total Assigned', value: appointments.length },
      ]

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--sp-muted, #5C7A72)' }}>
        Loading dashboard...
      </div>
    )
  }

  if (!userId) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--sp-danger, #EF4444)' }}>
        Not authenticated. Please log in.
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--sp-text, #1A2B28)', margin: 0 }}>
          My Dashboard
        </h2>
        {counsellor && (
          <p style={{ fontSize: 14, color: 'var(--sp-muted, #5C7A72)', margin: '4px 0 0' }}>
            {counsellor.name || counsellor.fullName || 'Counsellor'} &middot; Counselling Portal
          </p>
        )}
        {error && (
          <p style={{ fontSize: 13, color: 'var(--sp-danger, #EF4444)', marginTop: 8 }}>{error}</p>
        )}
      </div>

      {/* Stats Bar */}
      <div className='cl-stats-bar' style={{ marginBottom: 28 }}>
        {stats.map((s) => (
          <div key={s.label} className='cl-stat-item'>
            <span className='cl-stat-label'>{s.label}</span>
            <span className='cl-stat-value'>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className='cl-tabs'>
        {(
          [
            { key: 'schedule', label: "My Schedule" },
            { key: 'availability', label: 'Availability' },
            { key: 'history', label: 'Session History' },
            { key: 'pending', label: `Pending${pendingAppointments.length > 0 ? ` (${pendingAppointments.length})` : ''}` },
          ] as { key: TabKey; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            className={`cl-tab${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => {
              if (tab.key === 'availability') {
                navigate('/counsellor/availability')
              } else {
                setActiveTab(tab.key)
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'schedule' && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--sp-text, #1A2B28)', marginBottom: 16 }}>
            Today's Sessions
          </h3>
          {todaySchedule.length === 0 ? (
            <div className='cl-card' style={{ textAlign: 'center', padding: 32 }}>
              <p style={{ color: 'var(--sp-muted, #5C7A72)', fontSize: 14, margin: 0 }}>
                No sessions scheduled for today.
              </p>
            </div>
          ) : (
            <div>
              {todaySchedule.map((appt) => (
                <div key={appt.id} style={{ marginBottom: 12 }}>
                  <ScheduleCard
                    appointment={appt}
                    onConfirm={handleConfirm}
                    onDecline={handleDecline}
                    onCancel={handleCancel}
                  />
                  {/* Session check-in (OTP) — only for confirmed sessions not yet checked in */}
                  {(appt.status === 'CONFIRMED') && !appt.attended && (
                    <div className='cl-card' style={{ marginTop: 6, padding: '12px 16px', background: 'var(--sp-bg, #F2F7F5)' }}>
                      {!otpSent[appt.id] ? (
                        <button
                          className='cl-btn-primary'
                          style={{ fontSize: 13, padding: '6px 14px' }}
                          onClick={() => handleStartSession(appt.id)}
                        >
                          Start session (send check-in code)
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                          <input
                            type='text'
                            inputMode='numeric'
                            maxLength={6}
                            placeholder='6-digit code'
                            value={otpCode[appt.id] || ''}
                            onChange={(e) =>
                              setOtpCode((p) => ({ ...p, [appt.id]: e.target.value.replace(/\D/g, '').slice(0, 6) }))
                            }
                            style={{ padding: '7px 10px', border: '1.5px solid var(--sp-border, #D1E5DF)', borderRadius: 8, fontSize: 14, width: 130 }}
                          />
                          <button
                            className='cl-btn-primary'
                            style={{ fontSize: 13, padding: '6px 14px' }}
                            onClick={() => handleVerifyCheckin(appt.id)}
                          >
                            Verify &amp; start
                          </button>
                          <button
                            className='cl-btn-secondary'
                            style={{ fontSize: 12, padding: '6px 12px' }}
                            onClick={() => handleStartSession(appt.id)}
                          >
                            Resend code
                          </button>
                        </div>
                      )}
                      {checkinMsg[appt.id] && (
                        <div style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', marginTop: 6 }}>
                          {checkinMsg[appt.id]}
                        </div>
                      )}
                    </div>
                  )}
                  {appt.status === 'IN_PROGRESS' && (
                    <div style={{ fontSize: 12, color: 'var(--sp-primary, #0C6B5A)', margin: '6px 4px 0', fontWeight: 600 }}>
                      ✓ Checked in — session in progress
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--sp-text, #1A2B28)', marginBottom: 16 }}>
            Session History
          </h3>
          {historyAppointments.length === 0 ? (
            <div className='cl-card' style={{ textAlign: 'center', padding: 32 }}>
              <p style={{ color: 'var(--sp-muted, #5C7A72)', fontSize: 14, margin: 0 }}>
                No completed sessions yet.
              </p>
            </div>
          ) : (
            <div>
              {historyAppointments.map((appt) => (
                <div key={appt.id} className='cl-card cl-card-accent' style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <StatusBadge status={appt.status} />
                    <span style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)' }}>
                      {appt.slot?.date || appt.date || ''} &middot; {appt.slot?.startTime || appt.startTime || ''}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--sp-text, #1A2B28)', marginBottom: 4 }}>
                    {appt.student?.name || appt.studentName || 'Unknown Student'}
                  </div>
                  {appt.reason && (
                    <div style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)', marginBottom: 8 }}>
                      {appt.reason}
                    </div>
                  )}
                  {appt.status === 'COMPLETED' && !appt.sessionNotes && (
                    <button
                      className='cl-btn-warning'
                      style={{ fontSize: 12, padding: '5px 12px' }}
                      onClick={() => navigate(`/counsellor/session-notes/${appt.id}`)}
                    >
                      Add Notes
                    </button>
                  )}
                  {appt.sessionNotes && (
                    <div className='cl-remarks-box' style={{ marginTop: 8 }}>
                      {appt.sessionNotes.publicRemarks || appt.sessionNotes.keyDiscussionPoints}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'pending' && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--sp-text, #1A2B28)', marginBottom: 16 }}>
            Pending Confirmation
          </h3>
          {pendingAppointments.length === 0 ? (
            <div className='cl-card' style={{ textAlign: 'center', padding: 32 }}>
              <p style={{ color: 'var(--sp-muted, #5C7A72)', fontSize: 14, margin: 0 }}>
                No sessions awaiting confirmation.
              </p>
            </div>
          ) : (
            <div>
              {pendingAppointments.map((appt) => (
                <ScheduleCard
                  key={appt.id}
                  appointment={appt}
                  onConfirm={handleConfirm}
                  onDecline={handleDecline}
                  onCancel={handleCancel}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CounsellorDashboardPage
