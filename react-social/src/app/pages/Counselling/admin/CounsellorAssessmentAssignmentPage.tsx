import React, { useEffect, useState } from 'react'
import '../Counselling.css'
import PageHeader from '../../../components/PageHeader'
import { getAllCounsellors } from '../API/CounsellorAPI'
import {
  getAssignmentsByAssessment,
  assignCounsellor,
  deleteAssignment,
  getPendingCounsellingRequests,
  getCounsellingEnabledAssessments,
  PendingCounsellingRequest,
} from '../API/CounsellorAssessmentAPI'
import { getAssessmentSummaryList } from '../../AssessmentMapping/API/AssessmentMapping_APIs'
import { useAuth } from '../../../modules/auth'

interface Counsellor {
  id?: number
  counsellorId?: number
  name: string
  email: string
  isActive?: boolean
}
interface AssessmentSummary {
  id: number
  assessmentName: string
  isActive?: boolean
}
interface Assignment {
  id: number
  isActive: boolean
  counsellor?: { id: number; name?: string }
}

const cid = (c: Counsellor) => c.counsellorId || c.id || 0

/**
 * Counselling Phase 4 — admin screen to assign counsellors to an assessment.
 * Counsellors create their own slots; here the admin decides which counsellor(s)
 * handle counselling for a given assessment. Students booking after that assessment
 * are then only offered those counsellors' slots.
 */
