import React, { useState, useEffect } from 'react'
import '../Counselling.css'

interface CountdownTimerProps {
  /** ISO date string, e.g. "2026-04-10" */
  targetDate: string
  /** Time string in "HH:mm" format, e.g. "10:00" */
  targetTime: string
  /**
   * The slot's end time, same format as targetTime. Optional, but supply it whenever it is
   * known: without it the timer cannot tell a session that is happening right now from one
   * that finished days ago, and calls both of them "Now".
   */
  endTime?: string
}

/** Normalize to HH:mm:ss regardless of input format (HH:mm or HH:mm:ss). */
function toEpoch(dateStr: string, timeStr: string): number {
  const parts = (timeStr || '00:00:00').split(':')
  const hh = (parts[0] || '00').padStart(2, '0')
  const mm = (parts[1] || '00').padStart(2, '0')
  const ss = (parts[2] || '00').padStart(2, '0')
  return new Date(`${dateStr}T${hh}:${mm}:${ss}`).getTime()
}

function computeTimeLeft(targetDate: string, targetTime: string, endTime?: string): string {
  const target = toEpoch(targetDate, targetTime)

  if (isNaN(target)) return '—'

  const now = Date.now()
  const diffMs = target - now

  if (diffMs <= 0) {
    // Past the start. "Now" is only true while the session is actually running — once the
    // slot has ended, a session left sitting in the upcoming list (parked, missed, awaiting
    // a verdict) would otherwise claim to be starting now, days after it did not happen.
    const end = endTime ? toEpoch(targetDate, endTime) : NaN
    if (!isNaN(end) && now >= end) return 'Passed'
    return 'Now'
  }

  const totalMinutes = Math.floor(diffMs / 60000)
  const totalHours = Math.floor(totalMinutes / 60)
  const totalDays = Math.floor(totalHours / 24)

  if (totalDays > 0) {
    const remainingHours = totalHours - totalDays * 24
    return remainingHours > 0 ? `${totalDays}d ${remainingHours}h` : `${totalDays}d`
  }

  if (totalHours > 0) {
    const remainingMinutes = totalMinutes - totalHours * 60
    return remainingMinutes > 0 ? `${totalHours}h ${remainingMinutes}m` : `${totalHours}h`
  }

  return `${totalMinutes}m`
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate, targetTime, endTime }) => {
  const [timeLeft, setTimeLeft] = useState<string>(() =>
    computeTimeLeft(targetDate, targetTime, endTime)
  )

  useEffect(() => {
    setTimeLeft(computeTimeLeft(targetDate, targetTime, endTime))

    const interval = setInterval(() => {
      setTimeLeft(computeTimeLeft(targetDate, targetTime, endTime))
    }, 60000)

    return () => clearInterval(interval)
  }, [targetDate, targetTime, endTime])

  return <span className="cl-countdown">{timeLeft}</span>
}

export default CountdownTimer
