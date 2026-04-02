import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  getUnreadCount,
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../API/NotificationAPI'
import '../Counselling.css'

interface Notification {
  id: number
  title: string
  message: string
  read: boolean
  createdAt: string
}

interface NotificationBellProps {
  userId: number
}

function formatRelativeTime(isoString: string): string {
  const created = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

const NotificationBell: React.FC<NotificationBellProps> = ({ userId }) => {
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showDropdown, setShowDropdown] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchUnreadCount = useCallback(() => {
    getUnreadCount(userId)
      .then((res) => {
        const count = typeof res.data === 'number' ? res.data : (res.data?.count ?? 0)
        setUnreadCount(count)
      })
      .catch(() => {
        // silently ignore polling errors
      })
  }, [userId])

  // Poll unread count every 30 seconds
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showDropdown])

  const handleBellClick = () => {
    if (!showDropdown) {
      setLoading(true)
      getMyNotifications(userId)
        .then((res) => {
          const data: Notification[] = Array.isArray(res.data) ? res.data : []
          setNotifications(data)
        })
        .catch(() => {
          setNotifications([])
        })
        .finally(() => setLoading(false))
    }
    setShowDropdown((prev) => !prev)
  }

  const handleMarkRead = (notif: Notification) => {
    if (notif.read) return
    markNotificationRead(notif.id)
      .then(() => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      })
      .catch(() => {
        // silently ignore
      })
  }

  const handleMarkAllRead = () => {
    markAllNotificationsRead(userId)
      .then(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        setUnreadCount(0)
      })
      .catch(() => {
        // silently ignore
      })
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={dropdownRef}>
      <button className="cl-notif-bell" onClick={handleBellClick} aria-label="Notifications">
        {/* Bell SVG icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="cl-notif-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="cl-notif-dropdown">
          <div className="cl-notif-dropdown-header">
            <h4>Notifications</h4>
            {notifications.some((n) => !n.read) && (
              <button onClick={handleMarkAllRead}>Mark all read</button>
            )}
          </div>

          <div className="cl-notif-list">
            {loading ? (
              <div className="cl-notif-empty">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="cl-notif-empty">No notifications</div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`cl-notif-item${notif.read ? '' : ' unread'}`}
                  onClick={() => handleMarkRead(notif)}
                >
                  <div className="cl-notif-item-title">{notif.title}</div>
                  <div className="cl-notif-item-message">{notif.message}</div>
                  <div className="cl-notif-item-time">
                    {formatRelativeTime(notif.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
