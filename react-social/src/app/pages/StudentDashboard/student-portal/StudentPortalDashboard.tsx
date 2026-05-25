import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toAbsoluteUrl } from '../../../../_metronic/helpers'
import { useAuth } from '../../../modules/auth/core/Auth'
import PendingRatingPrompt from '../../Counselling/student/components/PendingRatingPrompt'
import { fetchNavigator360Scores } from '../../ReportsHub/navigator360/Navigator360API'
import { computeNavigator360 } from '../../ReportsHub/navigator360/Navigator360Engine'
import {
  Navigator360Result,
  ScoredDimension,
  CareerMatch,
  RIASEC_LABELS,
  RIASECType,
  ABILITY_SHORT,
  MI_DISPLAY,
} from '../../ReportsHub/navigator360/Navigator360Types'
import { buildFourPagerPlaceholders } from '../../ReportsHub/fourPager/FourPagerEngine'
import { PlaceholderMap, StudentMeta } from '../../ReportsHub/fourPager/FourPagerTypes'
import { DashboardApiResponse } from '../API/Dashboard_APIs'
import './StudentPortal.css'

const LIBRARY_URL = 'https://library.career-9.com/'

const StudentPortalDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [report, setReport] = useState<Navigator360Result | null>(null)
  const [placeholders, setPlaceholders] = useState<PlaceholderMap | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const [hasCompletedAssessment, setHasCompletedAssessment] = useState<boolean>(false)

  useEffect(() => {
    // Phase 19 (19-02): auth gating moved to StudentRoutes' StudentAuthGuard which
    // reads useAuth().currentUser. If we got here, the guard already verified an
    // authenticated student session.
    if (!currentUser) {
      navigate('/student/login')
      return
    }

    try {
      // studentPortalDashboard is dashboard-data cache (NOT auth state) — out of
      // scope for 19-02; tracked in SUMMARY for a future server-fetch migration.
      const dashStr = localStorage.getItem('studentPortalDashboard')

      if (!dashStr) {
        navigate('/student/login')
        return
      }

      const profileData = currentUser as any
      const rawData: DashboardApiResponse = JSON.parse(dashStr)
      setProfile(profileData)

      const completedAssessment = rawData.assessments?.find(
        (a) => a.status === 'completed'
      )
      if (!completedAssessment || !profileData.userStudentId) {
        setHasCompletedAssessment(false)
        setLoading(false)
        return
      }

      setHasCompletedAssessment(true)

      fetchNavigator360Scores(profileData.userStudentId, completedAssessment.assessmentId)
        .then((raw) => {
          if (profileData.grade) raw.studentClass = String(profileData.grade)
          if (profileData.name) raw.studentName = profileData.name
          const computed = computeNavigator360(raw)
          const meta: StudentMeta = {
            studentName: profileData.name || computed.studentName || 'Student',
            studentClass: profileData.grade ? String(profileData.grade) : computed.studentClass || '',
            schoolName: profileData.instituteName,
          }
          setReport(computed)
          setPlaceholders(buildFourPagerPlaceholders(computed, meta))
        })
        .catch((err) => {
          setReportError(err?.message || 'Failed to load your report data')
        })
        .finally(() => setLoading(false))
    } catch {
      navigate('/student/login')
    }
  }, [navigate, currentUser])

  if (loading) {
    return (
      <div className='sp-loading'>
        <img src={toAbsoluteUrl('/media/logos/kcc.jpg')} alt='Career-9' />
        <span className='sp-loading-text'>Loading your report ...</span>
      </div>
    )
  }

  if (!profile) return null

  return (
    <>
      <div className='sp-dash'>
        {!hasCompletedAssessment && !reportError && <EmptyState />}
        {reportError && <ErrorState message={reportError} />}
        {report && placeholders && (
          <ReportDashboard profile={profile} report={report} ph={placeholders} />
        )}
      </div>

      {profile?.userStudentId > 0 && <PendingRatingPrompt studentId={profile.userStudentId} />}
    </>
  )
}

