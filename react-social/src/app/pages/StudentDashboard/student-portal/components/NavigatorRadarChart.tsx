import React from 'react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'

export interface PillarScore {
  name: string
  value: number
}

interface NavigatorRadarChartProps {
  pillars: PillarScore[]
}

const PILLAR_COLORS: Record<string, string> = {
  'Career Personality': '#263B6A',
  'Learning Styles': '#6984A9',
  Ability: '#3B82F6',
  Values: '#A0D585',
  'Subjects Interest': '#7C3AED',
  Aspirations: '#4A6FA5',
}

const NavigatorRadarChart: React.FC<NavigatorRadarChartProps> = ({ pillars }) => {
  const radarData = pillars.map((p) => ({
    subject: p.name.replace('Subjects Interest', 'Subjects'),
    value: p.value,
    fullMark: 100,
  }))

  return (
    <div className='sp-card'>
      <div className='sp-card-title'>Your Navigator 360 Profile</div>

      {/* Radar Chart */}
      <div style={{ width: '100%', height: 220, marginBottom: 16 }}>
        <ResponsiveContainer>
          <RadarChart data={radarData} cx='50%' cy='50%' outerRadius='70%'>
            <PolarGrid stroke='#DDE3EC' />
            {/* @ts-ignore */}
            <PolarAngleAxis
              dataKey='subject'
              tick={{ fontSize: 11, fill: '#6B7A8D' }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Radar
              dataKey='value'
              stroke='#263B6A'
              fill='#6984A9'
              fillOpacity={0.25}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Pillar Bars */}
      {pillars.map((pillar) => {
        const color = PILLAR_COLORS[pillar.name] || '#263B6A'
        return (
          <div className='sp-pillar-row' key={pillar.name}>
            <div className='sp-pillar-label'>{pillar.name}</div>
            <div className='sp-pillar-bar-wrap'>
              <div
                className='sp-pillar-bar-fill'
                style={{ width: `${pillar.value}%`, background: color }}
              />
            </div>
            <div className='sp-pillar-value'>{pillar.value}%</div>
          </div>
        )
      })}
    </div>
  )
}

export default NavigatorRadarChart
