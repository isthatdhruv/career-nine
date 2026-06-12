import React, { useEffect, useMemo, useState } from 'react';
import {
  getPayLaterSlots,
  payLaterBook,
  type CounsellingSlot,
} from '../api-clients/assessmentMappingAPI';

type Props = {
  entitlementId: number | string;
  tierId: number;
  onClose: () => void;
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
 * PAY_LATER booking modal: the student picks a counselling slot and enters
 * contact details, then is sent to payment. The slot is held server-side and
 * the appointment is finalised by the payment webhook once payment succeeds.
 */
const MappingPayLaterBooking: React.FC<Props> = ({ entitlementId, tierId, onClose }) => {
  const [slots, setSlots] = useState<CounsellingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState<'EMAIL' | 'PHONE' | 'WHATSAPP'>('PHONE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getPayLaterSlots(entitlementId)
      .then((res) => setSlots(res.data?.slots || []))
      .catch(() => setError('Could not load slots. Please try again.'))
      .finally(() => setLoading(false));
  }, [entitlementId]);

  // Group slots by date for a tidy list.
  const grouped = useMemo(() => {
    const map: Record<string, CounsellingSlot[]> = {};
    for (const s of slots) (map[s.date] ||= []).push(s);
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

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

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, maxWidth: 480, width: '100%',
          maxHeight: '88vh', overflowY: 'auto', padding: '1.5rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#065F46' }}>
            Pick a counselling slot
          </h3>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#94a3b8' }}>×</button>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: '#64748b' }}>
          Choose a time, then complete payment to confirm your session.
        </p>

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading slots…</div>
        ) : grouped.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
            No slots are available right now. Please check back later.
          </div>
        ) : (
          <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 16 }}>
            {grouped.map(([date, daySlots]) => (
              <div key={date} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                  {formatDateHeader(date)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {daySlots.map((s) => {
                    const active = s.slotId === selectedSlotId;
                    return (
                      <button
                        key={s.slotId}
                        type="button"
                        onClick={() => setSelectedSlotId(s.slotId)}
                        style={{
                          padding: '7px 12px', borderRadius: 8, fontSize: '0.82rem',
                          border: active ? '1.5px solid #059669' : '1.5px solid #e2e8f0',
                          background: active ? 'rgba(16,185,129,0.1)' : '#fff',
                          color: '#0f172a', cursor: 'pointer',
                        }}
                      >
                        {formatTime(s.startTime)}
                        {s.counsellorName ? ` · ${s.counsellorName}` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
          <input placeholder="Your name *" value={name} onChange={(e) => setName(e.target.value)}
            style={inputStyle} />
          <input placeholder="Phone *" value={phone} onChange={(e) => setPhone(e.target.value)}
            style={inputStyle} />
          <input placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)}
            style={inputStyle} />
          <select value={method} onChange={(e) => setMethod(e.target.value as any)} style={inputStyle}>
            <option value="PHONE">Contact me by phone</option>
            <option value="WHATSAPP">Contact me on WhatsApp</option>
            <option value="EMAIL">Contact me by email</option>
          </select>
        </div>

        {error && <div style={{ color: '#dc2626', fontSize: '0.84rem', marginBottom: 10 }}>{String(error)}</div>}

        <button
          type="button"
          onClick={handlePay}
          disabled={submitting || loading}
          style={{
            width: '100%', padding: '13px 20px', border: 'none', borderRadius: 12,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff',
            fontWeight: 700, fontSize: '0.98rem', cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.7 : 1, boxShadow: '0 4px 16px rgba(16,185,129,0.32)',
          }}
        >
          {submitting ? 'Redirecting to payment…' : 'Continue to payment →'}
        </button>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: 9,
  border: '1.5px solid #e2e8f0', fontSize: '0.9rem', background: '#fff',
};

export default MappingPayLaterBooking;
