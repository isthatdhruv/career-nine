import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../portal/PortalLayout'
import { getCounsellorAppointments } from '../Counselling/API/AppointmentAPI'
import { getSessionNotes, createSessionNotes } from '../Counselling/API/SessionNotesAPI'
import { getCounsellorByUserId } from '../Counselling/API/CounsellorAPI'
import { useAuth } from '../../modules/auth'
import { useRefreshInterval } from '../../utils/useAutoRefresh'
import { COUNSELLOR_MENU_ITEMS } from './counsellorMenu'
import './CounsellorPortal.css'

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
  const { currentUser } = useAuth()
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
    // Phase 19: use useAuth().currentUser instead of localStorage.
    // TODO(phase-19-followup): /auth/me does not yet expose counsellorId; resolve
    // it via getCounsellorByUserId until the backend payload includes it.
    if (!currentUser) {
      navigate('/counsellor/login', { replace: true })
      return
    }
    setUserId(currentUser.id)

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

    getCounsellorByUserId(currentUser.id)
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
  }, [currentUser, navigate])

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
      storageKeys={[]}
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
