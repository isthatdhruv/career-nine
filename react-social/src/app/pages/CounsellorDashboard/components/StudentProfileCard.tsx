import React from 'react'

interface StudentProfileCardProps {
  studentId: number
}

// Placeholder — will fetch from API using studentId
const DEMO_PROFILES: Record<number, any> = {
  1: { name: 'Aarav Sharma', class: 'Grade 10A', school: 'Sunrise Public School', cci: 'HIGH', personality: 78, learning: 82, ability: 71, values: 85, subjects: 74, aspirations: 68 },
  2: { name: 'Priya Patel', class: 'Grade 9B', school: 'Sunrise Public School', cci: 'HIGH', personality: 85, learning: 76, ability: 80, values: 72, subjects: 88, aspirations: 75 },
  3: { name: 'Rohan Kumar', class: 'Grade 11A', school: 'Sunrise Public School', cci: 'MEDIUM', personality: 65, learning: 58, ability: 72, values: 60, subjects: 55, aspirations: 48 },
  4: { name: 'Ananya Gupta', class: 'Grade 10B', school: 'Sunrise Public School', cci: 'MEDIUM', personality: 70, learning: 62, ability: 68, values: 75, subjects: 60, aspirations: 55 },
  5: { name: 'Vikram Singh', class: 'Grade 9A', school: 'Sunrise Public School', cci: 'LOW', personality: 40, learning: 35, ability: 45, values: 50, subjects: 38, aspirations: 30 },
  6: { name: 'Sneha Reddy', class: 'Grade 11B', school: 'Sunrise Public School', cci: 'HIGH', personality: 88, learning: 80, ability: 85, values: 78, subjects: 82, aspirations: 90 },
  7: { name: 'Arjun Nair', class: 'Grade 10A', school: 'Sunrise Public School', cci: 'LOW', personality: 42, learning: 38, ability: 50, values: 45, subjects: 35, aspirations: 28 },
  8: { name: 'Kavya Iyer', class: 'Grade 9B', school: 'Sunrise Public School', cci: 'MEDIUM', personality: 60, learning: 65, ability: 55, values: 70, subjects: 58, aspirations: 52 },
}

const StudentProfileCard: React.FC<StudentProfileCardProps> = ({ studentId }) => {
  const profile = DEMO_PROFILES[studentId]
  if (!profile) return <div className='cp-empty-state'>Student data not available</div>

  const initials = profile.name.split(' ').map((w: string) => w[0]).join('').toUpperCase()
  const cciClass = profile.cci === 'HIGH' ? 'cp-cci-high' : profile.cci === 'MEDIUM' ? 'cp-cci-medium' : 'cp-cci-low'

  return (
    <div className='cp-profile-card'>
      <div className='cp-profile-header'>
        <div className='cp-profile-avatar'>{initials}</div>
        <div>
          <div className='cp-profile-name'>{profile.name}</div>
          <div className='cp-profile-meta'>{profile.class} &middot; {profile.school}</div>
        </div>
        <div className='cp-profile-cci'>
          <div className='cp-profile-cci-label'>Career Clarity</div>
          <div className={`cp-profile-cci-value ${cciClass}`}>{profile.cci}</div>
        </div>
      </div>

      <div className='cp-profile-scores'>
        <div className='cp-score-item'>
          <div className='cp-score-label'>Personality</div>
          <div className='cp-score-value'>{profile.personality}%</div>
        </div>
        <div className='cp-score-item'>
          <div className='cp-score-label'>Learning</div>
          <div className='cp-score-value'>{profile.learning}%</div>
        </div>
        <div className='cp-score-item'>
          <div className='cp-score-label'>Ability</div>
          <div className='cp-score-value'>{profile.ability}%</div>
        </div>
        <div className='cp-score-item'>
          <div className='cp-score-label'>Values</div>
          <div className='cp-score-value'>{profile.values}%</div>
        </div>
        <div className='cp-score-item'>
          <div className='cp-score-label'>Subjects</div>
          <div className='cp-score-value'>{profile.subjects}%</div>
        </div>
        <div className='cp-score-item'>
          <div className='cp-score-label'>Aspirations</div>
          <div className='cp-score-value'>{profile.aspirations}%</div>
        </div>
      </div>

      <div className='cp-profile-actions'>
        <button className='cp-action-btn cp-action-btn-primary'>View Full Report</button>
        <button className='cp-action-btn'>Add Session Note</button>
        <button className='cp-action-btn'>Schedule Appointment</button>
      </div>
    </div>
  )
}

export default StudentProfileCard
