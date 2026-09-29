import React, { useEffect, useRef, useState } from 'react'
import { Modal } from 'react-bootstrap'
import {
  LiveBooking,
  OfflineStudentRow,
  mapStudentsToMe,
  markCounsellingDone,
  offlineApiErrorOf,
} from '../../Counselling/API/OfflineCounsellingAPI'
import { uploadSessionNotesPhotos } from '../../Counselling/API/SessionNotesAPI'
import SessionNotesPhotoUpload, {
  MAX_FILES_PER_UPLOAD,
  MAX_PHOTOS_PER_APPOINTMENT,
  validatePhotoFiles,
} from '../../Counselling/shared/SessionNotesPhotoUpload'
import { showSuccessToast } from '../../../utils/toast'
import { addDays, chunk, formatDay, formatTime, preparePhoto, skipReasonText, todayIst } from './offlineUtils'

const NO_DOB_TEXT = "No date of birth on record — OTP can't be checked."

/**
 * Online bookings the server will not record over (a session under way, or being decided):
 * mark-done answers 409 SESSION_IN_PROGRESS for these instead of cancelling them. The other
 * live statuses (PENDING, ASSIGNED, CONFIRMED, AWAITING_RESCHEDULE) are cancelled on save.
 */
const IN_SESSION_STATUSES = ['IN_PROGRESS', 'UNDER_REVIEW']

/** 409s that mean the row this modal opened from no longer matches the server. */
const STALE_ROW_CODES = ['NOT_MAPPED', 'ALREADY_DONE', 'SESSION_IN_PROGRESS']

interface PendingPhoto {
  key: number
  file: File
  previewUrl: string
}

interface Recorded {
  appointmentId: number
  otpVerified: boolean
  cancelledCount: number
}

interface MarkDoneModalProps {
  row: OfflineStudentRow
  assessmentId: number
  assessmentName: string
  /** Class/Year word for the subtitle. */
  unitLabel: string
  /** `changed` = something was written (a mapping or the record), so the list is stale. */
  onClose: (changed: boolean) => void
}

/** "14:05" out of the server's lock time (an IST LocalDateTime, with or without a zone). */
function lockClock(iso?: string | null): string {
  if (!iso) return ''
  const m = /T(\d{2}:\d{2})/.exec(iso)
  return m ? formatTime(m[1]) : ''
}

/**
 * Records one in-person session as done: session date, the optional OTP, optional photos of
 * the paper counselling sheet.
 *
 * <p>The server only lets a counsellor mark done a student mapped to them. On a phone the
 * common case — an unmapped student — would otherwise be two separate steps, so an unmapped
 * student is mapped first in the same submit; one mapped to someone else is taken over only
 * after an explicit confirm.
 *
 * <p>Retries are safe: a repeat after a dropped connection answers 409 ALREADY_DONE_BY_ME
 * with the record's id, which is treated as success. Photos go up only once the record
 * exists (they hang off its appointment id); if they fail, the record stands and the modal
 * stays open to retry them — a camera capture is often not in the gallery to pick again.
 */
