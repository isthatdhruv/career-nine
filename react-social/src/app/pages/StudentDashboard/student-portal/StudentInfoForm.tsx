import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toAbsoluteUrl } from '../../../../_metronic/helpers'
import { useAuth } from '../../../modules/auth/core/Auth'
import './StudentPortal.css'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080'

const EMAIL_REGEX = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const PHONE_REGEX = /^[6-9]\d{9}$/
const NAME_REGEX = /^[A-Za-z\s.'-]{2,60}$/

const GRADES = ['6', '7', '8', '9', '10', '11', '12']
const GENDERS = ['Male', 'Female', 'Other']
const BOARDS = ['CBSE', 'ICSE', 'State Board', 'IB', 'IGCSE', 'NIOS', 'Other']

interface FormErrors {
  name?: string
  email?: string
  phone?: string
  grade?: string
  gender?: string
  schoolBoard?: string
}

const StudentInfoForm: React.FC = () => {
  const navigate = useNavigate()
  const { currentUser, setCurrentUser } = useAuth()
  const [userStudentId, setUserStudentId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [grade, setGrade] = useState('')
  const [gender, setGender] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [schoolBoard, setSchoolBoard] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    // Auth gating is handled upstream (StudentInfoGate / useAuth). If somehow we
    // land here without a session, bounce to the unified login.
    if (!currentUser) {
      navigate('/auth')
      return
    }

    // Hide Metronic splash + force light theme (student portal is standalone styled).
    const splash = document.getElementById('splash-screen')
    if (splash) splash.style.display = 'none'
    document.body.classList.remove('page-loading', 'splash-screen')
    document.documentElement.setAttribute('data-theme', 'light')

    if (fetchedRef.current) return
    fetchedRef.current = true

    const usid = (currentUser as any).userStudentId ?? null
    setUserStudentId(usid)

    const prefillFrom = (p: any) => {
      setName(p.name || '')
      setEmail(p.email || '')
      setPhone(p.phone || '')
      setGrade(p.grade != null ? String(p.grade) : '')
      setGender(p.gender || '')
      setSchoolName(p.schoolName || '')
      setSchoolBoard(p.schoolBoard || '')
      setIsEditMode(p.infoCompleted === true)
    }

    if (!usid) {
      // No userStudentId on /auth/me — pre-fill what we have and let the user fill the rest.
      prefillFrom(currentUser)
      setLoading(false)
      return
    }

    // Pull the full editable profile (grade/gender/school/board pre-filled from
    // the signup form/lead where available).
    axios
      .get(`${API_BASE_URL}/student-portal/my-info/${usid}`, { withCredentials: true })
      .then(({ data }) => prefillFrom(data))
      .catch(() => prefillFrom(currentUser))
      .finally(() => setLoading(false))
  }, [navigate, currentUser])

  const validate = (): boolean => {
    const e: FormErrors = {}

    if (!name.trim()) {
      e.name = 'Name is required'
    } else if (!NAME_REGEX.test(name.trim())) {
      e.name = 'Only letters, spaces, dots, hyphens and apostrophes allowed (2-60 chars)'
    }

    if (!email.trim()) {
      e.email = 'Email is required'
    } else if (!EMAIL_REGEX.test(email.trim())) {
      e.email = 'Enter a valid email address'
    }

    if (!phone.trim()) {
      e.phone = 'Phone number is required'
    } else if (!PHONE_REGEX.test(phone.trim())) {
      e.phone = 'Enter a valid 10-digit Indian mobile number'
    }

    if (!grade) e.grade = 'Please select your class'
    if (!gender) e.gender = 'Please select your gender'
    if (!schoolBoard) e.schoolBoard = 'Please select your school board'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setApiError('')
    if (!validate()) return

    if (!userStudentId) {
      setApiError('Could not resolve your student record. Please sign in again.')
      return
    }

    setSubmitting(true)
    try {
      const res = await axios.put(
        `${API_BASE_URL}/student-portal/update-info/${userStudentId}`,
        {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          grade,
          gender,
          schoolName: schoolName.trim(),
          schoolBoard,
        },
        { withCredentials: true }
      )

      // Update in-memory currentUser so the StudentInfoGate opens (infoCompleted=true)
      // and downstream pages see the new values. /auth/me re-hydrates on next bootstrap.
      const updated = { ...(currentUser as any), ...res.data, infoCompleted: true }
      setCurrentUser(updated)

      navigate('/student/dashboard')
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to save. Please try again.'
      setApiError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F7FA' }}>
        <div style={{ color: '#6B7280', fontSize: 14 }}>Loading ...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA' }}>
      {/* Top bar */}
      <div
        style={{
          background: '#263B6A',
          color: '#fff',
          padding: '0 20px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <img
          src={toAbsoluteUrl('/media/logos/kcc.webp')}
          alt='Career-9'
          style={{ height: 28, borderRadius: 4, background: '#fff', padding: 2 }}
        />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Career Navigator 360</span>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 20px' }}>
        <div className='sp-card' style={{ padding: '32px 28px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>
            {isEditMode ? 'Edit Profile' : 'Complete Your Profile'}
          </h2>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 28px' }}>
            {isEditMode
              ? 'Update your personal information below'
              : 'Please fill in your details to continue to the dashboard'}
          </p>

          {apiError && (
            <div
              style={{
                background: '#FEF2F2',
                color: '#DC2626',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 20,
              }}
            >
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Name */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>
                Full Name <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type='text'
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
                }}
                placeholder='Enter your full name'
                style={{ ...inputStyle, ...(errors.name ? errorBorder : {}) }}
              />
              {errors.name && <span style={errorText}>{errors.name}</span>}
            </div>

            {/* Email */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>
                Email <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type='email'
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                }}
                placeholder='you@example.com'
                style={{ ...inputStyle, ...(errors.email ? errorBorder : {}) }}
              />
              {errors.email && <span style={errorText}>{errors.email}</span>}
            </div>

            {/* Phone */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>
                Phone Number <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type='tel'
                value={phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                  setPhone(val)
                  if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }))
                }}
                placeholder='9876543210'
                style={{ ...inputStyle, ...(errors.phone ? errorBorder : {}) }}
              />
              {errors.phone && <span style={errorText}>{errors.phone}</span>}
            </div>

            {/* Class / Grade */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>
                Class / Grade <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                value={grade}
                onChange={(e) => {
                  setGrade(e.target.value)
                  if (errors.grade) setErrors((prev) => ({ ...prev, grade: undefined }))
                }}
                style={{ ...inputStyle, ...(errors.grade ? errorBorder : {}) }}
              >
                <option value=''>Select your class</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
              {errors.grade && <span style={errorText}>{errors.grade}</span>}
            </div>

            {/* Gender */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>
                Gender <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                value={gender}
                onChange={(e) => {
                  setGender(e.target.value)
                  if (errors.gender) setErrors((prev) => ({ ...prev, gender: undefined }))
                }}
                style={{ ...inputStyle, ...(errors.gender ? errorBorder : {}) }}
              >
                <option value=''>Select your gender</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              {errors.gender && <span style={errorText}>{errors.gender}</span>}
            </div>

            {/* School Name */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>School Name</label>
              <input
                type='text'
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder='Enter your school name'
                style={inputStyle}
              />
            </div>

            {/* School Board */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>
                School Board <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                value={schoolBoard}
                onChange={(e) => {
                  setSchoolBoard(e.target.value)
                  if (errors.schoolBoard) setErrors((prev) => ({ ...prev, schoolBoard: undefined }))
                }}
                style={{ ...inputStyle, ...(errors.schoolBoard ? errorBorder : {}) }}
              >
                <option value=''>Select your board</option>
                {BOARDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              {errors.schoolBoard && <span style={errorText}>{errors.schoolBoard}</span>}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              {isEditMode && (
                <button
                  type='button'
                  onClick={() => navigate('/student/dashboard')}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 8,
                    border: '1px solid #D1D5DB',
                    background: '#fff',
                    color: '#374151',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                type='submit'
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: 'none',
                  background: submitting ? '#6984A9' : '#263B6A',
                  color: '#fff',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Continue to Dashboard'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Inline styles
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 5,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  fontSize: 14,
  border: '1px solid #D1D5DB',
  borderRadius: 8,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
  background: '#fff',
}

const errorBorder: React.CSSProperties = {
  borderColor: '#DC2626',
}

const errorText: React.CSSProperties = {
  fontSize: 12,
  color: '#DC2626',
  marginTop: 3,
  display: 'block',
}

export default StudentInfoForm
