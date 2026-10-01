import React from 'react'
import { OfflineStudentRow } from '../../Counselling/API/OfflineCounsellingAPI'
import { assessmentStatusLabel, formatDay } from './offlineUtils'

export type RowBusy = 'map' | 'report'
export interface RowMessage {
  kind: 'ok' | 'error'
  text: string
}

interface OfflineStudentListProps {
  /** The rows to render — already filtered and capped by the page. */
  rows: OfflineStudentRow[]
  /** Phone width: cards instead of the table. */
  narrow: boolean
  /** "Class" or "Year" (getInstituteTerms). */
  unitLabel: string
  selected: Set<number>
  onToggle: (userStudentId: number) => void
  /** Header checkbox: acts on the rendered rows only, never on rows hidden by a filter. */
  onToggleAllVisible: () => void
  allVisibleSelected: boolean
  someVisibleSelected: boolean
  /** No rendered row can be selected (all already mapped to me). */
  noneSelectable: boolean
  busy: Record<number, RowBusy | undefined>
  messages: Record<number, RowMessage | undefined>
  releasedAt: Record<number, string | undefined>
  onMap: (row: OfflineStudentRow) => void
  onMarkDone: (row: OfflineStudentRow) => void
  onPhotos: (row: OfflineStudentRow) => void
  onSendReport: (row: OfflineStudentRow) => void
}

/** Rows already mapped to me have nothing for "Map to me" to do, so they can't be selected. */
export const isSelectable = (row: OfflineStudentRow) => !row.mappedToMe

const classSection = (row: OfflineStudentRow) =>
  [row.className, row.sectionName].filter(Boolean).join(' - ') || '—'

const MappingChip: React.FC<{ row: OfflineStudentRow }> = ({ row }) => {
  if (row.mappedToMe) return <span className='cp-off-chip cp-off-chip--mine'>You</span>
  if (row.mappedCounsellorId != null) {
    return (
      <span className='cp-off-chip cp-off-chip--other' title='Mapped to another counsellor'>
        {row.mappedCounsellorName || 'Another counsellor'}
      </span>
    )
  }
  return <span className='cp-off-chip cp-off-chip--muted'>Unmapped</span>
}

const CounsellingCell: React.FC<{ row: OfflineStudentRow }> = ({ row }) => {
  if (!row.done) {
    return (
      <div>
        <span className='cp-off-chip cp-off-chip--muted'>Not done</span>
        {row.liveBookings.length > 0 && (
          <div className='cp-off-sub'>
            <span className='cp-off-chip cp-off-chip--info'>
              Online session booked{row.liveBookings[0].date ? ` · ${formatDay(row.liveBookings[0].date)}` : ''}
            </span>
          </div>
        )}
      </div>
    )
  }
  return (
    <div>
      <span className='cp-off-chip cp-off-chip--done'>Done · {formatDay(row.doneDate)}</span>
      <div className='cp-off-sub'>
        {row.doneByMe ? 'By you' : `By ${row.doneByCounsellorName || 'another counsellor'}`}
        {row.doneOffline ? ' · in person' : ' · online'}
      </div>
      <div className='cp-off-sub' style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
        <span className={`cp-off-chip ${row.otpVerified ? 'cp-off-chip--done' : 'cp-off-chip--muted'}`}>
          {row.otpVerified ? 'OTP verified' : 'OTP not verified'}
        </span>
        {row.photoCount > 0 && (
          <span className='cp-off-chip cp-off-chip--muted'>
            <i className='bi bi-camera' /> {row.photoCount}
          </span>
        )}
      </div>
    </div>
  )
}

const RowActions: React.FC<{
  row: OfflineStudentRow
  busy?: RowBusy
  released?: string
  onMap: () => void
  onMarkDone: () => void
  onPhotos: () => void
  onSendReport: () => void
}> = ({ row, busy, released, onMap, onMarkDone, onPhotos, onSendReport }) => (
  <div className='cp-off-actions'>
    {!row.mappedToMe && (
      <button type='button' className='cp-action-btn' onClick={onMap} disabled={!!busy}>
        {busy === 'map' ? 'Mapping...' : 'Map to me'}
      </button>
    )}
    {!row.done && (
      <button type='button' className='cp-action-btn cp-action-btn-primary' onClick={onMarkDone} disabled={!!busy}>
        Mark done
      </button>
    )}
    {row.done && row.doneAppointmentId != null && (
      <button type='button' className='cp-action-btn' onClick={onPhotos} disabled={!!busy}>
        <i className='bi bi-camera' /> Photos{row.photoCount > 0 ? ` (${row.photoCount})` : ''}
      </button>
    )}
    {/* Only on my own record: the report goes out on the strength of a session I ran. */}
    {row.done && row.doneByMe && row.reportHeld && row.doneAppointmentId != null && (
      <button type='button' className='cp-action-btn' onClick={onSendReport} disabled={!!busy}>
        {busy === 'report' ? 'Sending...' : released ? 'Resend report' : 'Send report'}
      </button>
    )}
  </div>
)