const MarkDoneModal: React.FC<MarkDoneModalProps> = ({ row, assessmentId, assessmentName, unitLabel, onClose }) => {
  const [today] = useState(todayIst)
  const minDate = addDays(today, -30)
  const [sessionDate, setSessionDate] = useState(today)
  const [otp, setOtp] = useState('')
  const [otpDisabled, setOtpDisabled] = useState(!row.hasDob)
  const [otpNote, setOtpNote] = useState<{ kind: 'error' | 'info'; text: string } | null>(
    row.hasDob ? null : { kind: 'info', text: NO_DOB_TEXT }
  )
  const [photos, setPhotos] = useState<PendingPhoto[]>([])
  const [preparing, setPreparing] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [confirmingTakeover, setConfirmingTakeover] = useState(false)
  const [takeoverConfirmed, setTakeoverConfirmed] = useState(false)
  const [mappedHere, setMappedHere] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [recorded, setRecorded] = useState<Recorded | null>(null)
  const [pendingUpload, setPendingUpload] = useState<File[]>([])
  const [uploadError, setUploadError] = useState('')
  const [photoListKey, setPhotoListKey] = useState(0)
  // The server refused on something this row didn't show (taken over, done by someone else,
  // a session started since the list loaded): the list must reload on close — its buttons
  // would otherwise keep offering the same failing action.
  const [stale, setStale] = useState(false)

  const cameraRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLInputElement>(null)
  const keySeq = useRef(0)
  const photosRef = useRef<PendingPhoto[]>([])
  photosRef.current = photos

  // Object URLs for the previews live until the modal goes away.
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), [])

  const takeoverFrom =
    !row.mappedToMe && row.mappedCounsellorId != null
      ? row.mappedCounsellorName || 'another counsellor'
      : null
  const liveBookings = row.liveBookings || []
  const inSession = liveBookings.filter((b) => IN_SESSION_STATUSES.includes(String(b.status || '').toUpperCase()))
  const toCancel = liveBookings.filter((b) => !IN_SESSION_STATUSES.includes(String(b.status || '').toUpperCase()))
  // Checked before anything is sent, so a refused save doesn't first take the student over.
  const blocked = inSession.length > 0
  const busy = submitting || preparing
  const uploadFailed = recorded != null && uploadError !== ''
  const changed = mappedHere || recorded != null || stale

  const close = () => {
    if (submitting) return
    onClose(changed)
  }

  const addFiles = async (list: FileList | null, input: HTMLInputElement | null) => {
    setPhotoError('')
    const picked = list ? Array.from(list) : []
    if (input) input.value = ''
    if (picked.length === 0) return
    // Count first, so a 40-photo pick isn't compressed only to be refused.
    if (photosRef.current.length + picked.length > MAX_PHOTOS_PER_APPOINTMENT) {
      setPhotoError(`A session can have at most ${MAX_PHOTOS_PER_APPOINTMENT} photos.`)
      return
    }
    setPreparing(true)
    try {
      // One at a time: decoding several 12 MP frames at once can run a cheap phone out of memory.
      const prepared: File[] = []
      for (let i = 0; i < picked.length; i++) prepared.push(await preparePhoto(picked[i]))
      // Type and size are checked on what will actually be sent: a 12 MB camera frame is
      // fine once compressed. Non-images pass through preparePhoto untouched and fail here.
      const invalid = validatePhotoFiles(
        photosRef.current.map((p) => p.file).concat(prepared),
        MAX_PHOTOS_PER_APPOINTMENT
      )
      if (invalid) {
        setPhotoError(invalid)
        return
      }
      setPhotos((prev) =>
        prev.concat(
          prepared.map((file) => ({ key: ++keySeq.current, file, previewUrl: URL.createObjectURL(file) }))
        )
      )
    } finally {
      setPreparing(false)
    }
  }

  const removePhoto = (key: number) => {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.key === key)
      if (gone) URL.revokeObjectURL(gone.previewUrl)
      return prev.filter((p) => p.key !== key)
    })
  }

  /** Uploads `files` 10 at a time (the server's per-request cap). False if a chunk failed. */
  const uploadInChunks = async (appointmentId: number, files: File[]): Promise<boolean> => {
    const parts = chunk(files, MAX_FILES_PER_UPLOAD)
    let sent = 0
    for (let i = 0; i < parts.length; i++) {
      setProgress(
        parts.length > 1
          ? `Uploading photos ${sent + 1}–${sent + parts[i].length} of ${files.length}...`
          : 'Uploading photos...'
      )
      try {
        await uploadSessionNotesPhotos(appointmentId, parts[i])
      } catch (e: any) {
        setPendingUpload(files.slice(sent))
        setUploadError(
          e?.response?.data?.message ||
            e?.response?.data?.error ||
            'The photos could not be uploaded. Check your connection and try again.'
        )
        setPhotoListKey((k) => k + 1)
        return false
      }
      sent += parts[i].length
    }
    setPendingUpload([])
    setUploadError('')
    return true
  }

  const finish = (result: Recorded) => {
    const otpText = result.otpVerified ? 'OTP verified' : 'OTP not verified'
    const cancelled =
      result.cancelledCount > 0
        ? ` ${result.cancelledCount} online booking${result.cancelledCount === 1 ? '' : 's'} cancelled.`
        : ''
    showSuccessToast(`Counselling recorded for ${row.name} (${otpText}).${cancelled}`)
    onClose(true)
  }

  /** Inline message for a failed map/mark-done. 403 and 5xx were already toasted globally. */
  const showError = (e: any) => {
    const err = offlineApiErrorOf(e)
    if (!e?.response) {
      setError("Couldn't reach the server. Nothing may have been saved — try again; a repeat is safe.")
      return
    }
    if (err?.code && STALE_ROW_CODES.includes(err.code)) setStale(true)
    switch (err?.code) {
      case 'OTP_WRONG': {
        const left = err.attemptsLeft
        setOtpNote({
          kind: 'error',
          text:
            typeof left === 'number'
              ? `That OTP doesn't match. ${left} attempt${left === 1 ? '' : 's'} left before it locks.`
              : "That OTP doesn't match.",
        })
        return
      }
      case 'OTP_LOCKED': {
        // Clearing the field is the way forward, so do it for them and explain.
        setOtp('')
        setOtpDisabled(true)
        const until = lockClock(err.lockedUntil)
        setOtpNote({
          kind: 'error',
          text: err.permanent
            ? 'Too many wrong OTPs for this student, so OTP checks are off for them. Save without it — the record will show "OTP not verified".'
            : `Too many wrong OTPs. OTP is locked${until ? ` until ${until}` : ' for now'}. You can save without it — the record will show "OTP not verified".`,
        })
        return
      }
      case 'OTP_NO_DOB':
        setOtp('')
        setOtpDisabled(true)
        setOtpNote({ kind: 'info', text: NO_DOB_TEXT })
        return
      case 'ALREADY_DONE':
        setError(
          `Already recorded as done by ${err.doneByCounsellorName || 'another counsellor'}${
            err.doneDate ? ` on ${formatDay(err.doneDate)}` : ''
          }. The list will refresh when you close this.`
        )
        return
      case 'NOT_MAPPED':
        // The row said "mine", so someone has taken the student over since the list loaded.
        setError(
          'This student is no longer mapped to you — another counsellor may have taken them over. Close this to refresh the list, then use "Map to me".'
        )
        return
      case 'SESSION_IN_PROGRESS':
        setError(
          `${err.message || 'This student has an online session in progress or under review.'} It can be recorded once that session is closed. The list will refresh when you close this.`
        )
        return
      case 'BAD_DATE':
        setError(err.message || `Pick a date between ${formatDay(minDate)} and today.`)
        return
      default:
        setError(err?.message || err?.error || 'Could not record the session. Please try again.')
    }
  }

  /** `takeoverOk`: the counsellor just confirmed taking the student over (state lags a click). */
  const handleSubmit = async (takeoverOk: boolean = false) => {
    if (busy || blocked) return
    setError('')
    if (!sessionDate || sessionDate < minDate || sessionDate > today) {
      setError(`Pick a session date between ${formatDay(minDate)} and today.`)
      return
    }
    const code = otpDisabled ? '' : otp.trim()
    if (code && !/^\d{4}$/.test(code)) {
      setOtpNote({ kind: 'error', text: 'The OTP is 4 digits. Clear the field to save without it.' })
      return
    }
    if (takeoverFrom && !takeoverConfirmed && !takeoverOk && !mappedHere) {
      setConfirmingTakeover(true)
      return
    }
    setConfirmingTakeover(false)
    setSubmitting(true)
    try {
      if (!row.mappedToMe && !mappedHere) {
        setProgress('Mapping the student to you...')
        const res = await mapStudentsToMe([row.userStudentId])
        const mine = (res.data?.results || []).find((r) => r.userStudentId === row.userStudentId)
        if (!mine || mine.status === 'SKIPPED') {
          setError(skipReasonText(mine?.reason))
          return
        }
        setMappedHere(true)
      }

      setProgress('Saving the session...')
      let result: Recorded
      try {
        const res = await markCounsellingDone({
          userStudentId: row.userStudentId,
          assessmentId,
          otp: code || null,
          sessionDate,
        })
        result = {
          appointmentId: res.data.appointmentId,
          otpVerified: res.data.otpVerified === true,
          cancelledCount: (res.data.cancelledBookingIds || []).length,
        }
      } catch (e) {
        const err = offlineApiErrorOf(e)
        // Recorded by me already — typically a retry after the first answer was lost.
        if (err && err.status === 409 && err.code === 'ALREADY_DONE_BY_ME' && err.appointmentId) {
          result = { appointmentId: err.appointmentId, otpVerified: err.otpVerified === true, cancelledCount: 0 }
        } else {
          throw e
        }
      }
      setRecorded(result)

      const files = photos.map((p) => p.file)
      if (files.length > 0 && !(await uploadInChunks(result.appointmentId, files))) return
      finish(result)
    } catch (e) {
      showError(e)
    } finally {
      setSubmitting(false)
      setProgress('')
    }
  }

  const handleRetryUpload = async () => {
    if (!recorded || submitting || pendingUpload.length === 0) return
    setSubmitting(true)
    try {
      if (await uploadInChunks(recorded.appointmentId, pendingUpload)) finish(recorded)
    } finally {
      setSubmitting(false)
      setProgress('')
    }
  }

  const subtitle = [
    row.className || row.sectionName ? `${unitLabel} ${[row.className, row.sectionName].filter(Boolean).join(' - ')}` : '',
    row.rollNumber ? `Roll ${row.rollNumber}` : '',
    assessmentName,
  ]
    .filter(Boolean)
    .join(' · ')

  const bookingItems = (list: LiveBooking[]) => (
    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
      {list.map((b) => (
        <li key={b.appointmentId}>
          {formatDay(b.date)}
          {b.startTime ? `, ${formatTime(b.startTime)}` : ''}
          {b.counsellorName ? ` with ${b.counsellorName}` : ''} · {b.status}
        </li>
      ))}
    </ul>
  )

  return (
    <Modal
      show
      onHide={close}
      fullscreen='sm-down'
      centered
      backdrop={submitting ? 'static' : true}
      keyboard={!submitting}
    >
      <Modal.Header closeButton={!submitting}>
        <div>
          <Modal.Title style={{ fontSize: 17 }}>Mark counselling done</Modal.Title>
          <div style={{ fontSize: 13, color: '#1A1F2E', fontWeight: 600, marginTop: 4 }}>{row.name}</div>
          {subtitle && <div style={{ fontSize: 12, color: '#6B7A8D' }}>{subtitle}</div>}
        </div>
      </Modal.Header>

      <Modal.Body>
        {uploadFailed && recorded ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={noticeStyle('#ECFDF5', '#065F46')}>
              Session recorded ({recorded.otpVerified ? 'OTP verified' : 'OTP not verified'}), but some photos didn't
              upload.
            </div>
            <div style={noticeStyle('#FEE2E2', '#991B1B')}>{uploadError}</div>
            <div>
              <button
                type='button'
                className='cp-action-btn cp-action-btn-primary cp-off-touch'
                onClick={handleRetryUpload}
                disabled={submitting}
              >
                {submitting
                  ? progress || 'Uploading...'
                  : `Retry ${pendingUpload.length} photo${pendingUpload.length === 1 ? '' : 's'}`}
              </button>
            </div>
            {/* Shows what did reach the record, and lets the counsellor pick photos again. */}
            <SessionNotesPhotoUpload
              key={photoListKey}
              appointmentId={recorded.appointmentId}
              buttonClassName='cp-action-btn cp-off-touch'
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {takeoverFrom && !mappedHere && !blocked && (
              <div style={noticeStyle('#FEF3C7', '#92400E')}>
                Currently mapped to <strong>{takeoverFrom}</strong>. Saving takes this student over from them.
              </div>
            )}
            {!row.mappedToMe && !takeoverFrom && !mappedHere && !blocked && (
              <div style={{ fontSize: 12, color: '#6B7A8D' }}>This student will be mapped to you first.</div>
            )}

            {blocked && (
              <div style={noticeStyle('#FEE2E2', '#991B1B')}>
                <strong>
                  {inSession.length === 1
                    ? 'This student has an online session in progress or under review.'
                    : `This student has ${inSession.length} online sessions in progress or under review.`}
                </strong>{' '}
                It can't be recorded as done until that session is closed.
                {bookingItems(inSession)}
              </div>
            )}

            {!blocked && toCancel.length > 0 && (
              <div style={noticeStyle('#EFF6FF', '#1E3A8A')}>
                <strong>
                  {toCancel.length === 1
                    ? 'This student has an online session booked.'
                    : `This student has ${toCancel.length} online sessions booked.`}
                </strong>{' '}
                Saving cancels {toCancel.length === 1 ? 'it' : 'them'} and frees the slot. The student is not emailed
                about it.
                {bookingItems(toCancel)}
              </div>
            )}

            <div>
              <label className='cp-off-label' htmlFor='offline-session-date'>
                Session date
              </label>
              <input
                id='offline-session-date'
                type='date'
                className='form-control cp-off-touch'
                value={sessionDate}
                min={minDate}
                max={today}
                onChange={(e) => setSessionDate(e.target.value)}
                disabled={submitting}
              />
              <div className='cp-off-sub'>Today or up to 30 days back.</div>
            </div>

            <div>
              <label className='cp-off-label' htmlFor='offline-session-otp'>
                Student's OTP <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
              </label>
              <input
                id='offline-session-otp'
                type='text'
                inputMode='numeric'
                pattern='[0-9]*'
                autoComplete='one-time-code'
                maxLength={4}
                placeholder={otpDisabled ? '' : '4 digits'}
                className='form-control cp-off-touch'
                style={{ maxWidth: 160, letterSpacing: 4, fontWeight: 600 }}
                value={otp}
                disabled={otpDisabled || submitting}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))
                  if (otpNote?.kind === 'error') setOtpNote(null)
                }}
              />
              {otpNote ? (
                <div style={{ fontSize: 12, marginTop: 4, color: otpNote.kind === 'error' ? '#B91C1C' : '#6B7A8D' }}>
                  {otpNote.text}
                </div>
              ) : (
                <div className='cp-off-sub'>
                  Ask the student for their counselling OTP. Leave it empty to save without it — the record will show
                  "OTP not verified".
                </div>
              )}
            </div>

            <div>
              <span className='cp-off-label'>
                Photos of the counselling sheet <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
              </span>
              {/* Two inputs on purpose: with `capture`, Android opens the camera directly and
                  ignores `multiple`, so gallery picks need their own input. */}
              <input
                ref={cameraRef}
                type='file'
                accept='image/*'
                capture='environment'
                style={{ display: 'none' }}
                onChange={(e) => addFiles(e.target.files, e.target)}
              />
              <input
                ref={pickerRef}
                type='file'
                accept='image/*'
                multiple
                style={{ display: 'none' }}
                onChange={(e) => addFiles(e.target.files, e.target)}
              />
              <div className='cp-off-actions'>
                <button
                  type='button'
                  className='cp-action-btn cp-off-touch'
                  onClick={() => cameraRef.current?.click()}
                  disabled={busy}
                >
                  <i className='bi bi-camera' /> Take photo
                </button>
                <button
                  type='button'
                  className='cp-action-btn cp-off-touch'
                  onClick={() => pickerRef.current?.click()}
                  disabled={busy}
                >
                  <i className='bi bi-images' /> Choose photos
                </button>
              </div>
              {preparing && <div className='cp-off-sub'>Preparing photos...</div>}
              {photoError && <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 4 }}>{photoError}</div>}
              {photos.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {photos.map((p, i) => (
                    <div key={p.key} style={thumbStyle}>
                      <img
                        src={p.previewUrl}
                        alt={`Counselling sheet ${i + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      <button
                        type='button'
                        aria-label='Remove photo'
                        title='Remove photo'
                        onClick={() => removePhoto(p.key)}
                        disabled={submitting}
                        className='cp-off-photo-remove'
                      >
                        <span aria-hidden='true'>×</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <div style={noticeStyle('#FEE2E2', '#991B1B')}>{error}</div>}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer style={{ justifyContent: confirmingTakeover ? 'space-between' : 'flex-end' }}>
        {uploadFailed ? (
          <button type='button' className='cp-action-btn cp-off-touch' onClick={close} disabled={submitting}>
            Close
          </button>
        ) : confirmingTakeover ? (
          <>
            <div style={{ fontSize: 13, color: '#92400E', flex: '1 1 220px' }}>
              Take {row.name} over from {takeoverFrom} and mark done?
            </div>
            <div className='cp-off-actions'>
              <button
                type='button'
                className='cp-action-btn cp-off-touch'
                onClick={() => setConfirmingTakeover(false)}
              >
                Back
              </button>
              <button
                type='button'
                className='cp-action-btn cp-action-btn-primary cp-off-touch'
                onClick={() => {
                  setTakeoverConfirmed(true)
                  handleSubmit(true)
                }}
              >
                Take over and mark done
              </button>
            </div>
          </>
        ) : (
          <>
            <button type='button' className='cp-action-btn cp-off-touch' onClick={close} disabled={submitting}>
              Cancel
            </button>
            <button
              type='button'
              className='cp-action-btn cp-action-btn-primary cp-off-touch'
              onClick={() => handleSubmit()}
              disabled={busy || blocked}
            >
              {submitting ? progress || 'Saving...' : takeoverFrom && !mappedHere ? 'Take over and mark done' : 'Mark done'}
            </button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  )
}

const noticeStyle = (background: string, color: string): React.CSSProperties => ({
  background,
  color,
  padding: '10px 14px',
  borderRadius: 8,
  fontSize: 13,
  lineHeight: 1.5,
})

const thumbStyle: React.CSSProperties = {
  position: 'relative',
  width: 84,
  height: 84,
  borderRadius: 8,
  overflow: 'hidden',
  border: '1px solid #DDE3EC',
  background: '#F5F7FA',
}

export default MarkDoneModal
