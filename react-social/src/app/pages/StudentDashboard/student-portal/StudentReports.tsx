import React, { useState, useEffect } from 'react'
import PortalLayout from '../../portal/PortalLayout'
import {
  getVisibleReportsForStudent,
  GeneratedReport,
} from '../../ReportGeneration/API/GeneratedReport_APIs'
import { STUDENT_MENU_ITEMS, STUDENT_STORAGE_KEYS } from './studentMenuConfig'
import './StudentPortal.css'

function getReportLabel(type: string): string {
  switch (type) {
    case 'navigator': return 'Navigator 360 Report'
    case 'bet': return 'BET Report'
    default: return type.charAt(0).toUpperCase() + type.slice(1) + ' Report'
  }
}

function getReportDescription(type: string): string {
  switch (type) {
    case 'navigator': return 'Complete 6-pillar career profile with career matches & action plan'
    case 'bet': return 'Behavioral, Emotional & Thinking assessment insights'
    default: return 'Assessment report'
  }
}

function getReportIcon(type: string): { bg: string; color: string } {
  switch (type) {
    case 'navigator': return { bg: '#E8F5E9', color: '#2E7D32' }
    case 'bet': return { bg: '#E3F2FD', color: '#1565C0' }
    default: return { bg: '#FFF3E0', color: '#E65100' }
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

const StudentReports: React.FC = () => {
  const [reports, setReports] = useState<GeneratedReport[]>([])
  const [loading, setLoading] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    const profileStr = localStorage.getItem('studentPortalProfile')
    if (!profileStr) {
      setLoading(false)
      return
    }
    try {
      const profile = JSON.parse(profileStr)
      const userStudentId = profile.userStudentId
      if (!userStudentId) {
        setLoading(false)
        return
      }
      getVisibleReportsForStudent(userStudentId)
        .then((res) => {
          const visible = (res.data || []).filter(
            (r) => r.reportStatus === 'generated' && r.reportUrl
          )
          setReports(visible)
        })
        .catch(() => setReports([]))
        .finally(() => setLoading(false))
    } catch {
      setLoading(false)
    }
  }, [])

  const handleDownload = (url: string) => {
    window.open(url, '_blank')
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
          My Reports
        </h2>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
          View, preview and download your career assessment reports
        </p>
      </div>

      {loading ? (
        <div className='sp-card' style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 14, color: '#78909C' }}>Loading reports...</div>
        </div>
      ) : reports.length === 0 ? (
        <div className='sp-card' style={{ textAlign: 'center', padding: '48px 24px' }}>
          <svg width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='#B0BEC5' strokeWidth='1.5' style={{ marginBottom: 16 }}>
            <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/>
            <polyline points='14 2 14 8 20 8'/>
          </svg>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#455A64' }}>No reports available yet</div>
          <div style={{ fontSize: 13, color: '#78909C', marginTop: 4 }}>
            Your reports will appear here once they have been generated and released
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reports.map((r) => {
            const icon = getReportIcon(r.typeOfReport)
            return (
              <div
                key={r.generatedReportId}
                className='sp-card'
                style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}
              >
                {/* Report type icon */}
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: icon.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke={icon.color} strokeWidth='2'>
                    <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/>
                    <polyline points='14 2 14 8 20 8'/>
                  </svg>
                </div>

                {/* Report info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>
                    {getReportLabel(r.typeOfReport)}
                  </div>
                  <div style={{ fontSize: 12, color: '#78909C', marginTop: 3 }}>
                    {getReportDescription(r.typeOfReport)}
                    {r.updatedAt && (
                      <span style={{ marginLeft: 8, color: '#B0BEC5' }}>
                        &middot; {formatDate(r.updatedAt)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => setPreviewUrl(r.reportUrl)}
                    style={{
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 8,
                      border: '1px solid #DDE3EC',
                      cursor: 'pointer',
                      background: '#fff',
                      color: '#455A64',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => handleDownload(r.reportUrl!)}
                    style={{
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      background: '#263B6A',
                      color: '#fff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Download
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Preview modal */}
      {previewUrl && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setPreviewUrl(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              width: '100%',
              maxWidth: 900,
              height: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 48px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                borderBottom: '1px solid #E5E7EB',
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A' }}>Report Preview</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleDownload(previewUrl)}
                  style={{
                    padding: '6px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    background: '#263B6A',
                    color: '#fff',
                  }}
                >
                  Download
                </button>
                <button
                  onClick={() => setPreviewUrl(null)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 18,
                    fontWeight: 400,
                    borderRadius: 8,
                    border: '1px solid #DDE3EC',
                    cursor: 'pointer',
                    background: '#fff',
                    color: '#6B7280',
                    lineHeight: 1,
                  }}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* iframe preview */}
            <iframe
              src={previewUrl}
              title='Report Preview'
              style={{
                flex: 1,
                border: 'none',
                width: '100%',
              }}
            />
          </div>
        </div>
      )}
    </PortalLayout>
  )
}

export default StudentReports
