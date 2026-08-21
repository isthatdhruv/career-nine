import React, { useEffect, useMemo, useState } from 'react'
import { Dropdown } from 'react-bootstrap'
import { AiOutlineUserAdd, AiOutlineCheckCircle, AiOutlineCloseCircle } from 'react-icons/ai'
import { MdOutlineEventRepeat, MdOutlineMailOutline, MdOutlineMarkEmailRead } from 'react-icons/md'
import '../Counselling.css'
import PageHeader from '../../../components/PageHeader'
import { useAuth } from '../../../modules/auth'
import { useRefreshInterval } from '../../../utils/useAutoRefresh'
import {
  getAllAppointments, adminCancelAppointment, rescheduleAppointment, sendSelfRescheduleLink,
  assignCounsellor, confirmAppointment, emailSessionToStudent, emailSessionToCounsellor,
} from '../API/AppointmentAPI'
import { getActiveCounsellors } from '../API/CounsellorAPI'
import { getAvailableSlots } from '../API/SlotAPI'
import {
  usePeriodFilter, PeriodFilterControl, fmtDateShort, localDateStr,
} from '../shared/PeriodFilter'

/**
 * Admin — Manage Sessions.
 *
 * Every counselling session in the chosen period, one row per student, with the
 * actions an admin needs on the right of each row. All of them go through the
 * same endpoints the student and counsellor portals read from, so a cancellation
 * or a new time shows up on both sides with nothing extra here: the appointment
 * row *is* the shared state.
 *
 * Every action also leaves both parties emailed — see `notifyBoth` below for why
 * that takes an extra call for some of them.
 */

// ── Appointment field readers (shape of GET /counselling-appointment/getAll) ──
const slotDate = (a: any): string => (a?.slot?.date || a?.date || '').slice(0, 10)
const slotStartTime = (a: any): string => (a?.slot?.startTime || a?.startTime || '').slice(0, 5)
const slotEndTime = (a: any): string => (a?.slot?.endTime || a?.endTime || '').slice(0, 5)
const status = (a: any): string => String(a?.status || '').toUpperCase()

function fmtTime(hhmm: string): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function studentName(a: any): string {
  return (
    a?.student?.studentInfo?.name || a?.studentContactName || a?.student?.name ||
    (a?.student?.userStudentId ? `Student #${a.student.userStudentId}` : 'Student')
  )
}
const counsellorName = (a: any): string => a?.counsellor?.name || 'Unassigned'

/** Status → badge tint. Uses the shared `cl-badge` shape from Counselling.css. */
const STATUS_STYLE: Record<string, React.CSSProperties> = {
  PENDING: { background: '#FEF3C7', color: '#92400E' },
  ASSIGNED: { background: '#DBEAFE', color: '#1E40AF' },
  CONFIRMED: { background: '#E0F2EE', color: '#084A3E' },
  IN_PROGRESS: { background: '#DCFCE7', color: '#15803D' },
  COMPLETED: { background: '#D1FAE5', color: '#065F46' },
  MISSED: { background: '#FEE2E2', color: '#991B1B' },
  CANCELLED: { background: '#E5E7EB', color: '#4B5563' },
  AWAITING_RESCHEDULE: { background: '#FFE4E6', color: '#9F1239' },
  UNDER_REVIEW: { background: '#EDE9FE', color: '#5B21B6' },
}
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Awaiting assignment',
  ASSIGNED: 'Awaiting confirmation',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  MISSED: 'No-show',
  CANCELLED: 'Cancelled',
  AWAITING_RESCHEDULE: 'Awaiting new time',
  UNDER_REVIEW: 'Under review',
}

const STATUS_FILTERS: [string, string][] = [
  ['ALL', 'All statuses'],
  ['PENDING', 'Awaiting assignment'],
  ['ASSIGNED', 'Awaiting confirmation'],
  ['CONFIRMED', 'Confirmed'],
  ['IN_PROGRESS', 'In progress'],
  ['COMPLETED', 'Completed'],
  ['MISSED', 'No-shows'],
  ['CANCELLED', 'Cancelled'],
]

