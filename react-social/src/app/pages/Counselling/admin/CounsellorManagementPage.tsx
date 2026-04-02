import React, { useEffect, useState } from 'react'
import '../Counselling.css'
import { getAllCounsellors, createCounsellor, updateCounsellor, toggleCounsellorActive } from '../API/CounsellorAPI'
import CounsellorForm from './components/CounsellorForm'

interface Counsellor {
  counsellorId: number
  name: string
  email: string
  phone?: string
  specializations?: string
  bio?: string
  isExternal?: boolean
  isActive?: boolean
  onboardingStatus?: string
}

const CounsellorManagementPage: React.FC = () => {
  const [counsellors, setCounsellors] = useState<Counsellor[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingCounsellor, setEditingCounsellor] = useState<Counsellor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const loadCounsellors = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAllCounsellors()
      setCounsellors(res.data ?? [])
    } catch {
      setError('Failed to load counsellors. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCounsellors()
  }, [])

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(null), 3500)
  }

  const handleAddClick = () => {
    setEditingCounsellor(null)
    setShowForm(true)
  }

  const handleEditClick = (counsellor: Counsellor) => {
    setEditingCounsellor(counsellor)
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingCounsellor(null)
  }

  const handleSave = async (data: any) => {
    setError(null)
    try {
      if (editingCounsellor?.counsellorId) {
        await updateCounsellor(editingCounsellor.counsellorId, data)
        showSuccess('Counsellor updated successfully.')
      } else {
        await createCounsellor(data)
        showSuccess('Counsellor added successfully.')
      }
      setShowForm(false)
      setEditingCounsellor(null)
      await loadCounsellors()
    } catch {
      setError('Failed to save counsellor. Please try again.')
    }
  }

  const handleToggleActive = async (counsellor: Counsellor) => {
    setTogglingId(counsellor.counsellorId)
    setError(null)
    try {
      await toggleCounsellorActive(counsellor.counsellorId)
      showSuccess(`Counsellor ${counsellor.isActive ? 'deactivated' : 'activated'}.`)
      await loadCounsellors()
    } catch {
      setError('Failed to update counsellor status.')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div style={{ padding: '24px 28px', background: 'var(--sp-bg, #F2F7F5)', minHeight: '100vh' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--sp-text, #1A2B28)' }}>
            Manage Counsellors
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--sp-muted, #5C7A72)' }}>
            Add, edit, and manage counsellor profiles
          </p>
        </div>
        <button className='cl-btn-primary' onClick={handleAddClick} style={{ fontSize: 13 }}>
          <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <line x1='12' y1='5' x2='12' y2='19' />
            <line x1='5' y1='12' x2='19' y2='12' />
          </svg>
          Add Counsellor
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            background: '#FEE2E2',
            border: '1px solid #FECACA',
            borderRadius: 8,
            color: '#991B1B',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontSize: 16 }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            background: '#D1FAE5',
            border: '1px solid #A7F3D0',
            borderRadius: 8,
            color: '#065F46',
            fontSize: 14,
          }}
        >
          {successMessage}
        </div>
      )}

      {/* Form Panel */}
      {showForm && (
        <div style={{ marginBottom: 28 }}>
          <CounsellorForm
            counsellor={editingCounsellor}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className='cl-card' style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sp-muted, #5C7A72)' }}>
          Loading counsellors...
        </div>
      ) : counsellors.length === 0 ? (
        <div className='cl-card' style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sp-muted, #5C7A72)' }}>
          No counsellors found. Click "Add Counsellor" to get started.
        </div>
      ) : (
        <div className='cl-card' style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--sp-border, #D1E5DF)' }}>
                {['Name', 'Email', 'Specializations', 'Status', 'Onboarding', 'Actions'].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: '10px 14px',
                      textAlign: 'left',
                      fontWeight: 700,
                      fontSize: 12,
                      color: 'var(--sp-muted, #5C7A72)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {counsellors.map((c, idx) => (
                <tr
                  key={c.counsellorId}
                  style={{
                    borderBottom: '1px solid var(--sp-border, #D1E5DF)',
                    background: idx % 2 === 0 ? '#fff' : 'var(--sp-bg, #F2F7F5)',
                  }}
                >
                  {/* Name */}
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--sp-text, #1A2B28)' }}>{c.name}</div>
                    {c.isExternal && (
                      <div style={{ fontSize: 11, color: 'var(--sp-muted, #5C7A72)', marginTop: 2 }}>
                        External
                      </div>
                    )}
                  </td>

                  {/* Email */}
                  <td style={{ padding: '12px 14px', color: 'var(--sp-text, #1A2B28)' }}>
                    {c.email}
                  </td>

                  {/* Specializations */}
                  <td style={{ padding: '12px 14px', color: 'var(--sp-muted, #5C7A72)' }}>
                    {c.specializations || <span style={{ fontStyle: 'italic' }}>Not specified</span>}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '12px 14px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        background: c.isActive ? '#D1FAE5' : '#F3F4F6',
                        color: c.isActive ? '#065F46' : '#6B7280',
                      }}
                    >
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Onboarding Status */}
                  <td style={{ padding: '12px 14px', color: 'var(--sp-muted, #5C7A72)', fontSize: 13 }}>
                    {c.onboardingStatus || 'N/A'}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className='cl-btn-outline'
                        style={{ fontSize: 12, padding: '5px 12px' }}
                        onClick={() => handleEditClick(c)}
                      >
                        Edit
                      </button>
                      <button
                        className={c.isActive ? 'cl-btn-warning' : 'cl-btn-primary'}
                        style={{ fontSize: 12, padding: '5px 12px' }}
                        disabled={togglingId === c.counsellorId}
                        onClick={() => handleToggleActive(c)}
                      >
                        {togglingId === c.counsellorId
                          ? '...'
                          : c.isActive
                          ? 'Deactivate'
                          : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default CounsellorManagementPage
