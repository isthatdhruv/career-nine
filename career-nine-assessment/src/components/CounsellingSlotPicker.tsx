import React, { useEffect, useMemo, useState } from 'react'
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

type ContactMethod = 'EMAIL' | 'PHONE' | 'WHATSAPP'

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
  defaultName = '',
  defaultEmail = '',
  defaultPhone = '',
}) => {
  const [from, setFrom] = useState<string>(todayIso())
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [loadError, setLoadError] = useState<string>('')
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null)
  const [reason, setReason] = useState<string>('')
  const [booking, setBooking] = useState<boolean>(false)
  const [bookError, setBookError] = useState<string>('')
  // Confirm-before-leaving: only shown once the student has picked a slot (real
  // intent), so an immediate open-and-close isn't interrupted.
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false)
  // Post-booking celebration: holds the confirmed booking so we can show an
  // encouraging success screen before handing control back to the host page
  // (which unmounts this picker and flips its tile to the confirmation state).
  const [bookedResult, setBookedResult] = useState<BookingResult | null>(null)

  // Basic contact details — captured once a slot is selected.
  const [contactName, setContactName] = useState<string>(defaultName)
  const [contactEmail, setContactEmail] = useState<string>(defaultEmail)
  const [contactPhone, setContactPhone] = useState<string>(defaultPhone)
  const [preferredMethod, setPreferredMethod] = useState<ContactMethod>('PHONE')

  const selectedSlot = useMemo(
    () => slots.find((s) => s.slotId === selectedSlotId) || null,
    [slots, selectedSlotId],
  )

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

  // All three dismiss paths (footer Cancel, header ×, backdrop) route through
  // here so the leave-confirmation can't be bypassed by clicking outside.
  const requestClose = () => {
    if (booking) return
    if (selectedSlotId != null) {
      setShowCancelConfirm(true)
      return
    }
    onClose()
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
        preferredContactMethod: preferredMethod,
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
      // Show the encouraging success screen first; onBooked is called when the
      // student taps "Got it!", which hands control back to the host page.
      setBookedResult(data as BookingResult)
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
                      <div style={modeBadgeStyle(s.mode === 'OFFLINE', isSelected)}>
                        {s.mode === 'OFFLINE' ? 'In-person' : 'Online'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Contact details + reason — shown once a slot is picked */}
          {selectedSlotId != null && (
            <div style={{ marginTop: 8 }}>
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
                  <label style={fieldLabelStyle}>Preferred contact method</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['PHONE', 'WHATSAPP', 'EMAIL'] as ContactMethod[]).map((m) => (
                      <button
                        key={m}
                        type='button'
                        onClick={() => setPreferredMethod(m)}
                        style={methodChipStyle(preferredMethod === m)}
                      >
                        {m === 'PHONE' ? 'Phone call' : m === 'WHATSAPP' ? 'WhatsApp' : 'Email'}
                      </button>
                    ))}
                  </div>
                </div>
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

      {/* Leave-confirmation — a deliberate interruption when a student tries to
          walk away after picking a slot. Reframes leaving as a real loss. */}
      {showCancelConfirm && !bookedResult && (
        <div onClick={(e) => e.stopPropagation()} style={confirmOverlayStyle}>
          <div style={confirmCardStyle}>
            <div style={{ fontSize: '1.6rem', lineHeight: 1, marginBottom: 10 }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 800, color: '#991B1B' }}>
              Are you sure?
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
              This is a life-changing opportunity. You just completed your assessment — your
              counsellor is ready to turn those results into a real plan for your future.
              <br />
              <strong>Walk away now, and you leave that on the table.</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type='button'
                onClick={() => setShowCancelConfirm(false)}
                style={btnPrimaryStyle(false)}
              >
                No, take me to my session
              </button>
              <button
                type='button'
                onClick={() => {
                  setShowCancelConfirm(false)
                  onClose()
                }}
                style={btnGhostDangerStyle}
              >
                Yes, cancel anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-booking celebration — affirms the choice before handing back to
          the host page. "Got it!" calls onBooked, which unmounts this picker. */}
      {bookedResult && (
        <div onClick={(e) => e.stopPropagation()} style={confirmOverlayStyle}>
          <div style={successCardStyle}>
            <div style={{ fontSize: '1.8rem', lineHeight: 1, marginBottom: 10 }}>🎉</div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 800, color: '#065F46' }}>
              You just made a great decision
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: '0.9rem', color: '#047857', lineHeight: 1.5 }}>
              Booking this session is one of the smartest moves you can make for your future.
              This is where your assessment turns into a real plan.
            </p>
            {bookedResult.slotDate && bookedResult.slotStartTime && (
              <div style={successWhenStyle}>
                📅 {formatDateHeader(bookedResult.slotDate)} · {formatTime(bookedResult.slotStartTime)}
              </div>
            )}
            <button
              type='button'
              onClick={() => onBooked(bookedResult)}
              style={{ ...btnPrimaryStyle(false), width: '100%', marginTop: 16 }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
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

function methodChipStyle(selected: boolean): React.CSSProperties {
  return {
    background: selected ? 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' : '#fff',
    color: selected ? '#fff' : '#334155',
    border: selected ? '1px solid transparent' : '1px solid #CBD5E1',
    padding: '0.4rem 0.8rem',
    borderRadius: 8,
    fontSize: '0.82rem',
    fontWeight: 500,
    cursor: 'pointer',
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

// Overlay that sits on top of the picker for the leave-confirmation and the
// post-booking celebration. Darkens the picker behind so the card is the focus.
const confirmOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.45)',
  zIndex: 1100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1.25rem',
}

const confirmCardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  padding: '1.5rem',
  width: '100%',
  maxWidth: 360,
  textAlign: 'center',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  borderTop: '4px solid #EF4444',
}

const successCardStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, #F0FDF4 0%, #ffffff 60%)',
  borderRadius: 16,
  padding: '1.75rem 1.5rem',
  width: '100%',
  maxWidth: 360,
  textAlign: 'center',
  boxShadow: '0 20px 60px rgba(16, 185, 129, 0.35)',
  border: '1.5px solid #6EE7B7',
}

const successWhenStyle: React.CSSProperties = {
  display: 'inline-block',
  background: '#ECFDF5',
  border: '1px solid #A7F3D0',
  color: '#065F46',
  fontWeight: 700,
  fontSize: '0.9rem',
  padding: '0.5rem 0.9rem',
  borderRadius: 10,
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
