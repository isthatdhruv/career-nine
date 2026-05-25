import { useState } from "react"

type Tier = { campaignAssessmentTierId: number; pricingTierId: number; name?: string }
type AssessmentBlock = {
  assessmentId: number
  assessmentName: string
  tiers: Tier[]
}

export type RegistrationLinksProps = {
  slug: string
  assessments: AssessmentBlock[]
}

const ASSESSMENT_DOMAIN =
  process.env.REACT_APP_ASSESSMENT_APP_URL || "https://assessment.career-9.com"

const RegistrationLinks = ({ slug, assessments }: RegistrationLinksProps) => {
  const [copied, setCopied] = useState<string>("")

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => { setCopied(label); setTimeout(() => setCopied(""), 1500) },
      () => window.prompt("Copy this link:", text),
    )
  }

  const campaignUrl = `${ASSESSMENT_DOMAIN}/c/${slug}`
  return (
    <div className="card mt-4">
      <div className="card-body">
        <h5 className="mb-2">Public Registration Links</h5>
        <p className="text-muted small">
          Share these URLs to drive students to register and pay.
        </p>

        <div className="mb-3">
          <label className="form-label fw-bold">Campaign-wide link</label>
          <div className="d-flex gap-2 align-items-center">
            <code className="flex-grow-1 p-2 bg-light rounded">{campaignUrl}</code>
            <button className="btn btn-sm btn-outline-primary"
                    onClick={() => copy(campaignUrl, "campaign")}>
              {copied === "campaign" ? "Copied" : "Copy"}
            </button>
          </div>
          <small className="text-muted">Shows all assessments and tiers in this campaign.</small>
        </div>

        {assessments.length > 0 && (
          <>
            <h6 className="mt-3">Per-assessment & per-tier links</h6>
            {assessments.map((a) => {
              const aUrl = `${ASSESSMENT_DOMAIN}/c/${slug}/${a.assessmentId}`
              return (
                <div key={a.assessmentId} className="border rounded p-3 mb-3">
                  <div className="fw-bold mb-2">{a.assessmentName}</div>

                  <div className="mb-2">
                    <small className="text-muted">Assessment-only link (shows tier picker):</small>
                    <div className="d-flex gap-2 align-items-center mt-1">
                      <code className="flex-grow-1 p-2 bg-light rounded">{aUrl}</code>
                      <button className="btn btn-sm btn-outline-primary"
                              onClick={() => copy(aUrl, `a-${a.assessmentId}`)}>
                        {copied === `a-${a.assessmentId}` ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  {a.tiers.length > 0 && (
                    <div>
                      <small className="text-muted">Per-tier deep links:</small>
                      {a.tiers.map((t) => {
                        const tUrl = `${ASSESSMENT_DOMAIN}/c/${slug}/${a.assessmentId}/${t.campaignAssessmentTierId}`
                        const key = `t-${t.campaignAssessmentTierId}`
                        return (
                          <div key={t.campaignAssessmentTierId} className="d-flex gap-2 align-items-center mt-1">
                            <span className="text-muted me-2" style={{ minWidth: 100 }}>
                              {t.name || `Tier #${t.pricingTierId}`}
                            </span>
                            <code className="flex-grow-1 p-2 bg-light rounded">{tUrl}</code>
                            <button className="btn btn-sm btn-outline-primary"
                                    onClick={() => copy(tUrl, key)}>
                              {copied === key ? "Copied" : "Copy"}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

export default RegistrationLinks
