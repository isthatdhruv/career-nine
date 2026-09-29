import { useEffect, useState } from 'react'
import { convertImageToWebP } from '../../../utils/imageUtils'
import { OfflineStudentRow } from '../../Counselling/API/OfflineCounsellingAPI'

// ── Dates ────────────────────────────────────────────────────────────────────
// The server validates the session date against its IST clock (CounsellingClock), so the
// picker's "today" must be IST too — a counsellor's laptop set to another zone, or the
// hour after midnight UTC, would otherwise offer a day the server refuses.

/** Today in Asia/Kolkata as yyyy-MM-dd. */
export function todayIst(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** yyyy-MM-dd shifted by whole days (calendar arithmetic, no zone involved). */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** "28 Sep 2026" for a yyyy-MM-dd; the input unchanged when it doesn't parse. */
export function formatDay(ymd?: string | null): string {
  if (!ymd) return '—'
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "10:30 AM" for an HH:mm[:ss]; empty when absent. */
export function formatTime(hms?: string | null): string {
  if (!hms) return ''
  const [h, m] = hms.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return hms
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const ASSESSMENT_STATUS_LABELS: Record<string, string> = {
  notstarted: 'Not started',
  ongoing: 'In progress',
  completed: 'Completed',
}

export function assessmentStatusLabel(status?: string | null): string {
  if (!status) return 'Not started'
  return ASSESSMENT_STATUS_LABELS[status.toLowerCase()] || status
}

/**
 * Readable text for a map-to-me SKIPPED `reason`, which the server sends as a code
 * (NOT_IN_SCOPE, ERROR). `inList` gives the short form that follows a student's name in
 * the bulk summary.
 */
export function skipReasonText(reason: string | null | undefined, inList: boolean = false): string {
  switch (reason) {
    case 'NOT_IN_SCOPE':
      return inList ? 'not in one of your schools' : "This student isn't in one of your schools."
    case 'ERROR':
      return inList ? 'could not be mapped, try again' : 'Could not map this student. Please try again.'
    default:
      return inList ? 'not mapped' : 'Could not map this student to you.'
  }
}

// ── Photos ───────────────────────────────────────────────────────────────────

/**
 * Shrinks a photo of a counselling sheet before upload. Phones on school Wi-Fi or mobile
 * data are the norm here, and a 12 MP camera frame is several MB.
 *
 * <p>2400px on the long side, not convertImageToWebP's 1920x1080 default: a portrait photo
 * of a handwritten A4 sheet squeezed to 1080px tall is barely legible.
 *
 * <p>Browsers that cannot encode WebP (Safari) quietly hand back a PNG from
 * {@code canvas.toBlob}, which convertImageToWebP still labels ".webp" — so the real blob
 * type is checked, and JPEG is tried instead. Anything that fails to decode (HEIC outside
 * Safari) or comes out larger is sent as the original file.
 */
export async function preparePhoto(file: File): Promise<File> {
  if (file.type && !file.type.startsWith('image/')) return file
  try {
    const res = await convertImageToWebP(file, 0.8, 2400, 2400)
    if (res.blob.type === 'image/webp') {
      return res.file.size < file.size ? res.file : file
    }
  } catch {
    return file
  }
  const jpeg = await encodeJpeg(file, 0.8, 2400)
  return jpeg && jpeg.size < file.size ? jpeg : file
}

function encodeJpeg(file: File, quality: number, maxSide: number): Promise<File | null> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const ratio = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.type !== 'image/jpeg') {
            resolve(null)
            return
          }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

// ── Layout ───────────────────────────────────────────────────────────────────

/** True below `maxWidth` px. Drives table (desktop) vs cards (phone): only one is rendered. */
export function useIsNarrow(maxWidth: number = 767.98): boolean {
  const query = `(max-width: ${maxWidth}px)`
  const [narrow, setNarrow] = useState<boolean>(
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const onChange = () => setNarrow(mql.matches)
    onChange()
    // Safari < 14 only has the deprecated addListener.
    if (mql.addEventListener) mql.addEventListener('change', onChange)
    else mql.addListener(onChange)
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange)
      else mql.removeListener(onChange)
    }
  }, [query])
  return narrow
}

// ── Sorting ──────────────────────────────────────────────────────────────────

/** Numeric-aware, so "Class 9" sorts before "Class 10". */
export const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

/** Class, then section, then name — the order a school's register is in. */
export function compareRows(a: OfflineStudentRow, b: OfflineStudentRow): number {
  return (
    collator.compare(a.className || '', b.className || '') ||
    collator.compare(a.sectionName || '', b.sectionName || '') ||
    collator.compare(a.name || '', b.name || '')
  )
}

/** Unique non-empty values, collator-sorted (filter dropdown options). */
export function distinctSorted(values: (string | null | undefined)[]): string[] {
  const seen: Record<string, true> = {}
  const out: string[] = []
  values.forEach((v) => {
    if (v && !seen[v]) {
      seen[v] = true
      out.push(v)
    }
  })
  return out.sort(collator.compare)
}

/** Splits `items` into consecutive chunks of at most `size`. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
