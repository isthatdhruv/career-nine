import React, { useEffect, useState } from 'react'
import axios from 'axios'
import '../Counselling.css'
import { getAllCounsellors, createCounsellor, updateCounsellor, toggleCounsellorActive } from '../API/CounsellorAPI'
import { getCounsellorAppointments } from '../API/AppointmentAPI'
import { getAllMappings, allocateCounsellor, deallocateCounsellor, CounsellorInstituteMapping } from '../API/CounsellorInstituteAPI'
import { getAllSlotConfigs, applySlotConfig, SlotConfig } from '../API/SlotConfigurationAPI'
import { getSlotsByCounsellor } from '../API/SlotAPI'
import CounsellorForm from './components/CounsellorForm'

const API_URL = process.env.REACT_APP_API_URL

interface Counsellor {
  counsellorId: number
  id?: number
  name: string
  email: string
  phone?: string
  specializations?: string
  bio?: string
  isExternal?: boolean
  isActive?: boolean
  onboardingStatus?: string
  profileImageUrl?: string
}

/** Safely get the counsellor's ID (backend may return `id` or frontend may map `counsellorId`) */
function getCounsellorId(c: Counsellor): number {
  return c.counsellorId || c.id || 0
}

interface Appointment {
  id: number
  status: string
  studentReason?: string
  meetingLink?: string
  createdAt?: string
  student?: {
    userStudentId?: number
    studentInfo?: { name?: string }
  }
  slot?: {
    date?: string
    startTime?: string
    endTime?: string
  }
}

