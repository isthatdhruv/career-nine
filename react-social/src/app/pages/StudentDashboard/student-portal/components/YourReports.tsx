import React, { useState, useEffect } from 'react'
import { showSuccessToast, showErrorToast } from '../../../../utils/toast'
import {
  getGeneratedReportsByStudent,
  GeneratedReport,
} from '../../../ReportGeneration/API/GeneratedReport_APIs'

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
  const [reports, setReports] = useState<GeneratedReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userStudentId) return
    setLoading(true)
    getGeneratedReportsByStudent(userStudentId)
      .then((res) => setReports(res.data || []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false))
  }, [userStudentId])

  const handleAction = async (action: string, handler?: () => void) => {
    setLoadingReport(action)
    try {
      if (handler) {
        handler()
      } else {
        showSuccessToast('This feature is coming soon!')
      }
    } finally {
      setTimeout(() => setLoadingReport(null), 500)
    }
  }

  const navigatorReport = reports.find(
    (r) => r.typeOfReport === 'navigator' && r.reportStatus === 'generated'
  )
  const betReport = reports.find(
    (r) => r.typeOfReport === 'bet' && r.reportStatus === 'generated'
  )

  const handleDownload = (report: GeneratedReport | undefined, label: string) => {
    if (!report?.reportUrl) {
      showErrorToast(`${label} report is not yet generated.`)
      return
    }
    window.open(report.reportUrl, '_blank')
  }

  return (
    <div className='sp-card'>
      <div className='sp-card-title'>Your Reports</div>

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
          Loading reports...
        </div>
      ) : (
        <>
          <div className='sp-report-item'>
            <div className='sp-report-title'>Navigator 360 Full Report</div>
            <div className='sp-report-desc'>Complete 6-pillar profile &middot; Career matches &middot; Action plan</div>
            <button
              className='sp-report-btn sp-report-btn-primary'
              disabled={loadingReport === 'full' || !navigatorReport}
              onClick={() => {
                if (onDownloadFullReport) {
                  handleAction('full', onDownloadFullReport)
                } else {
                  handleDownload(navigatorReport, 'Navigator')
                }
              }}
            >
              {loadingReport === 'full' ? (
                <span>
                  Generating...
                  <span className='spinner-border spinner-border-sm ms-2' style={{ width: '14px', height: '14px' }} />
                </span>
              ) : navigatorReport ? (
                'Download Full Report'
              ) : (
                'Not Yet Generated'
              )}
            </button>
          </div>

          <div className='sp-report-item'>
            <div className='sp-report-title'>BET Report</div>
            <div className='sp-report-desc'>Behavioral &middot; Emotional &middot; Thinking assessment report</div>
            <button
              className='sp-report-btn sp-report-btn-outline'
              disabled={loadingReport === 'bet' || !betReport}
              onClick={() => handleDownload(betReport, 'BET')}
            >
              {loadingReport === 'bet' ? (
                <span>
                  Generating...
                  <span className='spinner-border spinner-border-sm ms-2' style={{ width: '14px', height: '14px' }} />
                </span>
              ) : betReport ? (
                'Download BET Report'
              ) : (
                'Not Yet Generated'
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
        </>
      )}
    </div>
  )
}

export default YourReports
