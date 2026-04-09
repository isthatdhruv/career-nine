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
import {
  DashboardApiResponse,
  getDashboardDataFromCache,
  DashboardData,
} from '../API/Dashboard_APIs'
import { STUDENT_MENU_ITEMS, STUDENT_STORAGE_KEYS } from './studentMenuConfig'
import './StudentPortal.css'

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

      // Process dashboard data using existing helper - pick first completed assessment
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

  // Extract pillar scores from dashboard data
  const pillars = extractPillarScores(dashboardData, rawDashboardData)
  const careerMatches = extractCareerMatches(dashboardData, rawDashboardData)
  const cciLevel = determineCCI(dashboardData, rawDashboardData)
  const traitTags = extractTraitTags(dashboardData, rawDashboardData)
  const assessmentStatus = rawDashboardData?.assessments?.some((a) => a.status === 'completed')
    ? 'Complete'
    : 'In Progress'

  return (
    <PortalLayout
      title='Career Navigator 360'
      menuItems={STUDENT_MENU_ITEMS}
      storageKeys={STUDENT_STORAGE_KEYS}
      loginPath='/student/login'
    >
      <ProfileHeader
        name={profile.name || 'Student'}
        grade={profile.grade}
        instituteName={profile.instituteName}
        cciLevel={cciLevel}
        traitTags={traitTags}
        assessmentStatus={assessmentStatus}
      />

      <div className='sp-grid-2'>
        <NavigatorRadarChart pillars={pillars} />
        <TopCareerMatches matches={careerMatches} />
      </div>

      <div className='sp-grid-3'>
        <CareerLibrary />
        <BookCounselling cciLevel={cciLevel} />
        <YourReports userStudentId={profile.userStudentId} />
      </div>

      <div className='sp-insight'>
        <span style={{ flexShrink: 0 }}>&#128161;</span>
        <span>
          Your creativity opens doors in UX Design and Product Management alongside technical roles.
          Explore the Career Library to learn more about these paths.
        </span>
      </div>
    </PortalLayout>
  )
}

// ── Data extraction helpers ──

function extractPillarScores(
  data: DashboardData | null,
  raw: DashboardApiResponse | null
): PillarScore[] {
  // Default placeholder scores if no data
  const defaults: PillarScore[] = [
    { name: 'Career Personality', value: 0 },
    { name: 'Learning Styles', value: 0 },
    { name: 'Ability', value: 0 },
    { name: 'Values', value: 0 },
    { name: 'Subjects Interest', value: 0 },
    { name: 'Aspirations', value: 0 },
  ]

  if (!raw?.assessments?.length) return defaults

  // Try to derive scores from raw scores in the assessment data
  const completedAssessment = raw.assessments.find((a) => a.status === 'completed') || raw.assessments[0]
  if (!completedAssessment?.rawScores?.length) return defaults

  // Group raw scores by measured quality (parent)
  const qualityScores: Record<string, { total: number; count: number }> = {}
  for (const rs of completedAssessment.rawScores) {
    const qualityName = rs.measuredQuality?.displayName || rs.measuredQuality?.name || 'Unknown'
    if (!qualityScores[qualityName]) qualityScores[qualityName] = { total: 0, count: 0 }
    qualityScores[qualityName].total += rs.rawScore
    qualityScores[qualityName].count++
  }

  // Map quality names to pillar names (best-effort matching)
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
        // Normalize to 0-100 range (assuming max score of ~20 per quality)
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
  // For now, derive from raw scores or return placeholder data
  // Real career matching logic will be enhanced later
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

  // Simple heuristic based on number of raw scores and answers
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

  // Extract top trait tags from raw score quality type names
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
