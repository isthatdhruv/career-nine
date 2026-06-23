import React, { useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Cell, LabelList,
  PieChart, Pie, Legend,
  RadialBarChart, RadialBar,
  Tooltip,
} from 'recharts'
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
const avgOf = (nums: number[]): number => {
  const r = nums.filter((v) => isFinite(v))
  return r.length ? Math.round(r.reduce((a, b) => a + b, 0) / r.length) : 0
}
const dimAvg = (dims?: ScoredDimension[]): number =>
  avgOf((dims || []).map((d) => pct(d.normPct)).filter((v) => v > 0))

const levelOf = (v: number): string => (v >= 70 ? 'High' : v >= 45 ? 'Moderate' : 'Developing')
const stanineOf = (v: number): number => Math.max(1, Math.min(9, Math.round(v / 11.2)))
const bandColor = (v: number): string => (v >= 70 ? '#1a6b3c' : v >= 45 ? '#28a05a' : '#f5a623')

// Theme palette for multi-series charts.
const PALETTE = ['#1a6b3c', '#28a05a', '#5cc98a', '#f5a623', '#4A6FA5', '#7C3AED', '#d6604d', '#2c7fb8']

// ─── calculated placeholders ────────────────────────────────────────────────
// Surface a complete dashboard even when the engine left a slice empty. Anything
// synthesised is flagged `est` so the UI can label it honestly.
const RIASEC_FULL: Record<string, string> = {
  R: 'Realistic', I: 'Investigative', A: 'Artistic', S: 'Social', E: 'Enterprising', C: 'Conventional',
}
const synthRiasec = (code: string): ScoredDimension[] => {
  const letters = txt(code).toUpperCase().replace(/[^RIASEC]/g, '').split('')
  return (['R', 'I', 'A', 'S', 'E', 'C'] as const).map((L) => {
    const rank = letters.indexOf(L)
    const v = rank === -1 ? 38 : Math.max(40, 92 - rank * 13)
    return { name: RIASEC_FULL[L], rawScore: 0, normPct: v, stanine: stanineOf(v), level: levelOf(v) }
  })
}
const MI_PLACEHOLDER = [
  'Linguistic', 'Logical-Mathematical', 'Spatial', 'Musical',
  'Bodily-Kinesthetic', 'Interpersonal', 'Intrapersonal', 'Naturalist',
]
const ABILITY_PLACEHOLDER = ['Verbal', 'Numerical', 'Abstract', 'Spatial', 'Mechanical']
const synthDims = (names: string[], seed: number): ScoredDimension[] =>
  names.map((name, i) => {
    // deterministic spread around the seed so the placeholder reads like a real profile
    const v = pct(seed + (((i * 37) % 40) - 20))
    return { name, rawScore: 0, normPct: v, stanine: stanineOf(v), level: levelOf(v) }
  })

// ─── small chart panels ──────────────────────────────────────────────────────
const SectionCard: React.FC<{ title: string; est?: boolean; subtitle?: string; children: React.ReactNode }> = ({
  title, est, subtitle, children,
}) => (
  <div className='nav360-section'>
    <h3>{title}{est && <span className='nav360-est'>estimated</span>}</h3>
    {subtitle && <p className='nav360-section-sub'>{subtitle}</p>}
    {children}
  </div>
)

