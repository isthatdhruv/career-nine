import React, { useState } from 'react'
import { createSessionNotes } from '../../API/SessionNotesAPI'
import '../../Counselling.css'

interface SessionNotesFormProps {
  appointmentId: number
  counsellorUserId: number
  onSaved?: () => void
}

const SessionNotesForm: React.FC<SessionNotesFormProps> = ({
  appointmentId,
  counsellorUserId,
  onSaved,
}) => {
  const [keyDiscussionPoints, setKeyDiscussionPoints] = useState('')
  const [actionItems, setActionItems] = useState('')
  const [recommendedNextSession, setRecommendedNextSession] = useState('')
  const [followUpRequired, setFollowUpRequired] = useState(false)
  const [publicRemarks, setPublicRemarks] = useState('')
  const [privateNotes, setPrivateNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSave = async () => {
    setError('')
    setSuccess('')
    if (!keyDiscussionPoints.trim()) {
      setError('Key Discussion Points are required.')
      return
    }
    setSaving(true)
    try {
      await createSessionNotes(
        {
          appointmentId,
          keyDiscussionPoints,
          actionItems,
          recommendedNextSession,
          followUpRequired,
          publicRemarks,
          privateNotes,
        },
        counsellorUserId
      )
      setSuccess('Session notes saved successfully.')
      if (onSaved) onSaved()
    } catch {
      setError('Failed to save session notes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--sp-muted, #5C7A72)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  }

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1.5px solid var(--sp-border, #D1E5DF)',
    borderRadius: 8,
    fontSize: 14,
    color: 'var(--sp-text, #1A2B28)',
    resize: 'vertical',
    minHeight: 80,
    lineHeight: 1.5,
    fontFamily: 'inherit',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1.5px solid var(--sp-border, #D1E5DF)',
    borderRadius: 8,
    fontSize: 14,
    color: 'var(--sp-text, #1A2B28)',
    fontFamily: 'inherit',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Key Discussion Points */}
      <div>
        <label style={labelStyle}>Key Discussion Points *</label>
        <textarea
          style={textareaStyle}
          placeholder='What was discussed during the session...'
          value={keyDiscussionPoints}
          onChange={(e) => setKeyDiscussionPoints(e.target.value)}
        />
      </div>

      {/* Action Items */}
      <div>
        <label style={labelStyle}>Action Items</label>
        <textarea
          style={textareaStyle}
          placeholder='Tasks or next steps for the student...'
          value={actionItems}
          onChange={(e) => setActionItems(e.target.value)}
        />
      </div>

      {/* Recommended Next Session */}
      <div>
        <label style={labelStyle}>Recommended Next Session</label>
        <input
          type='text'
          style={inputStyle}
          placeholder='e.g. In 2 weeks, Next month...'
          value={recommendedNextSession}
          onChange={(e) => setRecommendedNextSession(e.target.value)}
        />
      </div>

      {/* Follow-up Required */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type='checkbox'
          id='followUpRequired'
          checked={followUpRequired}
          onChange={(e) => setFollowUpRequired(e.target.checked)}
          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--sp-primary, #0C6B5A)' }}
        />
        <label
          htmlFor='followUpRequired'
          style={{ fontSize: 14, fontWeight: 500, color: 'var(--sp-text, #1A2B28)', cursor: 'pointer' }}
        >
          Follow-up Required
        </label>
      </div>

      {/* Public Remarks */}
      <div>
        <label style={labelStyle}>
          Public Remarks{' '}
          <span style={{ fontSize: 11, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--sp-info, #3B82F6)' }}>
            Visible to student
          </span>
        </label>
        <textarea
          style={textareaStyle}
          placeholder='Remarks the student will be able to see...'
          value={publicRemarks}
          onChange={(e) => setPublicRemarks(e.target.value)}
        />
      </div>

      {/* Private Notes */}
      <div>
        <label style={labelStyle}>
          Private Notes{' '}
          <span style={{ fontSize: 11, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--sp-muted, #5C7A72)' }}>
            Only visible to you and admin
          </span>
        </label>
        <textarea
          style={{
            ...textareaStyle,
            background: 'var(--sp-bg, #F2F7F5)',
            borderStyle: 'dashed',
          }}
          placeholder='Internal notes for reference only...'
          value={privateNotes}
          onChange={(e) => setPrivateNotes(e.target.value)}
        />
      </div>

      {error && (
        <p style={{ fontSize: 13, color: 'var(--sp-danger, #EF4444)', margin: 0 }}>{error}</p>
      )}
      {success && (
        <p style={{ fontSize: 13, color: 'var(--sp-primary, #0C6B5A)', margin: 0 }}>{success}</p>
      )}

      <div>
        <button className='cl-btn-primary' onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Notes'}
        </button>
      </div>
    </div>
  )
}

export default SessionNotesForm