/** Total / mapped to me / done / pending over every row of the assessment. */
export const OfflineStatTiles: React.FC<{ rows: OfflineStudentRow[] }> = ({ rows }) => {
  let mine = 0
  let done = 0
  rows.forEach((r) => {
    if (r.mappedToMe) mine++
    if (r.done) done++
  })
  const tiles = [
    { label: 'Total', value: rows.length, color: '#263B6A' },
    { label: 'Mapped to me', value: mine, color: '#6984A9' },
    { label: 'Done', value: done, color: '#059669' },
    { label: 'Pending', value: rows.length - done, color: '#D97706' },
  ]
  return (
    <div className='cp-off-stats'>
      {tiles.map((t) => (
        <div key={t.label} className='cp-off-stat'>
          <div className='cp-off-stat-value' style={{ color: t.color }}>
            {t.value}
          </div>
          <div className='cp-off-stat-label'>{t.label}</div>
        </div>
      ))}
    </div>
  )
}

const RowNote: React.FC<{ message?: RowMessage }> = ({ message }) =>
  message ? (
    <div style={{ fontSize: 12, marginTop: 6, color: message.kind === 'ok' ? '#065F46' : '#B91C1C' }}>
      {message.text}
    </div>
  ) : null

const SelectBox: React.FC<{
  checked: boolean
  disabled?: boolean
  label: string
  onChange: () => void
  indeterminate?: boolean
}> = ({ checked, disabled, label, onChange, indeterminate }) => (
  // The label is the hit area: 44px on phones (CSS), not just the 18px box.
  <label className='cp-off-check' title={label}>
    <input
      type='checkbox'
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate
      }}
    />
  </label>
)

const OfflineStudentList: React.FC<OfflineStudentListProps> = ({
  rows,
  narrow,
  unitLabel,
  selected,
  onToggle,
  onToggleAllVisible,
  allVisibleSelected,
  someVisibleSelected,
  noneSelectable,
  busy,
  messages,
  releasedAt,
  onMap,
  onMarkDone,
  onPhotos,
  onSendReport,
}) => {
  const headerBox = (
    <SelectBox
      checked={allVisibleSelected}
      indeterminate={someVisibleSelected && !allVisibleSelected}
      disabled={noneSelectable}
      label='Select all shown students'
      onChange={onToggleAllVisible}
    />
  )

  const actionsFor = (row: OfflineStudentRow) => (
    <RowActions
      row={row}
      busy={busy[row.userStudentId]}
      released={releasedAt[row.userStudentId]}
      onMap={() => onMap(row)}
      onMarkDone={() => onMarkDone(row)}
      onPhotos={() => onPhotos(row)}
      onSendReport={() => onSendReport(row)}
    />
  )

  if (narrow) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, fontSize: 12, color: '#6B7A8D' }}>
          {headerBox}
          <span>Select all shown</span>
        </div>
        <div className='cp-off-cards'>
          {rows.map((row) => {
            const isSel = selected.has(row.userStudentId)
            return (
              <div key={row.userStudentId} className={`cp-off-card${isSel ? ' is-selected' : ''}`}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <SelectBox
                    checked={isSel}
                    disabled={!isSelectable(row)}
                    label={`Select ${row.name}`}
                    onChange={() => onToggle(row.userStudentId)}
                  />
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#1A1F2E', fontSize: 14 }}>{row.name}</div>
                        <div className='cp-off-sub'>
                          {unitLabel} {classSection(row)}
                          {row.rollNumber ? ` · Roll ${row.rollNumber}` : ''}
                        </div>
                      </div>
                      <MappingChip row={row} />
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <CounsellingCell row={row} />
                    </div>
                    <div className='cp-off-sub' style={{ marginTop: 4 }}>
                      Assessment: {assessmentStatusLabel(row.assessmentStatus)}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>{actionsFor(row)}</div>
                <RowNote message={messages[row.userStudentId]} />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className='cp-off-table'>
        <thead>
          <tr>
            <th style={{ width: 40 }}>{headerBox}</th>
            <th>Student</th>
            <th>{unitLabel}</th>
            <th>Section</th>
            <th>Assessment</th>
            <th>Counsellor</th>
            <th>Counselling</th>
            <th style={{ minWidth: 200 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSel = selected.has(row.userStudentId)
            return (
              <tr key={row.userStudentId} className={isSel ? 'is-selected' : undefined}>
                <td>
                  <SelectBox
                    checked={isSel}
                    disabled={!isSelectable(row)}
                    label={`Select ${row.name}`}
                    onChange={() => onToggle(row.userStudentId)}
                  />
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{row.name}</div>
                  {row.rollNumber && <div className='cp-off-sub'>Roll {row.rollNumber}</div>}
                </td>
                <td>{row.className || '—'}</td>
                <td>{row.sectionName || '—'}</td>
                <td>{assessmentStatusLabel(row.assessmentStatus)}</td>
                <td>
                  <MappingChip row={row} />
                </td>
                <td>
                  <CounsellingCell row={row} />
                </td>
                <td>
                  {actionsFor(row)}
                  <RowNote message={messages[row.userStudentId]} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default OfflineStudentList
