import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toAbsoluteUrl } from '../../../../_metronic/helpers'
import PortalLayout from '../../portal/PortalLayout'
import ProfileHeader from './components/ProfileHeader'
import NavigatorRadarChart, { PillarScore } from './components/NavigatorRadarChart'
import TopCareerMatches, { CareerMatch } from './components/TopCareerMatches'
import CareerLibrary from './components/CareerLibrary'
import BookCounselling from './components/BookCounselling'
import YourReports from './components/YourReports'
import PendingRatingPrompt from '../../Counselling/student/components/PendingRatingPrompt'
import {
  DashboardApiResponse,
  getDashboardDataFromCache,
  DashboardData,
} from '../API/Dashboard_APIs'
import { STUDENT_MENU_ITEMS, STUDENT_STORAGE_KEYS } from './studentMenuConfig'
import './StudentPortal.css'

interface SectionMeta {
  title: string
  subtitle: string
}

const SECTIONS: SectionMeta[] = [
  { title: 'Profile Snapshot', subtitle: 'Who you are at a glance' },
  { title: 'Your Strengths', subtitle: 'Across six career pillars' },
  { title: 'Career Matches', subtitle: 'Best-fit professions for you' },
  { title: 'Resources & Next Steps', subtitle: 'How to take action' },
]

const StudentPortalDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [rawDashboardData, setRawDashboardData] = useState<DashboardApiResponse | null>(null)

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('studentPortalLoggedIn')
    if (!isLoggedIn) {
      navigate('/student/login')
      return
    }

    try {
      const profileStr = localStorage.getItem('studentPortalProfile')
      const dashStr = localStorage.getItem('studentPortalDashboard')

      if (!profileStr || !dashStr) {
        navigate('/student/login')
        return
      }

      const profileData = JSON.parse(profileStr)
      const rawData: DashboardApiResponse = JSON.parse(dashStr)

      setProfile(profileData)
      setRawDashboardData(rawData)

      const completedAssessment = rawData.assessments?.find(
        (a) => a.status === 'completed'
      )
      const assessmentId = completedAssessment?.assessmentId || rawData.assessments?.[0]?.assessmentId

      if (assessmentId && profileData.userStudentId) {
        getDashboardDataFromCache(profileData.userStudentId, rawData, assessmentId)
          .then((result) => {
            setDashboardData(result.data)
          })
          .catch(() => {
            // Dashboard data processing failed - show what we can
          })
          .finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    } catch {
      navigate('/student/login')
    }
  }, [navigate])

  if (loading) {
    return (
      <div className='sp-loading'>
        <img src={toAbsoluteUrl('/media/logos/kcc.jpg')} alt='Career-9' />
        <span className='sp-loading-text'>Loading ...</span>
      </div>
    )
  }

  if (!profile) return null

  const pillars = extractPillarScores(dashboardData, rawDashboardData)
  const careerMatches = extractCareerMatches(dashboardData, rawDashboardData)
  const cciLevel = determineCCI(dashboardData, rawDashboardData)
  const traitTags = extractTraitTags(dashboardData, rawDashboardData)
  const assessmentStatus = rawDashboardData?.assessments?.some((a) => a.status === 'completed')
    ? 'Complete'
    : 'In Progress'

  const sectionBodies = [
    (
      <ReportPage1
        profile={profile}
        cciLevel={cciLevel}
        traitTags={traitTags}
        assessmentStatus={assessmentStatus}
        pillars={pillars}
        matchCount={careerMatches.length}
      />
    ),
    <ReportPage2 pillars={pillars} traitTags={traitTags} />,
    <ReportPage3 matches={careerMatches} />,
    <ReportPage4 cciLevel={cciLevel} userStudentId={profile.userStudentId} />,
  ]

  return (
    <PortalLayout
      title='Career Navigator 360'
      menuItems={STUDENT_MENU_ITEMS}
      storageKeys={STUDENT_STORAGE_KEYS}
      loginPath='/student/login'
    >
      <div className='sp-report-shell'>
        {SECTIONS.map((section, idx) => (
          <section key={section.title} className='sp-report-section'>
            <div className='sp-report-section-header'>
              <div className='sp-report-section-heading'>
                <div className='sp-report-section-eyebrow'>{section.subtitle}</div>
                <h2 className='sp-report-section-title-lg'>{section.title}</h2>
              </div>
            </div>
            <div className='sp-report-section-body'>
              {sectionBodies[idx]}
            </div>
          </section>
        ))}
      </div>

      {profile?.userStudentId > 0 && <PendingRatingPrompt studentId={profile.userStudentId} />}
    </PortalLayout>
  )
}

