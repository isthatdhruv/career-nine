import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import {
  RescheduleContext,
  RescheduleResult,
  RescheduleSlot,
  getRescheduleContext,
  confirmReschedule,
} from '../api-clients/counsellingRescheduleAPI'

// A distinct time on a day. Multiple counsellors free at the same time collapse into one chip
// with several candidate slot ids — we try them in order so a slot taken meanwhile falls back to
// another counsellor at the same time.
interface TimeOption {
  key: string
  startTime: string
  mode?: string
  candidateIds: number[]
}
interface DayGroup {
  date: string
  options: TimeOption[]
}

/**
 * Public, no-login self-service counselling reschedule. Opened from the tokenized link a student
 * receives when their counsellor becomes unavailable. Shows available slots (any counsellor); the
 * student picks one and the session is re-booked instantly.
 */
export default function CounsellingRescheduleUpdatePage() {
  const { token } = useParams<{ token: string }>()

  const [ctx, setCtx] = useState<RescheduleContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selected, setSelected] = useState<TimeOption | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [booked, setBooked] = useState<RescheduleResult | null>(null)

  const load = () => {
    if (!token) return
    getRescheduleContext(token)
      .then((res) => {
        setCtx(res.data)
        setLoading(false)
      })
      .catch((e) => {
        setError(readErr(e, 'This reschedule link is invalid or has expired.'))
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const dayGroups: DayGroup[] = useMemo(() => {
    const slots: RescheduleSlot[] = ctx?.slots || []
    const byDate = new Map<string, Map<string, TimeOption>>()
    for (const s of slots) {
      const tkey = `${s.startTime}|${s.mode || 'ONLINE'}`
      if (!byDate.has(s.date)) byDate.set(s.date, new Map())
      const day = byDate.get(s.date)!
      if (!day.has(tkey)) {
        day.set(tkey, { key: `${s.date}|${tkey}`, startTime: s.startTime, mode: s.mode, candidateIds: [] })
      }
      day.get(tkey)!.candidateIds.push(s.slotId)
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, times]) => ({
        date,
        options: Array.from(times.values()).sort((a, b) => a.startTime.localeCompare(b.startTime)),
      }))
  }, [ctx])

  const handleBook = async () => {
    if (!token || !selected) return
    setSubmitting(true)
    setError('')
    let lastErr: unknown = null
    for (const slotId of selected.candidateIds) {
      try {
        const res = await confirmReschedule(token, slotId)
        setBooked(res.data)
        setSubmitting(false)
        return
      } catch (e) {
        lastErr = e
      }
    }
    setSubmitting(false)
    setError(readErr(lastErr, 'That time was just taken. Please pick another slot.'))
    setSelected(null)
    load() // refresh availability
  }

  // ---- render states -------------------------------------------------------

  if (loading) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div className="spinner-border text-success" role="status" style={{ marginBottom: 12 }} />
          <div>Loading your session…</div>
        </div>
      </Shell>
    )
  }

  if (booked) {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
          <h2 style={h2}>Your session is rescheduled</h2>
          <div style={{ color: '#065f46', marginTop: 8, fontSize: '0.95rem' }}>
            {booked.date && (
              <div style={{ fontWeight: 600 }}>
                {formatDateHeader(booked.date)}
                {booked.startTime ? ` at ${formatTime(booked.startTime)}` : ''} ·{' '}
                {booked.mode === 'OFFLINE' ? 'In-person' : 'Online'}
              </div>
            )}
            {booked.mode !== 'OFFLINE' && booked.meetingLink && (
              <div style={{ marginTop: 10, wordBreak: 'break-all' }}>
                Meeting link:{' '}
                <a href={booked.meetingLink} target="_blank" rel="noreferrer">
                  {booked.meetingLink}
                </a>
              </div>
            )}
            {booked.mode === 'OFFLINE' && booked.location && (
              <div style={{ marginTop: 10 }}>Venue: {booked.location}</div>
            )}
            <div style={{ marginTop: 14, color: '#64748b', fontSize: '0.85rem' }}>
              A confirmation with the full details has been emailed to you.
            </div>
          </div>
        </div>
      </Shell>
    )
  }

  // Link no longer actionable (already rescheduled / handled elsewhere).
  if (ctx && !ctx.actionable) {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>ℹ️</div>
          <h2 style={h2}>This session is already sorted</h2>
          <div style={{ color: '#64748b', marginTop: 8 }}>
            It looks like this counselling session has already been rescheduled. If you think this is a
            mistake, please contact support.
          </div>
        </div>
      </Shell>
    )
  }

  if (error && !ctx) {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
          <h2 style={h2}>Link not valid</h2>
          <div style={{ color: '#b91c1c', marginTop: 8 }}>{error}</div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <h2 style={h2}>Reschedule your counselling session</h2>
      <div style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 6, marginBottom: 4 }}>
        {ctx?.counsellorName ? `${ctx.counsellorName} is` : 'Your counsellor is'} no longer available
        {ctx?.previousDate ? ` on ${formatDateHeader(ctx.previousDate)}` : ''}
        {ctx?.previousTime ? ` at ${formatTime(ctx.previousTime)}` : ''}. Pick a new time that suits you —
        your session is confirmed instantly.
      </div>

      {error && <div style={errBox}>{error}</div>}

      {dayGroups.length === 0 ? (
        <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: 16 }}>
          No slots are available right now. Please check back a little later, or contact support.
        </div>
      ) : (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {dayGroups.map((day) => (
            <div key={day.date}>
              <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.85rem', marginBottom: 8 }}>
                {formatDateHeader(day.date)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {day.options.map((opt) => {
                  const isSel = selected?.key === opt.key
                  const offline = opt.mode === 'OFFLINE'
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setSelected(opt)}
                      style={chipStyle(isSel)}
                    >
                      <div>{formatTime(opt.startTime)}</div>
                      <span style={modeBadge(offline, isSel)}>{offline ? 'In-person' : 'Online'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ marginTop: 22 }}>
          <button onClick={handleBook} disabled={submitting} style={confirmBtn}>
            {submitting
              ? 'Confirming…'
              : `Confirm ${formatTime(selected.startTime)} on ${formatDateHeader(
                  dayGroups.find((d) => d.options.some((o) => o.key === selected.key))?.date || '',
                )}`}
          </button>
        </div>
      )}
    </Shell>
  )
}

// ---- shell + helpers -------------------------------------------------------

function Shell({ children }: { children: ReactNode }) {
  return (
    <div style={pageBg}>
      <div style={card}>{children}</div>
    </div>
  )
}

function readErr(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: unknown; status?: number } }
  const d = err?.response?.data
  if (typeof d === 'string' && d) return d
  if (d && typeof d === 'object' && 'message' in d && typeof (d as any).message === 'string') {
    return (d as any).message
  }
  return fallback
}

