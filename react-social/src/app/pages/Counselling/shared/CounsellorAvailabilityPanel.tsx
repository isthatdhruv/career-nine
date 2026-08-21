import React, { useState, useEffect, useCallback } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { getCounsellorById, updateCounsellor } from '../API/CounsellorAPI'
import { getSlotsByCounsellor, createManualSlot, deleteSlot } from '../API/SlotAPI'
import {
  submitBlockDateRequest, getBlockRequestsByCounsellor, approveBlockRequest, BlockDateRequest,
} from '../API/BlockDateRequestAPI'
import { useRefreshInterval } from '../../../utils/useAutoRefresh'
import WeeklySchedulePanel from './WeeklySchedulePanel'
import { isTeamsLink } from './WeeklyScheduleForm'
import './CounsellorAvailabilityPanel.css'

interface ManualSlotForm {
  date: string
  startTime: string
  endTime: string
  durationMinutes: number
  mode: 'ONLINE' | 'OFFLINE'
}

interface BlockDateForm {
  date: string
  reason: string
}

interface Props {
  counsellorId: number
  /**
   * Admin running this on a counsellor's behalf: blocking a date takes effect
   * immediately (submit + approve) instead of queueing a request for approval.
   */
  asAdmin?: boolean
  /** Wrapper class — the counsellor portal boxes this in its page card. */
  wrapperClassName?: string
  onChanged?: () => void
}

function formatTime(timeStr: string): string {
  if (!timeStr) return '—'
  try {
    // Handle HH:mm or full datetime
    const parts = timeStr.split('T')
    return parts.length > 1 ? parts[1].substring(0, 5) : timeStr.substring(0, 5)
  } catch {
    return timeStr
  }
}

// react-datepicker works with Date objects; form state keeps ISO yyyy-MM-dd
// strings (what the backend's LocalDate expects), so convert at the boundary.
function isoToDate(s: string): Date | null {
  return s ? new Date(s + 'T00:00:00') : null
}

function dateToIso(d: Date | null): string {
  if (!d) return ''
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    // Handle date-only strings like "2026-04-17"
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00')
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid #DDE3EC',
  borderRadius: 7,
  fontSize: 12,
  outline: 'none',
  fontFamily: 'inherit',
  color: '#1A1F2E',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#6B7A8D',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  display: 'block',
  marginBottom: 4,
}

/**
 * The whole availability workspace for one counsellor: weekly schedule, upcoming
 * slots, extra slots, and date blocking.
 *
 * Rendered by the counsellor's own portal page and by the admin's Manage
 * Counsellors screen, so both see and do exactly the same things.
 */
