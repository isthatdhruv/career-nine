import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toAbsoluteUrl } from '../../../../_metronic/helpers'
import './StudentPortal.css'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080'

const EMAIL_REGEX = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const PHONE_REGEX = /^[6-9]\d{9}$/
const NAME_REGEX = /^[A-Za-z\s.'-]{2,60}$/

interface FormErrors {
  name?: string
  email?: string
  phone?: string
}

const StudentInfoForm: React.FC = () => {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<any>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('studentPortalLoggedIn')
    if (!isLoggedIn) {
      navigate('/student/login')
      return
    }

    const profileStr = localStorage.getItem('studentPortalProfile')
    if (!profileStr) {
      navigate('/student/login')
      return
    }

    const p = JSON.parse(profileStr)
    setProfile(p)
    setName(p.name || '')
    setEmail(p.email || '')
    setPhone(p.phone || '')
    setIsEditMode(p.infoCompleted === true)

    // Hide Metronic splash
    const splash = document.getElementById('splash-screen')
    if (splash) splash.style.display = 'none'
    document.body.classList.remove('page-loading', 'splash-screen')
    document.documentElement.setAttribute('data-theme', 'light')
  }, [navigate])

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

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setApiError('')
    if (!validate()) return

    setSubmitting(true)
    try {
      const res = await axios.put(
        `${API_BASE_URL}/student-portal/update-info/${profile.userStudentId}`,
        { name: name.trim(), email: email.trim(), phone: phone.trim() }
      )

      // Update localStorage with new profile data
      const updatedProfile = { ...profile, ...res.data }
      localStorage.setItem('studentPortalProfile', JSON.stringify(updatedProfile))

      navigate('/student/dashboard')
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to save. Please try again.'
      setApiError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (!profile) return null

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
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>
                Phone Number <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type='tel'
                value={phone}
                onChange={(e) => {
                  // Only allow digits, max 10
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                  setPhone(val)
                  if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }))
                }}
                placeholder='9876543210'
                style={{ ...inputStyle, ...(errors.phone ? errorBorder : {}) }}
              />
              {errors.phone && <span style={errorText}>{errors.phone}</span>}
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
