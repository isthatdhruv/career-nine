import React, { useState, useEffect } from 'react'
import '../Counselling.css'

interface CountdownTimerProps {
  /** ISO date string, e.g. "2026-04-10" */
  targetDate: string
  /** Time string in "HH:mm" format, e.g. "10:00" */
  targetTime: string
}

function computeTimeLeft(targetDate: string, targetTime: string): string {
  // Normalize to HH:mm:ss regardless of input format (HH:mm or HH:mm:ss)
  const parts = (targetTime || '00:00:00').split(':')
  const hh = (parts[0] || '00').padStart(2, '0')
  const mm = (parts[1] || '00').padStart(2, '0')
  const ss = (parts[2] || '00').padStart(2, '0')
  const target = new Date(`${targetDate}T${hh}:${mm}:${ss}`)

  if (isNaN(target.getTime())) return '—'

  const now = new Date()
  const diffMs = target.getTime() - now.getTime()

  if (diffMs <= 0) return 'Now'

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

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate, targetTime }) => {
  const [timeLeft, setTimeLeft] = useState<string>(() => computeTimeLeft(targetDate, targetTime))

  useEffect(() => {
    setTimeLeft(computeTimeLeft(targetDate, targetTime))

    const interval = setInterval(() => {
      setTimeLeft(computeTimeLeft(targetDate, targetTime))
    }, 60000)

    return () => clearInterval(interval)
  }, [targetDate, targetTime])

  return <span className="cl-countdown">{timeLeft}</span>
}

export default CountdownTimer
