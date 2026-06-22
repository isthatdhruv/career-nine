import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useAuth } from '../../../modules/auth/core/Auth'
import { getStudentAssessments } from '../API/Dashboard_APIs'
import { getMyNavigatorReports, NavigatorReportCard } from './navigatorApi'

/**
 * Single source of truth for the student dashboard.
 *
 * All data the portal pages need is fetched ONCE — when the student lands in the
 * portal after login — and then read from this context "wherever needed", instead
 * of every page fetching on each visit. A manual Refresh (button in the shell
 * top-bar) re-runs the whole bootstrap. This replaces the dead `studentPortalDashboard`
 * localStorage cache that the unified-login flow no longer populates.
 *
 * Each dataset is fetched independently and fails soft (a single failing source
 * doesn't blank the others). Add new datasets here as pages are reconciled —
 * pages should consume them via `useStudentData()`, never fetch their own.
 */
export interface StudentData {
  /** Allotted assessments with status (GET /assessments/student/:id). */
  assessments: any[]
  /** Lean navigator report summaries, one per generated assessment (GET /navigator-report-data/me). */
  navigatorReports: NavigatorReportCard[]
  // TODO (per page reconciliation): generatedReports, counselling, checkoutOptions …
}

interface StudentDataContextValue {
  data: StudentData
  loading: boolean
  error: string | null
  /** epoch ms of the last successful load, or null before the first load. */
  lastUpdated: number | null
  /** Re-run the full bootstrap (wired to the shell's Refresh button). */
  refresh: () => void
}

const EMPTY: StudentData = { assessments: [], navigatorReports: [] }

const StudentDataContext = createContext<StudentDataContextValue>({
  data: EMPTY,
  loading: false,
  error: null,
  lastUpdated: null,
  refresh: () => {},
})

export const useStudentData = () => useContext(StudentDataContext)

export const StudentDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth()
  const userStudentId = (currentUser as any)?.userStudentId as number | undefined

  const [data, setData] = useState<StudentData>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const inflight = useRef(false)
  const loadedFor = useRef<number | null>(null)

  const load = useCallback(async () => {
    if (!userStudentId || inflight.current) return
    inflight.current = true
    setLoading(true)
    setError(null)
    try {
      const [assessments, navigatorReports] = await Promise.all([
        getStudentAssessments(userStudentId).catch(() => [] as any[]),
        getMyNavigatorReports().catch(() => [] as NavigatorReportCard[]),
      ])
      setData({
        assessments: assessments || [],
        navigatorReports: navigatorReports || [],
      })
      setLastUpdated(Date.now())
      loadedFor.current = userStudentId
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
      inflight.current = false
    }
  }, [userStudentId])

  // Bootstrap once per student id (i.e. at login). Re-bootstraps if the signed-in
  // student changes; the Refresh button calls load() directly.
  useEffect(() => {
    if (userStudentId && loadedFor.current !== userStudentId && !inflight.current) {
      load()
    }
  }, [userStudentId, load])

  const value = useMemo<StudentDataContextValue>(
    () => ({ data, loading, error, lastUpdated, refresh: load }),
    [data, loading, error, lastUpdated, load]
  )

  return <StudentDataContext.Provider value={value}>{children}</StudentDataContext.Provider>
}