const OPEN_STATUSES = ['PENDING', 'ASSIGNED', 'CONFIRMED', 'AWAITING_RESCHEDULE']

type ActionKey = 'assign' | 'confirm' | 'reschedule' | 'cancel' | 'mailStudent' | 'mailCounsellor'

const th: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 12,
  color: 'var(--sp-muted, #5C7A72)', textTransform: 'uppercase',
  letterSpacing: '0.04em', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = { padding: '12px 14px' }
const subText: React.CSSProperties = { fontSize: 11, color: 'var(--sp-muted, #5C7A72)', marginTop: 2 }

const CounsellingSessionsPage: React.FC = () => {
  const { currentUser } = useAuth()
  const adminUserId: number = (currentUser as any)?.id ?? 0

  const [appts, setAppts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [dialog, setDialog] = useState<{ action: ActionKey; appt: any } | null>(null)

  const load = (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    return getAllAppointments()
      .then((res) => { setAppts(Array.isArray(res.data) ? res.data : []); setError(null) })
      .catch(() => { if (!opts?.silent) setError('Failed to load sessions. Please refresh.') })
      .finally(() => { if (!opts?.silent) setLoading(false) })
  }

  useEffect(() => { load() }, [])
  useRefreshInterval(() => load({ silent: true }), {})

  const allDates = useMemo(() => appts.map(slotDate).filter(Boolean), [appts])
  const filter = usePeriodFilter(allDates)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return appts
      // A RESCHEDULED row is the husk a move left behind — its replacement is the
      // live session, so listing it would show the student twice.
      .filter((a) => status(a) !== 'RESCHEDULED')
      .filter((a) => filter.inWin(slotDate(a)))
      .filter((a) => statusFilter === 'ALL' || status(a) === statusFilter)
      .filter((a) => !q ||
        studentName(a).toLowerCase().includes(q) ||
        counsellorName(a).toLowerCase().includes(q) ||
        String(a.studentContactEmail || '').toLowerCase().includes(q))
      .sort((a, b) => (slotDate(b) + slotStartTime(b)).localeCompare(slotDate(a) + slotStartTime(a)))
  }, [appts, filter, statusFilter, search])

  const counts = useMemo(() => ({
    total: rows.length,
    open: rows.filter((a) => OPEN_STATUSES.includes(status(a))).length,
    done: rows.filter((a) => status(a) === 'COMPLETED').length,
  }), [rows])

  const afterAction = async (message: string) => {
    setNotice(message)
    setDialog(null)
    await load({ silent: true })
    window.setTimeout(() => setNotice(null), 8000)
  }

  return (
    <div className='ph-page'>
      <ToolbarStyles />
      <PageHeader
        icon={<i className='bi bi-list-check' />}
        title='Manage Sessions'
        subtitle={
          <span>
            {filter.winLabel} · <strong>{counts.total}</strong> session{counts.total === 1 ? '' : 's'} ·{' '}
            <strong>{counts.open}</strong> open · <strong>{counts.done}</strong> completed
          </span>
        }
      >
        <div className='csx-toolbar'>
          <PeriodFilterControl filter={filter} />
          <div className='csx-toolbar-right'>
            <select
              className='csx-field' value={statusFilter} aria-label='Status'
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_FILTERS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <input
              className='csx-field csx-search' placeholder='Search student, counsellor or email'
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </PageHeader>

      {error && (
        <div style={{
          marginTop: 16, padding: '10px 14px', background: '#FEE2E2',
          border: '1px solid #FECACA', borderRadius: 8, color: '#991B1B', fontSize: 13,
        }}>{error}</div>
      )}
      {notice && (
        <div style={{
          marginTop: 16, padding: '10px 14px', background: '#D1FAE5',
          border: '1px solid #A7F3D0', borderRadius: 8, color: '#065F46', fontSize: 13,
        }}>{notice}</div>
      )}

      <div style={{ height: 16 }} />

      {loading ? (
        <div className='cl-card' style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sp-muted, #5C7A72)' }}>
          Loading sessions...
        </div>
      ) : rows.length === 0 ? (
        <div className='cl-card' style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sp-muted, #5C7A72)' }}>
          No sessions match this period{statusFilter !== 'ALL' ? ' and status' : ''}.
        </div>
      ) : (
        <div className='cl-card' style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--sp-border, #D1E5DF)' }}>
                {['Student', 'When', 'Counsellor', 'Mode', 'Status', 'Actions'].map((col) => (
                  <th key={col} style={col === 'Actions' ? { ...th, textAlign: 'right' } : th}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a, idx) => {
                const st = status(a)
                const canAssign = ['PENDING', 'AWAITING_RESCHEDULE'].includes(st) || !a.counsellor
                const canConfirm = st === 'ASSIGNED'
                const canReschedule = [...OPEN_STATUSES, 'MISSED'].includes(st)
                const canCancel = OPEN_STATUSES.includes(st)
                return (
                  <tr
                    key={a.id}
                    style={{
                      borderBottom: '1px solid var(--sp-border, #D1E5DF)',
                      background: idx % 2 === 0 ? '#fff' : 'var(--sp-bg, #F2F7F5)',
                    }}
                  >
                    {/* Student */}
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: 'var(--sp-text, #1A2B28)' }}>{studentName(a)}</div>
                      <div style={subText}>
                        {[a.studentContactEmail, a.studentContactPhone].filter(Boolean).join(' · ') ||
                          (a.student?.userStudentId ? `ID: ${a.student.userStudentId}` : '')}
                      </div>
                    </td>

                    {/* When */}
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: 'var(--sp-text, #1A2B28)' }}>
                        {slotDate(a) ? fmtDateShort(slotDate(a)) : '—'}
                      </div>
                      <div style={subText}>
                        {slotStartTime(a) ? `${fmtTime(slotStartTime(a))} – ${fmtTime(slotEndTime(a))}` : '—'}
                      </div>
                    </td>

                    <td style={{ ...td, color: 'var(--sp-muted, #5C7A72)' }}>{counsellorName(a)}</td>
                    <td style={{ ...td, color: 'var(--sp-muted, #5C7A72)', whiteSpace: 'nowrap' }}>
                      {a.mode === 'OFFLINE' ? 'In-person' : 'Online'}
                    </td>

                    <td style={td}>
                      <span className='cl-badge' style={STATUS_STYLE[st] || STATUS_STYLE.CANCELLED}>
                        {STATUS_LABEL[st] || st || '—'}
                      </span>
                    </td>

                    {/* Actions — the green Actions ▾ dropdown used on the institute
                        table, so every list in the admin behaves the same way. */}
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Dropdown className='d-inline' align='end'>
                        <Dropdown.Toggle
                          variant='success'
                          size='sm'
                          id={`session-actions-${a.id}`}
                          className='dropdown-toggle'
                        >
                          Actions
                        </Dropdown.Toggle>

                        {/* strategy:fixed keeps the menu out of the table's overflow
                            clipping, exactly as the institute table does. */}
                        <Dropdown.Menu
                          style={{ minWidth: 210, zIndex: 1050 }}
                          popperConfig={{ strategy: 'fixed' }}
                          renderOnMount
                        >
                          {canAssign && (
                            <Dropdown.Item onClick={() => setDialog({ action: 'assign', appt: a })}>
                              <AiOutlineUserAdd size={18} className='me-2' />
                              Assign Counsellor
                            </Dropdown.Item>
                          )}
                          {canConfirm && (
                            <Dropdown.Item onClick={() => setDialog({ action: 'confirm', appt: a })}>
                              <AiOutlineCheckCircle size={18} className='me-2' />
                              Confirm Session
                            </Dropdown.Item>
                          )}
                          {canReschedule && (
                            <Dropdown.Item onClick={() => setDialog({ action: 'reschedule', appt: a })}>
                              <MdOutlineEventRepeat size={18} className='me-2' />
                              Reschedule
                            </Dropdown.Item>
                          )}

                          {(canAssign || canConfirm || canReschedule) && <Dropdown.Divider />}

                          <Dropdown.Item onClick={() => setDialog({ action: 'mailStudent', appt: a })}>
                            <MdOutlineMailOutline size={18} className='me-2' />
                            Email Student
                          </Dropdown.Item>
                          {a.counsellor && (
                            <Dropdown.Item onClick={() => setDialog({ action: 'mailCounsellor', appt: a })}>
                              <MdOutlineMarkEmailRead size={18} className='me-2' />
                              Email Counsellor
                            </Dropdown.Item>
                          )}

                          {canCancel && <Dropdown.Divider />}
                          {canCancel && (
                            <Dropdown.Item
                              className='text-danger'
                              onClick={() => setDialog({ action: 'cancel', appt: a })}
                            >
                              <AiOutlineCloseCircle size={18} className='me-2' />
                              Cancel Session
                            </Dropdown.Item>
                          )}
                        </Dropdown.Menu>
                      </Dropdown>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{
            padding: '12px 14px', fontSize: 12, color: 'var(--sp-muted, #5C7A72)',
            borderTop: '1px solid var(--sp-border, #D1E5DF)',
          }}>
            {rows.length} session(s) · {filter.winLabel}
          </div>
        </div>
      )}

      {dialog && (
        <ActionDialog
          action={dialog.action}
          appt={dialog.appt}
          adminUserId={adminUserId}
          onClose={() => setDialog(null)}
          onDone={afterAction}
        />
      )}
    </div>
  )
}

