import React from 'react'

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
  best: { label: 'Best Match', emoji: '\uD83C\uDFC6', className: 'sp-career-rank-best' },
  strong: { label: 'Strong', emoji: '\uD83C\uDFC5', className: 'sp-career-rank-strong' },
  good: { label: 'Good', emoji: '\uD83E\uDD49', className: 'sp-career-rank-good' },
}

const TopCareerMatches: React.FC<TopCareerMatchesProps> = ({ matches }) => {
  return (
    <div className='sp-card'>
      <div className='sp-card-title'>Top Career Matches</div>

      {matches.map((match, i) => {
        const cfg = rankConfig[match.rank]
        return (
          <div className='sp-career-card' key={i}>
            <div className={`sp-career-rank ${cfg.className}`}>
              {cfg.emoji} {cfg.label} &mdash; {match.score}
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
