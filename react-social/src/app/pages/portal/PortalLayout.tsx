import React from 'react'

export interface MenuItem {
  label: string
  path: string
  icon: React.ReactNode
  /** When set, the item renders as an external link opening in a new tab,
   * instead of an in-app NavLink. `path` is still used as the React key. */
  externalHref?: string
}

interface PortalLayoutProps {
  /** Portal title (no longer rendered — kept for call-site compatibility). */
  title?: string
  /** Menu items (no longer rendered — the unified admin sidebar handles nav). */
  menuItems?: MenuItem[]
  /** localStorage keys to clear on logout (handled by the admin shell now). */
  storageKeys?: string[]
  /** Route to redirect after logout (handled by the admin shell now). */
  loginPath?: string
  /** Child content */
  children: React.ReactNode
}

/**
 * Phase: counsellor-portal unification. The counsellor pages now render INSIDE the
 * main admin shell (MasterLayout) — its sidebar/header/sign-out replace the old
 * standalone portal chrome. PortalLayout is therefore a thin pass-through that just
 * renders its children; the topbar/aside it used to draw are gone so we don't get a
 * second sidebar inside the admin layout. The `title`/`menuItems`/`storageKeys`/
 * `loginPath` props are accepted but ignored, so the existing call sites compile
 * unchanged. (The exported `MenuItem` type is still used by menu configs elsewhere.)
 */
const PortalLayout: React.FC<PortalLayoutProps> = ({ children }) => {
  return <>{children}</>
}

export default PortalLayout