/**
 * Make sure both sides hear about an admin action.
 *
 * The endpoints each notify the party they were built for — assign writes to the
 * counsellor, confirm and reschedule to the student, and only admin-cancel writes
 * to both. An admin acting on someone's session is news to both of them, so the
 * side the endpoint skipped is sent the current session details (the same mail as
 * the Email Student / Email Counsellor buttons, carrying the post-action date,
 * time, venue or link, and the report link).
 *
 * Kept here rather than in the service so the student's and counsellor's own
 * self-service flows keep their existing, narrower notifications.
 *
 * Returns what to tell the admin — a failed courtesy copy must not read as if the
 * action itself failed, because it did go through.
 */
async function notifyBoth(
  appointmentId: number,
  alreadyEmailed: 'student' | 'counsellor',
  hasCounsellor: boolean,
): Promise<string> {
  const missing = alreadyEmailed === 'student' ? 'counsellor' : 'student'
  if (missing === 'counsellor' && !hasCounsellor) {
    return 'The student has been emailed (no counsellor is assigned yet).'
  }
  try {
    if (missing === 'counsellor') await emailSessionToCounsellor(appointmentId)
    else await emailSessionToStudent(appointmentId)
    return 'The student and the counsellor have both been emailed.'
  } catch {
    return `The ${alreadyEmailed} has been emailed, but the ${missing}'s copy could not be sent — use the Email ${missing === 'counsellor' ? 'Counsellor' : 'Student'} button to retry.`
  }
}

