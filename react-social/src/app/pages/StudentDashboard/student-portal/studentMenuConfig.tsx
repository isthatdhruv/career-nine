import React from 'react'
import { MenuItem } from '../../portal/PortalLayout'

export const STUDENT_MENU_ITEMS: MenuItem[] = [
  {
    label: 'Dashboard',
    path: '/student/dashboard',
    icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><rect x='3' y='3' width='7' height='7' rx='1'/><rect x='14' y='3' width='7' height='7' rx='1'/><rect x='3' y='14' width='7' height='7' rx='1'/><rect x='14' y='14' width='7' height='7' rx='1'/></svg>,
  },
  {
    label: 'Navigator 360',
    path: '/student/navigator-360',
    icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><circle cx='12' cy='12' r='10'/><path d='M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z'/></svg>,
  },
  {
    label: 'Assessments',
    path: '/student/assessments',
    icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M9 11l3 3L22 4'/><path d='M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'/></svg>,
  },
  {
    label: 'My Reports',
    path: '/student/reports',
    icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><polyline points='14 2 14 8 20 8'/><line x1='16' y1='13' x2='8' y2='13'/><line x1='16' y1='17' x2='8' y2='17'/></svg>,
  },
  {
    label: 'Counselling',
    path: '/student/counselling',
    icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/></svg>,
  },
]

export const STUDENT_STORAGE_KEYS = ['studentPortalProfile', 'studentPortalDashboard', 'studentPortalLoggedIn']
