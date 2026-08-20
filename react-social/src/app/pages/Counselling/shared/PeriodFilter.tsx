import React, { useMemo, useState } from 'react'

/**
 * The period filter shared by the counselling admin screens: All time · Today ·
 * Range (from–to).
 *
 * The window is resolved in one place so a screen never has to special-case the
 * three modes — everything downstream filters on `win.from`/`win.to` (or calls
 * `inWin`), and the label is written once for headers and card titles.
 *
 * Rendered inside the dark PageHeader on both screens, hence the light-on-dark
 * palette below.
 */

export type RangeMode = 'all' | 'today' | 'range'

// ── Date helpers (local time — IST-correct, unlike toISOString which is UTC) ──

export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** yyyy-MM-dd `days` away from `iso` (negative = earlier). */
export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

/** Whole days from `a` to `b` (both yyyy-MM-dd). */
export function daysBetween(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()
  return Math.round(ms / 864e5)
}

export function fmtDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function fmtDateLong(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'short',
  })
}

export interface PeriodFilter {
  mode: RangeMode
  setMode: (m: RangeMode) => void
  rangeFrom: string
  rangeTo: string
  setRangeFrom: (v: string) => void
  setRangeTo: (v: string) => void
  /** Resolved window every consumer filters on. */
  win: { from: string; to: string }
  /** "Today" · "All time" · "1 Jun – 20 Aug" — for headers and card titles. */
  winLabel: string
  isToday: boolean
  today: string
  inWin: (isoDate: string) => boolean
}

/**
 * @param datesInData every date present in the data, in any order. Only used to
 *   bound the All-time window, so memoize it in the caller.
 */
export function usePeriodFilter(datesInData: string[], initialMode: RangeMode = 'today'): PeriodFilter {
  const today = localDateStr()
  const [mode, setMode] = useState<RangeMode>(initialMode)
  const [rangeFrom, setRangeFrom] = useState<string>(today)
  const [rangeTo, setRangeTo] = useState<string>(today)

  const win = useMemo<{ from: string; to: string }>(() => {
    if (mode === 'today') return { from: today, to: today }
    if (mode === 'range') {
      // A reversed pair is read as the range the person meant, not as empty.
      const a = rangeFrom || today
      const b = rangeTo || today
      return a <= b ? { from: a, to: b } : { from: b, to: a }
    }
    const sorted = datesInData.filter(Boolean).slice().sort()
    return { from: sorted[0] || today, to: sorted[sorted.length - 1] || today }
  }, [mode, rangeFrom, rangeTo, datesInData, today])

  const winLabel = useMemo(() => {
    if (mode === 'today') return 'Today'
    if (mode === 'all') return 'All time'
    return win.from === win.to ? fmtDateLong(win.from) : `${fmtDateShort(win.from)} – ${fmtDateShort(win.to)}`
  }, [mode, win])

  return {
    mode, setMode, rangeFrom, rangeTo, setRangeFrom, setRangeTo,
    win, winLabel, today,
    isToday: mode === 'today',
    inWin: (d: string) => !!d && d >= win.from && d <= win.to,
  }
}

const MODES: [RangeMode, string][] = [['all', 'All time'], ['today', 'Today'], ['range', 'Range']]

export const PeriodFilterControl: React.FC<{ filter: PeriodFilter }> = ({ filter }) => {
  const { mode, setMode, rangeFrom, rangeTo, setRangeFrom, setRangeTo, win, today } = filter
  // Slots are publishable a year ahead, so future dates are pickable too.
  const maxPickable = localDateStr(new Date(Date.now() + 365 * 864e5))
  const span = daysBetween(win.from, win.to) + 1

  return (
    <div className="cpf">
      <PeriodFilterStyles />
      <div className="cpf-seg" role="group" aria-label="Period">
        {MODES.map(([m, label]) => (
          <button
            key={m}
            type="button"
            className={`cpf-seg-btn${mode === m ? ' active' : ''}`}
            aria-pressed={mode === m}
            onClick={() => {
              // Seed the pickers from the window on screen, so switching to Range
              // starts from what the user was already looking at.
              if (m === 'range') { setRangeFrom(win.from); setRangeTo(win.to) }
              setMode(m)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'range' && (
        <div className="cpf-range">
          {/* Picking a From after the To (or a To before the From) drags the other
              end along, rather than blocking the pick. */}
          <input
            type="date" className="cpf-date" value={rangeFrom} max={maxPickable} aria-label="From date"
            onChange={(e) => {
              const v = e.target.value || today
              setRangeFrom(v)
              if (v > rangeTo) setRangeTo(v)
            }}
          />
          <span className="cpf-sep">to</span>
          <input
            type="date" className="cpf-date" value={rangeTo} max={maxPickable} aria-label="To date"
            onChange={(e) => {
              const v = e.target.value || today
              setRangeTo(v)
              if (v < rangeFrom) setRangeFrom(v)
            }}
          />
          <span className="cpf-days">{span} day{span === 1 ? '' : 's'}</span>
        </div>
      )}
    </div>
  )
}

const PeriodFilterStyles: React.FC = () => (
  <style>{`
    .cpf { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .cpf-seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 10px; background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.18); }
    .cpf-seg-btn { padding: 6px 14px; border-radius: 7px; font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.75); background: transparent; border: none; cursor: pointer; transition: background .15s, color .15s; white-space: nowrap; }
    .cpf-seg-btn:hover:not(.active) { background: rgba(255,255,255,0.12); color: #fff; }
    .cpf-seg-btn.active { background: #fff; color: #0C6B5A; box-shadow: 0 1px 3px rgba(0,0,0,0.18); }
    .cpf-range { display: inline-flex; align-items: center; gap: 7px; flex-wrap: wrap; }
    .cpf-date { padding: 7px 12px; border-radius: 8px; font-size: 13px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: #fff; }
    .cpf-date::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
    .cpf-sep { font-size: 12px; color: rgba(255,255,255,0.7); }
    .cpf-days { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.12); border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
  `}</style>
)

export default PeriodFilterControl
