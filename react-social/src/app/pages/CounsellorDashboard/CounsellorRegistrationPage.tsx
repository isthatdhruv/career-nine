import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toAbsoluteUrl } from '../../../_metronic/helpers'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8091'

interface FormData {
  name: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  specializations: string
  bio: string
  languagesSpoken: string
  modeCapability: string
  qualifications: string
  yearsOfExperience: string
}

const initialForm: FormData = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  specializations: '',
  bio: '',
  languagesSpoken: '',
  modeCapability: 'BOTH',
  qualifications: '',
  yearsOfExperience: '',
}

const CounsellorRegistrationPage: React.FC = () => {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormData>(initialForm)
  const [step, setStep] = useState(1)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  useEffect(() => {
    document.body.classList.add('bg-body')
    return () => { document.body.classList.remove('bg-body') }
  }, [])

  const update = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be less than 5MB.'); return }

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setPhotoPreview(result)
      setPhotoBase64(result)
      setError('')
    }
    reader.readAsDataURL(file)
  }

  const validateStep1 = (): string | null => {
    if (!form.name.trim()) return 'Full name is required'
    if (!form.email.trim()) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email'
    if (!form.phone.trim()) return 'Phone number is required'
    if (!form.password) return 'Password is required'
    if (form.password.length < 6) return 'Password must be at least 6 characters'
    if (form.password !== form.confirmPassword) return 'Passwords do not match'
    return null
  }

  const validateStep2 = (): string | null => {
    if (!form.specializations.trim()) return 'Please enter your specializations'
    if (!form.languagesSpoken.trim()) return 'Please enter languages you speak'
    return null
  }

  const handleNext = () => {
    if (step === 1) {
      const err = validateStep1()
      if (err) { setError(err); return }
      setStep(2)
    } else if (step === 2) {
      const err = validateStep2()
      if (err) { setError(err); return }
      setStep(3)
    }
    setError('')
  }

  const handleBack = () => {
    setError('')
    setStep((s) => s - 1)
  }

  const handleSubmit = () => {
    if (showConfirmation) return
    setShowConfirmation(true)
    setError('')

    // Fire API call in background
    axios.post(`${API_BASE_URL}/api/counsellor/self-register`, {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      password: form.password,
      specializations: form.specializations.trim(),
      bio: form.bio.trim() || undefined,
      languagesSpoken: form.languagesSpoken.trim(),
      modeCapability: form.modeCapability,
      qualifications: form.qualifications.trim() || undefined,
      yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : undefined,
    })
      .then((res) => {
        setSubmitted(true)
        // Upload photo if selected
        const counsellorId = res.data?.counsellorId
        if (photoBase64 && counsellorId) {
          axios.post(`${API_BASE_URL}/api/counsellor/upload-photo/${counsellorId}`, { photo: photoBase64 })
            .catch(() => {}) // Photo upload failure is non-blocking
        }
      })
      .catch(() => {})
  }

  // ── Step Indicator ──
  const StepIndicator = () => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
      {[1, 2, 3].map((s) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
              background: s <= step ? '#0C6B5A' : '#E5E7EB',
              color: s <= step ? '#fff' : '#9CA3AF',
              transition: 'all 0.2s',
            }}
          >
            {s < step ? (
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3'>
                <path d='M20 6L9 17l-5-5' />
              </svg>
            ) : s}
          </div>
          {s < 3 && (
            <div style={{
              width: 40, height: 2,
              background: s < step ? '#0C6B5A' : '#E5E7EB',
              transition: 'all 0.2s',
            }} />
          )}
        </div>
      ))}
    </div>
  )

  const stepTitles = ['Account Details', 'Professional Info', 'Review & Submit']
  const stepDescriptions = [
    'Enter your basic account information',
    'Tell us about your expertise',
    'Review your details and submit',
  ]

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid #D1E5DF',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    background: '#FAFCFB',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#1A2B28',
    marginBottom: 6,
  }

  return (
    <div className='d-flex flex-column flex-column-fluid' style={{ background: '#F2F7F5', minHeight: '100vh' }}>
      <div className='d-flex flex-center flex-column flex-column-fluid p-10 pb-20'>
        <div className='w-lg-600px bg-body rounded shadow-sm p-10 mx-auto' style={{ marginBottom: 40 }}>

          {/* Header */}
          <div className='text-center mb-6'>
            <img src={toAbsoluteUrl('/media/logos/kcc.jpg')} alt='Career-9' style={{ height: 36, marginBottom: 16 }} />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B28', margin: '0 0 4px' }}>
              Counsellor Registration
            </h1>
            <p style={{ fontSize: 13, color: '#5C7A72', margin: 0 }}>
              {stepTitles[step - 1]} — {stepDescriptions[step - 1]}
            </p>
          </div>

          <StepIndicator />

          {error && (
            <div style={{
              marginBottom: 16, padding: '10px 14px',
              background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8,
              color: '#991B1B', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* ── Step 1: Account Details ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Profile Photo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
                    border: '2px dashed #D1E5DF', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', background: '#FAFCFB', flexShrink: 0,
                    cursor: 'pointer', position: 'relative',
                  }}
                  onClick={() => document.getElementById('photo-input')?.click()}
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt='Preview' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <svg width='28' height='28' viewBox='0 0 24 24' fill='none' stroke='#9CA3AF' strokeWidth='1.5'>
                      <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
                      <circle cx='12' cy='7' r='4' />
                    </svg>
                  )}
                </div>
                <div>
                  <button
                    type='button'
                    onClick={() => document.getElementById('photo-input')?.click()}
                    style={{
                      padding: '6px 16px', fontSize: 13, fontWeight: 600, border: '1.5px solid #D1E5DF',
                      borderRadius: 8, background: '#fff', color: '#1A2B28', cursor: 'pointer',
                    }}
                  >
                    {photoPreview ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>JPG, PNG or WebP. Max 5MB.</div>
                  <input
                    id='photo-input'
                    type='file'
                    accept='image/*'
                    onChange={handlePhotoChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Full Name *</label>
                <input style={inputStyle} placeholder='Enter your full name' value={form.name}
                  onChange={(e) => update('name', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input style={inputStyle} type='email' placeholder='name@example.com' value={form.email}
                  onChange={(e) => update('email', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Phone *</label>
                <input style={inputStyle} type='tel' placeholder='+91 XXXXX XXXXX' value={form.phone}
                  onChange={(e) => update('phone', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Password *</label>
                  <input style={inputStyle} type='password' placeholder='Min 6 characters' value={form.password}
                    onChange={(e) => update('password', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Confirm Password *</label>
                  <input style={inputStyle} type='password' placeholder='Re-enter password' value={form.confirmPassword}
                    onChange={(e) => update('confirmPassword', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Professional Info ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Specializations *</label>
                <input style={inputStyle} placeholder='e.g. Career Counselling, Academic Guidance, Mental Health'
                  value={form.specializations} onChange={(e) => update('specializations', e.target.value)} />
                <div style={{ fontSize: 11, color: '#5C7A72', marginTop: 4 }}>Comma-separated</div>
              </div>
              <div>
                <label style={labelStyle}>Languages Spoken *</label>
                <input style={inputStyle} placeholder='e.g. English, Hindi, Punjabi'
                  value={form.languagesSpoken} onChange={(e) => update('languagesSpoken', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Counselling Mode</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.modeCapability}
                    onChange={(e) => update('modeCapability', e.target.value)}>
                    <option value='BOTH'>Online & Offline</option>
                    <option value='ONLINE'>Online Only</option>
                    <option value='OFFLINE'>Offline Only</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Years of Experience</label>
                  <input style={inputStyle} type='number' placeholder='e.g. 5' value={form.yearsOfExperience}
                    onChange={(e) => update('yearsOfExperience', e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Qualifications</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                  placeholder='e.g. M.Ed in Counselling Psychology, Certified Career Coach'
                  value={form.qualifications}
                  onChange={(e) => update('qualifications', e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Short Bio</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                  placeholder='A brief introduction about yourself...'
                  value={form.bio}
                  onChange={(e) => update('bio', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ── Step 3: Review ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Photo preview in review */}
              {photoPreview && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 8 }}>
                  <img src={photoPreview} alt='Profile' style={{
                    width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
                    border: '2px solid #D1E5DF',
                  }} />
                  <span style={{ fontSize: 13, color: '#5C7A72' }}>Profile photo selected</span>
                </div>
              )}
              {[
                { label: 'Name', value: form.name },
                { label: 'Email', value: form.email },
                { label: 'Phone', value: form.phone },
                { label: 'Specializations', value: form.specializations },
                { label: 'Languages', value: form.languagesSpoken },
                { label: 'Mode', value: form.modeCapability === 'BOTH' ? 'Online & Offline' : form.modeCapability === 'ONLINE' ? 'Online Only' : 'Offline Only' },
                { label: 'Qualifications', value: form.qualifications || '-' },
                { label: 'Experience', value: form.yearsOfExperience ? `${form.yearsOfExperience} years` : '-' },
                { label: 'Bio', value: form.bio || '-' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', padding: '8px 0' }}>
                  <div style={{ width: 160, fontSize: 13, fontWeight: 600, color: '#5C7A72', flexShrink: 0 }}>{label}</div>
                  <div style={{ fontSize: 13, color: '#1A2B28', wordBreak: 'break-word' }}>{value}</div>
                </div>
              ))}
              <div style={{
                marginTop: 8, padding: '12px 16px',
                background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 8,
                fontSize: 13, color: '#795548',
              }}>
                By submitting, your registration will be reviewed by an administrator. You will be notified once your account is approved.
              </div>
            </div>
          )}

          {/* ── Navigation Buttons ── */}
          {!showConfirmation && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
              <div>
                {step > 1 && (
                  <button
                    onClick={handleBack}
                    disabled={loading}
                    style={{
                      padding: '10px 24px', fontSize: 14, fontWeight: 600,
                      border: '1.5px solid #D1E5DF', borderRadius: 8,
                      background: '#fff', color: '#1A2B28', cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    Back
                  </button>
                )}
                {step === 1 && (
                  <button
                    onClick={() => navigate('/counsellor/login')}
                    style={{
                      padding: '10px 24px', fontSize: 14, fontWeight: 600,
                      border: '1.5px solid #D1E5DF', borderRadius: 8,
                      background: '#fff', color: '#5C7A72', cursor: 'pointer',
                    }}
                  >
                    Back to Login
                  </button>
                )}
              </div>
              <div>
                {step < 3 ? (
                  <button
                    onClick={handleNext}
                    style={{
                      padding: '10px 28px', fontSize: 14, fontWeight: 600,
                      border: 'none', borderRadius: 8,
                      background: '#0C6B5A', color: '#fff', cursor: 'pointer',
                    }}
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                      padding: '10px 28px', fontSize: 14, fontWeight: 600,
                      border: 'none', borderRadius: 8,
                      background: loading ? '#9CA3AF' : '#0C6B5A', color: '#fff',
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? 'Submitting...' : 'Submit Registration'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Success Pop-up (replaces buttons after submit) ── */}
          {showConfirmation && (
            <div
              style={{
                marginTop: 28,
                padding: '28px 24px',
                background: '#F0FFF4',
                border: '2px solid #A7F3D0',
                borderRadius: 12,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: '#D1FAE5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <svg width='26' height='26' viewBox='0 0 24 24' fill='none' stroke='#065F46' strokeWidth='2.5'>
                  <path d='M20 6L9 17l-5-5' />
                </svg>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#065F46', margin: '0 0 8px' }}>
                Registration Submitted!
              </h3>
              <p style={{ fontSize: 13, color: '#5C7A72', lineHeight: 1.7, margin: '0 0 20px' }}>
                By submitting, your registration will be reviewed by an administrator. You will be notified once your account is approved.
              </p>
              <button
                onClick={() => navigate('/counsellor/login')}
                style={{
                  padding: '10px 32px', fontSize: 14, fontWeight: 600,
                  border: 'none', borderRadius: 8,
                  background: '#0C6B5A', color: '#fff', cursor: 'pointer',
                }}
              >
                Back to Login
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 16, paddingBottom: 40 }}>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
            Career-9 Counselling Platform
          </p>
        </div>
      </div>
    </div>
  )
}

export default CounsellorRegistrationPage
