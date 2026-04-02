import React, { useState } from 'react'

interface StudentListPanelProps {
  selectedStudentId: number | null
  onSelectStudent: (id: number) => void
}

// Placeholder student data — will be replaced with API call
const DEMO_STUDENTS = [
  { id: 1, name: 'Aarav Sharma', class: 'Grade 10A', cci: 'high' as const },
  { id: 2, name: 'Priya Patel', class: 'Grade 9B', cci: 'high' as const },
  { id: 3, name: 'Rohan Kumar', class: 'Grade 11A', cci: 'medium' as const },
  { id: 4, name: 'Ananya Gupta', class: 'Grade 10B', cci: 'medium' as const },
  { id: 5, name: 'Vikram Singh', class: 'Grade 9A', cci: 'low' as const },
  { id: 6, name: 'Sneha Reddy', class: 'Grade 11B', cci: 'high' as const },
  { id: 7, name: 'Arjun Nair', class: 'Grade 10A', cci: 'low' as const },
  { id: 8, name: 'Kavya Iyer', class: 'Grade 9B', cci: 'medium' as const },
]

const CCI_BADGE: Record<string, string> = {
  high: 'cp-filter-high',
  medium: 'cp-filter-mod',
  low: 'cp-filter-low',
}

const StudentListPanel: React.FC<StudentListPanelProps> = ({ selectedStudentId, onSelectStudent }) => {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  const filtered = DEMO_STUDENTS.filter((s) => {
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
        {filtered.map((student) => (
          <div
            key={student.id}
            className={`cp-student-item ${selectedStudentId === student.id ? 'active' : ''}`}
            onClick={() => onSelectStudent(student.id)}
          >
            <div>
              <div className='cp-student-name'>{student.name}</div>
              <div className='cp-student-class'>{student.class}</div>
            </div>
            <span className={`cp-filter-tab ${CCI_BADGE[student.cci]}`} style={{ cursor: 'default' }}>
              {student.cci.toUpperCase()}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#5C7A72', fontSize: 12 }}>
            No students found
          </div>
        )}
      </div>
    </div>
  )
}

export default StudentListPanel
