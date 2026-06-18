import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../Counselling.css'
import PageHeader from '../../../components/PageHeader'
import { useRefreshInterval } from '../../../utils/useAutoRefresh'
import { getAllAppointments } from '../API/AppointmentAPI'
import { getAvailableSlots } from '../API/SlotAPI'

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

// ── Date / time helpers (local time — IST-correct, unlike toISOString which is UTC) ──
function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
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

const ACTIVE_STATUSES = ['PENDING', 'ASSIGNED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'MISSED']

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
}> = ({ label, value, accent, icon, hint, pulse }) => {
  const shown = useCountUp(value)
  return (
    <div className="cl-card cdash-stat" style={{ ['--accent' as any]: accent }}>
      <div className="cdash-stat-bar" />
      <div className="cdash-stat-top">
        <span className="cdash-stat-label">{label}</span>
        <span className={`cdash-stat-icon${pulse ? ' cdash-pulse' : ''}`}><i className={`bi ${icon}`} /></span>
      </div>
      <div className="cdash-stat-value">{shown}</div>
      {hint && <div className="cdash-stat-hint">{hint}</div>}
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
  const [day, setDay] = useState<string>(localDateStr())
  const [now, setNow] = useState<Date>(new Date())
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

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

  const today = localDateStr(now)
  const isToday = day === today

  // ── Selected-day funnel buckets ──
  const dayBuckets = useMemo(() => {
    const onDay = appts.filter((a) => slotDate(a) === day)
    const by = (s: string) => onDay.filter((a) => a.status === s).length
    const pending = by('PENDING'), assigned = by('ASSIGNED'), confirmed = by('CONFIRMED')
    const inProgress = by('IN_PROGRESS'), completed = by('COMPLETED'), missed = by('MISSED'), cancelled = by('CANCELLED')
    const booked = pending + assigned + confirmed + inProgress + completed + missed
    return { onDay, pending, assigned, confirmed, inProgress, completed, missed, cancelled, booked }
  }, [appts, day])

  // ── Slot availability (open / bookable) ──
  const slotStats = useMemo(() => {
    if (!openSlots) return null
    const openToday = openSlots.filter((s) => slotOnlyDate(s) === today).length
    const open7 = openSlots.length
    const capacityToday = dayBuckets.booked + openToday // booked today + still-open today
    const utilToday = capacityToday > 0 ? Math.round((dayBuckets.booked / capacityToday) * 100) : 0
    return { openToday, open7, capacityToday, utilToday }
  }, [openSlots, today, dayBuckets.booked])

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

  // ── Per-counsellor breakdown for the selected day ──
  const perCounsellor = useMemo(() => {
    const map = new Map<string, { name: string; booked: number; upcoming: number; inProgress: number; completed: number; missed: number }>()
    for (const a of dayBuckets.onDay) {
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
  }, [dayBuckets])

  // ── 7-day booking trend (ending on the selected day) ──
  const trend = useMemo(() => {
    const base = new Date(`${day}T00:00:00`)
    const days: { label: string; date: string; count: number; isSel: boolean }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base); d.setDate(base.getDate() - i)
      const ds = localDateStr(d)
      const count = appts.filter((a) => slotDate(a) === ds && ACTIVE_STATUSES.includes(a.status)).length
      days.push({ label: d.toLocaleDateString(undefined, { weekday: 'short' }), date: ds, count, isSel: ds === day })
    }
    return { days, max: Math.max(1, ...days.map((d) => d.count)) }
  }, [appts, day])

  // ── 30-day outcome rates (sessions on/before the selected day) ──
  const rates = useMemo(() => {
    const end = new Date(`${day}T23:59:59`); const start = new Date(end); start.setDate(end.getDate() - 29)
    const startS = localDateStr(start), endS = day
    const win = appts.filter((a) => { const d = slotDate(a); return d >= startS && d <= endS })
    const completed = win.filter((a) => a.status === 'COMPLETED').length
    const missed = win.filter((a) => a.status === 'MISSED').length
    const cancelled = win.filter((a) => a.status === 'CANCELLED').length
    const concluded = completed + missed
    const booked = win.filter((a) => ACTIVE_STATUSES.includes(a.status)).length
    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)
    return {
      completionRate: pct(completed, concluded), noShowRate: pct(missed, concluded),
      cancellationRate: pct(cancelled, booked + cancelled), completed, missed, cancelled, concluded,
    }
  }, [appts, day])

  const funnel = [
    { label: 'Booked', value: dayBuckets.booked, color: '#0C6B5A' },
    { label: 'Confirmed', value: dayBuckets.confirmed + dayBuckets.inProgress + dayBuckets.completed + dayBuckets.missed, color: '#3B82F6' },
    { label: 'Started', value: dayBuckets.inProgress + dayBuckets.completed, color: '#8B5CF6' },
    { label: 'Completed', value: dayBuckets.completed, color: '#10B981' },
  ]
  const funnelMax = Math.max(1, dayBuckets.booked)
  const remaining = dayBuckets.pending + dayBuckets.assigned + dayBuckets.confirmed
  const dayProgress = dayBuckets.booked > 0 ? Math.round((dayBuckets.completed / dayBuckets.booked) * 100) : 0

  return (
    <div className="ph-page">
      <DashboardStyles />
      <PageHeader
        icon={<i className="bi bi-speedometer2" />}
        title="Counselling Dashboard"
        subtitle={
          <span>
            {isToday ? 'Today' : new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
            {' · '}<strong>{dayBuckets.booked}</strong> booked · <strong>{dayBuckets.completed}</strong> completed · <strong>{remaining}</strong> remaining
          </span>
        }
        actions={[
          { label: 'Create Slots', iconClass: 'bi-calendar-plus', onClick: () => navigate('/admin/counselling-slots'), variant: 'ghost' },
          { label: 'Counsellors', iconClass: 'bi-people', onClick: () => navigate('/admin/counsellors'), variant: 'ghost' },
        ]}
      >
        <div className="cdash-toolbar">
          <div className="cdash-daypick">
            <button className="cdash-chip" onClick={() => setDay(localDateStr())} disabled={isToday}>Today</button>
            <input type="date" value={day} className="cdash-date-input"
              max={localDateStr(new Date(Date.now() + 365 * 864e5))}
              onChange={(e) => setDay(e.target.value || localDateStr())} />
          </div>
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
          <Eyebrow label={isToday ? "Today's overview" : `Overview · ${new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`} />
          <div className="cdash-grid">
            <StatCard label="Booked" value={dayBuckets.booked} accent="#0C6B5A" icon="bi-calendar-check" hint="Total sessions for the day" />
            <StatCard label="Awaiting Assignment" value={dayBuckets.pending} accent="#F59E0B" icon="bi-hourglass-split" hint="Need a counsellor" />
            <StatCard label="Awaiting Confirmation" value={dayBuckets.assigned} accent="#6366F1" icon="bi-person-check" hint="Counsellor not yet confirmed" />
            <StatCard label="Upcoming" value={dayBuckets.confirmed} accent="#3B82F6" icon="bi-clock-history" hint="Confirmed, not started" />
            <StatCard label="In Progress" value={dayBuckets.inProgress} accent="#10B981" icon="bi-broadcast" hint="Happening now" pulse={dayBuckets.inProgress > 0} />
            <StatCard label="Completed" value={dayBuckets.completed} accent="#059669" icon="bi-check2-circle" hint="Finished & attended" />
            <StatCard label="No-shows" value={dayBuckets.missed} accent="#EF4444" icon="bi-person-x" hint="Booked but missed" />
            <StatCard label="Cancelled" value={dayBuckets.cancelled} accent="#94A3B8" icon="bi-x-circle" hint="Cancelled for the day" />
          </div>

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
                    sub={`${dayBuckets.booked} booked · ${slotStats.openToday} open`} />
                  <div className="cdash-cap-stats">
                    <div className="cdash-cap-stat"><span>{slotStats.openToday}</span><label>Open today</label></div>
                    <div className="cdash-cap-stat"><span>{slotStats.open7}</span><label>Open · 7 days</label></div>
                  </div>
                </>
              ) : (
                <Ring value={dayProgress} label="done" color="#10B981"
                  sub={`${dayBuckets.completed} of ${dayBuckets.booked} completed`} />
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
                  rows={live.runningLate.map((a) => ({ a, meta: `${fmtTime(slotStartTime(a))} · ${counsellorName(a)}`, tone: 'danger' as const, tag: 'not checked in' }))} />
                <LivePanel icon="bi-broadcast" title="Happening now" pill="ok" count={live.happeningNow.length}
                  empty="No sessions in progress right now."
                  rows={live.happeningNow.map((a) => ({ a, meta: `${fmtTime(slotStartTime(a))} · ${counsellorName(a)}`, tone: 'ok' as const, tag: 'in progress' }))} />
                <LivePanel icon="bi-arrow-right-circle" title="Next up today" pill="neutral" count={live.nextUp.length}
                  empty="No more confirmed sessions later today."
                  rows={live.nextUp.map((a) => ({ a, meta: `${fmtTime(slotStartTime(a))} · ${counsellorName(a)}`, tone: 'neutral' as const }))} />
                <LivePanel icon="bi-inbox" title="Unassigned queue" pill="warn" count={live.unassigned.length}
                  empty="Every booking has a counsellor assigned."
                  rows={live.unassigned.slice(0, 6).map((a) => ({ a, meta: `${slotDate(a)} · ${fmtTime(slotStartTime(a))}`, tone: 'warn' as const, tag: 'awaiting assignment' }))}
                  footer={live.unassigned.length > 6 ? `+${live.unassigned.length - 6} more in the queue` : undefined} />
              </div>
            </>
          )}

          {/* ── Per-counsellor ── */}
          <Eyebrow label="Counsellor workload" />
          <div className="cl-card cdash-block">
            <SectionTitle icon="bi-people" title={`By counsellor · ${isToday ? 'today' : day}`}
              right={<span className="cdash-count-pill">{perCounsellor.length}</span>} />
            {perCounsellor.length === 0 ? (
              <div className="cdash-empty">No sessions for this day yet.</div>
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
              <SectionTitle icon="bi-bar-chart" title="Bookings · last 7 days" />
              <div className="cdash-bars">
                {trend.days.map((d) => (
                  <div key={d.date} className={`cdash-bar-col${d.isSel ? ' sel' : ''}`} title={`${d.date}: ${d.count}`}>
                    <span className="cdash-bar-num">{d.count}</span>
                    <div className="cdash-bar-track"><div className="cdash-bar-fill" style={{ height: `${(d.count / trend.max) * 100}%` }} /></div>
                    <span className="cdash-bar-label">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="cl-card cdash-block">
              <SectionTitle icon="bi-graph-up-arrow" title="Outcome rates · last 30 days" />
              <div className="cdash-rates">
                <RateRow label="Completion rate" value={rates.completionRate} color="#10B981" sub={`${rates.completed} of ${rates.concluded} concluded`} />
                <RateRow label="No-show rate" value={rates.noShowRate} color="#EF4444" sub={`${rates.missed} of ${rates.concluded} concluded`} />
                <RateRow label="Cancellation rate" value={rates.cancellationRate} color="#94A3B8" sub={`${rates.cancelled} cancelled`} />
              </div>
            </div>
          </div>
        </div>
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
    .cdash-daypick { display: flex; gap: 8px; align-items: center; }
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
    .cdash-stat-bar { position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--accent); }
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