// ── Action dialog ───────────────────────────────────────────────────────────

const ActionDialog: React.FC<{
  action: ActionKey
  appt: any
  adminUserId: number
  onClose: () => void
  onDone: (message: string) => void
}> = ({ action, appt, adminUserId, onClose, onDone }) => {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [counsellors, setCounsellors] = useState<any[]>([])
  const [slots, setSlots] = useState<any[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const [loadingOptions, setLoadingOptions] = useState(false)

  const name = studentName(appt)
  const hasCounsellor = !!appt.counsellor

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (action === 'assign') {
      setLoadingOptions(true)
      getActiveCounsellors()
        .then((res) => setCounsellors(Array.isArray(res.data) ? res.data : []))
        .catch(() => setErr('Could not load counsellors.'))
        .finally(() => setLoadingOptions(false))
    }
    if (action === 'reschedule') {
      setLoadingOptions(true)
      // Bookable slots from today onwards.
      //
      // Suspended counsellors are filtered out here: the unfiltered /available
      // query (no studentId or instituteCode) has no isActive condition, unlike
      // the student-facing paths that resolve through
      // getActiveCounsellorIdsForInstitute. Without this an admin could move a
      // student onto a counsellor who cannot sign in — nobody could check her in,
      // and the lifecycle sweep would eventually park the session as a counsellor
      // no-show after she had waited through it.
      getAvailableSlots(localDateStr())
        .then((res) => {
          const all = Array.isArray(res.data) ? res.data : []
          setSlots(all.filter((s: any) => s?.counsellor?.isActive !== false))
        })
        .catch(() => setErr('Could not load open slots.'))
        .finally(() => setLoadingOptions(false))
    }
  }, [action])

  /**
   * Hand the choice back to the student instead of picking a time for them. Lives inside the
   * reschedule dialog because it is the same decision — move this session — taken the other
   * way round, and an admin who cannot see a slot that suits the student needs it right there.
   */
  const emailRescheduleLink = async () => {
    if (!window.confirm(
      `Email ${name} a link to pick a new time?\n\nThe session is held open for them and its current slot reopens for other students. They keep it until they choose a new time.`,
    )) return
    setErr('')
    setBusy(true)
    try {
      const res = await sendSelfRescheduleLink(appt.id, note.trim() || undefined)
      const to = res.data?.recipient || 'the student'
      onDone(`Reschedule link sent to ${to}. ${name}'s session is held until they pick a new time.`)
    } catch (e: any) {
      const body = e?.response?.data
      setErr(typeof body === 'string' ? body : body?.error || 'The link could not be sent. Please try again.')
      setBusy(false)
    }
  }

  const run = async () => {
    setErr('')
    setBusy(true)
    try {
      switch (action) {
        case 'cancel':
          // The only endpoint that already writes to both sides.
          await adminCancelAppointment(appt.id, adminUserId, note.trim() || undefined)
          onDone(`Session for ${name} cancelled. The student and the counsellor have both been emailed.`)
          break
        case 'reschedule': {
          if (!picked) { setErr('Pick a new slot first.'); setBusy(false); return }
          // isAdmin: an admin move must not spend the student's own one reschedule.
          await rescheduleAppointment(appt.id, picked, adminUserId, true)
          const mail = await notifyBoth(appt.id, 'student', true)
          onDone(`Session for ${name} moved. ${mail}`)
          break
        }
        case 'assign': {
          if (!picked) { setErr('Pick a counsellor first.'); setBusy(false); return }
          await assignCounsellor(appt.id, picked, adminUserId)
          const mail = await notifyBoth(appt.id, 'counsellor', true)
          onDone(`Counsellor assigned to ${name}'s session. ${mail}`)
          break
        }
        case 'confirm': {
          await confirmAppointment(appt.id, adminUserId)
          const mail = await notifyBoth(appt.id, 'student', hasCounsellor)
          onDone(`Session for ${name} confirmed. ${mail}`)
          break
        }
        case 'mailStudent': {
          const res = await emailSessionToStudent(appt.id)
          const to = res.data?.recipients?.join(', ') || 'the student'
          onDone(`Session details sent to ${to}${res.data?.reportIncluded ? ' (report link included)' : ''}.`)
          break
        }
        case 'mailCounsellor': {
          const res = await emailSessionToCounsellor(appt.id)
          const to = res.data?.recipients?.join(', ') || 'the counsellor'
          onDone(`Session details sent to ${to}${res.data?.reportIncluded ? ' (report link included)' : ''}.`)
          break
        }
      }
    } catch (e: any) {
      const body = e?.response?.data
      setErr(typeof body === 'string' ? body : body?.error || 'That did not go through. Please try again.')
      setBusy(false)
    }
  }

  const meta = {
    cancel: { title: 'Cancel Session', cta: 'Cancel Session', cls: 'cl-btn-danger' },
    reschedule: { title: 'Reschedule Session', cta: 'Move Session', cls: 'cl-btn-primary' },
    assign: { title: 'Assign Counsellor', cta: 'Assign', cls: 'cl-btn-primary' },
    confirm: { title: 'Confirm Session', cta: 'Confirm', cls: 'cl-btn-primary' },
    mailStudent: { title: 'Email Details to Student', cta: 'Send Email', cls: 'cl-btn-primary' },
    mailCounsellor: { title: 'Email Details to Counsellor', cta: 'Send Email', cls: 'cl-btn-primary' },
  }[action]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, maxHeight: '85vh', overflow: 'hidden',
          background: '#fff', borderRadius: 14, boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--sp-border, #D1E5DF)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--sp-text, #1A2B28)' }}>
              {meta.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', marginTop: 2 }}>
              {name} · {slotDate(appt) ? fmtDateShort(slotDate(appt)) : '—'}
              {slotStartTime(appt) ? ` at ${fmtTime(slotStartTime(appt))}` : ''} · {counsellorName(appt)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: '1px solid var(--sp-border, #D1E5DF)', background: '#fff',
              borderRadius: 8, cursor: 'pointer', padding: '4px 10px',
              fontSize: 18, color: '#6B7280', lineHeight: 1,
            }}
            aria-label='Close'
          >
            &times;
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto' }}>
          {err && (
            <div style={{
              marginBottom: 12, padding: '10px 14px', background: '#FEE2E2',
              border: '1px solid #FECACA', borderRadius: 8, color: '#991B1B', fontSize: 13,
            }}>{err}</div>
          )}

          {action === 'cancel' && (
            <>
              <p style={noteStyle}>
                The slot reopens for other students and the session is credited back. The student
                and the counsellor are both emailed — nobody is penalised for an admin cancellation.
              </p>
              <label style={labelStyle}>Reason (optional — included in the email)</label>
              <textarea
                style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder='e.g. counsellor unavailable, school closed'
              />
            </>
          )}

          {action === 'reschedule' && (
            <>
              <p style={noteStyle}>
                Pick a new time from the open slots. The old slot reopens, the counsellor is carried
                over from the new slot, and the student and the counsellor are both emailed the new
                details. An admin move does not use up the student's own reschedule, and can be
                repeated as often as needed — including for a session that has already started or
                passed.
              </p>

              {/* The other way to move a session: let the student choose. */}
              <div style={{
                marginBottom: 14, padding: '12px 14px', borderRadius: 10,
                background: '#F0F7FF', border: '1px solid #C7DDF7',
              }}>
                <div style={{ fontSize: 12.5, color: '#1E3A5F', lineHeight: 1.6, marginBottom: 10 }}>
                  Don't know what time suits them? Email the student a link to pick a new slot
                  themselves — no login needed. Their session is held until they choose, and this
                  slot reopens for other students. Anything typed below is included as the reason.
                </div>
                <button
                  type='button'
                  className='cl-btn-outline'
                  onClick={emailRescheduleLink}
                  disabled={busy}
                  style={{ width: '100%' }}
                >
                  {busy ? 'Working…' : '✉ Email student a reschedule link'}
                </button>
              </div>

              <label style={labelStyle}>Reason (optional — included in the link email)</label>
              <textarea
                style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }} rows={2} value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder='e.g. you asked to move this session'
              />
              {loadingOptions ? (
                <div style={emptyStyle}>Loading open slots...</div>
              ) : slots.length === 0 ? (
                <div style={emptyStyle}>No open slots available. Create slots first.</div>
              ) : (
                <div style={pickListStyle}>
                  {slots.map((s: any) => {
                    const id = s.slotId ?? s.id
                    return (
                      <button key={id} style={pickStyle(picked === id)} onClick={() => setPicked(id)}>
                        <span style={pickMainStyle}>
                          {fmtDateShort(String(s.date).slice(0, 10))} · {fmtTime(String(s.startTime).slice(0, 5))}
                          {s.endTime ? ` – ${fmtTime(String(s.endTime).slice(0, 5))}` : ''}
                        </span>
                        <span style={pickSubStyle}>
                          {s.counsellorName || s.counsellor?.name || 'Unassigned'}
                          {s.mode === 'OFFLINE' ? ' · In-person' : ' · Online'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {action === 'assign' && (
            <>
              <p style={noteStyle}>
                The counsellor is notified and the session moves to “awaiting confirmation” until
                they accept it. The student is emailed the updated details at the same time.
              </p>
              {loadingOptions ? (
                <div style={emptyStyle}>Loading counsellors...</div>
              ) : (
                <div style={pickListStyle}>
                  {counsellors.map((c: any) => (
                    <button key={c.id} style={pickStyle(picked === c.id)} onClick={() => setPicked(c.id)}>
                      <span style={pickMainStyle}>{c.name}</span>
                      <span style={pickSubStyle}>{c.email || c.counsellorType || ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {action === 'confirm' && (
            <p style={noteStyle}>
              Marks the session confirmed on the counsellor's behalf. The student sees it as
              confirmed in their portal, and both the student and the counsellor are emailed
              the confirmed details.
            </p>
          )}

          {(action === 'mailStudent' || action === 'mailCounsellor') && (
            <p style={noteStyle}>
              Re-sends the full session details — date, time, mode, meeting link or address — with
              the student's report link when one has been generated. Useful as a reminder before
              the session.
            </p>
          )}
        </div>

        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--sp-border, #D1E5DF)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button className='cl-btn-outline' style={{ fontSize: 13 }} onClick={onClose} disabled={busy}>
            Close
          </button>
          <button className={meta.cls} style={{ fontSize: 13 }} onClick={run} disabled={busy}>
            {busy ? 'Working...' : meta.cta}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Dialog-local styles (kept inline, as on the other Counselling admin pages) ──

const noteStyle: React.CSSProperties = {
  fontSize: 12.5, lineHeight: 1.65, color: 'var(--sp-text, #1A2B28)', margin: '0 0 14px',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--sp-muted, #5C7A72)',
  textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', border: '1px solid var(--sp-border, #D1E5DF)',
  borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: 'var(--sp-text, #1A2B28)',
  boxSizing: 'border-box',
}
const emptyStyle: React.CSSProperties = {
  textAlign: 'center', padding: '28px 0', color: 'var(--sp-muted, #5C7A72)', fontSize: 13,
}
const pickListStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto',
}
const pickStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
  padding: '9px 12px', borderRadius: 9, cursor: 'pointer', textAlign: 'left',
  fontFamily: 'inherit',
  border: `1.5px solid ${active ? '#0C6B5A' : 'var(--sp-border, #D1E5DF)'}`,
  background: active ? '#ECFDF5' : '#fff',
})
const pickMainStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--sp-text, #1A2B28)',
}
const pickSubStyle: React.CSSProperties = { fontSize: 11.5, color: 'var(--sp-muted, #5C7A72)' }

/** Only the header controls need styling — they sit on the dark PageHeader. */
const ToolbarStyles: React.FC = () => (
  <style>{`
    .csx-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .csx-toolbar-right { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .csx-field { padding: 7px 12px; border-radius: 8px; font-size: 13px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: #fff; font-family: inherit; }
    .csx-field option { color: #1E293B; }
    .csx-search { min-width: 250px; }
    .csx-search::placeholder { color: rgba(255,255,255,0.6); }
  `}</style>
)

export default CounsellingSessionsPage
