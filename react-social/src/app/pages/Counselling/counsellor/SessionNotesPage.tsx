import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../modules/auth'
import { getCounsellorByUserId } from '../API/CounsellorAPI'
import { getSessionNotes } from '../API/SessionNotesAPI'
import StatusBadge from '../shared/StatusBadge'
import SessionNotesForm from './components/SessionNotesForm'
import '../Counselling.css'
import axios from 'axios'

const API_URL = process.env.REACT_APP_API_URL

const SessionNotesPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentUser } = useAuth()

  const [appointment, setAppointment] = useState<any>(null)
  const [existingNotes, setExistingNotes] = useState<any>(null)
  const [counsellorUserId, setCounsellorUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const userId: number | undefined =
    currentUser?.id ??
    (() => {
      try {
        const stored = localStorage.getItem('counsellorPortalUser')
        if (stored) return JSON.parse(stored)?.id
      } catch {
        return undefined
      }
    })()

  useEffect(() => {
    if (!id || !userId) {
      setLoading(false)
      return
    }

    const appointmentId = Number(id)

    const fetchData = async () => {
      try {
        // Get userId for notes creation
        setCounsellorUserId(userId)

        // Fetch appointment details
        const apptRes = await axios.get(
          `${API_URL}/api/counselling-appointment/get/${appointmentId}`
        )
        setAppointment(apptRes.data)

        // Check for existing notes (don't fail if not found)
        try {
          const notesRes = await getSessionNotes(appointmentId, false)
          setExistingNotes(notesRes.data)
        } catch {
          // No existing notes — that's fine
        }
      } catch {
        setError('Failed to load appointment details.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id, userId])

  const handleSaved = () => {
    navigate(-1)
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--sp-muted, #5C7A72)' }}>
        Loading appointment...
      </div>
    )
  }

  if (!id || !userId) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--sp-danger, #EF4444)' }}>
        Invalid appointment or not authenticated.
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto' }}>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          color: 'var(--sp-primary, #0C6B5A)',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          marginBottom: 20,
        }}
      >
        <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
          <path d='M19 12H5' />
          <path d='M12 19l-7-7 7-7' />
        </svg>
        Back
      </button>

      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--sp-text, #1A2B28)', margin: 0 }}>
          Session Notes
        </h2>
        {error && (
          <p style={{ fontSize: 13, color: 'var(--sp-danger, #EF4444)', marginTop: 8 }}>{error}</p>
        )}
      </div>

      {/* Appointment Summary */}
      {appointment && (
        <div className='cl-card cl-card-accent' style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <StatusBadge status={appointment.status} />
            <span style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)' }}>
              {appointment.slot?.date || appointment.date || ''}{' '}
              {appointment.slot?.startTime || appointment.startTime
                ? `· ${appointment.slot?.startTime || appointment.startTime}`
                : ''}
            </span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--sp-text, #1A2B28)', marginBottom: 4 }}>
            {appointment.student?.name || appointment.studentName || 'Student'}
          </div>
          {appointment.reason && (
            <div style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)' }}>
              Reason: {appointment.reason}
            </div>
          )}
        </div>
      )}

      {/* Existing notes notice */}
      {existingNotes && (
        <div
          className='cl-card'
          style={{
            marginBottom: 20,
            background: '#FEF3C7',
            borderColor: '#F59E0B',
          }}
        >
          <p style={{ fontSize: 13, color: '#92400E', margin: 0 }}>
            Notes already exist for this session. Submitting will create an additional entry.
          </p>
        </div>
      )}

      {/* Session Notes Form */}
      <div className='cl-card'>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--sp-text, #1A2B28)', marginBottom: 20 }}>
          {existingNotes ? 'Add Additional Notes' : 'Add Session Notes'}
        </h3>
        {counsellorUserId !== null && (
          <SessionNotesForm
            appointmentId={Number(id)}
            counsellorUserId={counsellorUserId}
            onSaved={handleSaved}
          />
        )}
      </div>
    </div>
  )
}

export default SessionNotesPage
