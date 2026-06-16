import { FC, lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from '../modules/auth/core/Auth'
import { MasterLayout } from '../../_metronic/layout/MasterLayout'

const CounsellorAuthPage = lazy(
  () => import('../pages/CounsellorDashboard/CounsellorAuthPage')
)
const CounsellorPortalDashboard = lazy(
  () => import('../pages/CounsellorDashboard/CounsellorPortalDashboard')
)
const CounsellorAppointmentsPage = lazy(
  () => import('../pages/CounsellorDashboard/CounsellorAppointmentsPage')
)
const CounsellorNotesPage = lazy(
  () => import('../pages/CounsellorDashboard/CounsellorNotesPage')
)
const CounsellorAvailabilityPage = lazy(
  () => import('../pages/CounsellorDashboard/CounsellorAvailabilityPage')
)
const CounsellorProfilePage = lazy(
  () => import('../pages/CounsellorDashboard/CounsellorProfilePage')
)
const PermissionDeniedPage = lazy(
  () => import('../components/PermissionDeniedPage')
)

const CounsellorFallback: FC = () => (
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
 * Route guard for authenticated counsellor routes.
 *
 * Phase 19 (persona unification): replaced the legacy localStorage
 * counsellor-portal flag + JSON-blob gate with the unified cookie-session
 * auth context. AuthInit (in modules/auth/core/Auth.tsx) bootstraps
 * currentUser from /auth/me via the HttpOnly cn_at cookie; this guard
 * simply checks that currentUser is present AND has the COUNSELLOR role.
 *
 * Counsellors are normal users with role COUNSELLOR — there is no
 * separate session, no separate token, no separate stored object.
 * Setting localStorage flags in DevTools no longer grants access
 * (Phase 19 success criterion #2).
 */
const CounsellorAuthGuard: FC = () => {
  const { currentUser } = useAuth()
  if (!currentUser) {
    return <Navigate to='/counsellor/login' replace />
  }
  // Super-admin is a full bypass — matches the predicate in
  // modules/auth/core/permissions.ts and the backend AuthorizationService.
  // Without this, a bootstrap super-admin (no role groups assigned yet) would
  // be unable to enter the counsellor portal to inspect / debug.
  if (currentUser.superAdmin) {
    return <Outlet />
  }
  // Role names reach the FE verbatim from role.name in the DB, which holds
  // 'Counsellor' on staging/prod (the V20260610001 seed's WHERE name =
  // 'COUNSELLOR' guard matched it case-insensitively and inserted nothing),
  // so the comparison here must be case-insensitive too.
  const matchesCounsellor = (r: unknown) =>
    typeof r === 'string' &&
    ['COUNSELLOR', 'ROLE_COUNSELLOR'].includes(r.toUpperCase())
  const roles = (currentUser as any).roles
  const role = (currentUser as any).role
  const isCounsellor =
    matchesCounsellor(role) ||
    (Array.isArray(roles) && roles.some(matchesCounsellor))
  if (!isCounsellor) {
    return <Navigate to='/counsellor/login' replace />
  }
  return <Outlet />
}

/**
 * Counsellor portal routes — standalone layout, no Metronic MasterLayout.
 * Mounted at /counsellor/* from AppRoutes.
 *
 * Public:
 *   /counsellor/login       — Counsellor login (email + password)
 *
 * Protected:
 *   /counsellor/dashboard   — Main counsellor dashboard
 *   /counsellor/appointments — Appointments
 *   /counsellor/notes       — Session notes
 *   /counsellor/availability — Availability templates + slots
 *   /counsellor/profile     — Counsellor profile editor
 */
const CounsellorRoutes: FC = () => {
  useEffect(() => {
    const splash = document.getElementById('splash-screen')
    if (splash) splash.style.display = 'none'
    document.body.classList.remove('page-loading', 'splash-screen')

    document.documentElement.setAttribute('data-theme', 'light')
    localStorage.setItem('kt_theme_mode_value', 'light')
  }, [])

  return (
    <Suspense fallback={<CounsellorFallback />}>
      <Routes>
        {/* Public */}
        <Route path='login' element={<CounsellorAuthPage />} />
        <Route path='register' element={<CounsellorAuthPage />} />

        {/*
          Phase 19 (Plan 19-05): counsellor-portal permission-denied page.
          Reachable WITHOUT the auth guard so 403 redirects land cleanly even
          if the cookie has been revoked. The page reads useAuth() and picks
          the counsellor CTA when currentUser has the COUNSELLOR role.
        */}
        <Route path='permission-denied' element={<PermissionDeniedPage />} />

        {/* Protected — now rendered INSIDE the main admin shell (MasterLayout) so the
            counsellor gets the same sidebar/header/UI as the rest of the project. The
            sidebar (AsideMenuMain) shows the counsellor-only menu for COUNSELLOR users. */}
        <Route element={<CounsellorAuthGuard />}>
          <Route element={<MasterLayout />}>
            <Route path='dashboard' element={<CounsellorPortalDashboard />} />
            <Route path='appointments' element={<CounsellorAppointmentsPage />} />
            <Route path='notes' element={<CounsellorNotesPage />} />
            <Route path='availability' element={<CounsellorAvailabilityPage />} />
            <Route path='profile' element={<CounsellorProfilePage />} />
          </Route>
        </Route>

        <Route path='*' element={<Navigate to='login' replace />} />
      </Routes>
    </Suspense>
  )
}

export default CounsellorRoutes
