import http from '../api/http'

export function validatePromoCode(code: string, campaignId?: number) {
  const body: { code: string; campaignId?: number } = { code }
  if (campaignId != null) body.campaignId = campaignId
  return http.post('/promo-codes/public/validate', body)
}
