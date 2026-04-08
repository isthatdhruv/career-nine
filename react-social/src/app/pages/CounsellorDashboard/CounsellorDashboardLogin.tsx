import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toAbsoluteUrl } from '../../../_metronic/helpers'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8091'

const CounsellorDashboardLogin: React.FC = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState({ email: false, password: false })

  useEffect(() => {
    document.body.classList.add('bg-body')
    return () => {
      document.body.classList.remove('bg-body')
    }
  }, [])

  const emailError = touched.email && !email.trim() ? 'Email is required' : ''
  const passwordError = touched.password && !password ? 'Password is required' : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ email: true, password: true })

    if (!email.trim() || !password) return

    setLoading(true)
    setError('')

    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/auth/login`,
        { email: email.trim(), password },
        { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } }
      )

      if (!data || !data.accessToken) {
        setError('Invalid credentials. Please try again.')
        return
      }

      // Fetch user data with token to check roles
      const { data: user } = await axios.get(`${API_BASE_URL}/user/me`, {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      })

      // Check if user has counsellor access via authorityUrls
      const authorityUrls: string[] = user.authorityUrls || []
      const hasCounsellorAccess = authorityUrls.some((url: string) => {
        const lower = url.toLowerCase()
        return (
          lower.includes('counsellor') ||
          lower.includes('counselor') ||
          lower.includes('/counsellor') ||
          lower === '*' ||
          lower === '/*'
        )
      })

      if (!hasCounsellorAccess) {
        setError('You do not have counsellor access. Please contact your administrator to assign the counsellor role.')
        return
      }

      localStorage.setItem('counsellorPortalToken', data.accessToken)
      localStorage.setItem('counsellorPortalUser', JSON.stringify(user))
      localStorage.setItem('counsellorPortalLoggedIn', 'true')

      navigate('/counsellor/dashboard')
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Invalid email or password.')
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
            <div className='text-center mb-10'>
              <h1 className='text-dark mb-3'>Counsellor Dashboard</h1>
              <div className='text-gray-400 fw-bold fs-4'>
                Sign in with your email and password
              </div>
            </div>

            {error && (
              <div className='mb-lg-15 alert alert-danger'>
                <div className='alert-text font-weight-bold'>{error}</div>
              </div>
            )}

            {/* Email */}
            <div className='fv-row mb-10'>
              <label className='form-label fs-6 fw-bolder text-dark'>Email</label>
              <input
                type='email'
                placeholder='Enter your email'
                className={`form-control form-control-lg form-control-solid ${
                  touched.email ? (emailError ? 'is-invalid' : 'is-valid') : ''
                }`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                autoComplete='off'
              />
              {emailError && (
                <div className='fv-plugins-message-container'>
                  <div className='fv-help-block'>
                    <span role='alert'>{emailError}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Password */}
            <div className='fv-row mb-10'>
              <label className='form-label fs-6 fw-bolder text-dark'>Password</label>
              <input
                type='password'
                placeholder='Enter your password'
                className={`form-control form-control-lg form-control-solid ${
                  touched.password ? (passwordError ? 'is-invalid' : 'is-valid') : ''
                }`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                autoComplete='off'
              />
              {passwordError && (
                <div className='fv-plugins-message-container'>
                  <div className='fv-help-block'>
                    <span role='alert'>{passwordError}</span>
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

export default CounsellorDashboardLogin
