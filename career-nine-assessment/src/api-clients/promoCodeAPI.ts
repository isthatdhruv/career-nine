import http from '../api/http'

export function validatePromoCode(code: string) {
  return http.post('/promo-codes/public/validate', { code })
}
