import React from 'react'
import { useNavigate } from 'react-router-dom'

interface ProfileHeaderProps {
  name: string
  grade?: number | string
  instituteName?: string
  cciLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  traitTags: string[]
  assessmentStatus?: string
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  name,
  grade,
  instituteName,
  cciLevel,
  traitTags,
  assessmentStatus,
}) => {
  const navigate = useNavigate()
  const initials = name
    ? name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  const cciClass =
    cciLevel === 'HIGH' ? 'sp-cci-high' : cciLevel === 'MEDIUM' ? 'sp-cci-medium' : 'sp-cci-low'

  return (
    <div className='sp-profile-header'>
      <div
        className='sp-avatar'
        onClick={() => navigate('/student/student-info')}
        title='Edit profile'
        style={{ cursor: 'pointer' }}
      >
        {initials}
      </div>
      <div className='sp-profile-info'>
        <div
          className='sp-profile-name'
          onClick={() => navigate('/student/student-info')}
          title='Edit profile'
          style={{ cursor: 'pointer' }}
        >
          {name || 'Student'}
          <svg
            width='14'
            height='14'
            viewBox='0 0 24 24'
            fill='none'
            stroke='#9CA3AF'
            strokeWidth='2'
            style={{ marginLeft: 6, verticalAlign: 'middle' }}
          >
            <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
            <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
          </svg>
        </div>
        <div className='sp-profile-meta'>
          {grade ? `Grade ${grade}` : ''}
          {instituteName ? ` \u00B7 ${instituteName}` : ''}
          {assessmentStatus ? ` \u00B7 Navigator 360: ${assessmentStatus}` : ''}
        </div>
        {traitTags.length > 0 && (
          <div className='sp-trait-tags'>
            {traitTags.map((tag, i) => (
              <span key={i} className='sp-trait-tag'>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className='sp-cci-badge'>
        <div className='sp-cci-label'>Career Clarity Index</div>
        <div className={`sp-cci-value ${cciClass}`}>{cciLevel}</div>
      </div>
    </div>
  )
}

export default ProfileHeader
