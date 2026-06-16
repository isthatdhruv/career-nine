import React, { useEffect, useState } from 'react';
import {
  getCounsellingOptionsByStudent,
  payForUpgrade,
  type CounsellingOptions,
  type CounsellingTierOption,
} from '../api-clients/assessmentMappingAPI';
import { getStudentCounselling } from '../api-clients/campaignAPI';
import MappingPayLaterBooking from './MappingPayLaterBooking';
import CounsellingSlotPicker from './CounsellingSlotPicker';
import { TierCard, Tier } from './TierCard';

/**
 * Post-assessment counselling for the B2B assessment-mapping flow. Mounted on
 * the thank-you page. As soon as counselling is bookable the slot picker opens
 * automatically — there is no "Book your counselling slot" card to click first:
 *
 *  1. The student's tier already includes counselling (canBookNow, PAY_FIRST paid
 *     upfront) -> the slot picker opens for a free booking.
 *  2. PAY_LATER (payPerSlot) -> the slot picker opens and the student pays the
 *     per-session counselling fee at booking time, each slot.
 *  3. The student must first pick a counselling-bearing tier (legacy free-link
 *     upsell, PAY_FIRST) -> pick a tier, pay (Razorpay), then book.
 */
const MappingCounsellingSection: React.FC = () => {
  const [opts, setOpts] = useState<CounsellingOptions | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Auto-open picker state (the canBookNow + payPerSlot flows).
  const [pickerOpen, setPickerOpen] = useState(false);
  const [userClosed, setUserClosed] = useState(false);
  const [booked, setBooked] = useState<any | null>(null);
  // Legacy free-link upsell on a PAY_LATER mapping: pick a tier, then pay per slot.
  const [payLaterOpen, setPayLaterOpen] = useState(false);

  const userStudentId = localStorage.getItem('userStudentId');
  const assessmentId = localStorage.getItem('assessmentId');

  useEffect(() => {
    if (!userStudentId || !assessmentId) {
      setLoaded(true);
      return;
    }
    Promise.all([
      getCounsellingOptionsByStudent(userStudentId, assessmentId)
        .then((res) => res.data).catch(() => null),
      // Source of truth for an existing booking (covers PAY_LATER bookings finalised
      // by the payment webhook). Keyed by student+assessment, entitlement-linked.
      getStudentCounselling(userStudentId, assessmentId)
        .then((res) => res.data as any).catch(() => null),
    ])
      .then(([o, sc]) => {
        if (o) setOpts(o);
        if (sc?.alreadyBooked) {
          setBooked({
            slotDate: sc.bookedSlotDate,
            slotStartTime: sc.bookedSlotStartTime,
            counsellorName: sc.bookedCounsellorName,
          });
        }
      })
      .finally(() => setLoaded(true));
  }, [userStudentId, assessmentId]);

  // PAY_FIRST (counselling pre-unlocked) or PAY_LATER (pay per slot) -> the slot
  // picker should appear right after the assessment, not behind a CTA card.
  const bookable =
    !!opts && !booked &&
    (((opts.canBookNow && !!opts.accessToken) || !!opts.payPerSlot));

  useEffect(() => {
    if (bookable && !userClosed) setPickerOpen(true);
  }, [bookable, userClosed]);

  if (!loaded || !opts) {
    return null;
  }

  const rupees = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

  // Shared green container for all counselling states.
  const card = (children: React.ReactNode) => (
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
      {children}
    </div>
  );

  // Once a session is booked, the thank-you page itself renders the "Counselling
  // Booked" confirmation (from the same already-booked signal). Render nothing here
  // so the confirmation isn't shown twice.
  if (booked) {
    return null;
  }

  // Minimal "reopen" link shown after the student dismisses the picker without
  // booking — deliberately a low-key link, NOT a prominent gradient card.
  const reopenLink = (
    <button
      type="button"
      onClick={() => { setUserClosed(false); setPickerOpen(true); }}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        marginTop: 6,
        color: '#059669',
        fontWeight: 700,
        fontSize: '0.92rem',
        cursor: 'pointer',
        textDecoration: 'underline',
      }}
    >
      Book your counselling session →
    </button>
  );

  // ── Case 1/2: counselling is bookable now (auto-opening picker) ─────────────
  if (bookable) {
    const payLaterTierId = opts.tiers[0]?.tierId;
    return card(
      <>
        <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#047857', lineHeight: 1.5 }}>
          {opts.payPerSlot
            ? `Pick a time to talk to a counsellor${opts.counsellingFeePerSession ? ` — ${rupees(opts.counsellingFeePerSession)} per session, paid when you book.` : '.'}`
            : 'Your plan includes a one-on-one counselling session. Pick a time that works for you.'}
        </p>
        {!pickerOpen && reopenLink}

        {/* PAY_LATER: pay the per-slot counselling fee at booking. */}
        {pickerOpen && opts.payPerSlot && payLaterTierId != null && (
          <MappingPayLaterBooking
            entitlementId={opts.entitlementId}
            tierId={payLaterTierId}
            feePerSession={opts.counsellingFeePerSession}
            onClose={() => { setPickerOpen(false); setUserClosed(true); }}
          />
        )}

        {/* PAY_FIRST / included: free booking against the active entitlement. */}
        {pickerOpen && !opts.payPerSlot && opts.canBookNow && opts.accessToken && (
          <CounsellingSlotPicker
            accessToken={opts.accessToken}
            entitlementId={opts.entitlementId}
            sessionsRemaining={opts.sessionsRemaining}
            onClose={() => { setPickerOpen(false); setUserClosed(true); }}
            onBooked={(result) => {
              setBooked(result);
              setPickerOpen(false);
            }}
          />
        )}
      </>,
    );
  }

  // ── Case 3: legacy free-link upsell — student picks a counselling tier ──────
  if (!opts.needsTierSelection || opts.tiers.length === 0) {
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

    // PAY_LATER upsell: pick a slot and pay the per-slot fee before it confirms.
    if (opts.paymentTiming === 'PAY_LATER') {
      setPayLaterOpen(true);
      return;
    }

    // PAY_FIRST upsell: pay now, then return to book.
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

  return card(
    <>
      <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: '#047857', lineHeight: 1.5 }}>
        Choose a plan to unlock a one-on-one counselling session.
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
          feePerSession={selectedTier.counsellingPrice ?? opts.counsellingFeePerSession}
          onClose={() => setPayLaterOpen(false)}
        />
      )}
    </>,
  );
};

export default MappingCounsellingSection;
