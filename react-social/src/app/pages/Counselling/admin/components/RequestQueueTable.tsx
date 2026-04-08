import React, { useState } from 'react'
import StatusBadge from '../../shared/StatusBadge'
import AssignCounsellorDropdown from './AssignCounsellorDropdown'
import '../../Counselling.css'

interface Slot {
  date: string
  startTime: string
  endTime: string
  durationMinutes: number
}

interface Student {
  name?: string
  course?: string
  year?: string
  rollNumber?: string
}

interface Counsellor {
  counsellorId: number
  name: string
  specializations?: string
}

interface Appointment {
  appointmentId: number
  status: string
  reason?: string
  slot: Slot
  student?: Student
  assignedCounsellorName?: string
}

interface RequestQueueTableProps {
  queue: Appointment[]
  counsellors: Counsellor[]
  onAssign: (appointmentId: number, counsellorId: number) => void
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatTime(timeStr: string): string {
  try {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
  } catch {
    return timeStr
  }
}

const RequestQueueTable: React.FC<RequestQueueTableProps> = ({ queue, counsellors, onAssign }) => {
  const [selectedCounsellors, setSelectedCounsellors] = useState<Record<number, number | null>>({})

  const handleSelect = (appointmentId: number, counsellorId: number | null) => {
    setSelectedCounsellors((prev) => ({ ...prev, [appointmentId]: counsellorId }))
  }

  const handleAssign = (appointmentId: number) => {
    const counsellorId = selectedCounsellors[appointmentId]
    if (!counsellorId) return
    onAssign(appointmentId, counsellorId)
    setSelectedCounsellors((prev) => ({ ...prev, [appointmentId]: null }))
  }

  if (queue.length === 0) {
    return (
      <div className='cl-card' style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--sp-muted, #5C7A72)' }}>
        No appointment requests in the queue.
      </div>
    )
  }

  return (
    <div className='cl-card' style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--sp-border, #D1E5DF)' }}>
            {['Student', 'Requested Slot', 'Reason', 'Status', 'Action'].map((col) => (
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
          {queue.map((appt, idx) => (
            <tr
              key={appt.appointmentId}
              style={{
                borderBottom: '1px solid var(--sp-border, #D1E5DF)',
                background: idx % 2 === 0 ? '#fff' : 'var(--sp-bg, #F2F7F5)',
              }}
            >
              {/* Student */}
              <td style={{ padding: '12px 14px' }}>
                <div style={{ fontWeight: 600, color: 'var(--sp-text, #1A2B28)' }}>
                  {appt.student?.name || 'Unknown Student'}
                </div>
                {(appt.student?.course || appt.student?.year) && (
                  <div style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', marginTop: 2 }}>
                    {[appt.student.course, appt.student.year].filter(Boolean).join(' · ')}
                  </div>
                )}
                {appt.student?.rollNumber && (
                  <div style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)' }}>
                    Roll: {appt.student.rollNumber}
                  </div>
                )}
              </td>

              {/* Slot */}
              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                <div style={{ fontWeight: 500, color: 'var(--sp-text, #1A2B28)' }}>
                  {formatDate(appt.slot.date)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', marginTop: 2 }}>
                  {formatTime(appt.slot.startTime)} – {formatTime(appt.slot.endTime)}
                </div>
                {appt.slot.durationMinutes > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)' }}>
                    {appt.slot.durationMinutes} min
                  </div>
                )}
              </td>

              {/* Reason */}
              <td style={{ padding: '12px 14px', maxWidth: 200 }}>
                <span style={{ color: appt.reason ? 'var(--sp-text, #1A2B28)' : 'var(--sp-muted, #5C7A72)', fontStyle: appt.reason ? 'normal' : 'italic' }}>
                  {appt.reason || 'No reason provided'}
                </span>
              </td>

              {/* Status */}
              <td style={{ padding: '12px 14px' }}>
                <StatusBadge status={appt.status} />
              </td>

              {/* Action */}
              <td style={{ padding: '12px 14px' }}>
                {appt.status === 'PENDING' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <AssignCounsellorDropdown
                      counsellors={counsellors}
                      selectedCounsellorId={selectedCounsellors[appt.appointmentId] ?? null}
                      onSelect={(id) => handleSelect(appt.appointmentId, id)}
                    />
                    <button
                      className='cl-btn-primary'
                      style={{ fontSize: 13, padding: '6px 14px' }}
                      disabled={!selectedCounsellors[appt.appointmentId]}
                      onClick={() => handleAssign(appt.appointmentId)}
                    >
                      Assign
                    </button>
                  </div>
                )}
                {appt.status === 'ASSIGNED' && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--sp-text, #1A2B28)' }}>
                      {appt.assignedCounsellorName || 'Counsellor assigned'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', marginTop: 2, fontStyle: 'italic' }}>
                      Awaiting confirmation
                    </div>
                  </div>
                )}
                {appt.status !== 'PENDING' && appt.status !== 'ASSIGNED' && (
                  <span style={{ fontSize: 13, color: 'var(--sp-muted, #5C7A72)' }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default RequestQueueTable
