import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../../portal/PortalLayout'
import { STUDENT_MENU_ITEMS, STUDENT_STORAGE_KEYS } from './studentMenuConfig'
import { DashboardApiResponse } from '../API/Dashboard_APIs'
import { fetchNavigator360Scores } from '../../ReportsHub/navigator360/Navigator360API'
import {
  computeNavigator360,
  riasecDisplayName,
  abilityDisplayName,
  miDisplayName,
  levelColor,
} from '../../ReportsHub/navigator360/Navigator360Engine'
import { generateReportHTML } from '../../ReportsHub/navigator360/Navigator360Report'
import { Navigator360Result, ScoredDimension, CareerMatch, AbsoluteLevel } from '../../ReportsHub/navigator360/Navigator360Types'
import { htmlToPdfBlob } from '../../ReportGeneration/utils/htmlToPdf'
import './StudentPortal.css'

// ═══════════════════════ VIBRANT COLOR PALETTE ═══════════════════════

const V = {
  // Gradients
  heroGrad: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  cardGrad1: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  cardGrad2: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  cardGrad3: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  cardGrad4: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  // Solid
  purple: '#7c3aed',
  blue: '#3b82f6',
  emerald: '#10b981',
  orange: '#f59e0b',
  rose: '#f43f5e',
  cyan: '#06b6d4',
  indigo: '#6366f1',
  // Neutral
  bg: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
}

const RIASEC_VIBRANT: Record<string, string> = {
  R: '#ef4444', I: '#3b82f6', A: '#a855f7', S: '#22c55e', E: '#f97316', C: '#14b8a6',
}

const ABILITY_VIBRANT = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899']
const MI_VIBRANT = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#a855f7']

// ═══════════════════════ HELPER COMPONENTS ═══════════════════════

function GlowCard({ children, gradient, style }: {
  children: React.ReactNode; gradient?: string; style?: React.CSSProperties
}) {
  return (
    <div style={{
      background: V.card, borderRadius: 16, padding: 24,
      border: `1px solid ${V.border}`,
      boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      position: 'relative', overflow: 'hidden',
      ...style,
    }}>
      {gradient && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 4,
          background: gradient, borderRadius: '16px 16px 0 0',
        }} />
      )}
      {children}
    </div>
  )
}

function BigScore({ value, max, label, color, size = 120 }: {
  value: number; max: number; label: string; color: string; size?: number
}) {
  const pct = (value / max) * 100
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={V.border} strokeWidth={10} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div style={{
        marginTop: -size / 2 - 20, position: 'relative', textAlign: 'center',
        height: size / 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: size / 3, fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: 10, color: V.muted, fontWeight: 600 }}>/ {max}</div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: V.text, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
    </div>
  )
}

function MiniScore({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', flex: '1 1 60px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 9, color: V.muted }}>/ {max}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: V.muted, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function VibrantBar({ label, value, max, color, animate }: {
  label: string; value: number; max: number; color: string; animate?: boolean
}) {
  const pct = Math.max(3, (value / max) * 100)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: V.text }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: 10, background: `${color}15`, borderRadius: 5, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 5,
          background: `linear-gradient(90deg, ${color}, ${color}bb)`,
          transition: animate ? 'width 1s ease' : undefined,
          boxShadow: `0 0 8px ${color}40`,
        }} />
      </div>
    </div>
  )
}

function LevelPill({ level }: { level: AbsoluteLevel }) {
  const bg = level === 'HIGH' ? '#dcfce7' : level === 'MODERATE' ? '#fef9c3' : '#fee2e2'
  const color = level === 'HIGH' ? '#15803d' : level === 'MODERATE' ? '#a16207' : '#dc2626'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      fontSize: 10, fontWeight: 700, color, background: bg, letterSpacing: 0.5,
    }}>{level}</span>
  )
}

function TagChip({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '4px 12px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, color, background: `${color}12`,
      border: `1px solid ${color}25`, margin: '3px 4px',
    }}>{text}</span>
  )
}

// ═══════════════════════ CAREER MATCH CARD ═══════════════════════

