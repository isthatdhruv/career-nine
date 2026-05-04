import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import PortalLayout, { MenuItem } from '../portal/PortalLayout'
import { getCounsellorById } from '../Counselling/API/CounsellorAPI'
import './CounsellorPortal.css'

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8091'

const MENU_ITEMS: MenuItem[] = [
  { label: 'Dashboard', path: '/counsellor/dashboard', icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><rect x='3' y='3' width='7' height='7' rx='1'/><rect x='14' y='3' width='7' height='7' rx='1'/><rect x='3' y='14' width='7' height='7' rx='1'/><rect x='14' y='14' width='7' height='7' rx='1'/></svg> },
  { label: 'Appointments', path: '/counsellor/appointments', icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><rect x='3' y='4' width='18' height='18' rx='2' ry='2'/><line x1='16' y1='2' x2='16' y2='6'/><line x1='8' y1='2' x2='8' y2='6'/><line x1='3' y1='10' x2='21' y2='10'/></svg> },
  { label: 'Session Notes', path: '/counsellor/notes', icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/><path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/></svg> },
  { label: 'Availability', path: '/counsellor/availability', icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><circle cx='12' cy='12' r='10'/><polyline points='12 6 12 12 16 14'/></svg> },
  { label: 'Reports', path: '/counsellor/reports', icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><line x1='18' y1='20' x2='18' y2='10'/><line x1='12' y1='20' x2='12' y2='4'/><line x1='6' y1='20' x2='6' y2='14'/></svg> },
  { label: 'My Profile', path: '/counsellor/profile', icon: <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/></svg> },
]
const STORAGE_KEYS = ['counsellorPortalToken', 'counsellorPortalUser', 'counsellorPortalLoggedIn']

interface ProfileForm {
  name: string
  email: string
  phone: string
  specializations: string
  bio: string
  languagesSpoken: string
  modeCapability: string
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
  const [loading, setLoading] = useState(true)
  const [counsellorId, setCounsellorId] = useState<number | null>(null)
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
  const [form, setForm] = useState<ProfileForm>({
    name: '', email: '', phone: '', specializations: '', bio: '',
    languagesSpoken: '', modeCapability: 'BOTH', qualifications: '',
    yearsOfExperience: '', linkedinProfile: '', maxSessionsPerDay: '',
    hourlyRatePreference: '', govtIdLast4: '', bankName: '', bankAccount: '', bankIfsc: '', bankBranch: '',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const photoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const userStr = localStorage.getItem('counsellorPortalUser')
    if (!userStr) { navigate('/counsellor/login'); return }

    try {
      const user = JSON.parse(userStr)
      const cId = user.counsellorId
      if (!cId) { navigate('/counsellor/dashboard'); return }
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
    } catch {
      navigate('/counsellor/login')
    }
  }, [navigate])

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
      // Update localStorage
      const stored = localStorage.getItem('counsellorPortalUser')
      if (stored) {
        const parsed = JSON.parse(stored)
        parsed.name = form.name.trim()
        localStorage.setItem('counsellorPortalUser', JSON.stringify(parsed))
      }
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
      <PortalLayout title='Counsellor Dashboard' menuItems={MENU_ITEMS} storageKeys={STORAGE_KEYS} loginPath='/counsellor/login'>
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#5C7A72' }}>Loading profile...</div>
      </PortalLayout>
    )
  }

  return (
    <PortalLayout title='Counsellor Dashboard' menuItems={MENU_ITEMS} storageKeys={STORAGE_KEYS} loginPath='/counsellor/login'>
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

        {/* ── Profile Photo ── */}
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

        {/* ── Personal Details ── */}
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

        {/* ── Professional Details ── */}
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

        {/* ── Bank Details ── */}
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
