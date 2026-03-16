import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePreventReload } from '../hooks/usePreventReload';
import http from '../api/http';
import { useAssessment } from '../contexts/AssessmentContext';

const StudentLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { prefetchAssessmentData } = useAssessment();
  const [userId, setUserId] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const hasUnsavedAnswers = localStorage.getItem('assessmentAnswers');
    if (hasUnsavedAnswers) {
      console.warn('Unsaved assessment answers detected - preserving for recovery');
      const keysToPreserve = [
        'assessmentAnswers', 'assessmentRankingAnswers', 'assessmentTextAnswers',
        'assessmentSavedForLater', 'assessmentSkipped', 'assessmentElapsedTime',
        'assessmentCompletedGames', 'assessmentId', 'userStudentId'
      ];
      const preserved: Record<string, string> = {};
      keysToPreserve.forEach(key => {
        const val = localStorage.getItem(key);
        if (val) preserved[key] = val;
      });
      localStorage.clear();
      Object.entries(preserved).forEach(([key, val]) => localStorage.setItem(key, val));
    } else {
      localStorage.clear();
    }
    sessionStorage.clear();
  }, []);
  const [errors, setErrors] = useState({ userId: '', dob: '' });
  const [touched, setTouched] = useState({ userId: false, dob: false });

  const dob = dobDay && dobMonth && dobYear
    ? `${dobDay.padStart(2, '0')}-${dobMonth.padStart(2, '0')}-${dobYear}`
    : '';

  usePreventReload(userId.length > 0 || dobDay.length > 0 || dobMonth.length > 0 || dobYear.length > 0);

  const validateUserId = (id: string): string => {
    if (!id) return 'User ID is required';
    return '';
  };

  const validateDob = (day: string, month: string, year: string): string => {
    if (!day || !month || !year) return 'Please select day, month, and year';
    return '';
  };

  const handleUserIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserId(value);
    if (touched.userId) setErrors(prev => ({ ...prev, userId: validateUserId(value) }));
  };

  const handleUserIdBlur = () => {
    setTouched(prev => ({ ...prev, userId: true }));
    setErrors(prev => ({ ...prev, userId: validateUserId(userId) }));
    if (userId.trim()) {
      prefetchAssessmentData(userId.trim());
    }
  };

  const [openDropdown, setOpenDropdown] = useState<'day' | 'month' | 'year' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDobSelect = (field: 'day' | 'month' | 'year', value: string) => {
    if (field === 'day') setDobDay(value);
    else if (field === 'month') setDobMonth(value);
    else setDobYear(value);
    setOpenDropdown(null);
    if (touched.dob) {
      const d = field === 'day' ? value : dobDay;
      const m = field === 'month' ? value : dobMonth;
      const y = field === 'year' ? value : dobYear;
      setErrors(prev => ({ ...prev, dob: validateDob(d, m, y) }));
    }
  };

  const months = [
    { value: '01', label: 'Jan' }, { value: '02', label: 'Feb' },
    { value: '03', label: 'Mar' }, { value: '04', label: 'Apr' },
    { value: '05', label: 'May' }, { value: '06', label: 'Jun' },
    { value: '07', label: 'Jul' }, { value: '08', label: 'Aug' },
    { value: '09', label: 'Sep' }, { value: '10', label: 'Oct' },
    { value: '11', label: 'Nov' }, { value: '12', label: 'Dec' },
  ];

  const years = Array.from({ length: 31 }, (_, i) => String(2015 - i));
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ userId: true, dob: true });
    const userIdError = validateUserId(userId);
    const dobError = validateDob(dobDay, dobMonth, dobYear);
    setErrors({ userId: userIdError, dob: dobError });

    if (!userIdError && !dobError) {
      const requestBody = { dobDate: dob, username: userId };
      setIsLoading(true);
      try {
        const { data } = await http.post('/user/auth', requestBody);
        if (!data || !data.userStudentId) {
          alert('Invalid credentials. Please try again.');
          return;
        }
        localStorage.clear();
        localStorage.setItem('userStudentId', data.userStudentId);
        localStorage.setItem('allottedAssessments', JSON.stringify(data.assessments));
        navigate('/allotted-assessment');
      } catch (error: any) {
        if (error.response) {
          alert('Invalid credentials. Please try again.');
        } else {
          alert('An error occurred. Please try again later.');
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="assessment-bg">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5">
            <div className="assessment-card card shadow-lg">
              <div className="card-body p-3 p-sm-4 p-md-5">
                {/* Logo */}
                <div className="login-logo-wrapper">
                  <img src="/media/logos/kcc.webp" alt="CAREER_9 Logo" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "10%", padding: "8px" }} />
                </div>

                <h2 className="text-center assessment-heading">Assessment Login</h2>
                <p className="text-center assessment-subheading">Sign in to continue to your assessment</p>

                <form onSubmit={handleSubmit}>
                  {/* Username field */}
                  <div className="mb-3 mb-md-4">
                    <label htmlFor="userId" className="form-label fw-semibold" style={{ color: '#4a5568', fontSize: '0.95rem' }}>Username</label>
                    <div className="position-relative">
                      <div className="position-absolute top-50 translate-middle-y" style={{ left: '1rem', color: '#a0aec0' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                      </div>
                      <input
                        type="text"
                        className={`form-control assessment-input ${touched.userId && errors.userId ? 'is-invalid' : touched.userId && !errors.userId ? 'is-valid' : ''}`}
                        id="userId"
                        placeholder="Enter your User ID"
                        value={userId}
                        onChange={handleUserIdChange}
                        onBlur={handleUserIdBlur}
                      />
                    </div>
                    {touched.userId && errors.userId && <div style={{ color: '#e53e3e', fontSize: '0.85rem', marginTop: '0.35rem' }}>{errors.userId}</div>}
                  </div>

                  {/* DOB field - 3 custom dropdowns */}
                  <div className="mb-4">
                    <label className="form-label fw-semibold" style={{ color: '#4a5568', fontSize: '0.95rem' }}>Date of Birth</label>
                    <div className="d-flex gap-2" ref={dropdownRef}>
                      {/* Day */}
                      <div style={{ flex: 1, position: 'relative' }}>
                        <div
                          onClick={() => setOpenDropdown(openDropdown === 'day' ? null : 'day')}
                          style={{
                            borderRadius: '10px', padding: '10px 12px', fontSize: '0.95rem',
                            border: `1px solid ${touched.dob && errors.dob ? '#dc3545' : '#e2e8f0'}`,
                            color: '#2d3748', cursor: 'pointer', background: '#fff',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}
                        >
                          <span>{dobDay || 'Day'}</span>
                          <span style={{ fontSize: '0.7rem', color: '#a0aec0' }}>&#9662;</span>
                        </div>
                        {openDropdown === 'day' && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                            background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0 0 10px 10px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '150px', overflowY: 'auto',
                          }}>
                            {days.map(d => (
                              <div key={d} onClick={() => handleDobSelect('day', d)}
                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.95rem', color: '#2d3748', background: dobDay === d ? 'rgba(102,126,234,0.1)' : '#fff' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(102,126,234,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.background = dobDay === d ? 'rgba(102,126,234,0.1)' : '#fff'}
                              >{d}</div>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Month */}
                      <div style={{ flex: 1.2, position: 'relative' }}>
                        <div
                          onClick={() => setOpenDropdown(openDropdown === 'month' ? null : 'month')}
                          style={{
                            borderRadius: '10px', padding: '10px 12px', fontSize: '0.95rem',
                            border: `1px solid ${touched.dob && errors.dob ? '#dc3545' : '#e2e8f0'}`,
                            color: '#2d3748', cursor: 'pointer', background: '#fff',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}
                        >
                          <span>{dobMonth ? months.find(m => m.value === dobMonth)?.label : 'Month'}</span>
                          <span style={{ fontSize: '0.7rem', color: '#a0aec0' }}>&#9662;</span>
                        </div>
                        {openDropdown === 'month' && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                            background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0 0 10px 10px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '150px', overflowY: 'auto',
                          }}>
                            {months.map(m => (
                              <div key={m.value} onClick={() => handleDobSelect('month', m.value)}
                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.95rem', color: '#2d3748', background: dobMonth === m.value ? 'rgba(102,126,234,0.1)' : '#fff' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(102,126,234,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.background = dobMonth === m.value ? 'rgba(102,126,234,0.1)' : '#fff'}
                              >{m.label}</div>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Year */}
                      <div style={{ flex: 1.3, position: 'relative' }}>
                        <div
                          onClick={() => setOpenDropdown(openDropdown === 'year' ? null : 'year')}
                          style={{
                            borderRadius: '10px', padding: '10px 12px', fontSize: '0.95rem',
                            border: `1px solid ${touched.dob && errors.dob ? '#dc3545' : '#e2e8f0'}`,
                            color: '#2d3748', cursor: 'pointer', background: '#fff',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}
                        >
                          <span>{dobYear || 'Year'}</span>
                          <span style={{ fontSize: '0.7rem', color: '#a0aec0' }}>&#9662;</span>
                        </div>
                        {openDropdown === 'year' && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                            background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0 0 10px 10px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '150px', overflowY: 'auto',
                          }}>
                            {years.map(y => (
                              <div key={y} onClick={() => handleDobSelect('year', y)}
                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.95rem', color: '#2d3748', background: dobYear === y ? 'rgba(102,126,234,0.1)' : '#fff' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(102,126,234,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.background = dobYear === y ? 'rgba(102,126,234,0.1)' : '#fff'}
                              >{y}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {touched.dob && errors.dob && <div style={{ color: '#e53e3e', fontSize: '0.85rem', marginTop: '0.35rem' }}>{errors.dob}</div>}
                  </div>

                  {/* Submit button */}
                  <button type="submit" className="btn btn-assessment-primary w-100 py-2 py-md-3" disabled={isLoading} style={{ fontSize: '1.05rem' }}>
                    {isLoading ? (<><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Signing In...</>) : 'Sign In'}
                  </button>

                  <div className="text-center mt-3 mt-md-4" style={{ color: '#718096', fontSize: '0.85rem' }}>Need help? Contact your administrator</div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentLoginPage;
