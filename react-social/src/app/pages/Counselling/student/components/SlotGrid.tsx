import React from 'react'
import '../../Counselling.css'

interface Slot {
  slotId: number
  date: string
  startTime: string
  endTime: string
  durationMinutes: number
  counsellorName?: string
}

interface SlotGridProps {
  slots: Slot[]
  selectedSlotId: number | null
  onSelectSlot: (slot: Slot) => void
  weekStart: string
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function formatTime(timeStr: string): string {
  try {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
  } catch {
    return timeStr
  }
}

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  } catch {
    return dateStr
  }
}

/** Returns array of ISO date strings (Mon-Fri) starting from weekStart */
function getWeekDates(weekStart: string): string[] {
  const dates: string[] = []
  try {
    const start = new Date(weekStart + 'T00:00:00')
    for (let i = 0; i < 5; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      dates.push(`${year}-${month}-${day}`)
    }
  } catch {
    // return empty if date parsing fails
  }
  return dates
}

const SlotGrid: React.FC<SlotGridProps> = ({ slots, selectedSlotId, onSelectSlot, weekStart }) => {
  const weekDates = getWeekDates(weekStart)

  // Group slots by date
  const slotsByDate: Record<string, Slot[]> = {}
  slots.forEach((slot) => {
    if (!slotsByDate[slot.date]) {
      slotsByDate[slot.date] = []
    }
    slotsByDate[slot.date].push(slot)
  })

  if (weekDates.length === 0) {
    return (
      <div style={{ color: 'var(--sp-muted, #5C7A72)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
        No slots available for this week.
      </div>
    )
  }

  return (
    <div className='cl-slot-grid'>
      {weekDates.map((date, idx) => {
        const daySlots = slotsByDate[date] || []
        return (
          <div key={date} className='cl-slot-day'>
            <div className='cl-slot-day-label'>{DAY_NAMES[idx]}</div>
            <div style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', marginBottom: 8 }}>
              {formatShortDate(date)}
            </div>
            {daySlots.length === 0 ? (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--sp-muted, #5C7A72)',
                  padding: '8px 6px',
                  textAlign: 'center',
                  fontStyle: 'italic',
                }}
              >
                No slots
              </div>
            ) : (
              daySlots.map((slot) => (
                <div
                  key={slot.slotId}
                  className={`cl-slot-item${selectedSlotId === slot.slotId ? ' selected' : ''}`}
                  onClick={() => onSelectSlot(slot)}
                >
                  {formatTime(slot.startTime)}
                  {slot.durationMinutes > 0 && (
                    <div style={{ fontSize: 11, marginTop: 2, opacity: 0.8 }}>
                      {slot.durationMinutes}m
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}

export default SlotGrid
