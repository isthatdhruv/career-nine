import React, { useState } from 'react'
import { createTemplate } from '../API/AvailabilityTemplateAPI'
import { updateCounsellor } from '../API/CounsellorAPI'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** "09:00:00" → "09:00", so times compare as plain strings. */
const hm = (t: string) => String(t || '').slice(0, 5)

/** Sessions run on Microsoft Teams only — no other provider's link is accepted. */
export const isTeamsLink = (link?: string) =>
  /^https:\/\/teams\.(microsoft|live)\.com\//i.test((link || '').trim())

interface WeeklyScheduleFormProps {
  /** One id from the counsellor portal; the ticked rows when an admin runs it. */
  counsellorIds: number[]
  /** Counsellor.officeAddress — controlled by the parent because the extra-slot form shares it. */
  officeAddress: string
  onOfficeAddressChange: (value: string) => void
  /** Counsellor.meetingLink — the permanent Teams link every online session uses. */
  meetingLink?: string
  onMeetingLinkChange?: (value: string) => void
  onSaved: (message: string) => void
  onError: (message: string) => void
  /** Primary colour: navy in the counsellor portal, green in the admin portal. */
  accent?: string
  accentGradient?: string
  /** Pre-fill when editing an existing schedule. Remount (via `key`) to change it. */
  initial?: Partial<FormState>
  submitLabel?: string
  /** Shown next to submit when editing; omit for the plain add form. */
  onCancel?: () => void
  /**
   * Runs after validation, before the templates are created — used by the edit
   * flow to drop the old template (and its unbooked slots) first, so the
   * replacement's slots don't get skipped as overlapping.
   */
  beforeCreate?: () => Promise<void>
  /**
   * Schedules this counsellor already has. Used to warn before adding one that
   * covers the same day and time, because the backend silently skips every slot
   * that clashes with an existing one — the schedule saves but yields no slots.
   */
  existingTemplates?: ExistingTemplate[]
  /** The template being replaced by an edit — it is deleted first, so it can't clash. */
  ignoreTemplateId?: number
}

export interface ExistingTemplate {
  id: number
  dayOfWeek: string
  startTime: string
  endTime: string
  defaultSlotDuration?: number
}

interface FormState {
  days: string[]
  startTime: string
  endTime: string
  slotDurationMinutes: number
  mode: 'ONLINE' | 'OFFLINE'
  startDate: string
  endDate: string
  hasBreak: boolean
  breakStart: string
  breakEnd: string
}

const EMPTY_FORM: FormState = {
  days: ['Monday'],
  startTime: '09:00',
  endTime: '17:00',
  slotDurationMinutes: 30,
  mode: 'ONLINE',
  startDate: '',
  endDate: '',
  hasBreak: false,
  breakStart: '13:00',
  breakEnd: '14:00',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid #DDE3EC',
  borderRadius: 7,
  fontSize: 12,
  outline: 'none',
  fontFamily: 'inherit',
  color: '#1A1F2E',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#6B7A8D',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  display: 'block',
  marginBottom: 4,
}

/**
 * Recurring weekly availability: one AvailabilityTemplate per selected weekday
 * (the schema is one day per template), each carrying the mode + effective start
 * date. The backend materializes the next ~30 days of bookable slots immediately
 * and skips any that overlap a time the counsellor already has.
 *
 * Shared so the admin creates availability exactly the way the counsellor does —
 * same endpoint, same records, so admin-made schedules show up in the
 * counsellor's own portal.
 */
