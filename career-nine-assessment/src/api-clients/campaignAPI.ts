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

/**
 * Magic-link redemption for the welcome-email flow. Validates the access
 * token, issues the cn_at_asmnt cookie via Set-Cookie, and returns the
 * session payload (userStudentId, assessments, campaign slug) so the SPA can
 * skip straight to /allotted-assessment.
 */
export function redeemAssessmentStartToken(token: string, entitlementId: string | number) {
  return http.post('/entitlement/redeem-token', { token, entitlementId })
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

/**
 * Lists available counselling slots for the entitlement's student, filtered to
 * counsellors allocated to their institute. Token-validated; safe to call from
 * the assessment app without a session cookie. `from` is yyyy-MM-dd; defaults
 * to today server-side. Returns up to one week's worth of slots from that date.
 */
export function listCounsellingSlots(body: {
  token: string
  entitlementId: number | string
  from?: string
}) {
  return http.post('/campaign/public/counselling/slots', body)
}

/**
 * Books a slot returned by listCounsellingSlots. Backend decrements the
 * entitlement's counsellingSessionsUsed in the same transaction as the slot
 * transition, so seat exhaustion is honoured under concurrent clicks.
 */
export function bookCounsellingSlot(body: {
  token: string
  entitlementId: number | string
  slotId: number
  reason?: string
}) {
  return http.post('/campaign/public/counselling/book', body)
}