function VibrantCareerCard({ match, rank }: { match: CareerMatch; rank: number }) {
  const gradients = [V.heroGrad, V.cardGrad2, V.cardGrad3, V.cardGrad4, V.cardGrad1]
  const grad = gradients[(rank - 1) % gradients.length]

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden', marginBottom: 16,
      border: `1px solid ${V.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        background: grad, padding: '14px 20px', color: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 16,
          }}>#{rank}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{match.career.name}</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>
              {match.career.riasec.map((r) => riasecDisplayName(r)).join(' + ')}
              {match.isAspiration && <span style={{ marginLeft: 8, fontWeight: 700, background: 'rgba(255,255,255,0.3)', padding: '1px 8px', borderRadius: 10, fontSize: 10 }}>YOUR ASPIRATION</span>}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{match.suitability}%</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>suitability</div>
        </div>
      </div>
      <div style={{ padding: '14px 20px', background: V.card }}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: V.muted, fontWeight: 600, marginBottom: 4 }}>POTENTIAL MATCH</div>
            <div style={{ height: 8, background: `${V.emerald}20`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${match.potentialMatch}%`, height: '100%', borderRadius: 4, background: V.emerald }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: V.emerald, marginTop: 2 }}>{match.potentialMatch}%</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: V.muted, fontWeight: 600, marginBottom: 4 }}>VALUES MATCH</div>
            <div style={{ height: 8, background: `${V.orange}20`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${match.valuesMatch}%`, height: '100%', borderRadius: 4, background: V.orange }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: V.orange, marginTop: 2 }}>{match.valuesMatch}%</div>
          </div>
        </div>
        {match.matchedValues.length > 0 && (
          <div style={{ fontSize: 11, color: V.muted }}>
            Matched values: {match.matchedValues.join(', ')}
          </div>
        )}
        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {match.career.degreePaths.slice(0, 4).map((dp) => (
            <span key={dp} style={{
              padding: '3px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600,
              background: `${V.indigo}10`, color: V.indigo, border: `1px solid ${V.indigo}20`,
            }}>{dp}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════ MAIN PAGE ═══════════════════════

const StudentNavigator360Page: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Navigator360Result | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('studentPortalLoggedIn')
    if (!isLoggedIn) { navigate('/student/login'); return }

    try {
      const profileStr = localStorage.getItem('studentPortalProfile')
      const dashStr = localStorage.getItem('studentPortalDashboard')
      if (!profileStr || !dashStr) { navigate('/student/login'); return }

      const profileData = JSON.parse(profileStr)
      const rawData: DashboardApiResponse = JSON.parse(dashStr)
      setProfile(profileData)

      const completedAssessment = rawData.assessments?.find((a) => a.status === 'completed')
      if (!completedAssessment || !profileData.userStudentId) {
        setError('No completed assessment found. Please complete an assessment first.')
        setLoading(false)
        return
      }

      fetchNavigator360Scores(profileData.userStudentId, completedAssessment.assessmentId)
        .then((scores) => {
          const computed = computeNavigator360(scores)
          setResult(computed)
        })
        .catch((err) => {
          setError(err?.response?.data?.error || err.message || 'Failed to load Navigator 360 data')
        })
        .finally(() => setLoading(false))
    } catch {
      navigate('/student/login')
    }
  }, [navigate])

  const handleDownloadPdf = useCallback(async () => {
    if (!result) return
    setDownloading(true)
    try {
      const html = generateReportHTML(result)
      const blob = await htmlToPdfBlob(html)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(result.studentName || 'Student').replace(/\s+/g, '_')}_Navigator_360.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('PDF download failed. Please try again.')
    } finally {
      setDownloading(false)
    }
  }, [result])

  const handleOpenHtml = useCallback(() => {
    if (!result) return
    const html = generateReportHTML(result)
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close() }
  }, [result])

  if (loading) {
    return (
      <PortalLayout title='Navigator 360' menuItems={STUDENT_MENU_ITEMS} storageKeys={STUDENT_STORAGE_KEYS} loginPath='/student/login'>
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', margin: '0 auto 16px',
            background: V.heroGrad, animation: 'pulse 1.5s infinite',
          }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: V.muted }}>Computing your Navigator 360 profile...</div>
          <div style={{ fontSize: 12, color: V.muted, marginTop: 4 }}>Analyzing personality, abilities, intelligences & career matches</div>
          <style>{`@keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(0.95); } }`}</style>
        </div>
      </PortalLayout>
    )
  }

  if (error || !result) {
    return (
      <PortalLayout title='Navigator 360' menuItems={STUDENT_MENU_ITEMS} storageKeys={STUDENT_STORAGE_KEYS} loginPath='/student/login'>
        <GlowCard gradient={V.cardGrad1}>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#128640;</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: V.text, marginBottom: 8 }}>
              {error || 'No data available'}
            </h3>
            <p style={{ fontSize: 13, color: V.muted }}>
              Complete an assessment to unlock your personalized Navigator 360 career guidance report.
            </p>
            <button
              onClick={() => navigate('/student/assessments')}
              style={{
                marginTop: 16, padding: '10px 24px', borderRadius: 10, border: 'none',
                background: V.heroGrad, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>
              View Assessments
            </button>
          </div>
        </GlowCard>
      </PortalLayout>
    )
  }

  const versionLabel = result.gradeGroup === '6-8' ? 'Insight Navigator'
    : result.gradeGroup === '9-10' ? 'Subject Navigator' : 'Career Navigator'

  const top3Riasec = [...result.riasec].sort((a, b) => b.normPct - a.normPct).slice(0, 3)
  const top3MI = [...result.mi].sort((a, b) => b.normPct - a.normPct).slice(0, 3)
  const top3Abilities = [...result.abilities].sort((a, b) => b.normPct - a.normPct).slice(0, 3)

  return (
    <PortalLayout title='Navigator 360' menuItems={STUDENT_MENU_ITEMS} storageKeys={STUDENT_STORAGE_KEYS} loginPath='/student/login'>
      {/* ── HERO BANNER ── */}
      <div style={{
        background: V.heroGrad, borderRadius: 20, padding: '28px 32px', marginBottom: 24,
        color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 200, height: 200,
          borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, right: 80, width: 160, height: 160,
          borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              {versionLabel}
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px', letterSpacing: -0.5 }}>
              Navigator 360
            </h1>
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              Hello, <strong>{result.studentName}</strong> &middot; Class {result.studentClass}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleOpenHtml} style={{
              padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', backdropFilter: 'blur(4px)',
            }}>
              Full Report
            </button>
            <button onClick={handleDownloadPdf} disabled={downloading} style={{
              padding: '8px 16px', borderRadius: 10, border: 'none',
              background: 'rgba(255,255,255,0.95)', color: '#6366f1', fontSize: 12, fontWeight: 700,
              cursor: downloading ? 'not-allowed' : 'pointer', opacity: downloading ? 0.7 : 1,
            }}>
              {downloading ? 'Creating...' : 'Download PDF'}
            </button>
          </div>
        </div>

        {/* Quick stats row */}
        <div style={{
          display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap',
        }}>
          {[
            { label: 'Holland Code', value: result.hollandCode, sub: result.hollandCode.split('').map(riasecDisplayName).join(' - ') },
            { label: 'CCI', value: result.cci, sub: 'Career Clarity Index' },
            { label: 'Alignment', value: `${result.alignmentScore}%`, sub: 'Profile-Career Match' },
            { label: 'Top Career', value: result.topCareers[0]?.career.name || '-', sub: `${result.topCareers[0]?.suitability || 0}% suitability` },
          ].map((stat) => (
            <div key={stat.label} style={{
              flex: '1 1 140px', background: 'rgba(255,255,255,0.12)', borderRadius: 12,
              padding: '12px 16px', backdropFilter: 'blur(4px)',
            }}>
              <div style={{ fontSize: 10, opacity: 0.7, fontWeight: 600, textTransform: 'uppercase' }}>{stat.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{stat.value}</div>
              <div style={{ fontSize: 10, opacity: 0.6 }}>{stat.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── COMPOSITE SCORES ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <GlowCard gradient={V.cardGrad2}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: V.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Potential Score</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <BigScore value={result.potentialScore.total} max={100} label="" color={V.indigo} size={130} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <MiniScore value={result.potentialScore.personality} max={25} label="Personality" color={V.rose} />
            <MiniScore value={result.potentialScore.intelligence} max={25} label="Intelligence" color={V.blue} />
            <MiniScore value={result.potentialScore.ability} max={30} label="Ability" color={V.purple} />
            <MiniScore value={result.potentialScore.academic} max={20} label="Academic" color={V.emerald} />
          </div>
        </GlowCard>

        <GlowCard gradient={V.cardGrad3}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: V.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Preference Score</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <BigScore value={result.preferenceScore.total} max={100} label="" color={V.emerald} size={130} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <MiniScore value={result.preferenceScore.p1Values} max={20} label="Values" color="#8b5cf6" />
            <MiniScore value={result.preferenceScore.p2Aspirations} max={20} label="Aspirations" color="#ec4899" />
            <MiniScore value={result.preferenceScore.p3Culture} max={30} label="Culture" color={V.cyan} />
            <MiniScore value={result.preferenceScore.p4Subjects} max={30} label="Subjects" color={V.orange} />
          </div>
        </GlowCard>
      </div>

      {/* ── YOUR TOP STRENGTHS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 24 }}>
        <GlowCard gradient={V.heroGrad}>
          <div style={{ fontSize: 12, fontWeight: 700, color: V.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
            Top Personality Types
          </div>
          {top3Riasec.map((d, i) => (
            <div key={d.name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%', display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: RIASEC_VIBRANT[d.name] || V.purple, color: '#fff',
                    fontSize: 11, fontWeight: 800,
                  }}>{d.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: V.text }}>{riasecDisplayName(d.name)}</span>
                </div>
                <LevelPill level={d.level} />
              </div>
              <VibrantBar label="" value={d.rawScore} max={18} color={RIASEC_VIBRANT[d.name] || V.purple} animate />
            </div>
          ))}
        </GlowCard>

        <GlowCard gradient={V.cardGrad3}>
          <div style={{ fontSize: 12, fontWeight: 700, color: V.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
            Top Abilities
          </div>
          {top3Abilities.map((d, i) => (
            <div key={d.name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: V.text }}>{abilityDisplayName(d.name)}</span>
                <LevelPill level={d.level} />
              </div>
              <VibrantBar label="" value={d.rawScore} max={12} color={ABILITY_VIBRANT[i % ABILITY_VIBRANT.length]} animate />
            </div>
          ))}
        </GlowCard>

        <GlowCard gradient={V.cardGrad2}>
          <div style={{ fontSize: 12, fontWeight: 700, color: V.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
            Top Intelligences
          </div>
          {top3MI.map((d, i) => (
            <div key={d.name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: V.text }}>{miDisplayName(d.name)}</span>
                <LevelPill level={d.level} />
              </div>
              <VibrantBar label="" value={d.rawScore} max={12} color={MI_VIBRANT[i % MI_VIBRANT.length]} animate />
            </div>
          ))}
        </GlowCard>
      </div>

      {/* ── YOUR PREFERENCES ── */}
      <GlowCard gradient={V.cardGrad4} style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: V.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
          Your Preferences
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: V.text, marginBottom: 8 }}>Career Aspirations</div>
            <div>{result.careerAspirations.length > 0
              ? result.careerAspirations.map((a) => <TagChip key={a} text={a} color={V.indigo} />)
              : <span style={{ fontSize: 12, color: V.muted }}>Not selected</span>}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: V.text, marginBottom: 8 }}>Work Values</div>
            <div>{result.values.length > 0
              ? result.values.map((v) => <TagChip key={v} text={v} color={V.emerald} />)
              : <span style={{ fontSize: 12, color: V.muted }}>Not selected</span>}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: V.text, marginBottom: 8 }}>Subjects of Interest</div>
            <div>{result.subjectsOfInterest.length > 0
              ? result.subjectsOfInterest.map((s) => <TagChip key={s} text={s} color={V.purple} />)
              : <span style={{ fontSize: 12, color: V.muted }}>Not selected</span>}
            </div>
          </div>
        </div>
      </GlowCard>

      {/* ── TOP CAREER MATCHES ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: V.text, margin: 0 }}>Your Top Career Matches</h2>
            <p style={{ fontSize: 12, color: V.muted, margin: '4px 0 0' }}>
              Based on your personality, abilities, intelligences & values alignment
            </p>
          </div>
          <div style={{
            padding: '6px 14px', borderRadius: 10, background: `${V.indigo}10`,
            color: V.indigo, fontSize: 11, fontWeight: 700,
          }}>
            {result.topCareers.length} of {result.careerMatches.length} careers shown
          </div>
        </div>
        {result.topCareers.map((cm, i) => (
          <VibrantCareerCard key={cm.career.id} match={cm} rank={i + 1} />
        ))}
      </div>

      {/* ── FULL SCORING BREAKDOWN ── */}
      <GlowCard gradient={V.heroGrad} style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: V.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
          Complete RIASEC Profile
        </div>
        {result.riasec.map((d) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{
              width: 28, height: 28, borderRadius: '50%', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              background: RIASEC_VIBRANT[d.name], color: '#fff', fontSize: 12, fontWeight: 800,
            }}>{d.name}</span>
            <span style={{ width: 110, fontSize: 12, fontWeight: 600, color: V.text }}>{riasecDisplayName(d.name)}</span>
            <div style={{ flex: 1, height: 12, background: `${RIASEC_VIBRANT[d.name]}15`, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{
                width: `${(d.rawScore / 18) * 100}%`, height: '100%', borderRadius: 6,
                background: `linear-gradient(90deg, ${RIASEC_VIBRANT[d.name]}, ${RIASEC_VIBRANT[d.name]}bb)`,
                transition: 'width 0.8s ease',
                boxShadow: `0 0 6px ${RIASEC_VIBRANT[d.name]}40`,
              }} />
            </div>
            <span style={{ width: 30, fontSize: 12, fontWeight: 700, color: V.text, textAlign: 'right' }}>{d.rawScore}</span>
            <span style={{ width: 55, fontSize: 11, fontWeight: 600, color: V.muted, textAlign: 'center' }}>S{d.stanine}</span>
            <LevelPill level={d.level} />
          </div>
        ))}
      </GlowCard>

      {/* ── ALL CAREERS TABLE ── */}
      <GlowCard style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: V.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
          Complete Career Ranking
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: V.bg }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: V.muted, fontSize: 10, textTransform: 'uppercase' }}>#</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: V.muted, fontSize: 10, textTransform: 'uppercase' }}>Career Field</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: V.muted, fontSize: 10, textTransform: 'uppercase' }}>Suit.</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: V.muted, fontSize: 10, textTransform: 'uppercase' }}>Pot.</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: V.muted, fontSize: 10, textTransform: 'uppercase' }}>Val.</th>
                <th style={{ padding: '10px 12px', fontWeight: 700, color: V.muted, fontSize: 10, textTransform: 'uppercase', width: '25%' }}>Bar</th>
              </tr>
            </thead>
            <tbody>
              {result.careerMatches.map((cm, i) => (
                <tr key={cm.career.id} style={{
                  borderBottom: `1px solid ${V.border}`,
                  background: cm.isAspiration ? `${V.indigo}06` : i % 2 === 0 ? '#fff' : V.bg,
                }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                    {cm.career.name}
                    {cm.isAspiration && <span style={{ fontSize: 9, color: V.indigo, marginLeft: 4, fontWeight: 700 }}>ASP</span>}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: V.indigo }}>{cm.suitability}%</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{cm.potentialMatch}%</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{cm.valuesMatch}%</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ height: 8, background: `${V.indigo}12`, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${cm.suitability}%`, height: '100%', borderRadius: 4,
                        background: `linear-gradient(90deg, ${V.indigo}, ${V.purple})`,
                      }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlowCard>

      {/* ── FLAGS ── */}
      {result.flags.length > 0 && (
        <GlowCard gradient={V.cardGrad1} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: V.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Observations
          </div>
          {result.flags.map((f, i) => {
            const bg = f.severity === 'critical' ? '#fef2f2' : f.severity === 'warning' ? '#fffbeb' : '#f0f9ff'
            const border = f.severity === 'critical' ? '#fca5a5' : f.severity === 'warning' ? '#fcd34d' : '#93c5fd'
            const color = f.severity === 'critical' ? '#991b1b' : f.severity === 'warning' ? '#92400e' : '#1e40af'
            return (
              <div key={i} style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 8, background: bg, border: `1px solid ${border}` }}>
                <span style={{ fontWeight: 800, fontSize: 11, color }}>{f.code}</span>
                <span style={{ fontSize: 12, color, marginLeft: 8, fontWeight: 600 }}>{f.name}</span>
                <p style={{ margin: '4px 0 0', fontSize: 11, color, opacity: 0.85 }}>{f.message}</p>
              </div>
            )
          })}
        </GlowCard>
      )}

      {/* ── FOOTER INSIGHT ── */}
      <div style={{
        background: `linear-gradient(135deg, ${V.indigo}08, ${V.purple}08)`,
        border: `1px solid ${V.indigo}15`, borderRadius: 12,
        padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'flex-start',
        fontSize: 12, color: V.text, lineHeight: 1.6,
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>&#9889;</span>
        <span>
          This report is generated based on your assessment responses using the Navigator 360 psychometric engine.
          Discuss your results with a counsellor for personalized career guidance.
        </span>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .sp-grid-2, .sp-grid-3 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </PortalLayout>
  )
}

export default StudentNavigator360Page
