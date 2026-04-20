import React from 'react'
import { KTSVG } from '../../../../../_metronic/helpers'

export interface CareerMatch {
  rank: 'best' | 'strong' | 'good'
  score: string
  name: string
  traits: string[]
  courses: string[]
}

interface TopCareerMatchesProps {
  matches: CareerMatch[]
}

const rankConfig = {
  best: { label: 'Best Match', iconPath: '/media/icons/duotune/art/art007.svg', tint: '#D4AF37', className: 'sp-career-rank-best' },
  strong: { label: 'Strong', iconPath: '/media/icons/duotune/art/art007.svg', tint: '#A8A8A8', className: 'sp-career-rank-strong' },
  good: { label: 'Good', iconPath: '/media/icons/duotune/general/gen037.svg', tint: '#0C6B5A', className: 'sp-career-rank-good' },
}

const TopCareerMatches: React.FC<TopCareerMatchesProps> = ({ matches }) => {
  return (
    <div className='sp-card'>
      <div className='sp-card-title'>Top Career Matches</div>

      {matches.map((match, i) => {
        const cfg = rankConfig[match.rank]
        return (
          <div className='sp-career-card' key={i}>
            <div className={`sp-career-rank ${cfg.className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: cfg.tint, display: 'inline-flex' }}>
                <KTSVG path={cfg.iconPath} className='svg-icon-2' />
              </span>
              {cfg.label} &mdash; {match.score}
            </div>
            <div className='sp-career-name'>{match.name}</div>
            <div className='sp-career-traits'>{match.traits.join(' \u00B7 ')}</div>
            <div className='sp-career-tags'>
              {match.courses.map((c, j) => (
                <span key={j} className='sp-career-tag'>
                  {c}
                </span>
              ))}
            </div>
          </div>
        )
      })}

      {matches.length === 0 && (
        <div className='sp-insight'>
          <span>Complete your assessment to see career matches.</span>
        </div>
      )}
    </div>
  )
}

export default TopCareerMatches
