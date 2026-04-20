import React, { useEffect, useState } from 'react'
import axios from 'axios'
import '../Counselling.css'
import {
  getStudentsByInstitute,
  setCounsellingAllowed,
  ManagedStudent,
} from '../API/StudentManagementAPI'
import {
  getGeneratedReportsByStudent,
  toggleReportVisibility,
  GeneratedReport,
} from '../../ReportGeneration/API/GeneratedReport_APIs'

const API_URL = process.env.REACT_APP_API_URL

function formatReportType(type: string): string {
  switch ((type || '').toLowerCase()) {
    case 'navigator': return 'Navigator 360 Report'
    case 'bet': return 'BET Report'
    default:
      if (!type) return 'Report'
      return type.charAt(0).toUpperCase() + type.slice(1) + ' Report'
  }
}

interface Institute {
  code: number
  name: string
}

const Toggle: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
  <button
    onClick={onChange}
    disabled={disabled}
    style={{
      position: 'relative',
      width: 40, height: 22,
      border: 'none', borderRadius: 999,
      background: checked ? '#0C6B5A' : '#CBD5E1',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      transition: 'background 0.2s',
      padding: 0,
    }}
  >
    <span style={{
      position: 'absolute',
      top: 3, left: checked ? 21 : 3,
      width: 16, height: 16,
      borderRadius: '50%', background: '#fff',
      transition: 'left 0.2s',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    }} />
  </button>
)

