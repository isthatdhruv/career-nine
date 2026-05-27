import React, { useMemo, useState } from 'react'
import { TierCard, Tier } from './TierCard'

export type UpsellFeature = 'report' | 'dashboard' | 'counselling'

type Props = {
  feature: UpsellFeature
  /** Pre-filtered to tiers that include the requested feature.
   *  If empty the host should not render the modal at all. */
  tiers: Tier[]
  onClose: () => void
  onChoose: (campaignAssessmentTierId: number) => void
}

const FEATURE_COPY: Record<UpsellFeature, { title: string; subtitle: string }> = {
  report: {
    title: 'Add the Detailed Report',
    subtitle: 'Plans that include your detailed Career-9 report',
  },
  dashboard: {
    title: 'Add Dashboard Access',
    subtitle: 'Plans that unlock your personalised dashboard',
  },
  counselling: {
    title: 'Add 1:1 Counselling',
    subtitle: 'Plans that include live counselling sessions',
  },
}

/**
 * Pre-filtered tier-picker modal. Reuses the existing TierCard so the visual
 * language matches the main upgrade flow; the only difference is the modal
 * frame and the per-feature header. On choose, hands the
 * campaignAssessmentTierId up to the parent — the parent then runs the same
 * /c/{slug}/{aid}/upgrade/{eid}?tier=... navigation as the existing CTA, so
 * Razorpay payment-link issuance is unchanged.
 */
const FeatureUpsellModal: React.FC<Props> = ({ feature, tiers, onClose, onChoose }) => {
  const copy = FEATURE_COPY[feature]
  const sortedTiers = useMemo(() => {
    return [...tiers].sort((a, b) => (a.priceInr ?? 0) - (b.priceInr ?? 0))
  }, [tiers])
  const [selectedTierId, setSelectedTierId] = useState<number | null>(
    sortedTiers.length === 1 ? sortedTiers[0].campaignAssessmentTierId : null,
  )

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 720,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #F472B6 0%, #EC4899 100%)',
            color: '#fff',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{copy.title}</h2>
            <div style={{ fontSize: '0.82rem', opacity: 0.9, marginTop: 2 }}>{copy.subtitle}</div>
          </div>
          <button
            type='button'
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '1.5rem',
              lineHeight: 1,
              cursor: 'pointer',
              padding: 4,
            }}
            aria-label='Close'
          >
            ×
          </button>
        </div>

        {/* Body — scrollable list of TierCards */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
            }}
          >
            {sortedTiers.map((tier) => (
              <TierCard
                key={tier.campaignAssessmentTierId}
                tier={tier}
                selected={selectedTierId === tier.campaignAssessmentTierId}
                onSelect={() => setSelectedTierId(tier.campaignAssessmentTierId)}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            type='button'
            onClick={onClose}
            style={{
              background: '#F1F5F9',
              color: '#1E293B',
              border: '1px solid #CBD5E1',
              padding: '0.6rem 1rem',
              borderRadius: 10,
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={() => selectedTierId != null && onChoose(selectedTierId)}
            disabled={selectedTierId == null}
            style={{
              background:
                selectedTierId == null
                  ? '#CBD5E1'
                  : 'linear-gradient(135deg, #F472B6 0%, #EC4899 100%)',
              color: '#fff',
              border: 'none',
              padding: '0.6rem 1.25rem',
              borderRadius: 10,
              fontSize: '0.92rem',
              fontWeight: 600,
              cursor: selectedTierId == null ? 'not-allowed' : 'pointer',
              boxShadow:
                selectedTierId == null
                  ? 'none'
                  : '0 8px 22px rgba(236, 72, 153, 0.4)',
            }}
          >
            Continue to payment
          </button>
        </div>
      </div>
    </div>
  )
}

export default FeatureUpsellModal
