import React, { useState } from 'react'
import { createManualSlot } from '../../API/SlotAPI'
import '../../Counselling.css'

interface ManualSlotFormProps {
  counsellorId: number
  onSaved: () => void
}

const ManualSlotForm: React.FC<ManualSlotFormProps> = ({ counsellorId, onSaved }) => {
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [duration, setDuration] = useState(60)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSave = async () => {
    setError('')
    setSuccess('')
    if (!date) {
      setError('Please select a date.')
      return
    }
    if (!startTime || !endTime) {
      setError('Please fill in the start and end times.')
      return
    }
    if (startTime >= endTime) {
      setError('Start time must be before end time.')
      return
    }
    setSaving(true)
    try {
      await createManualSlot({
        counsellorId,
        date,
        startTime,
        endTime,
        duration,
      })
      setDate('')
      setStartTime('09:00')
      setEndTime('10:00')
      setDuration(60)
      setSuccess('Slot added successfully.')
      onSaved()
    } catch {
      setError('Failed to create slot. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h5 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sp-text, #1A2B28)', marginBottom: 12 }}>
        Add One-off Slot
      </h5>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
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
            Start Time
          </label>
          <input
            type='time'
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
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
            End Time
          </label>
          <input
            type='time'
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
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

        <div style={{ gridColumn: '1 / -1' }}>
          <label
            style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--sp-muted, #5C7A72)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >
            Duration (minutes)
          </label>
          <input
            type='number'
            min={15}
            max={120}
            step={15}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
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

      <button className='cl-btn-primary' onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Add Slot'}
      </button>
    </div>
  )
}

export default ManualSlotForm
