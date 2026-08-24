import React, { useCallback, useEffect, useRef, useState } from 'react'
import { getTemplatesByCounsellor, deleteTemplate, deleteTemplates } from '../API/AvailabilityTemplateAPI'
import { useRefreshInterval } from '../../../utils/useAutoRefresh'
import WeeklyScheduleForm, { ExistingSlot } from './WeeklyScheduleForm'

interface Template {
  id: number
  /** Attached on load — the admin can be looking at several counsellors at once. */
  counsellorId: number
  dayOfWeek: string
  startTime: string
  endTime: string
  defaultSlotDuration?: number
  /** Gap between consecutive generated slots, minutes. Null/0 = back-to-back. */
  breakMinutes?: number
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
  /**
   * Display names by counsellor id. Only needed when several counsellors are being
   * managed together, to head each group with whose schedule it is.
   */
  counsellorNames?: Record<number, string>
  /** Lets the parent page refresh its own lists after a change. */
  onChanged?: () => void
  /**
   * Bumped by the parent whenever something outside this card changed the schedules —
   * deleting the last slot a schedule had left removes the schedule server-side, and the
   * list here has to follow at once rather than at the next poll.
   */
  reloadToken?: number
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

/** Today as yyyy-MM-dd in local time — the cut-off for "still ahead of us". */
const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  counsellorNames,
  onChanged,
  reloadToken,
}) => {
  const single = counsellorIds.length === 1 ? counsellorIds[0] : null
  // Stable dependency for the loader — the parent rebuilds the id array every render.
  const idsKey = counsellorIds.join(',')

  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [bulkRemoving, setBulkRemoving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  // True once an edit has dropped the original template — so a failure after that
  // point can say the old schedule is gone instead of implying nothing changed.
  const oldRemovedRef = useRef(false)
  // The edit form lives below the (possibly long) schedule list — without scrolling
  // it into view, pressing Edit looks like it did nothing.
  const formRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (editing) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editing])

  /**
   * Load what every selected counsellor already has. The admin can have several picked at
   * once, and used to be shown nothing at all in that case — so there was no way to clear
   * out stale schedules for a group without opening each counsellor in turn.
   */
  const loadTemplates = useCallback(() => {
    const ids = idsKey ? idsKey.split(',').map(Number) : []
    if (ids.length === 0) { setTemplates([]); return }
    setLoading(true)
    Promise.all(ids.map((id) =>
      getTemplatesByCounsellor(id)
        .then((res) => (Array.isArray(res.data) ? res.data : [])
          .map((t: any) => ({ ...t, counsellorId: id } as Template)))))
      .then((lists) => {
        const list = lists.flat()
        setTemplates(list)
        // Rows removed elsewhere (the other side of the screen, or the poll) must not stay
        // ticked, or "Remove selected" would try to delete something already gone.
        setSelectedIds((prev) => prev.filter((id) => list.some((t) => t.id === id)))
      })
      .catch(() => setMessage({ kind: 'error', text: 'Failed to load the existing schedule.' }))
      .finally(() => setLoading(false))
  }, [idsKey])

  useEffect(() => { loadTemplates() }, [loadTemplates, reloadToken])

  // Admin and counsellor can both be looking at this at the same time — poll so a
  // schedule added on one side turns up on the other without a manual reload.
  useRefreshInterval(loadTemplates, { skip: counsellorIds.length === 0 })

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
      setSelectedIds((prev) => prev.filter((id) => id !== t.id))
      afterChange('Schedule removed.')
    } catch {
      setMessage({ kind: 'error', text: 'Failed to remove the schedule.' })
    } finally {
      setRemovingId(null)
    }
  }

  const toggleSelected = (id: number) => {
    setMessage(null)
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const allSelected = templates.length > 0 && selectedIds.length === templates.length

  const toggleSelectAll = () => {
    setMessage(null)
    setSelectedIds(allSelected ? [] : templates.map((t) => t.id))
  }

  /**
   * Remove every ticked schedule in one request. The server deletes each independently, so
   * a row that cannot go (a booked session still hanging off it) doesn't stop the others —
   * it comes back in `failedIds` and is named here.
   */
  const handleRemoveSelected = async () => {
    if (selectedIds.length === 0) return
    const chosen = templates.filter((t) => selectedIds.includes(t.id))
    const summary = chosen
      // With several counsellors in play, "Monday 09:00–18:00" alone doesn't say whose.
      .map((t) => `• ${single ? '' : counsellorLabel(t.counsellorId) + ' — '}${t.dayOfWeek} ${hhmm(t.startTime)}–${hhmm(t.endTime)}`)
      .join('\n')
    if (!window.confirm(
      `Remove ${chosen.length} schedule${chosen.length === 1 ? '' : 's'}?\n\n${summary}\n\nUnbooked slots from them are deleted; booked sessions are kept.`,
    )) return
    setBulkRemoving(true)
    setMessage(null)
    try {
      const res = await deleteTemplates(selectedIds)
      const failed: number[] = Array.isArray(res.data?.failedIds) ? res.data.failedIds : []
      const removed = selectedIds.length - failed.length
      setSelectedIds(failed)
      if (failed.length === 0) {
        afterChange(`${removed} schedule${removed === 1 ? '' : 's'} removed.`)
      } else {
        const names = templates
          .filter((t) => failed.includes(t.id))
          .map((t) => `${t.dayOfWeek} ${hhmm(t.startTime)}–${hhmm(t.endTime)}`)
          .join(', ')
        setMessage({
          kind: 'error',
          text: `${removed} removed, but ${failed.length} could not be: ${names}.`,
        })
        setEditing(null)
        loadTemplates()
        onChanged?.()
      }
    } catch {
      setMessage({ kind: 'error', text: 'Failed to remove the selected schedules.' })
      loadTemplates()
    } finally {
      setBulkRemoving(false)
    }
  }

  const counsellorLabel = (id: number) => counsellorNames?.[id] || `Counsellor #${id}`

  /**
   * Rows grouped by counsellor, in the order the parent selected them. One group for the
   * counsellor's own screen (rendered without a heading), one per counsellor for the admin
   * managing several at once. Within a group the rows run Monday → Sunday, mornings
   * first — the server returns them in creation order, which reads as random.
   */
  const groups = React.useMemo(() => {
    const dayRank = (d?: string) => {
      const i = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
        .indexOf(String(d || '').toUpperCase())
      return i === -1 ? 7 : i
    }
    const byCounsellor = new Map<number, Template[]>()
    for (const id of counsellorIds) byCounsellor.set(id, [])
    for (const t of templates) {
      const arr = byCounsellor.get(t.counsellorId)
      if (arr) arr.push(t)
      else byCounsellor.set(t.counsellorId, [t])
    }
    for (const list of byCounsellor.values()) {
      list.sort((a, b) =>
        dayRank(a.dayOfWeek) - dayRank(b.dayOfWeek)
        || String(a.startTime || '').localeCompare(String(b.startTime || ''))
        || String(a.endTime || '').localeCompare(String(b.endTime || '')))
    }
    return Array.from(byCounsellor.entries()).filter(([, list]) => list.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, idsKey])

  /**
   * Bookable slots each schedule still has ahead of it. A weekly rule whose slots have all
   * been used up, deleted, or run past its end date generates nothing — saying so on the row
   * is the difference between "Weekly Schedule is full but I have no upcoming slots" reading
   * as a bug and reading as the plain fact it is.
   */
  const liveSlotCounts = React.useMemo(() => {
    const counts = new Map<number, number>()
    const today = todayIso()
    for (const slot of existingSlots || []) {
      const templateId = (slot as any)?.template?.id
      if (!templateId) continue
      if (slot.isBlocked) continue
      const status = String(slot.status || '').toUpperCase()
      if (status === 'CANCELLED') continue
      if (!slot.date || String(slot.date).slice(0, 10) < today) continue
      counts.set(templateId, (counts.get(templateId) || 0) + 1)
    }
    return counts
  }, [existingSlots])

  // Only meaningful when the parent handed us the slots to count from — which it only
  // does for a single counsellor.
  const canCountSlots = Array.isArray(existingSlots) && !!single
  const deadCount = canCountSlots
    ? templates.filter((t) => !(liveSlotCounts.get(t.id) || 0)).length
    : 0

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

      {/* Nothing this schedule can still produce — the case that reads as a contradiction
          against "you have no upcoming slots". Say it once, above the list. */}
      {canCountSlots && deadCount > 0 && (
        <div style={{
          marginBottom: 14, padding: '9px 12px', borderRadius: 8, fontSize: 12,
          background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', lineHeight: 1.6,
        }}>
          {deadCount === templates.length
            ? 'These schedules have no bookable slots left — their dates have passed or the slots were removed. They generate nothing until you add a new one, so it is safe to select and remove them.'
            : `${deadCount} of these schedules ${deadCount === 1 ? 'has' : 'have'} no bookable slots left — marked below. Removing them changes nothing that students can see.`}
        </div>
      )}

      {templates.length > 0 && (
        <>
          {/* Select-all / bulk-remove bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, marginBottom: 8, padding: '6px 12px', background: '#EEF2F8',
            border: '1px solid #DDE3EC', borderRadius: 8, flexWrap: 'wrap',
          }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
              fontWeight: 600, color: '#334155', cursor: 'pointer', margin: 0,
            }}>
              <input
                type='checkbox'
                checked={allSelected}
                ref={(el) => {
                  // Part-way through a selection reads as neither on nor off.
                  if (el) el.indeterminate = selectedIds.length > 0 && !allSelected
                }}
                onChange={toggleSelectAll}
                style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#263B6A' }}
              />
              Select all ({templates.length})
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {selectedIds.length > 0 && (
                <span style={{ fontSize: 12, color: '#64748B' }}>{selectedIds.length} selected</span>
              )}
              <button
                onClick={handleRemoveSelected}
                disabled={selectedIds.length === 0 || bulkRemoving}
                style={{
                  background: selectedIds.length === 0 ? '#F1F5F9' : '#FEF2F2',
                  border: `1px solid ${selectedIds.length === 0 ? '#E2E8F0' : '#FECACA'}`,
                  color: selectedIds.length === 0 ? '#94A3B8' : '#DC2626',
                  borderRadius: 6, padding: '5px 12px', fontSize: 11.5, fontWeight: 700,
                  cursor: selectedIds.length === 0 || bulkRemoving ? 'not-allowed' : 'pointer',
                }}
              >
                {bulkRemoving ? 'Removing…' : 'Remove Selected'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {groups.map(([groupId, groupTemplates]) => (
              <React.Fragment key={groupId}>
                {/* Whose schedules these are — only worth saying when there is more than one. */}
                {!single && (
                  <div style={{
                    fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase',
                    letterSpacing: '0.4px', marginTop: 4,
                  }}>
                    {counsellorLabel(groupId)}
                    <span style={{ fontWeight: 500, textTransform: 'none', color: '#94A3B8' }}>
                      {' '}· {groupTemplates.length} schedule{groupTemplates.length === 1 ? '' : 's'}
                    </span>
                  </div>
                )}
                {groupTemplates.map((t) => {
              const isEditing = editing?.id === t.id
              const isSelected = selectedIds.includes(t.id)
              const liveSlots = liveSlotCounts.get(t.id) || 0
              const isDead = canCountSlots && liveSlots === 0
              return (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  padding: '8px 12px', background: isSelected ? '#EEF4FF' : '#F8FAFC', borderRadius: 8,
                  border: `1px solid ${isEditing ? '#263B6A' : isSelected ? '#C7D7FE' : '#F1F5F9'}`,
                }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 10, margin: 0,
                    cursor: 'pointer', minWidth: 0, flex: 1,
                  }}>
                    <input
                      type='checkbox'
                      checked={isSelected}
                      onChange={() => toggleSelected(t.id)}
                      style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#263B6A', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: isDead ? '#64748B' : '#1E293B' }}>
                      {t.dayOfWeek} &middot; {hhmm(t.startTime)} – {hhmm(t.endTime)}
                      <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>
                        {' '}({t.defaultSlotDuration || 30}-min slots
                        {t.breakMinutes ? `, ${t.breakMinutes}-min break between` : ''}
                        {t.endDate ? `, until ${shortDate(t.endDate)}` : ''})
                      </span>
                      {canCountSlots && (
                        <span style={{
                          marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 7px',
                          borderRadius: 999, verticalAlign: 'middle',
                          background: isDead ? '#FEF3C7' : '#DCFCE7',
                          color: isDead ? '#92400E' : '#166534',
                        }}>
                          {isDead ? 'No slots left' : `${liveSlots} upcoming`}
                        </span>
                      )}
                    </span>
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {/* Editing rebuilds the schedule through the form below, which writes to
                        every selected counsellor — so it needs exactly one selected. */}
                    {single && (
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
                    )}
                    <button
                      onClick={() => handleRemove(t)}
                      disabled={removingId === t.id || bulkRemoving}
                      style={{
                        background: 'none', border: '1px solid #FECACA', color: '#DC2626',
                        borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                        cursor: removingId === t.id || bulkRemoving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {removingId === t.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
              )
                })}
              </React.Fragment>
            ))}
          </div>
        </>
      )}

      {!single && (
        <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 14px' }}>
          {counsellorIds.length} counsellors selected — the schedule below is added to all of them.
          Existing schedules are listed above and can be removed in bulk; select a single
          counsellor to edit one or to see their slots.
        </p>
      )}

      <div ref={formRef}>
      {editing && (
        <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 10px' }}>
          Editing the {editing.dayOfWeek} {hhmm(editing.startTime)}–{hhmm(editing.endTime)} schedule
          — change the values below and save.
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
          slotGapMinutes: editing.breakMinutes || 0,
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
    </div>
  )
}

export default CounsellorWeeklySchedulePanel
