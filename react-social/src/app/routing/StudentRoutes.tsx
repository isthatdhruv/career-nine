import { FC, lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../modules/auth/core/Auth'

const StudentDashboardLogin = lazy(
  () => import('../pages/StudentDashboard/student-portal/StudentDashboardLogin')
)
const StudentSsoLanding = lazy(
  () => import('../pages/StudentDashboard/student-portal/StudentSsoLanding')
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
const InsightDashboard = lazy(
  () => import('../pages/StudentDashboard/insight/InsightDashboard')
)
const StudentPaymentReturn = lazy(
  () => import('../pages/StudentDashboard/student-portal/StudentPaymentReturn')
)
const StudentCounsellingPage = lazy(() => import('../pages/Counselling/student/StudentCounsellingPage'))
const SlotBookingPage = lazy(() => import('../pages/Counselling/student/SlotBookingPage'))
const PermissionDeniedPage = lazy(() => import('../components/PermissionDeniedPage'))

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
 *
 * Phase 19 (19-02): replaced localStorage.studentPortalLoggedIn with the unified
 * cookie-session auth context. AuthInit (in modules/auth/core/Auth.tsx) bootstraps
 * currentUser from /auth/me via the HttpOnly cn_at cookie — no client-side token
 * to spoof. Setting localStorage.studentPortalLoggedIn=true in DevTools no longer
 * grants access.
 *
 * Backwards-compat: any stale studentPortalLoggedIn / studentPortalProfile keys
 * in users' browsers from pre-Phase-19 builds are ignored — harmless dead data.
 */
const StudentAuthGuard: FC = () => {
  const { currentUser } = useAuth()
  if (!currentUser) {
    return <Navigate to='/auth/login' replace />
  }
  // Super-admin is a full bypass — matches the predicate in
  // modules/auth/core/permissions.ts and the backend AuthorizationService.
  // Without this, a bootstrap super-admin (no role groups assigned yet) would
  // be unable to enter the student portal to inspect / debug.
  if (currentUser.superAdmin) {
    return <Outlet />
  }
  // Either STUDENT or B2C_STUDENT role is acceptable for the student portal.
  // currentUser.roles is the canonical field per modules/auth/core/_models.ts (string[]).
  // We also tolerate ROLE_-prefixed variants in case the backend serialises Spring authorities directly.
  const roles = currentUser.roles || []
  const isStudent = roles.some(
    (r) => r === 'STUDENT' || r === 'B2C_STUDENT' || r === 'ROLE_STUDENT' || r === 'ROLE_B2C_STUDENT'
  )
  if (!isStudent) {
    return <Navigate to='/auth/login' replace />
  }
  return <Outlet />
}

/**
 * Guard that requires student info to be completed before reaching dashboard pages.
 *
 * Phase 19 (19-02): derive infoCompleted from currentUser instead of
 * localStorage.studentPortalProfile. The User shape from /auth/me may not yet
 * expose infoCompleted (Phase 16 didn't surface it on the User contract); when
 * the field is absent we fail-open since the StudentInfoForm page itself is
 * the final gate — a student with missing data will be forced there by the
 * page-level logic anyway.
 */
const StudentInfoGuard: FC = () => {
  const location = useLocation()
  const { currentUser } = useAuth()

  // Always allow the info form itself
  if (location.pathname === '/student/dashboard/student-info') {
    return <Outlet />
  }

  // The User type doesn't yet declare infoCompleted (Phase 16 surface gap).
  // Cast to any to peek at the optional field; default true (fail-open) when absent.
  const infoCompleted =
    (currentUser as any)?.infoCompleted ??
    (currentUser as any)?.student?.infoCompleted ??
    true
  if (infoCompleted !== true) {
    return <Navigate to='/student/dashboard/student-info' replace />
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
 * Protected routes (require an authenticated session with STUDENT or B2C_STUDENT role):
 *   /student/dashboard/student-info  — Profile form (required before dashboard access)
 *   /student/dashboard                — Student dashboard (Navigator 360)
 *   /student/dashboard/assessments    — Allocated assessments list
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

        {/*
          SSO landing for the assessment Thank-You page "Go to Dashboard" CTA.
          Anonymous-by-design: ?t=<accessToken>&e=<entitlementId>. The landing
          component POSTs /entitlement/redeem-dashboard-token, which validates
          the entitlement and issues cn_at + cn_csrf. On success we hydrate
          currentUser from /auth/me and navigate to /student/dashboard; on any
          failure we fall back to /student/login with a toast (no silent fail).
        */}
        <Route path='sso' element={<StudentSsoLanding />} />

        {/*
          Phase 19 (Plan 19-05): student-portal permission-denied page.
          Reachable WITHOUT the auth guard so a 403 redirect lands cleanly
          even when the cookie has been revoked between requests. The page
          itself reads useAuth() and picks the student CTA when currentUser
          carries the STUDENT/B2C_STUDENT role; unauthenticated viewers see
          the "Sign in" CTA.
        */}
        <Route path='permission-denied' element={<PermissionDeniedPage />} />

        {/* Protected — requires student auth */}
        <Route element={<StudentAuthGuard />}>
          {/* Student info form — always accessible when logged in */}
          <Route path='student-info' element={<StudentInfoForm />} />

          {/* Post-Razorpay return for a dashboard purchase — confirms payment and
              routes into the unlocked dashboard. Outside the info-completed guard
              so a returning payer always reaches the confirmation. */}
          <Route path='payment-return' element={<StudentPaymentReturn />} />

          {/* Pages that require info to be completed */}
          <Route element={<StudentInfoGuard />}>
            <Route path='dashboard' element={<StudentPortalDashboard />} />
            {/* The student's own data-driven Insight Dashboard (self mode → /dashboard/insight/me). */}
            <Route path='insight' element={<InsightDashboard self />} />
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
