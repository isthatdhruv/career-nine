import http from '../api/http'

export function getCampaignInfoBySlug(slug: string) {
  return http.get(`/campaign/public/info/${encodeURIComponent(slug)}`)
}

export function getCampaignInfoByAssessment(slug: string, assessmentId: number) {
  return http.get(`/campaign/public/info/${encodeURIComponent(slug)}/${assessmentId}`)
}

export function getCampaignInfoByTier(slug: string, assessmentId: number, tierMappingId: number) {
  return http.get(`/campaign/public/info/${encodeURIComponent(slug)}/${assessmentId}/${tierMappingId}`)
}

export function registerForCampaignTier(
  slug: string,
  assessmentId: number,
  tierMappingId: number,
  studentData: {
    name: string
    email: string
    dob: string
    phone?: string
    gender?: string
    promoCode?: string
  }
) {
  return http.post(
    `/campaign/public/register/${encodeURIComponent(slug)}/${assessmentId}/${tierMappingId}`,
    studentData,
  )
}

export function registerTrial(
  slug: string,
  assessmentId: number,
  studentData: {
    name: string
    email: string
    dob: string
    phone: string
    gender?: string
  }
) {
  return http.post(
    `/campaign/public/register-trial/${encodeURIComponent(slug)}/${assessmentId}`,
    studentData,
  )
}

export function getUpgradeInfo(entitlementId: number | string) {
  return http.get(`/campaign/public/upgrade-info/${entitlementId}`)
}

export function payForReport(body: {
  entitlementId: number | string
  campaignAssessmentTierId: number
  promoCode?: string
}) {
  return http.post('/campaign/public/pay-for-report', body)
}

/**
 * Asks the backend to pre-generate and cache the student's detailed report
 * so the next click on "Download Report" returns instantly. The endpoint
 * dispatches to the BET or Navigator generator based on
 * AssessmentTable.reportType + StudentInfo.studentClass (looked up server-side).
 *
 * Resolves with { status: "ready", reportType, reportUrl, studentClassUsed }
 * on success. Rejects (HTTP 500 body { status: "failed", logId }) on
 * generator failure; the failure is already logged to ReportGenerationLog
 * and surfaced on the admin B2C Tracker.
 */
export function prepareReport(
  entitlementId: number | string,
  accessToken: string,
  assessmentId: number | string,
) {
  return http.post('/bet-report-data/public/prepare', null, {
    params: { e: entitlementId, t: accessToken, assessmentId },
  })
}
