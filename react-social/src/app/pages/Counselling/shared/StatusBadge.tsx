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
  MISSED: 'cl-badge-cancelled',
  AWAITING_RESCHEDULE: 'cl-badge-pending',
  UNDER_REVIEW: 'cl-badge-pending',
  IN_PROGRESS: 'cl-badge-confirmed',
}

/** Raw status names read badly to a student — "AWAITING_RESCHEDULE" is not a sentence. */
const STATUS_LABEL_MAP: Record<string, string> = {
  AWAITING_RESCHEDULE: 'Awaiting your new time',
  UNDER_REVIEW: 'Under review',
  IN_PROGRESS: 'In progress',
  NEEDS_NOTES: 'Needs notes',
  MISSED: 'Missed',
}

interface StatusBadgeProps {
  status: string
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <span className={`cl-badge ${STATUS_CLASS_MAP[status] || 'cl-badge-pending'}`}>
    {STATUS_LABEL_MAP[status] || status}
  </span>
)

export default StatusBadge
