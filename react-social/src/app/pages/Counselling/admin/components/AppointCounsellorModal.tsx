import clsx from 'clsx'
import React, { useCallback, useEffect, useState } from 'react'
import { Modal } from 'react-bootstrap-v5'
import {
  getMappingsByCounsellor,
  allocateCounsellor,
  deallocateCounsellor,
  CounsellorInstituteMapping,
} from '../../API/CounsellorInstituteAPI'
import {
  getAssignmentsByCounsellor,
  getAssessmentsByInstitute,
  getCounsellingEnabledAssessments,
  assignCounsellor,
  deleteAssignment,
  InstituteAssessment,
} from '../../API/CounsellorAssessmentAPI'

interface Institute {
  code: number
  name: string
}

interface Props {
  show: boolean
  counsellorId: number
  counsellorName: string
  /** Every institute on the system — the tick list in step 1. */
  institutes: Institute[]
  /** Stamped onto the rows this creates, so the audit trail says who appointed them. */
  assignedBy?: number
  onHide: () => void
  /** Fired after a successful save so the page can refresh its own lists. */
  onSaved: (message: string) => void
}

/** An assessment already assigned to this counsellor, as the server has it. */
interface ExistingAssignment {
  id: number
  assessmentId: number
}

type WizardStep = 1 | 2

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Select Institutes',
  2: 'Select Assessments',
}

/**
 * Appoint a counsellor: which schools they cover, and which assessments within them.
 *
 * <p>Two records back this, and they are deliberately separate on the server: the
 * institute mapping says where the counsellor works, the assessment assignment says what
 * they counsel for, and the student booking flow requires BOTH to match before it will
 * offer that counsellor's slots. Setting them from two different screens made it easy to
 * do one and forget the other — a counsellor mapped to a school but to no assessment is
 * invisible to every student in it. This wizard writes both in one pass.
 *
 * <p>An assessment assignment belongs to the counsellor, not to the pair: the server keys
 * it on (counsellor, assessment). Assessments are grouped by institute here only because
 * that is how an admin thinks about them — picking the same assessment under two schools
 * produces one assignment, not two.
 *
 * <p>Shell, stepper and form classes follow {@code InstituteWizardModal} so this reads as
 * the same product rather than a second dialect of it.
 */
