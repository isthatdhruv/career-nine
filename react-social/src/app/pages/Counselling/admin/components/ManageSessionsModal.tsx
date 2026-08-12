import clsx from 'clsx'
import React, { useCallback, useEffect, useState } from 'react'
import { Modal } from 'react-bootstrap-v5'
import {
  getCounsellorSessions,
  emailSessionToStudent,
  emailSessionToCounsellor,
  CounsellorSessionSummary,
} from '../../API/AppointmentAPI'
import StatusBadge from '../../shared/StatusBadge'

interface Props {
  show: boolean
  counsellorId: number
  counsellorName: string
  onHide: () => void
}

/** Which button is mid-flight, so only that one shows a spinner. */
type Pending = { appointmentId: number; audience: 'student' | 'counsellor' } | null

/** The outcome of the last send, shown against the row it belongs to. */
type RowNotice = { tone: 'success' | 'error'; text: string }

/**
 * Every counselling session booked with one counsellor, with the two resend actions.
 *
 * <p>The details of a session are emailed once, at booking. That is enough until it isn't: a
 * student deletes the mail and asks where the session is, or a counsellor comes to a session
 * without having read the report. Neither had a remedy — the admin could see the appointment
 * but could not send anything about it. Each row here sends the same description the automatic
 * email carries, report link included, to whichever side asked for it.
 *
 * <p>Whether a report exists is shown per row rather than discovered on failure, because the
 * two are not the same message: an assessment the student has not finished has no report to
 * send, and the admin should know that before pressing rather than after.
 *
 * <p>Shell, header and form classes follow {@code AppointCounsellorModal} so the two dialogs on
 * this page read as one product.
 */
