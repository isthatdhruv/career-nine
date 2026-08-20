import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../Counselling.css'
import PageHeader from '../../../components/PageHeader'
import { useRefreshInterval } from '../../../utils/useAutoRefresh'
import { getAllAppointments } from '../API/AppointmentAPI'
import { getAvailableSlots } from '../API/SlotAPI'
import {
  usePeriodFilter, PeriodFilterControl,
  localDateStr, shiftDate, daysBetween, fmtDateShort,
} from '../shared/PeriodFilter'

/**
 * Admin Counselling Dashboard.
 *
 * One operational screen for the whole counselling pipeline. Session metrics are computed
 * client-side from GET /api/counselling-appointment/getAll (eager slot/counsellor/student);
 * open-slot availability comes from GET /api/counselling-slot/available (best-effort). Both
 * refresh on the shared auto-refresh tick + on tab focus, so booked / awaiting counts stay live.
 *
 * Status lifecycle the funnel is built on:
 *   PENDING -> ASSIGNED -> CONFIRMED -> IN_PROGRESS -> COMPLETED
 * with MISSED (no-show), CANCELLED and RESCHEDULED as terminal branches. RESCHEDULED is the
 * *old* row left behind when a booking moves slots (the replacement is CONFIRMED), so it is
 * excluded from every "real session" count.
 */

