import React from 'react'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../../portal/PortalLayout'
import { DashboardApiResponse, DashboardApiAssessmentData } from '../API/Dashboard_APIs'
import { STUDENT_MENU_ITEMS, STUDENT_STORAGE_KEYS } from './studentMenuConfig'
import './StudentPortal.css'

const ASSESSMENT_URL = 'https://assessment.career-9.com'

function getStatusStyle(status: string): { bg: string; text: string; label: string } {
  switch (status?.toLowerCase()) {
    case 'completed':
      return { bg: '#E8F5E9', text: '#2E7D32', label: 'Completed' }
    case 'ongoing':
      return { bg: '#FFF3E0', text: '#E65100', label: 'In Progress' }
    default:
      return { bg: '#E3F2FD', text: '#1565C0', label: 'Not Started' }
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

const StudentAssessments: React.FC = () => {
  const navigate = useNavigate()

  const dashStr = localStorage.getItem('studentPortalDashboard')
  const rawData: DashboardApiResponse | null = dashStr ? JSON.parse(dashStr) : null
  const assessments: DashboardApiAssessmentData[] = rawData?.assessments || []

  const handleAssessmentClick = () => {
    window.open(ASSESSMENT_URL, '_blank')
  }

  return (
    <PortalLayout
      title='Career Navigator 360'
      menuItems={STUDENT_MENU_ITEMS}
      storageKeys={STUDENT_STORAGE_KEYS}
      loginPath='/student/login'
    >
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
          My Assessments
        </h2>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
          View your allotted assessments and their completion status
        </p>
      </div>

      {assessments.length === 0 ? (
        <div className='sp-card' style={{ textAlign: 'center', padding: '48px 24px' }}>
          <svg width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='#B0BEC5' strokeWidth='1.5' style={{ marginBottom: 16 }}>
            <path d='M9 11l3 3L22 4'/>
            <path d='M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'/>
          </svg>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#455A64' }}>No assessments assigned yet</div>
          <div style={{ fontSize: 13, color: '#78909C', marginTop: 4 }}>
            Assessments will appear here once your school assigns them
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {assessments.map((a) => {
            const statusInfo = getStatusStyle(a.status)
            const isCompleted = a.status?.toLowerCase() === 'completed'
            const isOngoing = a.status?.toLowerCase() === 'ongoing'

            return (
              <div
                key={a.assessmentId}
                className='sp-card'
                style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}
              >
                {/* Status icon */}
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: statusInfo.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isCompleted ? (
                    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke={statusInfo.text} strokeWidth='2.5'>
                      <path d='M20 6L9 17l-5-5'/>
                    </svg>
                  ) : isOngoing ? (
                    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke={statusInfo.text} strokeWidth='2'>
                      <circle cx='12' cy='12' r='10'/><polyline points='12 6 12 12 16 14'/>
                    </svg>
                  ) : (
                    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke={statusInfo.text} strokeWidth='2'>
                      <circle cx='12' cy='12' r='10'/><line x1='12' y1='8' x2='12' y2='12'/><line x1='12' y1='16' x2='12.01' y2='16'/>
                    </svg>
                  )}
                </div>

                {/* Assessment info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>
                    {a.assessmentName || `Assessment #${a.assessmentId}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#78909C', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {a.startDate && <span>Start: {formatDate(a.startDate)}</span>}
                    {a.endDate && <span>End: {formatDate(a.endDate)}</span>}
                  </div>
                </div>

                {/* Status badge */}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: statusInfo.bg,
                    color: statusInfo.text,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {statusInfo.label}
                </span>

                {/* Action button */}
                {!isCompleted && (
                  <button
                    onClick={handleAssessmentClick}
                    style={{
                      padding: '8px 18px',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      background: isOngoing ? '#E65100' : '#263B6A',
                      color: '#fff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isOngoing ? 'Continue' : 'Start Assessment'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </PortalLayout>
  )
}

export default StudentAssessments
