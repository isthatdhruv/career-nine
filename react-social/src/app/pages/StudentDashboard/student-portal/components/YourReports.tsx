import React, { useState } from 'react'

interface YourReportsProps {
  userStudentId: number
  onDownloadFullReport?: () => void
  onDownloadSummary?: () => void
  onShareWithParents?: () => void
}

const YourReports: React.FC<YourReportsProps> = ({
  userStudentId,
  onDownloadFullReport,
  onDownloadSummary,
  onShareWithParents,
}) => {
  const [loadingReport, setLoadingReport] = useState<string | null>(null)

  const handleAction = async (action: string, handler?: () => void) => {
    setLoadingReport(action)
    try {
      if (handler) {
        handler()
      } else {
        alert('This feature is coming soon!')
      }
    } finally {
      setTimeout(() => setLoadingReport(null), 500)
    }
  }

  return (
    <div className='sp-card'>
      <div className='sp-card-title'>Your Reports</div>

      <div className='sp-report-item'>
        <div className='sp-report-title'>Navigator 360 Full Report</div>
        <div className='sp-report-desc'>Complete 6-pillar profile &middot; Career matches &middot; Action plan</div>
        <button
          className='sp-report-btn sp-report-btn-primary'
          disabled={loadingReport === 'full'}
          onClick={() => handleAction('full', onDownloadFullReport)}
        >
          {loadingReport === 'full' ? (
            <span>
              Generating...
              <span className='spinner-border spinner-border-sm ms-2' style={{ width: '14px', height: '14px' }} />
            </span>
          ) : (
            'Download Full Report'
          )}
        </button>
      </div>

      <div className='sp-report-item'>
        <div className='sp-report-title'>Career Clarity Summary (1 page)</div>
        <div className='sp-report-desc'>Top 3 careers &middot; Key strengths &middot; 30-day actions</div>
        <button
          className='sp-report-btn sp-report-btn-outline'
          disabled={loadingReport === 'summary'}
          onClick={() => handleAction('summary', onDownloadSummary)}
        >
          {loadingReport === 'summary' ? (
            <span>
              Generating...
              <span className='spinner-border spinner-border-sm ms-2' style={{ width: '14px', height: '14px' }} />
            </span>
          ) : (
            'Download Summary'
          )}
        </button>
      </div>

      <div className='sp-report-item'>
        <div className='sp-report-title'>Share with Parents</div>
        <div className='sp-report-desc'>Parent-friendly version with next steps</div>
        <button
          className='sp-report-btn sp-report-btn-share'
          disabled={loadingReport === 'share'}
          onClick={() => handleAction('share', onShareWithParents)}
        >
          {loadingReport === 'share' ? (
            <span>
              Sending...
              <span className='spinner-border spinner-border-sm ms-2' style={{ width: '14px', height: '14px' }} />
            </span>
          ) : (
            'Share with Parents'
          )}
        </button>
      </div>
    </div>
  )
}

export default YourReports
