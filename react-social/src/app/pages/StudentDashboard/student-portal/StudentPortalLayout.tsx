import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../modules/auth/core/Auth'
import { STUDENT_MENU_ITEMS } from './studentMenuConfig'
import './StudentPortalLayout.css'

/**
 * Dedicated student portal shell — green glassmorphism theme.
 *
 * Decoupled from the admin Metronic MasterLayout. A student who signs in via the
 * unified /auth page (student mode) lands here and only ever loads this lightweight
 * shell. Navigation comes from the single source of truth STUDENT_MENU_ITEMS
 * (studentMenuConfig.tsx) — content unchanged; only the look is the new green/glass
 * theme (palette borrowed from StudentPortalDashboard's spd-* design).
 *
 * No data is fetched here — the user comes from the already-hydrated auth context
 * (useAuth, sourced from /auth/me at app boot), so the shell adds zero network load.
 */

const HamburgerIcon = () => (
  <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'>
    <line x1='3' y1='6' x2='21' y2='6' />
    <line x1='3' y1='12' x2='21' y2='12' />
    <line x1='3' y1='18' x2='21' y2='18' />
  </svg>
)
const SearchIcon = () => (
  <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
    <circle cx='11' cy='11' r='7' /><line x1='21' y1='21' x2='16.65' y2='16.65' />
  </svg>
)
const BellIcon = () => (
  <svg width='17' height='17' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
    <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' /><path d='M13.73 21a2 2 0 0 1-3.46 0' />
  </svg>
)
const SignOutIcon = () => (
  <svg width='17' height='17' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'>
    <path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' /><polyline points='16 17 21 12 16 7' /><line x1='21' y1='12' x2='9' y2='12' />
  </svg>
)

const StudentPortalLayout: React.FC = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { currentUser } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // Force light theme for the student portal; defensively hide the Metronic splash.
    document.documentElement.setAttribute('data-theme', 'light')
    localStorage.setItem('kt_theme_mode_value', 'light')
    const splash = document.getElementById('splash-screen')
    if (splash) splash.style.display = 'none'
    document.body.classList.remove('page-loading', 'splash-screen')
  }, [])

  const displayName =
    (currentUser as any)?.name ||
    (currentUser as any)?.studentName ||
    currentUser?.email ||
    'Student'

  const initials = useMemo(() => {
    const src = String(displayName).trim()
    if (!src || src.includes('@')) return (src[0] || 'S').toUpperCase()
    return src
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase()
  }, [displayName])

  // Breadcrumb leaf = the menu item whose route best matches the current path.
  // The dashboard root reads "Home" so it doesn't render "Dashboard › Dashboard".
  const currentLabel = useMemo(() => {
    const match = STUDENT_MENU_ITEMS
      .filter((i) => !i.externalHref && pathname.startsWith(i.path))
      .sort((a, b) => b.path.length - a.path.length)[0]
    const label = match?.label || 'Dashboard'
    return label === 'Dashboard' ? 'Home' : label
  }, [pathname])

  // Real sign-out: the shared /logout route revokes the session server-side and
  // bounces to /auth/login. (Never just clear localStorage.)
  const handleLogout = () => navigate('/logout')

  return (
    <div className='sp-shell'>
      {/* Aside */}
      <aside className={`sp-aside ${collapsed ? 'collapsed' : ''}`}>
        <div className='sp-brand'>
          <div className='sp-brand-logo'>C9</div>
          <div className='sp-brand-text'>
            <strong>Career-9</strong>
            <span>Student Portal</span>
          </div>
        </div>

        <nav className='sp-nav'>
          {STUDENT_MENU_ITEMS.map((item) =>
            item.externalHref ? (
              <a
                key={item.path}
                href={item.externalHref}
                target='_blank'
                rel='noopener noreferrer'
                className='sp-nav-item'
                title={item.label}
              >
                <span className='sp-nav-icon'>{item.icon}</span>
                <span className='sp-nav-label'>{item.label}</span>
              </a>
            ) : (
              <NavLink
                key={item.path}
                to={item.path}
                // Dashboard root must match exactly or it stays active on every sub-page.
                end={item.path === '/student/dashboard'}
                className={({ isActive }) => `sp-nav-item ${isActive ? 'active' : ''}`}
                title={item.label}
              >
                <span className='sp-nav-icon'>{item.icon}</span>
                <span className='sp-nav-label'>{item.label}</span>
              </NavLink>
            )
          )}
        </nav>

        <div className='sp-aside-bottom'>
          <div className='sp-user'>
            <div className='sp-avatar'>{initials}</div>
            <div className='sp-user-meta'>
              <strong title={displayName}>{displayName}</strong>
              <span>Student</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Body */}
      <div className='sp-body'>
        <header className='sp-topbar'>
          <div className='sp-topbar-left'>
            <button
              className='sp-icon-btn'
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expand menu' : 'Collapse menu'}
              aria-label='Toggle menu'
            >
              <HamburgerIcon />
            </button>
            <div className='sp-breadcrumb'>
              Dashboard <span aria-hidden>›</span> <b>{currentLabel}</b>
            </div>
          </div>

          <div className='sp-topbar-right'>
            <div className='sp-search'>
              <SearchIcon />
              <input type='text' placeholder='Search…' aria-label='Search' />
            </div>
            <button className='sp-icon-btn' title='Notifications' aria-label='Notifications'>
              <BellIcon />
              <span className='sp-notif-dot' />
            </button>
            <button className='sp-icon-btn' onClick={handleLogout} title='Sign out' aria-label='Sign out'>
              <SignOutIcon />
            </button>
          </div>
        </header>

        <main className='sp-content'>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default StudentPortalLayout
