import React, { useEffect, useMemo, useState } from 'react'
import { getCounsellorAppointments } from '../../Counselling/API/AppointmentAPI'
import { getMappingsByCounsellor } from '../../Counselling/API/CounsellorInstituteAPI'
import {
  getAssignmentsByCounsellorDetailed,
  CounsellorAssessmentDetail,
} from '../../Counselling/API/CounsellorAssessmentAPI'

interface Props {
  counsellorId: number | null
}

interface InstituteRow {
  name: string
  mapped: boolean // counsellor is formally allocated to this institute
  conducted: number
  upcoming: number
  nextSession: Date | null
}

/** True when the appointment's slot end time is in the past. */
function hasSlotEnded(appt: any): boolean {
  const date = appt?.slot?.date
  const endTime = appt?.slot?.endTime
  if (!date || !endTime) return false
  const end = new Date(`${date}T${endTime}`)
  return !isNaN(end.getTime()) && end.getTime() <= Date.now()
}

function slotStart(appt: any): Date | null {
  const date = appt?.slot?.date
  const start = appt?.slot?.startTime || appt?.slot?.endTime
  if (!date) return null
  const d = new Date(start ? `${date}T${start}` : date)
  return isNaN(d.getTime()) ? null : d
}

/** Institute the booking student belongs to; null for B2C/individual students. */
function getInstituteName(appt: any): string | null {
  return appt?.student?.institute?.instituteName || null
}

const INDIVIDUAL = 'Individual / B2C students'

const fmtDate = (d: Date) =>
  d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Counsellor portal dashboard card: which institutes and assessments this
 * counsellor works with — sessions already conducted and what's coming up.
 * Built from the counsellor's own appointments, institute allocations and
 * assessment assignments (all endpoints the Counsellor role can read).
 */
const CounsellorEngagements: React.FC<Props> = ({ counsellorId }) => {
  const [appointments, setAppointments] = useState<any[]>([])
  const [mappedInstitutes, setMappedInstitutes] = useState<string[]>([])
  const [assessments, setAssessments] = useState<CounsellorAssessmentDetail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!counsellorId) { setLoading(false); return }
    Promise.allSettled([
      getCounsellorAppointments(counsellorId),
      getMappingsByCounsellor(counsellorId),
      getAssignmentsByCounsellorDetailed(counsellorId),
    ]).then(([apptRes, mapRes, asmtRes]) => {
      if (apptRes.status === 'fulfilled') setAppointments(apptRes.value.data || [])
      if (mapRes.status === 'fulfilled') {
        const names = (mapRes.value.data || [])
          .filter((m: any) => m.isActive !== false && m.institute?.instituteName)
          .map((m: any) => m.institute.instituteName as string)
        setMappedInstitutes(names)
      }
      if (asmtRes.status === 'fulfilled') {
        setAssessments((asmtRes.value.data || []).filter((a) => a.isActive !== false))
      }
      setLoading(false)
    })
  }, [counsellorId])

  const { rows, totalConducted, totalUpcoming } = useMemo(() => {
    const byInstitute = new Map<string, InstituteRow>()
    const ensure = (name: string, mapped: boolean): InstituteRow => {
      let row = byInstitute.get(name)
      if (!row) {
        row = { name, mapped, conducted: 0, upcoming: 0, nextSession: null }
        byInstitute.set(name, row)
      }
      row.mapped = row.mapped || mapped
      return row
    }

    mappedInstitutes.forEach((n) => ensure(n, true))

    let conductedTotal = 0
    let upcomingTotal = 0
    for (const appt of appointments) {
      const status = (appt.status || '').toUpperCase()
      // Cancelled/declined/rescheduled rows are dead ends — the rebooked
      // appointment shows up as its own row.
      if (['CANCELLED', 'DECLINED', 'RESCHEDULED'].includes(status)) continue
      const row = ensure(getInstituteName(appt) || INDIVIDUAL, false)
      const ended = hasSlotEnded(appt)
      if (status === 'COMPLETED' || (ended && ['CONFIRMED', 'IN_PROGRESS', 'ENDED'].includes(status))) {
        row.conducted += 1
        conductedTotal += 1
      } else if (!ended) {
        row.upcoming += 1
        upcomingTotal += 1
        const start = slotStart(appt)
        if (start && (!row.nextSession || start < row.nextSession)) row.nextSession = start
      }
    }

    const sorted = Array.from(byInstitute.values()).sort(
      (a, b) => b.upcoming - a.upcoming || b.conducted - a.conducted || a.name.localeCompare(b.name)
    )
    return { rows: sorted, totalConducted: conductedTotal, totalUpcoming: upcomingTotal }
  }, [appointments, mappedInstitutes])

  if (!counsellorId || loading) return null

  const th: React.CSSProperties = {
    textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700,
    color: '#5C7A72', borderBottom: '1px solid #E5EFEB', whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, color: '#1A2B28' }

  return (
    <div className='cp-page-card' style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1A2B28' }}>
            <i className='bi bi-buildings' style={{ marginRight: 8, color: '#0E7C66' }} />
            My institutes &amp; assessments
          </div>
          <div style={{ fontSize: 12.5, color: '#5C7A72', marginTop: 2 }}>
            Where you&apos;ve conducted sessions and what&apos;s coming up
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 999, background: '#E8F5E9', color: '#065F46' }}>
            {totalConducted} conducted
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 999, background: '#DBEAFE', color: '#1D4ED8' }}>
            {totalUpcoming} upcoming
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 20 }}>
        {/* Institutes: conducted vs upcoming */}
        <div style={{ overflowX: 'auto' }}>
          {rows.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9CA3AF', padding: '16px 0' }}>
              No institute allocations or sessions yet.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Institute</th>
                  <th style={{ ...th, textAlign: 'center' }}>Conducted</th>
                  <th style={{ ...th, textAlign: 'center' }}>Upcoming</th>
                  <th style={th}>Next session</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} style={{ borderBottom: '1px solid #F1F7F4' }}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {r.name}
                      {r.mapped && (
                        <span title='You are allocated to this institute'
                          style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#E6F4F1', color: '#0E7C66' }}>
                          Allocated
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'center', color: r.conducted ? '#065F46' : '#9CA3AF' }}>{r.conducted}</td>
                    <td style={{ ...td, textAlign: 'center', color: r.upcoming ? '#1D4ED8' : '#9CA3AF' }}>{r.upcoming}</td>
                    <td style={{ ...td, color: r.nextSession ? '#1A2B28' : '#9CA3AF' }}>
                      {r.nextSession ? fmtDate(r.nextSession) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Assessments this counsellor is assigned to */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#5C7A72', padding: '8px 0', borderBottom: '1px solid #E5EFEB' }}>
            Assessments you counsel for
          </div>
          {assessments.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9CA3AF', padding: '12px 0' }}>
              No specific assessments assigned — you may be offered to students of any
              assessment at your institutes.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: '10px 0 0' }}>
              {assessments.map((a) => (
                <li key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13, color: '#1A2B28' }}>
                  <i className='bi bi-journal-check' style={{ color: '#0E7C66' }} />
                  {a.assessmentName || `Assessment #${a.assessmentId}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default CounsellorEngagements
