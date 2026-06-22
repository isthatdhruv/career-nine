import http from '../api/http'

/**
 * Validate a referral code for a specific assessment. The backend checks the
 * code exists, is active, not expired, not at its usage cap, and is mapped to
 * this assessment. Returns { code, name, valid } on success.
 */
export function validateReferralCode(code: string, assessmentId: number) {
  return http.post('/referral-codes/public/validate', { code, assessmentId })
}
