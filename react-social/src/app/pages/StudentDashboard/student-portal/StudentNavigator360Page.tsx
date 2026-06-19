import React, { useMemo, useRef, useState } from 'react'
import {
  getMyNavigatorReport,
  NavigatorReportCard,
  NavigatorDashboard,
  NavigatorDashboardResponse,
  ScoredDimension,
  CareerMatch,
} from './navigatorApi'
import { useStudentData } from './StudentDataContext'
import './StudentNavigator360.css'

// ─── helpers ──────────────────────────────────────────────────────────────────
const txt = (v: any): string => (v == null ? '' : String(v).trim())
const pct = (n: any): number => {
  const v = Number(n)
  if (!isFinite(v)) return 0
  return Math.max(0, Math.min(100, Math.round(v)))
}

const Chips: React.FC<{ values?: any[] }> = ({ values }) => {
  const items = (values || []).map(txt).filter(Boolean)
  if (!items.length) return null
  return <div className='nav360-chips'>{items.map((it, i) => <span key={i} className='nav360-chip'>{it}</span>)}</div>
}

const Bars: React.FC<{ title: string; dims?: ScoredDimension[] }> = ({ title, dims }) => {
  const rows = (dims || []).filter((d) => txt(d?.name))
  if (!rows.length) return null
  return (
    <div className='nav360-section'>
      <h3>{title}</h3>
      {rows.map((d, i) => (
        <div key={i} className='nav360-bar'>
          <div className='nav360-bar-top'>
            <span className='nm'>{d.name}{txt(d.level) ? ` · ${d.level}` : ''}</span>
            <span className='vl'>{pct(d.normPct)}%</span>
          </div>
          <div className='nav360-bar-track'><div className='nav360-bar-fill' style={{ width: `${pct(d.normPct)}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

const Careers: React.FC<{ careers?: CareerMatch[] }> = ({ careers }) => {
  const rows = (careers || []).filter((c) => txt(c?.career?.name))
  if (!rows.length) return null
  return (
    <div className='nav360-section'>
      <h3>Top Career Matches</h3>
      {rows.map((c, i) => (
        <div key={i} className='nav360-career'>
          <div className='nm'>
            {c.career?.name}
            {c.isAspiration && <span className='tag'>★ aspiration</span>}
          </div>
          <div className='sc'>{pct(c.suitability)}%</div>
        </div>
      ))}
    </div>
  )
}

const CompassIcon = () => (
  <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
    <circle cx='12' cy='12' r='10' /><path d='M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z' />
  </svg>
)
const BackIcon = () => (
  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'>
    <line x1='19' y1='12' x2='5' y2='12' /><polyline points='12 19 5 12 12 5' />
  </svg>
)
const DownloadIcon = () => (
  <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'>
    <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' /><polyline points='7 10 12 15 17 10' /><line x1='12' y1='15' x2='12' y2='3' />
  </svg>
)

interface CardVM {
  assessmentId: number
  name: string
  report?: NavigatorReportCard
  ready: boolean
}

const StudentNavigator360Page: React.FC = () => {
  // List data comes from the once-at-login bootstrap (StudentDataContext); the
  // dashboard payload is precomputed server-side, fetched lazily on "Details".
  const { data, loading, error } = useStudentData()

  const [view, setView] = useState<'list' | 'detail'>('list')
  const [detail, setDetail] = useState<NavigatorDashboardResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [activeName, setActiveName] = useState('')
  const detailCache = useRef<Map<number, NavigatorDashboardResponse>>(new Map())

  const cards: CardVM[] = useMemo(() => {
    const byAssessment = new Map<number, NavigatorReportCard>()
    data.navigatorReports.forEach((r) => byAssessment.set(r.assessmentId, r))
    const completed = (data.assessments || []).filter(
      (a) => String(a?.status).toLowerCase() === 'completed'
    )
    return completed.map((a) => {
      const report = byAssessment.get(a.assessmentId)
      return {
        assessmentId: a.assessmentId,
        name: a.assessmentName || `Assessment ${a.assessmentId}`,
        report,
        ready: !!report && report.hasDashboard,
      }
    })
  }, [data])

  const openDetail = async (vm: CardVM) => {
    setActiveName(vm.name)
    setView('detail')
    setDetailError(null)
    const cached = detailCache.current.get(vm.assessmentId)
    if (cached) { setDetail(cached); return }
    setDetail(null)
    setDetailLoading(true)
    try {
      const resp = await getMyNavigatorReport(vm.assessmentId)
      detailCache.current.set(vm.assessmentId, resp)
      setDetail(resp)
    } catch (err: any) {
      setDetailError(err?.response?.data?.error || err?.message || 'Failed to load this dashboard')
    } finally {
      setDetailLoading(false)
    }
  }

  const backToList = () => { setView('list'); setDetail(null); setDetailError(null) }

  // ── List view ───────────────────────────────────────────────────────────────
  const ListView = useMemo(() => {
    if (loading) return <div className='nav360-state'><div className='s'>Loading your reports…</div></div>
    if (error) return <div className='nav360-state'><div className='t'>Couldn’t load your reports</div><div className='s'>{error}</div></div>
    if (!cards.length) {
      return (
        <div className='nav360-empty'>
          <svg width='46' height='46' viewBox='0 0 24 24' fill='none' stroke='#B0BEC5' strokeWidth='1.5'>
            <circle cx='12' cy='12' r='10' /><path d='M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z' />
          </svg>
          <div className='t'>No completed assessments yet</div>
          <div className='s'>Your Navigator 360 analysis appears here once you complete an assessment.</div>
        </div>
      )
    }
    return (
      <div className='nav360-grid'>
        {cards.map((vm) => (
          <div key={vm.assessmentId} className='nav360-card'>
            <div className='nav360-card-top'>
              <div className='nav360-card-icon'><CompassIcon /></div>
              {vm.ready
                ? <span className='nav360-badge ready'>Report ready</span>
                : <span className='nav360-badge pending'>Being prepared</span>}
            </div>
            <h3>{vm.name}</h3>
            <div className='nav360-card-snip'>
              {vm.ready
                ? 'View your detailed Navigator 360 analysis — interests, abilities, top career matches and more.'
                : 'Your report is being generated — check back soon.'}
            </div>
            <button
              className='nav360-btn nav360-btn-primary'
              disabled={!vm.ready}
              onClick={() => openDetail(vm)}
              style={{ alignSelf: 'flex-start' }}
            >
              Details
            </button>
          </div>
        ))}
      </div>
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, cards])

  if (view === 'list') {
    return (
      <div className='nav360'>
        <div className='nav360-head'>
          <h2>Navigator 360</h2>
          <p>Your career-readiness analysis for each completed assessment.</p>
        </div>
        {ListView}
      </div>
    )
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  const d: NavigatorDashboard | undefined = detail?.dashboard
  const pdf = txt(detail?.pdfUrl) || txt(detail?.reportUrl)

  return (
    <div className='nav360'>
      <div className='nav360-detail-top'>
        <button className='nav360-btn nav360-btn-ghost' onClick={backToList}><BackIcon /> Back</button>
        <div className='nav360-detail-id' style={{ flex: 1, minWidth: 0 }}>
          <h2>{activeName}</h2>
          {d && <span>{[txt(d.studentName), txt(d.studentClass)].filter(Boolean).join(' · ')}</span>}
        </div>
        <div className='nav360-detail-actions'>
          {pdf && <a className='nav360-btn nav360-btn-ghost' href={pdf} target='_blank' rel='noopener noreferrer'><DownloadIcon /> PDF</a>}
        </div>
      </div>

      {detailLoading && <div className='nav360-state'><div className='s'>Loading dashboard…</div></div>}
      {detailError && <div className='nav360-state'><div className='t'>Couldn’t load this dashboard</div><div className='s'>{detailError}</div></div>}

      {d && !detailLoading && (
        <>
          {/* Headline stats */}
          <div className='nav360-stats'>
            {txt(d.hollandCode) && (
              <div className='nav360-stat'><div className='v'>{d.hollandCode}</div><div className='k'>Holland Code</div><div className='sub'>Your interest signature</div></div>
            )}
            {d.cci && d.cci.applicable && d.cci.pct != null && (
              <div className='nav360-stat'><div className='v'>{pct(d.cci.pct)}%</div><div className='k'>Career Clarity Index</div><div className='sub'>{d.cci.band}</div></div>
            )}
            {typeof d.alignmentScore === 'number' && (
              <div className='nav360-stat'><div className='v'>{pct(d.alignmentScore)}%</div><div className='k'>Alignment</div><div className='sub'>Interests · abilities · values</div></div>
            )}
            {d.topCareers && d.topCareers[0]?.career?.name && (
              <div className='nav360-stat'><div className='v' style={{ fontSize: 16 }}>{d.topCareers[0].career!.name}</div><div className='k'>Top Match</div><div className='sub'>{pct(d.topCareers[0].suitability)}% suitability</div></div>
            )}
          </div>

          <Careers careers={d.topCareers && d.topCareers.length ? d.topCareers : d.careerMatches} />
          <Bars title='Interests (RIASEC)' dims={d.riasec} />
          <Bars title='Abilities' dims={d.abilities} />
          <Bars title='Multiple Intelligences' dims={d.mi} />

          {(d.values?.length || d.careerAspirations?.length || d.subjectsOfInterest?.length) ? (
            <div className='nav360-section'>
              <h3>Preferences</h3>
              {d.values?.length ? <div className='nav360-field'><div className='lbl'>Values</div><Chips values={d.values} /></div> : null}
              {d.careerAspirations?.length ? <div className='nav360-field'><div className='lbl'>Career Aspirations</div><Chips values={d.careerAspirations} /></div> : null}
              {d.subjectsOfInterest?.length ? <div className='nav360-field'><div className='lbl'>Subjects of Interest</div><Chips values={d.subjectsOfInterest} /></div> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default StudentNavigator360Page
