import React, { useState, useMemo } from 'react'
import {
  getVisibleReportsForStudent,
  GeneratedReport,
} from '../../ReportGeneration/API/GeneratedReport_APIs'
import { useAutoRefresh } from '../../../utils/useAutoRefresh'
import { useAuth } from '../../../modules/auth/core/Auth'
import { useStudentData } from './StudentDataContext'
import { showErrorToast } from '../../../utils/toast'
import './StudentPortal.css'

function getReportLabel(type: string): string {
  switch (type) {
    case 'navigator':
    case 'pager': return 'Navigator 360 Report'
    case 'bet': return 'BET Report'
    case 'legacy': return 'Assessment Report'
    default: return type.charAt(0).toUpperCase() + type.slice(1) + ' Report'
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

const safeName = (s: string) =>
  (s || 'report').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')

const StudentReports: React.FC = () => {
  const { currentUser } = useAuth()
  // Assessment names come from the once-at-login bootstrap, so we can label each
  // report with the assessment it belongs to (no extra request).
  const { data: studentData } = useStudentData()
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const userStudentId = useMemo<number | null>(() => {
    const u = currentUser as any
    return (u?.userStudentId as number | undefined) ?? null
  }, [currentUser])

  const assessmentName = useMemo<Map<number, string>>(() => {
    const m = new Map<number, string>()
    ;(studentData.assessments || []).forEach((a: any) => {
      if (a?.assessmentId != null && a?.assessmentName) m.set(a.assessmentId, a.assessmentName)
    })
    return m
  }, [studentData])

  // Visibility gate is preserved: only reports an admin has released to the
  // student (visibleToStudent=true) are returned by this endpoint.
  const { data, loading } = useAutoRefresh<GeneratedReport[]>(
    async () => {
      if (!userStudentId) return []
      const res = await getVisibleReportsForStudent(userStudentId)
      return (res.data || []).filter((r) => r.reportStatus === 'generated' && r.reportUrl)
    },
    { skip: !userStudentId }
  )
  const reports = data ?? []

  // Preview = open the HTML report (DigitalOcean Spaces) in a new tab.
  const handlePreview = (url: string | null) => {
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Download = fetch the stored PDF straight from Spaces and save it — exactly like
  // the Reports Hub Generate modal (downloadUrlAsFile). No client-side rendering: the
  // server-rendered pdf_url is the canonical file. A cross-origin <a download> is
  // ignored by browsers, so we go through a blob (bucket CORS allows GET).
  const handleDownload = async (r: GeneratedReport, label: string) => {
    if (!r.pdfUrl) { showErrorToast('PDF is not available for this report'); return }
    setDownloadingId(r.generatedReportId)
    try {
      const res = await fetch(r.pdfUrl)
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeName(label)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      showErrorToast('Download failed — try Preview to open the report directly')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <>
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
            const title = assessmentName.get(r.assessmentId) || `Assessment ${r.assessmentId}`
            const isDownloading = downloadingId === r.generatedReportId
            // Downloadable only when the server-rendered PDF exists in Spaces. If
            // pdf_url is missing the PDF render failed/hasn't run — Preview (HTML)
            // still works. Same gate as the Reports Hub Generate modal.
            const canDownload = !!r.pdfUrl
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
                    background: '#e8f5ee',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='#1a6b3c' strokeWidth='2'>
                    <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/>
                    <polyline points='14 2 14 8 20 8'/>
                  </svg>
                </div>

                {/* Report info — which assessment this report is for */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>
                    {title}
                  </div>
                  <div style={{ fontSize: 12, color: '#78909C', marginTop: 3 }}>
                    {getReportLabel(r.typeOfReport)}
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
                    onClick={() => handlePreview(r.reportUrl)}
                    style={{
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 8,
                      border: '1px solid rgba(40,160,90,0.35)',
                      cursor: 'pointer',
                      background: '#fff',
                      color: '#1a6b3c',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => handleDownload(r, title)}
                    disabled={!canDownload || isDownloading}
                    title={!canDownload ? 'PDF not available for this report' : 'Download PDF'}
                    style={{
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 8,
                      border: 'none',
                      cursor: !canDownload || isDownloading ? 'not-allowed' : 'pointer',
                      background: !canDownload || isDownloading ? '#c2cdd6' : '#1a6b3c',
                      color: '#fff',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                    }}
                  >
                    {isDownloading && (
                      <span
                        style={{
                          width: 13,
                          height: 13,
                          border: '2px solid rgba(255,255,255,0.45)',
                          borderTopColor: '#fff',
                          borderRadius: '50%',
                          display: 'inline-block',
                          animation: 'sp-spin 0.6s linear infinite',
                        }}
                      />
                    )}
                    {isDownloading ? 'Downloading…' : 'Download'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`@keyframes sp-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}

export default StudentReports