// ── Main report dashboard ─────────────────────────────────────────────────

const ReportDashboard: React.FC<{
  profile: any
  report: Navigator360Result
  ph: PlaceholderMap
}> = ({ profile, report, ph }) => {
  const topRiasec = topN(report.riasec, 3)
  const topMi = topN(report.mi, 3)
  const topAbilities = topN(report.abilities, 4)
  const careerMatches = report.careerMatches.slice(0, 9)
  const strengthProfile = [
    ph.strength_profile_1,
    ph.strength_profile_2,
    ph.strength_profile_3,
    ph.strength_profile_4,
  ].filter(Boolean)
  const growth = [1, 2, 3, 4, 5]
    .map((n) => ({
      name: ph[`growth_${n}_name`],
      level: ph[`growth_${n}_level`],
    }))
    .filter((g) => g.name)

  return (
    <>
      {/* ── Hero header ───────────────────────────────────────────── */}
      <div className='sp-dash-hero'>
        <div className='sp-dash-hero-left'>
          <div className='sp-dash-hero-eyebrow'>
            Career Navigator 360 Report &middot; {ph.report_date}
          </div>
          <h1 className='sp-dash-hero-name'>{profile.name || 'Student'}</h1>
          <div className='sp-dash-hero-meta'>
            {[
              profile.grade && `Grade ${profile.grade}`,
              profile.instituteName,
              ph.school_city,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <div className='sp-dash-hero-pills'>
            {report.hollandCode && (
              <span className='sp-dash-hero-pill'>
                <span className='sp-dash-hero-pill-label'>Holland</span>
                <span className='sp-dash-hero-pill-value'>{report.hollandCode}</span>
              </span>
            )}
            <span className='sp-dash-hero-pill'>
              <span className='sp-dash-hero-pill-label'>CCI</span>
              <span className='sp-dash-hero-pill-value'>{report.cci}</span>
            </span>
            <span className='sp-dash-hero-pill'>
              <span className='sp-dash-hero-pill-label'>Alignment</span>
              <span className='sp-dash-hero-pill-value'>{report.alignmentScore}/100</span>
            </span>
            {ph.career_cluster_count && (
              <span className='sp-dash-hero-pill'>
                <span className='sp-dash-hero-pill-label'>Clusters</span>
                <span className='sp-dash-hero-pill-value'>{ph.career_cluster_count}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <div className='sp-dash-stat-grid'>
        <StatTile
          label='Career Clarity Index'
          value={report.cci}
          tone={report.cci === 'High' ? 'green' : report.cci === 'Moderate' ? 'amber' : 'grey'}
          foot='Self-awareness snapshot'
        />
        <StatTile
          label='Alignment Score'
          value={`${report.alignmentScore}`}
          unit='/100'
          tone='blue'
          foot='Profile vs. preference fit'
        />
        <StatTile
          label='Potential Score'
          value={`${report.potentialScore.total}`}
          unit='/100'
          tone='blue'
          foot={`${report.potentialScore.completionPct}% completion`}
        />
        <StatTile
          label='Top Career Match'
          value={careerMatches[0] ? `${careerMatches[0].suitability9}/9` : '—'}
          tone='green'
          foot={careerMatches[0]?.career.name || 'Pending'}
        />
      </div>

      {/* ── CCI narrative ─────────────────────────────────────────── */}
      {ph.clarity_description && (
        <div className='sp-card sp-dash-narrative'>
          <div className='sp-card-title'>What your CCI means</div>
          <div className='sp-card-sub'>Career Clarity Index &mdash; {ph.clarity_index}</div>
          <p className='sp-dash-narrative-text'>{ph.clarity_description}</p>
        </div>
      )}

      {/* ── Strength profile ──────────────────────────────────────── */}
      {strengthProfile.length > 0 && (
        <div className='sp-card'>
          <div className='sp-card-title'>Your Strength Profile</div>
          <div className='sp-card-sub'>The four personas your profile rests on</div>
          <div className='sp-dash-personas'>
            {strengthProfile.map((label, i) => (
              <div key={i} className='sp-dash-persona'>
                <div className='sp-dash-persona-num'>{i + 1}</div>
                <div className='sp-dash-persona-name'>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Career Personality + Multiple Intelligences ───────────── */}
      <div className='sp-grid-2'>
        <div className='sp-card'>
          <div className='sp-card-title'>Career Personality</div>
          <div className='sp-card-sub'>Top three RIASEC traits driving your profile</div>
          <DimensionList
            items={topRiasec}
            renderName={(d) => RIASEC_LABELS[d.name as RIASECType] || d.name}
            creativeName={(_, i) => ph[`cp_${i + 1}`]}
            creativeDesc={(_, i) => ph[`cp_${i + 1}_desc`]}
          />
        </div>
        <div className='sp-card'>
          <div className='sp-card-title'>Multiple Intelligences</div>
          <div className='sp-card-sub'>Where your thinking comes alive</div>
          <DimensionList
            items={topMi}
            renderName={(d) => MI_DISPLAY[d.name] || d.name}
            creativeName={(_, i) => ph[`mi_${i + 1}`]}
            creativeDesc={(_, i) => ph[`mi_${i + 1}_desc`]}
          />
        </div>
      </div>

      {/* ── Abilities + aggregate ─────────────────────────────────── */}
      <div className='sp-card'>
        <div className='sp-card-title-row'>
          <div>
            <div className='sp-card-title'>Top Abilities</div>
            <div className='sp-card-sub'>The strongest signals from the ability section</div>
          </div>
          {ph.ability_aggregate && (
            <span className='sp-dash-aggregate'>{ph.ability_aggregate}</span>
          )}
        </div>
        <DimensionList
          items={topAbilities}
          renderName={(d) => ABILITY_SHORT[d.name] || d.name}
          creativeName={(_, i) => ph[`ab_${i + 1}`]}
          creativeDesc={(_, i) => ph[`ab_${i + 1}_desc`]}
        />
      </div>

      {/* ── Values · Subjects · Aspirations (with narratives) ─────── */}
      <div className='sp-grid-3'>
        <ChipCard
          title='Values'
          subtitle='What you say matters most'
          chips={report.values}
          footer={ph.values_basis}
        />
        <ChipCard
          title='Subjects of Interest'
          subtitle='Where curiosity pulls you'
          chips={report.subjectsOfInterest}
          footer={ph.subject_alignment}
        />
        <ChipCard
          title='Career Aspirations'
          subtitle='Paths you already imagine'
          chips={report.careerAspirations}
          footer={ph.aspiration_coherence}
        />
      </div>

      {/* ── Top 9 Career Matches (clickable → Library) ────────────── */}
      <div className='sp-card sp-card-careers'>
        <div className='sp-card-title-row'>
          <div>
            <div className='sp-card-title'>Top Career Matches</div>
            <div className='sp-card-sub'>
              {careerMatches.length > 0
                ? `Showing your top ${careerMatches.length} of ${ph.career_cluster_count || careerMatches.length} matches — click any card to explore in the Career Library`
                : 'Click any card to explore it in the Career Library'}
            </div>
          </div>
        </div>

        {careerMatches.length === 0 ? (
          <div className='sp-insight'>
            <span>No career matches yet. Complete your assessment to populate this section.</span>
          </div>
        ) : (
          <div className='sp-dash-career-grid'>
            {careerMatches.map((match, i) => (
              <CareerCard
                key={match.career.id || i}
                match={match}
                index={i}
                desc={ph[`career_${i + 1}_desc`]}
                tags={ph[`career_${i + 1}_tags`]}
                pct={ph[`career_${i + 1}_pct`]}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Areas to Grow ─────────────────────────────────────────── */}
      {growth.length > 0 && (
        <div className='sp-card'>
          <div className='sp-card-title'>Areas to Grow</div>
          <div className='sp-card-sub'>
            Dimensions with the most room to develop &mdash; perfect to talk through with your counsellor
          </div>
          <div className='sp-dash-growth-list'>
            {growth.map((g, i) => (
              <div key={i} className='sp-dash-growth-item'>
                <div className='sp-dash-growth-num'>{i + 1}</div>
                <div className='sp-dash-growth-body'>
                  <div className='sp-dash-growth-name'>{g.name}</div>
                  <span
                    className={`sp-dash-dim-level sp-dash-dim-level-${(g.level || '').toLowerCase()}`}
                  >
                    {g.level || 'LOW'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {ph.growth_note && <div className='sp-dash-growth-note'>{ph.growth_note}</div>}
        </div>
      )}

      <div className='sp-insight'>
        <span style={{ flexShrink: 0 }}>&#128161;</span>
        <span>
          Each career card opens the Career Library in a new tab &mdash; you&apos;ll find
          day-in-the-life videos, suggested courses, and college pathways for that profession.
        </span>
      </div>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

const StatTile: React.FC<{
  label: string
  value: string | number
  unit?: string
  tone: 'green' | 'blue' | 'amber' | 'grey'
  foot?: string
}> = ({ label, value, unit, tone, foot }) => (
  <div className={`sp-dash-stat sp-dash-stat-${tone}`}>
    <div className='sp-dash-stat-label'>{label}</div>
    <div className='sp-dash-stat-value'>
      {value}
      {unit && <small>{unit}</small>}
    </div>
    {foot && <div className='sp-dash-stat-foot'>{foot}</div>}
  </div>
)

const DimensionList: React.FC<{
  items: ScoredDimension[]
  renderName: (d: ScoredDimension) => string
  creativeName?: (d: ScoredDimension, i: number) => string | undefined
  creativeDesc?: (d: ScoredDimension, i: number) => string | undefined
}> = ({ items, renderName, creativeName, creativeDesc }) => {
  if (!items.length) {
    return (
      <div className='sp-dash-dim-empty'>
        Once your assessment is scored, your top results will appear here.
      </div>
    )
  }
  return (
    <ol className='sp-dash-dim-list'>
      {items.map((d, i) => {
        const cName = creativeName?.(d, i)
        const cDesc = creativeDesc?.(d, i)
        const baseName = renderName(d)
        return (
          <li key={d.name} className='sp-dash-dim-item'>
            <div className='sp-dash-dim-row'>
              <div className='sp-dash-dim-namegroup'>
                <span className='sp-dash-dim-name'>{cName || baseName}</span>
                {cName && cName !== baseName && (
                  <span className='sp-dash-dim-subname'>{baseName}</span>
                )}
              </div>
              <span
                className={`sp-dash-dim-level sp-dash-dim-level-${d.level.toLowerCase()}`}
              >
                {d.level}
              </span>
            </div>
            {cDesc && <div className='sp-dash-dim-desc'>{cDesc}</div>}
            <div className='sp-dash-dim-bar'>
              <div
                className={`sp-dash-dim-bar-fill sp-dash-dim-bar-${d.level.toLowerCase()}`}
                style={{ width: `${Math.min(100, Math.max(0, d.normPct))}%` }}
              />
            </div>
            <div className='sp-dash-dim-meta'>
              <span>Stanine {d.stanine}/9</span>
              <span>{d.normPct.toFixed(0)} percentile</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

const ChipCard: React.FC<{
  title: string
  subtitle: string
  chips: string[]
  footer?: string
}> = ({ title, subtitle, chips, footer }) => (
  <div className='sp-card'>
    <div className='sp-card-title'>{title}</div>
    <div className='sp-card-sub'>{subtitle}</div>
    {chips.length === 0 ? (
      <div className='sp-dash-dim-empty'>None selected.</div>
    ) : (
      <div className='sp-dash-chips'>
        {chips.map((c) => (
          <span key={c} className='sp-dash-chip'>
            {c}
          </span>
        ))}
      </div>
    )}
    {footer && <div className='sp-dash-card-foot'>{footer}</div>}
  </div>
)

const rankConfig: Record<number, { label: string; tone: string }> = {
  0: { label: 'Best Match', tone: 'best' },
  1: { label: '2nd Match', tone: 'best' },
  2: { label: '3rd Match', tone: 'strong' },
  3: { label: '4th', tone: 'strong' },
  4: { label: '5th', tone: 'strong' },
  5: { label: '6th', tone: 'good' },
  6: { label: '7th', tone: 'good' },
  7: { label: '8th', tone: 'good' },
  8: { label: '9th', tone: 'good' },
}

const CareerCard: React.FC<{
  match: CareerMatch
  index: number
  desc?: string
  tags?: string
  pct?: string
}> = ({ match, index, desc, tags, pct }) => {
  const cfg = rankConfig[index] || { label: `#${index + 1}`, tone: 'good' }
  const tagList = (tags || '')
    .split(/[·,;|]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 4)
  const courses = (match.career.degreePaths || []).slice(0, 3)
  const pctNum = pct ? parseInt(pct, 10) : match.suitability

  return (
    <a
      href={LIBRARY_URL}
      target='_blank'
      rel='noopener noreferrer'
      className={`sp-dash-career sp-dash-career-${cfg.tone}`}
      title={`Open ${match.career.name} in Career Library`}
    >
      <div className='sp-dash-career-head'>
        <span className='sp-dash-career-rank'>{cfg.label}</span>
        <span className='sp-dash-career-score'>{match.suitability9}/9</span>
      </div>
      <div className='sp-dash-career-name'>
        {match.career.name}
        <span className='sp-dash-career-arrow' aria-hidden='true'>↗</span>
      </div>
      {desc && <div className='sp-dash-career-desc'>{desc}</div>}
      {match.isAspiration && (
        <div className='sp-dash-career-aspiration'>You picked this as an aspiration</div>
      )}
      {tagList.length > 0 && (
        <div className='sp-dash-career-tags'>
          {tagList.map((t) => (
            <span key={t} className='sp-dash-career-tag'>
              {t}
            </span>
          ))}
        </div>
      )}
      {courses.length > 0 && (
        <div className='sp-dash-career-courses'>
          {courses.map((c) => (
            <span key={c} className='sp-dash-career-course'>{c}</span>
          ))}
        </div>
      )}
      <div className='sp-dash-career-footer'>
        <div className='sp-dash-career-bar'>
          <div className='sp-dash-career-bar-fill' style={{ width: `${pctNum}%` }} />
        </div>
        <div className='sp-dash-career-stats'>
          <span>Suitability {pctNum}%</span>
          <span>·</span>
          <span>Values {match.valuesMatch}%</span>
        </div>
      </div>
    </a>
  )
}

// ── Empty / error states ──────────────────────────────────────────────────

const EmptyState: React.FC = () => (
  <div className='sp-dash-state'>
    <h3>Your report isn&apos;t ready yet</h3>
    <p>
      Complete your Career Navigator 360 assessment to unlock your personalised report.
      Click <strong>Assessments</strong> on the left to begin.
    </p>
  </div>
)

const ErrorState: React.FC<{ message: string }> = ({ message }) => (
  <div className='sp-dash-state sp-dash-state-error'>
    <h3>We couldn&apos;t load your report</h3>
    <p>{message}</p>
  </div>
)

// ── Helpers ────────────────────────────────────────────────────────────────

function topN(list: ScoredDimension[], n: number): ScoredDimension[] {
  return [...list]
    .sort((a, b) => b.normPct - a.normPct || b.stanine - a.stanine)
    .slice(0, n)
}

export default StudentPortalDashboard
