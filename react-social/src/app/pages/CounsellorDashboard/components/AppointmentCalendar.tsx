import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getCounsellorAppointments,
  confirmAppointment,
  declineAppointment,
} from '../../Counselling/API/AppointmentAPI'

interface AppointmentSlot {
  date: string
  startTime: string
  endTime: string
  durationMinutes: number
}

interface AppointmentStudent {
  studentInfo?: { name?: string }
  name?: string
}

interface Appointment {
  id: number
  slot: AppointmentSlot
  student: AppointmentStudent
  counsellor?: { name?: string }
  status: string
  meetingLink?: string | null
  studentReason?: string
}

interface Props {
  counsellorId: number | null
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: '#22c55e',
  ASSIGNED: '#f59e0b',
  COMPLETED: '#9ca3af',
  PENDING: '#6b7280',
  CANCELLED: '#ef4444',
}

function formatTime(timeStr: string): string {
  if (!timeStr) return ''
  const [hourStr, minuteStr] = timeStr.split(':')
  const hour = parseInt(hourStr, 10)
  const minute = minuteStr || '00'
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:${minute} ${ampm}`
}

function getStudentName(student: AppointmentStudent): string {
  if (!student) return 'Unknown Student'
  if (student.studentInfo?.name) return student.studentInfo.name
  if (student.name) return student.name
  return 'Unknown Student'
}

function getTodayString(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const AppointmentCalendar: React.FC<Props> = ({ counsellorId }) => {
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  useEffect(() => {
    if (counsellorId == null) return

    setLoading(true)
    setError(null)

    getCounsellorAppointments(counsellorId)
      .then((res) => {
        const all: Appointment[] = res.data || []
        const todayStr = getTodayString()

        const todayAppts = all
          .filter((a) => a.slot?.date === todayStr)
          .sort((a, b) => {
            const aTime = a.slot?.startTime || ''
            const bTime = b.slot?.startTime || ''
            return aTime.localeCompare(bTime)
          })

        setAppointments(todayAppts)
      })
      .catch(() => {
        setError('Failed to load appointments.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [counsellorId])

  const handleConfirm = async (appointmentId: number) => {
    const user = JSON.parse(localStorage.getItem('counsellorPortalUser') || '{}')
    const userId = user.id
    if (!userId) return

    setActionLoading(appointmentId)
    try {
      await confirmAppointment(appointmentId, userId)
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status: 'CONFIRMED' } : a))
      )
    } catch {
      // silently ignore for now
    } finally {
      setActionLoading(null)
    }
  }

  const handleDecline = async (appointmentId: number) => {
    const user = JSON.parse(localStorage.getItem('counsellorPortalUser') || '{}')
    const userId = user.id
    if (!userId) return

    setActionLoading(appointmentId)
    try {
      await declineAppointment(appointmentId, userId, 'Declined by counsellor')
      setAppointments((prev) => prev.filter((a) => a.id !== appointmentId))
    } catch {
      // silently ignore for now
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className='cp-card'>
      <div className='cp-card-title'>Today's Appointments</div>
      <div style={{ fontSize: 12, color: '#6B7A8D', marginBottom: 12 }}>{dateStr}</div>

      {loading && (
        <div style={{ color: '#6B7A8D', fontSize: 13, padding: '8px 0' }}>Loading appointments...</div>
      )}

      {!counsellorId && !loading && (
        <div style={{ color: '#6B7A8D', fontSize: 13, padding: '8px 0' }}>
          Counsellor profile not linked yet. Please contact admin to set up your profile.
        </div>
      )}

      {error && counsellorId && (
        <div style={{ color: '#ef4444', fontSize: 13, padding: '8px 0' }}>{error}</div>
      )}

      {!loading && !error && counsellorId && appointments.length === 0 && (
        <div style={{ color: '#9ca3af', fontSize: 13, padding: '8px 0' }}>
          No appointments scheduled for today.
        </div>
      )}

      {appointments.map((appt) => {
        const statusColor = STATUS_COLORS[appt.status] || '#9ca3af'
        const isActioning = actionLoading === appt.id

        return (
          <div className='cp-appt-item' key={appt.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: statusColor,
                  flexShrink: 0,
                }}
              />
              <div className='cp-appt-time'>
                {formatTime(appt.slot?.startTime)} – {formatTime(appt.slot?.endTime)}
              </div>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 10,
                  fontWeight: 600,
                  color: statusColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {appt.status}
              </span>
            </div>

            <div className='cp-appt-student'>{getStudentName(appt.student)}</div>

            {appt.studentReason && (
              <div className='cp-appt-type'>{appt.studentReason}</div>
            )}

            {appt.status === 'CONFIRMED' && appt.meetingLink && (
              <a
                href={appt.meetingLink}
                target='_blank'
                rel='noopener noreferrer'
                className='cp-action-btn'
                style={{ display: 'inline-block', marginTop: 6, fontSize: 12 }}
              >
                Join Meet
              </a>
            )}

            {appt.status === 'ASSIGNED' && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button
                  className='cp-action-btn'
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  disabled={isActioning}
                  onClick={() => handleConfirm(appt.id)}
                >
                  {isActioning ? '...' : 'Confirm'}
                </button>
                <button
                  className='cp-action-btn'
                  style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    background: 'transparent',
                    color: '#ef4444',
                    border: '1px solid #ef4444',
                  }}
                  disabled={isActioning}
                  onClick={() => handleDecline(appt.id)}
                >
                  {isActioning ? '...' : 'Decline'}
                </button>
              </div>
            )}
          </div>
        )
      })}

      <button
        className='cp-action-btn'
        style={{ width: '100%', marginTop: 8, textAlign: 'center' }}
        onClick={() => navigate('/counsellor/appointments')}
      >
        View Full Calendar
      </button>
    </div>
  )
}

export default AppointmentCalendar
