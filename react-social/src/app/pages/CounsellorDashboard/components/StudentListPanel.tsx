import React, { useState, useEffect } from 'react'
import { getStudentsForCounsellor } from '../../Counselling/API/StudentCounsellorMappingAPI'

interface StudentListPanelProps {
  counsellorId: number | null
  selectedStudentId: number | null
  onSelectStudent: (id: number) => void
}

interface MappingEntry {
  id: number
  isActive: boolean
  notes?: string
  student: any
  counsellor?: any
}

interface StudentRow {
  id: number
  name: string
  classInfo: string
  cci: string | null
}

function resolveStudentName(student: any): string {
  return student?.studentInfo?.name || student?.name || 'Unknown'
}

function resolveClassInfo(student: any): string {
  return (
    student?.studentInfo?.className ||
    student?.studentInfo?.class ||
    student?.className ||
    student?.course ||
    student?.branch ||
    ''
  )
}

function resolveCci(student: any): string | null {
  const raw = student?.cciLevel || student?.cci || student?.studentInfo?.cciLevel || null
  if (!raw) return null
  const lower = String(raw).toLowerCase()
  if (lower === 'high') return 'high'
  if (lower === 'medium' || lower === 'moderate') return 'medium'
  if (lower === 'low') return 'low'
  return null
}

const CCI_BADGE: Record<string, string> = {
  high: 'cp-filter-high',
  medium: 'cp-filter-mod',
  low: 'cp-filter-low',
}

const StudentListPanel: React.FC<StudentListPanelProps> = ({ counsellorId, selectedStudentId, onSelectStudent }) => {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!counsellorId) {
      setStudents([])
      return
    }
    setLoadingStudents(true)
    setFetchError(null)
    getStudentsForCounsellor(counsellorId)
      .then((res) => {
        const mappings: MappingEntry[] = Array.isArray(res.data) ? res.data : []
        const active = mappings.filter((m) => m.isActive !== false)
        const rows: StudentRow[] = active.map((m) => ({
          id: m.student?.id || m.student?.userStudentId || m.id,
          name: resolveStudentName(m.student),
          classInfo: resolveClassInfo(m.student),
          cci: resolveCci(m.student),
        }))
        setStudents(rows)
      })
      .catch(() => {
        setFetchError('Failed to load students.')
        setStudents([])
      })
      .finally(() => setLoadingStudents(false))
  }, [counsellorId])

  const filtered = students.filter((s) => {
    if (filter !== 'all' && s.cci !== filter) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className='cp-student-list'>
      <div className='cp-student-list-header'>
        <input
          className='cp-student-search'
          placeholder='Search students...'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className='cp-filter-tabs'>
          <button className={`cp-filter-tab ${filter === 'all' ? 'cp-filter-all' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`cp-filter-tab ${filter === 'high' ? 'cp-filter-high' : ''}`} onClick={() => setFilter('high')}>High CCI</button>
          <button className={`cp-filter-tab ${filter === 'medium' ? 'cp-filter-mod' : ''}`} onClick={() => setFilter('medium')}>Moderate</button>
          <button className={`cp-filter-tab ${filter === 'low' ? 'cp-filter-low' : ''}`} onClick={() => setFilter('low')}>Low</button>
        </div>
      </div>

      <div className='cp-student-items'>
        {loadingStudents ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#6B7A8D', fontSize: 12 }}>
            Loading students...
          </div>
        ) : fetchError ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#991B1B', fontSize: 12 }}>
            {fetchError}
          </div>
        ) : !counsellorId ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#6B7A8D', fontSize: 12 }}>
            No counsellor session found.
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#6B7A8D', fontSize: 12 }}>
            {students.length === 0 ? 'No students assigned' : 'No students found'}
          </div>
        ) : (
          filtered.map((student) => (
            <div
              key={student.id}
              className={`cp-student-item ${selectedStudentId === student.id ? 'active' : ''}`}
              onClick={() => onSelectStudent(student.id)}
            >
              <div>
                <div className='cp-student-name'>{student.name}</div>
                {student.classInfo && (
                  <div className='cp-student-class'>{student.classInfo}</div>
                )}
              </div>
              {student.cci && (
                <span className={`cp-filter-tab ${CCI_BADGE[student.cci]}`} style={{ cursor: 'default' }}>
                  {student.cci.toUpperCase()}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default StudentListPanel
