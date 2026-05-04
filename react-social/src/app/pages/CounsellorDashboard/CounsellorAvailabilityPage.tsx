import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import PortalLayout, { MenuItem } from '../portal/PortalLayout'
import { getCounsellorByUserId } from '../Counselling/API/CounsellorAPI'
import { getSlotsByCounsellor, createManualSlot, deleteSlot } from '../Counselling/API/SlotAPI'
import { submitBlockDateRequest, getBlockRequestsByCounsellor, BlockDateRequest } from '../Counselling/API/BlockDateRequestAPI'
import { useRefreshInterval } from '../../utils/useAutoRefresh'
import './CounsellorPortal.css'

const API_URL = process.env.REACT_APP_API_URL

const COUNSELLOR_MENU_ITEMS: MenuItem[] = [
  {
    label: 'Dashboard',
    path: '/counsellor/dashboard',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <rect x='3' y='3' width='7' height='7' rx='1' />
        <rect x='14' y='3' width='7' height='7' rx='1' />
        <rect x='3' y='14' width='7' height='7' rx='1' />
        <rect x='14' y='14' width='7' height='7' rx='1' />
      </svg>
    ),
  },
  {
    label: 'Appointments',
    path: '/counsellor/appointments',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <rect x='3' y='4' width='18' height='18' rx='2' ry='2' />
        <line x1='16' y1='2' x2='16' y2='6' />
        <line x1='8' y1='2' x2='8' y2='6' />
        <line x1='3' y1='10' x2='21' y2='10' />
      </svg>
    ),
  },
  {
    label: 'Session Notes',
    path: '/counsellor/notes',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
        <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
      </svg>
    ),
  },
  {
    label: 'Availability',
    path: '/counsellor/availability',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <circle cx='12' cy='12' r='10' />
        <polyline points='12 6 12 12 16 14' />
      </svg>
    ),
  },
  {
    label: 'Reports',
    path: '/counsellor/reports',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <line x1='18' y1='20' x2='18' y2='10' />
        <line x1='12' y1='20' x2='12' y2='4' />
        <line x1='6' y1='20' x2='6' y2='14' />
      </svg>
    ),
  },
  {
    label: 'My Profile',
    path: '/counsellor/profile',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
        <circle cx='12' cy='7' r='4' />
      </svg>
    ),
  },
]

const COUNSELLOR_STORAGE_KEYS = ['counsellorPortalToken', 'counsellorPortalUser', 'counsellorPortalLoggedIn']

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

interface TemplateForm {
  dayOfWeek: string
  startTime: string
  endTime: string
  slotDurationMinutes: number
}

interface ManualSlotForm {
  date: string
  startTime: string
  endTime: string
  durationMinutes: number
}

