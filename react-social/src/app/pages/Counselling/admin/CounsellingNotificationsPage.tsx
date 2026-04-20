import React, { useEffect, useState } from 'react'
import '../Counselling.css'
import { KTSVG } from '../../../../_metronic/helpers'
import { getRecentActivities, markAllAsRead, ActivityLog } from '../API/CounsellingActivityAPI'
import { getPendingBlockRequests, approveBlockRequest, rejectBlockRequest, BlockDateRequest } from '../API/BlockDateRequestAPI'
import { getAllCounsellors, toggleCounsellorActive } from '../API/CounsellorAPI'

const TYPE_CONFIG: Record<string, { iconPath: string; color: string; bg: string }> = {
  COUNSELLOR_REGISTERED: { iconPath: '/media/icons/duotune/communication/com013.svg', color: '#0369A1', bg: '#F0F9FF' },
  COUNSELLOR_ACTIVATED: { iconPath: '/media/icons/duotune/general/gen037.svg', color: '#065F46', bg: '#F0FDF4' },
  COUNSELLOR_SUSPENDED: { iconPath: '/media/icons/duotune/general/gen044.svg', color: '#991B1B', bg: '#FEF2F2' },
  BLOCK_DATE_REQUESTED: { iconPath: '/media/icons/duotune/general/gen014.svg', color: '#92400E', bg: '#FFFBEB' },
  BLOCK_DATE_APPROVED: { iconPath: '/media/icons/duotune/general/gen037.svg', color: '#065F46', bg: '#F0FDF4' },
  BLOCK_DATE_REJECTED: { iconPath: '/media/icons/duotune/general/gen040.svg', color: '#991B1B', bg: '#FEF2F2' },
  SLOT_BOOKED: { iconPath: '/media/icons/duotune/general/gen005.svg', color: '#5B21B6', bg: '#F5F3FF' },
}

const DEFAULT_CONFIG = { iconPath: '/media/icons/duotune/general/gen007.svg', color: '#374151', bg: '#F9FAFB' }