const CounsellorAssessmentAssignmentPage: React.FC = () => {
  const { currentUser } = useAuth()
  const [counsellors, setCounsellors] = useState<Counsellor[]>([])
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([])
  // Assessment ids with counselling toggled on in an active tier; null = the
  // lookup hasn't loaded (or failed), in which case no filtering is applied.
  const [counsellingEnabledIds, setCounsellingEnabledIds] = useState<Set<number> | null>(null)
  const [loadedAssessmentId, setLoadedAssessmentId] = useState<number | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [pending, setPending] = useState<PendingCounsellingRequest[]>([])

  const loadPending = () => {
    getPendingCounsellingRequests()
      .then((res) => setPending(res.data || []))
      .catch(() => { /* non-fatal — the panel just stays empty */ })
  }

  useEffect(() => {
    getAllCounsellors()
      .then((res) => setCounsellors(res.data || []))
      .catch(() => setError('Failed to load counsellors.'))
    getAssessmentSummaryList()
      .then((res) => {
        const list: AssessmentSummary[] = (res.data || []).filter((a: AssessmentSummary) => a.assessmentName)
        list.sort((a, b) => a.assessmentName.localeCompare(b.assessmentName))
        setAssessments(list)
      })
      .catch(() => setError('Failed to load assessments.'))
    getCounsellingEnabledAssessments()
      .then((res) => setCounsellingEnabledIds(new Set(res.data || [])))
      .catch(() => { /* non-fatal — dropdown falls back to showing all assessments */ })
    loadPending()
  }, [])

  const load = async (id: number) => {
    if (!id) { setLoadedAssessmentId(null); setAssignments([]); return }
    setLoading(true); setError(''); setInfo('')
    try {
      const res = await getAssignmentsByAssessment(id)
      setAssignments(res.data || [])
      setLoadedAssessmentId(id)
    } catch {
      setError('Failed to load assignments for this assessment.')
    } finally {
      setLoading(false)
    }
  }

  // Active assignment for a counsellor on the loaded assessment, if any.
  const assignmentFor = (counsellorId: number): Assignment | undefined =>
    assignments.find((a) => a.counsellor && a.counsellor.id === counsellorId && a.isActive)

  const toggle = async (c: Counsellor) => {
    if (loadedAssessmentId == null) return
    const counsellorId = cid(c)
    setError(''); setInfo('')
    try {
      const assessmentName =
        assessments.find((a) => a.id === loadedAssessmentId)?.assessmentName || `assessment ${loadedAssessmentId}`
      const existing = assignmentFor(counsellorId)
      if (existing) {
        await deleteAssignment(existing.id)
        setInfo(`Removed ${c.name} from "${assessmentName}".`)
      } else {
        await assignCounsellor(counsellorId, loadedAssessmentId, currentUser?.id)
        setInfo(`Assigned ${c.name} to "${assessmentName}".`)
      }
      const res = await getAssignmentsByAssessment(loadedAssessmentId)
      setAssignments(res.data || [])
      // Assigning a counsellor auto-closes any pending requests for the assessment.
      loadPending()
    } catch {
      setError('Could not update the assignment. Please try again.')
    }
  }

  // Only offer assessments where counselling is toggled on in an active tier —
  // assigning a counsellor to any other assessment would be a no-op for students.
  // The currently-loaded assessment stays visible regardless (the pending-requests
  // panel can open one directly), and if the lookup failed we show everything.
  const selectableAssessments = assessments.filter(
    (a) => counsellingEnabledIds === null || counsellingEnabledIds.has(a.id) || a.id === loadedAssessmentId
  )

  return (
    <div style={{ padding: 24 }}>
      <PageHeader title="Counsellor — Assessment Assignment" />
      <p style={{ color: '#5C7A72', fontSize: 14, marginBottom: 16 }}>
        Choose which counsellors handle counselling for a given assessment. Students who
        finish that assessment are only offered slots from the assigned counsellors. If an
        assessment has no assignments, all institute counsellors remain available. Only
        assessments whose package includes counselling appear in the list.
      </p>

      {pending.length > 0 && (
        <div style={{ marginBottom: 20, border: '1px solid #FCD9A8', borderRadius: 12, background: '#FFF8EE', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', fontWeight: 700, fontSize: 14, color: '#92400E', background: '#FEF1DC' }}>
            ⏳ Students waiting on a counsellor ({pending.length})
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#92400E' }}>
                <th style={{ padding: '8px 14px' }}>Assessment</th>
                <th style={{ padding: '8px 14px' }}>Student</th>
                <th style={{ padding: '8px 14px' }}>Institute</th>
                <th style={{ padding: '8px 14px' }}>Requested</th>
                <th style={{ padding: '8px 14px' }}></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid #FCE7C4' }}>
                  <td style={{ padding: '8px 14px', fontWeight: 600, color: '#1e293b' }}>{r.assessmentName || `#${r.assessmentId}`}</td>
                  <td style={{ padding: '8px 14px', color: '#5C7A72' }}>
                    {r.studentName || `Student #${r.userStudentId}`}
                    {r.studentEmail && <span style={{ color: '#9CA3AF' }}> · {r.studentEmail}</span>}
                  </td>
                  <td style={{ padding: '8px 14px', color: '#5C7A72' }}>{r.instituteName || '—'}</td>
                  <td style={{ padding: '8px 14px', color: '#9CA3AF' }}>{r.createdAt || '—'}</td>
                  <td style={{ padding: '8px 14px' }}>
                    <button
                      onClick={() => load(r.assessmentId)}
                      style={{
                        padding: '5px 14px', borderRadius: 8, border: '1.5px solid #F59E0B', cursor: 'pointer',
                        background: '#FEF3C7', color: '#92400E', fontWeight: 600,
                      }}
                    >
                      Assign counsellor →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <label style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>Assessment</label>
        <select
          value={loadedAssessmentId ?? ''}
          onChange={(e) => load(Number(e.target.value))}
          style={{
            padding: '8px 12px', border: '1.5px solid #D1E5DF', borderRadius: 8,
            minWidth: 320, background: '#fff', fontSize: 14,
          }}
        >
          <option value="">— Select an assessment —</option>
          {selectableAssessments.map((a) => (
            <option key={a.id} value={a.id}>{a.assessmentName}</option>
          ))}
        </select>
        {loading && <span style={{ color: '#5C7A72', fontSize: 13 }}>Loading…</span>}
      </div>

      {error && <div style={{ marginBottom: 12, padding: '10px 14px', background: '#FEE2E2', borderRadius: 8, color: '#991B1B' }}>{error}</div>}
      {info && <div style={{ marginBottom: 12, padding: '10px 14px', background: '#D1FAE5', borderRadius: 8, color: '#065F46' }}>{info}</div>}

      {loadedAssessmentId != null && (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #D1E5DF', borderRadius: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', background: '#F1F8F6' }}>
              <th style={{ padding: 12 }}>Counsellor</th>
              <th style={{ padding: 12 }}>Email</th>
              <th style={{ padding: 12 }}>Assigned</th>
              <th style={{ padding: 12 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {counsellors.map((c) => {
              const assigned = !!assignmentFor(cid(c))
              return (
                <tr key={cid(c)} style={{ borderTop: '1px solid #EEF4F2' }}>
                  <td style={{ padding: 12 }}>{c.name}</td>
                  <td style={{ padding: 12, color: '#5C7A72' }}>{c.email}</td>
                  <td style={{ padding: 12 }}>{assigned ? '✓ Yes' : '—'}</td>
                  <td style={{ padding: 12 }}>
                    <button
                      onClick={() => toggle(c)}
                      style={{
                        padding: '6px 16px', borderRadius: 8, border: '1.5px solid #D1E5DF', cursor: 'pointer',
                        background: assigned ? '#FEE2E2' : '#E8F5E9', color: assigned ? '#991B1B' : '#065F46',
                      }}
                    >
                      {assigned ? 'Remove' : 'Assign'}
                    </button>
                  </td>
                </tr>
              )
            })}
            {counsellors.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#9CA3AF' }}>No counsellors found.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default CounsellorAssessmentAssignmentPage
