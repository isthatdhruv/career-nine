import React from 'react'
import '../../../Counselling/Counselling.css'

interface StatsBarProps {
  stats: {
    pending: number
    assigned: number
    confirmed: number
    thisWeek: number
  }
}

const StatsBar: React.FC<StatsBarProps> = ({ stats }) => {
  return (
    <div className='cl-stats-bar' style={{ marginBottom: 24 }}>
      <div className='cl-stat-item'>
        <span className='cl-stat-label'>Pending</span>
        <span className='cl-stat-value' style={{ color: '#EF4444' }}>{stats.pending}</span>
      </div>
      <div className='cl-stat-item'>
        <span className='cl-stat-label'>Assigned</span>
        <span className='cl-stat-value' style={{ color: '#F59E0B' }}>{stats.assigned}</span>
      </div>
      <div className='cl-stat-item'>
        <span className='cl-stat-label'>Confirmed</span>
        <span className='cl-stat-value' style={{ color: '#10B981' }}>{stats.confirmed}</span>
      </div>
      <div className='cl-stat-item'>
        <span className='cl-stat-label'>This Week</span>
        <span className='cl-stat-value' style={{ color: '#3B82F6' }}>{stats.thisWeek}</span>
      </div>
    </div>
  )
}

export default StatsBar
