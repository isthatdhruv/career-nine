import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import '../Counselling.css'
import NotificationBell from '../shared/NotificationBell'
import { getStudentAppointments } from '../API/AppointmentAPI'
import UpcomingSessionCard from './components/UpcomingSessionCard'
import PastSessionCard from './components/PastSessionCard'
import PendingRatingPrompt from './components/PendingRatingPrompt'
import { useRefreshInterval } from '../../../utils/useAutoRefresh'
import { useAuth } from '../../../modules/auth/core/Auth'

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
  studentRescheduleCount?: number
  /** Set when a counsellor cancellation/no-show moved her — exempts the session from her
   *  cutoff, and from the miss count if the new time does not suit. */
  forceShifted?: boolean
  /** The time it was moved from, so the card can explain the change. */
  shiftedFromStart?: string | null
  /** Who ended it, and why — the history is only meaningful with attribution. */
  cancelledByRole?: string | null
  cancellationReason?: string | null
  cancellationNote?: string | null
  cancelledAt?: string | null
  /** STUDENT when she did not show, COUNSELLOR when nobody checked her in. */
  missedByRole?: string | null
  /** Set the moment a counsellor records her absent — before the sweep closes the session. */
  markedAbsentAt?: string | null
  /** Set once she contests an absent mark. The server allows only one. */
  disputeRaisedAt?: string | null
}

/**
 * What the session actually IS, rather than what its row still says.
 *
 * <p>Marking a student absent sets `markedAbsentAt` and the attribution but deliberately
 * leaves `status` alone — the nightly sweep is what closes the session off. Until it runs the
 * raw row still reads CONFIRMED, and this page took that at face value: her counsellor had
 * already recorded her absent while she was still shown a live countdown, a Join button and a
 * Cancel that could only fail. Once the slot passed it got worse, not better — the session
 * fell through to "ENDED", which the history presents as one she attended.
 *
 * <p>A raised dispute is left alone: the server moves that row to UNDER_REVIEW itself, and of
 * the two that is the more specific truth.
 */
function effectiveStatus(a: any): string {
  const status = (a?.status || '').toUpperCase()
  if (a?.markedAbsentAt && (status === 'CONFIRMED' || status === 'ASSIGNED')) return 'MISSED'
  return a?.status
}

interface CounsellingRecord {
  booked: number
  completed: number
  cancelledByStudent: number
  cancelledByOthers: number
  missedByStudent: number
  missedByCounsellor: number
  moved: number
  /** Booked but not yet resolved — upcoming, live, or waiting on her to pick a new time. */
  stillOpen: number
}

/**
 * Her counselling record at a glance, above the history.
 *
 * <p>The list of cards alone answers "what happened to each session" but not "where do I
 * stand" — and the number that actually costs her something is how many endings were her
 * own, since only those count against the 2-miss allowance. Rows that are zero are left
 * out: a student who has never missed anything should not be shown a row of noughts telling
 * her about missing things.
 */
