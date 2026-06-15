import React, { useEffect, useState } from 'react';
import {
  getCounsellingOptionsByStudent,
  payForUpgrade,
  type CounsellingOptions,
  type CounsellingTierOption,
} from '../api-clients/assessmentMappingAPI';
import MappingPayLaterBooking from './MappingPayLaterBooking';
import { TierCard, Tier } from './TierCard';

/**
 * Post-assessment counselling tier selection for the B2B assessment-mapping
 * flow. Mounted on the thank-you page. Renders nothing unless the student needs
 * to pick a counselling-bearing tier (i.e. their current tier did not already
 * include counselling — in which case the existing thank-you flow books directly).
 *
 *  PAY_FIRST -> pick a tier, pay (Razorpay), then book (after returning, the
 *               thank-you page's existing counselling flow opens the slot picker).
 *  PAY_LATER -> pick a tier, choose a slot, pay before the appointment confirms.
 */
const MappingCounsellingSection: React.FC = () => {
  const [opts, setOpts] = useState<CounsellingOptions | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [payLaterOpen, setPayLaterOpen] = useState(false);

  const userStudentId = localStorage.getItem('userStudentId');
  const assessmentId = localStorage.getItem('assessmentId');

  useEffect(() => {
    if (!userStudentId || !assessmentId) {
      setLoaded(true);
      return;
    }
    getCounsellingOptionsByStudent(userStudentId, assessmentId)
      .then((res) => setOpts(res.data))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [userStudentId, assessmentId]);

  // Only this component's concern: the tier-selection case. When the student can
  // already book (tier included counselling), the thank-you page handles it.
  if (!loaded || !opts || !opts.needsTierSelection || opts.tiers.length === 0) {
    return null;
  }

  const selectedTier: CounsellingTierOption | undefined = opts.tiers.find(
    (t) => t.tierId === selectedTierId,
  );

  const handleContinue = async () => {
    if (selectedTierId === '' || !selectedTier) {
      setError('Please choose a counselling plan.');
      return;
    }
    setError('');

    if (opts.paymentTiming === 'PAY_LATER') {
      // Pick a slot first; payment is taken before the booking is confirmed.
      setPayLaterOpen(true);
      return;
    }

    // PAY_FIRST: pay now, then return to book.
    setSubmitting(true);
    try {
      const res = await payForUpgrade(opts.entitlementId, selectedTier.tierId);
      const data: any = res?.data || {};
      if (data.status === 'payment_required' && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        setError('Could not start payment. Please try again.');
      }
    } catch {
      setError('Could not start payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const rupees = (paise: number) => `₹${Math.round(paise).toLocaleString('en-IN')}`;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #ECFDF5 0%, #F0FDF4 100%)',
        border: '1.5px solid #6EE7B7',
        borderRadius: 16,
        padding: '1.5rem',
        margin: '1.5rem auto',
        maxWidth: 520,
        textAlign: 'left',
      }}
    >
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Career counselling
      </div>
      <h3 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 800, color: '#065F46' }}>
        Talk to a career counsellor
      </h3>
      <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: '#047857', lineHeight: 1.5 }}>
        {opts.paymentTiming === 'PAY_LATER'
          ? 'Choose a plan and a slot — you pay just before your session is confirmed.'
          : 'Choose a plan to unlock a one-on-one counselling session.'}
      </p>

      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 8 }}>
        Counselling plan
      </label>
      <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
        {opts.tiers.map((t) => {
          const inc = t.inclusions;
          const tierCard: Tier = {
            campaignAssessmentTierId: t.tierId,
            name: t.name,
            description: t.description ?? undefined,
            basePriceInr: t.amount,
            priceInr: t.amount,
            isDefault: false,
            includesFinalReport: !!inc?.includesFinalReport,
            includesDashboard: !!inc?.includesDashboard,
            includesCounselling: !!inc?.includesCounselling,
            counsellingSessionCount: inc?.counsellingSessionCount ?? null,
            includesLms: !!inc?.includesLms,
            lmsValidityDays: inc?.lmsValidityDays ?? null,
            dashboardValidityDays: inc?.dashboardValidityDays ?? null,
          };
          return (
            <TierCard
              key={t.tierId}
              tier={tierCard}
              selected={selectedTierId === t.tierId}
              onSelect={() => setSelectedTierId(t.tierId)}
            />
          );
        })}
      </div>

      {error && (
        <div style={{ color: '#dc2626', fontSize: '0.84rem', marginBottom: 12 }}>{error}</div>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={submitting}
        style={{
          width: '100%',
          padding: '13px 20px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          fontWeight: 700,
          fontSize: '0.98rem',
          cursor: submitting ? 'default' : 'pointer',
          opacity: submitting ? 0.7 : 1,
          boxShadow: '0 4px 16px rgba(16,185,129,0.32)',
        }}
      >
        {submitting
          ? 'Please wait…'
          : opts.paymentTiming === 'PAY_LATER'
            ? 'Choose a counselling slot →'
            : selectedTier
              ? `Pay ${rupees(selectedTier.amount)} & continue →`
              : 'Continue →'}
      </button>

      {payLaterOpen && selectedTier && (
        <MappingPayLaterBooking
          entitlementId={opts.entitlementId}
          tierId={selectedTier.tierId}
          onClose={() => setPayLaterOpen(false)}
        />
      )}
    </div>
  );
};

export default MappingCounsellingSection;
