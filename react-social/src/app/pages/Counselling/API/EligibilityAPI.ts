import axios from 'axios'

const API_URL = process.env.REACT_APP_API_URL

export interface EligibilityPayload {
  planId?: number
  planName?: string
  sessionsRemaining?: number
  endDate?: string
  instituteName?: string
  paymentId?: number
  sessionsPurchased?: number
  paidAt?: string
  message?: string
  hasReport?: boolean
}

export interface EligibilityResponse {
  track: 'EVENT' | 'PAID' | 'REPORT' | 'REPORT_PENDING' | 'NO_ASSESSMENT'
  action: 'BOOK_COUNSELLING' | 'PAY_FOR_COUNSELLING' | 'WAIT_FOR_REPORT' | 'TAKE_ASSESSMENT'
  payload: EligibilityPayload
}

export function getStudentEligibility(studentId: number) {
  return axios.get<EligibilityResponse>(`${API_URL}/api/counselling/eligibility/${studentId}`)
}
