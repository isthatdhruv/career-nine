import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PortalLayout from '../portal/PortalLayout'
import PageHeader from '../../components/PageHeader'
import { getInstituteTerms } from '../College/utils/instituteTerms'
import {
  OfflineAssessment,
  OfflineStudentRow,
  getOfflineAssessments,
  getOfflineStudents,
  mapStudentsToMe,
  offlineApiErrorOf,
  useOfflineCounsellingContext,
} from '../Counselling/API/OfflineCounsellingAPI'
import { releaseReportToStudent } from '../Counselling/API/AppointmentAPI'
import { showSuccessToast } from '../../utils/toast'
import OfflineStudentList, { OfflineStatTiles, RowBusy, RowMessage, isSelectable } from './offline/OfflineStudentList'
import OfflineFilters, {
  EMPTY_FILTERS,
  StudentFilters,
  matchesFilters,
  secondaryFilterCount,
} from './offline/OfflineFilters'
import MarkDoneModal from './offline/MarkDoneModal'
import BulkMapConfirmModal from './offline/BulkMapConfirmModal'
import SessionPhotosModal from './offline/SessionPhotosModal'
import { chunk, collator, compareRows, distinctSorted, skipReasonText, useIsNarrow } from './offline/offlineUtils'
import './CounsellorPortal.css'

/** Rows rendered per "page"; a school can have ~4000 students and phones are the target. */
const PAGE_SIZE = 50
/** Ids per map-to-me request — well under the server's 500 cap, so one call stays quick. */
const MAP_CHUNK = 200

interface Notice {
  kind: 'warn' | 'error'
  text: string
}

/** The server's message for a failed call, else `fallback` (network errors have no body). */
function errorText(e: any, fallback: string): string {
  const err = offlineApiErrorOf(e)
  return err?.message || (e?.response?.data?.error as string) || fallback
}

/**
 * Offline counselling — for counsellors an admin has flagged "offline": the school
 * schedules the sessions and the counsellor sees students in person.
 *
 * <p>Lists every student allotted the chosen assessment in one of the counsellor's schools.
 * The counsellor takes students over ("Map to me", one or in bulk) and records sessions as
 * done. The server returns the whole list in one call and every filter runs here, so only
 * {@link PAGE_SIZE} rows are rendered at a time, with "Show more".
 *
 * <p>Selection is only cleared by a change of school or assessment — the rows are the same
 * students under any other filter, so selecting one class, then another, builds one batch.
 * The header checkbox only touches the rows on screen, never rows a filter hides.
 */
