import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toAbsoluteUrl } from '../../../_metronic/helpers'
import PortalLayout, { MenuItem } from '../portal/PortalLayout'
import AppointmentCalendar from './components/AppointmentCalendar'
import SessionNotes from './components/SessionNotes'
import { getCounsellorByUserId } from '../Counselling/API/CounsellorAPI'
import './CounsellorPortal.css'

const COUNSELLOR_MENU_ITEMS: MenuItem[] = [
  {
    label: 'Dashboard',
    path: '/counsellor/dashboard',
    icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><rect x='3' y='3' width='7' height='7' rx='1'/><rect x='14' y='3' width='7' height='7' rx='1'/><rect x='3' y='14' width='7' height='7' rx='1'/><rect x='14' y='14' width='7' height='7' rx='1'/></svg>,
  },
  {
    label: 'Appointments',
    path: '/counsellor/appointments',
    icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><rect x='3' y='4' width='18' height='18' rx='2' ry='2'/><line x1='16' y1='2' x2='16' y2='6'/><line x1='8' y1='2' x2='8' y2='6'/><line x1='3' y1='10' x2='21' y2='10'/></svg>,
  },
  {
    label: 'Session Notes',
    path: '/counsellor/notes',
    icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/><path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/></svg>,
  },
  {
    label: 'Availability',
    path: '/counsellor/availability',
    icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><circle cx='12' cy='12' r='10'/><polyline points='12 6 12 12 16 14'/></svg>,
  },
  {
    label: 'Reports',
    path: '/counsellor/reports',
    icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><line x1='18' y1='20' x2='18' y2='10'/><line x1='12' y1='20' x2='12' y2='4'/><line x1='6' y1='20' x2='6' y2='14'/></svg>,
  },
  {
    label: 'My Profile',
    path: '/counsellor/profile',
    icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/></svg>,
  },
]

const COUNSELLOR_STORAGE_KEYS = ['counsellorPortalToken', 'counsellorPortalUser', 'counsellorPortalLoggedIn']

const CounsellorPortalDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [counsellorId, setCounsellorId] = useState<number | null>(null)
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('counsellorPortalLoggedIn')
    if (!isLoggedIn) {
      navigate('/counsellor/login')
      return
    }

    try {
      const userStr = localStorage.getItem('counsellorPortalUser')
      if (userStr) {
        const parsedUser = JSON.parse(userStr)
        setUser(parsedUser)

        // New login flow stores counsellorId directly
        const cId = parsedUser.counsellorId || null
        if (cId) {
          setCounsellorId(cId)
          import('../Counselling/API/CounsellorAPI').then(({ getCounsellorById }) => {
            getCounsellorById(cId)
              .then((res) => setProfileImageUrl(res.data?.profileImageUrl || null))
              .catch(() => {})
          })
        } else if (parsedUser.id) {
          getCounsellorByUserId(parsedUser.id)
            .then((res) => {
              setCounsellorId(res.data?.id || null)
              setProfileImageUrl(res.data?.profileImageUrl || null)
            })
            .catch(() => setCounsellorId(null))
        }
      }
    } catch {
      navigate('/counsellor/login')
    } finally {
      setLoading(false)
    }
  }, [navigate])


  if (loading) {
    return (
      <div className='cp-loading'>
        <img src={toAbsoluteUrl('/media/logos/kcc.jpg')} alt='Career-9' />
        <span className='cp-loading-text'>Loading ...</span>
      </div>
    )
  }

  return (
    <PortalLayout
      title='Counsellor Dashboard'
      menuItems={COUNSELLOR_MENU_ITEMS}
      storageKeys={COUNSELLOR_STORAGE_KEYS}
      loginPath='/counsellor/login'
    >
      {/* Welcome Header */}
      <div className='cp-welcome'>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', overflow: 'hidden',
              background: '#E8F5E9', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, border: '2px solid #D1E5DF',
            }}>
              {profileImageUrl ? (
                <img src={profileImageUrl} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 20, fontWeight: 700, color: '#0C6B5A' }}>
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              )}
            </div>
            <div>
              <h2 className='cp-welcome-title'>
                Welcome, {user?.name || 'Counsellor'}
              </h2>
              <p className='cp-welcome-sub'>
                {user?.organisation || 'Career-9'} &middot; Counsellor Dashboard
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Appointments + Session Notes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <AppointmentCalendar counsellorId={counsellorId} />
        <SessionNotes counsellorId={counsellorId} />
      </div>
    </PortalLayout>
  )
}

export default CounsellorPortalDashboard
