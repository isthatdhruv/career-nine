import React, { useState } from 'react'
import { blockDate } from '../../API/SlotAPI'
import '../../Counselling.css'

interface BlockDateFormProps {
  counsellorId: number
  onSaved: () => void
}

const BlockDateForm: React.FC<BlockDateFormProps> = ({ counsellorId, onSaved }) => {
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleBlock = async () => {
    setError('')
    setSuccess('')
    if (!date) {
      setError('Please select a date to block.')
      return
    }
    setSaving(true)
    try {
      await blockDate({
        counsellorId,
        date,
        reason,
      })
      setDate('')
      setReason('')
      setSuccess('Date blocked successfully.')
      onSaved()
    } catch {
      setError('Failed to block date. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h5 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sp-text, #1A2B28)', marginBottom: 12 }}>
        Block a Date
      </h5>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div>
          <label
            style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--sp-muted, #5C7A72)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >
            Date
          </label>
          <input
            type='date'
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1.5px solid var(--sp-border, #D1E5DF)',
              borderRadius: 8,
              fontSize: 14,
              color: 'var(--sp-text, #1A2B28)',
            }}
          />
        </div>

        <div>
          <label
            style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--sp-muted, #5C7A72)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >
            Reason (optional)
          </label>
          <input
            type='text'
            placeholder='e.g. Public holiday, Personal leave...'
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1.5px solid var(--sp-border, #D1E5DF)',
              borderRadius: 8,
              fontSize: 14,
              color: 'var(--sp-text, #1A2B28)',
            }}
          />
        </div>
      </div>

      {error && (
        <p style={{ fontSize: 13, color: 'var(--sp-danger, #EF4444)', marginBottom: 8 }}>{error}</p>
      )}
      {success && (
        <p style={{ fontSize: 13, color: 'var(--sp-primary, #0C6B5A)', marginBottom: 8 }}>{success}</p>
      )}

      <button className='cl-btn-danger' onClick={handleBlock} disabled={saving}>
        {saving ? 'Blocking...' : 'Block Date'}
      </button>
    </div>
  )
}

export default BlockDateForm