const CounsellorOfflineSessionsPage: React.FC = () => {
  const { ctx, loading: ctxLoading, reload: reloadCtx } = useOfflineCounsellingContext(true)
  const narrow = useIsNarrow()

  const institutes = useMemo(
    () =>
      (ctx?.institutes || [])
        .slice()
        .sort((a, b) => collator.compare(a.instituteName || '', b.instituteName || '')),
    [ctx]
  )
  const [instituteCode, setInstituteCode] = useState<number | null>(null)
  const [assessments, setAssessments] = useState<OfflineAssessment[]>([])
  const [assessmentsLoading, setAssessmentsLoading] = useState(false)
  const [assessmentsError, setAssessmentsError] = useState('')
  const [assessmentsVersion, setAssessmentsVersion] = useState(0)
  const [assessmentId, setAssessmentId] = useState('')
  const [filters, setFilters] = useState<StudentFilters>(EMPTY_FILTERS)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const patchFilters = (patch: Partial<StudentFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setVisibleCount(PAGE_SIZE)
  }

  /**
   * Switches school. The assessment is cleared in the same update, not by an effect
   * afterwards — otherwise the students list would first be requested for the new school
   * with the old school's assessment.
   */
  const selectSchool = (code: number | null) => {
    setAssessmentId('')
    setAssessments([])
    setFilters(EMPTY_FILTERS)
    setVisibleCount(PAGE_SIZE)
    setInstituteCode(code)
  }

  const selectAssessment = (id: string) => {
    setAssessmentId(id)
    setVisibleCount(PAGE_SIZE)
  }

  // First school by default; switch only if the current one is no longer mapped to me.
  useEffect(() => {
    if (instituteCode != null && institutes.some((i) => i.instituteCode === instituteCode)) return
    selectSchool(institutes.length > 0 ? institutes[0].instituteCode : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutes])
  const institute = institutes.find((i) => i.instituteCode === instituteCode) || null
  const terms = getInstituteTerms(institute?.isSchool)

  // ── Assessments of the chosen school ──
  useEffect(() => {
    setAssessmentsError('')
    if (instituteCode == null) return
    let cancelled = false
    setAssessmentsLoading(true)
    getOfflineAssessments(instituteCode)
      .then((res) => {
        if (cancelled) return
        const list = Array.isArray(res.data) ? res.data : []
        setAssessments(list)
        // Only one to choose from: choose it.
        if (list.length === 1) setAssessmentId((prev) => prev || String(list[0].assessmentId))
      })
      .catch((e) => {
        if (!cancelled) setAssessmentsError(errorText(e, 'Could not load the assessments for this school.'))
      })
      .finally(() => {
        if (!cancelled) setAssessmentsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [instituteCode, assessmentsVersion])

  const assessment = assessments.find((a) => String(a.assessmentId) === assessmentId) || null

  // ── Students ──
  const [rows, setRows] = useState<OfflineStudentRow[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)
  const [rowsError, setRowsError] = useState('')
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  // Only the newest request may write: a quick switch of assessment must not be
  // overwritten by the slower answer for the previous one.
  const rowsRequest = useRef(0)

  /** `silent` keeps the current rows on screen while refreshing (after an action). */
  const loadRows = useCallback(
    (silent: boolean = false) => {
      const seq = ++rowsRequest.current
      const aid = Number(assessmentId)
      if (instituteCode == null || !aid) {
        setRows([])
        setRowsLoading(false)
        setRowsError('')
        return
      }
      if (!silent) {
        setRows([])
        setRowsLoading(true)
      }
      setRowsError('')
      getOfflineStudents(instituteCode, aid)
        .then((res) => {
          if (seq !== rowsRequest.current) return
          const list = Array.isArray(res.data) ? res.data : []
          setRows(list.map((r) => ({ ...r, liveBookings: r.liveBookings || [] })))
        })
        .catch((e) => {
          if (seq === rowsRequest.current) setRowsError(errorText(e, 'Could not load the students.'))
        })
        .finally(() => {
          if (seq === rowsRequest.current) setRowsLoading(false)
        })
    },
    [instituteCode, assessmentId]
  )

  // A new school or assessment is a new list: start it with nothing selected.
  useEffect(() => {
    setSelected(new Set())
    loadRows()
  }, [loadRows])

  // ── Filtering, selection, stats ──
  const classOptions = useMemo(() => distinctSorted(rows.map((r) => r.className)), [rows])
  // Sections of the chosen class only — "A" of one class is not "A" of another.
  const sectionOptions = useMemo(
    () =>
      distinctSorted(rows.filter((r) => !filters.className || r.className === filters.className).map((r) => r.sectionName)),
    [rows, filters.className]
  )
  const filtered = useMemo(() => rows.filter((r) => matchesFilters(r, filters)).sort(compareRows), [rows, filters])
  const anyFilter = secondaryFilterCount(filters) > 0 || filters.search.trim() !== ''

  const visibleRows = filtered.slice(0, visibleCount)
  const selectableVisible = visibleRows.filter(isSelectable)
  const allVisibleSelected =
    selectableVisible.length > 0 && selectableVisible.every((r) => selected.has(r.userStudentId))
  const someVisibleSelected = selectableVisible.some((r) => selected.has(r.userStudentId))
  // Rows since mapped to me drop out of the batch on their own.
  const selectedRows = rows.filter((r) => selected.has(r.userStudentId) && isSelectable(r))
  const takeoverRows = selectedRows.filter((r) => r.mappedCounsellorId != null)

  const clearFilters = () => patchFilters(EMPTY_FILTERS)

  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) selectableVisible.forEach((r) => next.delete(r.userStudentId))
      else selectableVisible.forEach((r) => next.add(r.userStudentId))
      return next
    })

  // ── Row actions ──
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState<Record<number, RowBusy | undefined>>({})
  const [messages, setMessages] = useState<Record<number, RowMessage | undefined>>({})
  const [releasedAt, setReleasedAt] = useState<Record<number, string | undefined>>({})
  const [markRow, setMarkRow] = useState<OfflineStudentRow | null>(null)
  const [photosRow, setPhotosRow] = useState<OfflineStudentRow | null>(null)

  // Row notes and "report sent" marks are keyed by student but belong to one assessment's
  // list: a report sent for a student's record under one assessment says nothing about
  // their record under another, so a new school or assessment starts them afresh.
  useEffect(() => {
    setBusy({})
    setMessages({})
    setReleasedAt({})
  }, [instituteCode, assessmentId])

  const setRowBusy = (id: number, value?: RowBusy) => setBusy((p) => ({ ...p, [id]: value }))
  const setRowMessage = (id: number, value?: RowMessage) => setMessages((p) => ({ ...p, [id]: value }))

  const handleMapOne = async (row: OfflineStudentRow) => {
    if (row.mappedCounsellorId != null && !row.mappedToMe) {
      const from = row.mappedCounsellorName || 'another counsellor'
      if (!window.confirm(`${row.name} is mapped to ${from}. Take this student over?`)) return
    }
    setRowBusy(row.userStudentId, 'map')
    setRowMessage(row.userStudentId, undefined)
    try {
      const res = await mapStudentsToMe([row.userStudentId])
      const mine = (res.data?.results || []).find((r) => r.userStudentId === row.userStudentId)
      if (!mine || mine.status === 'SKIPPED') {
        setRowMessage(row.userStudentId, { kind: 'error', text: skipReasonText(mine?.reason) })
        return
      }
      // Patched in place: reloading a whole school's list for one row would be wasteful.
      setRows((prev) =>
        prev.map((r) =>
          r.userStudentId === row.userStudentId
            ? { ...r, mappedToMe: true, mappedCounsellorId: ctx?.counsellorId ?? null, mappedCounsellorName: ctx?.name ?? null }
            : r
        )
      )
      showSuccessToast(
        mine.status === 'TAKEN_OVER'
          ? `${row.name} taken over from ${mine.previousCounsellorName || 'another counsellor'}.`
          : `${row.name} is now mapped to you.`
      )
    } catch (e) {
      setRowMessage(row.userStudentId, { kind: 'error', text: errorText(e, 'Could not map this student to you.') })
    } finally {
      setRowBusy(row.userStudentId, undefined)
    }
  }

  /** Same release as on the Appointments page; re-sendable for a student who lost the mail. */
  const handleSendReport = async (row: OfflineStudentRow) => {
    if (row.doneAppointmentId == null) return
    setRowBusy(row.userStudentId, 'report')
    setRowMessage(row.userStudentId, undefined)
    try {
      const res = await releaseReportToStudent(row.doneAppointmentId)
      const to = res.data?.recipients?.join(', ')
      setReleasedAt((p) => ({ ...p, [row.userStudentId]: res.data?.releasedAt || new Date().toISOString() }))
      showSuccessToast(`Report sent to ${to || row.name}.`)
    } catch (e: any) {
      // No report yet / no address: the counsellor's to act on, so shown as the server wrote it.
      setRowMessage(row.userStudentId, {
        kind: 'error',
        text: e?.response?.data?.error || e?.response?.data?.message || 'Could not send the report. Please try again.',
      })
    } finally {
      setRowBusy(row.userStudentId, undefined)
    }
  }

  const closeMarkDone = (changed: boolean) => {
    setMarkRow(null)
    if (changed) loadRows(true)
  }

  const closePhotos = () => {
    const row = photosRow
    setPhotosRow(null)
    // My own record's photo count may have changed.
    if (row?.doneByMe) loadRows(true)
  }

  // ── Bulk map-to-me ──
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkProgress, setBulkProgress] = useState('')

  const takeoverSummary = useMemo(() => {
    const byName: Record<string, number> = {}
    takeoverRows.forEach((r) => {
      const n = r.mappedCounsellorName || 'Another counsellor'
      byName[n] = (byName[n] || 0) + 1
    })
    return Object.keys(byName)
      .sort(collator.compare)
      .map((n) => `${n} (${byName[n]})`)
      .join(', ')
  }, [takeoverRows])

  const runBulkMap = async () => {
    const ids = selectedRows.map((r) => r.userStudentId)
    if (ids.length === 0 || bulkBusy) return
    const nameOf: Record<number, string> = {}
    selectedRows.forEach((r) => {
      nameOf[r.userStudentId] = r.name
    })
    setBulkBusy(true)
    setNotice(null)
    let moved = 0
    let takenOver = 0
    const skipped: string[] = []
    let sent = 0
    try {
      const parts = chunk(ids, MAP_CHUNK)
      for (let i = 0; i < parts.length; i++) {
        setBulkProgress(
          parts.length > 1 ? `Mapping ${sent + 1}–${sent + parts[i].length} of ${ids.length}...` : 'Mapping...'
        )
        const res = await mapStudentsToMe(parts[i])
        moved += (res.data?.mappedCount || 0) + (res.data?.takenOverCount || 0)
        takenOver += res.data?.takenOverCount || 0
        const results = res.data?.results || []
        results.forEach((r) => {
          if (r.status === 'SKIPPED') {
            skipped.push(`${nameOf[r.userStudentId] || `#${r.userStudentId}`}: ${skipReasonText(r.reason, true)}`)
          }
        })
        sent += parts[i].length
      }
      setSelected(new Set())
      setBulkConfirmOpen(false)
      showSuccessToast(
        `${moved} student${moved === 1 ? '' : 's'} mapped to you${takenOver ? ` (${takenOver} taken over)` : ''}.`
      )
      if (skipped.length > 0) {
        const more = skipped.length > 5 ? `; and ${skipped.length - 5} more` : ''
        setNotice({ kind: 'warn', text: `${skipped.length} not mapped — ${skipped.slice(0, 5).join('; ')}${more}.` })
      }
    } catch (e) {
      setBulkConfirmOpen(false)
      const partial = sent > 0 ? `The first ${sent} of ${ids.length} went through before this failed: ` : ''
      setNotice({ kind: 'error', text: partial + errorText(e, 'Could not map the students. Please try again.') })
    } finally {
      setBulkBusy(false)
      setBulkProgress('')
      loadRows(true)
    }
  }

  // ── Render ──
  const emptyState = (title: string, body: React.ReactNode, action?: React.ReactNode) => (
    <div className='cp-page-card' style={{ textAlign: 'center', padding: '48px 20px', color: '#6B7A8D' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#263B6A', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, maxWidth: 460, margin: '0 auto' }}>{body}</div>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
  const listMessage = (text: React.ReactNode) => (
    <div style={{ textAlign: 'center', padding: 32, color: '#6B7A8D', fontSize: 14 }}>{text}</div>
  )

  let body: React.ReactNode
  if (ctxLoading) {
    body = <div className='cp-page-card'>{listMessage('Loading...')}</div>
  } else if (!ctx) {
    body = emptyState(
      "Couldn't check your access",
      'Something went wrong while loading your counsellor profile.',
      <button type='button' className='cp-action-btn cp-off-touch' onClick={reloadCtx}>
        Try again
      </button>
    )
  } else if (!ctx.offline) {
    body = emptyState(
      "Offline counselling isn't enabled for your account",
      'This page is for counsellors who run in-person sessions at schools. If that is you, ask your Career-9 admin to turn it on.'
    )
  } else if (institutes.length === 0) {
    body = emptyState(
      "You aren't mapped to a school yet",
      'Ask your Career-9 admin to map you to the schools where you counsel students.'
    )
  } else {
    let list: React.ReactNode
    if (!assessment) {
      list = listMessage(
        assessmentsLoading
          ? 'Loading assessments...'
          : assessments.length === 0 && !assessmentsError
          ? 'No students of this school have been allotted an assessment yet.'
          : 'Pick an assessment to see its students.'
      )
    } else if (rowsLoading) {
      list = listMessage('Loading students...')
    } else if (rowsError) {
      list = listMessage(
        <>
          <div style={{ color: '#B91C1C', marginBottom: 12 }}>{rowsError}</div>
          <button type='button' className='cp-action-btn cp-off-touch' onClick={() => loadRows()}>
            Try again
          </button>
        </>
      )
    } else if (filtered.length === 0) {
      list = listMessage(
        rows.length === 0 ? (
          'No students are allotted this assessment.'
        ) : (
          <>
            No students match these filters.
            <div style={{ marginTop: 10 }}>
              <button type='button' className='cp-action-btn cp-off-touch' onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          </>
        )
      )
    } else {
      list = (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 10,
              fontSize: 12,
              color: '#6B7A8D',
            }}
          >
            <span>
              Showing {visibleRows.length} of {filtered.length}
              {filtered.length !== rows.length ? ` (${rows.length} in all)` : ''}
            </span>
            {anyFilter && (
              <button type='button' className='btn btn-link btn-sm p-0 cp-off-hit' onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
          <OfflineStudentList
            rows={visibleRows}
            narrow={narrow}
            unitLabel={terms.unit}
            selected={selected}
            onToggle={toggleOne}
            onToggleAllVisible={toggleAllVisible}
            allVisibleSelected={allVisibleSelected}
            someVisibleSelected={someVisibleSelected}
            noneSelectable={selectableVisible.length === 0}
            busy={busy}
            messages={messages}
            releasedAt={releasedAt}
            onMap={handleMapOne}
            onMarkDone={setMarkRow}
            onPhotos={setPhotosRow}
            onSendReport={handleSendReport}
          />
          {filtered.length > visibleRows.length && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button
                type='button'
                className='cp-action-btn cp-off-touch'
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              >
                Show more ({filtered.length - visibleRows.length} more)
              </button>
            </div>
          )}
        </>
      )
    }

    body = (
      <>
        <OfflineFilters
          institutes={institutes}
          instituteCode={instituteCode}
          onSchoolChange={selectSchool}
          assessments={assessments}
          assessmentId={assessmentId}
          onAssessmentChange={selectAssessment}
          assessmentsLoading={assessmentsLoading}
          assessmentsError={assessmentsError}
          onRetryAssessments={() => setAssessmentsVersion((v) => v + 1)}
          hasAssessment={!!assessment}
          filters={filters}
          onFiltersChange={patchFilters}
          classOptions={classOptions}
          sectionOptions={sectionOptions}
          terms={terms}
          narrow={narrow}
        />

        {/* The whole assessment, not the filtered view */}
        {assessment && !rowsLoading && !rowsError && <OfflineStatTiles rows={rows} />}

        <div className='cp-page-card'>{list}</div>

        {selectedRows.length > 0 && (
          <div className='cp-off-bulkbar' role='region' aria-label='Selected students'>
            <span>
              <strong>{selectedRows.length}</strong> selected
              {takeoverRows.length > 0 ? ` · ${takeoverRows.length} with other counsellors` : ''}
            </span>
            <div className='cp-off-actions'>
              <button
                type='button'
                className='cp-action-btn cp-off-touch'
                onClick={() => setSelected(new Set())}
                disabled={bulkBusy}
              >
                Clear
              </button>
              <button
                type='button'
                className='cp-action-btn cp-off-touch'
                style={{ fontWeight: 700 }}
                onClick={() => setBulkConfirmOpen(true)}
                disabled={bulkBusy}
              >
                Map to me
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <PortalLayout>
      <PageHeader
        icon={<i className='bi bi-people' />}
        title='Offline Counselling'
        subtitle={
          institutes.length === 1
            ? `Record in-person sessions at ${institutes[0].instituteName}`
            : 'Record in-person counselling sessions at your schools'
        }
        actions={
          ctx?.offline && assessment
            ? [{ label: 'Refresh', iconClass: 'bi-arrow-clockwise', onClick: () => loadRows(true), disabled: rowsLoading }]
            : undefined
        }
      />
      <div style={{ height: 12 }} />

      {notice && (
        <div
          style={{
            background: notice.kind === 'error' ? '#FEE2E2' : '#FEF3C7',
            color: notice.kind === 'error' ? '#991B1B' : '#92400E',
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>{notice.text}</span>
          <button
            type='button'
            aria-label='Dismiss'
            className='cp-off-hit'
            onClick={() => setNotice(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      )}

      {body}

      <BulkMapConfirmModal
        show={bulkConfirmOpen}
        count={selectedRows.length}
        takeoverCount={takeoverRows.length}
        takeoverSummary={takeoverSummary}
        busy={bulkBusy}
        progress={bulkProgress}
        onCancel={() => setBulkConfirmOpen(false)}
        onConfirm={runBulkMap}
      />

      {markRow && assessment && (
        <MarkDoneModal
          row={markRow}
          assessmentId={assessment.assessmentId}
          assessmentName={assessment.assessmentName}
          unitLabel={terms.unit}
          onClose={closeMarkDone}
        />
      )}

      <SessionPhotosModal row={photosRow} onClose={closePhotos} />
    </PortalLayout>
  )
}

export default CounsellorOfflineSessionsPage
