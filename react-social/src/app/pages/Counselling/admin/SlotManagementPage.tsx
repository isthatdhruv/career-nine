import React, { useState } from 'react'
import '../Counselling.css'
import { cleanupLegacy } from '../API/SlotConfigurationAPI'
import PageHeader from '../../../components/PageHeader'
import BulkCounsellingAllotmentPage from './BulkCounsellingAllotmentPage'
import SingleStudentBookingPage from './SingleStudentBookingPage'

/**
 * Admin booking tools. Slot creation used to live here as reusable "slot
 * configurations"; counsellor availability is now set up per counsellor from
 * Manage Counsellors, using the same screen the counsellor uses, so the
 * configuration tool has been retired.
 */
const SlotManagementPage: React.FC = () => {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Which booking tool is shown.
  const [activeTab, setActiveTab] = useState<'bulk' | 'single'>('bulk')
  const [cleaning, setCleaning] = useState(false)

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 4000)
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

  return (
    <div className="ph-page">
    <div style={{ padding: '24px 28px', background: 'var(--sp-bg, #F2F7F5)', minHeight: '100vh' }}>
      <PageHeader
        icon={<i className="bi bi-calendar-week" />}
        title="Counselling Bookings"
        subtitle="Book counselling sessions for students. Counsellor slots are set up from Manage Counsellors."
      />

      {/* Tool selector — card style, mirrors the "Mapping Level" selector */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: '16px 24px',
        border: '1px solid #e2e8f0', marginBottom: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#475569', marginBottom: 10 }}>
          Counselling Tool
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <TabOption
            label="Bulk Allotment"
            description="Auto-book counselling for everyone who completed an assessment"
            active={activeTab === 'bulk'}
            onClick={() => setActiveTab('bulk')}
            accent="#2563eb"
          />
          <TabOption
            label="Book for Student"
            description="Pick one student + a slot → book a single counselling session"
            active={activeTab === 'single'}
            onClick={() => setActiveTab('single')}
            accent="#7c3aed"
          />
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

      {activeTab === 'bulk' && <BulkCounsellingAllotmentPage />}
      {activeTab === 'single' && <SingleStudentBookingPage />}

      {/* Maintenance — one-off cleanup of slots/templates left by the old system. */}
      <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
        <button
          onClick={handleCleanupLegacy}
          disabled={cleaning}
          style={{
            fontSize: 13, padding: '8px 16px', borderRadius: 8,
            background: '#fff', border: '1.5px solid #FECACA',
            color: '#991B1B', fontWeight: 600,
            cursor: cleaning ? 'not-allowed' : 'pointer', opacity: cleaning ? 0.6 : 1,
          }}
        >
          {cleaning ? 'Cleaning…' : 'Cleanup Legacy Slots'}
        </button>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
          Deletes slots and weekly schedules left behind by the old slot system. Booked sessions are kept.
        </div>
      </div>
    </div>
    </div>
  )
}

interface TabOptionProps {
  label: string
  description: string
  active: boolean
  onClick: () => void
  accent: string
}

// Card-style selector matching the AssessmentMapping "Mapping Level" options:
// radio dot + bold title + description, accent-tinted border/background when active.
const TabOption = ({ label, description, active, onClick, accent }: TabOptionProps) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      flex: '1 1 220px',
      textAlign: 'left',
      padding: '14px 18px',
      borderRadius: 12,
      border: active ? `2px solid ${accent}` : '1.5px solid #e2e8f0',
      background: active ? `${accent}10` : '#fff',
      cursor: 'pointer',
      transition: 'all 0.15s',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        width: 16, height: 16, borderRadius: '50%',
        border: `2px solid ${accent}`,
        background: active ? accent : 'transparent',
        flexShrink: 0,
      }} />
      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: active ? accent : '#1e293b' }}>
        {label}
      </div>
    </div>
    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 6, marginLeft: 26 }}>
      {description}
    </div>
  </button>
)

export default SlotManagementPage