interface BlockDateForm {
  date: string
  reason: string
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

const CounsellorAvailabilityPage: React.FC = () => {
  const navigate = useNavigate()
  const [counsellorId, setCounsellorId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Templates
  const [templates, setTemplates] = useState<any[]>([])
  const [templateForm, setTemplateForm] = useState<TemplateForm>({
    dayOfWeek: 'Monday',
    startTime: '09:00',
    endTime: '17:00',
    slotDurationMinutes: 30,
  })
  const [templateSaving, setTemplateSaving] = useState(false)
  const [deletingTemplate, setDeletingTemplate] = useState<number | null>(null)

  // Manual slots & blocks
  const [manualSlots, setManualSlots] = useState<any[]>([])
  const [blockedDates, setBlockedDates] = useState<any[]>([])
  const [blockRequests, setBlockRequests] = useState<BlockDateRequest[]>([])
  const [manualSlotForm, setManualSlotForm] = useState<ManualSlotForm>({
    date: '',
    startTime: '',
    endTime: '',
    durationMinutes: 30,
  })
  const [blockDateForm, setBlockDateForm] = useState<BlockDateForm>({ date: '', reason: '' })
  const [slotSaving, setSlotSaving] = useState(false)
  const [blockSaving, setBlockSaving] = useState(false)
  const [deletingSlot, setDeletingSlot] = useState<number | null>(null)

  const refreshAvailability = useCallback(() => {
    if (!counsellorId) return
    Promise.all([
      axios.get(`${API_URL}/api/availability-template/get/by-counsellor/${counsellorId}`),
      getSlotsByCounsellor(counsellorId),
      getBlockRequestsByCounsellor(counsellorId).catch(() => ({ data: [] })),
    ]).then(([tRes, sRes, brRes]) => {
      setTemplates(tRes.data || [])
      const slots: any[] = sRes.data || []
      setManualSlots(slots.filter((s: any) => !s.isBlocked))
      setBlockedDates(slots.filter((s: any) => s.isBlocked))
      setBlockRequests(Array.isArray(brRes.data) ? brRes.data : [])
    }).catch(() => {})
  }, [counsellorId])

  useRefreshInterval(refreshAvailability, { skip: !counsellorId })

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('counsellorPortalLoggedIn')
    if (!isLoggedIn) {
      navigate('/counsellor/login')
      return
    }
    try {
      const userStr = localStorage.getItem('counsellorPortalUser')
      if (userStr) {
        const user = JSON.parse(userStr)
        const cId = user.counsellorId || null

        const loadData = (id: number) => {
          setCounsellorId(id)
          return Promise.all([
            axios.get(`${API_URL}/api/availability-template/get/by-counsellor/${id}`),
            getSlotsByCounsellor(id),
            getBlockRequestsByCounsellor(id).catch(() => ({ data: [] })),
          ]).then(([tRes, sRes, brRes]) => {
            setTemplates(tRes.data || [])
            const slots: any[] = sRes.data || []
            setManualSlots(slots.filter((s: any) => !s.isBlocked))
            setBlockedDates(slots.filter((s: any) => s.isBlocked))
            setBlockRequests(Array.isArray(brRes.data) ? brRes.data : [])
          })
        }

        if (cId) {
          loadData(cId)
            .catch(() => setError('Failed to load availability data.'))
            .finally(() => setLoading(false))
        } else if (user.id) {
          getCounsellorByUserId(user.id)
            .then((res) => {
              const resolvedId = res.data?.id
              if (!resolvedId) {
                setError('Counsellor profile not found.')
                setLoading(false)
                return
              }
              return loadData(resolvedId)
            })
            .catch(() => setError('Counsellor profile not found.'))
            .finally(() => setLoading(false))
        } else {
          setLoading(false)
        }
      }
    } catch {
      navigate('/counsellor/login')
    }
  }, [navigate])

  const reloadTemplates = () => {
    if (!counsellorId) return
    axios
      .get(`${API_URL}/api/availability-template/get/by-counsellor/${counsellorId}`)
      .then((res) => setTemplates(res.data || []))
      .catch(() => setError('Failed to reload templates.'))
  }

  const reloadSlots = () => {
    if (!counsellorId) return
    getSlotsByCounsellor(counsellorId)
      .then((res) => {
        const slots: any[] = res.data || []
        setManualSlots(slots.filter((s) => !s.isBlocked))
        setBlockedDates(slots.filter((s) => s.isBlocked))
      })
      .catch(() => setError('Failed to reload slots.'))
  }

  const handleSaveTemplate = async () => {
    if (!counsellorId) return
    if (!templateForm.startTime || !templateForm.endTime) {
      setError('Please fill in start time and end time.')
      return
    }
    setTemplateSaving(true)
    setError('')
    try {
      await axios.post(`${API_URL}/api/availability-template/create`, {
        counsellorId,
        dayOfWeek: templateForm.dayOfWeek,
        startTime: templateForm.startTime,
        endTime: templateForm.endTime,
        slotDurationMinutes: templateForm.slotDurationMinutes,
      })
      setSuccess('Template saved successfully.')
      reloadTemplates()
      setTemplateForm({ dayOfWeek: 'Monday', startTime: '09:00', endTime: '17:00', slotDurationMinutes: 30 })
    } catch {
      setError('Failed to save template.')
    } finally {
      setTemplateSaving(false)
    }
  }

  const handleDeleteTemplate = async (templateId: number) => {
    setDeletingTemplate(templateId)
    try {
      await axios.delete(`${API_URL}/api/availability-template/delete/${templateId}`)
      setSuccess('Template deleted.')
      reloadTemplates()
    } catch {
      setError('Failed to delete template.')
    } finally {
      setDeletingTemplate(null)
    }
  }

