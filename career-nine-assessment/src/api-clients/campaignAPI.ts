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
