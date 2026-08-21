import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../portal/PortalLayout'
import {
  getCounsellorAppointments,
  confirmAppointment,
  declineAppointment,
  counsellorCancelAppointment,
  markStudentAbsent,
  startSession,
  verifyCheckin,
  sendCheckinCode,
  getSessionReportLink,
  releaseReportToStudent,
} from '../Counselling/API/AppointmentAPI'
import NotificationBell from '../Counselling/shared/NotificationBell'
import { getCounsellorByUserId } from '../Counselling/API/CounsellorAPI'
import { useAuth } from '../../modules/auth'
import { useRefreshInterval } from '../../utils/useAutoRefresh'
import { COUNSELLOR_MENU_ITEMS } from './counsellorMenu'
import PageHeader from '../../components/PageHeader'
import './CounsellorPortal.css'

type FilterTab = 'all' | 'today' | 'upcoming' | 'completed' | 'pending' | 'cancelled'

/**
 * A counsellor may drop a session up to 4 hours before it starts, and not after.
 *
 * <p>Must match `app.counselling.counsellor-cancellation-window-hours` on the server, which
 * is what actually enforces it — this only stops the counsellor filling in the whole modal
 * before being refused. Deliberately longer than the student's 2 hours: the student needs
 * telling, and possibly re-placing with another counsellor.
 */
const CANCEL_CUTOFF_MS = 4 * 60 * 60 * 1000

/** Milliseconds until the session starts; Infinity when it has no usable time. */
function msUntilStart(appt: any, now: number): number {
  const d = buildSlotDate(appt)
  return d ? d.getTime() - now : Infinity
}

/** Minutes after the start before the student may be marked absent. Mirrors the server. */
const ABSENT_GRACE_MS = 10 * 60 * 1000

/**
 * How early the counsellor's time-based actions unlock — check-in and Join alike. Mirrors
 * `app.counselling.checkin-opens-before-minutes` on the server, which is what enforces it.
 */
const CHECKIN_OPENS_BEFORE_MS = 15 * 60 * 1000

/**
 * Check-in is only open around the session: from 10 minutes before the start until the slot
 * ends. Without this the code box could be opened days ahead, and a student marked present
 * for a session that had not happened.
 */
function checkinWindow(appt: any, now: number): { open: boolean; reason?: string } {
  const start = buildSlotDate(appt)
  if (!start) return { open: true }

  const startMs = start.getTime()
  const endStr = appt?.slot?.endTime
  const endMs = endStr
    ? new Date(`${appt.slot.date}T${String(endStr).slice(0, 8)}`).getTime()
    : startMs + 60 * 60 * 1000

  if (now < startMs - CHECKIN_OPENS_BEFORE_MS) {
    return {
      open: false,
      reason: 'Check-in opens 15 minutes before the scheduled start time.',
    }
  }
  if (now > endMs) {
    return { open: false, reason: 'This session has ended and can no longer be checked in.' }
  }
  return { open: true }
}

/**
 * When the counsellor may mark the student absent: from the grace point until the slot ends.
 *
 * <p>Not before, because the student deserves those minutes to arrive. Not after, because
 * marking retrospectively is exactly the abuse the server-side window exists to prevent —
 * once the slot has gone the session is the counsellor's own no-show.
 */
function absentWindow(appt: any, now: number): { open: boolean; reason?: string } {
  const start = buildSlotDate(appt)
  if (!start) return { open: false, reason: 'This session has no scheduled time.' }

  const startMs = start.getTime()
  const endStr = appt?.slot?.endTime
  const endMs = endStr
    ? new Date(`${appt.slot.date}T${String(endStr).slice(0, 8)}`).getTime()
    : startMs + 60 * 60 * 1000

  if (now < startMs + ABSENT_GRACE_MS) {
    const mins = Math.max(1, Math.ceil((startMs + ABSENT_GRACE_MS - now) / 60000))
    return {
      open: false,
      reason: `Too early — you can mark the student absent 10 minutes after the start time `
        + `(about ${mins} minute${mins === 1 ? '' : 's'} from now).`,
    }
  }
  if (now > endMs) {
    return { open: false, reason: 'This session has ended — it can no longer be marked.' }
  }
  return { open: true }
}

function formatWait(ms: number): string {
  if (ms <= 0) return 'it has already started'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `it starts in ${mins} minute${mins === 1 ? '' : 's'}`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return `it starts in ${hrs}h${rem ? ` ${rem}m` : ''}`
}

/** Distinct from the student's list — different people, different reasons. */
const COUNSELLOR_CANCEL_REASONS: { value: string; label: string }[] = [
  { value: 'UNWELL', label: 'Unwell' },
  { value: 'PERSONAL_EMERGENCY', label: 'Personal emergency' },
  { value: 'DOUBLE_BOOKED', label: 'Double-booked' },
  { value: 'OTHER', label: 'Other' },
]

/**
 * A session this counsellor cancelled, whatever became of it afterwards.
 *
 * <p>When the system finds a replacement the row is left RESCHEDULED, which the list would
 * otherwise hide entirely — so the counsellor would see a session simply vanish. Anything
 * they cancelled belongs in their Cancelled tab.
 */
function wasCancelledByCounsellor(appt: any): boolean {
  return (appt?.cancelledByRole || '').toUpperCase() === 'COUNSELLOR'
}

