import React from 'react'

interface Counsellor {
  counsellorId: number
  name: string
  specializations?: string
  isActive?: boolean
}

interface AssignCounsellorDropdownProps {
  counsellors: Counsellor[]
  selectedCounsellorId: number | null
  onSelect: (counsellorId: number | null) => void
}

const AssignCounsellorDropdown: React.FC<AssignCounsellorDropdownProps> = ({
  counsellors,
  selectedCounsellorId,
  onSelect,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    onSelect(value ? Number(value) : null)
  }

  return (
    <select
      value={selectedCounsellorId ?? ''}
      onChange={handleChange}
      style={{
        padding: '6px 10px',
        borderRadius: 6,
        border: '1.5px solid var(--sp-border, #D1E5DF)',
        fontSize: 13,
        color: 'var(--sp-text, #1A2B28)',
        background: '#fff',
        cursor: 'pointer',
        minWidth: 160,
      }}
    >
      <option value=''>Select Counsellor</option>
      {counsellors.map((c) => (
        <option key={c.counsellorId} value={c.counsellorId}>
          {c.name}{c.specializations ? ` — ${c.specializations}` : ''}
        </option>
      ))}
    </select>
  )
}

export default AssignCounsellorDropdown
