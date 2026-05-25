import React, { useState } from 'react'
import axios from 'axios'
import '../../Counselling.css'

const API_URL = process.env.REACT_APP_API_URL
const TEMPLATE_BASE = `${API_URL}/api/availability-template`

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

interface Template {
  id: number
  dayOfWeek: string
  startTime: string
  endTime: string
  slotDuration: number
}

interface RecurringTemplateFormProps {
  counsellorId: number
  templates: Template[]
  onSaved: () => void
}

const RecurringTemplateForm: React.FC<RecurringTemplateFormProps> = ({
  counsellorId,
  templates,
  onSaved,
}) => {
  const [dayOfWeek, setDayOfWeek] = useState('Monday')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [slotDuration, setSlotDuration] = useState(60)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setError('')
    if (!startTime || !endTime) {
      setError('Please fill in all time fields.')
      return
    }
    if (startTime >= endTime) {
      setError('Start time must be before end time.')
      return
    }
    setSaving(true)
    try {
      await axios.post(`${TEMPLATE_BASE}/create`, {
        counsellorId,
        dayOfWeek,
        startTime,
        endTime,
        slotDuration,
      })
      setDayOfWeek('Monday')
      setStartTime('09:00')
      setEndTime('17:00')
      setSlotDuration(60)
      onSaved()
    } catch {
      setError('Failed to save template. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${TEMPLATE_BASE}/delete/${id}`)
      onSaved()
    } catch {
      setError('Failed to delete template.')
    }
  }

  return (
    <div>
      <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--sp-text, #1A2B28)', marginBottom: 16 }}>
        Recurring Templates
      </h4>

      {/* Existing templates */}
      {templates.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)', marginBottom: 16 }}>
          No recurring templates yet.
        </p>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {templates.map((t) => (
            <div
              key={t.id}
              className='cl-card'
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                marginBottom: 8,
              }}
            >
              <div>
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--sp-text, #1A2B28)' }}>
                  {t.dayOfWeek}
                </span>
                <span style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)', marginLeft: 8 }}>
                  {t.startTime} – {t.endTime} &middot; {t.slotDuration} min slots
                </span>
              </div>
              <button
                className='cl-btn-danger'
                style={{ padding: '4px 12px', fontSize: 12 }}
                onClick={() => handleDelete(t.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new template */}
      <div
        className='cl-card'
        style={{ background: 'var(--sp-bg, #F2F7F5)', border: '1.5px dashed var(--sp-border, #D1E5DF)' }}
      >
        <h5 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sp-text, #1A2B28)', marginBottom: 12 }}>
          Add New Template
        </h5>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label
              style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--sp-muted, #5C7A72)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}
            >
              Day of Week
            </label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1.5px solid var(--sp-border, #D1E5DF)',
                borderRadius: 8,
                fontSize: 14,
                background: '#fff',
                color: 'var(--sp-text, #1A2B28)',
              }}
            >
              {DAYS_OF_WEEK.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--sp-muted, #5C7A72)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}
            >
              Slot Duration (minutes)
            </label>
            <input
              type='number'
              min={15}
              max={120}
              step={15}
              value={slotDuration}
              onChange={(e) => setSlotDuration(Number(e.target.value))}
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
        </div>

        {error && (
          <p style={{ fontSize: 13, color: 'var(--sp-danger, #EF4444)', marginBottom: 10 }}>{error}</p>
        )}

        <button
          className='cl-btn-primary'
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Template'}
        </button>
      </div>
    </div>
  )
}

export default RecurringTemplateForm
