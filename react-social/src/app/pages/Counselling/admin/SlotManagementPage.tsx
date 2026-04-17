import React, { useEffect, useState } from 'react'
import '../Counselling.css'
import { createSlotConfig, getAllSlotConfigs, deleteSlotConfig, cleanupLegacy, SlotConfig } from '../API/SlotConfigurationAPI'

const SlotManagementPage: React.FC = () => {
  const [configs, setConfigs] = useState<SlotConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [configName, setConfigName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [breakStart, setBreakStart] = useState('13:00')
  const [breakEnd, setBreakEnd] = useState('14:00')
  const [hasBreak, setHasBreak] = useState(true)
  const [duration, setDuration] = useState(30)
  const [saving, setSaving] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 4000)
  }

  const loadConfigs = async () => {
    setLoading(true)
    try {
      const res = await getAllSlotConfigs()
      setConfigs(Array.isArray(res.data) ? res.data : [])
    } catch {
      setError('Failed to load slot configurations.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadConfigs() }, [])

  const resetForm = () => {
    setConfigName('')
    setStartDate('')
    setEndDate('')
    setStartTime('09:00')
    setEndTime('17:00')
    setBreakStart('13:00')
    setBreakEnd('14:00')
    setHasBreak(true)
    setDuration(30)
  }

  const handleSave = async () => {
    if (!configName.trim()) { setError('Enter a name for this configuration.'); return }
    if (!startDate || !endDate) { setError('Select a date range.'); return }
    if (startDate > endDate) { setError('End date must be after start date.'); return }
    if (!startTime || !endTime) { setError('Set start and end time.'); return }
    if (startTime >= endTime) { setError('End time must be after start time.'); return }
    if (hasBreak && breakStart >= breakEnd) { setError('Break end must be after break start.'); return }
    if (hasBreak && (breakStart <= startTime || breakEnd >= endTime)) { setError('Break must be within working hours.'); return }

    setSaving(true)
    setError(null)
    try {
      await createSlotConfig({
        name: configName.trim(),
        startDate,
        endDate,
        startTime: startTime + ':00',
        endTime: endTime + ':00',
        slotDuration: duration,
        hasBreak,
        breakStart: hasBreak ? breakStart + ':00' : null,
        breakEnd: hasBreak ? breakEnd + ':00' : null,
      })
      showSuccess('Slot configuration saved.')
      setShowForm(false)
      resetForm()
      loadConfigs()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save configuration.')
    } finally {
      setSaving(false)
    }
  }

  const handleCleanupLegacy = async () => {
    if (!window.confirm('This will delete all legacy slots and templates created by the old system. Already-booked slots are safe. Continue?')) return
    setCleaning(true)
    setError(null)
    try {
      const res = await cleanupLegacy()
      showSuccess(`Cleaned up ${res.data.slotsDeleted} slots and ${res.data.templatesDeleted} templates.`)
    } catch {
      setError('Failed to cleanup legacy data.')
    } finally {
      setCleaning(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteSlotConfig(id)
      showSuccess('Configuration deleted.')
      loadConfigs()
    } catch {
      setError('Failed to delete configuration.')
    }
  }

  const formatDate = (d: string) => {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch { return d }
  }

  const formatTime = (t: string) => t?.slice(0, 5) || t

  return (
    <div style={{ padding: '24px 28px', background: 'var(--sp-bg, #F2F7F5)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--sp-text, #1A2B28)' }}>
            Create Slots
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--sp-muted, #5C7A72)' }}>
            Create slot configurations and assign them to counsellors from Manage Counsellors page
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleCleanupLegacy}
            disabled={cleaning}
            style={{
              fontSize: 13, padding: '7px 14px', fontWeight: 600,
              border: '1.5px solid #FECACA', borderRadius: 6,
              background: '#fff', color: '#991B1B',
              cursor: cleaning ? 'not-allowed' : 'pointer',
            }}
          >
            {cleaning ? 'Cleaning...' : 'Cleanup Legacy Slots'}
          </button>
          <button className='cl-btn-primary' onClick={() => setShowForm(!showForm)} style={{ fontSize: 13 }}>
            {showForm ? 'Cancel' : 'New Configuration'}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', background: '#FEE2E2',
          border: '1px solid #FECACA', borderRadius: 8, color: '#991B1B', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontSize: 16 }}>&times;</button>
        </div>
      )}
      {success && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', background: '#D1FAE5',
          border: '1px solid #A7F3D0', borderRadius: 8, color: '#065F46', fontSize: 14,
        }}>{success}</div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className='cl-card' style={{ marginBottom: 20, padding: 24 }}>
          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--sp-muted, #5C7A72)', marginBottom: 6 }}>
              Configuration Name
            </label>
            <input type='text' placeholder='e.g. April Week 3 - Morning + Afternoon' value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              style={{
                width: '100%', maxWidth: 400, padding: '9px 12px', border: '1px solid var(--sp-border, #D1E5DF)',
                borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }} />
          </div>

          {/* Date Range */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, maxWidth: 400 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--sp-muted, #5C7A72)', marginBottom: 6 }}>From Date</label>
              <input type='date' value={startDate} onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--sp-border, #D1E5DF)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--sp-muted, #5C7A72)', marginBottom: 6 }}>To Date</label>
              <input type='date' value={endDate} onChange={(e) => setEndDate(e.target.value)}
                min={startDate || new Date().toISOString().split('T')[0]}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--sp-border, #D1E5DF)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Time & Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--sp-muted, #5C7A72)', marginBottom: 6 }}>Start Time</label>
              <input type='time' value={startTime} onChange={(e) => setStartTime(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--sp-border, #D1E5DF)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--sp-muted, #5C7A72)', marginBottom: 6 }}>End Time</label>
              <input type='time' value={endTime} onChange={(e) => setEndTime(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--sp-border, #D1E5DF)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--sp-muted, #5C7A72)', marginBottom: 6 }}>Slot Duration</label>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--sp-border, #D1E5DF)', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff' }}>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>
          </div>

          {/* Break */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'var(--sp-text, #1A2B28)', cursor: 'pointer', marginBottom: hasBreak ? 10 : 0 }}>
              <input type='checkbox' checked={hasBreak} onChange={(e) => setHasBreak(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#0C6B5A' }} />
              Add Break Time
            </label>
            {hasBreak && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 300 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--sp-muted, #5C7A72)', marginBottom: 4 }}>Break From</label>
                  <input type='time' value={breakStart} onChange={(e) => setBreakStart(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--sp-border, #D1E5DF)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--sp-muted, #5C7A72)', marginBottom: 4 }}>Break To</label>
                  <input type='time' value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--sp-border, #D1E5DF)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}
          </div>

          <button className='cl-btn-primary' onClick={handleSave} disabled={saving} style={{ fontSize: 14, padding: '10px 28px' }}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      )}

      {/* Saved Configurations */}
      {loading ? (
        <div className='cl-card' style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sp-muted)' }}>Loading...</div>
      ) : configs.length === 0 ? (
        <div className='cl-card' style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sp-muted, #5C7A72)' }}>
          No slot configurations yet. Click "New Configuration" to create one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {configs.map((c) => (
            <div key={c.id} className='cl-card' style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--sp-text, #1A2B28)', marginBottom: 6 }}>
                  {c.name}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--sp-muted, #5C7A72)' }}>
                  <span>{formatDate(c.startDate)} — {formatDate(c.endDate)}</span>
                  <span>{formatTime(c.startTime)} - {formatTime(c.endTime)}</span>
                  <span>{c.slotDuration} min slots</span>
                  {c.hasBreak && c.breakStart && c.breakEnd && (
                    <span>Break: {formatTime(c.breakStart)} - {formatTime(c.breakEnd)}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(c.id)}
                style={{
                  background: 'none', border: '1.5px solid #FECACA', borderRadius: 6,
                  padding: '5px 12px', fontSize: 12, fontWeight: 600,
                  color: '#991B1B', cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SlotManagementPage
