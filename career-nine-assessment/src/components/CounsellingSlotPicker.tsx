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
  // After de-duplication: every still-free slotId that shares this timing (one per
  // counsellor). Booking picks one at random. Empty when the timing is fully booked.
  candidateSlotIds?: number[]
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

// yyyy-MM-dd for a local year / month (0-based) / day triple.
function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// "June 2026" — calendar popover heading.
function formatMonthLabel(y: number, m: number): string {
  return new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

// Sortable month key so month bounds can be compared with plain arithmetic.
function monthKey(v: { y: number; m: number }): number {
  return v.y * 12 + v.m
}

// Returns a new array with the items in random order (Fisher–Yates).
function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Inline SVG icons (no emojis anywhere in the flow).
const IconMonitor: React.FC<{ color?: string }> = ({ color = '#065F46' }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
  </svg>
)
const IconMapPin: React.FC<{ color?: string }> = ({ color = '#92400E' }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
)
const IconCalendar: React.FC<{ color?: string }> = ({ color = '#059669' }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
)
const IconChevron: React.FC<{ dir?: 'left' | 'right' | 'down'; color?: string }> = ({ dir = 'down', color = '#475569' }) => {
  const d = dir === 'left' ? 'M15 18l-6-6 6-6' : dir === 'right' ? 'M9 18l6-6-6-6' : 'M6 9l6 6 6-6'
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  )
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
  // Which day is currently shown — the picker shows one day at a time and the
  // Earlier/Later buttons step through the days that actually have slots.
  const [dayIndex, setDayIndex] = useState<number>(0)
  // Month calendar behind the date header: clicking the date opens it, picking a
  // day jumps straight to that day's slots. `calMonth` is null until the student
  // pages months, so the calendar always opens on the month being viewed.
  const [calendarOpen, setCalendarOpen] = useState<boolean>(false)
  const [calMonth, setCalMonth] = useState<{ y: number; m: number } | null>(null)
  const calendarRef = useRef<HTMLDivElement>(null)

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

  // Collapse slots that share the same timing (date + start + end) into ONE chip.
  // Different counsellors commonly publish identical time slots; the student should
  // see a single slot per time, not one per counsellor. A timing stays bookable as
  // long as at least one counsellor is still free at it — its still-free slotIds
  // become the random-assignment candidates. Only when every counsellor at that
  // time is taken does it collapse to a single greyed "Booked" chip.
  const dedupedSlots = useMemo<Slot[]>(() => {
    const groups = new Map<string, Slot[]>()
    for (const s of slots) {
      const key = `${s.date}|${s.startTime}|${s.endTime}`
      const g = groups.get(key)
      if (g) g.push(s)
      else groups.set(key, [s])
    }
    const out: Slot[] = []
    for (const group of groups.values()) {
      const free = group.filter((s) => !s.booked)
      if (free.length > 0) {
        out.push({ ...free[0], booked: false, candidateSlotIds: free.map((s) => s.slotId) })
      } else {
        out.push({ ...group[0], booked: true, candidateSlotIds: [] })
      }
    }
    return out
  }, [slots])

  const selectedSlot = useMemo(
    () => dedupedSlots.find((s) => s.slotId === selectedSlotId) || null,
    [dedupedSlots, selectedSlotId],
  )

  // Distinct dates that have at least one slot (available or booked), sorted ascending.
  const dates = useMemo(() => {
    const set = new Set<string>()
    for (const s of dedupedSlots) set.add(s.date)
    return Array.from(set).sort()
  }, [dedupedSlots])

  const safeIndex = dates.length ? Math.min(dayIndex, dates.length - 1) : 0
  const currentDate = dates[safeIndex]
  const daySlots = useMemo(
    () => dedupedSlots.filter((s) => s.date === currentDate),
    [dedupedSlots, currentDate],
  )

  // ── Month calendar ────────────────────────────────────────────────────────
  // Free slots per date, so a day cell can show whether anything is bookable on
  // it (green + count) or whether every timing there is already taken (grey).
  const freeByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of dedupedSlots) if (!s.booked) m.set(s.date, (m.get(s.date) || 0) + 1)
    return m
  }, [dedupedSlots])

  // Month on screen: whatever the student paged to, else the month of the day
  // currently being viewed.
  const shownMonth = useMemo<{ y: number; m: number }>(() => {
    if (calMonth) return calMonth
    const base = currentDate || dates[0] || todayIso()
    const [y, m] = base.split('-').map(Number)
    return { y, m: m - 1 }
  }, [calMonth, currentDate, dates])

  // Paging is clamped to the months that actually contain slots — there is no
  // point letting the student wander into empty months.
  const monthBounds = useMemo(() => {
    if (!dates.length) return null
    const [fy, fm] = dates[0].split('-').map(Number)
    const [ly, lm] = dates[dates.length - 1].split('-').map(Number)
    return { first: { y: fy, m: fm - 1 }, last: { y: ly, m: lm - 1 } }
  }, [dates])

  const canPrevMonth = !!monthBounds && monthKey(shownMonth) > monthKey(monthBounds.first)
  const canNextMonth = !!monthBounds && monthKey(shownMonth) < monthKey(monthBounds.last)

  // Cells for the month grid: leading blanks (null) to line the 1st up under its
  // weekday, then one yyyy-MM-dd per day.
  const monthCells = useMemo<(string | null)[]>(() => {
    const lead = new Date(shownMonth.y, shownMonth.m, 1).getDay()
    const total = new Date(shownMonth.y, shownMonth.m + 1, 0).getDate()
    const cells: (string | null)[] = Array(lead).fill(null)
    for (let d = 1; d <= total; d++) cells.push(isoOf(shownMonth.y, shownMonth.m, d))
    return cells
  }, [shownMonth])

  const stepMonth = (delta: number) => {
    const next = new Date(shownMonth.y, shownMonth.m + delta, 1)
    setCalMonth({ y: next.getFullYear(), m: next.getMonth() })
  }

  // Jump the one-day view to the picked date. Only days present in `dates` are
  // clickable, so the index lookup always resolves.
  const pickDate = (iso: string) => {
    const idx = dates.indexOf(iso)
    if (idx < 0) return
    setDayIndex(idx)
    setSelectedSlotId(null)
    setCalendarOpen(false)
  }

  // Close on outside click / Escape. The modal card stops click propagation, so
  // the listener runs in the capture phase to still see clicks inside it.
  useEffect(() => {
    if (!calendarOpen) return
    const onDown = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setCalendarOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCalendarOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [calendarOpen])

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

  // All three dismiss paths (footer Cancel, header ×, backdrop) route through here.
  // Closing simply dismisses the picker — the retention nudge now lives BEFORE the
  // picker (host page's pre-picker reminder), so we don't stack a confirm on top.
  // The host page reveals the Book-counselling card again after close.
  const requestClose = () => {
    if (booking) return
    onClose()
  }

  const handleConfirm = async () => {
    if (selectedSlotId == null || booking) return
    if (!contactName.trim() || !contactPhone.trim()) {
      setBookError('Please enter your name and phone number.')
      return
    }
    // The chosen time may be offered by several counsellors. Book one of them at
    // RANDOM so assignment is spread across counsellors; if that slot was taken
    // meanwhile, fall back to another counsellor still free at the same time.
    const candidates = shuffle(
      selectedSlot?.candidateSlotIds?.length ? selectedSlot.candidateSlotIds : [selectedSlotId],
    )
    setBooking(true)
    setBookError('')
    try {
      let data: any = null
      let lastErr: any = null
      for (const slotId of candidates) {
        try {
          const res = await bookCounsellingSlot({
            token: accessToken,
            entitlementId,
            slotId,
            reason: reason.trim() || undefined,
            contactName: contactName.trim(),
            contactPhone: contactPhone.trim(),
            contactEmail: contactEmail.trim() || undefined,
            parentEmail: parentEmail.trim() || undefined,
            parentPhone: parentPhone.trim() || undefined,
          })
          data = res.data
          lastErr = null
          break
        } catch (err) {
          lastErr = err
          // that counsellor's slot was taken — try the next one at the same time
        }
      }
      if (lastErr) throw lastErr
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
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
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

        {/* Date navigation + month calendar. The calendar is an inline panel
            rather than a floating popover: the modal card is overflow:hidden and
            can be short, which would clip an absolutely positioned dropdown. */}
        <div ref={calendarRef}>
          <div
            style={{
              padding: '0.75rem 1.5rem',
              borderBottom: calendarOpen ? 'none' : '1px solid #E5E7EB',
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

            {/* The date header doubles as the trigger for the month calendar. */}
            <button
              type='button'
              onClick={() => { setCalMonth(null); setCalendarOpen((o) => !o) }}
              disabled={dates.length === 0}
              style={dateTriggerStyle(calendarOpen, dates.length === 0)}
              aria-expanded={calendarOpen}
              title={dates.length === 0 ? undefined : 'Choose a date'}
            >
              <IconCalendar color={dates.length === 0 ? '#94A3B8' : '#059669'} />
              {currentDate ? formatDateHeader(currentDate) : '—'}
              <IconChevron dir='down' color={dates.length === 0 ? '#94A3B8' : '#475569'} />
            </button>

            <button
              type='button'
              onClick={() => { setDayIndex((i) => Math.min(dates.length - 1, i + 1)); setSelectedSlotId(null) }}
              disabled={safeIndex >= dates.length - 1}
              style={navBtnStyle(safeIndex >= dates.length - 1)}
            >
              Later →
            </button>
          </div>

          {calendarOpen && (
            <div style={calendarPanelStyle}>
              <div style={{ width: 280, margin: '0 auto' }}>
                {/* Month paging */}
                <div style={calHeadStyle}>
                  <button
                    type='button'
                    onClick={() => stepMonth(-1)}
                    disabled={!canPrevMonth}
                    style={calNavBtnStyle(!canPrevMonth)}
                    aria-label='Previous month'
                  >
                    <IconChevron dir='left' color={canPrevMonth ? '#475569' : '#CBD5E1'} />
                  </button>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1E293B' }}>
                    {formatMonthLabel(shownMonth.y, shownMonth.m)}
                  </div>
                  <button
                    type='button'
                    onClick={() => stepMonth(1)}
                    disabled={!canNextMonth}
                    style={calNavBtnStyle(!canNextMonth)}
                    aria-label='Next month'
                  >
                    <IconChevron dir='right' color={canNextMonth ? '#475569' : '#CBD5E1'} />
                  </button>
                </div>

                <div style={calGridStyle}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={`${d}${i}`} style={calWeekdayStyle}>{d}</div>
                  ))}
                  {monthCells.map((iso, i) => {
                    if (!iso) return <div key={`blank-${i}`} />
                    const hasDay = dates.includes(iso)
                    const free = freeByDate.get(iso) || 0
                    const isSelected = iso === currentDate
                    const isToday = iso === todayIso()
                    return (
                      <button
                        key={iso}
                        type='button'
                        disabled={!hasDay}
                        onClick={() => pickDate(iso)}
                        style={calDayStyle({ selected: isSelected, hasDay, free, today: isToday })}
                        title={
                          !hasDay
                            ? 'No slots on this date'
                            : free > 0
                            ? `${free} slot${free === 1 ? '' : 's'} available`
                            : 'All slots on this date are booked'
                        }
                      >
                        {Number(iso.slice(8))}
                        <span style={calDotStyle({ selected: isSelected, hasDay, free })} />
                      </button>
                    )
                  })}
                </div>

                <div style={calLegendStyle}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                    Slots available
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#CBD5E1' }} />
                    Fully booked
                  </span>
                </div>
              </div>
            </div>
          )}
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {selectedSlot?.mode === 'OFFLINE' ? <IconMapPin /> : <IconMonitor />}
                  {selectedSlot?.mode === 'OFFLINE'
                    ? 'In-person session — the venue address will be sent to you by email.'
                    : 'Online session — the meeting link will be sent to you by email.'}
                </span>
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
    background: selected ? 'rgba(255,255,255,0.25)' : offline ? '#FEF3C7' : '#D1FAE5',
    color: selected ? '#fff' : offline ? '#92400E' : '#065F46',
  }
}