function formatDateHeader(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}
function formatTime(t: string): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

const pageBg: CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #ecfdf5 0%, #f0f9ff 100%)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '48px 16px',
}
const card: CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
  padding: '28px 30px',
  width: '100%',
  maxWidth: 560,
}
const h2: CSSProperties = { fontWeight: 800, fontSize: '1.35rem', color: '#0f172a', margin: 0 }
const errBox: CSSProperties = {
  marginTop: 14,
  padding: '10px 14px',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 10,
  color: '#b91c1c',
  fontSize: '0.85rem',
}
const confirmBtn: CSSProperties = {
  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '12px 22px',
  fontSize: '0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 6px 18px rgba(16, 185, 129, 0.35)',
}

function chipStyle(selected: boolean): CSSProperties {
  return {
    background: selected ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#fff',
    color: selected ? '#fff' : '#0F172A',
    border: selected ? '1px solid transparent' : '1px solid #D1FAE5',
    padding: '0.55rem 0.85rem',
    borderRadius: 10,
    fontSize: '0.86rem',
    fontWeight: 600,
    cursor: 'pointer',
    minWidth: 120,
    textAlign: 'left',
    boxShadow: selected ? '0 6px 18px rgba(16, 185, 129, 0.35)' : 'none',
  }
}
function modeBadge(offline: boolean, selected: boolean): CSSProperties {
  return {
    display: 'inline-block',
    marginTop: 6,
    padding: '1px 7px',
    borderRadius: 999,
    fontSize: '0.66rem',
    fontWeight: 700,
    letterSpacing: '0.02em',
    background: selected ? 'rgba(255,255,255,0.25)' : offline ? '#FEF3C7' : '#D1FAE5',
    color: selected ? '#fff' : offline ? '#92400E' : '#065F46',
  }
}
