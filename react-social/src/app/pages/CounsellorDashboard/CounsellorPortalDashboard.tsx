import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toAbsoluteUrl } from '../../../_metronic/helpers'
import PortalLayout, { MenuItem } from '../portal/PortalLayout'
import StudentListPanel from './components/StudentListPanel'
import StudentProfileCard from './components/StudentProfileCard'
import AppointmentCalendar from './components/AppointmentCalendar'
import SessionNotes from './components/SessionNotes'
import MessagesPanel from './components/MessagesPanel'
import { getCounsellorByUserId } from '../Counselling/API/CounsellorAPI'
import './CounsellorPortal.css'

const COUNSELLOR_MENU_ITEMS: MenuItem[] = [
  {
    label: 'Dashboard',
    path: '/counsellor/dashboard',
    icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><rect x='3' y='3' width='7' height='7' rx='1'/><rect x='14' y='3' width='7' height='7' rx='1'/><rect x='3' y='14' width='7' height='7' rx='1'/><rect x='14' y='14' width='7' height='7' rx='1'/></svg>,
  },
  {
    label: 'Students',
    path: '/counsellor/students',
    icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M23 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/></svg>,
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
    label: 'Messages',
    path: '/counsellor/messages',
    icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/></svg>,
  },
  {
    label: 'Reports',
    path: '/counsellor/reports',
    icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><line x1='18' y1='20' x2='18' y2='10'/><line x1='12' y1='20' x2='12' y2='4'/><line x1='6' y1='20' x2='6' y2='14'/></svg>,
  },
]

const COUNSELLOR_STORAGE_KEYS = ['counsellorPortalToken', 'counsellorPortalUser', 'counsellorPortalLoggedIn']

const CounsellorPortalDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [counsellorId, setCounsellorId] = useState<number | null>(null)
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)

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
        // Resolve counsellorId from user
        if (parsedUser.id) {
          getCounsellorByUserId(parsedUser.id)
            .then((res) => setCounsellorId(res.data?.id || null))
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
        <div>
          <h2 className='cp-welcome-title'>
            Welcome, {user?.name || 'Counsellor'}
          </h2>
          <p className='cp-welcome-sub'>
            {user?.organisation || 'Career-9'} &middot; Counsellor Dashboard
          </p>
        </div>
      </div>

      {/* Main Layout: Student List + Detail */}
      <div className='cp-layout'>
        <StudentListPanel
          counsellorId={counsellorId}
          selectedStudentId={selectedStudentId}
          onSelectStudent={setSelectedStudentId}
        />

        <div className='cp-detail'>
          {selectedStudentId ? (
            <StudentProfileCard studentId={selectedStudentId} />
          ) : (
            <div className='cp-empty-state'>
              <svg width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='#6B7A8D' strokeWidth='1.5'>
                <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
                <circle cx='9' cy='7' r='4' />
              </svg>
              <p>Select a student from the list to view their profile</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Calendar + Notes + Messages */}
      <div className='cp-grid-3'>
        <AppointmentCalendar counsellorId={counsellorId} />
        <SessionNotes counsellorId={counsellorId} />
        <MessagesPanel />
      </div>
    </PortalLayout>
  )
}

export default CounsellorPortalDashboard
