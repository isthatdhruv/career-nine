import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCounsellorAppointments } from '../../Counselling/API/AppointmentAPI'
import { getSessionNotes } from '../../Counselling/API/SessionNotesAPI'

interface NoteEntry {
  studentName: string
  date: string
  keyDiscussionPoints: string
  actionItems: string
}

interface SessionNotesProps {
  counsellorId: number | null
}

const SessionNotes: React.FC<SessionNotesProps> = ({ counsellorId }) => {
  const navigate = useNavigate()
  const [notes, setNotes] = useState<NoteEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!counsellorId) return

    setLoading(true)

    getCounsellorAppointments(counsellorId)
      .then((res) => {
        const appointments: any[] = res.data || []
        const completed = appointments.filter(
          (a: any) => a.status === 'COMPLETED'
        )

        // Fetch notes for each completed appointment in parallel
        const notePromises = completed.map((appt: any) =>
          getSessionNotes(appt.id, false)
            .then((noteRes) => {
              const sn = noteRes.data
              if (!sn) return null

              const studentName =
                appt.student?.studentInfo?.name ||
                appt.student?.name ||
                'Unknown Student'

              const date = appt.slot?.date
                ? new Date(appt.slot.date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : ''

              return {
                studentName,
                date,
                keyDiscussionPoints: sn.keyDiscussionPoints || '',
                actionItems: sn.actionItems || '',
              } as NoteEntry
            })
            .catch(() => null)
        )

        Promise.all(notePromises).then((results) => {
          const valid = results.filter(Boolean) as NoteEntry[]
          // Show latest 5, reverse so newest first
          setNotes(valid.slice(-5).reverse())
          setLoading(false)
        })
      })
      .catch(() => setLoading(false))
  }, [counsellorId])

  return (
    <div className='cp-card'>
      <div className='cp-card-title'>Recent Session Notes</div>

      {loading && (
        <div style={{ color: '#6984A9', fontSize: 14, padding: '8px 0' }}>
          Loading notes...
        </div>
      )}

      {!counsellorId && !loading && (
        <div style={{ color: '#6B7A8D', fontSize: 13, padding: '8px 0' }}>
          Counsellor profile not linked yet. Please contact admin to set up your profile.
        </div>
      )}

      {!loading && counsellorId && notes.length === 0 && (
        <div style={{ color: '#888', fontSize: 14, padding: '8px 0' }}>
          No session notes yet.
        </div>
      )}

      {notes.map((note, i) => (
        <div className='cp-note-item' key={i}>
          <div className='cp-note-meta'>
            <span style={{ fontWeight: 600, color: '#263B6A' }}>{note.studentName}</span>
            <span>{note.date}</span>
          </div>
          {note.keyDiscussionPoints && (
            <div className='cp-note-text'>{note.keyDiscussionPoints}</div>
          )}
          {note.actionItems && (
            <div
              className='cp-note-text'
              style={{ color: '#6984A9', marginTop: 2 }}
            >
              Action: {note.actionItems}
            </div>
          )}
        </div>
      ))}

      <button
        className='cp-action-btn'
        style={{ width: '100%', marginTop: 8, textAlign: 'center' }}
        onClick={() => navigate('/counsellor/notes')}
      >
        View All Notes
      </button>
    </div>
  )
}

export default SessionNotes