const ManageSessionsModal: React.FC<Props> = ({ show, counsellorId, counsellorName, onHide }) => {
  const [sessions, setSessions] = useState<CounsellorSessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [notices, setNotices] = useState<Record<number, RowNotice>>({})
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getCounsellorSessions(counsellorId)
      .then((res) => setSessions(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError('The sessions for this counsellor could not be loaded. Please try again.'))
      .finally(() => setLoading(false))
  }, [counsellorId])

  useEffect(() => {
    if (!show) return
    setNotices({})
    setSearch('')
    load()
  }, [show, load])

  const send = async (row: CounsellorSessionSummary, audience: 'student' | 'counsellor') => {
    setPending({ appointmentId: row.appointmentId, audience })
    setNotices((prev) => {
      const next = { ...prev }
      delete next[row.appointmentId]
      return next
    })
    try {
      const res = audience === 'student'
        ? await emailSessionToStudent(row.appointmentId)
        : await emailSessionToCounsellor(row.appointmentId)
      const recipients = res.data?.recipients || []
      const reportIncluded = Boolean(res.data?.reportIncluded)
      setNotices((prev) => ({
        ...prev,
        [row.appointmentId]: {
          tone: 'success',
          // "Queued", not "delivered": counselling mail is handed to the dispatcher's
          // background sender, so acceptance is what this call can honestly confirm.
          text: `Email queued for delivery to ${recipients.join(', ') || 'the recipient'}. `
            + (reportIncluded
              ? 'The assessment report link is included.'
              : 'No report is available yet, so the email was sent without a report link.'),
        },
      }))
    } catch (e: any) {
      setNotices((prev) => ({
        ...prev,
        [row.appointmentId]: {
          tone: 'error',
          text: e?.response?.data?.error || 'The email could not be sent. Please try again.',
        },
      }))
    } finally {
      setPending(null)
    }
  }

  const formatDate = (d?: string) => {
    if (!d) return '—'
    try {
      return new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      })
    } catch {
      return d
    }
  }

  /** "10:30 AM" from the server's "10:30:00". */
  const formatTime = (t?: string) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    const hour = Number(h)
    if (Number.isNaN(hour)) return t
    const suffix = hour >= 12 ? 'PM' : 'AM'
    const twelve = hour % 12 === 0 ? 12 : hour % 12
    return `${twelve}:${m} ${suffix}`
  }

  const query = search.trim().toLowerCase()
  const visible = query
    ? sessions.filter((s) =>
        [s.studentName, s.assessmentName, s.instituteName, s.studentEmail]
          .some((v) => (v || '').toLowerCase().includes(query)))
    : sessions

  const isPending = (row: CounsellorSessionSummary, audience: 'student' | 'counsellor') =>
    pending?.appointmentId === row.appointmentId && pending?.audience === audience

  return (
    <Modal show={show} onHide={onHide} size='xl' centered backdrop='static'
      aria-labelledby='manage-sessions-title'>
      <Modal.Header>
        <Modal.Title id='manage-sessions-title'>
          <h2 className='mb-0'>Manage Sessions</h2>
          <small className='text-muted'>{counsellorName}</small>
        </Modal.Title>
        <div
          className='btn btn-sm btn-icon btn-active-color-primary'
          onClick={onHide}
          style={{ cursor: 'pointer', fontSize: 22, lineHeight: 1 }}
        >
          &times;
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className='text-muted small mb-3'>
          Every counselling session booked with this counsellor. Use the actions on a session to
          send its details, along with the student's assessment report, to either party.
        </div>

        {error && <div className='alert alert-danger py-3 px-4 fs-7'>{error}</div>}

        {!loading && sessions.length > 0 && (
          <input
            type='text'
            className='form-control form-control-lg form-control-solid mb-3'
            placeholder='Search by student, assessment or school…'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}

        {loading ? (
          <div className='text-center text-muted py-10 fs-6'>Loading sessions…</div>
        ) : sessions.length === 0 ? (
          <div className='text-center text-muted py-10 fs-6'>
            No sessions have been booked with this counsellor yet.
          </div>
        ) : visible.length === 0 ? (
          <div className='text-center text-muted py-10 fs-6'>
            No sessions match your search.
          </div>
        ) : (
          <div className='border rounded' style={{ maxHeight: 460, overflowY: 'auto' }}>
            <table className='table table-row-bordered align-middle mb-0 fs-7'>
              <thead>
                <tr className='fw-bold text-muted' style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                  <th className='px-4 py-3'>Student</th>
                  <th className='px-4 py-3'>Assessment</th>
                  <th className='px-4 py-3'>Session</th>
                  <th className='px-4 py-3'>Status</th>
                  <th className='px-4 py-3'>Report</th>
                  <th className='px-4 py-3 text-end'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const notice = notices[row.appointmentId]
                  return (
                    <React.Fragment key={row.appointmentId}>
                      <tr>
                        <td className='px-4 py-3'>
                          <div className='fw-semibold text-dark'>{row.studentName || 'Unnamed student'}</div>
                          {row.studentEmail && (
                            <div className='text-muted fs-8'>{row.studentEmail}</div>
                          )}
                          {row.instituteName && (
                            <div className='text-muted fs-8'>{row.instituteName}</div>
                          )}
                        </td>
                        <td className='px-4 py-3'>
                          {row.assessmentName || <span className='text-muted fst-italic'>Not recorded</span>}
                        </td>
                        <td className='px-4 py-3'>
                          <div className='text-dark'>{formatDate(row.date)}</div>
                          <div className='text-muted fs-8'>
                            {formatTime(row.startTime)}
                            {row.endTime ? ` – ${formatTime(row.endTime)}` : ''}
                            {row.mode ? ` · ${row.mode === 'OFFLINE' ? 'In-person' : 'Online'}` : ''}
                          </div>
                        </td>
                        <td className='px-4 py-3'>
                          <StatusBadge status={row.status || 'PENDING'} />
                        </td>
                        <td className='px-4 py-3'>
                          {row.reportLink ? (
                            <a href={row.reportLink} target='_blank' rel='noreferrer'
                              className='badge badge-light-success'>
                              Report ready
                            </a>
                          ) : (
                            <span className='badge badge-light text-muted'>Not available</span>
                          )}
                        </td>
                        <td className='px-4 py-3 text-end'>
                          <div className='d-flex justify-content-end gap-2 flex-wrap'>
                            <button
                              type='button'
                              className='btn btn-sm btn-light-primary'
                              onClick={() => send(row, 'student')}
                              disabled={pending !== null}
                              title='Email the session details and report link to the student and parent'
                            >
                              {isPending(row, 'student') ? 'Sending…' : 'Email Student'}
                            </button>
                            <button
                              type='button'
                              className='btn btn-sm btn-light-primary'
                              onClick={() => send(row, 'counsellor')}
                              disabled={pending !== null}
                              title='Email the session details and report link to the counsellor'
                            >
                              {isPending(row, 'counsellor') ? 'Sending…' : 'Email Counsellor'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {notice && (
                        <tr>
                          <td colSpan={6} className='px-4 pb-3 pt-0 border-top-0'>
                            <div className={clsx(
                              'fs-8 px-3 py-2 rounded',
                              notice.tone === 'success' ? 'text-success bg-light-success' : 'text-danger bg-light-danger',
                            )}>
                              {notice.text}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <button type='button' className='btn btn-light' onClick={onHide} disabled={pending !== null}>
          Close
        </button>
      </Modal.Footer>
    </Modal>
  )
}

export default ManageSessionsModal
