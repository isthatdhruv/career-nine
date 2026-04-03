import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import PortalLayout, { MenuItem } from '../portal/PortalLayout'
import { getCounsellorByUserId } from '../Counselling/API/CounsellorAPI'
import { createManualSlot, blockDate, deleteSlot, getSlotsByCounsellor } from '../Counselling/API/SlotAPI'
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
    label: 'Students',
    path: '/counsellor/students',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
        <circle cx='9' cy='7' r='4' />
        <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
        <path d='M16 3.13a4 4 0 0 1 0 7.75' />
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
    label: 'Messages',
    path: '/counsellor/messages',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
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
    const d = new Date(dateStr)
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
        getCounsellorByUserId(user.id)
          .then((res) => {
            const cId = res.data?.id
            if (!cId) {
              setError('Counsellor profile not linked yet. Please contact admin to set up your profile.')
              setLoading(false)
              return
            }
            setCounsellorId(cId)
            return Promise.all([
              axios.get(`${API_URL}/api/availability-template/get/by-counsellor/${cId}`),
              getSlotsByCounsellor(cId),
            ]).then(([tRes, sRes]) => {
              setTemplates(tRes.data || [])
              const slots: any[] = sRes.data || []
              setManualSlots(slots.filter((s: any) => s.isManuallyCreated && !s.isBlocked))
              setBlockedDates(slots.filter((s: any) => s.isBlocked))
            })
          })
          .catch(() => setError('Counsellor profile not found. Please contact admin to set up your profile.'))
          .finally(() => setLoading(false))
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
        setManualSlots(slots.filter((s) => s.isManuallyCreated && !s.isBlocked))
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
      await blockDate({
        counsellorId,
        date: blockDateForm.date,
        reason: blockDateForm.reason || 'Blocked by counsellor',
        isBlocked: true,
      })
      setSuccess('Date blocked.')
      reloadSlots()
      setBlockDateForm({ date: '', reason: '' })
    } catch {
      setError('Failed to block date.')
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

  return (
    <PortalLayout
      title='Counsellor Dashboard'
      menuItems={COUNSELLOR_MENU_ITEMS}
      storageKeys={COUNSELLOR_STORAGE_KEYS}
      loginPath='/counsellor/login'
    >
      <div className='cp-welcome'>
        <h2 className='cp-welcome-title'>Availability</h2>
        <p className='cp-welcome-sub'>Manage your recurring schedule and manual overrides</p>
      </div>

      {error && (
        <div
          style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px 16px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}
        >
          {error}
          <button onClick={dismissMessages} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontWeight: 700 }}>
            x
          </button>
        </div>
      )}

      {success && (
        <div
          style={{ background: '#D1FAE5', color: '#065F46', padding: '10px 16px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}
        >
          {success}
          <button onClick={dismissMessages} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#065F46', fontWeight: 700 }}>
            x
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6B7A8D', fontSize: 14 }}>
          Loading availability...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* ── LEFT: Recurring Weekly Schedule ── */}
          <div>
            <div className='cp-card' style={{ marginBottom: 16 }}>
              <div className='cp-card-title'>Recurring Weekly Schedule</div>

              {templates.length === 0 ? (
                <div style={{ fontSize: 13, color: '#6B7A8D', marginBottom: 14, fontStyle: 'italic' }}>
                  No templates set yet.
                </div>
              ) : (
                <div style={{ marginBottom: 14 }}>
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: '#F8F9FC',
                        border: '1px solid #DDE3EC',
                        borderLeft: '3px solid #6984A9',
                        borderRadius: 6,
                        marginBottom: 8,
                        fontSize: 12,
                        gap: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#263B6A', marginBottom: 2 }}>
                          {t.dayOfWeek}
                        </div>
                        <div style={{ color: '#6B7A8D' }}>
                          {formatTime(t.startTime)} – {formatTime(t.endTime)}
                          &nbsp;&middot;&nbsp;
                          {t.slotDurationMinutes} min slots
                        </div>
                      </div>
                      <button
                        className='cp-action-btn'
                        onClick={() => handleDeleteTemplate(t.id)}
                        disabled={deletingTemplate === t.id}
                        style={{ fontSize: 11, padding: '4px 10px', color: '#DC2626', borderColor: '#FCA5A5', flexShrink: 0 }}
                      >
                        {deletingTemplate === t.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Template Form */}
            <div className='cp-card'>
              <div className='cp-card-title'>Add Recurring Template</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Day of Week</label>
                  <select
                    value={templateForm.dayOfWeek}
                    onChange={(e) => setTemplateForm((f) => ({ ...f, dayOfWeek: e.target.value }))}
                    style={inputStyle}
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Start Time</label>
                    <input
                      type='time'
                      value={templateForm.startTime}
                      onChange={(e) => setTemplateForm((f) => ({ ...f, startTime: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>End Time</label>
                    <input
                      type='time'
                      value={templateForm.endTime}
                      onChange={(e) => setTemplateForm((f) => ({ ...f, endTime: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Slot Duration (minutes)</label>
                  <input
                    type='number'
                    min={5}
                    max={120}
                    value={templateForm.slotDurationMinutes}
                    onChange={(e) =>
                      setTemplateForm((f) => ({ ...f, slotDurationMinutes: parseInt(e.target.value, 10) || 30 }))
                    }
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    className='cp-action-btn cp-action-btn-primary'
                    onClick={handleSaveTemplate}
                    disabled={templateSaving}
                  >
                    {templateSaving ? 'Saving...' : 'Save Template'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Manual Overrides ── */}
          <div>
            {/* Manual Slots list */}
            {manualSlots.length > 0 && (
              <div className='cp-card' style={{ marginBottom: 16 }}>
                <div className='cp-card-title'>Extra Slots</div>
                {manualSlots.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: '#F8F9FC',
                      border: '1px solid #DDE3EC',
                      borderLeft: '3px solid #059669',
                      borderRadius: 6,
                      marginBottom: 8,
                      fontSize: 12,
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: '#065F46', marginBottom: 2 }}>
                        {formatDateShort(s.startTime || s.date)}
                      </div>
                      <div style={{ color: '#6B7A8D' }}>
                        {formatTime(s.startTime)} – {formatTime(s.endTime)}
                        {s.durationMinutes ? ` · ${s.durationMinutes} min` : ''}
                      </div>
                    </div>
                    <button
                      className='cp-action-btn'
                      onClick={() => handleDeleteSlot(s.id)}
                      disabled={deletingSlot === s.id}
                      style={{ fontSize: 11, padding: '4px 10px', color: '#DC2626', borderColor: '#FCA5A5', flexShrink: 0 }}
                    >
                      {deletingSlot === s.id ? '...' : 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Blocked Dates list */}
            {blockedDates.length > 0 && (
              <div className='cp-card' style={{ marginBottom: 16 }}>
                <div className='cp-card-title'>Blocked Dates</div>
                {blockedDates.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      borderLeft: '3px solid #DC2626',
                      borderRadius: 6,
                      marginBottom: 8,
                      fontSize: 12,
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: '#991B1B', marginBottom: 2 }}>
                        {formatDateShort(s.date || s.startTime)}
                      </div>
                      {s.reason && (
                        <div style={{ color: '#6B7A8D' }}>{s.reason}</div>
                      )}
                    </div>
                    <button
                      className='cp-action-btn'
                      onClick={() => handleDeleteSlot(s.id)}
                      disabled={deletingSlot === s.id}
                      style={{ fontSize: 11, padding: '4px 10px', color: '#DC2626', borderColor: '#FCA5A5', flexShrink: 0 }}
                    >
                      {deletingSlot === s.id ? '...' : 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Extra Slot Form */}
            <div className='cp-card' style={{ marginBottom: 16 }}>
              <div className='cp-card-title'>Add Extra Slot</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input
                    type='date'
                    value={manualSlotForm.date}
                    onChange={(e) => setManualSlotForm((f) => ({ ...f, date: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Start Time</label>
                    <input
                      type='time'
                      value={manualSlotForm.startTime}
                      onChange={(e) => setManualSlotForm((f) => ({ ...f, startTime: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>End Time</label>
                    <input
                      type='time'
                      value={manualSlotForm.endTime}
                      onChange={(e) => setManualSlotForm((f) => ({ ...f, endTime: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Duration (minutes)</label>
                  <input
                    type='number'
                    min={5}
                    max={120}
                    value={manualSlotForm.durationMinutes}
                    onChange={(e) =>
                      setManualSlotForm((f) => ({ ...f, durationMinutes: parseInt(e.target.value, 10) || 30 }))
                    }
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    className='cp-action-btn cp-action-btn-primary'
                    onClick={handleSaveManualSlot}
                    disabled={slotSaving}
                  >
                    {slotSaving ? 'Adding...' : 'Add Slot'}
                  </button>
                </div>
              </div>
            </div>

            {/* Block Date Form */}
            <div className='cp-card'>
              <div className='cp-card-title'>Block a Date</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input
                    type='date'
                    value={blockDateForm.date}
                    onChange={(e) => setBlockDateForm((f) => ({ ...f, date: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Reason (optional)</label>
                  <input
                    type='text'
                    value={blockDateForm.reason}
                    onChange={(e) => setBlockDateForm((f) => ({ ...f, reason: e.target.value }))}
                    placeholder='e.g. Exam day, Holiday...'
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    className='cp-action-btn'
                    onClick={handleBlockDate}
                    disabled={blockSaving}
                    style={{ background: '#DC2626', color: '#fff', borderColor: '#DC2626' }}
                  >
                    {blockSaving ? 'Blocking...' : 'Block Date'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  )
}

export default CounsellorAvailabilityPage
