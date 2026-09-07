import React from "react"
import "../styles/register.css"

export type Tier = {
  campaignAssessmentTierId: number
  name: string
  description?: string
  basePriceInr: number
  priceInr: number
  isDefault: boolean
  includesFinalReport: boolean
  includesDashboard: boolean
  includesCounselling: boolean
  counsellingSessionCount?: number | null
  includesLms: boolean
  lmsValidityDays?: number | null
  dashboardValidityDays?: number | null
}

type Props = {
  tier: Tier
  selected: boolean
  onSelect: () => void
  disabled?: boolean
}

/** Human-readable inclusions of a tier, in display order. */
export function tierFeatures(tier: Tier): string[] {
  const features: string[] = []
  if (tier.includesFinalReport) features.push("Detailed report")
  if (tier.includesCounselling && tier.counsellingSessionCount) {
    features.push(
      `${tier.counsellingSessionCount}× counselling session${
        tier.counsellingSessionCount > 1 ? "s" : ""
      }`
    )
  }
  if (tier.includesDashboard) {
    features.push(
      tier.dashboardValidityDays
        ? `Dashboard (${tier.dashboardValidityDays} days)`
        : "Dashboard access"
    )
  }
  if (tier.includesLms) {
    features.push(
      tier.lmsValidityDays ? `LMS (${tier.lmsValidityDays} days)` : "LMS access"
    )
  }
  return features
}

/**
 * Compact horizontal summary of a (locked-in) tier: label · name · inclusion
 * pills on the left, price on the right. Used by the registration pages so the
 * selection takes one row instead of a tall card. Styled by register.css.
 */
export const TierStrip: React.FC<{ tier: Tier; label?: string; sub?: React.ReactNode }> = ({
  tier,
  label = "Your selection",
  sub,
}) => {
  const features = tierFeatures(tier)
  const free = tier.priceInr === 0
  return (
    <div className="reg-strip">
      <div className="reg-strip-main">
        <div className="reg-strip-label">{label}</div>
        <div className="reg-strip-title">{tier.name}</div>
        {sub && <div className="reg-strip-sub">{sub}</div>}
        {features.length > 0 && (
          <div className="reg-pills">
            {features.map((f) => (
              <span key={f} className="reg-pill">{f}</span>
            ))}
          </div>
        )}
      </div>
      <div className="reg-strip-price">
        {tier.priceInr !== tier.basePriceInr && <s>INR {tier.basePriceInr}</s>}
        {free ? "Free" : `INR ${tier.priceInr}`}
      </div>
    </div>
  )
}

export const TierCard: React.FC<Props> = ({ tier, selected, onSelect, disabled }) => {
  const features = tierFeatures(tier)

  const cardStyle: React.CSSProperties = selected
    ? { ...s.tierCard, ...s.tierCardSelected, cursor: disabled ? "default" : "pointer" }
    : { ...s.tierCard, cursor: disabled ? "default" : "pointer" }

  return (
    <button type="button" onClick={onSelect} disabled={disabled} style={cardStyle}>
      {tier.isDefault && <span style={s.recommendedBadge}>Recommended</span>}
      <div style={s.tierTitle}>{tier.name}</div>
      <div style={s.tierPriceLine}>
        {tier.priceInr !== tier.basePriceInr && (
          <span style={s.tierBasePrice}>INR {tier.basePriceInr}</span>
        )}
        <span style={s.tierPrice}>INR {tier.priceInr}</span>
      </div>
      {tier.description && <p style={s.tierDescription}>{tier.description}</p>}
      {features.length > 0 && (
        <ul style={s.tierFeatures}>
          {features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
    </button>
  )
}

const s: Record<string, React.CSSProperties> = {
  tierCard: {
    position: "relative",
    background: "#fff",
    border: "1.5px solid #e2e8f0",
    borderRadius: 14,
    padding: "18px 16px",
    textAlign: "left",
    transition: "all 0.2s",
    width: "100%",
  },
  tierCardSelected: {
    borderColor: "#10b981",
    background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
    boxShadow: "0 6px 18px rgba(16, 185, 129, 0.18)",
  },
  recommendedBadge: {
    position: "absolute",
    top: -10,
    right: 12,
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "white",
    fontSize: "0.65rem",
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  tierTitle: { fontWeight: 700, color: "#0f172a", fontSize: "1.02rem", marginBottom: 6 },
  tierPriceLine: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 },
  tierBasePrice: { textDecoration: "line-through", color: "#94a3b8", fontSize: "0.85rem" },
  tierPrice: { color: "#0f172a", fontWeight: 800, fontSize: "1.1rem" },
  tierDescription: { color: "#64748b", fontSize: "0.83rem", lineHeight: 1.5, margin: "0 0 8px" },
  tierFeatures: {
    margin: 0,
    paddingLeft: 18,
    color: "#475569",
    fontSize: "0.82rem",
    lineHeight: 1.6,
  },
}

export default TierCard