function timeAgo(dateStr: string): string {
  try {
    const now = new Date()
    const d = new Date(dateStr)
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay}d ago`
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

const CounsellingNotificationsPage: React.FC = () => {
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [pendingBlocks, setPendingBlocks] = useState<BlockDateRequest[]>([])
  const [pendingCounsellors, setPendingCounsellors] = useState<any[]>([])
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadData = () => {
    setLoading(true)
    Promise.all([
      getRecentActivities(100),
      getPendingBlockRequests().catch(() => ({ data: [] })),
      getAllCounsellors().catch(() => ({ data: [] })),
    ])
      .then(([actRes, brRes, cRes]) => {
        setActivities(Array.isArray(actRes.data) ? actRes.data : [])
        setPendingBlocks(Array.isArray(brRes.data) ? brRes.data : [])
        const allCounsellors = Array.isArray(cRes.data) ? cRes.data : []
        setPendingCounsellors(allCounsellors.filter((c: any) =>
          c.onboardingStatus === 'PENDING' && c.isActive === false
        ))
      })
      .catch(() => setActivities([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleApproveBlock = async (id: number) => {
    setActionLoading(id)
    try {
      await approveBlockRequest(id)
      setSuccess('Block date approved. Slots cancelled for that date.')
      setTimeout(() => setSuccess(null), 4000)
      loadData()
    } catch { /* ignore */ }
    finally { setActionLoading(null) }
  }

  const handleActivateCounsellor = async (counsellor: any) => {
    const cId = counsellor.id || counsellor.counsellorId
    setActionLoading(cId)
    try {
      await toggleCounsellorActive(cId)
      setSuccess(`${counsellor.name} has been activated.`)
      setTimeout(() => setSuccess(null), 4000)
      loadData()
    } catch { /* ignore */ }
    finally { setActionLoading(null) }
  }

  const handleRejectBlock = async (id: number) => {
    setActionLoading(id)
    try {
      await rejectBlockRequest(id)
      setSuccess('Block date request rejected.')
      setTimeout(() => setSuccess(null), 4000)
      loadData()
    } catch { /* ignore */ }
    finally { setActionLoading(null) }
  }

  const handleMarkAllRead = () => {
    markAllAsRead()
      .then(() => setActivities((prev) => prev.map((a) => ({ ...a, isRead: true }))))
      .catch(() => {})
  }

  const unreadCount = activities.filter((a) => !a.isRead).length

  const filtered = filter === 'all'
    ? activities
    : filter === 'unread'
    ? activities.filter((a) => !a.isRead)
    : activities.filter((a) => a.activityType === filter)

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: `Unread (${unreadCount})` },
    { key: 'COUNSELLOR_REGISTERED', label: 'Registrations' },
    { key: 'BLOCK_DATE_REQUESTED', label: 'Block Requests' },
    { key: 'SLOT_BOOKED', label: 'Bookings' },
  ]

  return (
    <div style={{ padding: '24px 28px', background: 'var(--sp-bg, #F2F7F5)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--sp-text, #1A2B28)' }}>
            Counselling Notifications
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--sp-muted, #5C7A72)' }}>
            Activity log of all counsellor-related events
          </p>
        </div>
        {unreadCount > 0 && (
          <button className='cl-btn-outline' onClick={handleMarkAllRead} style={{ fontSize: 13 }}>
            Mark all as read
          </button>
        )}
      </div>

      {/* Success */}
      {success && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', background: '#D1FAE5',
          border: '1px solid #A7F3D0', borderRadius: 8, color: '#065F46', fontSize: 14,
        }}>{success}</div>
      )}

      {/* Pending Registrations */}
      {pendingCounsellors.length > 0 && (
        <div style={{
          marginBottom: 20, background: '#fff', borderRadius: 12,
          border: '2px solid #93C5FD', overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 20px', background: '#EFF6FF', borderBottom: '1px solid #BFDBFE',
            fontWeight: 700, fontSize: 15, color: '#1E40AF',
          }}>
            Pending Registrations ({pendingCounsellors.length})
          </div>
          <div style={{ padding: 12 }}>
            {pendingCounsellors.map((c: any) => {
              const cId = c.id || c.counsellorId
              return (
                <div key={cId} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', background: '#F0F9FF', border: '1px solid #DBEAFE',
                  borderRadius: 8, marginBottom: 8, fontSize: 13,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', background: '#DBEAFE',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 15, color: '#1E40AF',
                    }}>
                      {c.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1E293B' }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                        {c.email}
                        {c.specializations && <> &middot; {c.specializations}</>}
                      </div>
                    </div>
                  </div>
                  <button
                    className='cl-btn-primary'
                    style={{ fontSize: 12, padding: '5px 14px', flexShrink: 0 }}
                    disabled={actionLoading === cId}
                    onClick={() => handleActivateCounsellor(c)}
                  >
                    {actionLoading === cId ? '...' : 'Activate'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pending Block Requests */}
      {pendingBlocks.length > 0 && (
        <div style={{
          marginBottom: 20, background: '#fff', borderRadius: 12,
          border: '2px solid #FCA5A5', overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 20px', background: '#FEF2F2', borderBottom: '1px solid #FECACA',
            fontWeight: 700, fontSize: 15, color: '#991B1B',
          }}>
            Pending Block Date Requests ({pendingBlocks.length})
          </div>
          <div style={{ padding: 12 }}>
            {pendingBlocks.map((r) => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', background: '#FFFBEB', border: '1px solid #FDE68A',
                borderRadius: 8, marginBottom: 8, fontSize: 13,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <KTSVG path='/media/icons/duotune/general/gen014.svg' className='svg-icon-2x svg-icon-warning' />
                  <div>
                    <div style={{ fontWeight: 600, color: '#1E293B' }}>{r.counsellor.name}</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                      Wants to block <strong>{r.blockDate}</strong>
                      {r.reason && <> &middot; {r.reason}</>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className='cl-btn-primary'
                    style={{ fontSize: 12, padding: '5px 14px' }}
                    disabled={actionLoading === r.id}
                    onClick={() => handleApproveBlock(r.id)}
                  >
                    {actionLoading === r.id ? '...' : 'Approve'}
                  </button>
                  <button
                    className='cl-btn-danger'
                    style={{ fontSize: 12, padding: '5px 14px' }}
                    disabled={actionLoading === r.id}
                    onClick={() => handleRejectBlock(r.id)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: filter === f.key ? 'var(--sp-primary, #0C6B5A)' : '#F3F4F6',
              color: filter === f.key ? '#fff' : '#374151',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Activity List */}
      {loading ? (
        <div className='cl-card' style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sp-muted)' }}>
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className='cl-card' style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sp-muted, #5C7A72)' }}>
          {filter === 'all' ? 'No activity yet.' : 'No activities match this filter.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((a) => {
            const cfg = TYPE_CONFIG[a.activityType] || DEFAULT_CONFIG
            return (
              <div
                key={a.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '14px 18px', background: a.isRead ? '#fff' : cfg.bg,
                  border: `1px solid ${a.isRead ? '#E2E8F0' : 'rgba(0,0,0,0.06)'}`,
                  borderRadius: 10, transition: 'all 0.15s',
                  borderLeft: a.isRead ? undefined : `3px solid ${cfg.color}`,
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: a.isRead ? '#F1F5F9' : cfg.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, color: cfg.color,
                }}>
                  <KTSVG path={cfg.iconPath} className='svg-icon-2' />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#1E293B' }}>{a.title}</span>
                    {!a.isRead && (
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', background: cfg.color, flexShrink: 0,
                      }} />
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{a.description}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: 11, color: '#94A3B8' }}>
                    <span>{timeAgo(a.createdAt)}</span>
                    {a.counsellor && <span>{a.counsellor.name}</span>}
                    {a.actorName && a.actorName !== a.counsellor?.name && <span>by {a.actorName}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CounsellingNotificationsPage
