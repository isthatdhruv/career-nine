import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { getBookingContext, BookingContext } from '../api-clients/counsellingBookingAPI'
import MappingCounsellingSection from '../components/MappingCounsellingSection'

/**
 * Public, no-login counselling booking. Opened from the tokenized link emailed to a student who
 * completed an assessment but never booked.
 *
 * This page is deliberately a thin shell: it resolves the token into the student/assessment ids
 * and then renders the EXACT counselling experience the thank-you page shows
 * (MappingCounsellingSection → CounsellingSlotPicker) — auto-opening picker, contact prefill,
 * per-slot PAY_LATER payment, booked-state celebration and the confirmation email all come from
 * the same pipeline, so this flow can never drift from the in-app one.
 */
export default function CounsellingBookingPage() {
  const { token } = useParams<{ token: string }>()

  const [ctx, setCtx] = useState<BookingContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!token) return
    getBookingContext(token)
      .then((res) => {
        const data = res.data
        setCtx(data)
        // MappingCounsellingSection reads its identity from localStorage (same as on the
        // thank-you page). The token IS the student's credential for this visit, so adopt
        // that identity for the booking flow.
        if (data.userStudentId != null) {
          localStorage.setItem('userStudentId', String(data.userStudentId))
        }
        if (data.assessmentId != null) {
          localStorage.setItem('assessmentId', String(data.assessmentId))
        }
        setReady(data.userStudentId != null && data.assessmentId != null)
        setLoading(false)
      })
      .catch((e) => {
        setError(readErr(e, 'This booking link is invalid or has expired.'))
        setLoading(false)
      })
  }, [token])

  if (loading) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div className="spinner-border text-success" role="status" style={{ marginBottom: 12 }} />
          <div>Loading your counselling options…</div>
        </div>
      </Shell>
    )
  }

  if (error && !ctx) {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
          <h2 style={h2}>Link not valid</h2>
          <div style={{ color: '#b91c1c', marginTop: 8 }}>{error}</div>
        </div>
      </Shell>
    )
  }

  // Booked already — on the thank-you page, via this link earlier, anywhere. The token
  // resolves on every open, so the emailed button can never double-book: it lands here.
  if (ctx && ctx.actionable === false) {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#ecfdf5',
              border: '2px solid #6ee7b7',
              margin: '0 auto 16px',
              lineHeight: '60px',
              fontSize: 30,
            }}
          >
            ✅
          </div>
          <h2 style={h2}>You have already booked a slot</h2>
          <div style={{ color: '#475569', marginTop: 10, lineHeight: 1.65 }}>
            The session details have been mailed to you — please check your inbox (and the spam
            folder, just in case).
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 14, lineHeight: 1.6 }}>
            Need to make a change? Reply to your confirmation email and we'll sort it out.
          </div>
        </div>
      </Shell>
    )
  }

  if (!ready) {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>ℹ️</div>
          <h2 style={h2}>Nothing to book yet</h2>
          <div style={{ color: '#64748b', marginTop: 8 }}>
            We couldn't find a completed assessment for your account. If you think this is a
            mistake, please contact support.
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <div style={pageBg}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <h2 style={h2}>Hi {ctx?.studentName || 'there'}!</h2>
          <div style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 6 }}>
            You've completed your assessment — pick a time below for your one-on-one counselling
            session. Your booking is confirmed instantly and the details are emailed to you.
          </div>
        </div>
        {/* The exact thank-you page counselling experience. */}
        <MappingCounsellingSection />
      </div>
    </div>
  )
}

// ---- shell + helpers -------------------------------------------------------

function Shell({ children }: { children: ReactNode }) {
  return (
    <div style={pageBg}>
      <div style={card}>{children}</div>
    </div>
  )
}

function readErr(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: unknown; status?: number } }
  const d = err?.response?.data
  if (typeof d === 'string' && d) return d
  if (d && typeof d === 'object' && 'message' in d && typeof (d as any).message === 'string') {
    return (d as any).message
  }
  return fallback
}

const pageBg: CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #ecfdf5 0%, #f0f9ff 100%)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '48px 16px',
}
const card: CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
  padding: '28px 30px',
  width: '100%',
  maxWidth: 560,
}
const h2: CSSProperties = { fontWeight: 800, fontSize: '1.35rem', color: '#0f172a', margin: 0 }
