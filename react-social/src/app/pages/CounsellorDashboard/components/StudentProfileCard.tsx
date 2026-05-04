import React, { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = process.env.REACT_APP_API_URL

interface StudentProfileCardProps {
  studentId: number
}

interface StudentData {
  name: string
  grade: string
  instituteName: string
  rawScores: { measuredQuality?: { displayName?: string; name?: string }; rawScore: number }[]
}

const StudentProfileCard: React.FC<StudentProfileCardProps> = ({ studentId }) => {
  const [data, setData] = useState<StudentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)

    axios.post(`${API_URL}/assessment-answer/dashboard`, { userStudentId: studentId })
      .then((res) => {
        const d = res.data
        const studentInfo = d?.studentInfo || {}
        const assessments = d?.assessments || []
        const completed = assessments.find((a: any) => a.status === 'completed') || assessments[0]

        setData({
          name: studentInfo.studentName || studentInfo.name || 'Student',
          grade: studentInfo.grade || '',
          instituteName: studentInfo.instituteName || '',
          rawScores: completed?.rawScores || [],
        })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [studentId])

  if (loading) {
    return <div className='cp-empty-state' style={{ color: '#5C7A72', fontSize: 13 }}>Loading student data...</div>
  }

  if (error || !data) {
    return <div className='cp-empty-state' style={{ color: '#991B1B', fontSize: 13 }}>Failed to load student data.</div>
  }

  const initials = data.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)

  // Group raw scores by measured quality (parent) and compute averages
  const qualityScores: { name: string; score: number }[] = []
  const qualityMap: Record<string, { total: number; count: number }> = {}

  for (const rs of data.rawScores) {
    const qName = rs.measuredQuality?.displayName || rs.measuredQuality?.name || 'Unknown'
    if (!qualityMap[qName]) qualityMap[qName] = { total: 0, count: 0 }
    qualityMap[qName].total += rs.rawScore
    qualityMap[qName].count++
  }

  for (const [name, { total, count }] of Object.entries(qualityMap)) {
    qualityScores.push({ name, score: Math.round(total / count) })
  }

  // Determine CCI level
  const totalScores = data.rawScores.length
  const cci = totalScores > 10 ? 'HIGH' : totalScores > 5 ? 'MEDIUM' : 'LOW'
  const cciClass = cci === 'HIGH' ? 'cp-cci-high' : cci === 'MEDIUM' ? 'cp-cci-medium' : 'cp-cci-low'

  return (
    <div className='cp-profile-card'>
      <div className='cp-profile-header'>
        <div className='cp-profile-avatar'>{initials}</div>
        <div>
          <div className='cp-profile-name'>{data.name}</div>
          <div className='cp-profile-meta'>
            {data.grade && <>{data.grade} &middot; </>}
            {data.instituteName || 'Career-9'}
          </div>
        </div>
        <div className='cp-profile-cci'>
          <div className='cp-profile-cci-label'>Career Clarity</div>
          <div className={`cp-profile-cci-value ${cciClass}`}>{cci}</div>
        </div>
      </div>

      {qualityScores.length > 0 ? (
        <div className='cp-profile-scores'>
          {qualityScores.slice(0, 6).map((qs) => (
            <div className='cp-score-item' key={qs.name}>
              <div className='cp-score-label'>{qs.name}</div>
              <div className='cp-score-value'>{qs.score}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '16px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
          No assessment scores available yet.
        </div>
      )}

      <div className='cp-profile-actions'>
        <button className='cp-action-btn cp-action-btn-primary'
          onClick={() => window.open(`/student-dashboard/${studentId}`, '_blank')}>
          View Full Report
        </button>
      </div>
    </div>
  )
}

export default StudentProfileCard
