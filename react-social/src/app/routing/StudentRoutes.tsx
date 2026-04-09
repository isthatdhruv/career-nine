import { FC, lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'

const StudentDashboardLogin = lazy(
  () => import('../pages/StudentDashboard/student-portal/StudentDashboardLogin')
)
const StudentPortalDashboard = lazy(
  () => import('../pages/StudentDashboard/student-portal/StudentPortalDashboard')
)
const StudentAssessments = lazy(
  () => import('../pages/StudentDashboard/student-portal/StudentAssessments')
)
const StudentInfoForm = lazy(
  () => import('../pages/StudentDashboard/student-portal/StudentInfoForm')
)
const StudentReports = lazy(
  () => import('../pages/StudentDashboard/student-portal/StudentReports')
)
const StudentNavigator360Page = lazy(
  () => import('../pages/StudentDashboard/student-portal/StudentNavigator360Page')
)
const StudentCounsellingPage = lazy(() => import('../pages/Counselling/student/StudentCounsellingPage'))
const SlotBookingPage = lazy(() => import('../pages/Counselling/student/SlotBookingPage'))

const StudentFallback: FC = () => (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F5F7FA',
    }}
  >
    <div style={{ textAlign: 'center' }}>
      <img src='/media/logos/kcc.jpg' alt='Career-9' style={{ height: 30, marginBottom: 20 }} />
      <div style={{ color: '#6B7A8D', fontSize: 14 }}>Loading ...</div>
    </div>
  </div>
)

/**
 * Route guard for authenticated student routes.
 * Checks studentPortalLoggedIn in localStorage — redirects to login if absent.
 */
const StudentAuthGuard: FC = () => {
  const isLoggedIn = localStorage.getItem('studentPortalLoggedIn')
  if (!isLoggedIn) {
    return <Navigate to='/student/login' replace />
  }
  return <Outlet />
}

/**
 * Guard that requires info to be completed before accessing dashboard pages.
 * Allows /student/student-info through; redirects everything else if info incomplete.
 */
const StudentInfoGuard: FC = () => {
  const location = useLocation()

  // Allow the info form itself
  if (location.pathname === '/student/student-info') {
    return <Outlet />
  }

  try {
    const profileStr = localStorage.getItem('studentPortalProfile')
    if (profileStr) {
      const profile = JSON.parse(profileStr)
      if (profile.infoCompleted !== true) {
        return <Navigate to='/student/student-info' replace />
      }
    }
  } catch {
    // If profile parse fails, let the page handle it
  }

  return <Outlet />
}

/**
 * Student portal routes — standalone layout, no Metronic MasterLayout or aside menu.
 * Mounted at /student/* from AppRoutes.
 *
 * Public routes:
 *   /student/login         — Student login (username + DOB)
 *
 * Protected routes (require studentPortalLoggedIn):
 *   /student/student-info  — Profile form (required before dashboard access)
 *   /student/dashboard     — Student dashboard (Navigator 360)
 *   /student/assessments   — Allocated assessments list
 */
const StudentRoutes: FC = () => {
  useEffect(() => {
    // Hide Metronic splash screen (AuthInit doesn't run for student routes)
    const splash = document.getElementById('splash-screen')
    if (splash) splash.style.display = 'none'
    document.body.classList.remove('page-loading', 'splash-screen')

    // Force light theme
    document.documentElement.setAttribute('data-theme', 'light')
    localStorage.setItem('kt_theme_mode_value', 'light')
  }, [])

  return (
    <Suspense fallback={<StudentFallback />}>
      <Routes>
        {/* Public */}
        <Route path='login' element={<StudentDashboardLogin />} />

        {/* Protected — requires student auth */}
        <Route element={<StudentAuthGuard />}>
          {/* Student info form — always accessible when logged in */}
          <Route path='student-info' element={<StudentInfoForm />} />

          {/* Pages that require info to be completed */}
          <Route element={<StudentInfoGuard />}>
            <Route path='dashboard' element={<StudentPortalDashboard />} />
            <Route path='navigator-360' element={<StudentNavigator360Page />} />
            <Route path='assessments' element={<StudentAssessments />} />
            <Route path='reports' element={<StudentReports />} />
            <Route path='counselling' element={<StudentCounsellingPage />} />
            <Route path='counselling/book' element={<SlotBookingPage />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path='*' element={<Navigate to='login' replace />} />
      </Routes>
    </Suspense>
  )
}

export default StudentRoutes
