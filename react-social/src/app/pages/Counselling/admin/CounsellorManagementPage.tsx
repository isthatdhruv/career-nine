import React, { useEffect, useState } from 'react'
import axios from 'axios'
import '../Counselling.css'
import { getAllCounsellors, createCounsellor, updateCounsellor, toggleCounsellorActive } from '../API/CounsellorAPI'
import { getStudentsForCounsellor, assignStudentToCounsellor, deactivateMapping } from '../API/StudentCounsellorMappingAPI'
import CounsellorForm from './components/CounsellorForm'

const API_URL = process.env.REACT_APP_API_URL

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

interface AssignedMapping {
  id: number
  isActive: boolean
  notes?: string
  student: any
}

interface AllStudent {
  id?: number
  userStudentId?: number
  name?: string
  studentInfo?: { name?: string }
}

function getStudentId(s: AllStudent): number {
  return s.id || s.userStudentId || 0
}

function getStudentName(s: AllStudent): string {
  return s.studentInfo?.name || s.name || 'Unknown'
}

const StudentAssignmentSection: React.FC<{ counsellor: Counsellor; adminUserId: number; onClose: () => void }> = ({
  counsellor,
  adminUserId,
  onClose,
}) => {
  const [assignedMappings, setAssignedMappings] = useState<AssignedMapping[]>([])
  const [allStudents, setAllStudents] = useState<AllStudent[]>([])
  const [loadingAssigned, setLoadingAssigned] = useState(true)
  const [loadingAll, setLoadingAll] = useState(true)
  const [studentSearch, setStudentSearch] = useState('')
  const [assigningId, setAssigningId] = useState<number | null>(null)
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null)
  const [sectionError, setSectionError] = useState<string | null>(null)
  const [sectionSuccess, setSectionSuccess] = useState<string | null>(null)

  const showSectionSuccess = (msg: string) => {
    setSectionSuccess(msg)
    setTimeout(() => setSectionSuccess(null), 3000)
  }

  const loadAssigned = () => {
    setLoadingAssigned(true)
    getStudentsForCounsellor(counsellor.counsellorId)
      .then((res) => setAssignedMappings(Array.isArray(res.data) ? res.data.filter((m: AssignedMapping) => m.isActive !== false) : []))
      .catch(() => setSectionError('Failed to load assigned students.'))
      .finally(() => setLoadingAssigned(false))
  }

  useEffect(() => {
    loadAssigned()
    setLoadingAll(true)
    axios
      .get(`${API_URL}/student/get`)
      .then((res) => setAllStudents(Array.isArray(res.data) ? res.data : []))
      .catch(() => setSectionError('Failed to load student list.'))
      .finally(() => setLoadingAll(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counsellor.counsellorId])

  const assignedStudentIds = new Set(
    assignedMappings.map((m) => m.student?.id || m.student?.userStudentId).filter(Boolean)
  )

  const availableStudents = allStudents.filter((s) => {
    const sid = getStudentId(s)
    if (assignedStudentIds.has(sid)) return false
    if (studentSearch) {
      const name = getStudentName(s).toLowerCase()
      return name.includes(studentSearch.toLowerCase())
    }
    return true
  })

  const handleAssign = async (student: AllStudent) => {
    const sid = getStudentId(student)
    if (!sid) return
    setAssigningId(sid)
    setSectionError(null)
    try {
      await assignStudentToCounsellor(sid, counsellor.counsellorId, adminUserId)
      showSectionSuccess(`${getStudentName(student)} assigned successfully.`)
      loadAssigned()
    } catch {
      setSectionError('Failed to assign student.')
    } finally {
      setAssigningId(null)
    }
  }

  const handleDeactivate = async (mapping: AssignedMapping) => {
    setDeactivatingId(mapping.id)
    setSectionError(null)
    try {
      await deactivateMapping(mapping.id)
      const studentName = mapping.student?.studentInfo?.name || mapping.student?.name || 'Student'
      showSectionSuccess(`${studentName} removed from counsellor.`)
      loadAssigned()
    } catch {
      setSectionError('Failed to remove assignment.')
    } finally {
      setDeactivatingId(null)
    }
  }

  return (
    <div
      className='cl-card'
      style={{ marginTop: 28, padding: 0, border: '2px solid var(--sp-border, #D1E5DF)', borderRadius: 10 }}
    >
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--sp-border, #D1E5DF)',
          background: 'var(--sp-bg, #F2F7F5)',
          borderRadius: '10px 10px 0 0',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--sp-text, #1A2B28)' }}>
            Student Assignments — {counsellor.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', marginTop: 2 }}>
            Manage which students are assigned to this counsellor
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--sp-muted, #5C7A72)',
            fontSize: 20,
            lineHeight: 1,
            padding: '0 4px',
          }}
          title='Close'
        >
          &times;
        </button>
      </div>

      <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Inline alerts */}
        {(sectionError || sectionSuccess) && (
          <div style={{ gridColumn: '1 / -1' }}>
            {sectionError && (
              <div
                style={{
                  padding: '10px 14px',
                  background: '#FEE2E2',
                  border: '1px solid #FECACA',
                  borderRadius: 6,
                  color: '#991B1B',
                  fontSize: 13,
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{sectionError}</span>
                <button
                  onClick={() => setSectionError(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontSize: 16 }}
                >
                  &times;
                </button>
              </div>
            )}
            {sectionSuccess && (
              <div
                style={{
                  padding: '10px 14px',
                  background: '#D1FAE5',
                  border: '1px solid #A7F3D0',
                  borderRadius: 6,
                  color: '#065F46',
                  fontSize: 13,
                }}
              >
                {sectionSuccess}
              </div>
            )}
          </div>
        )}

        {/* Left: Currently Assigned */}
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--sp-text, #1A2B28)', marginBottom: 10 }}>
            Currently Assigned ({assignedMappings.length})
          </div>
          {loadingAssigned ? (
            <div style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)', padding: '10px 0' }}>Loading...</div>
          ) : assignedMappings.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)', padding: '10px 0' }}>
              No students assigned yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {assignedMappings.map((m) => {
                const name = m.student?.studentInfo?.name || m.student?.name || 'Unknown'
                const classInfo = m.student?.studentInfo?.className || m.student?.className || ''
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#fff',
                      border: '1px solid var(--sp-border, #D1E5DF)',
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--sp-text, #1A2B28)' }}>{name}</div>
                      {classInfo && (
                        <div style={{ fontSize: 11, color: 'var(--sp-muted, #5C7A72)' }}>{classInfo}</div>
                      )}
                    </div>
                    <button
                      className='cl-btn-warning'
                      style={{ fontSize: 11, padding: '4px 10px' }}
                      disabled={deactivatingId === m.id}
                      onClick={() => handleDeactivate(m)}
                    >
                      {deactivatingId === m.id ? '...' : 'Remove'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Assign New Students */}
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--sp-text, #1A2B28)', marginBottom: 10 }}>
            Assign Students
          </div>
          <input
            type='text'
            placeholder='Search students...'
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 10px',
              border: '1px solid var(--sp-border, #D1E5DF)',
              borderRadius: 6,
              fontSize: 13,
              marginBottom: 10,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {loadingAll ? (
            <div style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)', padding: '10px 0' }}>Loading students...</div>
          ) : availableStudents.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)', padding: '10px 0' }}>
              {studentSearch ? 'No matching students.' : 'All students already assigned.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {availableStudents.slice(0, 50).map((s) => {
                const sid = getStudentId(s)
                const name = getStudentName(s)
                const classInfo = s.studentInfo?.name ? (s as any)?.className || '' : (s as any)?.className || ''
                return (
                  <div
                    key={sid}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#fff',
                      border: '1px solid var(--sp-border, #D1E5DF)',
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--sp-text, #1A2B28)' }}>{name}</div>
                      {classInfo && (
                        <div style={{ fontSize: 11, color: 'var(--sp-muted, #5C7A72)' }}>{classInfo}</div>
                      )}
                    </div>
                    <button
                      className='cl-btn-primary'
                      style={{ fontSize: 11, padding: '4px 10px' }}
                      disabled={assigningId === sid}
                      onClick={() => handleAssign(s)}
                    >
                      {assigningId === sid ? '...' : 'Assign'}
                    </button>
                  </div>
                )
              })}
              {availableStudents.length > 50 && (
                <div style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', textAlign: 'center', padding: '4px 0' }}>
                  Showing first 50 — use search to narrow results.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const CounsellorManagementPage: React.FC = () => {
  const [counsellors, setCounsellors] = useState<Counsellor[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingCounsellor, setEditingCounsellor] = useState<Counsellor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [assigningCounsellor, setAssigningCounsellor] = useState<Counsellor | null>(null)

  // Resolve admin user ID from auth context — fall back to 0 if unavailable
  let adminUserId = 0
  try {
    const stored = localStorage.getItem('counsellorPortalUser') || localStorage.getItem('authUser')
    if (stored) {
      const parsed = JSON.parse(stored)
      adminUserId = parsed.id || parsed.userId || 0
    }
  } catch {
    adminUserId = 0
  }

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

  const handleManageStudents = (counsellor: Counsellor) => {
    setAssigningCounsellor((prev) =>
      prev?.counsellorId === counsellor.counsellorId ? null : counsellor
    )
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
                      <button
                        className={
                          assigningCounsellor?.counsellorId === c.counsellorId
                            ? 'cl-btn-warning'
                            : 'cl-btn-outline'
                        }
                        style={{ fontSize: 12, padding: '5px 12px' }}
                        onClick={() => handleManageStudents(c)}
                      >
                        Students
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Assignment Section */}
      {assigningCounsellor && (
        <StudentAssignmentSection
          counsellor={assigningCounsellor}
          adminUserId={adminUserId}
          onClose={() => setAssigningCounsellor(null)}
        />
      )}
    </div>
  )
}

export default CounsellorManagementPage