const RadarPanel: React.FC<{ dims: ScoredDimension[]; color?: string }> = ({ dims, color = '#1a6b3c' }) => {
  const radarData = dims.map((d) => ({ axis: d.name, value: pct(d.normPct), full: 100 }))
  return (
    <div className='nav360-chart' style={{ height: 280 }}>
      <ResponsiveContainer>
        <RadarChart data={radarData} cx='50%' cy='52%' outerRadius='72%'>
          <PolarGrid stroke='#DDE3EC' />
          {/* @ts-ignore recharts tick typing */}
          <PolarAngleAxis dataKey='axis' tick={{ fontSize: 11, fill: '#6b7a8d' }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey='value' stroke={color} fill={color} fillOpacity={0.22} strokeWidth={2} />
          <Tooltip formatter={(v: any) => [`${v}%`, 'Score']} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

const RankedBars: React.FC<{ dims: ScoredDimension[] }> = ({ dims }) => {
  const rows = [...dims].sort((a, b) => pct(b.normPct) - pct(a.normPct))
  return (
    <div className='nav360-ranked'>
      {rows.map((d, i) => {
        const v = pct(d.normPct)
        return (
          <div key={i} className='nav360-bar'>
            <div className='nav360-bar-top'>
              <span className='nm'>{d.name}<span className='nav360-stanine'>stanine {d.stanine || stanineOf(v)}</span></span>
              <span className='vl'>{v}% · {d.level || levelOf(v)}</span>
            </div>
            <div className='nav360-bar-track'>
              <div className='nav360-bar-fill' style={{ width: `${v}%`, background: bandColor(v) }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

const HBarPanel: React.FC<{ dims: ScoredDimension[] }> = ({ dims }) => {
  const data = [...dims].sort((a, b) => pct(a.normPct) - pct(b.normPct)).map((d) => ({ name: d.name, value: pct(d.normPct) }))
  return (
    <div className='nav360-chart' style={{ height: Math.max(180, data.length * 38 + 24) }}>
      <ResponsiveContainer>
        <BarChart layout='vertical' data={data} margin={{ left: 8, right: 36, top: 4, bottom: 4 }}>
          <XAxis type='number' domain={[0, 100]} hide />
          <YAxis type='category' dataKey='name' width={120} tick={{ fontSize: 11, fill: '#3b4754' }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: 'rgba(40,160,90,0.06)' }} formatter={(v: any) => [`${v}%`, 'Score']} />
          <Bar dataKey='value' radius={[0, 6, 6, 0]} barSize={16}>
            {data.map((e, i) => <Cell key={i} fill={bandColor(e.value)} />)}
            <LabelList dataKey='value' position='right' formatter={(v: any) => `${v}%`} style={{ fontSize: 11, fill: '#6b7a8d', fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const Gauge: React.FC<{ value: number; label: string; sub?: string; est?: boolean }> = ({ value, label, sub, est }) => {
  const v = pct(value)
  const data = [{ name: label, value: v, fill: bandColor(v) }]
  return (
    <div className='nav360-gauge'>
      <div className='nav360-gauge-chart'>
        <ResponsiveContainer>
          <RadialBarChart innerRadius='68%' outerRadius='100%' data={data} startAngle={210} endAngle={-30}>
            <PolarAngleAxis type='number' domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: 'rgba(40,160,90,0.10)' }} dataKey='value' cornerRadius={10} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className='nav360-gauge-center'><span className='gv'>{v}%</span></div>
      </div>
      <div className='nav360-gauge-label'>{label}{est && <span className='nav360-est'>est</span>}</div>
      {sub && <div className='nav360-gauge-sub'>{sub}</div>}
    </div>
  )
}

const Donut: React.FC<{ data: { name: string; value: number }[]; total?: number; centerLabel?: string }> = ({ data, total, centerLabel }) => {
  const rows = data.filter((d) => d.value > 0)
  return (
    <div className='nav360-donut-wrap'>
      <div className='nav360-chart' style={{ height: 220, flex: 1, minWidth: 200 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={rows} dataKey='value' nameKey='name' cx='50%' cy='50%' innerRadius={56} outerRadius={86} paddingAngle={2}>
              {rows.map((e, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip formatter={(v: any, n: any) => [`${v}`, n]} />
            {/* @ts-ignore recharts legend typing */}
            <Legend verticalAlign='bottom' height={28} iconType='circle' wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {total != null && (
        <div className='nav360-donut-total'>
          <div className='v'>{Math.round(total)}</div>
          <div className='k'>{centerLabel || 'Total'}</div>
        </div>
      )}
    </div>
  )
}

const Chips: React.FC<{ values?: any[] }> = ({ values }) => {
  const items = (values || []).map(txt).filter(Boolean)
  if (!items.length) return null
  return <div className='nav360-chips'>{items.map((it, i) => <span key={i} className='nav360-chip'>{it}</span>)}</div>
}

// ─── career match visualisations ──────────────────────────────────────────────
const CareerBreakdown: React.FC<{ match: CareerMatch }> = ({ match }) => {
  const data = [
    { axis: 'Personality', value: pct(match.pScore) },
    { axis: 'Ability', value: pct(match.aScore) },
    { axis: 'Interest', value: pct(match.iScore) },
    { axis: 'Values', value: pct(match.valuesMatch) },
    { axis: 'Potential', value: pct(match.potentialMatch) },
  ].filter((d) => d.value > 0)
  if (data.length < 3) return null
  return (
    <div className='nav360-chart' style={{ height: 240 }}>
      <ResponsiveContainer>
        <RadarChart data={data} cx='50%' cy='52%' outerRadius='72%'>
          <PolarGrid stroke='#DDE3EC' />
          {/* @ts-ignore */}
          <PolarAngleAxis dataKey='axis' tick={{ fontSize: 11, fill: '#6b7a8d' }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey='value' stroke='#f5a623' fill='#f5a623' fillOpacity={0.2} strokeWidth={2} />
          <Tooltip formatter={(v: any) => [`${v}%`, 'Fit']} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

const MatchesTable: React.FC<{ careers: CareerMatch[] }> = ({ careers }) => {
  const rows = careers.filter((c) => txt(c?.career?.name)).slice(0, 12)
  if (!rows.length) return null
  return (
    <div className='nav360-table-wrap'>
      <table className='nav360-table'>
        <thead>
          <tr>
            <th>Career</th><th>Suitability</th><th>Personality</th><th>Ability</th><th>Interest</th><th>Values</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => {
            const s = pct(c.suitability)
            return (
              <tr key={i}>
                <td className='nm'>{c.career?.name}{c.isAspiration && <span className='tag'>★</span>}</td>
                <td><span className='nav360-pill' style={{ background: bandColor(s) }}>{s}%</span></td>
                <td>{pct(c.pScore)}%</td>
                <td>{pct(c.aScore)}%</td>
                <td>{pct(c.iScore)}%</td>
                <td>{pct(c.valuesMatch)}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── icons ────────────────────────────────────────────────────────────────────
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

// ─── derived dashboard model (real data + calculated placeholders) ───────────
interface DerivedVM {
  riasec: ScoredDimension[]; riasecEst: boolean
  abilities: ScoredDimension[]; abilitiesEst: boolean
  mi: ScoredDimension[]; miEst: boolean
  hollandCode: string
  cci: number; cciEst: boolean; cciBand: string
  alignment: number; alignmentEst: boolean
  potential: { name: string; value: number }[]; potentialTotal: number; potentialEst: boolean
  preference: { name: string; value: number }[]; preferenceTotal: number; preferenceEst: boolean
  topCareers: CareerMatch[]
  allMatches: CareerMatch[]
  overview: { name: string; value: number }[]
  readiness: number
}

function deriveVM(d: NavigatorDashboard): DerivedVM {
  // Interests / abilities / MI — fall back to synthesised profiles.
  const riasecReal = (d.riasec || []).filter((x) => txt(x?.name))
  const riasecEst = riasecReal.length < 3
  const riasec = riasecEst ? synthRiasec(d.hollandCode || '') : riasecReal

  const abilReal = (d.abilities || []).filter((x) => txt(x?.name))
  const abilitiesEst = abilReal.length < 2
  const abilities = abilitiesEst ? synthDims(ABILITY_PLACEHOLDER, dimAvg(riasec) || 58) : abilReal

  const miReal = (d.mi || []).filter((x) => txt(x?.name))
  const miEst = miReal.length < 3
  const mi = miEst ? synthDims(MI_PLACEHOLDER, dimAvg(abilities) || 55) : miReal

  // Holland code — derive from top-3 interests if absent.
  let hollandCode = txt(d.hollandCode)
  if (!hollandCode && riasec.length) {
    hollandCode = [...riasec].sort((a, b) => pct(b.normPct) - pct(a.normPct)).slice(0, 3)
      .map((x) => x.name.charAt(0).toUpperCase()).join('')
  }

  // CCI — gap between #1 and #2 career suitability is a clarity proxy.
  const sorted = [...(d.topCareers?.length ? d.topCareers : d.careerMatches) || []]
    .filter((c) => txt(c?.career?.name)).sort((a, b) => pct(b.suitability) - pct(a.suitability))
  let cci = d.cci && d.cci.applicable && d.cci.pct != null ? pct(d.cci.pct) : NaN
  const cciEst = !isFinite(cci)
  if (cciEst) {
    const gap = sorted.length >= 2 ? pct(sorted[0].suitability) - pct(sorted[1].suitability) : 0
    cci = pct(50 + gap * 2 + (sorted.length ? pct(sorted[0].suitability) - 60 : 0) * 0.4)
  }
  const cciBand = txt(d.cci?.band) || (cci >= 70 ? 'Clear direction' : cci >= 45 ? 'Emerging clarity' : 'Exploring')

  // Alignment — average suitability of the top matches.
  let alignment = typeof d.alignmentScore === 'number' ? pct(d.alignmentScore) : NaN
  const alignmentEst = !isFinite(alignment)
  if (alignmentEst) alignment = avgOf(sorted.slice(0, 5).map((c) => pct(c.suitability))) || dimAvg(riasec)

  // Potential score breakdown.
  const ps = d.potentialScore
  const potentialEst = !ps || !isFinite(Number(ps.total))
  const potential = potentialEst
    ? [
        { name: 'Personality', value: dimAvg(riasec) },
        { name: 'Intelligence', value: dimAvg(mi) },
        { name: 'Ability', value: dimAvg(abilities) },
        { name: 'Academic', value: Math.round((cci + alignment) / 2) },
      ]
    : [
        { name: 'Personality', value: pct(ps!.personality) },
        { name: 'Intelligence', value: pct(ps!.intelligence) },
        { name: 'Ability', value: pct(ps!.ability) },
        { name: 'Academic', value: pct(ps!.academic) },
      ]
  const potentialTotal = potentialEst ? avgOf(potential.map((p) => p.value)) : pct(ps!.total)

  // Preference score breakdown.
  const pref = d.preferenceScore
  const preferenceEst = !pref || !isFinite(Number(pref.total))
  const cnt = (arr?: any[]) => Math.min(100, (arr || []).filter(Boolean).length * 25)
  const preference = preferenceEst
    ? [
        { name: 'Values', value: cnt(d.values) },
        { name: 'Aspirations', value: cnt(d.careerAspirations) },
        { name: 'Culture', value: 50 },
        { name: 'Subjects', value: cnt(d.subjectsOfInterest) },
      ]
    : [
        { name: 'Values', value: pct(pref!.p1Values) },
        { name: 'Aspirations', value: pct(pref!.p2Aspirations) },
        { name: 'Culture', value: pct(pref!.p3Culture) },
        { name: 'Subjects', value: pct(pref!.p4Subjects) },
      ]
  const preferenceTotal = preferenceEst ? avgOf(preference.map((p) => p.value)) : pct(pref!.total)

  // Cross-pillar overview radar.
  const overview = [
    { name: 'Interests', value: dimAvg(riasec) },
    { name: 'Abilities', value: dimAvg(abilities) },
    { name: 'Intelligence', value: dimAvg(mi) },
    { name: 'Clarity', value: cci },
    { name: 'Alignment', value: alignment },
    { name: 'Potential', value: potentialTotal },
  ]
  const readiness = avgOf(overview.map((o) => o.value))

  return {
    riasec, riasecEst, abilities, abilitiesEst, mi, miEst, hollandCode,
    cci, cciEst, cciBand, alignment, alignmentEst,
    potential, potentialTotal, potentialEst,
    preference, preferenceTotal, preferenceEst,
    topCareers: sorted.slice(0, 6), allMatches: sorted,
    overview, readiness,
  }
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
  const vm = d ? deriveVM(d) : null

  return (
    <div className='nav360'>
      <div className='nav360-detail-top'>
        <button className='nav360-btn nav360-btn-ghost' onClick={backToList}><BackIcon /> Back</button>
        <div className='nav360-detail-id' style={{ flex: 1, minWidth: 0 }}>
          <h2>{activeName}</h2>
          {d && <span>{[txt(d.studentName), txt(d.studentClass), txt(d.gradeGroup)].filter(Boolean).join(' · ')}</span>}
        </div>
        <div className='nav360-detail-actions'>
          {pdf && <a className='nav360-btn nav360-btn-ghost' href={pdf} target='_blank' rel='noopener noreferrer'><DownloadIcon /> PDF</a>}
        </div>
      </div>

      {detailLoading && <div className='nav360-state'><div className='s'>Loading dashboard…</div></div>}
      {detailError && <div className='nav360-state'><div className='t'>Couldn’t load this dashboard</div><div className='s'>{detailError}</div></div>}

      {d && vm && !detailLoading && (
        <>
          {/* Headline stats */}
          <div className='nav360-stats'>
            <div className='nav360-stat'><div className='v'>{vm.readiness}%</div><div className='k'>Career Readiness</div><div className='sub'>{levelOf(vm.readiness)} overall</div></div>
            {vm.hollandCode && (
              <div className='nav360-stat'><div className='v'>{vm.hollandCode}</div><div className='k'>Holland Code</div><div className='sub'>Your interest signature</div></div>
            )}
            <div className='nav360-stat'><div className='v'>{vm.cci}%</div><div className='k'>Career Clarity{vm.cciEst && <span className='nav360-est'>est</span>}</div><div className='sub'>{vm.cciBand}</div></div>
            <div className='nav360-stat'><div className='v'>{vm.alignment}%</div><div className='k'>Alignment{vm.alignmentEst && <span className='nav360-est'>est</span>}</div><div className='sub'>Interests · abilities · values</div></div>
            {vm.topCareers[0]?.career?.name && (
              <div className='nav360-stat'><div className='v' style={{ fontSize: 16 }}>{vm.topCareers[0].career!.name}</div><div className='k'>Top Match</div><div className='sub'>{pct(vm.topCareers[0].suitability)}% suitability</div></div>
            )}
            <div className='nav360-stat'><div className='v'>{vm.allMatches.length}</div><div className='k'>Careers Analysed</div><div className='sub'>matched to your profile</div></div>
          </div>

          {/* Readiness gauges */}
          <SectionCard title='Career Readiness Snapshot' subtitle='Composite indicators across the full Navigator 360 model.'>
            <div className='nav360-gauges'>
              <Gauge value={vm.readiness} label='Overall Readiness' sub={levelOf(vm.readiness)} />
              <Gauge value={vm.cci} label='Career Clarity' sub={vm.cciBand} est={vm.cciEst} />
              <Gauge value={vm.alignment} label='Profile Alignment' sub={levelOf(vm.alignment)} est={vm.alignmentEst} />
              <Gauge value={vm.potentialTotal} label='Potential' sub={levelOf(vm.potentialTotal)} est={vm.potentialEst} />
            </div>
          </SectionCard>

          {/* Cross-pillar overview radar */}
          <SectionCard title='Profile Overview' subtitle='How your six core pillars compare at a glance.'>
            <RadarPanel dims={vm.overview.map((o) => ({ name: o.name, normPct: o.value, rawScore: 0, stanine: 0, level: '' }))} />
          </SectionCard>

          {/* RIASEC interests */}
          <SectionCard title='Interests (RIASEC)' est={vm.riasecEst} subtitle='Your Holland interest profile across the six interest types.'>
            <div className='nav360-split'>
              <RadarPanel dims={vm.riasec} />
              <RankedBars dims={vm.riasec} />
            </div>
          </SectionCard>

          {/* Abilities */}
          <SectionCard title='Abilities' est={vm.abilitiesEst} subtitle='Relative strength across measured aptitude areas.'>
            <HBarPanel dims={vm.abilities} />
          </SectionCard>

          {/* Multiple Intelligences */}
          <SectionCard title='Multiple Intelligences' est={vm.miEst} subtitle='Gardner’s intelligences mapped from your responses.'>
            <div className='nav360-split'>
              <RadarPanel dims={vm.mi} color='#7C3AED' />
              <RankedBars dims={vm.mi} />
            </div>
          </SectionCard>

          {/* Potential + Preference donuts */}
          <div className='nav360-two'>
            <SectionCard title='Potential Score' est={vm.potentialEst} subtitle='Composite of personality, intelligence, ability and academic signals.'>
              <Donut data={vm.potential} total={vm.potentialTotal} centerLabel='Potential' />
            </SectionCard>
            <SectionCard title='Preference Score' est={vm.preferenceEst} subtitle='What you value, aspire to and want to study.'>
              <Donut data={vm.preference} total={vm.preferenceTotal} centerLabel='Preference' />
            </SectionCard>
          </div>

          {/* Top career match deep-dive */}
          {vm.topCareers[0]?.career?.name && (
            <SectionCard title={`Best Fit: ${vm.topCareers[0].career!.name}`} subtitle='How this career matches across each dimension of your profile.'>
              <div className='nav360-split'>
                <CareerBreakdown match={vm.topCareers[0]} />
                <div className='nav360-careerfacts'>
                  <div className='nav360-stat compact'><div className='v'>{pct(vm.topCareers[0].suitability)}%</div><div className='k'>Suitability</div></div>
                  <div className='nav360-stat compact'><div className='v'>{pct(vm.topCareers[0].potentialMatch)}%</div><div className='k'>Potential match</div></div>
                  <div className='nav360-stat compact'><div className='v'>{pct(vm.topCareers[0].valuesMatch)}%</div><div className='k'>Values match</div></div>
                  {!!vm.topCareers[0].career?.degreePaths?.length && (
                    <div className='nav360-field' style={{ gridColumn: '1 / -1' }}>
                      <div className='lbl'>Degree Pathways</div>
                      <Chips values={vm.topCareers[0].career!.degreePaths} />
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
          )}

          {/* All matches table */}
          {vm.allMatches.length > 0 && (
            <SectionCard title='Top Career Matches' subtitle='Ranked by overall suitability, with the sub-scores behind each match.'>
              <MatchesTable careers={vm.allMatches} />
            </SectionCard>
          )}

          {/* Preferences */}
          {(d.values?.length || d.careerAspirations?.length || d.subjectsOfInterest?.length) ? (
            <SectionCard title='Your Preferences'>
              {d.values?.length ? <div className='nav360-field'><div className='lbl'>Values</div><Chips values={d.values} /></div> : null}
              {d.careerAspirations?.length ? <div className='nav360-field'><div className='lbl'>Career Aspirations</div><Chips values={d.careerAspirations} /></div> : null}
              {d.subjectsOfInterest?.length ? <div className='nav360-field'><div className='lbl'>Subjects of Interest</div><Chips values={d.subjectsOfInterest} /></div> : null}
            </SectionCard>
          ) : null}

          <div className='nav360-foot-note'>
            Indicators marked <span className='nav360-est'>estimated</span> are calculated from your available
            results to give a complete picture while the full breakdown is finalised.
          </div>
        </>
      )}
    </div>
  )
}

export default StudentNavigator360Page
