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
}

export const STANDARD_BRANDING: StudentBranding = { whitelabel: false }

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
 * Survives mid-assessment reloads because the id lives in localStorage. Falls back
 * to standard Career-9 on any error or when no student id is present.
 */
export function useStudentBranding(): StudentBranding {
  const [branding, setBranding] = useState<StudentBranding>(STANDARD_BRANDING)

  useEffect(() => {
    const id = localStorage.getItem('userStudentId')
    if (!id) return
    let cancelled = false
    http
      .get(`/assessments/branding/${id}`)
      .then((res) => {
        if (!cancelled && res?.data) setBranding(res.data as StudentBranding)
      })
      .catch(() => {
        /* keep standard Career-9 branding on error */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return branding
}
