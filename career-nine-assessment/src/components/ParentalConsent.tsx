import { useState } from "react"

/**
 * DPDP (Digital Personal Data Protection Act, 2023) parental-consent block for the
 * registration pages: a mandatory checkbox with the full legal wording, plus a
 * "Read the full notice" link that opens the scrollable consent modal.
 *
 * The pages gate their submit on `checked` — registration cannot proceed without it.
 */

export const PARENTAL_CONSENT_LABEL =
  "I confirm that I am the parent / lawful guardian of the student registering and am above " +
  "18 years of age; I have read and understood the above; I consent to Career-9 collecting " +
  "and processing my child's personal data for the Navigator360™ assessment and report; " +
  "and I understand I may withdraw this consent at any time."

const h = (text: string) => (
  <div style={{ fontWeight: 800, fontSize: "0.92rem", color: "#0f172a", margin: "18px 0 6px" }}>
    {text}
  </div>
)

const p = (text: string) => (
  <p style={{ margin: "0 0 4px", color: "#475569", fontSize: "0.86rem", lineHeight: 1.65 }}>
    {text}
  </p>
)

const ConsentModal = ({ onClose }: { onClose: () => void }) => (
  <div
    onClick={onClose}
    style={{
      position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "#fff", borderRadius: 16, maxWidth: 640, width: "100%",
        maxHeight: "85vh", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 60px rgba(15, 23, 42, 0.3)",
      }}
    >
      <div style={{
        padding: "18px 24px", borderBottom: "1px solid #e2e8f0",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div style={{ fontWeight: 800, fontSize: "1.02rem", color: "#0f172a" }}>
          Parental Consent — Navigator360{"™"} Career Assessment
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "none", border: "none", fontSize: 22, lineHeight: 1,
            color: "#64748b", cursor: "pointer", padding: 4,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: "6px 24px 20px", overflowY: "auto" }}>
        {h("Who must complete this")}
        {p("If the student registering is below 18 years of age, this consent must be given by "
          + "a parent or lawful guardian. Registration cannot proceed without verified parental "
          + "consent, as required under the Digital Personal Data Protection Act, 2023.")}

        {h("Information we collect")}
        <ul style={{ margin: "0 0 4px", paddingLeft: 20, color: "#475569", fontSize: "0.86rem", lineHeight: 1.65 }}>
          <li>Student's name, class, school name, and age</li>
          <li>Parent/guardian's name, relationship to student, mobile number, and email</li>
          <li>The student's responses to the assessment questions</li>
        </ul>

        {h("How this information is used")}
        {p("Solely to generate the student's career guidance report and, if you opt for it, to "
          + "support counselling sessions with Career-9's experts.")}

        {h("What we do not do")}
        {p("We do not track children, monitor their behaviour, or show them advertising. We "
          + "never sell or share personal data with third parties for marketing.")}

        {h("Confidentiality and storage")}
        {p("The student's individual report is shared only with the parent/guardian and the "
          + "student. All data is stored on encrypted servers, retained only as long as needed, "
          + "and then securely deleted.")}

        {h("Your rights")}
        {p("You may request access to, correction of, or deletion of your child's data, or "
          + "withdraw this consent at any time, by writing to support@career-9.com. Withdrawal "
          + "takes effect immediately for all future processing. If your concern is not "
          + "resolved, you have the right to file a complaint with the Data Protection Board "
          + "of India.")}

        {h("Consent verification")}
        {p("Your consent will be verified through a One-Time Password (OTP) sent to your "
          + "mobile number. A secure record of your consent is maintained as required by law.")}

        <div style={{
          marginTop: 18, padding: "12px 16px", background: "#f8fafc",
          border: "1px solid #e2e8f0", borderRadius: 10,
          color: "#475569", fontSize: "0.82rem", lineHeight: 1.65,
        }}>
          <strong style={{ color: "#0f172a" }}>Grievance Officer:</strong> Dhruv Kumar
          {" · "}support@career-9.com{" · "}+91 81308 83948
          {" · "}Career-9, MIG 16, Mukut Nagar, Durg, Chhattisgarh – 491001
          {" · "}career-9.com
        </div>
      </div>

      <div style={{ padding: "14px 24px", borderTop: "1px solid #e2e8f0", textAlign: "right" }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "#059669", color: "#fff", border: "none", borderRadius: 10,
            padding: "10px 24px", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
          }}
        >
          I Understand
        </button>
      </div>
    </div>
  </div>
)

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
}

const ParentalConsentSection = ({ checked, onChange }: Props) => {
  const [showModal, setShowModal] = useState(false)

  return (
    <div style={{
      background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12,
      padding: "14px 16px",
    }}>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", margin: 0 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: 16, height: 16, marginTop: 3, flexShrink: 0, accentColor: "#059669", cursor: "pointer" }}
        />
        <span style={{ fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
          {PARENTAL_CONSENT_LABEL}
        </span>
      </label>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        style={{
          background: "none", border: "none", padding: 0, marginTop: 8, marginLeft: 26,
          color: "#059669", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        Read the full parental consent notice
      </button>
      {showModal && <ConsentModal onClose={() => setShowModal(false)} />}
    </div>
  )
}

export default ParentalConsentSection
