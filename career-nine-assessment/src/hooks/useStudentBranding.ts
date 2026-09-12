import { useEffect, useState } from 'react'
import http from '../api/http'

/**
 * Per-school whitelabel branding for the logged-in student. Mirrors the backend
 * BrandingDto. `whitelabel` is the single gate the UI checks; `schoolName`/`logoUrl`
 * are populated only when whitelabel is effective.
 */
export interface StudentBranding {
  whitelabel: boolean
  schoolName?: string | null
  logoUrl?: string | null
  /**
   * The assessment's admin "Email report" toggle, resolved live by the backend when
   * the current assessmentId is known. Together with `whitelabel` it decides whether
   * the thank-you page may say the report was emailed (see reportEmailedNotice.ts).
   */
  emailReportEnabled?: boolean
}

export const STANDARD_BRANDING: StudentBranding = { whitelabel: false }

/** Branding plus whether the request has settled (success, error, or no student id). */
export interface StudentBrandingState extends StudentBranding {
  loaded: boolean
}

/** Career-9 default logo, shown whenever a school logo isn't in effect. */
export const CAREER9_LOGO = '/media/logos/kcc.webp'

/** The logo to render for a given branding: school logo when whitelabel, else Career-9. */
export function brandLogoSrc(branding?: StudentBranding | null): string {
  const url = branding?.logoUrl
  // Only honour http(s) URLs (defends against javascript:/data: in an img src).
  const safe = !!url && /^https?:\/\//i.test(url)
  return branding?.whitelabel && safe ? (url as string) : CAREER9_LOGO
}

/**
 * Fetch whitelabel branding for the logged-in student (keyed by the localStorage
 * `userStudentId`). Used by the assessment legend + thank-you page to swap the
 * Career-9 logo for the school logo when the student's institute is whitelabel.
 * Passes the localStorage `assessmentId` (when present) so the response also carries
 * that assessment's "Email report" toggle. Survives mid-assessment reloads because the
 * ids live in localStorage. Falls back to standard Career-9 on any error or when no
 * student id is present; `loaded` flips true in every case once the answer is known.
 */
export function useStudentBranding(): StudentBrandingState {
  const [branding, setBranding] = useState<StudentBrandingState>(() => ({
    ...STANDARD_BRANDING,
    // No student id → nothing to fetch, so the standard branding is already the answer.
    loaded: !localStorage.getItem('userStudentId'),
  }))

  useEffect(() => {
    const id = localStorage.getItem('userStudentId')
    if (!id) return
    const assessmentId = localStorage.getItem('assessmentId')
    let cancelled = false
    http
      .get(`/assessments/branding/${id}`, { params: assessmentId ? { assessmentId } : undefined })
      .then((res) => {
        if (cancelled) return
        const data = (res?.data as StudentBranding | undefined) || STANDARD_BRANDING
        setBranding({ ...data, loaded: true })
      })
      .catch(() => {
        /* keep standard Career-9 branding on error */
        if (!cancelled) setBranding({ ...STANDARD_BRANDING, loaded: true })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return branding
}
