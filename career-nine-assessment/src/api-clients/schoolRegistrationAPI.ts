import http from '../api/http'

/**
 * Public school-registration endpoints (B2B "School Level" flow).
 *
 * These mirror react-social's SchoolRegistration_APIs.ts public section exactly
 * — same backend routes under /school-registration/public/** — so the page
 * behaves identically after the migration from the dashboard app to this SPA.
 * They go through the shared `http` instance: the /public/ path is in
 * PUBLIC_ENDPOINT_PATTERNS, so a stale cn_at_asmnt cookie surfacing as 401/403
 * bubbles to the page instead of redirecting to /permission-denied.
 */

/**
 * One class row of `GET /school-registration/public/info/{token}`. Only the
 * fields this SPA needs to type are declared; the payload carries more
 * (sections, amount, assessmentId/Name, …) and the page reads it loosely.
 */
export type SchoolPublicClassConfig = {
  classId: number
  className?: string
  /** true → this class is an 18+ cohort: self-consent wording and "Your Email/Phone" labels. */
  audience18Plus?: boolean | null
}

export type SchoolPublicInfo = {
  /** false → college (Year/Course wording); true/absent → school (Class/Board). */
  isSchool?: boolean | null
  classes?: SchoolPublicClassConfig[]
}

export function getSchoolInfo(token: string) {
  return http.get<SchoolPublicInfo>(`/school-registration/public/info/${token}`)
}

export function verifyStudentDetails(
  token: string,
  body: { email: string; phone: string; dob: string }
) {
  return http.post(`/school-registration/public/verify-details/${token}`, body)
}

export function registerSchoolStudent(
  token: string,
  studentData: {
    name: string
    email: string
    dob: string
    phone: string
    gender: string
    classId: number
    schoolSectionId?: number
    promoCode?: string
    referralCode?: string
    /** DPDP parental consent given on the form; the backend stamps dpdp_consent_at from it. */
    dpdpConsent?: boolean
  }
) {
  return http.post(`/school-registration/public/register/${token}`, studentData)
}
