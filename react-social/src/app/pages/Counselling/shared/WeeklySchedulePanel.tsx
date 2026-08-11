import React, { useCallback, useEffect, useRef, useState } from 'react'
import { getTemplatesByCounsellor, deleteTemplate } from '../API/AvailabilityTemplateAPI'
import { useRefreshInterval } from '../../../utils/useAutoRefresh'
import WeeklyScheduleForm, { ExistingSlot } from './WeeklyScheduleForm'

interface Template {
  id: number
  dayOfWeek: string
  startTime: string
  endTime: string
  defaultSlotDuration?: number
  mode?: string
  startDate?: string
  endDate?: string
}

interface Props {
  counsellorIds: number[]
  officeAddress: string
  onOfficeAddressChange: (value: string) => void
  meetingLink?: string
  onMeetingLinkChange?: (value: string) => void
  /**
   * The counsellor's slots, when the parent already has them. Passed straight to the
   * form so its "already covered" warning can name the dates that really collide
   * instead of guessing from the weekly rules. Absent on the several-counsellors path.
   */
  existingSlots?: ExistingSlot[]
  /** Lets the parent page refresh its own lists after a change. */
  onChanged?: () => void
}

const hhmm = (t?: string) => (t ? String(t).slice(0, 5) : '—')

const shortDate = (d?: string) => {
  if (!d) return ''
  const iso = String(d).slice(0, 10)
  const parsed = new Date(iso + 'T00:00:00')
  return isNaN(parsed.getTime())
    ? iso
    : parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * The "Weekly Schedule" card: the recurring schedules already set up, plus the
 * form to add or change one. Rendered identically in the counsellor's own portal
 * and in the admin's Manage Counsellors screen.
 *
 * Editing is a replace: the old template is deleted (which also clears its
 * unbooked future slots) and a new one is created, because updating the template
 * alone would leave the already-generated slots on the old timings.
 */
const CounsellorWeeklySchedulePanel: React.FC<Props> = ({
  counsellorIds,
  officeAddress,
  onOfficeAddressChange,
  meetingLink,
  onMeetingLinkChange,
  existingSlots,
  onChanged,
}) => {
  const single = counsellorIds.length === 1 ? counsellorIds[0] : null

  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  // True once an edit has dropped the original template — so a failure after that
  // point can say the old schedule is gone instead of implying nothing changed.
  const oldRemovedRef = useRef(false)

  const loadTemplates = useCallback(() => {
    if (!single) { setTemplates([]); return }
    setLoading(true)
    getTemplatesByCounsellor(single)
      .then((res) => setTemplates(Array.isArray(res.data) ? res.data : []))
      .catch(() => setMessage({ kind: 'error', text: 'Failed to load the existing schedule.' }))
      .finally(() => setLoading(false))
  }, [single])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  // Admin and counsellor can both be looking at this at the same time — poll so a
  // schedule added on one side turns up on the other without a manual reload.
  useRefreshInterval(loadTemplates, { skip: !single })

  const afterChange = (text: string) => {
    oldRemovedRef.current = false
    setMessage({ kind: 'success', text })
    setEditing(null)
    loadTemplates()
    onChanged?.()
  }

  const handleSaveError = (text: string) => {
    if (oldRemovedRef.current) {
      // The save got past the point of no return: the original is already gone.
      oldRemovedRef.current = false
      setMessage({
        kind: 'error',
        text: text + ' The schedule you were editing was removed as part of the change, and nothing replaced it — add it again if you still need it.',
      })
      setEditing(null)
      onChanged?.()
    } else {
      // Plain validation, or an add that was discarded for producing no slots —
      // keep the form as the user left it.
      setMessage({ kind: 'error', text })
    }
    loadTemplates()
  }

  const handleRemove = async (t: Template) => {
    if (!window.confirm(`Remove the ${t.dayOfWeek} ${hhmm(t.startTime)}–${hhmm(t.endTime)} schedule? Unbooked slots from it are deleted; booked sessions are kept.`)) return
    setRemovingId(t.id)
    setMessage(null)
    try {
      await deleteTemplate(t.id)
      afterChange('Schedule removed.')
    } catch {
      setMessage({ kind: 'error', text: 'Failed to remove the schedule.' })
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div style={{
      background: '#F8F9FC', borderRadius: 12, border: '1px solid #DDE3EC', padding: 20,
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#1E293B', marginBottom: 4 }}>
        Weekly Schedule
      </div>
      <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 14px' }}>
        Set the recurring weekly availability — bookable slots are generated automatically for the upcoming weeks.
      </p>

      {message && (
        <div style={{
          marginBottom: 14, padding: '9px 12px', borderRadius: 8, fontSize: 12,
          background: message.kind === 'success' ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${message.kind === 'success' ? '#BBF7D0' : '#FECACA'}`,
          color: message.kind === 'success' ? '#065F46' : '#991B1B',
        }}>
          {message.text}
        </div>
      )}

      {loading && (
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>Loading…</div>
      )}

      {templates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {templates.map((t) => {
            const isEditing = editing?.id === t.id
            return (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: '#F8FAFC', borderRadius: 8,
                border: `1px solid ${isEditing ? '#263B6A' : '#F1F5F9'}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>
                  {t.dayOfWeek} &middot; {hhmm(t.startTime)} – {hhmm(t.endTime)}
                  <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>
                    {' '}({t.defaultSlotDuration || 30}-min slots{t.endDate ? `, until ${shortDate(t.endDate)}` : ''})
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => { setMessage(null); setEditing(isEditing ? null : t) }}
                    style={{
                      background: 'none', border: '1px solid #C3CDDE', color: '#263B6A',
                      borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {isEditing ? 'Editing…' : 'Edit'}
                  </button>
                  <button
                    onClick={() => handleRemove(t)}
                    disabled={removingId === t.id}
                    style={{
                      background: 'none', border: '1px solid #FECACA', color: '#DC2626',
                      borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                      cursor: removingId === t.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {removingId === t.id ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!single && (
        <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 14px' }}>
          {counsellorIds.length} counsellors selected — the schedule below is added to all of them.
          Select a single counsellor to view or change what they already have.
        </p>
      )}

      {editing && (
        <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 10px' }}>
          Editing the {editing.dayOfWeek} schedule — change the values below and save.
        </p>
      )}

      <WeeklyScheduleForm
        // Remount so the form picks up the template being edited (or resets to blank).
        key={editing ? `edit-${editing.id}` : 'new'}
        counsellorIds={counsellorIds}
        officeAddress={officeAddress}
        onOfficeAddressChange={onOfficeAddressChange}
        meetingLink={meetingLink}
        onMeetingLinkChange={onMeetingLinkChange}
        onSaved={(text) => afterChange(editing ? 'Schedule updated.' : text)}
        onError={handleSaveError}
        existingTemplates={templates}
        existingSlots={existingSlots}
        ignoreTemplateId={editing?.id}
        initial={editing ? {
          days: [editing.dayOfWeek],
          startTime: hhmm(editing.startTime),
          endTime: hhmm(editing.endTime),
          slotDurationMinutes: editing.defaultSlotDuration || 30,
          mode: editing.mode === 'OFFLINE' ? 'OFFLINE' : 'ONLINE',
          startDate: editing.startDate ? String(editing.startDate).slice(0, 10) : '',
          endDate: editing.endDate ? String(editing.endDate).slice(0, 10) : '',
        } : undefined}
        submitLabel={editing ? 'Save Changes' : undefined}
        onCancel={editing ? () => setEditing(null) : undefined}
        // Replace, don't stack: drop the old template (and its unbooked slots) first,
        // otherwise the new slots would be skipped as overlapping the old ones.
        beforeCreate={editing ? async () => {
          await deleteTemplate(editing.id)
          oldRemovedRef.current = true
        } : undefined}
      />
    </div>
  )
}

export default CounsellorWeeklySchedulePanel