const CounsellorAvailabilityPanel: React.FC<Props> = ({
  counsellorId,
  asAdmin = false,
  wrapperClassName,
  onChanged,
}) => {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Counsellor's office address for OFFLINE sessions (Counsellor.officeAddress) and
  // permanent Microsoft Teams link for ONLINE ones (Counsellor.meetingLink).
  const [officeAddress, setOfficeAddress] = useState('')
  const [meetingLink, setMeetingLink] = useState('')

  // Manual slots & blocks
  const [manualSlots, setManualSlots] = useState<any[]>([])
  const [blockedDates, setBlockedDates] = useState<any[]>([])
  const [blockRequests, setBlockRequests] = useState<BlockDateRequest[]>([])
  const [manualSlotForm, setManualSlotForm] = useState<ManualSlotForm>({
    date: '',
    startTime: '',
    endTime: '',
    durationMinutes: 30,
    mode: 'ONLINE',
  })
  const [blockDateForm, setBlockDateForm] = useState<BlockDateForm>({ date: '', reason: '' })
  const [slotSaving, setSlotSaving] = useState(false)
  const [blockSaving, setBlockSaving] = useState(false)
  const [deletingSlot, setDeletingSlot] = useState<number | null>(null)

  const refreshAvailability = useCallback(() => {
    if (!counsellorId) return
    Promise.all([
      getSlotsByCounsellor(counsellorId),
      getBlockRequestsByCounsellor(counsellorId).catch(() => ({ data: [] })),
    ]).then(([sRes, brRes]) => {
      const slots: any[] = sRes.data || []
      setManualSlots(slots.filter((s: any) => !s.isBlocked))
      setBlockedDates(slots.filter((s: any) => s.isBlocked))
      setBlockRequests(Array.isArray(brRes.data) ? brRes.data : [])
    }).catch(() => {})
  }, [counsellorId])

  useRefreshInterval(refreshAvailability, { skip: !counsellorId })

  useEffect(() => {
    getCounsellorById(counsellorId)
      .then((res) => {
        setOfficeAddress(res.data?.officeAddress || '')
        setMeetingLink(res.data?.meetingLink || '')
      })
      .catch(() => {})
    refreshAvailability()
  }, [counsellorId, refreshAvailability])

  const reloadSlots = () => {
    getSlotsByCounsellor(counsellorId)
      .then((res) => {
        const slots: any[] = res.data || []
        setManualSlots(slots.filter((s) => !s.isBlocked))
        setBlockedDates(slots.filter((s) => s.isBlocked))
      })
      .catch(() => setError('Failed to reload slots.'))
  }

  const reloadBlockRequests = () => {
    getBlockRequestsByCounsellor(counsellorId)
      .then((res) => setBlockRequests(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
  }

  const handleScheduleChanged = () => {
    // The backend materializes slots from a new template immediately,
    // so the Upcoming Slots list must refresh too.
    reloadSlots()
    onChanged?.()
  }

  // Online extra slot needs the permanent Teams link on file, exactly as the weekly
  // schedule does — the Add Slot button stays disabled until it is a valid one.
  const manualSlotLinkMissing =
    manualSlotForm.mode === 'ONLINE' && !isTeamsLink(meetingLink)

  const handleSaveManualSlot = async () => {
    if (!manualSlotForm.date || !manualSlotForm.startTime || !manualSlotForm.endTime) {
      setError('Please fill in date, start time, and end time.')
      return
    }
    const [sh, sm] = manualSlotForm.startTime.split(':').map(Number)
    const [eh, em] = manualSlotForm.endTime.split(':').map(Number)
    const durationMinutes = eh * 60 + em - (sh * 60 + sm)
    if (durationMinutes <= 0) {
      setError('End time must be after start time.')
      return
    }
    if (manualSlotForm.mode === 'OFFLINE' && !officeAddress.trim()) {
      setError('Please enter the office address for in-person sessions.')
      return
    }
    // Online sessions run on Microsoft Teams — no link, no bookable online slot.
    if (manualSlotForm.mode === 'ONLINE' && !isTeamsLink(meetingLink)) {
      setError(meetingLink.trim()
        ? 'The meeting link must be a Microsoft Teams link (teams.microsoft.com or teams.live.com).'
        : 'Add the Microsoft Teams meeting link above before creating online slots.')
      return
    }
    setSlotSaving(true)
    setError('')
    try {
      // OFFLINE sessions are delivered at the counsellor's office address, ONLINE ones at
      // their permanent Teams link; persist whichever applies.
      if (manualSlotForm.mode === 'OFFLINE') {
        await updateCounsellor(counsellorId, { officeAddress: officeAddress.trim() })
      } else {
        await updateCounsellor(counsellorId, { meetingLink: meetingLink.trim() })
      }
      // The endpoint binds the body straight onto the CounsellingSlot entity:
      // counsellor must be the nested relation (counsellor_id is a non-null
      // FK) and startTime/endTime are LocalTime ("HH:mm:ss"), not datetimes.
      // The backend rejects a slot that overlaps an existing one (any mode).
      await createManualSlot({
        counsellor: { id: counsellorId },
        date: manualSlotForm.date,
        startTime: `${manualSlotForm.startTime}:00`,
        endTime: `${manualSlotForm.endTime}:00`,
        durationMinutes,
        mode: manualSlotForm.mode,
      })
      setSuccess('Extra slot added.')
      reloadSlots()
      onChanged?.()
      setManualSlotForm({ date: '', startTime: '', endTime: '', durationMinutes: 30, mode: 'ONLINE' })
    } catch (e: any) {
      // Surface the backend's conflict message (e.g. "You already have an Online
      // slot at 15:00–16:00 …") so the user knows to pick a different time.
      const msg = e?.response?.data
      setError(typeof msg === 'string' && msg ? msg : 'Failed to add slot.')
    } finally {
      setSlotSaving(false)
    }
  }

  const handleBlockDate = async () => {
    if (!blockDateForm.date) {
      setError('Please select a date to block.')
      return
    }
    // Admin blocking takes effect at once, which cancels that day's sessions and
    // emails each student a self-reschedule link — worth confirming first.
    if (asAdmin && !window.confirm(
      `Block ${formatDateShort(blockDateForm.date)}? Slots that day are cancelled and any booked students are emailed a link to pick a new time.`,
    )) return

    setBlockSaving(true)
    setError('')
    try {
      const res = await submitBlockDateRequest(counsellorId, blockDateForm.date, blockDateForm.reason || undefined)
      if (asAdmin) {
        // The counsellor's own flow queues a PENDING request for an admin to review;
        // an admin is that reviewer, so approve it straight away — approval is what
        // actually cancels the slots and sends the reschedule emails.
        await approveBlockRequest(res.data.id, blockDateForm.reason || 'Blocked by admin')
        setSuccess('Date blocked. Affected students have been emailed a reschedule link.')
      } else {
        setSuccess('Block date request submitted. Admin will review and approve it.')
      }
      setBlockDateForm({ date: '', reason: '' })
      reloadBlockRequests()
      if (asAdmin) { reloadSlots(); onChanged?.() }
    } catch {
      setError(asAdmin ? 'Failed to block the date.' : 'Failed to submit block date request.')
    } finally {
      setBlockSaving(false)
    }
  }

  const handleDeleteSlot = async (slotId: number) => {
    setDeletingSlot(slotId)
    try {
      await deleteSlot(slotId)
      setSuccess('Deleted successfully.')
      reloadSlots()
      onChanged?.()
    } catch {
      setError('Failed to delete.')
    } finally {
      setDeletingSlot(null)
    }
  }

  const dismissMessages = () => {
    setError('')
    setSuccess('')
  }

  // Keep only slots whose end time is still in the future — the list is titled
  // "Upcoming Slots" and the backend never expires past AVAILABLE slots, so without
  // this filter old unbooked days would linger and be shown as available.
  const upcomingSlots = manualSlots.filter((s: any) => {
    if (!s?.date || !s?.endTime) return true
    const end = new Date(`${s.date}T${s.endTime}`)
    return isNaN(end.getTime()) || end.getTime() > Date.now()
  })

  // Group upcoming slots by date
  const slotsByDate = new Map<string, any[]>()
  for (const s of upcomingSlots) {
    const key = s.date || ''
    const arr = slotsByDate.get(key) || []
    arr.push(s)
    slotsByDate.set(key, arr)
  }

  const statusStyle = (status: string): React.CSSProperties => {
    switch ((status || '').toUpperCase()) {
      case 'AVAILABLE': return { background: '#D1FAE5', color: '#065F46' }
      case 'REQUESTED': return { background: '#FEF3C7', color: '#92400E' }
      case 'BOOKED': return { background: '#DBEAFE', color: '#1E40AF' }
      default: return { background: '#F3F4F6', color: '#374151' }
    }
  }

  const availableCount = upcomingSlots.filter((s) => (s.status || '').toUpperCase() === 'AVAILABLE').length
  const bookedCount = upcomingSlots.filter((s) => ['REQUESTED', 'BOOKED', 'CONFIRMED'].includes((s.status || '').toUpperCase())).length

  return (
    <>
      {/* Alerts */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '10px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={dismissMessages} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontSize: 16 }}>&times;</button>
        </div>
      )}
      {success && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#065F46', padding: '10px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
          {success}
        </div>
      )}

      <div className={wrapperClassName}>
        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Slots', value: upcomingSlots.length, color: '#263B6A', bg: '#EFF6FF' },
            { label: 'Available', value: availableCount, color: '#065F46', bg: '#F0FDF4' },
            { label: 'Booked', value: bookedCount, color: '#0369A1', bg: '#F0F9FF' },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: stat.bg, borderRadius: 12, padding: '20px 18px', textAlign: 'center',
              border: '1px solid rgba(0,0,0,0.05)',
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
          {/* Left: Weekly Schedule + Slots by Date */}
          <div>
            {/* Weekly Schedule (recurring templates) */}
            <div style={{ marginBottom: 20 }}>
              <WeeklySchedulePanel
                counsellorIds={[counsellorId]}
                officeAddress={officeAddress}
                onOfficeAddressChange={setOfficeAddress}
                meetingLink={meetingLink}
                onMeetingLinkChange={setMeetingLink}
                // Lets the form warn about the dates that genuinely collide rather
                // than about every schedule sharing the weekday. Already excludes
                // blocked slots (they live in blockedDates).
                existingSlots={manualSlots}
                onChanged={handleScheduleChanged}
              />
            </div>

            <div style={{
              background: '#F8F9FC', borderRadius: 12, border: '1px solid #DDE3EC',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 18px', borderBottom: '1px solid #DDE3EC',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1E293B' }}>Upcoming Slots</div>
                <span style={{ fontSize: 12, color: '#64748B' }}>{upcomingSlots.length} slot(s)</span>
              </div>

              {upcomingSlots.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
                  No upcoming slots yet. Add a weekly schedule above or an extra slot on the right to get started.
                </div>
              ) : (
                <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                  {Array.from(slotsByDate.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, daySlots]) => (
                    <div key={date} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{
                        padding: '10px 18px', background: '#F8FAFC',
                        fontSize: 13, fontWeight: 700, color: '#334155',
                      }}>
                        {formatDateShort(date)}
                      </div>
                      <div style={{ padding: '10px 18px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {daySlots
                          .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''))
                          .map((s: any) => {
                          const sc = statusStyle(s.status)
                          const isAvailable = (s.status || '').toUpperCase() === 'AVAILABLE'
                          return (
                            <div key={s.id} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                              ...sc,
                            }}>
                              <span>{formatTime(s.startTime)} – {formatTime(s.endTime)}</span>
                              <span style={{ fontSize: 10, opacity: 0.7 }}>{(s.status || '').toUpperCase()}</span>
                              {/* Backend only permits deleting AVAILABLE (or blocked) slots */}
                              {isAvailable && (
                                <button
                                  onClick={() => handleDeleteSlot(s.id)}
                                  disabled={deletingSlot === s.id}
                                  title='Remove this slot'
                                  style={{
                                    background: 'none', border: 'none', padding: 0, marginLeft: 2,
                                    cursor: deletingSlot === s.id ? 'not-allowed' : 'pointer',
                                    color: 'inherit', opacity: 0.6, fontSize: 14, lineHeight: 1,
                                  }}
                                >
                                  &times;
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Extra Slot + Block Date + Blocked List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Add Extra Slot Form */}
            <div style={{
              background: '#F8F9FC', borderRadius: 12, border: '1px solid #DDE3EC', padding: 20,
            }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1E293B', marginBottom: 14 }}>
                Add Extra Slot
              </div>
              <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 14px' }}>
                Add a one-off slot outside the weekly schedule.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <DatePicker
                    selected={isoToDate(manualSlotForm.date)}
                    onChange={(d: Date | null) => setManualSlotForm((f) => ({ ...f, date: dateToIso(d) }))}
                    dateFormat='dd/MM/yyyy'
                    placeholderText='dd/mm/yyyy'
                    minDate={new Date()}
                    wrapperClassName='cp-datepicker'
                    customInput={<input style={inputStyle} />}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Start</label>
                    <input
                      type='time'
                      value={manualSlotForm.startTime}
                      onChange={(e) => setManualSlotForm((f) => ({ ...f, startTime: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>End</label>
                    <input
                      type='time'
                      value={manualSlotForm.endTime}
                      onChange={(e) => setManualSlotForm((f) => ({ ...f, endTime: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>
                {/* Session mode — an existing slot at the same time (any mode) blocks creating another */}
                <div>
                  <label style={labelStyle}>Session mode</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['ONLINE', 'OFFLINE'] as const).map((m) => {
                      const active = manualSlotForm.mode === m
                      return (
                        <button
                          key={m}
                          type='button'
                          onClick={() => setManualSlotForm((f) => ({ ...f, mode: m }))}
                          style={{
                            flex: 1, padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                            cursor: 'pointer',
                            border: active ? '1.5px solid #263B6A' : '1.5px solid #DDE3EC',
                            background: active ? 'rgba(38,59,106,0.08)' : '#fff',
                            color: active ? '#263B6A' : '#475569',
                          }}
                        >
                          {m === 'ONLINE' ? '💻 Online' : '📍 In-person'}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {manualSlotForm.mode === 'ONLINE' && (
                  <div>
                    <label style={labelStyle}>
                      Microsoft Teams meeting link <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      type='url'
                      required
                      aria-required='true'
                      value={meetingLink}
                      onChange={(e) => setMeetingLink(e.target.value)}
                      placeholder='https://teams.microsoft.com/l/meetup-join/...'
                      style={{
                        ...inputStyle,
                        borderColor: meetingLink.trim() && !isTeamsLink(meetingLink)
                          ? '#DC2626'
                          : (inputStyle as any).borderColor,
                      }}
                    />
                    <div style={{ fontSize: 11, color: '#6B7A8D', marginTop: 4 }}>
                      Saved to the profile when the slot is added.
                    </div>
                  </div>
                )}
                {manualSlotForm.mode === 'OFFLINE' && (
                  <div>
                    <label style={labelStyle}>Office address (shared with students)</label>
                    <textarea
                      value={officeAddress}
                      onChange={(e) => setOfficeAddress(e.target.value)}
                      placeholder='Building, street, area, city — where the student should come'
                      rows={2}
                      style={{ ...inputStyle, resize: 'vertical' as const }}
                    />
                  </div>
                )}
                {/* Same rule as the weekly form: an online slot with no Teams link
                    can be created but never joined, so block the save instead. */}
                <button
                  onClick={handleSaveManualSlot}
                  disabled={slotSaving || manualSlotLinkMissing}
                  title={manualSlotLinkMissing
                    ? meetingLink.trim()
                      ? 'The meeting link must be a Microsoft Teams link'
                      : 'Add the Microsoft Teams meeting link first'
                    : undefined}
                  style={{
                    width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 600,
                    border: 'none', borderRadius: 8, color: '#fff',
                    cursor: slotSaving || manualSlotLinkMissing ? 'not-allowed' : 'pointer',
                    background: slotSaving || manualSlotLinkMissing
                      ? '#9CA3AF'
                      : 'linear-gradient(135deg, #1C2D52, #263B6A)',
                  }}
                >
                  {slotSaving ? 'Adding…' : 'Add Slot'}
                </button>
              </div>
            </div>

            {/* Block Date Form */}
            <div style={{
              background: '#F8F9FC', borderRadius: 12, border: '1px solid #DDE3EC', padding: 20,
            }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1E293B', marginBottom: 14 }}>
                Block a Date
              </div>
              <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 14px' }}>
                {asAdmin
                  ? 'Blocks the date straight away. Sessions booked that day are cancelled and those students are emailed a link to pick a new time.'
                  : 'Submit a request to block a date. Admin will review and approve it.'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Date</label>
                  <DatePicker
                    selected={isoToDate(blockDateForm.date)}
                    onChange={(d: Date | null) => setBlockDateForm((f) => ({ ...f, date: dateToIso(d) }))}
                    dateFormat='dd/MM/yyyy'
                    placeholderText='dd/mm/yyyy'
                    minDate={new Date()}
                    wrapperClassName='cp-datepicker'
                    customInput={
                      <input style={{
                        width: '100%', padding: '9px 12px', border: '1.5px solid #DDE3EC',
                        borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }} />
                    }
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Reason (optional)</label>
                  <input
                    type='text'
                    value={blockDateForm.reason}
                    onChange={(e) => setBlockDateForm((f) => ({ ...f, reason: e.target.value }))}
                    placeholder='e.g. Personal leave, Holiday...'
                    style={{
                      width: '100%', padding: '9px 12px', border: '1.5px solid #DDE3EC',
                      borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <button
                  onClick={handleBlockDate}
                  disabled={blockSaving}
                  style={{
                    width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 600,
                    border: 'none', borderRadius: 8, cursor: blockSaving ? 'not-allowed' : 'pointer',
                    background: blockSaving ? '#9CA3AF' : '#DC2626', color: '#fff',
                  }}
                >
                  {blockSaving ? (asAdmin ? 'Blocking...' : 'Submitting...') : (asAdmin ? 'Block Date' : 'Request Block')}
                </button>
              </div>
            </div>

            {/* Blocked Dates List — visual-only regroup: date as heading, one row
                per cancelled slot underneath (each row keeps its own Remove). */}
            {blockedDates.length > 0 && (() => {
              const blockedByDate = new Map<string, any[]>()
              for (const s of blockedDates) {
                const key = s.date || (s.startTime ? String(s.startTime).split('T')[0] : '')
                const arr = blockedByDate.get(key) || []
                arr.push(s)
                blockedByDate.set(key, arr)
              }
              const groupedEntries = Array.from(blockedByDate.entries()).sort(([a], [b]) => a.localeCompare(b))
              return (
                <div style={{
                  background: '#F8F9FC', borderRadius: 12, border: '1px solid #DDE3EC', overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '14px 18px', borderBottom: '1px solid #DDE3EC',
                    fontWeight: 700, fontSize: 15, color: '#1E293B',
                  }}>
                    Blocked Dates ({groupedEntries.length})
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {groupedEntries.map(([date, daySlots]) => (
                      <div key={date} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{
                          padding: '10px 18px', background: '#FEF2F2',
                          fontSize: 13, fontWeight: 700, color: '#991B1B',
                        }}>
                          {formatDateShort(date)}
                        </div>
                        {daySlots
                          .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''))
                          .map((s: any) => (
                            <div key={s.id} style={{
                              padding: '10px 18px', borderTop: '1px solid #F8FAFC',
                            }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>
                                {formatTime(s.startTime)} – {formatTime(s.endTime)}
                              </div>
                              {s.reason && (
                                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{s.reason}</div>
                              )}
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Block Requests */}
            {blockRequests.length > 0 && (
              <div style={{
                background: '#F8F9FC', borderRadius: 12, border: '1px solid #DDE3EC', overflow: 'hidden',
              }}>
                <div style={{
                  padding: '14px 18px', borderBottom: '1px solid #DDE3EC',
                  fontWeight: 700, fontSize: 15, color: '#1E293B',
                }}>
                  {asAdmin ? 'Block Requests' : 'My Block Requests'}
                </div>
                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {blockRequests
                    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
                    .map((r) => {
                      const statusStyleMap: Record<string, { bg: string; color: string }> = {
                        PENDING: { bg: '#FEF3C7', color: '#92400E' },
                        APPROVED: { bg: '#D1FAE5', color: '#065F46' },
                        REJECTED: { bg: '#FEE2E2', color: '#991B1B' },
                      }
                      const sc = statusStyleMap[r.status] || { bg: '#F3F4F6', color: '#6B7280' }
                      return (
                        <div key={r.id} style={{
                          padding: '10px 18px', borderBottom: '1px solid #F8FAFC',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>
                              {formatDateShort(r.blockDate)}
                            </div>
                            {r.reason && (
                              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{r.reason}</div>
                            )}
                            {r.adminResponse && (
                              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, fontStyle: 'italic' }}>
                                Admin: {r.adminResponse}
                              </div>
                            )}
                          </div>
                          <span style={{
                            padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                            background: sc.bg, color: sc.color,
                          }}>
                            {r.status}
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default CounsellorAvailabilityPanel
