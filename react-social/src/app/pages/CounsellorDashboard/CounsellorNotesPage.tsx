import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PortalLayout, { MenuItem } from '../portal/PortalLayout'
import { getCounsellorAppointments } from '../Counselling/API/AppointmentAPI'
import { getSessionNotes, createSessionNotes } from '../Counselling/API/SessionNotesAPI'
import { getCounsellorByUserId } from '../Counselling/API/CounsellorAPI'
import { useRefreshInterval } from '../../utils/useAutoRefresh'
import './CounsellorPortal.css'

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

interface NotesFormState {
  keyDiscussionPoints: string
  actionItems: string
  recommendedNextSession: string
  followUpRequired: boolean
  publicRemarks: string
  privateNotes: string
}

const defaultNotesForm = (): NotesFormState => ({
  keyDiscussionPoints: '',
  actionItems: '',
  recommendedNextSession: '',
  followUpRequired: false,
  publicRemarks: '',
  privateNotes: '',
})

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function getStudentName(appt: any): string {
  if (!appt) return 'Unknown Student'
  if (appt.student) {
    return appt.student.studentInfo?.name || appt.student.name || 'Unknown Student'
  }
  return appt.studentName || 'Unknown Student'
}

const CounsellorNotesPage: React.FC = () => {
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<any[]>([])
  const [userId, setUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Map of appointmentId -> existing notes data
  const [notesMap, setNotesMap] = useState<Record<number, any>>({})
  // Map of appointmentId -> whether form is expanded
  const [expandedForms, setExpandedForms] = useState<Record<number, boolean>>({})
  // Map of appointmentId -> form state
  const [formStates, setFormStates] = useState<Record<number, NotesFormState>>({})
  // Map of appointmentId -> saving status
  const [savingMap, setSavingMap] = useState<Record<number, boolean>>({})
  const [counsellorId, setCounsellorId] = useState<number | null>(null)

  useRefreshInterval(async () => {
    if (!counsellorId) return
    try {
      const apptRes = await getCounsellorAppointments(counsellorId)
      const completed = (apptRes.data || []).filter(
        (a: any) => (a.status || '').toUpperCase() === 'COMPLETED'
      )
      setAppointments(completed)
      const notesResults: Record<number, any> = {}
      await Promise.all(
        completed.map(async (appt: any) => {
          try {
            const nr = await getSessionNotes(appt.id, false)
            if (nr.data) notesResults[appt.id] = nr.data
          } catch {}
        })
      )
      setNotesMap(notesResults)
    } catch {}
  }, { skip: !counsellorId })

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('counsellorPortalLoggedIn')
    if (!isLoggedIn) {
      navigate('/counsellor/login')
      return
    }
    try {
      const userStr = localStorage.getItem('counsellorPortalUser')
      if (!userStr) {
        setLoading(false)
        return
      }
      const user = JSON.parse(userStr)
      setUserId(user.counsellorId || user.id)

      const loadForCounsellor = async (cId: number) => {
        const apptRes = await getCounsellorAppointments(cId)
        const allAppts: any[] = apptRes.data || []
        const completed = allAppts.filter(
          (a) => (a.status || '').toUpperCase() === 'COMPLETED'
        )
        setAppointments(completed)
        const notesResults: Record<number, any> = {}
        await Promise.all(
          completed.map(async (appt) => {
            try {
              const nr = await getSessionNotes(appt.id, false)
              if (nr.data) notesResults[appt.id] = nr.data
            } catch {
              // No notes yet
            }
          })
        )
        setNotesMap(notesResults)
      }

      // New login flow stores counsellorId directly
      const cId = user.counsellorId || null
      if (cId) {
        setCounsellorId(cId)
        loadForCounsellor(cId)
          .catch(() => setError('Failed to load session notes.'))
          .finally(() => setLoading(false))
      } else if (user.id) {
        // Legacy flow — resolve counsellorId from userId
        getCounsellorByUserId(user.id)
          .then((res) => {
            const resolvedId = res.data?.id
            if (!resolvedId) {
              setError('Counsellor profile not found. Please contact admin to set up your profile.')
              setLoading(false)
              return
            }
            setCounsellorId(resolvedId)
            return loadForCounsellor(resolvedId)
          })
          .catch(() => setError('Counsellor profile not found. Please contact admin to set up your profile.'))
          .finally(() => setLoading(false))
      } else {
        setError('Counsellor profile not found. Please contact admin to set up your profile.')
        setLoading(false)
      }
    } catch {
      navigate('/counsellor/login')
    }
  }, [navigate])

  const toggleForm = (appointmentId: number) => {
    setExpandedForms((prev) => {
      const isOpen = !!prev[appointmentId]
      if (!isOpen && !formStates[appointmentId]) {
        setFormStates((fs) => ({ ...fs, [appointmentId]: defaultNotesForm() }))
      }
      return { ...prev, [appointmentId]: !isOpen }
    })
  }

  const updateForm = (appointmentId: number, field: keyof NotesFormState, value: any) => {
    setFormStates((prev) => ({
      ...prev,
      [appointmentId]: { ...(prev[appointmentId] || defaultNotesForm()), [field]: value },
    }))
  }

  const handleSave = async (appointmentId: number) => {
    if (!userId) return
    const form = formStates[appointmentId] || defaultNotesForm()
    setSavingMap((prev) => ({ ...prev, [appointmentId]: true }))
    try {
      const payload = {
        appointmentId,
        keyDiscussionPoints: form.keyDiscussionPoints,
        actionItems: form.actionItems,
        recommendedNextSession: form.recommendedNextSession,
        followUpRequired: form.followUpRequired,
        publicRemarks: form.publicRemarks,
        privateNotes: form.privateNotes,
      }
      const res = await createSessionNotes(payload, userId)
      setNotesMap((prev) => ({ ...prev, [appointmentId]: res.data }))
      setExpandedForms((prev) => ({ ...prev, [appointmentId]: false }))
    } catch {
      setError('Failed to save notes. Please try again.')
    } finally {
      setSavingMap((prev) => ({ ...prev, [appointmentId]: false }))
    }
  }

  return (
    <PortalLayout
      title='Counsellor Dashboard'
      menuItems={COUNSELLOR_MENU_ITEMS}
      storageKeys={COUNSELLOR_STORAGE_KEYS}
      loginPath='/counsellor/login'
    >
      <div className='cp-welcome'>
        <h2 className='cp-welcome-title'>Session Notes</h2>
        <p className='cp-welcome-sub'>Review and add notes for completed counselling sessions</p>
      </div>

      {error && (
        <div
          style={{
            background: '#FEE2E2',
            color: '#991B1B',
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
          <button
            onClick={() => setError('')}
            style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontWeight: 700 }}
          >
            x
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6B7A8D', fontSize: 14 }}>
          Loading sessions...
        </div>
      ) : appointments.length === 0 ? (
        <div className='cp-card' style={{ textAlign: 'center', padding: 40, color: '#6B7A8D', fontSize: 14 }}>
          No completed sessions found yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {appointments.map((appt) => {
            const existingNotes = notesMap[appt.id]
            const isFormOpen = !!expandedForms[appt.id]
            const form = formStates[appt.id] || defaultNotesForm()
            const isSaving = !!savingMap[appt.id]
            const slotDate = appt.slot?.startTime || appt.scheduledAt || ''
            const studentName = getStudentName(appt)

            return (
              <div key={appt.id} className='cp-card'>
                {/* Session header */}
                <div className='cp-note-item' style={{ marginBottom: existingNotes || isFormOpen ? 12 : 0 }}>
                  <div className='cp-note-meta'>
                    <span>{studentName}</span>
                    <span>{formatDate(slotDate)}</span>
                  </div>
                  {appt.reason && (
                    <div className='cp-note-text' style={{ marginBottom: 8, color: '#6B7A8D', fontSize: 11 }}>
                      Reason: {appt.reason}
                    </div>
                  )}

                  {/* Existing notes preview */}
                  {existingNotes && (
                    <div style={{ marginTop: 6 }}>
                      {existingNotes.keyDiscussionPoints && (
                        <div style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#6B7A8D', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Key Points
                          </span>
                          <div className='cp-note-text' style={{ marginTop: 2 }}>
                            {existingNotes.keyDiscussionPoints}
                          </div>
                        </div>
                      )}
                      {existingNotes.publicRemarks && (
                        <div style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#6B7A8D', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Remarks
                          </span>
                          <div className='cp-note-text' style={{ marginTop: 2 }}>
                            {existingNotes.publicRemarks}
                          </div>
                        </div>
                      )}
                      {existingNotes.followUpRequired && (
                        <span
                          style={{
                            display: 'inline-block',
                            background: '#FEF3C7',
                            color: '#92400E',
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 10,
                            marginTop: 4,
                          }}
                        >
                          Follow-up Required
                        </span>
                      )}
                    </div>
                  )}

                  {/* Toggle button */}
                  {!existingNotes && (
                    <button
                      className='cp-action-btn cp-action-btn-primary'
                      onClick={() => toggleForm(appt.id)}
                      style={{ marginTop: 8, fontSize: 11, padding: '6px 14px' }}
                    >
                      {isFormOpen ? 'Cancel' : 'Add Notes'}
                    </button>
                  )}
                  {existingNotes && (
                    <button
                      className='cp-action-btn'
                      onClick={() => toggleForm(appt.id)}
                      style={{ marginTop: 8, fontSize: 11, padding: '6px 14px' }}
                    >
                      {isFormOpen ? 'Cancel Edit' : 'Edit Notes'}
                    </button>
                  )}
                </div>

                {/* Inline notes form */}
                {isFormOpen && (
                  <div
                    style={{
                      borderTop: '1px solid #DDE3EC',
                      paddingTop: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7A8D', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 4 }}>
                        Key Discussion Points
                      </label>
                      <textarea
                        value={form.keyDiscussionPoints}
                        onChange={(e) => updateForm(appt.id, 'keyDiscussionPoints', e.target.value)}
                        rows={3}
                        placeholder='What was discussed in this session...'
                        style={{
                          width: '100%', padding: '8px 12px', border: '1px solid #DDE3EC',
                          borderRadius: 8, fontSize: 13, resize: 'vertical', outline: 'none',
                          fontFamily: 'inherit', boxSizing: 'border-box', color: '#1A1F2E',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7A8D', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 4 }}>
                        Action Items
                      </label>
                      <textarea
                        value={form.actionItems}
                        onChange={(e) => updateForm(appt.id, 'actionItems', e.target.value)}
                        rows={2}
                        placeholder='Tasks or steps agreed upon...'
                        style={{
                          width: '100%', padding: '8px 12px', border: '1px solid #DDE3EC',
                          borderRadius: 8, fontSize: 13, resize: 'vertical', outline: 'none',
                          fontFamily: 'inherit', boxSizing: 'border-box', color: '#1A1F2E',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7A8D', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 4 }}>
                        Recommended Next Session
                      </label>
                      <input
                        type='text'
                        value={form.recommendedNextSession}
                        onChange={(e) => updateForm(appt.id, 'recommendedNextSession', e.target.value)}
                        placeholder='e.g. In 2 weeks, after results...'
                        style={{
                          width: '100%', padding: '8px 12px', border: '1px solid #DDE3EC',
                          borderRadius: 8, fontSize: 13, outline: 'none',
                          fontFamily: 'inherit', boxSizing: 'border-box', color: '#1A1F2E',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type='checkbox'
                        id={`followUp-${appt.id}`}
                        checked={form.followUpRequired}
                        onChange={(e) => updateForm(appt.id, 'followUpRequired', e.target.checked)}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                      <label
                        htmlFor={`followUp-${appt.id}`}
                        style={{ fontSize: 13, color: '#1A1F2E', cursor: 'pointer' }}
                      >
                        Follow-up Required
                      </label>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7A8D', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 4 }}>
                        Public Remarks
                        <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 6, color: '#6984A9' }}>
                          Visible to student
                        </span>
                      </label>
                      <textarea
                        value={form.publicRemarks}
                        onChange={(e) => updateForm(appt.id, 'publicRemarks', e.target.value)}
                        rows={2}
                        placeholder='Remarks that will be visible to the student...'
                        style={{
                          width: '100%', padding: '8px 12px', border: '1px solid #DDE3EC',
                          borderRadius: 8, fontSize: 13, resize: 'vertical', outline: 'none',
                          fontFamily: 'inherit', boxSizing: 'border-box', color: '#1A1F2E',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7A8D', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 4 }}>
                        Private Notes
                        <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 6, color: '#6984A9' }}>
                          Only visible to you and admin
                        </span>
                      </label>
                      <textarea
                        value={form.privateNotes}
                        onChange={(e) => updateForm(appt.id, 'privateNotes', e.target.value)}
                        rows={2}
                        placeholder='Internal notes not shared with the student...'
                        style={{
                          width: '100%', padding: '8px 12px', border: '1px solid #DDE3EC',
                          borderRadius: 8, fontSize: 13, resize: 'vertical', outline: 'none',
                          fontFamily: 'inherit', boxSizing: 'border-box', color: '#1A1F2E',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button
                        className='cp-action-btn'
                        onClick={() => toggleForm(appt.id)}
                        disabled={isSaving}
                      >
                        Cancel
                      </button>
                      <button
                        className='cp-action-btn cp-action-btn-primary'
                        onClick={() => handleSave(appt.id)}
                        disabled={isSaving}
                      >
                        {isSaving ? 'Saving...' : 'Save Notes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </PortalLayout>
  )
}

export default CounsellorNotesPage
