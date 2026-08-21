import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudentData } from '../StudentDataContext'
import '../StudentPortal.css'

/**
 * "My Reports" empty state.
 *
 * A report only reaches the student after two gates: the report row must be
 * generated (report_url present) AND an admin must release it
 * (GeneratedReport.visibleToStudent, false by default). Until both are true the
 * list is empty — so rather than one flat "nothing here" line we say where the
 * student stands, derived from the assessment statuses already in the login
 * bootstrap (no extra request). Kept deliberately quiet: one narrow card.
 */

type Stage = 'no-assessment' | 'assessment-pending' | 'awaiting-release'

interface StepDef {
  name: string
  state: 'done' | 'active' | 'pending'
}

const CheckIcon: React.FC = () => (
  <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3.5' strokeLinecap='round' strokeLinejoin='round'>
    <path d='M20 6L9 17l-5-5' />
  </svg>
)

const ReportsEmptyState: React.FC = () => {
  const navigate = useNavigate()
  const { data } = useStudentData()

  const { stage, completedNames } = useMemo(() => {
    const assessments = data.assessments || []
    const completed = assessments.filter(
      (a: any) => String(a?.status || '').toLowerCase() === 'completed'
    )
    const s: Stage =
      completed.length > 0
        ? 'awaiting-release'
        : assessments.length > 0
        ? 'assessment-pending'
        : 'no-assessment'
    return {
      stage: s,
      completedNames: completed.map(
        (a: any) => a?.assessmentName || `Assessment #${a?.assessmentId}`
      ) as string[],
    }
  }, [data])

  const copy = {
    'awaiting-release': {
      status: 'In preparation',
      live: true,
      title: 'Your report is being prepared',
      sub: 'Your responses have been received. Your report will appear here as soon as it is generated and released to you.',
    },
    'assessment-pending': {
      status: 'Assessment pending',
      live: false,
      title: 'Your report is not ready yet',
      sub: 'Your report is built from your assessment responses. Complete your assessment to unlock it.',
    },
    'no-assessment': {
      status: 'Awaiting assessment',
      live: false,
      title: 'No reports available yet',
      sub: 'Reports appear here once an assessment has been assigned, completed and released by your school.',
    },
  }[stage]

  const steps: StepDef[] = [
    {
      name: 'Assessment completed',
      state: stage === 'awaiting-release' ? 'done' : stage === 'assessment-pending' ? 'active' : 'pending',
    },
    { name: 'Report generated', state: stage === 'awaiting-release' ? 'active' : 'pending' },
    { name: 'Released to you', state: 'pending' },
  ]

  return (
    <div className='sp-rep-empty'>
      <div className='sp-rep-icon'>
        <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round'>
          <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
          <polyline points='14 2 14 8 20 8' />
        </svg>
      </div>

      <div className={`sp-rep-status${copy.live ? '' : ' sp-rep-status-idle'}`}>
        <span className='sp-rep-status-dot' />
        {copy.status}
      </div>

      <h3 className='sp-rep-title'>{copy.title}</h3>
      <p className='sp-rep-sub'>{copy.sub}</p>

      {completedNames.length > 0 && (
        <p className='sp-rep-for'>
          Awaiting report for <strong>{completedNames.join(', ')}</strong>
        </p>
      )}

      {/* Where the student sits in the assessment → generated → released pipeline */}
      <div className='sp-rep-steps'>
        {steps.map((s, i) => (
          <div key={s.name} className={`sp-rep-step sp-rep-step-${s.state}`}>
            <div className='sp-rep-step-mark'>{s.state === 'done' ? <CheckIcon /> : i + 1}</div>
            <div className='sp-rep-step-name'>{s.name}</div>
          </div>
        ))}
      </div>

      <p className='sp-rep-foot'>
        {stage === 'awaiting-release'
          ? 'Released by your school or counsellor once reviewed. This page updates automatically.'
          : 'This page updates automatically — your report will appear here once released.'}
      </p>

      {stage !== 'awaiting-release' && (
        <div className='sp-rep-actions'>
          <button
            className='sp-rep-btn sp-rep-btn-primary'
            onClick={() => navigate('/student/dashboard/assessments')}
          >
            Go to My Assessments
          </button>
        </div>
      )}
    </div>
  )
}

export default ReportsEmptyState
