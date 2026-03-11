import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePreventReload } from '../hooks/usePreventReload';
import http from '../api/http';
import { useAssessment } from '../contexts/AssessmentContext';

const StudentLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { prefetchAssessmentData } = useAssessment();
  const [userId, setUserId] = useState('');
  const [dob, setDob] = useState('');
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
  const dateInputRef = useRef<HTMLInputElement>(null);

  usePreventReload(userId.length > 0 || dob.length > 0);

  const validateUserId = (id: string): string => {
    if (!id) return 'User ID is required';
    return '';
  };

  const validateDob = (date: string): string => {
    if (!date) return 'Date of Birth is required';
    const regex = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = date.match(regex);
    if (!match) return 'Please enter date in dd-mm-yyyy format';
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    if (month < 1 || month > 12) return 'Invalid month';
    if (day < 1 || day > 31) return 'Invalid day';
    return '';
  };

  const handleUserIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserId(value);
    if (touched.userId) setErrors(prev => ({ ...prev, userId: validateUserId(value) }));
  };

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/[^\d-]/g, '');
    const digits = value.replace(/-/g, '');
    if (digits.length <= 2) value = digits;
    else if (digits.length <= 4) value = `${digits.slice(0, 2)}-${digits.slice(2)}`;
    else value = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}`;
    setDob(value);
    if (touched.dob) setErrors(prev => ({ ...prev, dob: validateDob(value) }));
  };

  const handleUserIdBlur = () => {
    setTouched(prev => ({ ...prev, userId: true }));
    setErrors(prev => ({ ...prev, userId: validateUserId(userId) }));
    if (userId.trim()) {
      prefetchAssessmentData(userId.trim());
    }
  };

  const handleDobBlur = () => {
    setTouched(prev => ({ ...prev, dob: true }));
    setErrors(prev => ({ ...prev, dob: validateDob(dob) }));
  };

  const handleCalendarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    if (dateValue) {
      const [year, month, day] = dateValue.split('-');
      const formattedDate = `${day}-${month}-${year}`;
      setDob(formattedDate);
      if (touched.dob) setErrors(prev => ({ ...prev, dob: validateDob(formattedDate) }));
    }
  };

  const openCalendar = () => {
    (dateInputRef.current as any)?.showPicker?.() || dateInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ userId: true, dob: true });
    const userIdError = validateUserId(userId);
    const dobError = validateDob(dob);
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
    <div className="assessment-bg" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', overflow: 'auto' }}>
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

                  {/* DOB field */}
                  <div className="mb-4">
                    <label htmlFor="dob" className="form-label fw-semibold" style={{ color: '#4a5568', fontSize: '0.95rem' }}>Date of Birth</label>
                    <div className="position-relative">
                      <div className="position-absolute top-50 translate-middle-y" style={{ left: '1rem', color: '#a0aec0', zIndex: 1 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      </div>
                      <div className="input-group">
                        <input
                          type="text"
                          className={`form-control assessment-input ${touched.dob && errors.dob ? 'is-invalid' : touched.dob && !errors.dob ? 'is-valid' : ''}`}
                          id="dob"
                          placeholder="dd-mm-yyyy"
                          maxLength={10}
                          value={dob}
                          onChange={handleDobChange}
                          onBlur={handleDobBlur}
                          style={{ borderRadius: '10px 0 0 10px', borderRight: 'none' }}
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={openCalendar}
                          style={{ borderRadius: '0 10px 10px 0', borderColor: '#e2e8f0', fontSize: '1.1rem' }}
                        >
                          &#x1f4c5;
                        </button>
                        <input type="date" ref={dateInputRef} onChange={handleCalendarChange} style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
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
