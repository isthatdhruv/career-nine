import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toAbsoluteUrl } from '../../../../_metronic/helpers'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8091'

const months = [
  { value: '01', label: 'January' }, { value: '02', label: 'February' },
  { value: '03', label: 'March' }, { value: '04', label: 'April' },
  { value: '05', label: 'May' }, { value: '06', label: 'June' },
  { value: '07', label: 'July' }, { value: '08', label: 'August' },
  { value: '09', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
]

const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
const years = Array.from({ length: 31 }, (_, i) => String(2015 - i))

const StudentDashboardLogin: React.FC = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [dobDay, setDobDay] = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobYear, setDobYear] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState({ username: false, dob: false })

  // Match AuthLayout: add bg-body to body
  useEffect(() => {
    document.body.classList.add('bg-body')
    return () => {
      document.body.classList.remove('bg-body')
    }
  }, [])

  const usernameError = touched.username && !username.trim() ? 'Username is required' : ''
  const dobError = touched.dob && (!dobDay || !dobMonth || !dobYear) ? 'Please select day, month, and year' : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ username: true, dob: true })

    if (!username.trim() || !dobDay || !dobMonth || !dobYear) return

    const dobDate = `${dobDay}-${dobMonth}-${dobYear}`
    setLoading(true)
    setError('')

    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/user/student-auth`,
        { username: username.trim(), dobDate },
        { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } }
      )

      if (!data || !data.profile) {
        setError('Invalid credentials. Please try again.')
        return
      }

      localStorage.setItem('studentPortalProfile', JSON.stringify(data.profile))
      localStorage.setItem('studentPortalDashboard', JSON.stringify(data.dashboardData))
      localStorage.setItem('studentPortalLoggedIn', 'true')

      navigate('/student/dashboard')
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Invalid username or date of birth.')
      } else if (err.response?.status === 404) {
        setError('Student record not found.')
      } else {
        setError('An error occurred. Please try again later.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className='d-flex flex-column flex-column-fluid bgi-position-y-bottom position-x-center bgi-no-repeat bgi-size-contain bgi-attachment-fixed'
      style={{
        backgroundImage: `url(${toAbsoluteUrl('/media/illustrations/sketchy-1/14.png')})`,
      }}
    >
      <div className='d-flex flex-center flex-column flex-column-fluid p-10 pb-lg-20'>
        <div className='w-lg-500px bg-body rounded shadow-sm p-10 p-lg-15 mx-auto'>
          <form className='form w-100' noValidate onSubmit={handleSubmit}>
            {/* Heading */}
            <div className='text-center mb-10'>
              <h1 className='text-dark mb-3'>Student Dashboard</h1>
              <div className='text-gray-400 fw-bold fs-4'>
                Sign in with your username and date of birth
              </div>
            </div>

            {error && (
              <div className='mb-lg-15 alert alert-danger'>
                <div className='alert-text font-weight-bold'>{error}</div>
              </div>
            )}

            {/* Username */}
            <div className='fv-row mb-10'>
              <label className='form-label fs-6 fw-bolder text-dark'>Username</label>
              <input
                type='text'
                placeholder='Enter your username'
                className={`form-control form-control-lg form-control-solid ${
                  touched.username ? (usernameError ? 'is-invalid' : 'is-valid') : ''
                }`}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  if (touched.username) setTouched((t) => ({ ...t, username: true }))
                }}
                onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                autoComplete='off'
              />
              {usernameError && (
                <div className='fv-plugins-message-container'>
                  <div className='fv-help-block'>
                    <span role='alert'>{usernameError}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Date of Birth */}
            <div className='fv-row mb-10'>
              <label className='form-label fs-6 fw-bolder text-dark'>Date of Birth</label>
              <div className='d-flex gap-3'>
                <select
                  className={`form-select form-select-solid form-select-lg ${
                    touched.dob && !dobDay ? 'is-invalid' : ''
                  }`}
                  value={dobDay}
                  onChange={(e) => setDobDay(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, dob: true }))}
                >
                  <option value=''>Day</option>
                  {days.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <select
                  className={`form-select form-select-solid form-select-lg ${
                    touched.dob && !dobMonth ? 'is-invalid' : ''
                  }`}
                  value={dobMonth}
                  onChange={(e) => setDobMonth(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, dob: true }))}
                >
                  <option value=''>Month</option>
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>

                <select
                  className={`form-select form-select-solid form-select-lg ${
                    touched.dob && !dobYear ? 'is-invalid' : ''
                  }`}
                  value={dobYear}
                  onChange={(e) => setDobYear(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, dob: true }))}
                >
                  <option value=''>Year</option>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              {dobError && (
                <div className='fv-plugins-message-container mt-2'>
                  <div className='fv-help-block'>
                    <span role='alert'>{dobError}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className='text-center'>
              <button
                type='submit'
                className='btn btn-lg btn-primary w-100 mb-5'
                disabled={loading}
              >
                {!loading && <span className='indicator-label'>Sign In</span>}
                {loading && (
                  <span className='indicator-progress' style={{ display: 'block' }}>
                    Signing in...
                    <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                  </span>
                )}
              </button>
            </div>

            <div className='text-center text-gray-500 fs-7'>
              Need help? Contact your school administrator
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default StudentDashboardLogin
