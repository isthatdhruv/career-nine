import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { toAbsoluteUrl } from '../../../_metronic/helpers'
import './PortalLayout.css'

export interface MenuItem {
  label: string
  path: string
  icon: React.ReactNode
}

interface PortalLayoutProps {
  /** Portal title shown in topbar */
  title: string
  /** Menu items for aside */
  menuItems: MenuItem[]
  /** localStorage keys to clear on logout */
  storageKeys: string[]
  /** Route to redirect after logout */
  loginPath: string
  /** Child content */
  children: React.ReactNode
}

const PortalLayout: React.FC<PortalLayoutProps> = ({
  title,
  menuItems,
  storageKeys,
  loginPath,
  children,
}) => {
  const navigate = useNavigate()
  const [asideCollapsed, setAsideCollapsed] = useState(false)

  const handleLogout = () => {
    storageKeys.forEach((key) => localStorage.removeItem(key))
    navigate(loginPath)
  }

  return (
    <div className='portal-wrapper'>
      {/* Top Bar */}
      <div className='portal-topbar'>
        <div className='portal-topbar-left'>
          <button
            className='portal-menu-toggle'
            onClick={() => setAsideCollapsed(!asideCollapsed)}
            title={asideCollapsed ? 'Expand menu' : 'Collapse menu'}
          >
            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <line x1='3' y1='6' x2='21' y2='6' />
              <line x1='3' y1='12' x2='21' y2='12' />
              <line x1='3' y1='18' x2='21' y2='18' />
            </svg>
          </button>
          <img
            src={toAbsoluteUrl('/media/logos/kcc.webp')}
            alt='Career-9'
            className='portal-topbar-logo'
          />
          <span className='portal-topbar-title'>{title}</span>
        </div>
        <button className='portal-signout-btn' onClick={handleLogout}>
          Sign Out
        </button>
      </div>

      <div className='portal-body'>
        {/* Aside Menu */}
        <aside className={`portal-aside ${asideCollapsed ? 'collapsed' : ''}`}>
          <nav className='portal-aside-nav'>
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `portal-aside-item ${isActive ? 'active' : ''}`
                }
                title={item.label}
              >
                <span className='portal-aside-icon'>{item.icon}</span>
                <span className='portal-aside-label'>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className={`portal-content ${asideCollapsed ? 'expanded' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  )
}

export default PortalLayout
