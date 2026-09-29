import React, { useState } from 'react'
import SearchableSelect from '../../../components/SearchableSelect'
import { InstituteTerms } from '../../College/utils/instituteTerms'
import { OfflineAssessment, OfflineInstitute, OfflineStudentRow } from '../../Counselling/API/OfflineCounsellingAPI'
import { ASSESSMENT_STATUS_LABELS } from './offlineUtils'

export type MappingFilter = '' | 'mine' | 'other' | 'unmapped'
export type DoneFilter = '' | 'done' | 'notdone'

/** Everything that narrows the list without changing it ('' = no filter). */
export interface StudentFilters {
  search: string
  className: string
  sectionName: string
  mapping: MappingFilter
  done: DoneFilter
  /** 'notstarted' | 'ongoing' | 'completed' */
  status: string
}

export const EMPTY_FILTERS: StudentFilters = {
  search: '',
  className: '',
  sectionName: '',
  mapping: '',
  done: '',
  status: '',
}

/** Filters other than search — the ones folded behind "More filters" on a phone. */
export function secondaryFilterCount(f: StudentFilters): number {
  return [f.className, f.sectionName, f.mapping, f.done, f.status].filter(Boolean).length
}

export function matchesFilters(r: OfflineStudentRow, f: StudentFilters): boolean {
  if (f.className && r.className !== f.className) return false
  // A section can only match students that have one; the rest drop out, as elsewhere.
  if (f.sectionName && r.sectionName !== f.sectionName) return false
  if (f.mapping === 'mine' && !r.mappedToMe) return false
  if (f.mapping === 'other' && (r.mappedToMe || r.mappedCounsellorId == null)) return false
  if (f.mapping === 'unmapped' && (r.mappedToMe || r.mappedCounsellorId != null)) return false
  if (f.done === 'done' && !r.done) return false
  if (f.done === 'notdone' && r.done) return false
  if (f.status && (r.assessmentStatus || 'notstarted').toLowerCase() !== f.status) return false
  const q = f.search.trim().toLowerCase()
  if (q) {
    const name = (r.name || '').toLowerCase()
    const roll = (r.rollNumber || '').toLowerCase()
    if (!name.includes(q) && !roll.includes(q)) return false
  }
  return true
}

interface OfflineFiltersProps {
  institutes: OfflineInstitute[]
  instituteCode: number | null
  onSchoolChange: (code: number | null) => void
  assessments: OfflineAssessment[]
  assessmentId: string
  onAssessmentChange: (id: string) => void
  assessmentsLoading: boolean
  assessmentsError: string
  onRetryAssessments: () => void
  /** Secondary filters only make sense once there is a list to filter. */
  hasAssessment: boolean
  filters: StudentFilters
  onFiltersChange: (patch: Partial<StudentFilters>) => void
  classOptions: string[]
  sectionOptions: string[]
  terms: InstituteTerms
  narrow: boolean
}

const Field: React.FC<{ label: string; htmlFor?: string; children: React.ReactNode }> = ({ label, htmlFor, children }) => (
  <div>
    <label className='cp-off-label' htmlFor={htmlFor}>
      {label}
    </label>
    {children}
  </div>
)

/**
 * School (only when there is more than one), assessment and search, then the narrowing
 * filters. On a phone the narrowing filters sit behind a "More filters (n)" toggle so the
 * list starts above the fold.
 */
const OfflineFilters: React.FC<OfflineFiltersProps> = ({
  institutes,
  instituteCode,
  onSchoolChange,
  assessments,
  assessmentId,
  onAssessmentChange,
  assessmentsLoading,
  assessmentsError,
  onRetryAssessments,
  hasAssessment,
  filters,
  onFiltersChange,
  classOptions,
  sectionOptions,
  terms,
  narrow,
}) => {
  const [expanded, setExpanded] = useState(false)
  const activeCount = secondaryFilterCount(filters)

  return (
    <div className='cp-page-card' style={{ marginBottom: 16 }}>
      <div className='cp-off-filters'>
        {institutes.length > 1 && (
          <Field label='School'>
            <SearchableSelect
              options={institutes.map((i) => ({ value: String(i.instituteCode), label: i.instituteName }))}
              value={instituteCode != null ? String(instituteCode) : ''}
              onChange={(v) => {
                const code = v ? Number(v) : null
                if (code !== instituteCode) onSchoolChange(code)
              }}
              placeholder='Select a school'
              isClearable={false}
            />
          </Field>
        )}
        <Field label='Assessment'>
          <SearchableSelect
            options={assessments.map((a) => ({
              value: String(a.assessmentId),
              label: `${a.assessmentName} (${a.studentCount})`,
            }))}
            value={assessmentId}
            onChange={onAssessmentChange}
            placeholder={assessmentsLoading ? 'Loading...' : 'Select an assessment'}
            disabled={assessmentsLoading}
            isClearable={false}
          />
        </Field>
        <Field label='Search' htmlFor='offline-search'>
          <input
            id='offline-search'
            type='search'
            className='form-control'
            placeholder='Name or roll number'
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            disabled={!hasAssessment}
          />
        </Field>
      </div>

      {narrow && hasAssessment && (
        <button
          type='button'
          className='cp-action-btn cp-off-touch'
          style={{ marginTop: 10, width: '100%' }}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Hide filters' : 'More filters'}
          {activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
      )}

      {hasAssessment && (!narrow || expanded) && (
        <div className='cp-off-filters' style={{ marginTop: 12 }}>
          <Field label={terms.unit} htmlFor='offline-class'>
            <select
              id='offline-class'
              className='form-select'
              value={filters.className}
              onChange={(e) => onFiltersChange({ className: e.target.value, sectionName: '' })}
            >
              <option value=''>All {terms.unitPlural.toLowerCase()}</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label='Section' htmlFor='offline-section'>
            <select
              id='offline-section'
              className='form-select'
              value={filters.sectionName}
              onChange={(e) => onFiltersChange({ sectionName: e.target.value })}
            >
              <option value=''>All sections</option>
              {sectionOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label='Mapping' htmlFor='offline-mapping'>
            <select
              id='offline-mapping'
              className='form-select'
              value={filters.mapping}
              onChange={(e) => onFiltersChange({ mapping: e.target.value as MappingFilter })}
            >
              <option value=''>All</option>
              <option value='mine'>Mapped to me</option>
              <option value='other'>Other counsellor</option>
              <option value='unmapped'>Unmapped</option>
            </select>
          </Field>
          <Field label='Counselling' htmlFor='offline-done'>
            <select
              id='offline-done'
              className='form-select'
              value={filters.done}
              onChange={(e) => onFiltersChange({ done: e.target.value as DoneFilter })}
            >
              <option value=''>All</option>
              <option value='done'>Done</option>
              <option value='notdone'>Not done</option>
            </select>
          </Field>
          <Field label='Assessment status' htmlFor='offline-status'>
            <select
              id='offline-status'
              className='form-select'
              value={filters.status}
              onChange={(e) => onFiltersChange({ status: e.target.value })}
            >
              <option value=''>All</option>
              {Object.keys(ASSESSMENT_STATUS_LABELS).map((k) => (
                <option key={k} value={k}>
                  {ASSESSMENT_STATUS_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {assessmentsError && (
        <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 8 }}>
          {assessmentsError}{' '}
          <button type='button' className='btn btn-link btn-sm p-0' onClick={onRetryAssessments}>
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

export default OfflineFilters