/**
 * One entry per status: what the badge says and how it looks.
 *
 * <p>Label and colour live together so they cannot drift apart, and every status gets its
 * OWN hue. Previously CONFIRMED and IN_PROGRESS were two near-identical greens — the very
 * pair a counsellor most needs to tell apart, since one means "not started" and the other
 * means "student verified present" — while MISSED, AWAITING_RESCHEDULE and UNDER_REVIEW all
 * fell through to the same grey.
 *
 * <p>The hues follow the session's life: grey/amber before it is settled, blue once it is
 * locked in, green while it is actually happening, teal when it is done, and warm colours
 * for the ways it can fail.
 *
 * <p>Each status carries THREE tones of its hue, which the feed rows lean on — the same
 * arrangement the counselling activity feed uses:
 *
 * <pre>
 *   fg   deep ink       the left rail, the icon glyph, the live dot, badge text
 *   bg   mid tint       the ground behind the icon glyph, badge fill
 *   wash near-white     the ground of a whole row
 * </pre>
 *
 * <p>The split matters: `bg` is sized for a small pill, and spread across an entire row it
 * shouts. `wash` is what a row can carry without drowning the text. Keeping `bg` under the
 * glyph is what makes the icon legible — a deep glyph needs a tinted ground, and floating it
 * on plain white is what washed the medallions out.
 */
const STATUS_META: Record<string, { label: string; bg: string; fg: string; wash: string }> = {
  PENDING:             { label: 'Awaiting assignment',        bg: '#E2E8F0', fg: '#334155', wash: '#F8FAFC' },
  ASSIGNED:            { label: 'Awaiting your confirmation', bg: '#FDE68A', fg: '#92400E', wash: '#FFFBEB' },
  CONFIRMED:           { label: 'Scheduled',                  bg: '#DBEAFE', fg: '#1D4ED8', wash: '#EFF6FF' },
  IN_PROGRESS:         { label: 'Student present',            bg: '#BBF7D0', fg: '#15803D', wash: '#F0FDF4' },
  COMPLETED:           { label: 'Completed',                  bg: '#CCFBF1', fg: '#0F766E', wash: '#F0FDFA' },
  ENDED:               { label: 'Completed',                  bg: '#CCFBF1', fg: '#0F766E', wash: '#F0FDFA' },
  MISSED:              { label: 'Student absent',             bg: '#FECACA', fg: '#B91C1C', wash: '#FEF2F2' },
  AWAITING_RESCHEDULE: { label: 'Awaiting new time',          bg: '#FED7AA', fg: '#C2410C', wash: '#FFF7ED' },
  UNDER_REVIEW:        { label: 'Under review',               bg: '#DDD6FE', fg: '#6D28D9', wash: '#F5F3FF' },
  CANCELLED:           { label: 'Cancelled',                  bg: '#E5E7EB', fg: '#4B5563', wash: '#F9FAFB' },
  DECLINED:            { label: 'Declined',                   bg: '#FECDD3', fg: '#BE123C', wash: '#FFF1F2' },
  RESCHEDULED:         { label: 'Moved to a new time',        bg: '#C7D2FE', fg: '#4338CA', wash: '#EEF2FF' },
}

/**
 * AWAITING_RESCHEDULE covers two quite different things, and the counsellor needs to know
 * which one they are looking at:
 *
 *   missedByRole = COUNSELLOR  ->  nobody checked in and the counsellor is the one who could
 *                                  have. This is their no-show, and reading "Awaiting new
 *                                  time" lets it look like an admin matter rather than
 *                                  something they did.
 *   otherwise                  ->  they cancelled it in advance and no cover was found; the
 *                                  student genuinely is picking a new time.
 */
function resolveMeta(appt: any): { label: string; bg: string; fg: string; wash: string } {
  const status = (appt?.status || '').toUpperCase()
  if (status === 'AWAITING_RESCHEDULE'
      && (appt?.missedByRole || '').toUpperCase() === 'COUNSELLOR') {
    return { label: 'You missed this', bg: '#FECDD3', fg: '#BE123C', wash: '#FFF1F2' }
  }
  // A recorded absence does not change the status — the nightly sweep closes the session
  // later. Until then the row would read "Scheduled" for a student already marked absent,
  // so the badge follows what the counsellor did, not what the sweep has yet to do.
  if (appt?.markedAbsentAt && (status === 'CONFIRMED' || status === 'ASSIGNED')) {
    return STATUS_META.MISSED
  }
  // A superseded row is still the record of how the first attempt went — who was absent,
  // who dropped it. A bare "Moved to a new time" would erase exactly the part worth
  // keeping, so the badge names the cause and the replacement is shown beneath it.
  if (status === 'RESCHEDULED') {
    const missedBy = (appt?.missedByRole || '').toUpperCase()
    const cancelledBy = (appt?.cancelledByRole || '').toUpperCase()
    if (missedBy === 'STUDENT') return { label: 'Student absent · moved', bg: '#FECACA', fg: '#B91C1C', wash: '#FEF2F2' }
    if (missedBy === 'COUNSELLOR') return { label: 'You missed this · moved', bg: '#FECDD3', fg: '#BE123C', wash: '#FFF1F2' }
    if (cancelledBy === 'COUNSELLOR') return { label: 'You cancelled · moved', bg: '#E5E7EB', fg: '#4B5563', wash: '#F9FAFB' }
    if (cancelledBy === 'STUDENT') return { label: 'Student cancelled · moved', bg: '#E5E7EB', fg: '#4B5563', wash: '#F9FAFB' }
  }
  return STATUS_META[status] || { label: status, bg: '#E5E7EB', fg: '#374151', wash: '#F9FAFB' }
}

function statusLabel(appt: any): string {
  return resolveMeta(appt).label
}

/**
 * The medallion at the head of each feed row. One glyph per status, so the shape
 * says what happened before the text is read — and the pairs that matter most are
 * the ones drawn least alike: a session waiting on the counsellor (person-check)
 * against one already locked in (calendar-check), and one running right now
 * (broadcast) against one finished (check).
 */