const modeNoticeStyle = (offline: boolean): React.CSSProperties => ({
  background: offline ? '#FFFBEB' : '#ECFDF5',
  border: `1px solid ${offline ? '#FDE68A' : '#A7F3D0'}`,
  color: offline ? '#92400E' : '#065F46',
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
    background: selected ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#fff',
    color: selected ? '#fff' : '#0F172A',
    border: selected ? '1px solid transparent' : '1px solid #D1FAE5',
    padding: '0.55rem 0.85rem',
    borderRadius: 10,
    fontSize: '0.86rem',
    cursor: 'pointer',
    minWidth: 130,
    textAlign: 'left',
    boxShadow: selected ? '0 6px 18px rgba(16, 185, 129, 0.35)' : 'none',
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
      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#fff',
    border: 'none',
    padding: '0.6rem 1.25rem',
    borderRadius: 10,
    fontSize: '0.92rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : '0 8px 22px rgba(16, 185, 129, 0.4)',
  }
}

// ── Month calendar styles ───────────────────────────────────────────────────

function dateTriggerStyle(open: boolean, disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    background: open ? '#ECFDF5' : 'transparent',
    border: `1px solid ${open ? '#A7F3D0' : 'transparent'}`,
    borderRadius: 9,
    padding: '0.3rem 0.6rem',
    fontSize: '0.9rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    color: disabled ? '#94A3B8' : '#1E293B',
    cursor: disabled ? 'default' : 'pointer',
  }
}

