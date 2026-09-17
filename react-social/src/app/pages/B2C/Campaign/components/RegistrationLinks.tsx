import React, { useState } from "react"
import { sendCampaignLink } from "../../API/Campaign_APIs"
import { showErrorToast, showSuccessToast } from "../../../../utils/toast"

type Tier = { campaignAssessmentTierId: number; pricingTierId: number; name?: string }
type AssessmentBlock = {
  assessmentId: number
  assessmentName: string
  tiers: Tier[]
}

export type RegistrationLinksProps = {
  campaignId: number
  slug: string
  assessments: AssessmentBlock[]
}

/** Which link the Send modal is open for. The ids go to the backend; the rest is display. */
type SendTarget = {
  url: string
  label: string
  assessmentId?: number
  campaignAssessmentTierId?: number
}

const ASSESSMENT_DOMAIN =
  process.env.REACT_APP_ASSESSMENT_APP_URL || "https://assessment.career-9.com"

const RegistrationLinks = ({ campaignId, slug, assessments }: RegistrationLinksProps) => {
  const [copied, setCopied] = useState<string>("")
  const [target, setTarget] = useState<SendTarget | null>(null)

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => { setCopied(label); setTimeout(() => setCopied(""), 1500) },
      () => window.prompt("Copy this link:", text),
    )
  }

  const campaignUrl = `${ASSESSMENT_DOMAIN}/c/${slug}`

  /** Copy + Send, rendered identically wherever a link is shown. */
  const actions = (url: string, key: string, t: SendTarget) => (
    <>
      <button className="btn btn-sm btn-outline-primary" onClick={() => copy(url, key)}>
        {copied === key ? "Copied" : "Copy"}
      </button>
      <button className="btn btn-sm btn-outline-primary" onClick={() => setTarget(t)}>
        Send
      </button>
    </>
  )

  return (
    <div className="card mt-4">
      <div className="card-body">
        <h5 className="mb-2">Public Registration Links</h5>
        <p className="text-muted small">
          Share these URLs to drive students to register and pay, or send one straight to a
          student from the Career-9 email account.
        </p>

        <div className="mb-3">
          <label className="form-label fw-bold">Campaign-wide link</label>
          <div className="d-flex gap-2 align-items-center">
            <code className="flex-grow-1 p-2 bg-light rounded">{campaignUrl}</code>
            {actions(campaignUrl, "campaign", { url: campaignUrl, label: "this campaign" })}
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
                      {actions(aUrl, `a-${a.assessmentId}`, {
                        url: aUrl,
                        label: a.assessmentName,
                        assessmentId: a.assessmentId,
                      })}
                    </div>
                  </div>

                  {a.tiers.length > 0 && (
                    <div>
                      <small className="text-muted">Per-tier deep links:</small>
                      {a.tiers.map((t) => {
                        const tUrl = `${ASSESSMENT_DOMAIN}/c/${slug}/${a.assessmentId}/${t.campaignAssessmentTierId}`
                        const key = `t-${t.campaignAssessmentTierId}`
                        const tierName = t.name || `Tier #${t.pricingTierId}`
                        return (
                          <div key={t.campaignAssessmentTierId} className="d-flex gap-2 align-items-center mt-1">
                            <span className="text-muted me-2" style={{ minWidth: 100 }}>
                              {tierName}
                            </span>
                            <code className="flex-grow-1 p-2 bg-light rounded">{tUrl}</code>
                            {actions(tUrl, key, {
                              url: tUrl,
                              label: `${a.assessmentName} — ${tierName}`,
                              assessmentId: a.assessmentId,
                              campaignAssessmentTierId: t.campaignAssessmentTierId,
                            })}
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

      {target && (
        <SendLinkModal
          campaignId={campaignId}
          target={target}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  )
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type SendLinkModalProps = {
  campaignId: number
  target: SendTarget
  onClose: () => void
}

/**
 * Type the students' addresses, one chip each. Addresses are added on Enter, comma or blur,
 * so pasting a comma- or newline-separated list from a spreadsheet lands as separate chips
 * rather than one unusable string.
 */
const SendLinkModal = ({ campaignId, target, onClose }: SendLinkModalProps) => {
  const [emails, setEmails] = useState<string[]>([])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)

  const addDraft = (raw: string) => {
    const parts = raw.split(/[,;\s]+/).map((p) => p.trim().toLowerCase()).filter(Boolean)
    if (parts.length === 0) return
    setEmails((prev) => {
      const next = [...prev]
      parts.forEach((p) => { if (!next.includes(p)) next.push(p) })
      return next
    })
    setDraft("")
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault()
      addDraft(draft)
    } else if (e.key === "Backspace" && !draft && emails.length > 0) {
      setEmails((prev) => prev.slice(0, -1))
    }
  }

  // Anything still in the box counts — nobody should lose a typed address to a missed Enter.
  const pending = draft.trim() ? [draft.trim().toLowerCase()] : []
  const all = [...emails, ...pending.filter((p) => !emails.includes(p))]
  const invalid = all.filter((e) => !EMAIL_RE.test(e))

  const send = async () => {
    if (all.length === 0 || invalid.length > 0) return
    setSending(true)
    try {
      const { data } = await sendCampaignLink(campaignId, {
        emails: all,
        assessmentId: target.assessmentId,
        campaignAssessmentTierId: target.campaignAssessmentTierId,
      })
      if (data.failed > 0) {
        showErrorToast(
          `${data.accepted} of ${data.requested} queued — ${data.failed} could not be sent. See the Email Log.`,
        )
      } else {
        showSuccessToast(
          data.accepted === 1
            ? "Invite queued — check the Email Log for delivery."
            : `${data.accepted} invites queued — check the Email Log for delivery.`,
        )
      }
      onClose()
    } catch (e: any) {
      showErrorToast(e?.response?.data?.error || e?.response?.data || "Could not send the invite")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,.5)" }} role="dialog">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Send registration link</h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={sending} />
          </div>

          <div className="modal-body">
            <div className="mb-3">
              <small className="text-muted d-block">Link for {target.label}</small>
              <code className="d-block p-2 bg-light rounded mt-1" style={{ wordBreak: "break-all" }}>
                {target.url}
              </code>
            </div>

            <label className="form-label fw-bold">Student email addresses</label>
            <div
              className="form-control d-flex flex-wrap gap-1 align-items-center"
              style={{ minHeight: 90, alignContent: "flex-start", cursor: "text" }}
              onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}
            >
              {emails.map((e) => (
                <span
                  key={e}
                  className={`badge d-inline-flex align-items-center gap-1 ${
                    EMAIL_RE.test(e) ? "bg-light text-dark border" : "bg-danger-subtle text-danger border border-danger"
                  }`}
                >
                  {e}
                  <button
                    type="button"
                    className="btn-close btn-close-sm"
                    style={{ fontSize: ".5rem" }}
                    onClick={() => setEmails((prev) => prev.filter((x) => x !== e))}
                  />
                </span>
              ))}
              <input
                className="border-0 flex-grow-1"
                style={{ outline: "none", minWidth: 160 }}
                value={draft}
                placeholder={emails.length === 0 ? "student@example.com" : ""}
                onChange={(ev) => setDraft(ev.target.value)}
                onKeyDown={onKeyDown}
                onBlur={() => addDraft(draft)}
                disabled={sending}
              />
            </div>
            <small className="text-muted">
              Enter or comma adds an address. Paste a list and it splits into separate addresses.
            </small>

            {invalid.length > 0 && (
              <div className="alert alert-warning py-2 mt-2 mb-0 small">
                Not an email address: {invalid.join(", ")}
              </div>
            )}

            <div className="alert alert-light border py-2 mt-3 mb-0 small text-muted">
              Sent from the Career-9 email account, one message per student, using the
              <b> Campaign registration invite </b> template. Every send is listed on the Email Log page.
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn-sm btn-light" onClick={onClose} disabled={sending}>
              Cancel
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={send}
              disabled={sending || all.length === 0 || invalid.length > 0}
            >
              {sending ? "Sending…" : `Send${all.length > 0 ? ` (${all.length})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegistrationLinks
