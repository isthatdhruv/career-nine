import React, { useEffect, useRef, useState } from 'react'
import {
  SessionNotesPhoto,
  deleteSessionNotesPhoto,
  getSessionNotesPhotos,
  uploadSessionNotesPhotos,
} from '../API/SessionNotesAPI'

/**
 * "Upload photo of session notes" block for the counsellor's notes form.
 *
 * Photos go straight to the backend (multipart) which stores them in the same
 * DigitalOcean Spaces bucket as the rendered student reports, so they can be
 * uploaded before or after the typed notes are saved — they hang off the
 * appointment, not the notes row.
 *
 * Two modes:
 *  - controlled: parent passes `photos` + `onPhotosChange` (the counsellor
 *    portal bulk-loads photos for every session on the page);
 *  - self-managed: no `photos` prop, the component fetches its own list.
 *
 * Styling is inline so it looks right in both the portal (`cp-*`) and the
 * older Counselling (`cl-*`) skins; pass `buttonClassName` to reuse a skin's
 * button style.
 */
interface SessionNotesPhotoUploadProps {
  appointmentId: number
  photos?: SessionNotesPhoto[]
  onPhotosChange?: (photos: SessionNotesPhoto[]) => void
  buttonClassName?: string
  /** Accent used for the label + link colour. Defaults to the portal navy. */
  accent?: string
  /** Hide the "Photos of session notes" heading (when the parent renders its own label). */
  hideLabel?: boolean
}

const MAX_FILES_PER_UPLOAD = 10
const MAX_FILE_BYTES = 10 * 1024 * 1024

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const SessionNotesPhotoUpload: React.FC<SessionNotesPhotoUploadProps> = ({
  appointmentId,
  photos,
  onPhotosChange,
  buttonClassName,
  accent = '#263B6A',
  hideLabel = false,
}) => {
  const controlled = photos !== undefined
  const [ownPhotos, setOwnPhotos] = useState<SessionNotesPhoto[]>([])
  const [loading, setLoading] = useState(!controlled)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const list = controlled ? photos! : ownPhotos

  const setList = (next: SessionNotesPhoto[]) => {
    if (controlled) onPhotosChange?.(next)
    else setOwnPhotos(next)
  }

  useEffect(() => {
    if (controlled) return
    let cancelled = false
    setLoading(true)
    getSessionNotesPhotos(appointmentId)
      .then((res) => {
        if (!cancelled) setOwnPhotos(res.data || [])
      })
      .catch(() => {
        // No photos yet, or not permitted — either way show an empty list.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [appointmentId, controlled])

  const handleFiles = async (fileList: FileList | null) => {
    setError('')
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    if (files.length > MAX_FILES_PER_UPLOAD) {
      setError(`Please select at most ${MAX_FILES_PER_UPLOAD} photos at a time.`)
      return
    }
    const notImage = files.find((f) => f.type && !f.type.startsWith('image/'))
    if (notImage) {
      setError(`${notImage.name} is not an image. Only photos can be uploaded.`)
      return
    }
    const tooBig = files.find((f) => f.size > MAX_FILE_BYTES)
    if (tooBig) {
      setError(`${tooBig.name} is larger than 10 MB. Please choose a smaller photo.`)
      return
    }

    setUploading(true)
    try {
      const res = await uploadSessionNotesPhotos(appointmentId, files)
      setList(res.data || [])
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        'Upload failed. Please check your connection and try again.'
      setError(msg)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDelete = async (photo: SessionNotesPhoto) => {
    if (!window.confirm('Remove this photo of the session notes?')) return
    setError('')
    setDeletingId(photo.id)
    try {
      await deleteSessionNotesPhoto(photo.id)
      setList(list.filter((p) => p.id !== photo.id))
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.response?.data?.error || 'Could not remove the photo. Please try again.'
      setError(msg)
    } finally {
      setDeletingId(null)
    }
  }

  const buttonStyle: React.CSSProperties = buttonClassName
    ? {}
    : {
        padding: '8px 16px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        border: `1px solid ${accent}`,
        background: '#fff',
        color: accent,
      }

  return (
    <div>
      {!hideLabel && (
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#6B7A8D',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            display: 'block',
            marginBottom: 6,
          }}
        >
          Photos of session notes
          <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 6, color: '#6984A9' }}>
            Only visible to you and admin
          </span>
        </label>
      )}

      {/* Thumbnails */}
      {loading ? (
        <div style={{ fontSize: 12, color: '#6B7A8D', marginBottom: 8 }}>Loading photos...</div>
      ) : list.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          {list.map((photo, idx) => (
            <div
              key={photo.id}
              style={{
                position: 'relative',
                width: 96,
                height: 96,
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid #DDE3EC',
                background: '#F5F7FA',
                opacity: deletingId === photo.id ? 0.5 : 1,
              }}
            >
              <a
                href={photo.fileUrl}
                target='_blank'
                rel='noopener noreferrer'
                title={photo.originalFileName || `Session notes photo ${idx + 1}`}
                style={{ display: 'block', width: '100%', height: '100%' }}
              >
                <img
                  src={photo.fileUrl}
                  alt={`Session notes ${idx + 1}`}
                  loading='lazy'
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </a>
              <button
                type='button'
                onClick={() => handleDelete(photo)}
                disabled={deletingId === photo.id || uploading}
                aria-label='Remove photo'
                title='Remove photo'
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(17, 24, 39, 0.75)',
                  color: '#fff',
                  fontSize: 14,
                  lineHeight: '22px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                ×
              </button>
              {photo.fileSize ? (
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    fontSize: 10,
                    color: '#fff',
                    background: 'rgba(17, 24, 39, 0.55)',
                    padding: '2px 6px',
                    textAlign: 'right',
                  }}
                >
                  {formatSize(photo.fileSize)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#6B7A8D', marginBottom: 8 }}>
          No photos uploaded yet. Take a picture of your handwritten notes and attach it here.
        </div>
      )}

      {/* Upload button + hidden input */}
      <input
        ref={inputRef}
        type='file'
        accept='image/*'
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          type='button'
          className={buttonClassName}
          style={buttonStyle}
          onClick={() => inputRef.current?.click()}
          disabled={uploading || loading}
        >
          {uploading ? 'Uploading...' : list.length > 0 ? 'Upload more photos' : 'Upload photo of notes'}
        </button>
        <span style={{ fontSize: 11, color: '#6B7A8D' }}>
          JPG, PNG or HEIC · up to 10 MB each
          {list.length > 0 ? ` · ${list.length} photo${list.length === 1 ? '' : 's'}` : ''}
        </span>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 6 }}>{error}</div>
      )}
    </div>
  )
}

export default SessionNotesPhotoUpload