const calendarPanelStyle: React.CSSProperties = {
  padding: '4px 1.5rem 14px',
  borderBottom: '1px solid #E5E7EB',
  background: '#F8FAFC',
}

const calHeadStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
}

function calNavBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 26,
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    border: '1px solid #E5E7EB',
    background: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    padding: 0,
  }
}

const calGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 2,
}

const calWeekdayStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '0.63rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  color: '#94A3B8',
  padding: '2px 0 5px',
}

// A day cell: green when something is bookable, grey-but-clickable when every
// timing that day is taken, flat and disabled when the day has no slots at all.
function calDayStyle(o: { selected: boolean; hasDay: boolean; free: number; today: boolean }): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'relative',
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    fontSize: '0.78rem',
    fontFamily: 'inherit',
    padding: 0,
    border: '1px solid transparent',
    background: 'transparent',
    color: '#CBD5E1',
    cursor: 'default',
  }
  if (o.selected) {
    return {
      ...base,
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: '#fff',
      fontWeight: 700,
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
    }
  }
  if (o.hasDay && o.free > 0) {
    return {
      ...base,
      background: '#ECFDF5',
      border: '1px solid #A7F3D0',
      color: '#065F46',
      fontWeight: 600,
      cursor: 'pointer',
    }
  }
  if (o.hasDay) {
    return { ...base, background: '#F1F5F9', color: '#94A3B8', cursor: 'pointer' }
  }
  return { ...base, border: o.today ? '1px dashed #CBD5E1' : '1px solid transparent' }
}

// Availability dot under the day number.
function calDotStyle(o: { selected: boolean; hasDay: boolean; free: number }): React.CSSProperties {
  return {
    position: 'absolute',
    bottom: 4,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: !o.hasDay
      ? 'transparent'
      : o.selected
      ? 'rgba(255,255,255,0.9)'
      : o.free > 0
      ? '#10b981'
      : '#CBD5E1',
  }
}

const calLegendStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 14,
  marginTop: 10,
  paddingTop: 8,
  borderTop: '1px solid #F1F5F9',
  fontSize: '0.68rem',
  color: '#64748B',
}

export default CounsellingSlotPicker
