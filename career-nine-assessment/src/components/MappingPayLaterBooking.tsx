import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  getPayLaterSlots,
  payLaterBook,
  type CounsellingSlot,
} from '../api-clients/assessmentMappingAPI';

type Props = {
  entitlementId: number | string;
  tierId: number;
  onClose: () => void;
  /** Per-slot counselling fee (₹) shown next to the pay button, charged at booking. */
  feePerSession?: number | null;
  /** Prefill the contact form from the student's record so it isn't started blank. */
  defaultName?: string;
  defaultPhone?: string;
  defaultEmail?: string;
};

function formatDateHeader(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  } catch { return iso; }
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * PAY_LATER booking modal: the student picks a counselling slot one day at a time,
 * fills in their contact details, then is sent to payment. The slot is held
 * server-side and the appointment is finalised by the payment webhook once payment
 * succeeds. Already-taken slots are shown greyed-out with a "Booked" badge.
 */
const MappingPayLaterBooking: React.FC<Props> = ({
  entitlementId, tierId, onClose, feePerSession, defaultName, defaultPhone, defaultEmail,
}) => {
  const [slots, setSlots] = useState<CounsellingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [name, setName] = useState(defaultName || '');
  const [phone, setPhone] = useState(defaultPhone || '');
  const [email, setEmail] = useState(defaultEmail || '');
  const [method, setMethod] = useState<'EMAIL' | 'PHONE' | 'WHATSAPP'>('PHONE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Auto-scroll the details form into view as soon as a slot is picked.
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getPayLaterSlots(entitlementId)
      .then((res) => setSlots(res.data?.slots || []))
      .catch(() => setError('Could not load slots. Please try again.'))
      .finally(() => setLoading(false));
  }, [entitlementId]);

  // Distinct dates that have at least one slot (available or booked), sorted ascending.
  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const s of slots) set.add(s.date);
    return Array.from(set).sort();
  }, [slots]);
  const safeIndex = dates.length ? Math.min(dayIndex, dates.length - 1) : 0;
  const currentDate = dates[safeIndex];
  const daySlots = useMemo(
    () => slots.filter((s) => s.date === currentDate),
    [slots, currentDate],
  );

  useEffect(() => {
    if (selectedSlotId != null && detailsRef.current) {
      detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedSlotId]);

  const handlePay = async () => {
    if (!selectedSlotId) { setError('Please pick a slot.'); return; }
    if (!name.trim() || !phone.trim()) { setError('Name and phone are required.'); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await payLaterBook({
        entitlementId,
        tierId,
        slotId: selectedSlotId,
        contactName: name.trim(),
        contactPhone: phone.trim(),
        contactEmail: email.trim() || undefined,
        preferredContactMethod: method,
      });
      const data: any = res?.data || {};
      if (data.status === 'payment_required' && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        setError('Could not start payment. Please try again.');
        setSubmitting(false);
      }
    } catch (e: any) {
      setError(e?.response?.data || 'Could not start payment. Please try again.');
      setSubmitting(false);
    }
  };

  const fee = feePerSession != null && feePerSession > 0
    ? `₹${Math.round(feePerSession).toLocaleString('en-IN')}`
    : null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(6, 78, 59, 0.55)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20, maxWidth: 560, width: '100%',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 24px 70px rgba(6, 78, 59, 0.35)',
        }}
      >
        {/* Emphasised green header band */}
        <div
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#fff', padding: '1.4rem 1.6rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.9 }}>
              Career counselling
            </div>
            <h3 style={{ margin: '3px 0 0', fontSize: '1.4rem', fontWeight: 800 }}>
              Book your session
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', fontSize: '1.6rem', lineHeight: 1, cursor: 'pointer', color: '#fff', padding: 4 }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.4rem 1.6rem' }}>
          <p style={{ margin: '0 0 16px', fontSize: '0.92rem', color: '#475569', lineHeight: 1.5 }}>
            Pick a time, add your details, then complete payment to confirm your session.
            {fee && <> It’s <strong style={{ color: '#065F46' }}>{fee} per session</strong>, paid now.</>}
          </p>

          {loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>Loading slots…</div>
          ) : dates.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>
              No slots are available right now. Please check back later.
            </div>
          ) : (
            <>
              {/* Date navigation — one day at a time */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                padding: '0.55rem 0.75rem', background: '#ECFDF5', border: '1px solid #A7F3D0',
                borderRadius: 12, marginBottom: 14,
              }}>
                <button
                  type="button"
                  onClick={() => { setDayIndex((i) => Math.max(0, i - 1)); setSelectedSlotId(null); }}
                  disabled={safeIndex <= 0}
                  style={navBtnStyle(safeIndex <= 0)}
                >
                  ← Earlier
                </button>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#065F46' }}>
                  {currentDate ? formatDateHeader(currentDate) : '—'}
                </div>
                <button
                  type="button"
                  onClick={() => { setDayIndex((i) => Math.min(dates.length - 1, i + 1)); setSelectedSlotId(null); }}
                  disabled={safeIndex >= dates.length - 1}
                  style={navBtnStyle(safeIndex >= dates.length - 1)}
                >
                  Later →
                </button>
              </div>

              {/* Slot chips for the current day */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
                {daySlots.map((s) => {
                  const active = s.slotId === selectedSlotId;
                  const isBooked = !!s.booked;
                  return (
                    <button
                      key={s.slotId}
                      type="button"
                      disabled={isBooked}
                      onClick={() => { if (!isBooked) setSelectedSlotId(s.slotId); }}
                      title={isBooked ? 'This time is already booked' : undefined}
                      style={isBooked ? bookedChipStyle : slotChipStyle(active)}
                    >
                      <div style={{ fontWeight: 700 }}>{formatTime(s.startTime)}</div>
                      {isBooked ? (
                        <div style={bookedBadgeStyle}>Booked</div>
                      ) : (
                        s.counsellorName ? (
                          <div style={{ fontSize: '0.72rem', marginTop: 3, color: active ? 'rgba(255,255,255,0.9)' : '#64748b' }}>
                            {s.counsellorName}
                          </div>
                        ) : null
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Details — shown once a slot is picked, then pay */}
          {selectedSlotId != null && (
            <div ref={detailsRef} style={{ marginTop: 20, scrollMarginTop: 8 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065F46', marginBottom: 10 }}>
                Your details
              </div>
              <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
                <input placeholder="Your name *" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
                <input placeholder="Phone *" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
                <input placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
                <select value={method} onChange={(e) => setMethod(e.target.value as any)} style={inputStyle}>
                  <option value="PHONE">Contact me by phone</option>
                  <option value="WHATSAPP">Contact me on WhatsApp</option>
                  <option value="EMAIL">Contact me by email</option>
                </select>
              </div>

              {fee && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12,
                  padding: '12px 16px', marginBottom: 14,
                }}>
                  <span style={{ color: '#065F46', fontWeight: 600, fontSize: '0.9rem' }}>Counselling fee</span>
                  <strong style={{ color: '#065F46', fontWeight: 800, fontSize: '1.05rem' }}>{fee}</strong>
                </div>
              )}

              {error && <div style={{ color: '#dc2626', fontSize: '0.86rem', marginBottom: 10 }}>{String(error)}</div>}

              <button
                type="button"
                onClick={handlePay}
                disabled={submitting || loading}
                style={{
                  width: '100%', padding: '15px 20px', border: 'none', borderRadius: 14,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff',
                  fontWeight: 800, fontSize: '1.02rem', cursor: submitting ? 'default' : 'pointer',
                  opacity: submitting ? 0.7 : 1, boxShadow: '0 8px 22px rgba(16,185,129,0.4)',
                }}
              >
                {submitting ? 'Redirecting to payment…' : fee ? `Pay ${fee} & confirm →` : 'Continue to payment →'}
              </button>
            </div>
          )}

          {/* Error shown before a slot is picked (e.g. load failure) */}
          {selectedSlotId == null && error && (
            <div style={{ color: '#dc2626', fontSize: '0.86rem', marginTop: 12 }}>{String(error)}</div>
          )}
        </div>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1.5px solid #d1fae5', fontSize: '0.92rem', background: '#fff',
};

function slotChipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '11px 16px', borderRadius: 12, fontSize: '0.9rem', minWidth: 120, textAlign: 'left',
    border: active ? '1.5px solid transparent' : '1.5px solid #d1fae5',
    background: active ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#fff',
    color: active ? '#fff' : '#0f172a', cursor: 'pointer',
    boxShadow: active ? '0 6px 18px rgba(16,185,129,0.35)' : 'none',
  };
}

const bookedChipStyle: React.CSSProperties = {
  padding: '11px 16px', borderRadius: 12, fontSize: '0.9rem', minWidth: 120, textAlign: 'left',
  border: '1.5px dashed #CBD5E1', background: '#F1F5F9', color: '#94A3B8', cursor: 'not-allowed',
};

const bookedBadgeStyle: React.CSSProperties = {
  display: 'inline-block', marginTop: 4, padding: '1px 7px', borderRadius: 999,
  fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.02em', background: '#E2E8F0', color: '#64748B',
};

function navBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? 'transparent' : '#fff',
    color: disabled ? '#94A3B8' : '#065F46',
    border: disabled ? '1px solid transparent' : '1px solid #6EE7B7',
    padding: '0.4rem 0.8rem', borderRadius: 9, fontSize: '0.82rem', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

export default MappingPayLaterBooking;
