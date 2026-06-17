import React, { useEffect, useMemo, useRef, useState } from 'react'
import { bookCounsellingSlot, listCounsellingSlots } from '../api-clients/campaignAPI'

type SessionMode = 'ONLINE' | 'OFFLINE'

type Slot = {
  slotId: number
  date: string         // yyyy-MM-dd
  startTime: string    // HH:mm:ss
  endTime: string      // HH:mm:ss
  durationMinutes: number
  counsellorName?: string
  mode?: SessionMode   // delivery mode set by the counsellor on the slot
  booked?: boolean     // already taken by another student — shown greyed, not bookable
}

type BookingResult = {
  appointmentId: number
  status: string
  slotDate?: string
  slotStartTime?: string
  counsellorName?: string
  sessionsRemaining?: number
  mode?: SessionMode
  meetingLink?: string // present for ONLINE bookings
  location?: string    // present for OFFLINE bookings
}

type Props = {
  accessToken: string
  entitlementId: number | string
  sessionsRemaining: number
  onClose: () => void
  /** Called with the server response after a successful booking. The host page
   *  uses this to refresh upgradeInfo and swap the CTA tile for a confirmation. */
  onBooked: (result: BookingResult) => void
  /** Optional prefill for the contact form, if the host page already knows the
   *  student's details from the entitlement/registration. */
  defaultName?: string
  defaultEmail?: string
  defaultPhone?: string
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

const CounsellingSlotPicker: React.FC<Props> = ({
  accessToken,
  entitlementId,
  sessionsRemaining,
  onClose,
  onBooked,
  defaultName = '',
  defaultEmail = '',
  defaultPhone = '',
}) => {
  const [from] = useState<string>(todayIso())
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [loadError, setLoadError] = useState<string>('')
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null)
  const [reason, setReason] = useState<string>('')
  const [booking, setBooking] = useState<boolean>(false)
  const [bookError, setBookError] = useState<string>('')
  // Confirm-before-leaving: shown on every dismiss so leaving is a deliberate choice.
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false)
  // Which day is currently shown — the picker shows one day at a time and the
  // Earlier/Later buttons step through the days that actually have slots.
  const [dayIndex, setDayIndex] = useState<number>(0)

  // Contact details — captured once a slot is selected. Parent email/phone are
  // optional extra contacts who also receive the confirmation + reminders.
  const [contactName, setContactName] = useState<string>(defaultName)
  const [contactEmail, setContactEmail] = useState<string>(defaultEmail)
  const [contactPhone, setContactPhone] = useState<string>(defaultPhone)
  const [parentEmail, setParentEmail] = useState<string>('')
  const [parentPhone, setParentPhone] = useState<string>('')

  // Scroll target: the contact form auto-scrolls into view when a slot is picked,
  // so the student doesn't have to scroll past the slot grid to fill it in.
  const contactRef = useRef<HTMLDivElement>(null)

  const selectedSlot = useMemo(
    () => slots.find((s) => s.slotId === selectedSlotId) || null,
    [slots, selectedSlotId],
  )

  // Distinct dates that have at least one slot (available or booked), sorted ascending.
  const dates = useMemo(() => {
    const set = new Set<string>()
    for (const s of slots) set.add(s.date)
    return Array.from(set).sort()
  }, [slots])

  const safeIndex = dates.length ? Math.min(dayIndex, dates.length - 1) : 0
  const currentDate = dates[safeIndex]
  const daySlots = useMemo(
    () => slots.filter((s) => s.date === currentDate),
    [slots, currentDate],
  )

  // Smoothly bring the contact form into view as soon as a slot is selected.
  useEffect(() => {
    if (selectedSlotId != null && contactRef.current) {
      contactRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedSlotId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    // One fetch covers the whole upcoming horizon; day paging is done client-side.
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

  // All three dismiss paths (footer Cancel, header ×, backdrop) route through
  // here so the leave-confirmation can't be bypassed by clicking outside. The
  // loss-framed "this is a great opportunity" prompt is shown on every dismiss —
  // whether or not a slot was picked — so leaving is always a deliberate choice.
  const requestClose = () => {
    if (booking) return
    setShowCancelConfirm(true)
  }

  const handleConfirm = async () => {
    if (selectedSlotId == null || booking) return
    if (!contactName.trim() || !contactPhone.trim()) {
      setBookError('Please enter your name and phone number.')
      return
    }
    setBooking(true)
    setBookError('')
    try {
      const res = await bookCounsellingSlot({
        token: accessToken,
        entitlementId,
        slotId: selectedSlotId,
        reason: reason.trim() || undefined,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim() || undefined,
        parentEmail: parentEmail.trim() || undefined,
        parentPhone: parentPhone.trim() || undefined,
      })
      const data: any = res.data
      // Phase 3b: if the session isn't included in the plan, the backend holds the
      // slot and returns a Razorpay payment link instead of a confirmed booking.
      // Redirect to pay; on success the webhook finalises the booking.
      if (data && data.requiresPayment) {
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl
          return
        }
        setBookError('Payment is required but no payment link was returned. Please try again.')
        return
      }
      // Hand the booking straight to the host page, which shows the single
      // celebration screen — no in-picker celebration, so it only appears once.
      onBooked(data as BookingResult)
    } catch (err: any) {
      const body = err?.response?.data
      setBookError(typeof body === 'string' ? body : 'Could not confirm your booking. Please try again.')
    } finally {
      setBooking(false)
    }
  }

  return (
    <div
      onClick={requestClose}
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
          </div>
          <button
            type='button'
            onClick={requestClose}
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
            onClick={() => { setDayIndex((i) => Math.max(0, i - 1)); setSelectedSlotId(null) }}
            disabled={safeIndex <= 0}
            style={navBtnStyle(safeIndex <= 0)}
          >
            ← Earlier
          </button>
          <div style={{ fontSize: '0.9rem', color: '#1E293B', fontWeight: 700 }}>
            {currentDate ? formatDateHeader(currentDate) : '—'}
          </div>
          <button
            type='button'
            onClick={() => { setDayIndex((i) => Math.min(dates.length - 1, i + 1)); setSelectedSlotId(null) }}
            disabled={safeIndex >= dates.length - 1}
            style={navBtnStyle(safeIndex >= dates.length - 1)}
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
          {!loading && !loadError && dates.length === 0 && (
            <div style={{ textAlign: 'center', color: '#64748B', padding: '2rem 0' }}>
              No upcoming counselling slots are available right now. Please check back later.
            </div>
          )}
          {!loading && currentDate && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {daySlots.map((s) => {
                  const isSelected = selectedSlotId === s.slotId
                  const isBooked = !!s.booked
                  return (
                    <button
                      key={s.slotId}
                      type='button'
                      disabled={isBooked}
                      onClick={() => { if (!isBooked) setSelectedSlotId(s.slotId) }}
                      style={isBooked ? slotChipBookedStyle() : slotChipStyle(isSelected)}
                      title={isBooked ? 'This time is already booked' : undefined}
                    >
                      <div style={{ fontWeight: 600 }}>
                        {formatTime(s.startTime)} – {formatTime(s.endTime)}
                      </div>
                      {isBooked ? (
                        <div style={bookedBadgeStyle}>Booked</div>
                      ) : (
                        <div style={modeBadgeStyle(s.mode === 'OFFLINE', isSelected)}>
                          {s.mode === 'OFFLINE' ? 'In-person' : 'Online'}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Contact details + reason — shown once a slot is picked */}
          {selectedSlotId != null && (
            <div ref={contactRef} style={{ marginTop: 8, scrollMarginTop: 8 }}>
              {/* Mode notice — tells the student how the session will be delivered */}
              <div style={modeNoticeStyle(selectedSlot?.mode === 'OFFLINE')}>
                {selectedSlot?.mode === 'OFFLINE'
                  ? '📍 In-person session — the venue address will be sent to you by email.'
                  : '💻 Online session — the meeting link will be sent to you by email.'}
              </div>

              <div style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600, margin: '12px 0 8px' }}>
                Your contact details
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={fieldLabelStyle}>
                    Full name <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type='text'
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder='Your full name'
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>
                    Phone <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type='tel'
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder='10-digit mobile number'
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>
                    Email <span style={{ color: '#94A3B8' }}>(optional)</span>
                  </label>
                  <input
                    type='email'
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder='you@example.com'
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>
                    Parent's email <span style={{ color: '#94A3B8' }}>(optional)</span>
                  </label>
                  <input
                    type='email'
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    placeholder="parent@example.com"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>
                    Parent's phone <span style={{ color: '#94A3B8' }}>(optional)</span>
                  </label>
                  <input
                    type='tel'
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="Parent's mobile number"
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 8 }}>
                We'll send the confirmation and reminders by email and WhatsApp to all the numbers/emails above.
              </div>

              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: '#334155',
                  margin: '14px 0 6px',
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
          <button type='button' onClick={requestClose} style={btnSecondaryStyle}>
            Cancel
          </button>
          <button
            type='button'
            onClick={handleConfirm}
            disabled={selectedSlotId == null || booking || !contactName.trim() || !contactPhone.trim()}
            style={btnPrimaryStyle(selectedSlotId == null || booking || !contactName.trim() || !contactPhone.trim())}
          >
            {booking ? 'Booking…' : 'Confirm booking'}
          </button>
        </div>
      </div>

      {/* Leave-confirmation — a deliberate, on-brand interruption when a student tries
          to walk away. Reframes leaving as a real loss, in the picker's own palette. */}
      {showCancelConfirm && (
        <div onClick={(e) => e.stopPropagation()} style={confirmOverlayStyle}>
          <div style={confirmCardStyle}>
            {/* Gradient icon badge — matches the picker header */}
            <div style={confirmBadgeStyle}>🎓</div>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.35rem', fontWeight: 800, color: '#1E293B' }}>
              Don’t leave this on the table
            </h3>
            <p style={{ margin: '0 0 22px', fontSize: '0.96rem', color: '#475569', lineHeight: 1.6 }}>
              You just finished your assessment. A one-on-one session turns those results into a
              real plan for your future — and it only takes a moment to pick a time.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type='button'
                onClick={() => setShowCancelConfirm(false)}
                style={{ ...btnPrimaryStyle(false), padding: '14px 20px', fontSize: '1rem' }}
              >
                Pick my counselling time
              </button>
              <button
                type='button'
                onClick={() => {
                  setShowCancelConfirm(false)
                  onClose()
                }}
                style={btnGhostDangerStyle}
              >
                No thanks, maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── style helpers ──────────────────────────────────────────────────────────

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

function modeBadgeStyle(offline: boolean, selected: boolean): React.CSSProperties {
  return {
    display: 'inline-block',
    marginTop: 6,
    padding: '1px 7px',
    borderRadius: 999,
    fontSize: '0.66rem',
    fontWeight: 700,
    letterSpacing: '0.02em',
    background: selected ? 'rgba(255,255,255,0.22)' : offline ? '#FEF3C7' : '#E0E7FF',
    color: selected ? '#fff' : offline ? '#92400E' : '#3730A3',
  }
}

const modeNoticeStyle = (offline: boolean): React.CSSProperties => ({
  background: offline ? '#FFFBEB' : '#EEF2FF',
  border: `1px solid ${offline ? '#FDE68A' : '#C7D2FE'}`,
  color: offline ? '#92400E' : '#3730A3',
  padding: '0.55rem 0.7rem',
  borderRadius: 8,
  fontSize: '0.8rem',
})

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  color: '#475569',
  marginBottom: 4,
  fontWeight: 500,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.55rem 0.7rem',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  fontSize: '0.9rem',
  fontFamily: 'inherit',
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

// Already-taken slot: greyed, struck-through-feel, not clickable.
function slotChipBookedStyle(): React.CSSProperties {
  return {
    background: '#F1F5F9',
    color: '#94A3B8',
    border: '1px dashed #CBD5E1',
    padding: '0.55rem 0.85rem',
    borderRadius: 10,
    fontSize: '0.86rem',
    cursor: 'not-allowed',
    minWidth: 130,
    textAlign: 'left',
  }
}

const bookedBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  marginTop: 6,
  padding: '1px 7px',
  borderRadius: 999,
  fontSize: '0.66rem',
  fontWeight: 700,
  letterSpacing: '0.02em',
  background: '#E2E8F0',
  color: '#64748B',
}

// Gradient circular icon badge atop the leave-confirmation card.
const confirmBadgeStyle: React.CSSProperties = {
  width: 60,
  height: 60,
  borderRadius: '50%',
  margin: '0 auto 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.8rem',
  background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
  border: '1px solid #C7D2FE',
}

// Overlay that sits on top of the picker for the leave-confirmation and the
// post-booking celebration. Darkens the picker behind so the card is the focus.
const confirmOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.6)',
  backdropFilter: 'blur(3px)',
  WebkitBackdropFilter: 'blur(3px)',
  zIndex: 1200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1.5rem',
}

const confirmCardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 20,
  padding: '2rem 1.75rem',
  width: '100%',
  maxWidth: 440,
  textAlign: 'center',
  boxShadow: '0 24px 70px rgba(30, 41, 59, 0.35)',
}

// Understated "leave anyway" action — deliberately lower-weight than the
// gradient "stay" button so leaving feels like the harder choice.
const btnGhostDangerStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#94A3B8',
  border: 'none',
  padding: '0.5rem 1rem',
  borderRadius: 10,
  fontSize: '0.86rem',
  fontWeight: 500,
  cursor: 'pointer',
  textDecoration: 'underline',
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