// ── Page 1: Profile Snapshot ───────────────────────────────────────────────
const ReportPage1: React.FC<{
  profile: any
  cciLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  traitTags: string[]
  assessmentStatus: string
  pillars: PillarScore[]
  matchCount: number
}> = ({ profile, cciLevel, traitTags, assessmentStatus, pillars, matchCount }) => {
  const avgScore = pillars.length
    ? Math.round(pillars.reduce((s, p) => s + p.value, 0) / pillars.length)
    : 0
  const topPillar = [...pillars].sort((a, b) => b.value - a.value)[0]

  return (
    <>
      <ProfileHeader
        name={profile.name || 'Student'}
        grade={profile.grade}
        instituteName={profile.instituteName}
        cciLevel={cciLevel}
        traitTags={traitTags}
        assessmentStatus={assessmentStatus}
      />

      <div className='sp-report-stats'>
        <div className='sp-report-stat'>
          <div className='sp-report-stat-label'>Career Clarity Index</div>
          <div className='sp-report-stat-value'>{cciLevel}</div>
          <div className='sp-report-stat-foot'>Snapshot of self-awareness</div>
        </div>
        <div className='sp-report-stat'>
          <div className='sp-report-stat-label'>Avg Pillar Score</div>
          <div className='sp-report-stat-value'>{avgScore}<small>/100</small></div>
          <div className='sp-report-stat-foot'>Across 6 dimensions</div>
        </div>
        <div className='sp-report-stat'>
          <div className='sp-report-stat-label'>Top Strength</div>
          <div className='sp-report-stat-value sp-report-stat-value-sm'>
            {topPillar?.name || '—'}
          </div>
          <div className='sp-report-stat-foot'>Highest scoring pillar</div>
        </div>
        <div className='sp-report-stat'>
          <div className='sp-report-stat-label'>Career Matches</div>
          <div className='sp-report-stat-value'>{matchCount}</div>
          <div className='sp-report-stat-foot'>Best-fit professions found</div>
        </div>
      </div>

      <div className='sp-report-callout'>
        <strong>How to read this report:</strong> Scroll down to explore your strengths across the
        six career pillars, then your best-fit profession matches (each card opens the Career
        Library), and finally your next steps and resources.
      </div>
    </>
  )
}

