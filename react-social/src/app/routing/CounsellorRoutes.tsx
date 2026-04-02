import { FC, lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'

const CounsellorDashboardLogin = lazy(
  () => import('../pages/CounsellorDashboard/CounsellorDashboardLogin')
)
const CounsellorPortalDashboard = lazy(
  () => import('../pages/CounsellorDashboard/CounsellorPortalDashboard')
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
 * Checks login status and validates counsellor role from stored user data.
 */
const CounsellorAuthGuard: FC = () => {
  const isLoggedIn = localStorage.getItem('counsellorPortalLoggedIn')
  const token = localStorage.getItem('counsellorPortalToken')

  if (!isLoggedIn || !token) {
    return <Navigate to='/counsellor/login' replace />
  }

  // Verify stored user has counsellor authority
  try {
    const userStr = localStorage.getItem('counsellorPortalUser')
    if (userStr) {
      const user = JSON.parse(userStr)
      const urls: string[] = user.authorityUrls || []
      const hasAccess = urls.some((url: string) => {
        const lower = url.toLowerCase()
        return lower.includes('counsellor') || lower.includes('counselor') || lower === '*' || lower === '/*'
      })
      if (!hasAccess) {
        localStorage.removeItem('counsellorPortalLoggedIn')
        localStorage.removeItem('counsellorPortalToken')
        localStorage.removeItem('counsellorPortalUser')
        return <Navigate to='/counsellor/login' replace />
      }
    }
  } catch {
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
 *   /counsellor/students    — Student list (placeholder)
 *   /counsellor/appointments — Appointments (placeholder)
 *   /counsellor/notes       — Session notes (placeholder)
 *   /counsellor/messages    — Messages (placeholder)
 *   /counsellor/reports     — Reports (placeholder)
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
        <Route path='login' element={<CounsellorDashboardLogin />} />

        {/* Protected */}
        <Route element={<CounsellorAuthGuard />}>
          <Route path='dashboard' element={<CounsellorPortalDashboard />} />
          {/* Future routes — all render dashboard for now */}
          <Route path='students' element={<CounsellorPortalDashboard />} />
          <Route path='appointments' element={<CounsellorPortalDashboard />} />
          <Route path='notes' element={<CounsellorPortalDashboard />} />
          <Route path='messages' element={<CounsellorPortalDashboard />} />
          <Route path='reports' element={<CounsellorPortalDashboard />} />
        </Route>

        <Route path='*' element={<Navigate to='login' replace />} />
      </Routes>
    </Suspense>
  )
}

export default CounsellorRoutes