const AppointmentsSection: React.FC<{ counsellor: Counsellor; onClose: () => void }> = ({
  counsellor,
  onClose,
}) => {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loadingAppts, setLoadingAppts] = useState(true)
  const [apptError, setApptError] = useState<string | null>(null)

  useEffect(() => {
    setLoadingAppts(true)
    getCounsellorAppointments(getCounsellorId(counsellor))
      .then((res) => setAppointments(Array.isArray(res.data) ? res.data : []))
      .catch(() => setApptError('Failed to load appointments.'))
      .finally(() => setLoadingAppts(false))
  }, [getCounsellorId(counsellor)])

  const statusColors: Record<string, { bg: string; color: string }> = {
    CONFIRMED: { bg: '#D1FAE5', color: '#065F46' },
    PENDING: { bg: '#FEF3C7', color: '#92400E' },
    COMPLETED: { bg: '#DBEAFE', color: '#1E40AF' },
    CANCELLED: { bg: '#FEE2E2', color: '#991B1B' },
    DECLINED: { bg: '#F3F4F6', color: '#6B7280' },
  }

  return (
    <div
      className='cl-card'
      style={{ marginTop: 28, padding: 0, border: '2px solid var(--sp-border, #D1E5DF)', borderRadius: 10 }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--sp-border, #D1E5DF)',
          background: 'var(--sp-bg, #F2F7F5)', borderRadius: '10px 10px 0 0',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--sp-text, #1A2B28)' }}>
            Appointments — {counsellor.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', marginTop: 2 }}>
            Students with counselling sessions booked
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--sp-muted, #5C7A72)', fontSize: 20, lineHeight: 1, padding: '0 4px',
        }} title='Close'>&times;</button>
      </div>

      <div style={{ padding: 20 }}>
        {apptError && (
          <div style={{
            padding: '10px 14px', background: '#FEE2E2', border: '1px solid #FECACA',
            borderRadius: 6, color: '#991B1B', fontSize: 13, marginBottom: 12,
          }}>{apptError}</div>
        )}

        {loadingAppts ? (
          <div style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)', padding: '10px 0' }}>Loading...</div>
        ) : appointments.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)', padding: '10px 0' }}>
            No appointments found for this counsellor.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
            {appointments.map((a) => {
              const studentName = a.student?.studentInfo?.name || 'Unknown Student'
              const date = a.slot?.date || '-'
              const time = a.slot?.startTime ? `${a.slot.startTime} - ${a.slot.endTime || ''}` : '-'
              const sc = statusColors[a.status] || { bg: '#F3F4F6', color: '#6B7280' }
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: '#fff',
                  border: '1px solid var(--sp-border, #D1E5DF)', borderRadius: 8, fontSize: 13,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--sp-text, #1A2B28)' }}>{studentName}</div>
                      <div style={{ fontSize: 11, color: 'var(--sp-muted, #5C7A72)', marginTop: 2 }}>
                        {date} &middot; {time}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 999,
                    fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color,
                  }}>
                    {a.status}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

interface SlotData {
  id: number
  date: string
  startTime: string
  endTime: string
  durationMinutes: number
  status: string
}

const SlotsSection: React.FC<{ counsellor: Counsellor; onClose: () => void }> = ({ counsellor, onClose }) => {
  const [slots, setSlots] = useState<SlotData[]>([])
  const [loadingSlots, setLoadingSlots] = useState(true)

  useEffect(() => {
    setLoadingSlots(true)
    const today = new Date().toISOString().split('T')[0]
    const future = new Date()
    future.setDate(future.getDate() + 60)
    const end = future.toISOString().split('T')[0]

    getSlotsByCounsellor(getCounsellorId(counsellor), today, end)
      .then((res) => {
        const data: SlotData[] = Array.isArray(res.data) ? res.data : []
        setSlots(data.sort((a, b) => {
          const dc = a.date.localeCompare(b.date)
          return dc !== 0 ? dc : a.startTime.localeCompare(b.startTime)
        }))
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false))
  }, [getCounsellorId(counsellor)])

  const slotsByDate = new Map<string, SlotData[]>()
  for (const s of slots) {
    const arr = slotsByDate.get(s.date) || []
    arr.push(s)
    slotsByDate.set(s.date, arr)
  }

  const formatDate = (d: string) => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) }
    catch { return d }
  }

  const statusColors: Record<string, { bg: string; color: string }> = {
    AVAILABLE: { bg: '#D1FAE5', color: '#065F46' },
    REQUESTED: { bg: '#FEF3C7', color: '#92400E' },
    BOOKED: { bg: '#DBEAFE', color: '#1E40AF' },
    CANCELLED: { bg: '#FEE2E2', color: '#991B1B' },
  }

  return (
    <div className='cl-card' style={{ marginTop: 28, padding: 0, border: '2px solid var(--sp-border, #D1E5DF)', borderRadius: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: '1px solid var(--sp-border, #D1E5DF)',
        background: 'var(--sp-bg, #F2F7F5)', borderRadius: '10px 10px 0 0',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--sp-text, #1A2B28)' }}>
            Slots — {counsellor.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', marginTop: 2 }}>
            {slots.length} upcoming slot(s)
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--sp-muted, #5C7A72)', fontSize: 20, lineHeight: 1, padding: '0 4px',
        }} title='Close'>&times;</button>
      </div>

      <div style={{ padding: 20 }}>
        {loadingSlots ? (
          <div style={{ fontSize: 13, color: 'var(--sp-muted)', padding: '10px 0' }}>Loading...</div>
        ) : slots.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--sp-muted)', padding: '10px 0' }}>
            No upcoming slots for this counsellor.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 400, overflowY: 'auto' }}>
            {Array.from(slotsByDate.entries()).map(([date, daySlots]) => (
              <div key={date}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: 'var(--sp-text, #1A2B28)',
                  marginBottom: 6, padding: '4px 0', borderBottom: '1px solid var(--sp-border, #D1E5DF)',
                }}>
                  {formatDate(date)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {daySlots.map((s) => {
                    const sc = statusColors[s.status] || { bg: '#F3F4F6', color: '#6B7280' }
                    return (
                      <div key={s.id} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                        background: sc.bg, borderRadius: 6, fontSize: 12,
                      }}>
                        <span style={{ fontWeight: 600, color: sc.color }}>
                          {s.startTime?.slice(0, 5)} - {s.endTime?.slice(0, 5)}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: sc.color, opacity: 0.7 }}>
                          {s.status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
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
  const [viewingSlotsCounsellor, setViewingSlotsCounsellor] = useState<Counsellor | null>(null)

  // Filters
  const [instituteMappings, setInstituteMappings] = useState<CounsellorInstituteMapping[]>([])
  const [institutes, setInstitutes] = useState<{ code: number; name: string }[]>([])
  const [filterInstitute, setFilterInstitute] = useState<number | ''>('')
  const [searchName, setSearchName] = useState('')

  // Selection & allocation
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showAllocateModal, setShowAllocateModal] = useState(false)
  const [allocating, setAllocating] = useState(false)

  // Slot config modal
  const [showSlotModal, setShowSlotModal] = useState(false)
  const [slotConfigs, setSlotConfigs] = useState<SlotConfig[]>([])
  const [slotConfigsLoading, setSlotConfigsLoading] = useState(false)
  const [applyingSlots, setApplyingSlots] = useState(false)


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
      const [counsellorRes, mappingRes, instituteRes] = await Promise.all([
        getAllCounsellors(),
        getAllMappings().catch(() => ({ data: [] })),
        axios.get(`${API_URL}/instituteDetail/get`).catch(() => ({ data: [] })),
      ])
      setCounsellors(counsellorRes.data ?? [])

      const mappings: CounsellorInstituteMapping[] = Array.isArray(mappingRes.data) ? mappingRes.data : []
      setInstituteMappings(mappings)

      // Get all institutes from the institute API
      const allInstitutes = Array.isArray(instituteRes.data) ? instituteRes.data : []
      setInstitutes(allInstitutes.map((i: any) => ({
        code: i.instituteCode || i.institute_code,
        name: i.instituteName || i.institute_name || `Institute ${i.instituteCode}`,
      })))

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
      if (editingCounsellor && getCounsellorId(editingCounsellor)) {
        await updateCounsellor(getCounsellorId(editingCounsellor), data)
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
    setTogglingId(getCounsellorId(counsellor))
    setError(null)
    try {
      await toggleCounsellorActive(getCounsellorId(counsellor))
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
      prev && getCounsellorId(prev) === getCounsellorId(counsellor) ? null : counsellor
    )
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = (filteredCounsellors: Counsellor[]) => {
    const allIds = filteredCounsellors.map(getCounsellorId)
    const allSelected = allIds.every((id) => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allIds))
    }
  }

  /** Find the active institute mapping for a counsellor (null if not allocated) */
  const getActiveMapping = (counsellorId: number): CounsellorInstituteMapping | null => {
    return instituteMappings.find(
      (m) => m.isActive && m.counsellor.id === counsellorId
    ) || null
  }

  const handleDeallocate = async (counsellor: Counsellor) => {
    const mapping = getActiveMapping(getCounsellorId(counsellor))
    if (!mapping) {
      setError('This counsellor is not allocated to any institute.')
      return
    }
    setError(null)
    try {
      await deallocateCounsellor(mapping.id)
      showSuccess(`${counsellor.name} deallocated from ${mapping.institute.instituteName}.`)
      await loadCounsellors()
    } catch {
      setError('Failed to deallocate counsellor.')
    }
  }

  const openSlotModal = async () => {
    setShowSlotModal(true)
    setSlotConfigsLoading(true)
    try {
      const res = await getAllSlotConfigs()
      setSlotConfigs(Array.isArray(res.data) ? res.data : [])
    } catch {
      setError('Failed to load slot configurations.')
    } finally {
      setSlotConfigsLoading(false)
    }
  }

  const handleApplySlotConfig = async (configId: number) => {
    setApplyingSlots(true)
    setError(null)
    try {
      const res = await applySlotConfig(configId, Array.from(selectedIds))
      const data = res.data as any
      showSuccess(`Slots created: ${data.totalSlots} slots for ${data.counsellorsProcessed} counsellor(s).`)
      setShowSlotModal(false)
      setSelectedIds(new Set())
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to apply slot configuration.')
    } finally {
      setApplyingSlots(false)
    }
  }

  const handleAllocateToInstitute = async (instituteCode: number) => {
    setAllocating(true)
    setError(null)
    let successCount = 0
    let failCount = 0

    for (const id of selectedIds) {
      try {
        await allocateCounsellor(id, instituteCode, adminUserId || undefined)
        successCount++
      } catch {
        failCount++
      }
    }

    setAllocating(false)
    setShowAllocateModal(false)
    setSelectedIds(new Set())

    if (failCount === 0) {
      showSuccess(`${successCount} counsellor(s) allocated successfully.`)
    } else {
      showSuccess(`${successCount} allocated, ${failCount} failed (may already be allocated to another institute).`)
    }
    await loadCounsellors()
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
            Review, approve, and manage counsellor profiles
          </p>
        </div>
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className='cl-btn-primary' onClick={() => setShowAllocateModal(true)} style={{ fontSize: 13 }}>
              Institute Allocation ({selectedIds.size})
            </button>
            <button className='cl-btn-blue' onClick={openSlotModal} style={{ fontSize: 13 }}>
              Create Slots ({selectedIds.size})
            </button>
          </div>
        )}
      </div>

      {/* Allocation Modal */}
      {showAllocateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => !allocating && setShowAllocateModal(false)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 28, width: 420, maxHeight: '80vh',
            overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#1A2B28' }}>
              Allocate to Institute
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#5C7A72' }}>
              Select an institute to allocate {selectedIds.size} counsellor(s)
            </p>

            {allocating ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#5C7A72', fontSize: 14 }}>
                Allocating...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {institutes.map((inst) => (
                  <button
                    key={inst.code}
                    onClick={() => handleAllocateToInstitute(inst.code)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', border: '1.5px solid #D1E5DF', borderRadius: 8,
                      background: '#fff', cursor: 'pointer', fontSize: 14, color: '#1A2B28',
                      fontWeight: 500, textAlign: 'left', transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#F0FFF4'; e.currentTarget.style.borderColor = '#0C6B5A' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#D1E5DF' }}
                  >
                    <span>{inst.name}</span>
                    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='#0C6B5A' strokeWidth='2'>
                      <polyline points='9 18 15 12 9 6' />
                    </svg>
                  </button>
                ))}
                {institutes.length === 0 && (
                  <div style={{ fontSize: 13, color: '#5C7A72', textAlign: 'center', padding: 16 }}>
                    No institutes found.
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setShowAllocateModal(false)}
              disabled={allocating}
              style={{
                marginTop: 20, width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 600,
                border: '1.5px solid #D1E5DF', borderRadius: 8, background: '#fff',
                color: '#5C7A72', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Slot Configuration Modal */}
      {showSlotModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => !applyingSlots && setShowSlotModal(false)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 28, width: 480, maxHeight: '80vh',
            overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#1A2B28' }}>
              Assign Slot Configuration
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#5C7A72' }}>
              Select a slot configuration to apply to {selectedIds.size} counsellor(s)
            </p>

            {applyingSlots ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#5C7A72', fontSize: 14 }}>
                Generating slots...
              </div>
            ) : slotConfigsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#5C7A72', fontSize: 14 }}>
                Loading configurations...
              </div>
            ) : slotConfigs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#5C7A72', fontSize: 13 }}>
                No slot configurations found. Create one from the <strong>Create Slots</strong> page first.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {slotConfigs.map((cfg) => {
                  const formatDate = (d: string) => {
                    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }
                    catch { return d }
                  }
                  const formatTime = (t: string) => t?.slice(0, 5) || t
                  return (
                    <button
                      key={cfg.id}
                      onClick={() => handleApplySlotConfig(cfg.id)}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 4,
                        padding: '14px 16px', border: '1.5px solid #D1E5DF', borderRadius: 10,
                        background: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#F0FFF4'; e.currentTarget.style.borderColor = '#0C6B5A' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#D1E5DF' }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1A2B28' }}>{cfg.name}</div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#5C7A72', flexWrap: 'wrap' }}>
                        <span>{formatDate(cfg.startDate)} — {formatDate(cfg.endDate)}</span>
                        <span>{formatTime(cfg.startTime)} - {formatTime(cfg.endTime)}</span>
                        <span>{cfg.slotDuration}min</span>
                        {cfg.hasBreak && cfg.breakStart && cfg.breakEnd && (
                          <span>Break: {formatTime(cfg.breakStart)}-{formatTime(cfg.breakEnd)}</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            <button
              onClick={() => setShowSlotModal(false)}
              disabled={applyingSlots}
              style={{
                marginTop: 20, width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 600,
                border: '1.5px solid #D1E5DF', borderRadius: 8, background: '#fff',
                color: '#5C7A72', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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

      {/* Filters */}
      <div className='cl-card' style={{ padding: '12px 20px', marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type='text'
          placeholder='Search by name...'
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          style={{
            padding: '6px 10px', border: '1px solid var(--sp-border, #D1E5DF)',
            borderRadius: 6, fontSize: 13, outline: 'none', width: 200, boxSizing: 'border-box',
          }}
        />
        <select
          value={filterInstitute}
          onChange={(e) => setFilterInstitute(e.target.value ? Number(e.target.value) : '')}
          style={{
            padding: '6px 10px', border: '1px solid var(--sp-border, #D1E5DF)',
            borderRadius: 6, fontSize: 13, outline: 'none', background: '#fff',
          }}
        >
          <option value=''>All Institutes</option>
          {institutes.map((i) => (
            <option key={i.code} value={i.code}>{i.name}</option>
          ))}
        </select>
        {(filterInstitute || searchName) && (
          <button
            onClick={() => { setFilterInstitute(''); setSearchName('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E65100', fontSize: 13, fontWeight: 600 }}
          >
            Clear
          </button>
        )}
      </div>

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
      {(() => {
        // Filter counsellors by institute if filter is active
        let filteredCounsellors = counsellors
        if (filterInstitute) {
          filteredCounsellors = filteredCounsellors.filter((c) => {
            const cId = getCounsellorId(c)
            return instituteMappings.some(
              (m) => m.isActive && m.counsellor.id === cId && m.institute.instituteCode === filterInstitute
            )
          })
        }
        if (searchName.trim()) {
          const query = searchName.trim().toLowerCase()
          filteredCounsellors = filteredCounsellors.filter((c) =>
            c.name?.toLowerCase().includes(query)
          )
        }

        return loading ? (
        <div className='cl-card' style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sp-muted, #5C7A72)' }}>
          Loading counsellors...
        </div>
      ) : filteredCounsellors.length === 0 ? (
        <div className='cl-card' style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sp-muted, #5C7A72)' }}>
          {filterInstitute ? 'No counsellors found for the selected institute.' : 'No counsellors found.'}
        </div>
      ) : (
        <div className='cl-card' style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--sp-border, #D1E5DF)' }}>
                <th style={{ padding: '10px 14px', width: 40 }}>
                  <input
                    type='checkbox'
                    checked={filteredCounsellors.length > 0 && filteredCounsellors.every((c) => selectedIds.has(getCounsellorId(c)))}
                    onChange={() => toggleSelectAll(filteredCounsellors)}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#0C6B5A' }}
                  />
                </th>
                {['Name', 'Email', 'Specializations', 'Status', 'Actions'].map((col) => (
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
              {filteredCounsellors.map((c, idx) => (
                <tr
                  key={getCounsellorId(c)}
                  style={{
                    borderBottom: '1px solid var(--sp-border, #D1E5DF)',
                    background: idx % 2 === 0 ? '#fff' : 'var(--sp-bg, #F2F7F5)',
                  }}
                >
                  {/* Checkbox */}
                  <td style={{ padding: '12px 14px', width: 40 }}>
                    <input
                      type='checkbox'
                      checked={selectedIds.has(getCounsellorId(c))}
                      onChange={() => toggleSelect(getCounsellorId(c))}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#0C6B5A' }}
                    />
                  </td>

                  {/* Name */}
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
                        background: '#E8F5E9', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexShrink: 0, border: '1px solid #D1E5DF',
                      }}>
                        {c.profileImageUrl ? (
                          <img src={c.profileImageUrl} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#0C6B5A' }}>
                            {c.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--sp-text, #1A2B28)' }}>{c.name}</div>
                        {c.isExternal && (
                          <div style={{ fontSize: 11, color: 'var(--sp-muted, #5C7A72)', marginTop: 1 }}>
                            External
                          </div>
                        )}
                      </div>
                    </div>
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
                    {(() => {
                      const status = c.onboardingStatus || (c.isActive ? 'ACTIVE' : 'INACTIVE')
                      const colors: Record<string, { bg: string; color: string }> = {
                        ACTIVE: { bg: '#D1FAE5', color: '#065F46' },
                        PENDING: { bg: '#FEF3C7', color: '#92400E' },
                        SUSPENDED: { bg: '#FEE2E2', color: '#991B1B' },
                      }
                      const sc = colors[status] || { bg: '#F3F4F6', color: '#6B7280' }
                      return (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 600,
                            background: sc.bg,
                            color: sc.color,
                          }}
                        >
                          {status}
                        </span>
                      )
                    })()}
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
                        disabled={togglingId === getCounsellorId(c)}
                        onClick={() => handleToggleActive(c)}
                      >
                        {togglingId === getCounsellorId(c)
                          ? '...'
                          : c.isActive
                          ? 'Deactivate'
                          : 'Activate'}
                      </button>
                      <button
                        className={
                          assigningCounsellor && getCounsellorId(assigningCounsellor) === getCounsellorId(c)
                            ? 'cl-btn-warning'
                            : 'cl-btn-outline'
                        }
                        style={{ fontSize: 12, padding: '5px 12px' }}
                        onClick={() => handleManageStudents(c)}
                      >
                        Appointments
                      </button>
                      {getActiveMapping(getCounsellorId(c)) && (
                        <button
                          className='cl-btn-danger'
                          style={{ fontSize: 12, padding: '5px 12px' }}
                          onClick={() => handleDeallocate(c)}
                        >
                          Deallocate ({getActiveMapping(getCounsellorId(c))?.institute.instituteName})
                        </button>
                      )}
                      <button
                        className={
                          viewingSlotsCounsellor && getCounsellorId(viewingSlotsCounsellor) === getCounsellorId(c)
                            ? 'cl-btn-warning'
                            : 'cl-btn-outline'
                        }
                        style={{ fontSize: 12, padding: '5px 12px' }}
                        onClick={() => setViewingSlotsCounsellor((prev) =>
                          prev && getCounsellorId(prev) === getCounsellorId(c) ? null : c
                        )}
                      >
                        Slots
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      })()}

      {/* Appointments Section */}
      {assigningCounsellor && (
        <AppointmentsSection
          counsellor={assigningCounsellor}
          onClose={() => setAssigningCounsellor(null)}
        />
      )}

      {/* Slots Modal */}
      {viewingSlotsCounsellor && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setViewingSlotsCounsellor(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, width: 560, maxHeight: '85vh',
            overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }} onClick={(e) => e.stopPropagation()}>
            <SlotsSection
              counsellor={viewingSlotsCounsellor}
              onClose={() => setViewingSlotsCounsellor(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default CounsellorManagementPage