// ── Appointment field readers (shape of GET /counselling-appointment/getAll) ──
function slotDate(a: any): string { return (a?.slot?.date || a?.date || '').slice(0, 10) }
function slotStartTime(a: any): string { return (a?.slot?.startTime || a?.startTime || '').slice(0, 5) }
function slotOnlyDate(s: any): string { return (s?.date || '').slice(0, 10) }
function slotStartAt(a: any): Date | null {
  const d = slotDate(a)
  const t = a?.slot?.startTime || a?.startTime
  if (!d || !t) return null
  const dt = new Date(`${d}T${String(t).slice(0, 8)}`)
  return isNaN(dt.getTime()) ? null : dt
}
function fmtTime(hhmm: string): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}
function studentName(a: any): string {
  return (
    a?.student?.studentInfo?.name || a?.studentContactName || a?.student?.name ||
    (a?.student?.userStudentId ? `Student #${a.student.userStudentId}` : 'Student')
  )
}
function counsellorName(a: any): string { return a?.counsellor?.name || 'Unassigned' }
function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}
// Stable accent colour per counsellor name (for avatar tints).
const AVATAR_COLORS = ['#0C6B5A', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#EC4899', '#6366F1']
function colorFor(name: string): string {
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

/** Title of the issues tile — its drill-down is by reason, not by status. */
const ISSUE_TILE = 'Students Facing Issues'

/**
 * Sessions that went wrong for the student, and why.
 *
 * These are the ones nobody would find by reading the funnel: the student did
 * everything right and still lost her session, or is disputing being marked absent.
 * They sit in statuses the eight overview tiles deliberately ignore, so without this
 * they are invisible on the dashboard — which is how a parked session can sit for
 * days with nobody chasing it.
 *
 * Returns null when the session is fine.
 */
function issueReason(a: any): string | null {
  const status = String(a?.status || '').toUpperCase()
  const reason = String(a?.cancellationReason || '').toUpperCase()
  const missedBy = String(a?.missedByRole || '').toUpperCase()

  // She says she was there; the absence mark is suspended until an admin decides.
  if (status === 'UNDER_REVIEW') return 'Marked absent — student disputes it'

  if (status === 'AWAITING_RESCHEDULE') {
    if (reason === 'COUNSELLOR_DEACTIVATED') return 'Counsellor deactivated — rebooking link sent'
    if (missedBy === 'COUNSELLOR') return 'Counsellor did not turn up'
    return 'Session parked — awaiting a new time'
  }

  // Cancelled because the counsellor was suspended and nobody else covers her
  // assessment: she was promised a call, so somebody has to make it.
  if (status === 'CANCELLED' && reason === 'COUNSELLOR_DEACTIVATED') {
    return 'Counsellor deactivated — needs follow-up'
  }

  return null
}

const ACTIVE_STATUSES = ['PENDING', 'ASSIGNED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'MISSED']

/**
 * The overview tiles, each defined once: its label, the statuses it counts, and
 * how to read its number off the window buckets. Clicking a tile lists exactly
 * the appointments matching `statuses`, so the number and the list can never
 * disagree.
 */
const OVERVIEW_TILES: {
  label: string; accent: string; icon: string; hint: string
  statuses: string[]
  count: (b: { pending: number; assigned: number; confirmed: number; inProgress: number; completed: number; missed: number; cancelled: number; booked: number }) => number
}[] = [
  { label: 'Booked', accent: '#0C6B5A', icon: 'bi-calendar-check', hint: 'Total sessions in this period', statuses: ACTIVE_STATUSES, count: (b) => b.booked },
  { label: 'Awaiting Assignment', accent: '#F59E0B', icon: 'bi-hourglass-split', hint: 'Need a counsellor', statuses: ['PENDING'], count: (b) => b.pending },
  { label: 'Awaiting Confirmation', accent: '#6366F1', icon: 'bi-person-check', hint: 'Counsellor not yet confirmed', statuses: ['ASSIGNED'], count: (b) => b.assigned },
  { label: 'Upcoming', accent: '#3B82F6', icon: 'bi-clock-history', hint: 'Confirmed, not started', statuses: ['CONFIRMED'], count: (b) => b.confirmed },
  { label: 'In Progress', accent: '#10B981', icon: 'bi-broadcast', hint: 'Happening now', statuses: ['IN_PROGRESS'], count: (b) => b.inProgress },
  { label: 'Completed', accent: '#059669', icon: 'bi-check2-circle', hint: 'Finished & attended', statuses: ['COMPLETED'], count: (b) => b.completed },
  { label: 'No-shows', accent: '#EF4444', icon: 'bi-person-x', hint: 'Booked but missed', statuses: ['MISSED'], count: (b) => b.missed },
  { label: 'Cancelled', accent: '#94A3B8', icon: 'bi-x-circle', hint: 'Cancelled in this period', statuses: ['CANCELLED'], count: (b) => b.cancelled },
]

type StageKey =
  | 'scheduled' | 'waiting' | 'in_progress' | 'completed'
  | 'student_absent' | 'counsellor_no_show' | 'cancelled' | 'under_review'

interface Stage { key: StageKey; label: string; note?: string }

function sessionStage(a: any, now: Date): Stage {
  const status = (a?.status || '').toUpperCase()
  const missedBy = (a?.missedByRole || '').toUpperCase()

  if (status === 'COMPLETED') {
    return { key: 'completed', label: 'Counselling happened' }
  }
  if (status === 'IN_PROGRESS') {
    return { key: 'in_progress', label: 'In progress', note: 'code verified' }
  }
  if (status === 'CANCELLED') {
    const by = (a?.cancelledByRole || '').toUpperCase()
    return {
      key: 'cancelled',
      label: by === 'STUDENT' ? 'Cancelled by student'
        : by === 'COUNSELLOR' ? 'Cancelled by counsellor'
          : by === 'ADMIN' ? 'Cancelled by admin' : 'Cancelled',
    }
  }
  if (status === 'UNDER_REVIEW') {
    return { key: 'under_review', label: 'Under review', note: 'attendance disputed' }
  }
  if (status === 'MISSED' || missedBy === 'STUDENT') {
    return { key: 'student_absent', label: 'Student absent' }
  }
  if (status === 'AWAITING_RESCHEDULE') {
    return missedBy === 'COUNSELLOR'
      ? { key: 'counsellor_no_show', label: 'Counsellor no-show' }
      : { key: 'counsellor_no_show', label: 'Awaiting new time' }
  }

  // Still open: has its start time passed without anyone checking in?
  const start = slotStartAt(a)
  if (start != null && start < now) {
    return { key: 'waiting', label: 'Waiting to start', note: 'no code entered yet' }
  }
  return { key: 'scheduled', label: 'Scheduled' }
}

/**
 * One colour per stage, matching the counsellor portal's badge palette so a given status
 * reads the same wherever it appears. Distinct hues throughout — "scheduled" and "in
 * progress" in particular must not look alike, since only the second means the student was
 * verified present.
 */
const STAGE_STYLE: Record<StageKey, React.CSSProperties> = {
  scheduled:          { background: '#DBEAFE', color: '#1E40AF' },
  waiting:            { background: '#FEF3C7', color: '#92400E' },
  in_progress:        { background: '#DCFCE7', color: '#15803D' },
  completed:          { background: '#CCFBF1', color: '#0F766E' },
  student_absent:     { background: '#FEE2E2', color: '#991B1B' },
  counsellor_no_show: { background: '#FFE4E6', color: '#9F1239' },
  cancelled:          { background: '#E5E7EB', color: '#4B5563' },
  under_review:       { background: '#EDE9FE', color: '#5B21B6' },
}

// ── Count-up: animates 0 -> value once when the card first mounts (after data load),
//    then snaps on later refreshes so the numbers don't re-animate every 20s. ──
function useCountUp(value: number, duration = 750): number {
  const [display, setDisplay] = useState(0)
  const animated = useRef(false)
  useEffect(() => {
    if (animated.current) { setDisplay(value); return }
    animated.current = true
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(value * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return display
}

// ── Building blocks ──
const StatCard: React.FC<{
  label: string; value: number; accent: string; icon: string; hint?: string; pulse?: boolean
  /** Opens the drill-down list for this bucket. Omitted / no rows ⇒ not clickable. */
  onClick?: () => void
}> = ({ label, value, accent, icon, hint, pulse, onClick }) => {
  const shown = useCountUp(value)
  // Nothing to drill into when the bucket is empty, so it stays a plain tile.
  const clickable = !!onClick && value > 0
  return (
    <div
      className={`cl-card cdash-stat${clickable ? ' cdash-stat-clickable' : ''}`}
      style={{ ['--accent' as any]: accent }}
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!() }
      } : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      title={clickable ? `View the ${value} session${value === 1 ? '' : 's'} in ${label}` : undefined}
    >
      <div className="cdash-stat-bar" />
      <div className="cdash-stat-top">
        <span className="cdash-stat-label">{label}</span>
        <span className={`cdash-stat-icon${pulse ? ' cdash-pulse' : ''}`}><i className={`bi ${icon}`} /></span>
      </div>
      <div className="cdash-stat-value">{shown}</div>
      {hint && <div className="cdash-stat-hint">{hint}</div>}
      {clickable && (
        <span className="cdash-stat-drill">
          View students <i className="bi bi-arrow-right-short" />
        </span>
      )}
    </div>
  )
}

/**
 * The students behind one stat card.
 *
 * Every tile in the overview is a filter over the same appointment list the page
 * already holds, so clicking one needs no request — it just shows the rows that
 * produced the number, with enough on each to act on it (who, with whom, when,
 * how to reach them).
 */
const DrillModal: React.FC<{
  title: string
  accent: string
  windowLabel: string
  rows: any[]
  now: Date
  onClose: () => void
  /** When given, the Mode column is replaced by what went wrong for that student. */
  reasonOf?: (a: any) => string | null
}> = ({ title, accent, windowLabel, rows, now, onClose, reasonOf }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    // The list can be long; don't let the page scroll behind it.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="cdash-modal-backdrop" onClick={onClose}>
      <div
        className="cdash-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cdash-modal-head" style={{ ['--accent' as any]: accent }}>
          <div>
            <div className="cdash-modal-title">{title}</div>
            <div className="cdash-modal-sub">
              {rows.length} session{rows.length === 1 ? '' : 's'} · {windowLabel}
            </div>
          </div>
          <button className="cdash-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div className="cdash-modal-body">
          {rows.length === 0 ? (
            <div className="cdash-empty">No sessions in this category.</div>
          ) : (
            <table className="cdash-table">
              <thead>
                <tr>
                  <th>Student</th><th>When</th><th>Counsellor</th>
                  <th>{reasonOf ? 'What went wrong' : 'Mode'}</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const stage = sessionStage(a, now)
                  const name = studentName(a)
                  return (
                    <tr key={a.id}>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                              background: colorFor(name), color: '#fff',
                              fontSize: 10, fontWeight: 700,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            {initials(name)}
                          </span>
                          <span>
                            {name}
                            {(a.studentContactEmail || a.studentContactPhone) && (
                              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                                {[a.studentContactEmail, a.studentContactPhone].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </span>
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {slotDate(a) ? fmtDateShort(slotDate(a)) : '—'}
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                          {fmtTime(slotStartTime(a)) || '—'}
                        </div>
                      </td>
                      <td>{counsellorName(a)}</td>
                      <td style={reasonOf ? undefined : { whiteSpace: 'nowrap' }}>
                        {reasonOf ? (reasonOf(a) || '—') : (a.mode === 'OFFLINE' ? 'In-person' : 'Online')}
                      </td>
                      <td>
                        <span
                          style={{
                            ...STAGE_STYLE[stage.key],
                            padding: '3px 10px', borderRadius: 12,
                            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                          }}
                        >
                          {stage.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

const Ring: React.FC<{ value: number; label: string; sub?: string; color: string; size?: number }> = ({
  value, label, sub, color, size = 132,
}) => {
  const stroke = 12
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const off = circ * (1 - pct / 100)
  return (
    <div className="cdash-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sp-border, #D1E5DF)" strokeWidth={stroke} opacity={0.45} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} className="cdash-ring-arc"
        />
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="cdash-ring-pct" fill={color}>{pct}%</text>
        <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle" className="cdash-ring-cap">{label}</text>
      </svg>
      {sub && <div className="cdash-ring-sub">{sub}</div>}
    </div>
  )
}

const SectionTitle: React.FC<{ icon: string; title: string; right?: React.ReactNode }> = ({ icon, title, right }) => (
  <div className="cdash-section-head">
    <h3 className="cdash-section-title"><span className="cdash-section-ic"><i className={`bi ${icon}`} /></span>{title}</h3>
    {right}
  </div>
)

const CounsellingDashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const [appts, setAppts] = useState<any[]>([])
  const [openSlots, setOpenSlots] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState<Date>(new Date())
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  // Which overview tile is drilled into, if any. Holds the tile's identity only —
  // the rows are derived from the same window data the tile counted.
  const [drill, setDrill] = useState<{ label: string; accent: string; statuses: string[] } | null>(null)

  const load = (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setRefreshing(true)
    const a = getAllAppointments()
      .then((res) => { setAppts(Array.isArray(res.data) ? res.data : []); setError(null) })
      .catch(() => { if (!opts?.silent) setError('Failed to load counselling data. Please refresh.') })
    // Open-slot availability is best-effort — needs counselling.slot.read; hide gracefully if denied.
    const s = getAvailableSlots(localDateStr())
      .then((res) => setOpenSlots(Array.isArray(res.data) ? res.data : []))
      .catch(() => setOpenSlots(null))
    Promise.allSettled([a, s]).then(() => {
      if (!opts?.silent) setLoading(false)
      setRefreshing(false)
      setLastUpdated(new Date())
    })
  }

  useEffect(() => { load() }, [])
  useRefreshInterval(() => load({ silent: true }), {})
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Period filter (All time / Today / Range) and the window every count below is
  // read through — shared with Manage Sessions so both screens agree on what a
  // period means.
  const allDates = useMemo(() => appts.map(slotDate).filter(Boolean), [appts])
  const filter = usePeriodFilter(allDates)
  const { mode, win, winLabel, inWin, isToday, today } = filter

  // ── Window funnel buckets ──
  const winBuckets = useMemo(() => {
    const onDay = appts.filter((a) => inWin(slotDate(a)))
    const by = (s: string) => onDay.filter((a) => a.status === s).length
    const pending = by('PENDING'), assigned = by('ASSIGNED'), confirmed = by('CONFIRMED')
    const inProgress = by('IN_PROGRESS'), completed = by('COMPLETED'), missed = by('MISSED'), cancelled = by('CANCELLED')
    const booked = pending + assigned + confirmed + inProgress + completed + missed
    return { onDay, pending, assigned, confirmed, inProgress, completed, missed, cancelled, booked }
  }, [appts, win])

  // ── Slot availability (open / bookable) ──
  const slotStats = useMemo(() => {
    if (!openSlots) return null
    const openToday = openSlots.filter((s) => slotOnlyDate(s) === today).length
    const open7 = openSlots.length
    const capacityToday = winBuckets.booked + openToday // booked today + still-open today
    const utilToday = capacityToday > 0 ? Math.round((winBuckets.booked / capacityToday) * 100) : 0
    return { openToday, open7, capacityToday, utilToday }
  }, [openSlots, today, winBuckets.booked])

  // ── Live operational lists (real "today" only) ──
  const live = useMemo(() => {
    const onToday = appts.filter((a) => slotDate(a) === today)
    const runningLate = onToday
      .filter((a) => a.status === 'CONFIRMED' && !a.checkinVerifiedAt)
      .filter((a) => { const s = slotStartAt(a); return s != null && s < now })
      .sort((a, b) => slotStartAt(a)!.getTime() - slotStartAt(b)!.getTime())
    const happeningNow = onToday.filter((a) => a.status === 'IN_PROGRESS')
    const nextUp = onToday
      .filter((a) => a.status === 'CONFIRMED' && !a.checkinVerifiedAt)
      .filter((a) => { const s = slotStartAt(a); return s != null && s >= now })
      .sort((a, b) => slotStartAt(a)!.getTime() - slotStartAt(b)!.getTime())
      .slice(0, 6)
    const unassigned = appts
      .filter((a) => a.status === 'PENDING')
      .sort((a, b) => (slotDate(a) + slotStartTime(a)).localeCompare(slotDate(b) + slotStartTime(b)))
    return { runningLate, happeningNow, nextUp, unassigned }
  }, [appts, today, now])

  // ── Today's roster: every student with counselling today, and where each one has got to ──
  //
  // The point of this is the live progression. A session sits at "Scheduled", becomes
  // "Waiting to start" once its time passes with nobody checked in, and flips to "In progress"
  // the moment the counsellor enters the student's code — which is what proves the student
  // actually turned up. The page already re-fetches on a timer, so the admin watches that
  // happen without doing anything.
  const todayRoster = useMemo(() => {
    return appts
      .filter((a) => slotDate(a) === today)
      .filter((a) => (a.status || '').toUpperCase() !== 'RESCHEDULED') // superseded by its replacement
      .map((a) => ({ a, stage: sessionStage(a, now) }))
      .sort((x, y) => slotStartTime(x.a).localeCompare(slotStartTime(y.a)))
  }, [appts, today, now])

  const todayCounts = useMemo(() => {
    const c = { total: todayRoster.length, happened: 0, live: 0, waiting: 0, notHappened: 0 }
    for (const { stage } of todayRoster) {
      if (stage.key === 'completed') c.happened++
      else if (stage.key === 'in_progress') c.live++
      else if (stage.key === 'waiting' || stage.key === 'scheduled') c.waiting++
      else c.notHappened++
    }
    return c
  }, [todayRoster])

  // ── Per-counsellor breakdown for the selected window ──
  const perCounsellor = useMemo(() => {
    const map = new Map<string, { name: string; booked: number; upcoming: number; inProgress: number; completed: number; missed: number }>()
    for (const a of winBuckets.onDay) {
      if (!ACTIVE_STATUSES.includes(a.status)) continue
      const key = a?.counsellor?.id != null ? String(a.counsellor.id) : 'unassigned'
      const name = a?.counsellor?.name || 'Unassigned'
      const row = map.get(key) || { name, booked: 0, upcoming: 0, inProgress: 0, completed: 0, missed: 0 }
      row.booked++
      if (a.status === 'CONFIRMED' || a.status === 'ASSIGNED') row.upcoming++
      else if (a.status === 'IN_PROGRESS') row.inProgress++
      else if (a.status === 'COMPLETED') row.completed++
      else if (a.status === 'MISSED') row.missed++
      map.set(key, row)
    }
    return Array.from(map.values()).sort((a, b) => b.booked - a.booked)
  }, [winBuckets])

  // Chart windows. In Today mode the charts keep their trailing windows — a single
  // bar, or one day of outcomes, says nothing. In All-time / Range mode they follow
  // the selected window, so the card titles below state which one is in use.
  const trendWin = useMemo(
    () => (mode === 'today' ? { from: shiftDate(today, -6), to: today } : win),
    [mode, today, win],
  )
  const ratesWin = useMemo(
    () => (mode === 'today' ? { from: shiftDate(today, -29), to: today } : win),
    [mode, today, win],
  )

  // ── Booking trend over the trend window ──
  // One bar per day, capped at 14 bars — longer windows are grouped into equal
  // spans so an all-time view stays readable instead of drawing hundreds of bars.
  const trend = useMemo(() => {
    const startMs = new Date(`${trendWin.from}T00:00:00`).getTime()
    const totalDays = Math.max(1, daysBetween(trendWin.from, trendWin.to) + 1)
    const MAX_BARS = 14
    const span = Math.ceil(totalDays / MAX_BARS)
    const days: { label: string; date: string; title: string; count: number; isSel: boolean }[] = []
    for (let i = 0; i < totalDays; i += span) {
      const s = localDateStr(new Date(startMs + i * 864e5))
      const e = localDateStr(new Date(startMs + Math.min(i + span - 1, totalDays - 1) * 864e5))
      const count = appts.filter((a) => {
        const d = slotDate(a)
        return d >= s && d <= e && ACTIVE_STATUSES.includes(a.status)
      }).length
      const d0 = new Date(`${s}T00:00:00`)
      days.push({
        date: s,
        label: span === 1
          ? (totalDays <= 7
            ? d0.toLocaleDateString(undefined, { weekday: 'short' })
            : d0.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))
          : d0.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        title: span === 1 ? `${s}: ${count}` : `${s} – ${e}: ${count}`,
        count,
        isSel: span === 1 && s === today,
      })
    }
    return { days, max: Math.max(1, ...days.map((d) => d.count)), grouped: span > 1, span }
  }, [appts, trendWin, today])

  // ── Outcome rates over the rates window ──
  const rates = useMemo(() => {
    const inRates = appts.filter((a) => {
      const d = slotDate(a)
      return d >= ratesWin.from && d <= ratesWin.to
    })
    const completed = inRates.filter((a) => a.status === 'COMPLETED').length
    const missed = inRates.filter((a) => a.status === 'MISSED').length
    const cancelled = inRates.filter((a) => a.status === 'CANCELLED').length
    const concluded = completed + missed
    const booked = inRates.filter((a) => ACTIVE_STATUSES.includes(a.status)).length
    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)
    return {
      completionRate: pct(completed, concluded), noShowRate: pct(missed, concluded),
      cancellationRate: pct(cancelled, booked + cancelled), completed, missed, cancelled, concluded,
    }
  }, [appts, ratesWin])

  // Students who came off worse than the funnel suggests: session lost to a
  // counsellor being deactivated or not turning up, or an absence they dispute.
  // Counted by STUDENT, not by session — one student with two spoiled sessions is
  // one person to apologise to, and the tile is about people, not rows.
  const issues = useMemo(() => {
    const rows = winBuckets.onDay.filter((a: any) => issueReason(a) !== null)
    const students = new Set<string>(
      rows.map((a: any) => String(a?.student?.userStudentId ?? a?.studentContactEmail ?? `appt-${a.id}`)),
    )
    return {
      rows: rows.sort((a: any, b: any) =>
        (slotDate(b) + slotStartTime(b)).localeCompare(slotDate(a) + slotStartTime(a))),
      studentCount: students.size,
    }
  }, [winBuckets])

  // Rows behind the drilled-into tile: the same window rows the tile counted,
  // narrowed to its statuses and read in the order they happen.
  const drillRows = useMemo(() => {
    if (!drill) return []
    return winBuckets.onDay
      .filter((a: any) => drill.statuses.includes(String(a.status || '').toUpperCase()))
      .sort((a: any, b: any) =>
        (slotDate(a) + slotStartTime(a)).localeCompare(slotDate(b) + slotStartTime(b)))
  }, [drill, winBuckets])

  const funnel = [
    { label: 'Booked', value: winBuckets.booked, color: '#0C6B5A' },
    { label: 'Confirmed', value: winBuckets.confirmed + winBuckets.inProgress + winBuckets.completed + winBuckets.missed, color: '#3B82F6' },
    { label: 'Started', value: winBuckets.inProgress + winBuckets.completed, color: '#8B5CF6' },
    { label: 'Completed', value: winBuckets.completed, color: '#10B981' },
  ]
  const funnelMax = Math.max(1, winBuckets.booked)
  const remaining = winBuckets.pending + winBuckets.assigned + winBuckets.confirmed
  const dayProgress = winBuckets.booked > 0 ? Math.round((winBuckets.completed / winBuckets.booked) * 100) : 0

  return (
    <div className="ph-page">
      <DashboardStyles />
      <PageHeader
        icon={<i className="bi bi-speedometer2" />}
        title="Counselling Dashboard"
        subtitle={
          <span>
            {winLabel}
            {mode === 'all' && appts.length > 0 && (
              <span className="cdash-sub-span"> ({fmtDateShort(win.from)} – {fmtDateShort(win.to)})</span>
            )}
            {' · '}<strong>{winBuckets.booked}</strong> booked · <strong>{winBuckets.completed}</strong> completed · <strong>{remaining}</strong> remaining
            {issues.studentCount > 0 && (
              <>
                {' · '}
                <span className="cdash-sub-alert">
                  <strong>{issues.studentCount}</strong> need{issues.studentCount === 1 ? 's' : ''} attention
                </span>
              </>
            )}
          </span>
        }
        actions={[
          { label: 'Create Slots', iconClass: 'bi-calendar-plus', onClick: () => navigate('/admin/counselling-slots'), variant: 'ghost' },
          { label: 'Counsellors', iconClass: 'bi-people', onClick: () => navigate('/admin/counsellors'), variant: 'ghost' },
        ]}
      >
        <div className="cdash-toolbar">
          <PeriodFilterControl filter={filter} />
          <div className="cdash-updated">
            {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
            <button className="cdash-refresh" onClick={() => load()} title="Refresh now" disabled={refreshing}>
              <i className={`bi bi-arrow-clockwise${refreshing ? ' cdash-spin' : ''}`} />
            </button>
          </div>
        </div>
      </PageHeader>

      {error && (
        <div className="cdash-alert">
          <span><i className="bi bi-exclamation-triangle-fill" /> {error}</span>
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {loading ? (
        <div className="cdash-grid" style={{ marginTop: 18 }}>
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="cl-card cdash-skel" />)}
        </div>
      ) : (
        <div className="cdash-fade">
          {/* ── Day at a glance ── */}
          <Eyebrow label={isToday ? "Today's overview" : `Overview · ${winLabel}`} />
          <div className="cdash-grid">
            {OVERVIEW_TILES.map((t) => (
              <StatCard
                key={t.label}
                label={t.label}
                value={t.count(winBuckets)}
                accent={t.accent}
                icon={t.icon}
                hint={t.hint}
                pulse={t.label === 'In Progress' && winBuckets.inProgress > 0}
                onClick={() => setDrill({ label: t.label, accent: t.accent, statuses: t.statuses })}
              />
            ))}
            {/* Ninth tile, and the only one counting people rather than sessions. */}
            <StatCard
              label="Students Facing Issues"
              value={issues.studentCount}
              accent="#B45309"
              icon="bi-exclamation-triangle"
              hint="Lost a session or disputing an absence"
              pulse={issues.studentCount > 0}
              onClick={() => setDrill({ label: ISSUE_TILE, accent: '#B45309', statuses: [] })}
            />
          </div>

          {/* ── Needs attention ──
              Sits above the pipeline on purpose: these students are the only thing on
              this page that needs a person to do something today, and they are invisible
              in every other figure because their statuses are excluded from the funnel. */}
          {issues.studentCount > 0 && (
            <>
              <Eyebrow label="Needs attention" accent />
              <div className="cl-card cdash-block cdash-attention">
                <SectionTitle
                  icon="bi-exclamation-triangle"
                  title={`Students who lost a session or dispute an absence · ${winLabel}`}
                  right={
                    <button
                      className="cdash-attention-all"
                      onClick={() => setDrill({ label: ISSUE_TILE, accent: '#B45309', statuses: [] })}
                    >
                      View all {issues.rows.length}
                    </button>
                  }
                />
                <div className="cdash-attention-list">
                  {issues.rows.slice(0, 5).map((a: any) => (
                    <div key={a.id} className="cdash-attention-row">
                      <span
                        className="cdash-attention-avatar"
                        style={{ background: colorFor(studentName(a)) }}
                      >
                        {initials(studentName(a))}
                      </span>
                      <div className="cdash-attention-who">
                        <div className="cdash-attention-name">{studentName(a)}</div>
                        <div className="cdash-attention-meta">
                          {[a.studentContactEmail, a.studentContactPhone].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </div>
                      <div className="cdash-attention-when">
                        {slotDate(a) ? fmtDateShort(slotDate(a)) : '—'}
                        <div className="cdash-attention-meta">{counsellorName(a)}</div>
                      </div>
                      <span className="cdash-attention-reason">{issueReason(a)}</span>
                    </div>
                  ))}
                </div>
                {issues.rows.length > 5 && (
                  <div className="cdash-attention-more">
                    and {issues.rows.length - 5} more
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Funnel + capacity ── */}
          <Eyebrow label="Pipeline & capacity" />
          <div className="cdash-row-2-1">
            <div className="cl-card cdash-block">
              <SectionTitle icon="bi-funnel" title="Session funnel" />
              <div className="cdash-funnel">
                {funnel.map((f, i) => (
                  <div key={f.label} className="cdash-funnel-row">
                    <span className="cdash-funnel-label">{f.label}</span>
                    <div className="cdash-funnel-track">
                      <div className="cdash-funnel-fill" style={{ width: `${(f.value / funnelMax) * 100}%`, background: `linear-gradient(90deg, ${f.color}, ${f.color}cc)` }}>
                        <span className="cdash-funnel-count">{f.value}</span>
                      </div>
                    </div>
                    <span className="cdash-funnel-pct">{i === 0 ? '100%' : `${Math.round((f.value / funnelMax) * 100)}%`}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="cl-card cdash-block cdash-capacity">
              <SectionTitle icon="bi-pie-chart" title={isToday ? 'Slots today' : 'Day progress'} />
              {isToday && slotStats ? (
                <>
                  <Ring value={slotStats.utilToday} label="booked" color="#0C6B5A"
                    sub={`${winBuckets.booked} booked · ${slotStats.openToday} open`} />
                  <div className="cdash-cap-stats">
                    <div className="cdash-cap-stat"><span>{slotStats.openToday}</span><label>Open today</label></div>
                    <div className="cdash-cap-stat"><span>{slotStats.open7}</span><label>Open · 7 days</label></div>
                  </div>
                </>
              ) : (
                <Ring value={dayProgress} label="done" color="#10B981"
                  sub={`${winBuckets.completed} of ${winBuckets.booked} completed`} />
              )}
            </div>
          </div>

          {/* ── Live: Needs attention (today only) ── */}
          {isToday && (
            <>
              <Eyebrow label="Live · needs attention" accent />
              <div className="cdash-grid-2x2">
                <LivePanel icon="bi-exclamation-triangle" title="Running late" pill="danger" count={live.runningLate.length}
                  empty="Nothing overdue — every confirmed session is on track."
                  rows={live.runningLate.map((a) => ({ a, meta: `${fmtTime(slotStartTime(a))} · ${counsellorName(a)}` as const, tag: 'not checked in' }))} />
                <LivePanel icon="bi-broadcast" title="Happening now" pill="ok" count={live.happeningNow.length}
                  empty="No sessions in progress right now."
                  rows={live.happeningNow.map((a) => ({ a, meta: `${fmtTime(slotStartTime(a))} · ${counsellorName(a)}` as const, tag: 'in progress' }))} />
                <LivePanel icon="bi-arrow-right-circle" title="Next up today" pill="neutral" count={live.nextUp.length}
                  empty="No more confirmed sessions later today."
                  rows={live.nextUp.map((a) => ({ a, meta: `${fmtTime(slotStartTime(a))} · ${counsellorName(a)}` as const }))} />
                <LivePanel icon="bi-inbox" title="Unassigned queue" pill="warn" count={live.unassigned.length}
                  empty="Every booking has a counsellor assigned."
                  rows={live.unassigned.slice(0, 6).map((a) => ({ a, meta: `${slotDate(a)} · ${fmtTime(slotStartTime(a))}` as const, tag: 'awaiting assignment' }))}
                  footer={live.unassigned.length > 6 ? `+${live.unassigned.length - 6} more in the queue` : undefined} />
              </div>
            </>
          )}

          {/* ── Today's roster: who has counselling today, and whether it happened ── */}
          {isToday && (
            <>
              <Eyebrow label="Counselling today" accent />
              <div className="cl-card cdash-block">
                <SectionTitle
                  icon="bi-clipboard-check"
                  title="Students with counselling today"
                  right={
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="cdash-count-pill">{todayCounts.total} booked</span>
                      <span style={{ ...STAGE_STYLE.completed, padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                        {todayCounts.happened} happened
                      </span>
                      {todayCounts.live > 0 && (
                        <span style={{ ...STAGE_STYLE.completed, padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                          {todayCounts.live} live
                        </span>
                      )}
                      {todayCounts.waiting > 0 && (
                        <span style={{ ...STAGE_STYLE.waiting, padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                          {todayCounts.waiting} to go
                        </span>
                      )}
                      {todayCounts.notHappened > 0 && (
                        <span style={{ ...STAGE_STYLE.student_absent, padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                          {todayCounts.notHappened} didn&apos;t happen
                        </span>
                      )}
                    </span>
                  }
                />
                {todayRoster.length === 0 ? (
                  <div className="cdash-empty">No counselling sessions booked for today.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="cdash-table">
                      <thead>
                        <tr>
                          <th>Time</th><th>Student</th><th>Counsellor</th><th>Mode</th>
                          <th>Status</th><th>Checked in</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todayRoster.map(({ a, stage }) => (
                          <tr key={a.id}>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtTime(slotStartTime(a))}</td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <span
                                  style={{
                                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                                    background: colorFor(studentName(a)), color: '#fff',
                                    fontSize: 10, fontWeight: 700,
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  {initials(studentName(a))}
                                </span>
                                {studentName(a)}
                              </span>
                            </td>
                            <td>{counsellorName(a)}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {a.mode === 'OFFLINE' ? 'In-person' : 'Online'}
                            </td>
                            <td>
                              <span
                                style={{
                                  ...STAGE_STYLE[stage.key],
                                  padding: '3px 10px', borderRadius: 12,
                                  fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                                }}
                              >
                                {stage.label}
                              </span>
                              {stage.note && (
                                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{stage.note}</div>
                              )}
                            </td>
                            {/* The moment the counsellor entered the student's code — the point at
                                which the session is proven to have started. */}
                            <td style={{ whiteSpace: 'nowrap', color: a.checkinVerifiedAt ? '#166534' : '#94A3B8' }}>
                              {a.checkinVerifiedAt
                                ? new Date(a.checkinVerifiedAt).toLocaleTimeString(undefined,
                                    { hour: 'numeric', minute: '2-digit' })
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Per-counsellor ── */}
          <Eyebrow label="Counsellor workload" />
          <div className="cl-card cdash-block">
            <SectionTitle icon="bi-people" title={`By counsellor · ${winLabel}`}
              right={<span className="cdash-count-pill">{perCounsellor.length}</span>} />
            {perCounsellor.length === 0 ? (
              <div className="cdash-empty">No sessions in this period yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="cdash-table">
                  <thead>
                    <tr><th>Counsellor</th><th>Load</th><th>Booked</th><th>Upcoming</th><th>In&nbsp;Progress</th><th>Completed</th><th>No-show</th></tr>
                  </thead>
                  <tbody>
                    {perCounsellor.map((r, i) => {
                      const maxBooked = perCounsellor[0]?.booked || 1
                      return (
                        <tr key={i}>
                          <td>
                            <div className="cdash-cellname">
                              <span className="cdash-avatar" style={{ background: colorFor(r.name) }}>{initials(r.name)}</span>
                              <span style={{ fontWeight: 600 }}>{r.name}</span>
                            </div>
                          </td>
                          <td style={{ width: 130 }}>
                            <div className="cdash-load-track"><div className="cdash-load-fill" style={{ width: `${(r.booked / maxBooked) * 100}%`, background: colorFor(r.name) }} /></div>
                          </td>
                          <td style={{ fontWeight: 700 }}>{r.booked}</td>
                          <td>{r.upcoming}</td>
                          <td>{r.inProgress}</td>
                          <td style={{ color: '#059669', fontWeight: 600 }}>{r.completed}</td>
                          <td style={{ color: r.missed ? '#EF4444' : 'inherit', fontWeight: r.missed ? 600 : 400 }}>{r.missed}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Trends + rates ── */}
          <Eyebrow label="Trends & outcomes" />
          <div className="cdash-two-col">
            <div className="cl-card cdash-block">
              <SectionTitle icon="bi-bar-chart" title={`Bookings · ${mode === 'today' ? 'last 7 days' : winLabel.toLowerCase()}`}
                right={trend.grouped ? <span className="cdash-count-pill">{trend.span}-day bars</span> : undefined} />
              <div className="cdash-bars">
                {trend.days.map((d) => (
                  <div key={d.date} className={`cdash-bar-col${d.isSel ? ' sel' : ''}`} title={d.title}>
                    <span className="cdash-bar-num">{d.count}</span>
                    <div className="cdash-bar-track"><div className="cdash-bar-fill" style={{ height: `${(d.count / trend.max) * 100}%` }} /></div>
                    <span className="cdash-bar-label">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="cl-card cdash-block">
              <SectionTitle icon="bi-graph-up-arrow" title={`Outcome rates · ${mode === 'today' ? 'last 30 days' : winLabel.toLowerCase()}`} />
              <div className="cdash-rates">
                <RateRow label="Completion rate" value={rates.completionRate} color="#10B981" sub={`${rates.completed} of ${rates.concluded} concluded`} />
                <RateRow label="No-show rate" value={rates.noShowRate} color="#EF4444" sub={`${rates.missed} of ${rates.concluded} concluded`} />
                <RateRow label="Cancellation rate" value={rates.cancellationRate} color="#94A3B8" sub={`${rates.cancelled} cancelled`} />
              </div>
            </div>
          </div>
        </div>
      )}

      {drill && (
        <DrillModal
          title={drill.label}
          accent={drill.accent}
          windowLabel={winLabel}
          rows={drill.label === ISSUE_TILE ? issues.rows : drillRows}
          now={now}
          reasonOf={drill.label === ISSUE_TILE ? issueReason : undefined}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  )
}

// ── Sub-components ──
type Row = { a: any; meta: string; tone: 'danger' | 'ok' | 'warn' | 'neutral'; tag?: string }

const Eyebrow: React.FC<{ label: string; accent?: boolean; right?: React.ReactNode }> = ({ label, accent, right }) => (
  <div className={`cdash-eyebrow${accent ? ' accent' : ''}`}>
    <span className="cdash-eyebrow-label">{label}</span>
    <span className="cdash-eyebrow-rule" />
    {right}
  </div>
)

const LivePanel: React.FC<{
  icon: string; title: string; pill: 'danger' | 'ok' | 'warn' | 'neutral'; count: number; empty: string; rows: Row[]; footer?: string
}> = ({ icon, title, pill, count, empty, rows, footer }) => (
  <div className="cl-card cdash-block cdash-panel">
    <SectionTitle icon={icon} title={title} right={<span className={`cdash-count-pill cdash-pill-${pill}`}>{count}</span>} />
    <div className="cdash-panel-body">
      {rows.length === 0 ? (
        <div className="cdash-empty cdash-empty-fill"><i className="bi bi-check2-circle" /> {empty}</div>
      ) : rows.map((r) => (
        <div key={r.a.id} className={`cdash-srow cdash-srow-${r.tone}`}>
          <div className="cdash-srow-left">
            <span className="cdash-avatar sm" style={{ background: colorFor(studentName(r.a)) }}>{initials(studentName(r.a))}</span>
            <div className="cdash-srow-main">
              <span className="cdash-srow-name">{studentName(r.a)}</span>
              <span className="cdash-srow-meta">{r.meta}</span>
            </div>
          </div>
          {r.tag && <span className={`cdash-tag cdash-tag-${r.tone}`}>{r.tag}</span>}
        </div>
      ))}
    </div>
    {footer && <div className="cdash-more">{footer}</div>}
  </div>
)

const RateRow: React.FC<{ label: string; value: number; color: string; sub: string }> = ({ label, value, color, sub }) => (
  <div className="cdash-rate">
    <div className="cdash-rate-head">
      <span className="cdash-rate-label">{label}</span>
      <span className="cdash-rate-val" style={{ color }}>{value}%</span>
    </div>
    <div className="cdash-rate-track"><div className="cdash-rate-fill" style={{ width: `${value}%`, background: color }} /></div>
    <span className="cdash-rate-sub">{sub}</span>
  </div>
)

const DashboardStyles: React.FC = () => (
  <style>{`
    /* Toolbar in the dark hero */
    .cdash-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .cdash-sub-span { opacity: 0.75; }
    .cdash-sub-alert { color: #FCD34D; }

    .cdash-attention { border-left: 3px solid #B45309; }
    .cdash-attention-all { background: rgba(180,83,9,0.10); color: #B45309; border: 1px solid rgba(180,83,9,0.25); border-radius: 8px; padding: 4px 12px; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; }
    .cdash-attention-all:hover { background: rgba(180,83,9,0.18); }
    .cdash-attention-list { display: flex; flex-direction: column; }
    .cdash-attention-row { display: flex; align-items: center; gap: 12px; padding: 10px 2px; border-bottom: 1px solid var(--sp-border, #D1E5DF); }
    .cdash-attention-row:last-child { border-bottom: none; }
    .cdash-attention-avatar { width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0; color: #fff; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
    .cdash-attention-who { flex: 1; min-width: 0; }
    .cdash-attention-name { font-size: 13.5px; font-weight: 600; color: var(--sp-text, #1A2B28); }
    .cdash-attention-meta { font-size: 11px; color: var(--sp-muted, #5C7A72); margin-top: 2px; }
    .cdash-attention-when { font-size: 12.5px; font-weight: 600; color: var(--sp-text, #1A2B28); text-align: right; white-space: nowrap; }
    .cdash-attention-reason { font-size: 11px; font-weight: 700; color: #92400E; background: #FEF3C7; border-radius: 999px; padding: 4px 11px; white-space: nowrap; flex-shrink: 0; }
    .cdash-attention-more { padding-top: 10px; font-size: 12px; color: var(--sp-muted, #5C7A72); }
    @media (max-width: 700px) {
      .cdash-attention-row { flex-wrap: wrap; }
      .cdash-attention-when { text-align: left; }
    }
    .cdash-chip { padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; transition: background .15s; }
    .cdash-chip:hover:not(:disabled) { background: rgba(255,255,255,0.2); }
    .cdash-chip:disabled { opacity: 0.45; cursor: default; }
    .cdash-date-input { padding: 7px 12px; border-radius: 8px; font-size: 13px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: #fff; }
    .cdash-date-input::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
    .cdash-updated { display: flex; align-items: center; gap: 10px; font-size: 12px; color: rgba(255,255,255,0.65); }
    .cdash-refresh { width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: #fff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 15px; }
    .cdash-refresh:hover:not(:disabled) { background: rgba(255,255,255,0.2); }
    .cdash-spin { animation: cdashSpin 0.8s linear infinite; }
    @keyframes cdashSpin { to { transform: rotate(360deg); } }

    .cdash-alert { margin: 16px 0; padding: 12px 16px; background: #FEE2E2; border: 1px solid #FECACA; border-radius: 10px; color: #991B1B; font-size: 14px; display: flex; align-items: center; justify-content: space-between; }
    .cdash-alert button { background: none; border: none; cursor: pointer; color: #991B1B; font-size: 18px; }

    .cdash-fade { animation: cdashFade .35s ease both; }
    @keyframes cdashFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

    /* KPI grid */
    .cdash-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 18px 0; }
    .cdash-stat { position: relative; padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; overflow: hidden; transition: transform .18s cubic-bezier(.16,1,.3,1), box-shadow .18s; }
    .cdash-stat:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(15,23,42,0.10); }
    .cdash-stat-clickable { cursor: pointer; }
    .cdash-stat-clickable:hover { box-shadow: 0 12px 28px rgba(15,23,42,0.14); border-color: var(--accent); }
    .cdash-stat-clickable:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .cdash-stat-drill { display: inline-flex; align-items: center; gap: 2px; font-size: 11px; font-weight: 700; color: var(--accent); opacity: 0; transform: translateY(-3px); transition: opacity .16s, transform .16s; }
    .cdash-stat-clickable:hover .cdash-stat-drill, .cdash-stat-clickable:focus-visible .cdash-stat-drill { opacity: 1; transform: translateY(0); }
    .cdash-stat-drill i { font-size: 15px; line-height: 1; }
    .cdash-stat-bar { position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--accent); }

    /* Drill-down: the students behind one tile */
    .cdash-modal-backdrop { position: fixed; inset: 0; z-index: 1050; background: rgba(15,23,42,0.55); display: flex; align-items: center; justify-content: center; padding: 24px; animation: cdash-fade .14s ease; }
    .cdash-modal { background: #fff; border-radius: 14px; width: 100%; max-width: 860px; max-height: 86vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 64px rgba(15,23,42,0.32); animation: cdash-rise .18s cubic-bezier(.16,1,.3,1); }
    .cdash-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 22px; border-bottom: 1px solid var(--sp-border, #D1E5DF); border-top: 3px solid var(--accent); }
    .cdash-modal-title { font-size: 17px; font-weight: 700; color: var(--sp-text, #1A2B28); }
    .cdash-modal-sub { font-size: 12.5px; color: var(--sp-muted, #5C7A72); margin-top: 3px; }
    .cdash-modal-close { background: transparent; border: none; font-size: 26px; line-height: 1; color: #94A3B8; cursor: pointer; padding: 0 4px; }
    .cdash-modal-close:hover { color: #475569; }
    .cdash-modal-body { padding: 6px 22px 20px; overflow-y: auto; }
    @keyframes cdash-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes cdash-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .cdash-stat::after { content: ''; position: absolute; right: -30px; top: -30px; width: 90px; height: 90px; border-radius: 50%; background: var(--accent); opacity: 0.05; }
    .cdash-stat-top { display: flex; align-items: center; justify-content: space-between; }
    .cdash-stat-label { font-size: 11.5px; font-weight: 700; color: var(--sp-muted, #5C7A72); text-transform: uppercase; letter-spacing: 0.04em; }
    .cdash-stat-icon { width: 30px; height: 30px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; background: color-mix(in srgb, var(--accent) 12%, white); color: var(--accent); }
    .cdash-stat-value { font-size: 32px; font-weight: 800; line-height: 1; letter-spacing: -0.02em; color: var(--accent); font-variant-numeric: tabular-nums; }
    .cdash-stat-hint { font-size: 11.5px; color: var(--sp-muted, #5C7A72); }
    .cdash-pulse { animation: cdashPulse 1.6s ease-in-out infinite; }
    @keyframes cdashPulse { 0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent); } 50% { box-shadow: 0 0 0 7px transparent; } }

    .cdash-skel { height: 104px; background: linear-gradient(100deg, #eef2f1 30%, #f7faf9 50%, #eef2f1 70%); background-size: 200% 100%; animation: cdashShimmer 1.2s infinite; border: none; }
    @keyframes cdashShimmer { to { background-position: -200% 0; } }

    .cdash-block { margin-bottom: 16px; }
    .cdash-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .cdash-section-title { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 15px; font-weight: 700; color: var(--sp-text, #1A2B28); }
    .cdash-section-ic { width: 26px; height: 26px; border-radius: 7px; background: var(--sp-primary-light, #E0F2EE); color: var(--sp-primary, #0C6B5A); display: inline-flex; align-items: center; justify-content: center; font-size: 13px; }

    .cdash-row-2-1 { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
    .cdash-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .cdash-grid-2x2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }

    .cdash-band { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sp-muted, #5C7A72); margin: 6px 2px 12px; }
    .cdash-band .bi { color: var(--sp-primary, #0C6B5A); }

    /* Funnel */
    .cdash-funnel { display: flex; flex-direction: column; gap: 13px; }
    .cdash-funnel-row { display: grid; grid-template-columns: 92px 1fr 48px; align-items: center; gap: 12px; }
    .cdash-funnel-label { font-size: 13px; font-weight: 600; color: var(--sp-muted, #5C7A72); }
    .cdash-funnel-track { background: var(--sp-bg, #F2F7F5); border-radius: 8px; height: 30px; overflow: hidden; }
    .cdash-funnel-fill { height: 100%; border-radius: 8px; min-width: 30px; display: flex; align-items: center; justify-content: flex-end; padding-right: 10px; transition: width 0.6s cubic-bezier(0.16,1,0.3,1); }
    .cdash-funnel-count { color: #fff; font-size: 13px; font-weight: 700; text-shadow: 0 1px 2px rgba(0,0,0,0.18); }
    .cdash-funnel-pct { font-size: 12px; font-weight: 700; color: var(--sp-muted, #5C7A72); text-align: right; font-variant-numeric: tabular-nums; }

    /* Section eyebrow labels — give each zone a clean, report-like header */
    .cdash-eyebrow { display: flex; align-items: center; gap: 14px; margin: 24px 2px 14px; }
    .cdash-eyebrow-label { font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--sp-muted, #5C7A72); white-space: nowrap; }
    .cdash-eyebrow-rule { flex: 1; height: 1px; background: var(--sp-border, #D1E5DF); }
    .cdash-eyebrow.accent .cdash-eyebrow-label { color: var(--sp-primary, #0C6B5A); }
    .cdash-eyebrow.accent .cdash-eyebrow-rule { background: linear-gradient(90deg, color-mix(in srgb, var(--sp-primary, #0C6B5A) 40%, transparent), transparent); }

    /* Uniform live panels — fixed min-height + internal scroll keeps the 2x2 grid tidy */
    .cdash-panel { display: flex; flex-direction: column; min-height: 240px; }
    .cdash-panel-body { flex: 1; overflow-y: auto; }
    .cdash-empty-fill { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }

    /* Capacity / ring */
    .cdash-capacity { display: flex; flex-direction: column; justify-content: center; }
    .cdash-ring { display: flex; flex-direction: column; align-items: center; gap: 6px; margin: 4px auto; }
    .cdash-ring-arc { transition: stroke-dashoffset 0.7s cubic-bezier(0.16,1,0.3,1); }
    .cdash-ring-pct { font-size: 26px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .cdash-ring-cap { font-size: 11px; fill: var(--sp-muted, #5C7A72); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    .cdash-ring-sub { font-size: 12px; color: var(--sp-muted, #5C7A72); text-align: center; }
    .cdash-cap-stats { display: flex; gap: 10px; margin-top: 14px; }
    .cdash-cap-stat { flex: 1; text-align: center; background: var(--sp-bg, #F2F7F5); border-radius: 10px; padding: 10px 6px; }
    .cdash-cap-stat span { display: block; font-size: 20px; font-weight: 800; color: var(--sp-text, #1A2B28); font-variant-numeric: tabular-nums; }
    .cdash-cap-stat label { font-size: 11px; color: var(--sp-muted, #5C7A72); font-weight: 600; }

    /* Session rows */
    .cdash-srow { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 11px; border-radius: 9px; margin-bottom: 7px; background: var(--sp-bg, #F2F7F5); border-left: 3px solid transparent; transition: transform .12s; }
    .cdash-srow:hover { transform: translateX(2px); }
    .cdash-srow-danger { border-left-color: #EF4444; background: #FEF2F2; }
    .cdash-srow-ok { border-left-color: #10B981; background: #ECFDF5; }
    .cdash-srow-warn { border-left-color: #F59E0B; background: #FFFBEB; }
    .cdash-srow-neutral { border-left-color: #3B82F6; }
    .cdash-srow-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .cdash-srow-main { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .cdash-srow-name { font-size: 13.5px; font-weight: 600; color: var(--sp-text, #1A2B28); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
    .cdash-srow-meta { font-size: 12px; color: var(--sp-muted, #5C7A72); }
    .cdash-tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; padding: 3px 8px; border-radius: 999px; white-space: nowrap; flex-shrink: 0; }
    .cdash-tag-danger { background: #FEE2E2; color: #991B1B; }
    .cdash-tag-ok { background: #D1FAE5; color: #065F46; }
    .cdash-tag-warn { background: #FEF3C7; color: #92400E; }
    .cdash-empty { font-size: 13px; color: var(--sp-muted, #5C7A72); padding: 20px 4px; text-align: center; }
    .cdash-empty .bi { color: var(--sp-primary, #0C6B5A); margin-right: 4px; }
    .cdash-more { font-size: 12px; color: var(--sp-muted, #5C7A72); padding-top: 6px; text-align: center; }

    .cdash-avatar { width: 30px; height: 30px; border-radius: 50%; color: #fff; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; letter-spacing: 0.02em; }
    .cdash-avatar.sm { width: 28px; height: 28px; }

    .cdash-count-pill { min-width: 24px; height: 22px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; background: var(--sp-bg, #F2F7F5); color: var(--sp-muted, #5C7A72); }
    .cdash-pill-danger { background: #FEE2E2; color: #991B1B; }
    .cdash-pill-ok { background: #D1FAE5; color: #065F46; }
    .cdash-pill-warn { background: #FEF3C7; color: #92400E; }

    /* Table */
    .cdash-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .cdash-table th { text-align: left; padding: 9px 12px; font-size: 11px; font-weight: 700; color: var(--sp-muted, #5C7A72); text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid var(--sp-border, #D1E5DF); }
    .cdash-table td { padding: 9px 12px; border-bottom: 1px solid var(--sp-border, #D1E5DF); color: var(--sp-text, #1A2B28); vertical-align: middle; }
    .cdash-table tbody tr { transition: background .12s; }
    .cdash-table tbody tr:hover { background: var(--sp-bg, #F2F7F5); }
    .cdash-cellname { display: flex; align-items: center; gap: 10px; }
    .cdash-load-track { background: var(--sp-bg, #F2F7F5); border-radius: 999px; height: 7px; overflow: hidden; }
    .cdash-load-fill { height: 100%; border-radius: 999px; transition: width .5s cubic-bezier(.16,1,.3,1); }

    /* Bars */
    .cdash-bars { display: flex; align-items: flex-end; gap: 10px; height: 156px; }
    .cdash-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; height: 100%; }
    .cdash-bar-num { font-size: 12px; font-weight: 700; color: var(--sp-text, #1A2B28); }
    .cdash-bar-track { flex: 1; width: 100%; display: flex; align-items: flex-end; }
    .cdash-bar-fill { width: 100%; min-height: 3px; border-radius: 6px 6px 0 0; background: linear-gradient(180deg, #15937C, #0C6B5A); transition: height 0.6s cubic-bezier(0.16,1,0.3,1); }
    .cdash-bar-col.sel .cdash-bar-fill { background: linear-gradient(180deg, #F59E0B, #d97706); }
    .cdash-bar-col.sel .cdash-bar-label { color: #b45309; font-weight: 700; }
    .cdash-bar-col:hover .cdash-bar-fill { filter: brightness(1.08); }
    .cdash-bar-label { font-size: 11px; color: var(--sp-muted, #5C7A72); font-weight: 600; }

    /* Rates */
    .cdash-rates { display: flex; flex-direction: column; gap: 17px; }
    .cdash-rate-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
    .cdash-rate-label { font-size: 13px; font-weight: 600; color: var(--sp-text, #1A2B28); }
    .cdash-rate-val { font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .cdash-rate-track { background: var(--sp-bg, #F2F7F5); border-radius: 999px; height: 9px; overflow: hidden; }
    .cdash-rate-fill { height: 100%; border-radius: 999px; transition: width 0.6s cubic-bezier(0.16,1,0.3,1); }
    .cdash-rate-sub { font-size: 11.5px; color: var(--sp-muted, #5C7A72); margin-top: 4px; display: block; }

    @media (max-width: 1100px) {
      .cdash-grid { grid-template-columns: repeat(2, 1fr); }
      .cdash-row-2-1 { grid-template-columns: 1fr; }
    }
    @media (max-width: 900px) { .cdash-two-col, .cdash-grid-2x2 { grid-template-columns: 1fr; } }
    @media (max-width: 560px) { .cdash-grid { grid-template-columns: 1fr; } }
  `}</style>
)

export default CounsellingDashboardPage
