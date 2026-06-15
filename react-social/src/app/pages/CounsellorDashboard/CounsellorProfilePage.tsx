import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import PortalLayout from '../portal/PortalLayout'
import { getCounsellorById, getCounsellorByUserId } from '../Counselling/API/CounsellorAPI'
import { useAuth } from '../../modules/auth'
import { COUNSELLOR_MENU_ITEMS } from './counsellorMenu'
import './CounsellorPortal.css'

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8091'
interface ProfileForm {
  name: string
  email: string
  phone: string
  specializations: string
  bio: string
  languagesSpoken: string
  modeCapability: string
  officeAddress: string
  qualifications: string
  yearsOfExperience: string
  linkedinProfile: string
  maxSessionsPerDay: string
  hourlyRatePreference: string
  govtIdLast4: string
  bankName: string
  bankAccount: string
  bankIfsc: string
  bankBranch: string
}

const CounsellorProfilePage: React.FC = () => {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [counsellorId, setCounsellorId] = useState<number | null>(null)
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
  const [form, setForm] = useState<ProfileForm>({
    name: '', email: '', phone: '', specializations: '', bio: '',
    languagesSpoken: '', modeCapability: 'BOTH', officeAddress: '', qualifications: '',
    yearsOfExperience: '', linkedinProfile: '', maxSessionsPerDay: '',
    hourlyRatePreference: '', govtIdLast4: '', bankName: '', bankAccount: '', bankIfsc: '', bankBranch: '',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const photoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Phase 19: derive counsellorId from currentUser via the existing
    // getCounsellorByUserId lookup. TODO(phase-19-followup): when /auth/me
    // starts exposing counsellorId directly, skip this extra round-trip.
    if (!currentUser) { navigate('/counsellor/login', { replace: true }); return }

    const loadProfile = (cId: number) => {
      setCounsellorId(cId)
      getCounsellorById(cId)
        .then((res) => {
          const d = res.data
          setProfileImageUrl(d?.profileImageUrl || null)
          setForm({
            name: d?.name || '',
            email: d?.email || '',
            phone: d?.phone || '',
            specializations: d?.specializations || '',
            bio: d?.bio || '',
            languagesSpoken: d?.languagesSpoken || '',
            modeCapability: d?.modeCapability || 'BOTH',
            officeAddress: d?.officeAddress || '',
            qualifications: d?.qualifications || '',
            yearsOfExperience: d?.yearsOfExperience ? String(d.yearsOfExperience) : '',
            linkedinProfile: d?.linkedinProfile || '',
            maxSessionsPerDay: d?.maxSessionsPerDay ? String(d.maxSessionsPerDay) : '',
            hourlyRatePreference: d?.hourlyRatePreference ? String(d.hourlyRatePreference) : '',
            govtIdLast4: d?.govtIdLast4 || '',
            bankName: d?.bankName || '',
            bankAccount: d?.bankAccount || '',
            bankIfsc: d?.bankIfsc || '',
            bankBranch: d?.bankBranch || '',
          })
        })
        .catch(() => setError('Failed to load profile.'))
        .finally(() => setLoading(false))
    }

    getCounsellorByUserId(currentUser.id)
      .then((res) => {
        const resolvedId = res.data?.id
        if (!resolvedId) {
          setError('Counsellor profile not found.')
          setLoading(false)
          return
        }
        loadProfile(resolvedId)
      })
      .catch(() => {
        setError('Counsellor profile not found.')
        setLoading(false)
      })
  }, [currentUser, navigate])

  const handleSave = async () => {
    if (!counsellorId) return
    if (!form.name.trim()) { setError('Name is required.'); return }
    if (!form.email.trim()) { setError('Email is required.'); return }

    setSaving(true)
    setError('')
    try {
      await axios.put(`${API_URL}/api/counsellor/update/${counsellorId}`, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        specializations: form.specializations.trim(),
        bio: form.bio.trim(),
        languagesSpoken: form.languagesSpoken.trim(),
        modeCapability: form.modeCapability,
        officeAddress: form.officeAddress.trim(),
        qualifications: form.qualifications.trim(),
        yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : null,
        linkedinProfile: form.linkedinProfile.trim(),
        maxSessionsPerDay: form.maxSessionsPerDay ? Number(form.maxSessionsPerDay) : null,
        hourlyRatePreference: form.hourlyRatePreference ? Number(form.hourlyRatePreference) : null,
        govtIdLast4: form.govtIdLast4.trim(),
        bankName: form.bankName.trim(),
        bankAccount: form.bankAccount.trim(),
        bankIfsc: form.bankIfsc.trim(),
        bankBranch: form.bankBranch.trim(),
      })
      // Phase 19: no localStorage write-back. The legacy code denormalised
      // the counsellor name into a local JSON blob; that blob is gone.
      // currentUser.name comes from /auth/me, which the backend keeps in sync
      // with the user record; if the displayed name needs to refresh, a future
      // refactor can re-call /auth/me here.
      setSuccess('Profile updated successfully.')
      setTimeout(() => setSuccess(''), 4000)
    } catch {
      setError('Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !counsellorId) return
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be less than 5MB.'); return }

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setProfileImageUrl(base64)
      axios.post(`${API_URL}/api/counsellor/upload-photo/${counsellorId}`, { photo: base64 })
        .then((res) => {
          setProfileImageUrl(res.data?.profileImageUrl || base64)
          setSuccess('Photo updated.')
          setTimeout(() => setSuccess(''), 3000)
        })
        .catch(() => setError('Failed to upload photo.'))
    }
    reader.readAsDataURL(file)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1.5px solid #D1E5DF',
    borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
    background: '#FAFCFB', transition: 'border-color 0.2s',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#5C7A72', marginBottom: 5,
  }

  if (loading) {
    return (
      <PortalLayout title='Counsellor Dashboard' menuItems={COUNSELLOR_MENU_ITEMS} storageKeys={[]} loginPath='/counsellor/login'>
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#5C7A72' }}>Loading profile...</div>
      </PortalLayout>
    )
  }

  return (
    <PortalLayout title='Counsellor Dashboard' menuItems={COUNSELLOR_MENU_ITEMS} storageKeys={[]} loginPath='/counsellor/login'>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button onClick={() => navigate('/counsellor/dashboard')} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 8, border: '1.5px solid #D1E5DF',
            background: '#fff', cursor: 'pointer', color: '#1A2B28', flexShrink: 0,
          }} title='Back'>
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <polyline points='15 18 9 12 15 6' />
            </svg>
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B28', margin: 0 }}>My Profile</h1>
            <p style={{ fontSize: 13, color: '#5C7A72', marginTop: 3, marginBottom: 0 }}>Update your personal and professional details</p>
          </div>
        </div>

        {/* Alerts */}
        {success && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: 8, color: '#065F46', fontSize: 13 }}>
            {success}
          </div>
        )}
        {error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, color: '#991B1B', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontSize: 16 }}>&times;</button>
          </div>
        )}

        {/* â”€â”€ Profile Photo â”€â”€ */}
        <div style={{ background: '#fff', border: '1px solid #D1E5DF', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2B28', marginBottom: 16 }}>Profile Photo</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{
              width: 88, height: 88, borderRadius: '50%', overflow: 'hidden',
              background: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, border: '3px solid #D1E5DF',
            }}>
              {profileImageUrl ? (
                <img src={profileImageUrl} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 32, fontWeight: 700, color: '#0C6B5A' }}>{form.name?.charAt(0)?.toUpperCase() || '?'}</span>
              )}
            </div>
            <div>
              <button onClick={() => photoRef.current?.click()} style={{
                padding: '8px 20px', fontSize: 13, fontWeight: 600, border: '1.5px solid #D1E5DF',
                borderRadius: 8, background: '#fff', color: '#1A2B28', cursor: 'pointer',
              }}>
                {profileImageUrl ? 'Change Photo' : 'Upload Photo'}
              </button>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>JPG, PNG or WebP. Max 5MB.</div>
              <input ref={photoRef} type='file' accept='image/*' onChange={handlePhotoChange} style={{ display: 'none' }} />
            </div>
          </div>
        </div>

        {/* â”€â”€ Personal Details â”€â”€ */}
        <div style={{ background: '#fff', border: '1px solid #D1E5DF', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2B28', marginBottom: 16 }}>Personal Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Full Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Govt ID (Last 4 Digits)</label>
              <input value={form.govtIdLast4} maxLength={4} placeholder='e.g. 1234'
                onChange={(e) => setForm({ ...form, govtIdLast4: e.target.value.replace(/\D/g, '').slice(0, 4) })} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* â”€â”€ Professional Details â”€â”€ */}
        <div style={{ background: '#fff', border: '1px solid #D1E5DF', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2B28', marginBottom: 16 }}>Professional Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Specializations</label>
              <input value={form.specializations} placeholder='e.g. Career, Academic, Mental Health'
                onChange={(e) => setForm({ ...form, specializations: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Languages Spoken</label>
              <input value={form.languagesSpoken} placeholder='e.g. English, Hindi'
                onChange={(e) => setForm({ ...form, languagesSpoken: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Mode Capability</label>
              <select value={form.modeCapability} onChange={(e) => setForm({ ...form, modeCapability: e.target.value })}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value='BOTH'>Online & Offline</option>
                <option value='ONLINE'>Online Only</option>
                <option value='OFFLINE'>Offline Only</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Years of Experience</label>
              <input type='number' value={form.yearsOfExperience} placeholder='e.g. 5'
                onChange={(e) => setForm({ ...form, yearsOfExperience: e.target.value })} style={inputStyle} />
            </div>
          </div>
          {form.modeCapability !== 'ONLINE' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>
                Office Address {form.modeCapability === 'OFFLINE' ? '*' : ''}
              </label>
              <textarea value={form.officeAddress} placeholder='Full address shared with students for in-person (offline) sessions'
                onChange={(e) => setForm({ ...form, officeAddress: e.target.value })}
                style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 5 }}>
                Sent to the student in their confirmation email when they book an in-person session with you.
              </div>
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Qualifications</label>
            <textarea value={form.qualifications} placeholder='e.g. M.Ed in Counselling Psychology'
              onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>LinkedIn Profile</label>
            <input value={form.linkedinProfile} placeholder='https://linkedin.com/in/...'
              onChange={(e) => setForm({ ...form, linkedinProfile: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Bio</label>
            <textarea value={form.bio} placeholder='A brief introduction about yourself...'
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} />
          </div>
        </div>

        {/* â”€â”€ Bank Details â”€â”€ */}
        <div style={{ background: '#fff', border: '1px solid #D1E5DF', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2B28', marginBottom: 4 }}>Bank Details</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>For payout processing. Your details are stored securely.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Bank Name</label>
              <input value={form.bankName} placeholder='e.g. State Bank of India'
                onChange={(e) => setForm({ ...form, bankName: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Branch</label>
              <input value={form.bankBranch} placeholder='e.g. Connaught Place, New Delhi'
                onChange={(e) => setForm({ ...form, bankBranch: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Account Number</label>
              <input value={form.bankAccount} placeholder='e.g. 1234567890'
                onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>IFSC Code</label>
              <input value={form.bankIfsc} placeholder='e.g. SBIN0001234'
                onChange={(e) => setForm({ ...form, bankIfsc: e.target.value.toUpperCase() })} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 40 }}>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '12px 36px', fontSize: 15, fontWeight: 600, border: 'none', borderRadius: 10,
            background: saving ? '#9CA3AF' : 'linear-gradient(135deg, #064E3B, #0C6B5A)',
            color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 8px rgba(12,107,90,0.3)',
          }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={() => navigate('/counsellor/dashboard')} style={{
            padding: '12px 24px', fontSize: 15, fontWeight: 600, border: '1.5px solid #D1E5DF',
            borderRadius: 10, background: '#fff', color: '#5C7A72', cursor: 'pointer',
          }}>
            Cancel
          </button>
        </div>
      </div>
    </PortalLayout>
  )
}

export default CounsellorProfilePage
