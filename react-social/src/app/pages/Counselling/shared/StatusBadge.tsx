import React from 'react'
import '../Counselling.css'

const STATUS_CLASS_MAP: Record<string, string> = {
  CONFIRMED: 'cl-badge-confirmed',
  PENDING: 'cl-badge-pending',
  ASSIGNED: 'cl-badge-assigned',
  COMPLETED: 'cl-badge-completed',
  ENDED: 'cl-badge-completed',
  CANCELLED: 'cl-badge-cancelled',
  RESCHEDULED: 'cl-badge-rescheduled',
  NEEDS_NOTES: 'cl-badge-needs-notes',
  AVAILABLE: 'cl-badge-confirmed',
  REQUESTED: 'cl-badge-pending',
}

interface StatusBadgeProps {
  status: string
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <span className={`cl-badge ${STATUS_CLASS_MAP[status] || 'cl-badge-pending'}`}>
    {status}
  </span>
)

export default StatusBadge