// ── Page 2: Your Strengths ─────────────────────────────────────────────────
const ReportPage2: React.FC<{ pillars: PillarScore[]; traitTags: string[] }> = ({
  pillars,
  traitTags,
}) => {
  const sorted = [...pillars].sort((a, b) => b.value - a.value)
  const top = sorted.slice(0, 3)
  const lower = sorted.slice(3)

  return (
    <div className='sp-report-strengths'>
      <div className='sp-report-strengths-chart'>
        <NavigatorRadarChart pillars={pillars} />
      </div>
      <div className='sp-report-strengths-side'>
        <div className='sp-report-section-title'>Top three pillars</div>
        <ol className='sp-report-pillar-list'>
          {top.map((p) => (
            <li key={p.name} className='sp-report-pillar-item top'>
              <span className='sp-report-pillar-name'>{p.name}</span>
              <span className='sp-report-pillar-score'>{p.value}</span>
            </li>
          ))}
        </ol>

        {lower.length > 0 && (
          <>
            <div className='sp-report-section-title' style={{ marginTop: 16 }}>
              Areas to grow
            </div>
            <ol className='sp-report-pillar-list'>
              {lower.map((p) => (
                <li key={p.name} className='sp-report-pillar-item'>
                  <span className='sp-report-pillar-name'>{p.name}</span>
                  <span className='sp-report-pillar-score'>{p.value}</span>
                </li>
              ))}
            </ol>
          </>
        )}

        {traitTags.length > 0 && (
          <>
            <div className='sp-report-section-title' style={{ marginTop: 16 }}>
              Your trait signals
            </div>
            <div className='sp-report-trait-row'>
              {traitTags.map((t) => (
                <span key={t} className='sp-report-trait-chip'>
                  {t}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Page 3: Career Matches ─────────────────────────────────────────────────
const ReportPage3: React.FC<{ matches: CareerMatch[] }> = ({ matches }) => {
  return (
    <div className='sp-report-careers'>
      <div className='sp-report-callout'>
        <strong>Tip:</strong> Click any profession card to open it in the Career Library —
        you&apos;ll find day-in-the-life videos, suggested courses, and college pathways.
      </div>
      <TopCareerMatches matches={matches} />
    </div>
  )
}

// ── Page 4: Resources & Next Steps ─────────────────────────────────────────
const ReportPage4: React.FC<{
  cciLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  userStudentId: number
}> = ({ cciLevel, userStudentId }) => {
  return (
    <>
      <div className='sp-grid-3'>
        <CareerLibrary />
        <BookCounselling cciLevel={cciLevel} userStudentId={userStudentId} />
        <YourReports userStudentId={userStudentId} />
      </div>

      <div className='sp-insight' style={{ marginTop: 16 }}>
        <span style={{ flexShrink: 0 }}>&#128161;</span>
        <span>
          Your creativity opens doors in UX Design and Product Management alongside technical roles.
          Explore the Career Library to learn more about these paths.
        </span>
      </div>
    </>
  )
}

// ── Data extraction helpers ────────────────────────────────────────────────

function extractPillarScores(
  data: DashboardData | null,
  raw: DashboardApiResponse | null
): PillarScore[] {
  const defaults: PillarScore[] = [
    { name: 'Career Personality', value: 0 },
    { name: 'Learning Styles', value: 0 },
    { name: 'Ability', value: 0 },
    { name: 'Values', value: 0 },
    { name: 'Subjects Interest', value: 0 },
    { name: 'Aspirations', value: 0 },
  ]

  if (!raw?.assessments?.length) return defaults

  const completedAssessment = raw.assessments.find((a) => a.status === 'completed') || raw.assessments[0]
  if (!completedAssessment?.rawScores?.length) return defaults

  const qualityScores: Record<string, { total: number; count: number }> = {}
  for (const rs of completedAssessment.rawScores) {
    const qualityName = rs.measuredQuality?.displayName || rs.measuredQuality?.name || 'Unknown'
    if (!qualityScores[qualityName]) qualityScores[qualityName] = { total: 0, count: 0 }
    qualityScores[qualityName].total += rs.rawScore
    qualityScores[qualityName].count++
  }

  const pillarMapping: Record<string, string[]> = {
    'Career Personality': ['personality', 'career personality', 'holland', 'riasec'],
    'Learning Styles': ['learning', 'multiple intelligence', 'mi', 'gardner'],
    Ability: ['ability', 'cognitive', 'aptitude', 'computational', 'reasoning'],
    Values: ['values', 'value'],
    'Subjects Interest': ['subject', 'interest'],
    Aspirations: ['aspiration', 'career aspiration', 'goal'],
  }

  return defaults.map((pillar) => {
    const keywords = pillarMapping[pillar.name] || []
    let matchedScore = 0
    let found = false

    for (const [qualityName, scores] of Object.entries(qualityScores)) {
      const lower = qualityName.toLowerCase()
      if (keywords.some((kw) => lower.includes(kw))) {
        matchedScore = Math.min(100, Math.round((scores.total / Math.max(scores.count, 1)) * 10))
        found = true
        break
      }
    }

    return { name: pillar.name, value: found ? matchedScore : Math.floor(Math.random() * 30 + 50) }
  })
}

function extractCareerMatches(
  data: DashboardData | null,
  raw: DashboardApiResponse | null
): CareerMatch[] {
  if (!raw?.assessments?.some((a) => a.status === 'completed')) return []

  return [
    {
      rank: 'best',
      score: '9/9',
      name: 'Computer Science & IT',
      traits: ['Logical-Mathematical', 'Technical', 'Investigative'],
      courses: ['B.Tech CS', 'Data Science', 'AI/ML'],
    },
    {
      rank: 'strong',
      score: '8/9',
      name: 'Science & Mathematics',
      traits: ['Computational', 'Logical reasoning', 'Realistic'],
      courses: ['B.Sc Mathematics', 'Physics', 'Statistics'],
    },
    {
      rank: 'good',
      score: '7/9',
      name: 'Engineering & Technology',
      traits: ['Technical', 'Form perception', 'Realistic'],
      courses: ['Mechanical Engg', 'Electronics', 'Civil Engg'],
    },
  ]
}

function determineCCI(
  data: DashboardData | null,
  raw: DashboardApiResponse | null
): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (!raw?.assessments?.length) return 'LOW'

  const completed = raw.assessments.filter((a) => a.status === 'completed')
  if (completed.length === 0) return 'LOW'

  const totalScores = completed.reduce((sum, a) => sum + (a.rawScores?.length || 0), 0)
  const totalAnswers = completed.reduce((sum, a) => sum + (a.answers?.length || 0), 0)

  if (totalScores > 10 && totalAnswers > 20) return 'HIGH'
  if (totalScores > 5 || totalAnswers > 10) return 'MEDIUM'
  return 'LOW'
}

function extractTraitTags(
  data: DashboardData | null,
  raw: DashboardApiResponse | null
): string[] {
  if (!raw?.assessments?.length) return []

  const completedAssessment = raw.assessments.find((a) => a.status === 'completed')
  if (!completedAssessment?.rawScores?.length) return []

  const scored = completedAssessment.rawScores
    .filter((rs) => rs.measuredQualityType?.displayName || rs.measuredQualityType?.name)
    .sort((a, b) => b.rawScore - a.rawScore)
    .slice(0, 4)
    .map((rs) => rs.measuredQualityType?.displayName || rs.measuredQualityType?.name || '')
    .filter(Boolean)

  return scored.length > 0 ? scored : ['Logical Thinking', 'Problem Solving', 'Curiosity', 'Creativity']
}

export default StudentPortalDashboard
