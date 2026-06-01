import React, { useEffect, useMemo, useState } from 'react'
import { bookCounsellingSlot, listCounsellingSlots } from '../api-clients/campaignAPI'

type Slot = {
  slotId: number
  date: string         // yyyy-MM-dd
  startTime: string    // HH:mm:ss
  endTime: string      // HH:mm:ss
  durationMinutes: number
  counsellorName?: string
}

type BookingResult = {
  appointmentId: number
  status: string
  slotDate?: string
  slotStartTime?: string
  counsellorName?: string
  sessionsRemaining?: number
}

type Props = {
  accessToken: string
  entitlementId: number | string
  sessionsRemaining: number
  onClose: () => void
  /** Called with the server response after a successful booking. The host page
   *  uses this to refresh upgradeInfo and swap the CTA tile for a confirmation. */
  onBooked: (result: BookingResult) => void
}

// Format yyyy-MM-dd as e.g. "Tue, 17 Jun".
function formatDateHeader(iso: string): string {
  try {
    const d = new Date(`${iso}T00:00:00`)
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  } catch {
    return iso
  }
}

// Format HH:mm:ss as "h:mm AM/PM".
function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  if (Number.isNaN(h) || Number.isNaN(m)) return t
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

// yyyy-MM-dd today (local).
function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Add `n` days to a yyyy-MM-dd string, return yyyy-MM-dd.
function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const CounsellingSlotPicker: React.FC<Props> = ({
  accessToken,
  entitlementId,
  sessionsRemaining,
  onClose,
  onBooked,
}) => {
  const [from, setFrom] = useState<string>(todayIso())
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [loadError, setLoadError] = useState<string>('')
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null)
  const [reason, setReason] = useState<string>('')
  const [booking, setBooking] = useState<boolean>(false)
  const [bookError, setBookError] = useState<string>('')

  // Group slots by date for rendering. Preserves the server's ordering within a date.
  const grouped = useMemo(() => {
    const map = new Map<string, Slot[]>()
    for (const s of slots) {
      if (!map.has(s.date)) map.set(s.date, [])
      map.get(s.date)!.push(s)
    }
    return Array.from(map.entries())
  }, [slots])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    listCounsellingSlots({ token: accessToken, entitlementId, from })
      .then((res) => {
        if (cancelled) return
        const data = res.data as { slots: Slot[] }
        setSlots(data.slots || [])
      })
      .catch((err: any) => {
        if (cancelled) return
        const body = err?.response?.data
        setLoadError(typeof body === 'string' ? body : 'Could not load counselling slots.')
        setSlots([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, entitlementId, from])

  const handleConfirm = async () => {
    if (selectedSlotId == null || booking) return
    setBooking(true)
    setBookError('')
    try {
      const res = await bookCounsellingSlot({
        token: accessToken,
        entitlementId,
        slotId: selectedSlotId,
        reason: reason.trim() || undefined,
      })
      onBooked(res.data as BookingResult)
    } catch (err: any) {
      const body = err?.response?.data
      setBookError(typeof body === 'string' ? body : 'Could not confirm your booking. Please try again.')
    } finally {
      setBooking(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            color: '#fff',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
              Book a Counselling Session
            </h2>
            <div style={{ fontSize: '0.82rem', opacity: 0.9, marginTop: 2 }}>
              {sessionsRemaining} session{sessionsRemaining === 1 ? '' : 's'} remaining
            </div>
          </div>
          <button
            type='button'
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '1.5rem',
              lineHeight: 1,
              cursor: 'pointer',
              padding: 4,
            }}
            aria-label='Close'
          >
            ×
          </button>
        </div>

        {/* Date navigation */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <button
            type='button'
            onClick={() => setFrom(shiftIso(from, -7))}
            disabled={from <= todayIso()}
            style={navBtnStyle(from <= todayIso())}
          >
            ← Earlier
          </button>
          <div style={{ fontSize: '0.85rem', color: '#475569' }}>
            From <strong>{formatDateHeader(from)}</strong>
          </div>
          <button
            type='button'
            onClick={() => setFrom(shiftIso(from, 7))}
            style={navBtnStyle(false)}
          >
            Later →
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
          {loading && (
            <div style={{ textAlign: 'center', color: '#64748B', padding: '2rem 0' }}>
              Loading available slots…
            </div>
          )}
          {!loading && loadError && (
            <div style={errorBoxStyle}>{loadError}</div>
          )}
          {!loading && !loadError && grouped.length === 0 && (
            <div style={{ textAlign: 'center', color: '#64748B', padding: '2rem 0' }}>
              No slots available in this week. Try a later date.
            </div>
          )}
          {!loading && grouped.map(([date, daySlots]) => (
            <div key={date} style={{ marginBottom: 18 }}>
              <div style={dayHeaderStyle}>{formatDateHeader(date)}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {daySlots.map((s) => {
                  const isSelected = selectedSlotId === s.slotId
                  return (
                    <button
                      key={s.slotId}
                      type='button'
                      onClick={() => setSelectedSlotId(s.slotId)}
                      style={slotChipStyle(isSelected)}
                    >
                      <div style={{ fontWeight: 600 }}>
                        {formatTime(s.startTime)} – {formatTime(s.endTime)}
                      </div>
                      {s.counsellorName && (
                        <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: 2 }}>
                          {s.counsellorName}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Reason textarea — shown once a slot is picked */}
          {selectedSlotId != null && (
            <div style={{ marginTop: 8 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: '#334155',
                  marginBottom: 6,
                  fontWeight: 500,
                }}
              >
                What would you like to discuss? <span style={{ color: '#94A3B8' }}>(optional)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder='A few words help your counsellor prepare'
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          )}

          {bookError && (
            <div style={{ ...errorBoxStyle, marginTop: 12 }}>{bookError}</div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button type='button' onClick={onClose} style={btnSecondaryStyle}>
            Cancel
          </button>
          <button
            type='button'
            onClick={handleConfirm}
            disabled={selectedSlotId == null || booking}
            style={btnPrimaryStyle(selectedSlotId == null || booking)}
          >
            {booking ? 'Booking…' : 'Confirm booking'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── style helpers ──────────────────────────────────────────────────────────

const dayHeaderStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 8,
}

const errorBoxStyle: React.CSSProperties = {
  background: '#FEF2F2',
  border: '1px solid #FECACA',
  color: '#991B1B',
  padding: '0.6rem 0.75rem',
  borderRadius: 8,
  fontSize: '0.85rem',
}

function navBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? '#F1F5F9' : '#fff',
    color: disabled ? '#94A3B8' : '#1E293B',
    border: '1px solid #CBD5E1',
    padding: '0.4rem 0.75rem',
    borderRadius: 8,
    fontSize: '0.82rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

function slotChipStyle(selected: boolean): React.CSSProperties {
  return {
    background: selected ? 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' : '#fff',
    color: selected ? '#fff' : '#0F172A',
    border: selected ? '1px solid transparent' : '1px solid #E2E8F0',
    padding: '0.55rem 0.85rem',
    borderRadius: 10,
    fontSize: '0.86rem',
    cursor: 'pointer',
    minWidth: 130,
    textAlign: 'left',
    boxShadow: selected ? '0 6px 18px rgba(99, 102, 241, 0.35)' : 'none',
  }
}

const btnSecondaryStyle: React.CSSProperties = {
  background: '#F1F5F9',
  color: '#1E293B',
  border: '1px solid #CBD5E1',
  padding: '0.6rem 1rem',
  borderRadius: 10,
  fontSize: '0.9rem',
  fontWeight: 500,
  cursor: 'pointer',
}

function btnPrimaryStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled
      ? '#CBD5E1'
      : 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    color: '#fff',
    border: 'none',
    padding: '0.6rem 1.25rem',
    borderRadius: 10,
    fontSize: '0.92rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : '0 8px 22px rgba(99, 102, 241, 0.4)',
  }
}

export default CounsellingSlotPicker