const STATUS_ICON: Record<string, string> = {
  PENDING:             'bi-hourglass-split',
  ASSIGNED:            'bi-person-check',
  CONFIRMED:           'bi-calendar-check',
  IN_PROGRESS:         'bi-broadcast',
  COMPLETED:           'bi-check2-circle',
  ENDED:               'bi-check2-circle',
  MISSED:              'bi-person-dash',
  AWAITING_RESCHEDULE: 'bi-arrow-repeat',
  UNDER_REVIEW:        'bi-eye',
  CANCELLED:           'bi-x-circle',
  DECLINED:            'bi-slash-circle',
  RESCHEDULED:         'bi-arrow-right-circle',
}

/**
 * Statuses where the session is still in play — the counsellor either owes it an
 * action or is in it. These rows get the tinted ground, the coloured rail and the
 * live dot; everything already settled stays plain white, so a long history tab
 * never competes with the two sessions happening today.
 */
const LIVE_STATUSES = new Set(['PENDING', 'ASSIGNED', 'CONFIRMED', 'IN_PROGRESS'])

/** Date only — "17 Jul 2026". Null when the booking has no usable slot. */
function formatSlotDay(appt: any): string | null {
  const d = buildSlotDate(appt)
  if (!d) return null
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Time only — "04:00 PM". Null when the booking has no usable slot. */
function formatSlotTime(appt: any): string | null {
  const d = buildSlotDate(appt)
  if (!d) return null
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

/** When the booking itself was made, for the small print. */
function formatBookedOn(value: any): string | null {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Build a Date from slot's date ("YYYY-MM-DD") + startTime ("HH:mm:ss"). */
function buildSlotDate(appt: any): Date | null {
  const date = appt?.slot?.date
  const time = appt?.slot?.startTime
  if (!date) return null
  const parts = (time || '00:00:00').split(':')
  const hh = (parts[0] || '00').padStart(2, '0')
  const mm = (parts[1] || '00').padStart(2, '0')
  const ss = (parts[2] || '00').padStart(2, '0')
  const d = new Date(`${date}T${hh}:${mm}:${ss}`)
  return isNaN(d.getTime()) ? null : d
}

function formatDateTime(appt: any): string {
  const d = buildSlotDate(appt)
  if (!d) return '—'
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStudentName(appt: any): string {
  if (!appt) return 'Unknown Student'
  if (appt.student) {
    return appt.student.studentInfo?.name || appt.student.name || 'Unknown Student'
  }
  return appt.studentName || 'Unknown Student'
}

/** Institute the booking student belongs to; null for B2C/individual students. */
function getInstituteName(appt: any): string | null {
  return appt?.student?.institute?.instituteName || null
}

function hasSlotEnded(appt: any): boolean {
  const date = appt?.slot?.date
  const endTime = appt?.slot?.endTime
  if (!date || !endTime) return false
  const end = new Date(`${date}T${endTime}`)
  return !isNaN(end.getTime()) && end.getTime() <= Date.now()
}

function isEndedConfirmed(appt: any): boolean {
  return (appt.status || '').toUpperCase() === 'CONFIRMED' && hasSlotEnded(appt)
}

function isToday(appt: any): boolean {
  const d = buildSlotDate(appt)
  if (!d) return false
  if (isEndedConfirmed(appt)) return false
  const now = new Date()
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  )
}

function isUpcoming(appt: any): boolean {
  const status = (appt.status || '').toUpperCase()
  if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'DECLINED') return false
  // Superseded rows are kept for the record but are not going to happen — its replacement
  // is the one the counsellor has to turn up to.
  if (status === 'RESCHEDULED') return false
  if (isEndedConfirmed(appt)) return false
  const d = buildSlotDate(appt)
  if (!d) return false
  return d > new Date()
}

const CounsellorAppointmentsPage: React.FC = () => {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [appointments, setAppointments] = useState<any[]>([])
  const [counsellorId, setCounsellorId] = useState<number | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [reportLoading, setReportLoading] = useState<number | null>(null)
  const [releaseLoading, setReleaseLoading] = useState<number | null>(null)
  // Locally remembered releases, so a row says "Sent" the moment it is sent rather than only
  // after the next poll brings a fresh reportReleasedAt back from the server.
  const [releasedAt, setReleasedAt] = useState<Record<number, string>>({})
  // Separate from `error`: a session whose student has not sat the assessment yet is a normal
  // state of affairs, not a failure, and colouring it red sends the counsellor chasing an admin.
  const [reportNotice, setReportNotice] = useState<{ text: string } | null>(null)
  const [declineModal, setDeclineModal] = useState<{ appointmentId: number } | null>(null)
  const [declineReason, setDeclineReason] = useState('')

  // The report the emails carry — resolved per session, not per student, so it is the one for
  // the assessment this booking was made against, and it prefers the PDF. When there is none,
  // the reason is worth saying: a student who has not sat the assessment and a report that has
  // not come through are different problems, and only the second is anyone's to chase.
  const handleViewReport = async (appt: any) => {
    setReportLoading(appt.id)
    setReportNotice(null)
    try {
      const res = await getSessionReportLink(appt.id)
      const { reportLink, status } = res.data || ({} as any)
      if (reportLink) {
        window.open(reportLink, '_blank', 'noopener,noreferrer')
        return
      }
      if (status === 'notCompleted') {
        setReportNotice({ text: 'This student has not finished the assessment yet, so there is no report to read.' })
      } else if (status === 'unavailable') {
        setReportNotice({ text: 'No assessment is linked to this session, so there is no report to open.' })
      } else {
        setReportNotice({
          text: "This student's report has not been generated yet. Please ask an administrator to generate it.",
        })
      }
    } catch {
      setError("Could not load the student's report.")
    } finally {
      setReportLoading(null)
    }
  }
  const [cancelModal, setCancelModal] = useState<{ appointmentId: number } | null>(null)
  const [cancelNote, setCancelNote] = useState('')
  // Re-render every 30s so Cancel disables itself when the 4-hour mark passes,
  // rather than staying clickable until the page is reloaded.
  const [nowMs, setNowMs] = useState<number>(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])
  const [outcomeMsg, setOutcomeMsg] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  // Session check-in (OTP) state, keyed by appointment id.
  const [otpSent, setOtpSent] = useState<Record<number, boolean>>({})
  const [otpCode, setOtpCode] = useState<Record<number, string>>({})
  const [checkinMsg, setCheckinMsg] = useState<Record<number, string>>({})
  // Separate from actionLoading so sending the code doesn't grey out Verify & start —
  // the counsellor may well be typing the code in as it goes out.
  const [codeSending, setCodeSending] = useState<Record<number, boolean>>({})

  const refreshAppointments = useCallback(() => {
    if (!counsellorId) return
    getCounsellorAppointments(counsellorId)
      .then((apptRes) => setAppointments(apptRes.data || []))
      .catch(() => {})
  }, [counsellorId])

  useRefreshInterval(refreshAppointments, { skip: !counsellorId })

  useEffect(() => {
    // Phase 19: derive userId/counsellorId from useAuth().currentUser.
    // The guard in CounsellorRoutes already enforces auth; this is defensive.
    // TODO(phase-19-followup): /auth/me does not expose counsellorId; resolve
    // it via getCounsellorByUserId until the backend payload includes it.
    if (!currentUser) {
      navigate('/counsellor/login', { replace: true })
      return
    }
    setUserId(currentUser.id)
    getCounsellorByUserId(currentUser.id)
      .then((res) => {
        const resolvedId = res.data?.id
        if (!resolvedId) {
          setError('Counsellor profile not found.')
          setLoading(false)
          return
        }
        setCounsellorId(resolvedId)
        return getCounsellorAppointments(resolvedId).then((apptRes) => {
          setAppointments(apptRes.data || [])
        })
      })
      .catch(() => setError('Counsellor profile not found.'))
      .finally(() => setLoading(false))
  }, [currentUser, navigate])

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

  /**
   * Cancels one session and lets the server re-place the student — same time with another
   * counsellor if possible, later the same day if not, and a self-service link to her if
   * nobody can take it. The outcome comes back so it can be shown rather than guessed at.
   */
  const handleCancel = async () => {
    if (!cancelModal || !userId) return
    if (!cancelReason) { setError('Please choose a reason.'); return }
    if (cancelReason === 'OTHER' && !cancelNote.trim()) {
      setError('Please give a brief reason.')
      return
    }
    setActionLoading(cancelModal.appointmentId)
    try {
      const res = await counsellorCancelAppointment(
        cancelModal.appointmentId, userId, cancelReason, cancelNote.trim() || undefined)
      setCancelModal(null)
      setCancelReason('')
      setCancelNote('')
      setError('')
      setOutcomeMsg(res?.data?.message || 'Session cancelled.')
      reload()
    } catch (e: any) {
      // Includes the 4-hour refusal, which the counsellor needs to read rather than retry.
      setError(e?.response?.data?.error || 'Failed to cancel appointment.')
    } finally {
      setActionLoading(null)
    }
  }

  /**
   * Records that the student did not appear. Only available from the alarm point until the
   * slot ends — and doing nothing at all is what makes it the counsellor's own no-show, which
   * is why the button sits alongside check-in rather than being tucked away.
   */
  const handleMarkAbsent = async (appointmentId: number) => {
    if (!userId) return
    setActionLoading(appointmentId)
    try {
      await markStudentAbsent(appointmentId, userId)
      setCheckinMsg((p) => ({ ...p, [appointmentId]: 'Student marked absent. They have been notified.' }))
      reload()
    } catch (e: any) {
      setCheckinMsg((p) => ({
        ...p,
        [appointmentId]: e?.response?.data?.error || 'Could not mark the student absent.',
      }))
    } finally {
      setActionLoading(null)
    }
  }

  /**
   * Send this student their report — the only way it reaches them on a tier where the report
   * is the counsellor's to release, since nothing was mailed when the assessment finished.
   *
   * Re-sendable on purpose. A student who lost the mail, or asks again after the session,
   * should not need an administrator, so the button stays live once it has been used and only
   * changes what it says.
   */
  const handleReleaseReport = async (appt: any) => {
    setReleaseLoading(appt.id)
    setReportNotice(null)
    try {
      const res = await releaseReportToStudent(appt.id)
      const to = res.data?.recipients?.join(', ')
      setReleasedAt((p) => ({ ...p, [appt.id]: res.data?.releasedAt || new Date().toISOString() }))
      setCheckinMsg((p) => ({
        ...p,
        [appt.id]: `✓ Report sent to ${to || 'the student'}.`,
      }))
      reload()
    } catch (e: any) {
      // The three refusals — no report yet, no address, session gone — are the counsellor's to
      // act on, so they are shown as written rather than flattened into a generic failure.
      setCheckinMsg((p) => ({
        ...p,
        [appt.id]: e?.response?.data?.error || 'Could not send the report. Please try again.',
      }))
    } finally {
      setReleaseLoading(null)
    }
  }

  // Session check-in: counsellor sends the OTP to the student, then enters the code
  // the student shares back. Verifying it is what actually starts the session
  // (status -> IN_PROGRESS) and unlocks the Teams meeting link.
  const handleStartSession = async (appointmentId: number, meetingLink?: string) => {
    setActionLoading(appointmentId)
    setCheckinMsg((p) => ({ ...p, [appointmentId]: '' }))
    // Online session: open the meeting room straight away (synchronously, within the
    // click gesture so it isn't popup-blocked) so the counsellor joins the call and
    // can collect the check-in code from the student on the call.
    if (meetingLink) {
      window.open(meetingLink, '_blank', 'noopener,noreferrer')
    }
    try {
      await startSession(appointmentId)
      setOtpSent((p) => ({ ...p, [appointmentId]: true }))
      setCheckinMsg((p) => ({
        ...p,
        [appointmentId]: meetingLink
          ? 'The meeting has opened in a new tab. Ask the student to read out the 4-digit code from their report, then enter it to start the session.'
          : 'Ask the student to read out the 4-digit code from their report to start the session.',
      }))
    } catch (e: any) {
      setCheckinMsg((p) => ({
        ...p,
        [appointmentId]: typeof e?.response?.data === 'string' ? e.response.data : 'Could not start the session.',
      }))
    } finally {
      setActionLoading(null)
    }
  }

  // "Send code to student" — for the student who never downloaded their report, or has it
  // on a laptop at home. Sends the same 4-digit code that is printed on it (nothing new is
  // generated) to their email and WhatsApp. The message names the channels that actually
  // accepted it: WhatsApp is a no-op until AiSensy is configured, and saying "sent" when
  // nothing was would leave the counsellor waiting on a message that never comes.
  const handleSendCode = async (appointmentId: number) => {
    setCodeSending((p) => ({ ...p, [appointmentId]: true }))
    setCheckinMsg((p) => ({ ...p, [appointmentId]: '' }))
    try {
      const res = await sendCheckinCode(appointmentId)
      const sent = (res.data?.channels || []).length > 0
      setCheckinMsg((p) => ({
        ...p,
        [appointmentId]: (sent ? '✓ ' : '') + (res.data?.message || 'Code sent to the student.'),
      }))
    } catch (e: any) {
      setCheckinMsg((p) => ({
        ...p,
        [appointmentId]: typeof e?.response?.data === 'string' ? e.response.data : 'Could not send the code.',
      }))
    } finally {
      setCodeSending((p) => ({ ...p, [appointmentId]: false }))
    }
  }

  const handleVerifyCheckin = async (appointmentId: number) => {
    const code = (otpCode[appointmentId] || '').trim()
    // The check-in code is the student's 4-digit counselling OTP, derived from their DOB
    // and printed on their report — not a freshly generated 6-digit one.
    if (code.length !== 4) {
      setCheckinMsg((p) => ({ ...p, [appointmentId]: 'Enter the 4-digit code the student read out.' }))
      return
    }
    setActionLoading(appointmentId)
    try {
      await verifyCheckin(appointmentId, code)
      setCheckinMsg((p) => ({ ...p, [appointmentId]: '✓ Checked in — session started.' }))
      setOtpSent((p) => ({ ...p, [appointmentId]: false }))
      setOtpCode((p) => ({ ...p, [appointmentId]: '' }))
      reload()
    } catch (e: any) {
      setCheckinMsg((p) => ({
        ...p,
        [appointmentId]: typeof e?.response?.data === 'string' ? e.response.data : 'Incorrect or expired code.',
      }))
    } finally {
      setActionLoading(null)
    }
  }

  // Stats — exclude RESCHEDULED (superseded by their replacement), except ones this
  // counsellor cancelled, which belong in their Cancelled tab rather than nowhere.
  const activeAppointments = appointments.filter(
    (a) => (a.status || '').toUpperCase() !== 'RESCHEDULED' || wasCancelledByCounsellor(a)
  )
  const today = activeAppointments.filter((a) => isToday(a))
  const thisWeek = activeAppointments.filter((a) => {
    const apptDate = buildSlotDate(a)
    if (!apptDate) return false
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 7)
    return apptDate >= startOfWeek && apptDate < endOfWeek
  })
  const pending = activeAppointments.filter(
    (a) => (a.status || '').toUpperCase() === 'ASSIGNED' || (a.status || '').toUpperCase() === 'PENDING'
  )
  const completed = activeAppointments.filter(
    (a) => (a.status || '').toUpperCase() === 'COMPLETED' || isEndedConfirmed(a)
  )
  const cancelled = activeAppointments.filter((a) => {
    const s = (a.status || '').toUpperCase()
    return s === 'CANCELLED' || s === 'DECLINED' || wasCancelledByCounsellor(a)
  })

  // Outcomes split by whose fault. Merged into one "no-shows" figure these are useless for
  // management: a counsellor with many student no-shows would look identical to one who
  // keeps not turning up.
  //
  // Counted over EVERY appointment, not just the active ones. An absence is a thing that
  // happened; booking a replacement does not unhappen it. Counting these off
  // `activeAppointments` meant a no-show silently left the tally the moment the session
  // was moved, which is the one case where the number most needs to hold.
  const studentNoShows = appointments.filter(
    (a) => (a.missedByRole || '').toUpperCase() === 'STUDENT'
  )
  const myNoShows = appointments.filter(
    (a) => (a.missedByRole || '').toUpperCase() === 'COUNSELLOR'
  )

  // Lookup: id -> appointment (used to show "Rescheduled from ..." under replacements)
  const appointmentsById = new Map<number, any>()
  appointments.forEach((a) => { if (a.id != null) appointmentsById.set(a.id, a) })

  // The reverse: original id -> whatever replaced it, so a superseded row can point
  // forward to where the session actually ended up.
  const replacementByOriginalId = new Map<number, any>()
  appointments.forEach((a) => {
    if (a.rescheduledFromAppointmentId != null) {
      replacementByOriginalId.set(a.rescheduledFromAppointmentId, a)
    }
  })

  // Every session stays on the list, superseded ones included.
  //
  // RESCHEDULED rows used to be hidden as "represented by their replacement", but they are
  // not: the replacement records the new time, while the original records what went wrong —
  // that the student did not turn up, that the counsellor dropped it, the reason given. The
  // moment a new time was booked that history vanished from the page. Both rows are kept and
  // linked to each other instead; the badge and the "Moved to …" line say which is which.
  const visible = appointments

  const filtered = visible
    .filter((a) => {
      const status = (a.status || '').toUpperCase()
      switch (activeTab) {
        case 'today':
          return isToday(a)
        case 'upcoming':
          return isUpcoming(a)
        case 'completed':
          return status === 'COMPLETED' || isEndedConfirmed(a)
        case 'pending':
          return status === 'ASSIGNED' || status === 'PENDING'
        case 'cancelled':
          // Same test as the tab's own count, `wasCancelledByCounsellor` included: a session
          // this counsellor dropped that was later covered sits at RESCHEDULED, so leaving it
          // out here made the tab read "Cancelled (1)" over an empty list.
          return status === 'CANCELLED' || status === 'DECLINED' || wasCancelledByCounsellor(a)
        default:
          return true
      }
    })
    .slice()
    // Order by the SESSION's own time, not by when the row was last written.
    //
    // Sorting on updatedAt meant every action reordered the list under the counsellor:
    // checking one in or marking one absent bumped it to the top, so a 12:45 session could
    // sit above a 2:15 one for no visible reason. Sorting on the slot keeps the list stable —
    // acting on a session leaves it exactly where it was.
    //
    // Forward-looking tabs read soonest-first (what's next); history reads newest-first.
    .sort((a, b) => {
      const ta = buildSlotDate(a)?.getTime() ?? 0
      const tb = buildSlotDate(b)?.getTime() ?? 0
      if (ta !== tb) {
        const soonestFirst = activeTab === 'today' || activeTab === 'upcoming' || activeTab === 'pending'
        return soonestFirst ? ta - tb : tb - ta
      }
      // Same start time — a stable tiebreak so equal rows never swap between renders.
      return (a.id ?? 0) - (b.id ?? 0)
    })

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'today', label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
    { key: 'pending', label: 'Pending' },
    { key: 'cancelled', label: `Cancelled${cancelled.length ? ` (${cancelled.length})` : ''}` },
  ]

  return (
    <PortalLayout
      title='Counsellor Dashboard'
      menuItems={COUNSELLOR_MENU_ITEMS}
      storageKeys={[]}
      loginPath='/counsellor/login'
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <PageHeader
          icon={<i className='bi bi-calendar-check' />}
          title='Appointments'
          subtitle='Manage your counselling appointments'
        />
        {/* The bell was mounted on exactly one page in the whole app, so cancellation and
            check-in notices were being written to the database and read by nobody. */}
        {userId ? <NotificationBell userId={userId} /> : null}
      </div>
      <div style={{ height: 12 }} />

      {outcomeMsg && (
        <div
          style={{
            background: '#ECFDF5', color: '#065F46', padding: '10px 16px',
            borderRadius: 8, fontSize: 13, marginBottom: 16,
            display: 'flex', justifyContent: 'space-between', gap: 12,
          }}
        >
          <span>{outcomeMsg}</span>
          <button
            onClick={() => setOutcomeMsg('')}
            style={{ background: 'none', border: 'none', color: '#065F46', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Outcomes split by fault — a session the student missed is a different fact from one
          the counsellor missed, and a single merged number hides which is which. */}
      {(studentNoShows.length > 0 || myNoShows.length > 0) && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12.5, color: '#475569' }}>
          <span>Student no-shows: <strong>{studentNoShows.length}</strong></span>
          <span>My no-shows: <strong>{myNoShows.length}</strong></span>
        </div>
      )}

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

      {reportNotice && (
        <div
          style={{
            background: '#EFF6FF',
            color: '#1E3A8A',
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {reportNotice.text}
          <button
            onClick={() => setReportNotice(null)}
            style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#1E3A8A', fontWeight: 700 }}
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
      <div className='cp-page-card'>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6B7A8D', fontSize: 14 }}>
          Loading appointments...
        </div>
      ) : filtered.length === 0 ? (
        <div className='cp-card' style={{ textAlign: 'center', padding: 40, color: '#6B7A8D', fontSize: 14 }}>
          No appointments found for this filter.
        </div>
      ) : (
        <div className='cp-appt-feed'>
          {filtered.map((appt) => {
            const rawStatus = (appt.status || '').toUpperCase()
            const ended = isEndedConfirmed(appt)
            const status = ended ? 'ENDED' : rawStatus
            const studentName = getStudentName(appt)
            const instituteName = getInstituteName(appt)
            const meetingLink = appt.meetingLink || appt.slot?.meetingLink || ''
            const reason = appt.studentReason || appt.reason || ''
            const rescheduledFrom = appt.rescheduledFromAppointmentId
              ? appointmentsById.get(appt.rescheduledFromAppointmentId)
              : null
            const rescheduledFromLabel = rescheduledFrom ? formatDateTime(rescheduledFrom) : null
            // The other direction, for the row that was superseded: where the session went.
            const movedTo = appt.id != null ? replacementByOriginalId.get(appt.id) : null
            const movedToLabel = movedTo ? formatDateTime(movedTo) : null

            const meta = resolveMeta(appt)
            // A recorded absence is settled even while the status still says CONFIRMED —
            // the sweep has simply not closed it yet, and the row wants nothing further.
            const live = LIVE_STATUSES.has(status) && !appt.markedAbsentAt
            const slotDay = formatSlotDay(appt)
            const slotTime = formatSlotTime(appt)
            const bookedOn = formatBookedOn(appt.createdAt)
            const mode = (appt.mode || appt.slot?.mode || '').toUpperCase()

            return (
              <article
                key={appt.id}
                className={`cp-appt-row${live ? ' cp-appt-row--live' : ''}`}
                style={{
                  '--appt-accent': meta.fg,
                  '--appt-tint': meta.bg,
                  '--appt-wash': meta.wash,
                } as React.CSSProperties}
              >
                <div className='cp-appt-icon'>
                  <i className={`bi ${STATUS_ICON[status] || 'bi-calendar-event'}`} />
                </div>

                <div className='cp-appt-main'>
                <div className='cp-appt-topline'>
                  {/* Left: Info */}
                  <div className='cp-appt-body'>
                    <div className='cp-appt-head'>
                      <span className='cp-appt-title'>{statusLabel(appt)}</span>
                      {live && <span className='cp-appt-dot' />}
                    </div>
                    <p className='cp-appt-desc'>
                      <strong>{studentName}</strong>
                      {slotDay
                        ? <> — session on {slotDay} at {slotTime}</>
                        : <> — no time scheduled yet</>}
                    </p>
                    <div className='cp-appt-meta'>
                      {bookedOn && (
                        <span title='When this session was booked'>
                          <i className='bi bi-clock-history' />
                          Booked {bookedOn}
                        </span>
                      )}
                      {instituteName && (
                        <span>
                          <i className='bi bi-building' />
                          {instituteName}
                        </span>
                      )}
                      {mode && (
                        <span>
                          <i className={mode === 'ONLINE' ? 'bi bi-camera-video' : 'bi bi-geo-alt'} />
                          {mode === 'ONLINE' ? 'Online' : 'In person'}
                        </span>
                      )}
                    </div>
                    {reason && (
                      <div className='cp-appt-note'>Reason: {reason}</div>
                    )}
                    {rescheduledFromLabel && (
                      <div className='cp-appt-trail' style={{ color: '#92400E' }}>
                        <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                          <polyline points='23 4 23 10 17 10' />
                          <path d='M20.49 15a9 9 0 1 1-2.12-9.36L23 10' />
                        </svg>
                        Rescheduled from {rescheduledFromLabel}
                      </div>
                    )}
                    {movedToLabel && (
                      <div className='cp-appt-trail' style={{ color: '#3730A3' }}>
                        <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                          <polyline points='23 4 23 10 17 10' />
                          <path d='M20.49 15a9 9 0 1 1-2.12-9.36L23 10' />
                        </svg>
                        Moved to {movedToLabel}
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className='cp-appt-actions'>
                    {/* Student's assessment report — always available so the counsellor
                        can prepare from the results that led to this booking. */}
                    <button
                      className='cp-action-btn'
                      onClick={() => handleViewReport(appt)}
                      disabled={reportLoading === appt.id}
                      title="Open the student's assessment report"
                    >
                      {reportLoading === appt.id ? 'Opening…' : '📄 Report'}
                    </button>
                    {/* Only on tiers that hold the report back. Everywhere else the student was
                        mailed it the moment it generated, and a button implying otherwise would
                        invite a duplicate. */}
                    {appt.counsellorReleaseReport && (() => {
                      const sentAt = releasedAt[appt.id] || appt.reportReleasedAt
                      return (
                        <button
                          className={`cp-action-btn${sentAt ? '' : ' cp-action-btn-primary'}`}
                          onClick={() => handleReleaseReport(appt)}
                          disabled={releaseLoading === appt.id}
                          title={sentAt
                            ? 'Already sent. Press again to send the student the same link once more.'
                            : "Email this student their assessment report. Nothing has been sent to them yet."}
                        >
                          {releaseLoading === appt.id
                            ? 'Sending…'
                            : sentAt ? '✓ Report sent — send again' : 'Send report'}
                        </button>
                      )
                    })()}
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

                    {/* Once the student is recorded absent there is nobody to check in, so the
                        join link, the code box and Verify & start all go — leaving them offers
                        an action that can only fail. Same condition the Mark absent button uses. */}
                    {status === 'CONFIRMED' && !appt.markedAbsentAt && (
                      <>
                        {/* Check-in gate: the session only opens once the counsellor enters the
                            4-digit code from the student's report. Nothing is sent — the student
                            already has it. */}
                        {!otpSent[appt.id] ? (() => {
                          const win = checkinWindow(appt, nowMs)
                          return (
                            <button
                              className='cp-action-btn cp-action-btn-primary'
                              onClick={() => handleStartSession(appt.id, meetingLink || undefined)}
                              disabled={actionLoading === appt.id || !win.open}
                              title={win.open ? undefined : win.reason}
                              style={win.open ? undefined : { opacity: 0.5, cursor: 'not-allowed' }}
                            >
                              {actionLoading === appt.id ? 'Starting…' : meetingLink ? 'Start session & join' : 'Start session'}
                            </button>
                          )
                        })() : (
                          <>
                            {/* Online: a reliable in-app way to (re)join the call if the
                                auto-opened tab was blocked or closed. */}
                            {meetingLink && (
                              <a
                                href={meetingLink}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='cp-action-btn cp-action-btn-primary'
                                style={{ textDecoration: 'none', display: 'inline-block' }}
                              >
                                Join Teams meeting
                              </a>
                            )}
                            <input
                              type='text'
                              inputMode='numeric'
                              maxLength={4}
                              placeholder='4-digit code'
                              value={otpCode[appt.id] || ''}
                              onChange={(e) =>
                                setOtpCode((p) => ({ ...p, [appt.id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))
                              }
                              style={{ padding: '6px 10px', border: '1px solid #DDE3EC', borderRadius: 8, fontSize: 13, width: 110 }}
                            />
                            <button
                              className='cp-action-btn cp-action-btn-primary'
                              onClick={() => handleVerifyCheckin(appt.id)}
                              disabled={actionLoading === appt.id}
                            >
                              Verify &amp; start
                            </button>
                          </>
                        )}
                        {/* The code is on the student's report and nowhere else, so a student who
                            can't open it cannot check in at all. This mails and WhatsApps it to
                            them. Always available on a confirmed session — before Start session as
                            well as after — because that is when a student says they can't find it. */}
                        <button
                          className='cp-action-btn'
                          onClick={() => handleSendCode(appt.id)}
                          disabled={!!codeSending[appt.id]}
                          title="Email and WhatsApp the student the 4-digit code from their report."
                        >
                          {codeSending[appt.id] ? 'Sending…' : 'Send code to student'}
                        </button>
                        {(() => {
                          const until = msUntilStart(appt, nowMs)
                          const tooLate = until < CANCEL_CUTOFF_MS
                          return (
                            <button
                              className='cp-action-btn'
                              onClick={() => {
                                setCancelModal({ appointmentId: appt.id })
                                setCancelReason('')
                                setCancelNote('')
                              }}
                              disabled={actionLoading === appt.id || tooLate}
                              title={tooLate
                                ? `Too late to cancel — ${formatWait(until)}. Sessions can only be cancelled more than 4 hours ahead. Call the office so the student can be told.`
                                : undefined}
                              style={{
                                color: tooLate ? '#9CA3AF' : '#DC2626',
                                borderColor: tooLate ? '#E5E7EB' : '#FCA5A5',
                                opacity: tooLate ? 0.5 : 1,
                                cursor: tooLate ? 'not-allowed' : 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          )
                        })()}
                      </>
                    )}

                    {/* The other way to close out a session. Doing neither is what records
                        it as the counsellor's own no-show, so it sits beside check-in. */}
                    {status === 'CONFIRMED' && !appt.checkinVerifiedAt && !appt.markedAbsentAt && (() => {
                      const win = absentWindow(appt, nowMs)
                      return (
                        <button
                          className='cp-action-btn'
                          onClick={() => handleMarkAbsent(appt.id)}
                          disabled={actionLoading === appt.id || !win.open}
                          title={win.open
                            ? 'Record that the student did not attend.'
                            : win.reason}
                          style={{
                            color: win.open ? '#B45309' : '#9CA3AF',
                            borderColor: win.open ? '#FCD34D' : '#E5E7EB',
                            opacity: win.open ? 1 : 0.5,
                            cursor: win.open ? 'pointer' : 'not-allowed',
                          }}
                        >
                          Mark absent
                        </button>
                      )
                    })()}

                    {status === 'IN_PROGRESS' && (
                      <>
                        {meetingLink && (() => {
                          const win = checkinWindow(appt, nowMs)
                          return (
                            <a
                              href={win.open ? meetingLink : undefined}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='cp-action-btn cp-action-btn-primary'
                              aria-disabled={!win.open}
                              title={win.open ? undefined : win.reason}
                              onClick={(e) => { if (!win.open) e.preventDefault() }}
                              style={{
                                textDecoration: 'none',
                                display: 'inline-block',
                                opacity: win.open ? 1 : 0.45,
                                cursor: win.open ? 'pointer' : 'not-allowed',
                              }}
                            >
                              Join Teams meeting
                            </a>
                          )
                        })()}
                        <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>● In progress</span>
                      </>
                    )}

                    {(status === 'COMPLETED' || status === 'ENDED') && (
                      <button
                        className='cp-action-btn'
                        onClick={() => navigate('/counsellor/notes')}
                      >
                        View Notes
                      </button>
                    )}
                  </div>
                </div>
                {checkinMsg[appt.id] && (() => {
                  // Quiet by default, dismissible, and sized to its text rather than the row.
                  // The earlier full-width block shouted at the counsellor on every action and
                  // then sat there with no way to clear it.
                  const msg = checkinMsg[appt.id]
                  const ok = msg.startsWith('✓')
                  const dismiss = () =>
                    setCheckinMsg((prev) => {
                      const next = { ...prev }
                      delete next[appt.id]
                      return next
                    })
                  return (
                    <div
                      role={ok ? undefined : 'alert'}
                      style={{
                        marginTop: 8,
                        padding: '5px 6px 5px 10px',
                        borderRadius: 6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        maxWidth: '100%',
                        fontSize: 12.5,
                        lineHeight: 1.45,
                        background: ok ? '#F0FDF4' : '#FFFBEB',
                        color: ok ? '#166534' : '#854D0E',
                      }}
                    >
                      <i
                        className={`bi ${ok ? 'bi-check-circle' : 'bi-info-circle'}`}
                        style={{ flexShrink: 0, fontSize: 12, opacity: 0.8 }}
                      />
                      <span>{msg.replace(/^✓\s*/, '')}</span>
                      <button
                        type='button'
                        onClick={dismiss}
                        aria-label='Dismiss'
                        title='Dismiss'
                        style={{
                          flexShrink: 0,
                          border: 'none',
                          background: 'transparent',
                          color: 'inherit',
                          opacity: 0.55,
                          cursor: 'pointer',
                          fontSize: 15,
                          lineHeight: 1,
                          padding: '0 4px',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )
                })()}
                </div>
              </article>
            )
          })}
        </div>
      )}
      </div>

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
            <p style={{ fontSize: 13, color: '#6B7A8D', marginBottom: 12 }}>
              We will try to find another counsellor at the same time, or later the same day.
              If nobody is available the student will be sent a link to pick a new time.
            </p>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid #DDE3EC',
                borderRadius: 8, fontSize: 13, marginBottom: 10, boxSizing: 'border-box',
              }}
            >
              <option value=''>Select a reason…</option>
              {COUNSELLOR_CANCEL_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <textarea
              value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
              placeholder={cancelReason === 'OTHER' ? 'Required — brief reason' : 'Anything else we should know (optional)'}
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