  const handleSaveManualSlot = async () => {
    if (!counsellorId) return
    if (!manualSlotForm.date || !manualSlotForm.startTime || !manualSlotForm.endTime) {
      setError('Please fill in date, start time, and end time.')
      return
    }
    setSlotSaving(true)
    setError('')
    try {
      await createManualSlot({
        counsellorId,
        date: manualSlotForm.date,
        startTime: `${manualSlotForm.date}T${manualSlotForm.startTime}:00`,
        endTime: `${manualSlotForm.date}T${manualSlotForm.endTime}:00`,
        durationMinutes: manualSlotForm.durationMinutes,
        isManuallyCreated: true,
      })
      setSuccess('Extra slot added.')
      reloadSlots()
      setManualSlotForm({ date: '', startTime: '', endTime: '', durationMinutes: 30 })
    } catch {
      setError('Failed to add slot.')
    } finally {
      setSlotSaving(false)
    }
  }

  const handleBlockDate = async () => {
    if (!counsellorId) return
    if (!blockDateForm.date) {
      setError('Please select a date to block.')
      return
    }
    setBlockSaving(true)
    setError('')
    try {
      await submitBlockDateRequest(counsellorId, blockDateForm.date, blockDateForm.reason || undefined)
      setSuccess('Block date request submitted. Admin will review and approve it.')
      setBlockDateForm({ date: '', reason: '' })
      // Reload block requests
      getBlockRequestsByCounsellor(counsellorId)
        .then((res) => setBlockRequests(Array.isArray(res.data) ? res.data : []))
        .catch(() => {})
    } catch {
      setError('Failed to submit block date request.')
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
    <PortalLayout
      title='Counsellor Dashboard'
      menuItems={COUNSELLOR_MENU_ITEMS}
      storageKeys={COUNSELLOR_STORAGE_KEYS}
      loginPath='/counsellor/login'
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1E293B' }}>My Availability</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>View your assigned slots and block unavailable dates</p>
        </div>
      </div>

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

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748B', fontSize: 14 }}>Loading availability...</div>
      ) : (
        <>
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
            {/* Left: Slots by Date */}
            <div>
              <div style={{
                background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '14px 18px', borderBottom: '1px solid #E2E8F0',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#1E293B' }}>Upcoming Slots</div>
                  <span style={{ fontSize: 12, color: '#64748B' }}>{upcomingSlots.length} slot(s)</span>
                </div>

                {upcomingSlots.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
                    No upcoming slots. Contact admin to set up your schedule.
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
                            return (
                              <div key={s.id} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                ...sc,
                              }}>
                                <span>{formatTime(s.startTime)} – {formatTime(s.endTime)}</span>
                                <span style={{ fontSize: 10, opacity: 0.7 }}>{(s.status || '').toUpperCase()}</span>
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

            {/* Right: Block Date + Blocked List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Block Date Form */}
              <div style={{
                background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20,
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1E293B', marginBottom: 14 }}>
                  Block a Date
                </div>
                <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 14px' }}>
                  Submit a request to block a date. Admin will review and approve it.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Date</label>
                    <input
                      type='date'
                      value={blockDateForm.date}
                      onChange={(e) => setBlockDateForm((f) => ({ ...f, date: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                      style={{
                        width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0',
                        borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
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
                        width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0',
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
                    {blockSaving ? 'Submitting...' : 'Request Block'}
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
                    background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '14px 18px', borderBottom: '1px solid #E2E8F0',
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
                  background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '14px 18px', borderBottom: '1px solid #E2E8F0',
                    fontWeight: 700, fontSize: 15, color: '#1E293B',
                  }}>
                    My Block Requests
                  </div>
                  <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                    {blockRequests
                      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
                      .map((r) => {
                        const statusStyle: Record<string, { bg: string; color: string }> = {
                          PENDING: { bg: '#FEF3C7', color: '#92400E' },
                          APPROVED: { bg: '#D1FAE5', color: '#065F46' },
                          REJECTED: { bg: '#FEE2E2', color: '#991B1B' },
                        }
                        const sc = statusStyle[r.status] || { bg: '#F3F4F6', color: '#6B7280' }
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
        </>
      )}
    </PortalLayout>
  )
}

export default CounsellorAvailabilityPage