const RecordSummary: React.FC<{ record: CounsellingRecord; missesUsed: number }> = ({
  record,
  missesUsed,
}) => {
  const rows: { label: string; value: number; color: string }[] = [
    { label: 'Booked', value: record.booked, color: '#0C6B5A' },
    { label: 'Attended', value: record.completed, color: '#047857' },
    { label: 'Cancelled by you', value: record.cancelledByStudent, color: '#B45309' },
    { label: 'Missed', value: record.missedByStudent, color: '#B91C1C' },
    { label: 'Cancelled for you', value: record.cancelledByOthers, color: '#5C7A72' },
    { label: 'Counsellor unavailable', value: record.missedByCounsellor, color: '#5C7A72' },
    { label: 'Moved to a new time', value: record.moved, color: '#5C7A72' },
    { label: 'Still to happen', value: record.stillOpen, color: '#5C7A72' },
  ].filter((r) => r.value > 0 || r.label === 'Booked' || r.label === 'Attended')

  const allowanceUsedUp = missesUsed >= 2

  return (
    <div className='cl-card' style={{ marginBottom: 16, padding: '14px 18px' }}>
      {/* Title and standing on one line: "where do I stand" is the question the card exists
          to answer, so it belongs at the top next to the heading rather than as a paragraph
          underneath the numbers. */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap', marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
            textTransform: 'uppercase', color: 'var(--sp-muted, #5C7A72)',
          }}
        >
          Your counselling record
        </div>
        {missesUsed > 0 && (
          <span
            style={{
              fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
              whiteSpace: 'nowrap',
              background: allowanceUsedUp ? '#FEF2F2' : '#FFFBEB',
              border: `1px solid ${allowanceUsedUp ? '#FECACA' : '#FDE68A'}`,
              color: allowanceUsedUp ? '#991B1B' : '#92400E',
            }}
          >
            {missesUsed}/2 free changes used
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 26px' }}>
        {rows.map((r) => (
          <div key={r.label} style={{ minWidth: 88 }}>
            <div style={{ fontSize: 21, fontWeight: 700, color: r.color, lineHeight: 1.1 }}>
              {r.value}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--sp-muted, #5C7A72)', marginTop: 2 }}>
              {r.label}
            </div>
          </div>
        ))}
      </div>

      {/* One consequence line, and the exemption in small print — it matters, but it is a
          footnote, not the headline it was being rendered as. */}
      {missesUsed > 0 && (
        <div
          style={{
            marginTop: 12, paddingTop: 10,
            borderTop: '1px solid var(--sp-border, #D1E5DF)',
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 600, color: allowanceUsedUp ? '#991B1B' : '#92400E' }}>
            {allowanceUsedUp
              ? 'Sessions can no longer be moved. New bookings are chargeable.'
              : 'One free change left.'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--sp-muted, #5C7A72)', marginTop: 3 }}>
            Counsellor and team cancellations are not counted.
          </div>
        </div>
      )}
    </div>
  )
}

type TabKey = 'upcoming' | 'past'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past Sessions' },
]

function getTodayISODate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function hasSlotEnded(slot: Slot): boolean {
  if (!slot?.date || !slot?.endTime) return false
  const end = new Date(`${slot.date}T${slot.endTime}`)
  return !isNaN(end.getTime()) && end.getTime() <= Date.now()
}

const StudentCounsellingPage: React.FC = () => {
  const navigate = useNavigate()
  const { currentUser } = useAuth()

  // Phase 19 (19-02): student identity now sourced from useAuth().currentUser
  // (set by cookie-session /auth/me) instead of localStorage.studentPortalProfile.
  // studentPortalDashboard remains as a data cache (out of scope) — used only
  // as a fallback for userStudentId when currentUser hasn't surfaced it yet.
  const studentId: number = (() => {
    try {
      const u = (currentUser as any) || {}
      const dashboard = JSON.parse(localStorage.getItem('studentPortalDashboard') || '{}')
      return u.userStudentId || dashboard?.userStudentId || 0
    } catch {
      return 0
    }
  })()

  const userId: number = (() => {
    const u = (currentUser as any) || {}
    return u.userId || u.id || 0
  })()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAppointments = useCallback((opts?: { silent?: boolean }) => {
    if (!studentId) { setLoading(false); return }
    if (!opts?.silent) setLoading(true)
    getStudentAppointments(studentId)
      .then((res) => {
        const raw = Array.isArray(res.data) ? res.data : []
        const data: Appointment[] = raw.map((a: any) => ({
          appointmentId: a.id ?? a.appointmentId,
          status: effectiveStatus(a),
          reason: a.studentReason ?? a.reason,
          meetingLink: a.meetingLink,
          counsellorName: a.counsellor?.name ?? a.counsellorName,
          studentRescheduleCount: a.studentRescheduleCount ?? 0,
          forceShifted: a.forceShifted ?? false,
          shiftedFromStart: a.shiftedFromStart ?? null,
          cancelledByRole: a.cancelledByRole ?? null,
          cancellationReason: a.cancellationReason ?? null,
          cancellationNote: a.cancellationNote ?? null,
          cancelledAt: a.cancelledAt ?? null,
          missedByRole: a.missedByRole ?? null,
          markedAbsentAt: a.markedAbsentAt ?? null,
          disputeRaisedAt: a.disputeRaisedAt ?? null,
          slot: a.slot
            ? {
                date: a.slot.date,
                startTime: a.slot.startTime,
                endTime: a.slot.endTime,
                durationMinutes: a.slot.durationMinutes,
              }
            : { date: '', startTime: '', endTime: '', durationMinutes: 0 },
        }))
        setAppointments(data)
      })
      .catch(() => {
        if (!opts?.silent) setError('Failed to load appointments. Please try again.')
      })
      .finally(() => { if (!opts?.silent) setLoading(false) })
  }, [studentId])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])
  useRefreshInterval(() => fetchAppointments({ silent: true }), { skip: !studentId })

  const today = getTodayISODate()

  // A live session (IN_PROGRESS, after the counsellor verifies check-in) stays under
  // "Upcoming" alongside CONFIRMED ones until its slot ends.
  const isActiveStatus = (s: string) => s === 'CONFIRMED' || s === 'IN_PROGRESS'

  // Sessions that still need something FROM HER, even though their original slot has gone.
  // Neither matched a tab before, so both simply vanished from this page: AWAITING_RESCHEDULE
  // left her looking at "No upcoming sessions - book a session to get started" while she in
  // fact had one parked waiting for her to choose a time.
  const isActionNeededStatus = (s: string) => s === 'AWAITING_RESCHEDULE' || s === 'UNDER_REVIEW'

  const upcomingAppointments = appointments.filter(
    (a) =>
      isActionNeededStatus(a.status) ||
      (isActiveStatus(a.status) && a.slot?.date >= today && !hasSlotEnded(a.slot))
  )
  // Everything that has finished, whatever the ending. RESCHEDULED belongs here: it is the
  // original booking that was moved (usually because the counsellor dropped it), and leaving
  // it out of both tabs deleted that session from her history entirely — she could see the
  // replacement but no trace of the sitting that was cancelled on her.
  const pastAppointments = appointments
    .filter(
      (a) =>
        a.status === 'COMPLETED' ||
        a.status === 'CANCELLED' ||
        a.status === 'MISSED' ||
        a.status === 'RESCHEDULED' ||
        (isActiveStatus(a.status) && hasSlotEnded(a.slot))
    )
    .map((a) =>
      isActiveStatus(a.status) && hasSlotEnded(a.slot) ? { ...a, status: 'ENDED' } : a
    )
    // Newest first: the most recent ending is the one she is looking for.
    .sort((a, b) => {
      const av = `${a.slot?.date || ''}T${a.slot?.startTime || ''}`
      const bv = `${b.slot?.date || ''}T${b.slot?.startTime || ''}`
      if (av === bv) return b.appointmentId - a.appointmentId
      return av < bv ? 1 : -1
    })

  // Her counselling record, counted off the same list the cards are drawn from.
  //
  // Each session lands in exactly ONE bucket, so the buckets sum to "Booked". A session the
  // counsellor dropped is both "counsellor unavailable" and "moved to a new time", and
  // counting it under both would make the totals contradict each other on screen — the
  // reason it ended is the more useful of the two, so that wins.
  const isStudentRole = (r?: string | null) => (r || '').toUpperCase() === 'STUDENT'
  const isCounsellorRole = (r?: string | null) => (r || '').toUpperCase() === 'COUNSELLOR'

  const record = {
    booked: appointments.length,
    completed: 0,
    cancelledByStudent: 0,
    cancelledByOthers: 0,
    missedByStudent: 0,
    missedByCounsellor: 0,
    moved: 0,
    stillOpen: 0,
  }
  // Attribution decides the bucket, and it is checked BEFORE status — the same rule the
  // server's allowance query uses (`countStudentMissesForEntitlement` matches on
  // cancelledByRole / missedByRole and ignores status altogether).
  //
  // Rescheduling used to overwrite the record: a session she failed to attend became
  // RESCHEDULED, fell through to "moved to a new time", and her miss stopped being counted.
  // The page then offered a free change the server had already spent — she could miss twice
  // and still be told one was left. What happened to a session does not stop having happened
  // because a later session was booked.
  appointments.forEach((a) => {
    const s = (a.status || '').toUpperCase()
    if (isStudentRole(a.missedByRole)) record.missedByStudent += 1
    else if (isStudentRole(a.cancelledByRole)) record.cancelledByStudent += 1
    else if (isCounsellorRole(a.missedByRole)) record.missedByCounsellor += 1
    else if (isCounsellorRole(a.cancelledByRole)) record.cancelledByOthers += 1
    else if (s === 'COMPLETED') record.completed += 1
    // Ended that way with nobody recorded against it — the team, or the sweep.
    else if (s === 'CANCELLED') record.cancelledByOthers += 1
    else if (s === 'MISSED') record.missedByStudent += 1
    else if (s === 'RESCHEDULED') record.moved += 1
    else record.stillOpen += 1
  })

  // Only student-caused endings count against the 2-miss allowance — the whole point of
  // recording who did what is that a counsellor's cancellation must never cost her one.
  const missesUsed = record.cancelledByStudent + record.missedByStudent
  const changesLeft = Math.max(0, 2 - missesUsed)

  const handleReschedule = (appointmentId: number) => {
    navigate('/student/dashboard/counselling/book', { state: { rescheduleAppointmentId: appointmentId } })
  }

  // Cancel and dispute both refresh silently — the card's own state is derived from the
  // list, so re-fetching is what moves it to the Past tab / into "Under review".
  const handleChanged = () => fetchAppointments({ silent: true })

  const handleBookSession = () => {
    navigate('/student/dashboard/counselling/book')
  }

  const getTabCount = (key: TabKey): number => {
    if (key === 'upcoming') return upcomingAppointments.length
    if (key === 'past') return pastAppointments.length
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
              onReschedule={handleReschedule}
              onChanged={handleChanged}
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
            <div style={{ fontSize: 15, fontWeight: 600, color: '#455A64' }}>No past sessions yet</div>
            <div style={{ fontSize: 13, color: '#78909C', marginTop: 4 }}>
              {record.booked > 0
                ? 'Your booked session will be recorded here once it has taken place.'
                : 'Sessions appear here once they have taken place, been cancelled or been missed.'}
            </div>
          </div>
        )
      }
      return (
        <div>
          <RecordSummary record={record} missesUsed={missesUsed} />
          {pastAppointments.map((appt) => (
            <PastSessionCard
              key={appt.appointmentId}
              appointment={appt}
              // A missed session can be rescheduled while she still has a free change left;
              // this opens the same picker the Upcoming tab's Reschedule uses. With none left
              // the card points her at a fresh booking instead of ending in nothing.
              canReschedule={changesLeft > 0}
              onReschedule={handleReschedule}
              onBookSession={handleBookSession}
              onChanged={handleChanged}
            />
          ))}
        </div>
      )
    }

    return null
  }

  return (
    <>
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
      {studentId > 0 && <PendingRatingPrompt studentId={studentId} />}
    </>
  )
}

export default StudentCounsellingPage
