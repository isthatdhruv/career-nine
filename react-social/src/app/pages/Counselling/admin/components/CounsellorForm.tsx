import React, { useState, useEffect } from 'react'
import '../../Counselling.css'
import { isValidMeetingLink, MEETING_LINK_ERROR, MEETING_LINK_PLACEHOLDER } from '../../shared/meetingLink'

interface CounsellorData {
  counsellorId?: number
  name: string
  email: string
  phone?: string
  specializations?: string
  companyName?: string
  meetingLink?: string
  bio?: string
  isExternal?: boolean
}

/**
 * The id the dialog's Save button points at via its `form` attribute, so the button can
 * sit in the modal footer — outside this element — and still submit it.
 */
export const COUNSELLOR_FORM_ID = 'counsellor-form'
const FORM_ID = COUNSELLOR_FORM_ID

interface CounsellorFormProps {
  counsellor: CounsellorData | null
  onSave: (data: CounsellorData) => void
}

const EMPTY_FORM: CounsellorData = {
  name: '',
  email: '',
  phone: '',
  specializations: '',
  companyName: '',
  meetingLink: '',
  bio: '',
  isExternal: false,
}

const CounsellorForm: React.FC<CounsellorFormProps> = ({ counsellor, onSave }) => {
  const [form, setForm] = useState<CounsellorData>(counsellor ?? EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof CounsellorData, string>>>({})

  useEffect(() => {
    setForm(counsellor ?? EMPTY_FORM)
    setErrors({})
  }, [counsellor])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement
    const { name, value, type } = target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? target.checked : value,
    }))
    if (errors[name as keyof CounsellorData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CounsellorData, string>> = {}
    if (!form.name.trim()) newErrors.name = 'Name is required'
    if (!form.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Enter a valid email address'
    }
    // Sessions run on Microsoft Teams only, so no other provider's link is accepted.
    const link = (form.meetingLink ?? '').trim()
    if (link && !isValidMeetingLink(link)) {
      newErrors.meetingLink = MEETING_LINK_ERROR
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSave(form)
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--sp-text, #1A2B28)',
    marginBottom: 5,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1.5px solid var(--sp-border, #D1E5DF)',
    borderRadius: 8,
    fontSize: 14,
    color: 'var(--sp-text, #1A2B28)',
    background: '#fff',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s',
  }

  const errorStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  }

  const fieldStyle: React.CSSProperties = { marginBottom: 16 }

  // Fields only: the dialog around this supplies the card, the title and the buttons.
  // The submit control lives in the modal footer and reaches this form by id, which is
  // why the <form> is addressable and carries no footer of its own.
  return (
    <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
        {/* Name */}
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor='cf-name'>
            Name <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <input
            id='cf-name'
            name='name'
            type='text'
            value={form.name}
            onChange={handleChange}
            placeholder='Full name'
            style={{ ...inputStyle, borderColor: errors.name ? '#EF4444' : 'var(--sp-border, #D1E5DF)' }}
          />
          {errors.name && <div style={errorStyle}>{errors.name}</div>}
        </div>

        {/* Email */}
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor='cf-email'>
            Email <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <input
            id='cf-email'
            name='email'
            type='email'
            value={form.email}
            onChange={handleChange}
            placeholder='email@example.com'
            style={{ ...inputStyle, borderColor: errors.email ? '#EF4444' : 'var(--sp-border, #D1E5DF)' }}
          />
          {errors.email && <div style={errorStyle}>{errors.email}</div>}
        </div>

        {/* Phone */}
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor='cf-phone'>
            Phone
          </label>
          <input
            id='cf-phone'
            name='phone'
            type='text'
            value={form.phone ?? ''}
            onChange={handleChange}
            placeholder='+91 00000 00000'
            style={inputStyle}
          />
        </div>

        {/* Specializations */}
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor='cf-specializations'>
            Specializations
          </label>
          <input
            id='cf-specializations'
            name='specializations'
            type='text'
            value={form.specializations ?? ''}
            onChange={handleChange}
            placeholder='e.g. Career Guidance, Academic Stress'
            style={inputStyle}
          />
        </div>

        {/* Company Name */}
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor='cf-companyName'>
            Company Name
          </label>
          <input
            id='cf-companyName'
            name='companyName'
            type='text'
            value={form.companyName ?? ''}
            onChange={handleChange}
            placeholder='Company / organisation the counsellor is employed with'
            style={inputStyle}
          />
        </div>

        {/* Teams meeting link — used for every online session this counsellor takes */}
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor='cf-meetingLink'>
            Meeting link (Microsoft Teams or Google Meet)
          </label>
          <input
            id='cf-meetingLink'
            name='meetingLink'
            type='text'
            value={form.meetingLink ?? ''}
            onChange={handleChange}
            placeholder={MEETING_LINK_PLACEHOLDER}
            style={{ ...inputStyle, borderColor: errors.meetingLink ? '#EF4444' : 'var(--sp-border, #D1E5DF)' }}
          />
          {errors.meetingLink
            ? <div style={errorStyle}>{errors.meetingLink}</div>
            : <div style={{ fontSize: 12, color: 'var(--sp-muted, #5C7A72)', marginTop: 4 }}>
                Required before this counsellor can take online sessions.
              </div>}
        </div>

        {/* Bio */}
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor='cf-bio'>
            Bio
          </label>
          <textarea
            id='cf-bio'
            name='bio'
            rows={3}
            value={form.bio ?? ''}
            onChange={handleChange}
            placeholder='Brief description of the counsellor...'
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          />
        </div>

        {/* Is External */}
        <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            id='cf-isExternal'
            name='isExternal'
            type='checkbox'
            checked={form.isExternal ?? false}
            onChange={handleChange}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--sp-primary, #0C6B5A)' }}
          />
          <label htmlFor='cf-isExternal' style={{ ...labelStyle, margin: 0, cursor: 'pointer', fontWeight: 500 }}>
            External Counsellor (not part of institute staff)
          </label>
        </div>

    </form>
  )
}

export default CounsellorForm
