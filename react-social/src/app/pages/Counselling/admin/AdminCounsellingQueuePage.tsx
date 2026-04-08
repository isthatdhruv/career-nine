import React, { useEffect, useState } from 'react'
import '../Counselling.css'
import { useAuth } from '../../../modules/auth'
import { getQueue, assignCounsellor, getAppointmentStats } from '../API/AppointmentAPI'
import { getActiveCounsellors } from '../API/CounsellorAPI'
import StatsBar from './components/StatsBar'
import RequestQueueTable from './components/RequestQueueTable'

interface Stats {
  pending: number
  assigned: number
  confirmed: number
  thisWeek: number
}

const AdminCounsellingQueuePage: React.FC = () => {
  const { currentUser } = useAuth()
  const adminUserId: number = (currentUser as any)?.id ?? 0

  const [queue, setQueue] = useState<any[]>([])
  const [stats, setStats] = useState<Stats>({ pending: 0, assigned: 0, confirmed: 0, thisWeek: 0 })
  const [counsellors, setCounsellors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [queueRes, statsRes, counsellorsRes] = await Promise.all([
        getQueue(),
        getAppointmentStats(),
        getActiveCounsellors(),
      ])
      setQueue(queueRes.data ?? [])
      setStats(statsRes.data ?? { pending: 0, assigned: 0, confirmed: 0, thisWeek: 0 })
      setCounsellors(counsellorsRes.data ?? [])
    } catch (err) {
      setError('Failed to load data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAssign = async (appointmentId: number, counsellorId: number) => {
    try {
      await assignCounsellor(appointmentId, counsellorId, adminUserId)
      await loadData()
    } catch (err) {
      setError('Failed to assign counsellor. Please try again.')
    }
  }

  return (
    <div style={{ padding: '24px 28px', background: 'var(--sp-bg, #F2F7F5)', minHeight: '100vh' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--sp-text, #1A2B28)' }}>
            Counselling Queue
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--sp-muted, #5C7A72)' }}>
            Review and assign counsellors to student appointment requests
          </p>
        </div>
        <button
          className='cl-btn-outline'
          onClick={loadData}
          disabled={loading}
          style={{ fontSize: 13 }}
        >
          <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <polyline points='23 4 23 10 17 10' />
            <polyline points='1 20 1 14 7 14' />
            <path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' />
          </svg>
          Refresh
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
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontSize: 16, lineHeight: 1 }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Stats Bar */}
      <StatsBar stats={stats} />

      {/* Queue Table */}
      {loading ? (
        <div className='cl-card' style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sp-muted, #5C7A72)' }}>
          Loading queue...
        </div>
      ) : (
        <RequestQueueTable queue={queue} counsellors={counsellors} onAssign={handleAssign} />
      )}
    </div>
  )
}

export default AdminCounsellingQueuePage
