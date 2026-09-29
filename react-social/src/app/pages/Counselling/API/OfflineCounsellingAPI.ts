import axios from 'axios'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../modules/auth/core/Auth'

const API_URL = process.env.REACT_APP_API_URL
const BASE = `${API_URL}/api/offline-counselling`

// ── Offline counselling ──────────────────────────────────────────────────────
// Schools that run counselling themselves: an admin flags a counsellor "offline",
// and that counsellor records in-person sessions for students of the schools they
// are mapped to ("Map to me" + "Mark done"). Each record is a normal COMPLETED
// appointment whose `origin` is OFFLINE_RECORD, so photos, notes, report release
// and the dashboards keep working unchanged.

/** `origin` of an appointment recorded through this page (null for online bookings). */
export const ORIGIN_OFFLINE_RECORD = 'OFFLINE_RECORD'

export interface OfflineInstitute {
  instituteCode: number
  instituteName: string
  /** null on legacy institutes — treat as a school (see getInstituteTerms). */
  isSchool: boolean | null
}

export interface OfflineContext {
  /** True only for an active counsellor an admin has flagged offline. */
  offline: boolean
  counsellorId: number | null
  name: string | null
  institutes: OfflineInstitute[]
}

export interface OfflineAssessment {
  assessmentId: number
  assessmentName: string
  studentCount: number
}

/** An online booking still live for the student; marking done cancels it silently. */
export interface LiveBooking {
  appointmentId: number
  date: string | null
  startTime: string | null
  counsellorName: string | null
  status: string
}

export interface OfflineStudentRow {
  userStudentId: number
  name: string
  rollNumber: string | null
  className: string | null
  sectionName: string | null
  /** Raw student_assessment_mapping.status: 'notstarted' | 'ongoing' | 'completed'. */
  assessmentStatus: string | null
  hasDob: boolean
  mappedCounsellorId: number | null
  mappedCounsellorName: string | null
  mappedToMe: boolean
  done: boolean
  doneAppointmentId: number | null
  /** yyyy-MM-dd */
  doneDate: string | null
  doneByCounsellorName: string | null
  doneByMe: boolean
  doneOffline: boolean
  otpVerified: boolean
  photoCount: number
  reportHeld: boolean
  liveBookings: LiveBooking[]
}

export type MapToMeStatus = 'MAPPED' | 'TAKEN_OVER' | 'ALREADY_MINE' | 'SKIPPED'

export interface MapToMeStudentResult {
  userStudentId: number
  status: MapToMeStatus
  previousCounsellorName: string | null
  reason: string | null
}

export interface MapToMeResult {
  results: MapToMeStudentResult[]
  mappedCount: number
  takenOverCount: number
  alreadyMineCount: number
  skippedCount: number
}

export interface MarkDoneRequest {
  userStudentId: number
  assessmentId: number
  /** 4 digits, or null to save without the OTP check ("OTP not verified"). */
  otp: string | null
  /** yyyy-MM-dd, between today-30 and today (IST). */
  sessionDate: string
}

export interface MarkDoneResult {
  appointmentId: number
  otpVerified: boolean
  otpResult: 'VERIFIED' | 'NOT_PROVIDED'
  cancelledBookingIds: number[]
}

/** Server limit on one map-to-me call. The page sends smaller chunks. */
export const MAP_TO_ME_MAX_IDS = 500

/**
 * Error body of every non-2xx answer from this controller. `code` is what the page
 * branches on; the extras are only present for the codes that carry them.
 */
export interface OfflineApiError {
  status: number
  error: string
  message: string
  code: string
  /** OTP_WRONG */
  attemptsLeft?: number
  /** OTP_LOCKED: ISO time, or null when the lock is permanent. */
  lockedUntil?: string | null
  permanent?: boolean
  /** ALREADY_DONE_BY_ME */
  appointmentId?: number
  otpVerified?: boolean
  /** ALREADY_DONE */
  doneByCounsellorName?: string | null
  doneDate?: string | null
}

/** The typed error body of a failed call, or null for network failures / foreign shapes. */
export function offlineApiErrorOf(e: any): OfflineApiError | null {
  const data = e?.response?.data
  if (!data || typeof data !== 'object') return null
  return { ...data, status: e.response.status } as OfflineApiError
}

export function getOfflineContext() {
  return axios.get<OfflineContext>(`${BASE}/context`)
}

export function getOfflineAssessments(instituteCode: number) {
  return axios.get<OfflineAssessment[]>(`${BASE}/assessments`, { params: { instituteCode } })
}