const ManageStudentsPage: React.FC = () => {
  const [institutes, setInstitutes] = useState<Institute[]>([])
  const [selectedInstitute, setSelectedInstitute] = useState<number | ''>('')
  const [students, setStudents] = useState<ManagedStudent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [searchName, setSearchName] = useState('')
  const [reportsModalStudent, setReportsModalStudent] = useState<ManagedStudent | null>(null)
  const [studentReports, setStudentReports] = useState<GeneratedReport[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState<string | null>(null)
  const [reportTogglingId, setReportTogglingId] = useState<number | null>(null)

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  useEffect(() => {
    axios.get(`${API_URL}/instituteDetail/get`)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : []
        setInstitutes(data.map((i: any) => ({
          code: i.instituteCode || i.institute_code,
          name: i.instituteName || i.institute_name || `Institute ${i.instituteCode}`,
        })))
      })
      .catch(() => setError('Failed to load institutes.'))
  }, [])

  const loadStudents = (code: number) => {
    setLoading(true)
    setError(null)
    getStudentsByInstitute(code)
      .then((res) => setStudents(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error('Failed to load students:', err?.response?.status, err?.response?.data, err)
        const status = err?.response?.status
        if (status === 404) {
          setError('Endpoint not found — please restart the backend to pick up new changes.')
        } else {
          setError(`Failed to load students (${status || 'network error'}). Check browser console.`)
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (selectedInstitute) loadStudents(selectedInstitute as number)
    else setStudents([])
  }, [selectedInstitute])

  const handleToggleCounselling = async (s: ManagedStudent) => {
    const key = `c-${s.userStudentId}`
    setTogglingId(key)
    try {
      await setCounsellingAllowed(s.userStudentId, !s.counsellingAllowed)
      setStudents((prev) => prev.map((x) =>
        x.userStudentId === s.userStudentId ? { ...x, counsellingAllowed: !x.counsellingAllowed } : x
      ))
      showSuccess(`Counselling ${!s.counsellingAllowed ? 'enabled' : 'disabled'} for ${s.name}.`)
    } catch {
      setError('Failed to update counselling access.')
    } finally {
      setTogglingId(null)
    }
  }

  const handleOpenReportsModal = (s: ManagedStudent) => {
    setReportsModalStudent(s)
    setReportsError(null)
    setStudentReports([])
    setReportsLoading(true)
    getGeneratedReportsByStudent(s.userStudentId)
      .then((res) => setStudentReports(Array.isArray(res.data) ? res.data : []))
      .catch(() => setReportsError('Failed to load reports for this student.'))
      .finally(() => setReportsLoading(false))
  }

  const handleCloseReportsModal = () => {
    setReportsModalStudent(null)
    setStudentReports([])
    setReportsError(null)
    setReportTogglingId(null)
  }

  const handleToggleReportVisibility = async (report: GeneratedReport) => {
    const newVisible = !report.visibleToStudent
    setReportTogglingId(report.generatedReportId)
    try {
      await toggleReportVisibility([report.generatedReportId], newVisible)
      setStudentReports((prev) =>
        prev.map((r) =>
          r.generatedReportId === report.generatedReportId
            ? { ...r, visibleToStudent: newVisible }
            : r
        )
      )
    } catch {
      setReportsError('Failed to update report visibility.')
    } finally {
      setReportTogglingId(null)
    }
  }

  const filteredStudents = searchName.trim()
    ? students.filter((s) => (s.name || '').toLowerCase().includes(searchName.trim().toLowerCase()))
    : students

  return (
    <div style={{ padding: '24px 28px', background: 'var(--sp-bg, #F2F7F5)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--sp-text, #1A2B28)' }}>
          Manage Students
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--sp-muted, #5C7A72)' }}>
          Control which students can access counselling and view their reports
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', background: '#FEE2E2',
          border: '1px solid #FECACA', borderRadius: 8, color: '#991B1B', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontSize: 16 }}>&times;</button>
        </div>
      )}
      {success && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', background: '#D1FAE5',
          border: '1px solid #A7F3D0', borderRadius: 8, color: '#065F46', fontSize: 14,
        }}>{success}</div>
      )}

      {/* Institute selector + search */}
      <div className='cl-card' style={{ marginBottom: 16, padding: '12px 20px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--sp-muted, #5C7A72)', whiteSpace: 'nowrap' }}>
          Select Institute:
        </label>
        <select
          value={selectedInstitute}
          onChange={(e) => setSelectedInstitute(e.target.value ? Number(e.target.value) : '')}
          style={{
            padding: '7px 12px', border: '1px solid var(--sp-border, #D1E5DF)',
            borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', minWidth: 250,
          }}
        >
          <option value=''>Choose an institute...</option>
          {institutes.map((i) => (
            <option key={i.code} value={i.code}>{i.name}</option>
          ))}
        </select>
        {selectedInstitute && (
          <input
            type='text'
            placeholder='Search student by name...'
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            style={{
              padding: '7px 12px', border: '1px solid var(--sp-border, #D1E5DF)',
              borderRadius: 8, fontSize: 13, outline: 'none', width: 240, boxSizing: 'border-box',
            }}
          />
        )}
      </div>

      {/* Students Table */}
      {!selectedInstitute ? (
        <div className='cl-card' style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sp-muted, #5C7A72)' }}>
          Select an institute above to view its students.
        </div>
      ) : loading ? (
        <div className='cl-card' style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sp-muted)' }}>
          Loading students...
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className='cl-card' style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sp-muted, #5C7A72)' }}>
          {searchName ? 'No students match the search.' : 'No students found for this institute.'}
        </div>
      ) : (
        <div className='cl-card' style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--sp-border, #D1E5DF)' }}>
                {['Name', 'Grade', 'Allow Counselling', 'Show Reports'].map((col) => (
                  <th key={col} style={{
                    padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 12,
                    color: 'var(--sp-muted, #5C7A72)', textTransform: 'uppercase', letterSpacing: '0.04em',
                    whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s, idx) => (
                <tr key={s.userStudentId} style={{
                  borderBottom: '1px solid var(--sp-border, #D1E5DF)',
                  background: idx % 2 === 0 ? '#fff' : 'var(--sp-bg, #F2F7F5)',
                }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--sp-text, #1A2B28)' }}>{s.name || 'Unknown'}</div>
                    <div style={{ fontSize: 11, color: 'var(--sp-muted, #5C7A72)', marginTop: 2 }}>
                      ID: {s.userStudentId}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--sp-muted, #5C7A72)' }}>
                    {s.grade || '-'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Toggle
                        checked={s.counsellingAllowed}
                        onChange={() => handleToggleCounselling(s)}
                        disabled={togglingId === `c-${s.userStudentId}`}
                      />
                      <span style={{ fontSize: 12, color: s.counsellingAllowed ? '#065F46' : '#6B7280', fontWeight: 500 }}>
                        {s.counsellingAllowed ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button
                      onClick={() => handleOpenReportsModal(s)}
                      style={{
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 8,
                        border: '1px solid #0C6B5A',
                        background: '#fff',
                        color: '#0C6B5A',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Show Reports
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--sp-muted, #5C7A72)', borderTop: '1px solid var(--sp-border, #D1E5DF)' }}>
            {filteredStudents.length} student(s)
          </div>
        </div>
      )}

      {/* Reports Visibility Modal */}
      {reportsModalStudent && (
        <div
          onClick={handleCloseReportsModal}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 640, maxHeight: '85vh', overflow: 'hidden',
              background: '#fff', borderRadius: 14, boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--sp-border, #D1E5DF)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--sp-text, #1A2B28)' }}>
                  Generated Reports
                </div>
                <div style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', marginTop: 2 }}>
                  {reportsModalStudent.name || 'Student'} · ID {reportsModalStudent.userStudentId}
                </div>
              </div>
              <button
                onClick={handleCloseReportsModal}
                style={{
                  border: '1px solid var(--sp-border, #D1E5DF)', background: '#fff',
                  borderRadius: 8, cursor: 'pointer', padding: '4px 10px',
                  fontSize: 18, color: '#6B7280', lineHeight: 1,
                }}
                aria-label='Close'
              >
                &times;
              </button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto' }}>
              {reportsError && (
                <div style={{
                  marginBottom: 12, padding: '10px 14px', background: '#FEE2E2',
                  border: '1px solid #FECACA', borderRadius: 8, color: '#991B1B', fontSize: 13,
                }}>{reportsError}</div>
              )}

              {reportsLoading ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--sp-muted, #5C7A72)', fontSize: 13 }}>
                  Loading reports...
                </div>
              ) : studentReports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--sp-muted, #5C7A72)', fontSize: 13 }}>
                  No generated reports for this student yet.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--sp-border, #D1E5DF)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--sp-muted, #5C7A72)', textTransform: 'uppercase' }}>
                        Report
                      </th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--sp-muted, #5C7A72)', textTransform: 'uppercase' }}>
                        Assessment
                      </th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--sp-muted, #5C7A72)', textTransform: 'uppercase' }}>
                        Status
                      </th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--sp-muted, #5C7A72)', textTransform: 'uppercase' }}>
                        Visibility
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentReports.map((r) => (
                      <tr key={r.generatedReportId} style={{ borderBottom: '1px solid var(--sp-border, #D1E5DF)' }}>
                        <td style={{ padding: '10px', fontWeight: 600, color: 'var(--sp-text, #1A2B28)' }}>
                          {formatReportType(r.typeOfReport)}
                        </td>
                        <td style={{ padding: '10px', color: 'var(--sp-muted, #5C7A72)' }}>
                          {r.assessmentId ?? '-'}
                        </td>
                        <td style={{ padding: '10px', color: 'var(--sp-muted, #5C7A72)' }}>
                          {r.reportStatus}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Toggle
                              checked={r.visibleToStudent}
                              onChange={() => handleToggleReportVisibility(r)}
                              disabled={reportTogglingId === r.generatedReportId}
                            />
                            <span style={{ fontSize: 12, color: r.visibleToStudent ? '#065F46' : '#6B7280', fontWeight: 500 }}>
                              {r.visibleToStudent ? 'Visible' : 'Hidden'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{
              padding: '12px 20px', borderTop: '1px solid var(--sp-border, #D1E5DF)',
              display: 'flex', justifyContent: 'flex-end',
            }}>
              <button
                onClick={handleCloseReportsModal}
                style={{
                  padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                  border: 'none', cursor: 'pointer', background: '#0C6B5A', color: '#fff',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ManageStudentsPage