const AppointCounsellorModal: React.FC<Props> = ({
  show,
  counsellorId,
  counsellorName,
  institutes,
  assignedBy,
  onHide,
  onSaved,
}) => {
  const [step, setStep] = useState<WizardStep>(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)

  // What the server currently has, kept so save can work out the difference rather than
  // re-writing rows that have not changed.
  const [existingMappings, setExistingMappings] = useState<CounsellorInstituteMapping[]>([])
  const [existingAssignments, setExistingAssignments] = useState<ExistingAssignment[]>([])

  // What the admin has picked.
  const [pickedInstitutes, setPickedInstitutes] = useState<Set<number>>(new Set())
  const [pickedAssessments, setPickedAssessments] = useState<Set<number>>(new Set())

  // Per-institute assessment catalogue, fetched when step 2 opens.
  const [assessmentsByInstitute, setAssessmentsByInstitute] = useState<Record<number, InstituteAssessment[]>>({})
  const [loadingAssessments, setLoadingAssessments] = useState(false)
  const [openInstitute, setOpenInstitute] = useState<number | null>(null)
  const [instituteSearch, setInstituteSearch] = useState('')

  /**
   * Assessments whose package actually includes counselling, in at least one active tier.
   * Every assessment is listed either way — hiding the rest left the admin wondering why a
   * school's assessment was missing — but the ones counselling was never sold with cannot
   * be ticked: assigning a counsellor there saves a row that does nothing for any student.
   *
   * null means the lookup has not answered (or failed), in which case nothing is disabled
   * rather than everything.
   */
  const [counsellingEnabled, setCounsellingEnabled] = useState<Set<number> | null>(null)
  const isSelectable = (assessmentId: number) =>
    counsellingEnabled === null || counsellingEnabled.has(assessmentId)

  const instituteName = useCallback(
    (code: number) => institutes.find((i) => i.code === code)?.name || `Institute ${code}`,
    [institutes],
  )

  // Prefill from what the counsellor already has, so the wizard shows their current
  // appointment rather than a blank slate the admin would have to re-enter.
  useEffect(() => {
    if (!show) return
    let cancelled = false
    setStep(1)
    setError(null)
    setLoading(true)
    Promise.all([
      getMappingsByCounsellor(counsellorId).catch(() => ({ data: [] as CounsellorInstituteMapping[] })),
      getAssignmentsByCounsellor(counsellorId).catch(() => ({ data: [] as any[] })),
      getCounsellingEnabledAssessments().catch(() => ({ data: null as number[] | null })),
    ])
      .then(([mapRes, assignRes, enabledRes]) => {
        if (cancelled) return
        setCounsellingEnabled(
          Array.isArray(enabledRes.data) ? new Set(enabledRes.data.map(Number)) : null,
        )
        const maps: CounsellorInstituteMapping[] = Array.isArray(mapRes.data) ? mapRes.data : []
        const active = maps.filter((m) => m.isActive)
        setExistingMappings(active)
        setPickedInstitutes(new Set(active.map((m) => m.institute.instituteCode)))

        const raw: any[] = Array.isArray(assignRes.data) ? assignRes.data : []
        const assigns = raw
          .filter((a) => a?.isActive !== false)
          .map((a) => ({ id: a.id, assessmentId: a.assessmentId }))
        setExistingAssignments(assigns)
        setPickedAssessments(new Set(assigns.map((a) => a.assessmentId)))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [show, counsellorId])

  const toggleInstitute = (code: number) => {
    setPickedInstitutes((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const toggleAssessment = (assessmentId: number) => {
    setPickedAssessments((prev) => {
      const next = new Set(prev)
      if (next.has(assessmentId)) next.delete(assessmentId)
      else next.add(assessmentId)
      return next
    })
  }

  /** Step 1 → 2: pull in the assessment list for every institute that was ticked. */
  const handleDone = async () => {
    if (pickedInstitutes.size === 0) {
      setError('Select at least one institute.')
      return
    }
    setError(null)
    setStep(2)
    setLoadingAssessments(true)
    const codes = Array.from(pickedInstitutes)
    const results = await Promise.all(
      codes.map((code) =>
        getAssessmentsByInstitute(code)
          .then((res) => [code, Array.isArray(res.data) ? res.data : []] as const)
          .catch(() => [code, [] as InstituteAssessment[]] as const),
      ),
    )
    const map: Record<number, InstituteAssessment[]> = {}
    for (const [code, list] of results) map[code] = list
    setAssessmentsByInstitute(map)
    setLoadingAssessments(false)
    setOpenInstitute(codes[0] ?? null)
  }

  /**
   * Everything picked, grouped for the review popup. An assessment shows under every
   * institute that offers it — which is what the admin ticked it under.
   */
  const reviewRows = Array.from(pickedInstitutes).map((code) => ({
    code,
    name: instituteName(code),
    assessments: (assessmentsByInstitute[code] || []).filter((a) => pickedAssessments.has(a.id)),
  }))

  /** Drop an institute from the review popup — and any assessment only it offered. */
  const removeInstitute = (code: number) => {
    const remaining = new Set(pickedInstitutes)
    remaining.delete(code)
    setPickedInstitutes(remaining)
    setPickedAssessments((prev) => {
      const stillOffered = new Set<number>()
      for (const c of Array.from(remaining)) {
        for (const a of assessmentsByInstitute[c] || []) stillOffered.add(a.id)
      }
      return new Set(Array.from(prev).filter((id) => stillOffered.has(id)))
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const problems: string[] = []
    const nameOf = (id: number) => {
      for (const list of Object.values(assessmentsByInstitute)) {
        const hit = list.find((a) => a.id === id)
        if (hit) return hit.assessmentName
      }
      return `Assessment ${id}`
    }
    try {
      // ── Institutes ────────────────────────────────────────────────────────────
      const existingCodes = new Set(existingMappings.map((m) => m.institute.instituteCode))
      for (const code of Array.from(pickedInstitutes)) {
        if (existingCodes.has(code)) continue
        try {
          await allocateCounsellor(counsellorId, code, assignedBy)
        } catch {
          problems.push(`Could not add ${instituteName(code)}.`)
        }
      }
      for (const m of existingMappings) {
        if (pickedInstitutes.has(m.institute.instituteCode)) continue
        try {
          await deallocateCounsellor(m.id)
        } catch {
          problems.push(`Could not remove ${m.institute.instituteName}.`)
        }
      }

      // ── Assessments ───────────────────────────────────────────────────────────
      const existingAssessmentIds = new Set(existingAssignments.map((a) => a.assessmentId))
      for (const id of Array.from(pickedAssessments)) {
        if (existingAssessmentIds.has(id)) continue
        try {
          await assignCounsellor(counsellorId, id, assignedBy)
        } catch (e: any) {
          // The server refuses an assessment when the counsellor has no upcoming free
          // slots — students would be sent to an empty calendar. Say so by name; the rest
          // of the save still stands.
          problems.push(e?.response?.data?.error || `Could not add ${nameOf(id)}.`)
        }
      }
      for (const a of existingAssignments) {
        if (pickedAssessments.has(a.assessmentId)) continue
        try {
          await deleteAssignment(a.id)
        } catch {
          problems.push(`Could not remove ${nameOf(a.assessmentId)}.`)
        }
      }

      if (problems.length) {
        setError(problems.join(' '))
        setSaving(false)
        return
      }
      onSaved(
        `${counsellorName} appointed to ${pickedInstitutes.size} institute(s) and ` +
        `${pickedAssessments.size} assessment(s).`,
      )
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  const visibleInstitutes = instituteSearch.trim()
    ? institutes.filter((i) => i.name.toLowerCase().includes(instituteSearch.trim().toLowerCase()))
    : institutes

  const Stepper = (
    <div className='d-flex align-items-center gap-2 mb-4'>
      {([1, 2] as WizardStep[]).map((n, idx) => {
        const active = step === n
        const completed = step > n
        return (
          <div key={n} className='d-flex align-items-center' style={{ flex: 1 }}>
            <button
              type='button'
              onClick={() => { if (n < step) setStep(n) }}
              disabled={n > step}
              className={clsx(
                'btn btn-sm d-flex align-items-center gap-2 flex-grow-1',
                active ? 'btn-primary' : completed ? 'btn-success' : 'btn-light',
              )}
              style={{ borderRadius: 12 }}
            >
              <span className='badge bg-white text-dark' style={{ minWidth: 22, borderRadius: 11 }}>
                {n}
              </span>
              <span className='fw-semibold'>{STEP_LABELS[n]}</span>
            </button>
            {idx < 1 && (
              <span className='mx-2 flex-grow-0' style={{ height: 2, width: 16, background: '#dee2e6' }} />
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <Modal show={show} onHide={onHide} size='xl' centered backdrop='static'
      aria-labelledby='appoint-counsellor-title'>
      <Modal.Header>
        <Modal.Title id='appoint-counsellor-title'>
          <h2 className='mb-0'>Appoint Counsellor</h2>
          <small className='text-muted'>{counsellorName}</small>
        </Modal.Title>
        <div
          className='btn btn-sm btn-icon btn-active-color-primary'
          onClick={onHide}
          style={{ cursor: 'pointer', fontSize: 22, lineHeight: 1 }}
        >
          &times;
        </div>
      </Modal.Header>

      <Modal.Body>
        {Stepper}

        {error && (
          <div className='alert alert-danger py-3 px-4 fs-7'>{error}</div>
        )}

        {loading ? (
          <div className='text-center text-muted py-10 fs-6'>Loading current appointment…</div>
        ) : step === 1 ? (
          <div className='form w-100'>
            <div className='fv-row mb-3'>
              <label className='required fs-6 fw-bold mb-2'>Institutes :</label>
              <div className='text-muted small mb-3'>
                Tick every school this counsellor covers. More than one is fine.
              </div>
              <input
                type='text'
                className='form-control form-control-lg form-control-solid mb-3'
                placeholder='Search institutes…'
                value={instituteSearch}
                onChange={(e) => setInstituteSearch(e.target.value)}
              />
              <div className='border rounded' style={{ maxHeight: 340, overflowY: 'auto' }}>
                {visibleInstitutes.length === 0 ? (
                  <div className='text-center text-muted py-6 fs-7'>No institutes found.</div>
                ) : visibleInstitutes.map((inst, i) => (
                  <label
                    key={inst.code}
                    className={clsx(
                      'd-flex align-items-center gap-3 px-4 py-3 mb-0',
                      i > 0 && 'border-top',
                    )}
                    style={{
                      cursor: 'pointer',
                      background: pickedInstitutes.has(inst.code) ? '#f1faff' : undefined,
                    }}
                  >
                    <input
                      type='checkbox'
                      className='form-check-input m-0'
                      checked={pickedInstitutes.has(inst.code)}
                      onChange={() => toggleInstitute(inst.code)}
                    />
                    <span className='fs-6'>{inst.name}</span>
                  </label>
                ))}
              </div>
              <div className='text-muted small mt-2'>
                {pickedInstitutes.size} institute(s) selected
              </div>
            </div>
          </div>
        ) : (
          <div className='form w-100'>
            <div className='fv-row mb-2'>
              <label className='fs-6 fw-bold mb-2'>Assessments :</label>
              <div className='text-muted small mb-3'>
                Pick the assessments this counsellor handles at each school. A student is only
                offered their slots when both the school and the assessment match. Assessments
                sold without counselling are shown greyed out and cannot be picked.
              </div>
            </div>

            {loadingAssessments ? (
              <div className='text-center text-muted py-8 fs-7'>Loading assessments…</div>
            ) : (
              <div className='d-flex flex-column gap-3'>
                {Array.from(pickedInstitutes).map((code) => {
                  const list = assessmentsByInstitute[code] || []
                  const chosen = list.filter((a) => pickedAssessments.has(a.id))
                  const open = openInstitute === code
                  return (
                    <div key={code} className='border rounded'>
                      <button
                        type='button'
                        onClick={() => setOpenInstitute(open ? null : code)}
                        className='btn btn-light w-100 d-flex align-items-center justify-content-between gap-3 px-4 py-3'
                        style={{ borderRadius: open ? '0.475rem 0.475rem 0 0' : '0.475rem' }}
                      >
                        <span className='fw-bold fs-6'>{instituteName(code)}</span>
                        <span className='d-flex align-items-center gap-2'>
                          <span className={clsx('badge', chosen.length ? 'badge-light-success' : 'badge-light')}>
                            {list.length === 0
                              ? 'No assessments'
                              : chosen.length === 0
                              ? 'None selected'
                              : `${chosen.length} selected`}
                          </span>
                          <i className={clsx('bi', open ? 'bi-chevron-up' : 'bi-chevron-down')} />
                        </span>
                      </button>
                      {open && (
                        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                          {list.length === 0 ? (
                            <div className='text-muted fs-7 px-4 py-3'>
                              This institute has no assessments mapped yet.
                            </div>
                          ) : list.map((a) => {
                            const selectable = isSelectable(a.id)
                            return (
                              <label
                                key={a.id}
                                className='d-flex align-items-center gap-3 px-4 py-2 mb-0 border-top'
                                title={selectable
                                  ? undefined
                                  : 'Counselling is not part of this assessment’s package, so a counsellor cannot be assigned to it.'}
                                style={{
                                  cursor: selectable ? 'pointer' : 'not-allowed',
                                  opacity: selectable ? 1 : 0.45,
                                  background: pickedAssessments.has(a.id)
                                    ? '#f1faff'
                                    : selectable ? undefined : '#f9f9f9',
                                }}
                              >
                                <input
                                  type='checkbox'
                                  className='form-check-input m-0'
                                  checked={pickedAssessments.has(a.id)}
                                  disabled={!selectable}
                                  onChange={() => toggleAssessment(a.id)}
                                />
                                <span className='fs-6'>{a.assessmentName}</span>
                                {!selectable && (
                                  <span className='badge badge-light text-muted ms-auto'>
                                    No counselling in package
                                  </span>
                                )}
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <div className='d-flex justify-content-between w-100'>
          <div>
            {step === 2 && (
              <button type='button' className='btn btn-light' onClick={() => setStep(1)} disabled={saving}>
                Back
              </button>
            )}
          </div>
          <div className='d-flex gap-2'>
            <button type='button' className='btn btn-light' onClick={onHide} disabled={saving}>
              Close
            </button>
            {step === 1 ? (
              <button
                type='button'
                className='btn btn-primary'
                onClick={handleDone}
                disabled={loading || pickedInstitutes.size === 0}
              >
                Done
              </button>
            ) : (
              <>
                <button
                  type='button'
                  className='btn btn-light-primary'
                  onClick={() => setShowReview(true)}
                  disabled={saving}
                >
                  Review Changes
                </button>
                <button type='button' className='btn btn-primary' onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      Saving... <span className='spinner-border spinner-border-sm align-middle ms-2' />
                    </>
                  ) : (
                    'Save'
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </Modal.Footer>

      {/* Review popup — what is about to be saved, with a cross to drop anything. */}
      <Modal show={showReview} onHide={() => setShowReview(false)} centered size='lg'>
        <Modal.Header>
          <Modal.Title>
            <h2 className='mb-0'>Review Changes</h2>
            <small className='text-muted'>{counsellorName}</small>
          </Modal.Title>
          <div
            className='btn btn-sm btn-icon btn-active-color-primary'
            onClick={() => setShowReview(false)}
            style={{ cursor: 'pointer', fontSize: 22, lineHeight: 1 }}
          >
            &times;
          </div>
        </Modal.Header>
        <Modal.Body>
          {reviewRows.length === 0 ? (
            <div className='text-center text-muted py-6 fs-7'>Nothing selected.</div>
          ) : reviewRows.map((row) => (
            <div key={row.code} className='mb-5'>
              <div className='d-flex align-items-center gap-2 mb-2'>
                <span className='fw-bold fs-6'>{row.name}</span>
                <button
                  type='button'
                  className='btn btn-sm btn-icon btn-active-color-danger text-danger p-0'
                  onClick={() => removeInstitute(row.code)}
                  title='Remove this institute'
                  style={{ fontSize: 18, lineHeight: 1 }}
                >
                  &times;
                </button>
              </div>
              {row.assessments.length === 0 ? (
                <div className='text-warning fs-7 ps-1'>
                  No assessment selected — students here will not be offered this counsellor.
                </div>
              ) : (
                <div className='d-flex flex-wrap gap-2 ps-1'>
                  {row.assessments.map((a) => (
                    <span key={a.id} className='badge badge-light-success d-flex align-items-center gap-2 py-2 px-3'>
                      {a.assessmentName}
                      <span
                        onClick={() => toggleAssessment(a.id)}
                        title='Remove this assessment'
                        style={{ cursor: 'pointer', fontSize: 15, lineHeight: 1 }}
                      >
                        &times;
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Modal.Body>
        <Modal.Footer>
          <button type='button' className='btn btn-primary' onClick={() => setShowReview(false)}>
            Back to Editing
          </button>
        </Modal.Footer>
      </Modal>
    </Modal>
  )
}

export default AppointCounsellorModal