export function getOfflineStudents(instituteCode: number, assessmentId: number) {
  return axios.get<OfflineStudentRow[]>(`${BASE}/students`, { params: { instituteCode, assessmentId } })
}

/** Map students to the calling counsellor (taking them over from anyone else). Max 500 ids. */
export function mapStudentsToMe(userStudentIds: number[]) {
  return axios.post<MapToMeResult>(`${BASE}/map-to-me`, { userStudentIds })
}

/** Record an in-person session as done. A 409 ALREADY_DONE_BY_ME carries the existing record's id. */
export function markCounsellingDone(body: MarkDoneRequest) {
  return axios.post<MarkDoneResult>(`${BASE}/mark-done`, body)
}

/** Admin: undo an offline record (it becomes a CANCELLED "reverted" record; photos are kept). */
export function revertOfflineRecord(appointmentId: number, note?: string | null) {
  return axios.post<{ appointmentId: number; status: string }>(`${BASE}/admin/${appointmentId}/revert`, {
    note: note ?? null,
  })
}

/** Admin: flag or unflag a counsellor as offline. */
export function setCounsellorOffline(counsellorId: number, offline: boolean) {
  return axios.put<{ counsellorId: number; isOffline: boolean }>(
    `${BASE}/admin/counsellor/${counsellorId}/offline`,
    { offline }
  )
}

// ── Shared /context ──────────────────────────────────────────────────────────
//
// The sidebar, this page and the post-login landing all need the same answer, and the
// sidebar mounts on every page. One promise per signed-in user is kept at module level so
// they share a single request; it is keyed by user id so a different sign-in in the same
// tab never reads the previous user's answer.

interface ContextCacheEntry {
  userId: number
  promise: Promise<OfflineContext>
  value?: OfflineContext
}

let contextCache: ContextCacheEntry | null = null
// Every mounted hook, so a reload() from the page also refreshes the sidebar.
const contextListeners = new Set<() => void>()

function normaliseContext(data: any): OfflineContext {
  return {
    offline: data?.offline === true,
    counsellorId: typeof data?.counsellorId === 'number' ? data.counsellorId : null,
    name: data?.name ?? null,
    institutes: Array.isArray(data?.institutes) ? data.institutes : [],
  }
}

/** The shared, cached /context answer for this user. A failed request is not cached. */
export function loadOfflineContext(userId: number): Promise<OfflineContext> {
  if (contextCache && contextCache.userId === userId) return contextCache.promise
  const entry: ContextCacheEntry = {
    userId,
    promise: getOfflineContext().then((res) => normaliseContext(res.data)),
  }
  contextCache = entry
  entry.promise.then(
    (value) => {
      entry.value = value
    },
    () => {
      if (contextCache === entry) contextCache = null
    }
  )
  return entry.promise
}

/** Forget the cached /context (e.g. on sign-in, or after an admin toggled the flag). */
export function clearOfflineContextCache() {
  contextCache = null
}

function cachedContextFor(userId?: number): OfflineContext | null {
  return userId && contextCache && contextCache.userId === userId ? contextCache.value ?? null : null
}

/**
 * The caller's offline-counselling context. `enabled=false` skips the request (the sidebar
 * of a user who is not a counsellor). `ctx` is null while loading, when disabled, and when
 * the request failed; `ctx.offline` is the only thing that gates the menu and the page.
 */
export function useOfflineCounsellingContext(enabled: boolean): {
  ctx: OfflineContext | null
  loading: boolean
  reload: () => void
} {
  const { currentUser } = useAuth()
  const userId = currentUser?.id
  // Seed from an already-resolved answer so the sidebar item doesn't blink on navigation.
  const [ctx, setCtx] = useState<OfflineContext | null>(() => (enabled ? cachedContextFor(userId) : null))
  const [loading, setLoading] = useState<boolean>(() => enabled && !!userId && !cachedContextFor(userId))
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1)
    contextListeners.add(bump)
    return () => {
      contextListeners.delete(bump)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !userId) {
      setCtx(null)
      setLoading(false)
      return
    }
    let cancelled = false
    const cached = cachedContextFor(userId)
    if (cached) {
      setCtx(cached)
      setLoading(false)
      return
    }
    setLoading(true)
    loadOfflineContext(userId)
      .then((value) => {
        if (!cancelled) setCtx(value)
      })
      .catch(() => {
        if (!cancelled) setCtx(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, userId, version])

  const reload = useCallback(() => {
    clearOfflineContextCache()
    contextListeners.forEach((fn) => fn())
  }, [])

  return { ctx, loading, reload }
}