const WeeklyScheduleForm: React.FC<WeeklyScheduleFormProps> = ({
  counsellorIds,
  officeAddress,
  onOfficeAddressChange,
  meetingLink = '',
  onMeetingLinkChange,
  onSaved,
  onError,
  accent = '#263B6A',
  accentGradient = 'linear-gradient(135deg, #1C2D52, #263B6A)',
  initial,
  submitLabel,
  onCancel,
  beforeCreate,
  existingTemplates,
  ignoreTemplateId,
}) => {
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, ...initial })
  const [saving, setSaving] = useState(false)

  // In-person sessions are delivered at *one* counsellor's office address, so the
  // mode is only offerable when a single counsellor is being scheduled.
  const multiple = counsellorIds.length > 1
  const mode: 'ONLINE' | 'OFFLINE' = multiple ? 'ONLINE' : form.mode

  const handleSave = async () => {
    if (!counsellorIds.length) {
      onError('Select at least one counsellor.')
      return
    }
    if (!form.days.length) {
      onError('Please select at least one day.')
      return
    }
    if (!form.startTime || !form.endTime) {
      onError('Please fill in start time and end time.')
      return
    }
    if (form.startTime >= form.endTime) {
      onError('End time must be after start time.')
      return
    }
    if (form.endDate) {
      const from = form.startDate || new Date().toISOString().slice(0, 10)
      if (form.endDate < from) {
        onError('End date must be on or after the start date.')
        return
      }
    }
    if (mode === 'OFFLINE' && !officeAddress.trim()) {
      onError('Please enter the office address for in-person sessions.')
      return
    }
    // Online sessions run on Microsoft Teams, so a slot is only bookable if the
    // counsellor has their permanent Teams link on file.
    if (mode === 'ONLINE' && !multiple) {
      if (!meetingLink.trim()) {
        onError('Add the counsellor\'s Microsoft Teams meeting link before creating online slots.')
        return
      }
      if (!isTeamsLink(meetingLink)) {
        onError('The meeting link must be a Microsoft Teams link (teams.microsoft.com or teams.live.com).')
        return
      }
    }
    if (form.hasBreak) {
      if (!form.breakStart || !form.breakEnd || form.breakStart >= form.breakEnd) {
        onError('Break end must be after break start.')
        return
      }
      if (form.breakStart <= form.startTime || form.breakEnd >= form.endTime) {
        onError('The break must fall inside the working hours.')
        return
      }
    }

    // A slot is never created on top of one that already exists (a counsellor can't
    // run two sessions at once), so a schedule covering an already-covered time
    // saves but produces nothing. Say so before it happens.
    const clashes = (existingTemplates || []).filter((t) =>
      t.id !== ignoreTemplateId &&
      form.days.includes(t.dayOfWeek) &&
      hm(t.startTime) < form.endTime && form.startTime < hm(t.endTime),
    )
    if (clashes.length > 0) {
      const list = clashes
        .map((t) => `• ${t.dayOfWeek} ${hm(t.startTime)}–${hm(t.endTime)} (${t.defaultSlotDuration || 30}-min slots)`)
        .join('\n')
      const ok = window.confirm(
        `This time is already covered by an existing schedule:\n\n${list}\n\n` +
        'Slots are only created for times that are still free — where they clash, nothing new is added. ' +
        'To change the timing or slot length, use Edit on the existing schedule instead.\n\nAdd it anyway?',
      )
      if (!ok) return
    }

    setSaving(true)
    try {
      // OFFLINE sessions are delivered at the counsellor's office address; ONLINE ones at
      // their permanent Teams link. Persist whichever applies — booking copies it onto the
      // appointment and into the confirmation email.
      if (mode === 'OFFLINE') {
        await updateCounsellor(counsellorIds[0], { officeAddress: officeAddress.trim() })
      } else if (!multiple) {
        await updateCounsellor(counsellorIds[0], { meetingLink: meetingLink.trim() })
      }

      if (beforeCreate) {
        await beforeCreate()
      }

      // A break is expressed as two schedules for that day — morning and afternoon —
      // because a template covers one continuous stretch. That is how a split day is
      // already stored (e.g. 09:00–13:00 + 14:00–17:00).
      const blocks = form.hasBreak
        ? [{ from: form.startTime, to: form.breakStart }, { from: form.breakEnd, to: form.endTime }]
        : [{ from: form.startTime, to: form.endTime }]

      const requests: Promise<any>[] = []
      for (const counsellorId of counsellorIds) {
        for (const day of form.days) {
          for (const block of blocks) {
            requests.push(
              createTemplate({
                counsellor: { id: counsellorId },
                dayOfWeek: day,
                startTime: block.from,
                endTime: block.to,
                defaultSlotDuration: form.slotDurationMinutes,
                mode,
                startDate: form.startDate || null,
                endDate: form.endDate || null,
              }),
            )
          }
        }
      }
      const results = await Promise.all(requests)

      const created = results.reduce((sum, r) => sum + (Number(r?.data?.slotsCreated) || 0), 0)
      // Slots that overlapped an existing time (any mode) are skipped, not created.
      const skipped = results.reduce((sum, r) => sum + (Number(r?.data?.slotsSkipped) || 0), 0)
      // Stretches whose slots all clashed: the backend keeps no schedule for those, so
      // the list never shows a schedule that produced nothing.
      const discarded = results.filter((r) => r?.data?.discarded).length
      const who = multiple ? ` for ${counsellorIds.length} counsellors` : ''

      if (created === 0) {
        onError(
          `Nothing was added — all ${skipped} slot${skipped === 1 ? '' : 's'} clashed with times that are already covered. ` +
          'Edit or remove the existing schedule to change its timings or slot length.',
        )
      } else {
        onSaved(
          `Schedule saved${who} — ${created} slot${created === 1 ? '' : 's'} generated.` +
            (discarded > 0
              ? ` ${discarded} of them added nothing (already covered) and ${discarded === 1 ? 'was' : 'were'} not kept.`
              : skipped > 0
              ? ` ${skipped} slot${skipped === 1 ? '' : 's'} skipped because they overlapped existing slots.`
              : ''),
        )
      }
      setForm(EMPTY_FORM)
    } catch {
      onError('Failed to save schedule.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Mode: Online / In-person */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Session mode</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['ONLINE', 'OFFLINE'] as const).map((m) => {
            const active = mode === m
            const disabled = multiple && m === 'OFFLINE'
            return (
              <button
                key={m}
                type='button'
                disabled={disabled}
                title={disabled ? 'In-person needs one counsellor at a time (each has their own office address)' : undefined}
                onClick={() => setForm((f) => ({ ...f, mode: m }))}
                style={{
                  flex: 1, padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  border: active ? `1.5px solid ${accent}` : '1.5px solid #DDE3EC',
                  background: active ? `${accent}14` : '#fff',
                  color: active ? accent : '#475569',
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                {m === 'ONLINE' ? '💻 Online' : '📍 In-person'}
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: 11, color: '#6B7A8D', marginTop: 4 }}>
          {multiple
            ? 'Several counsellors selected — in-person is unavailable because each has their own office address. Anyone without a Teams link on file will produce online slots with no meeting link.'
            : mode === 'ONLINE'
            ? 'The student is emailed the counsellor\'s Microsoft Teams link (below).'
            : 'The student is sent the office address (below).'}
        </div>
      </div>

      {/* Teams link — every online session uses the counsellor's permanent room */}
      {mode === 'ONLINE' && !multiple && onMeetingLinkChange && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Microsoft Teams meeting link</label>
          <input
            type='text'
            value={meetingLink}
            onChange={(e) => onMeetingLinkChange(e.target.value)}
            placeholder='https://teams.microsoft.com/l/meetup-join/...'
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: '#6B7A8D', marginTop: 4 }}>
            In Teams: Calendar → New meeting → repeat with no end date → Save → copy the
            "Join the meeting now" link.
          </div>
        </div>
      )}

      {/* Days of week (multi-select) */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Days</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {DAYS.map((d) => {
            const on = form.days.includes(d)
            return (
              <button
                key={d}
                type='button'
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    days: on ? f.days.filter((x) => x !== d) : [...f.days, d],
                  }))
                }
                style={{
                  padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                  border: on ? `1.5px solid ${accent}` : '1.5px solid #DDE3EC',
                  background: on ? `${accent}14` : '#fff',
                  color: on ? accent : '#475569',
                }}
              >
                {d.slice(0, 3)}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
        <div>
          <label style={labelStyle}>Start date</label>
          <input
            type='date'
            value={form.startDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>End date</label>
          <input
            type='date'
            value={form.endDate}
            min={form.startDate || new Date().toISOString().slice(0, 10)}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            style={inputStyle}
            title='Leave blank to keep the schedule running'
          />
        </div>
        <div>
          <label style={labelStyle}>Start</label>
          <input
            type='time'
            value={form.startTime}
            onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>End</label>
          <input
            type='time'
            value={form.endTime}
            onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Slot Length</label>
          <select
            value={form.slotDurationMinutes}
            onChange={(e) => setForm((f) => ({ ...f, slotDurationMinutes: Number(e.target.value) }))}
            style={inputStyle}
          >
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
        </div>
      </div>

      {/* Break — saved as two schedules for the day (before and after). */}
      <div style={{ marginTop: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
          <input
            type='checkbox'
            checked={form.hasBreak}
            onChange={(e) => setForm((f) => ({ ...f, hasBreak: e.target.checked }))}
            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: accent }}
          />
          Add a break (no slots during this time)
        </label>
        {form.hasBreak && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8, maxWidth: 320 }}>
            <div>
              <label style={labelStyle}>Break from</label>
              <input
                type='time'
                value={form.breakStart}
                onChange={(e) => setForm((f) => ({ ...f, breakStart: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Break to</label>
              <input
                type='time'
                value={form.breakEnd}
                onChange={(e) => setForm((f) => ({ ...f, breakEnd: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>
        )}
      </div>

      {/* Office address — only for in-person sessions */}
      {mode === 'OFFLINE' && (
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Office address (shared with students)</label>
          <textarea
            value={officeAddress}
            onChange={(e) => onOfficeAddressChange(e.target.value)}
            placeholder='Building, street, area, city — where the student should come'
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' as const }}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '9px 18px', fontSize: 13, fontWeight: 600,
            border: 'none', borderRadius: 8, color: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer',
            background: saving ? '#9CA3AF' : accentGradient,
          }}
        >
          {saving ? 'Saving…' : submitLabel || 'Add Weekly Schedule'}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={saving}
            style={{
              padding: '9px 18px', fontSize: 13, fontWeight: 600,
              border: '1.5px solid #DDE3EC', borderRadius: 8, background: '#fff',
              color: '#6B7A8D', cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

export default WeeklyScheduleForm
