import React, { useState, useRef } from 'react';

const StudentLoginPage: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [dob, setDob] = useState('');
  const [errors, setErrors] = useState({ userId: '', dob: '' });
  const [touched, setTouched] = useState({ userId: false, dob: false });
  const dateInputRef = useRef<HTMLInputElement>(null);

  const validateUserId = (id: string): string => {
    if (!id) {
      return 'User ID is required';
    }
    if (id.length < 3) {
      return 'User ID must be at least 3 characters';
    }
    return '';
  };

  const validateDob = (date: string): string => {
    if (!date) {
      return 'Date of Birth is required';
    }
    // Validate dd-mm-yyyy format
    const regex = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = date.match(regex);
    if (!match) {
      return 'Please enter date in dd-mm-yyyy format';
    }
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (month < 1 || month > 12) {
      return 'Invalid month';
    }
    if (day < 1 || day > 31) {
      return 'Invalid day';
    }
    return '';
  };

  const handleUserIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserId(value);
    if (touched.userId) {
      setErrors(prev => ({ ...prev, userId: validateUserId(value) }));
    }
  };

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // Remove any non-numeric characters except hyphens
    value = value.replace(/[^\d-]/g, '');

    // Auto-format as dd-mm-yyyy
    const digits = value.replace(/-/g, '');
    if (digits.length <= 2) {
      value = digits;
    } else if (digits.length <= 4) {
      value = `${digits.slice(0, 2)}-${digits.slice(2)}`;
    } else {
      value = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}`;
    }

    setDob(value);
    if (touched.dob) {
      setErrors(prev => ({ ...prev, dob: validateDob(value) }));
    }
  };

  const handleUserIdBlur = () => {
    setTouched(prev => ({ ...prev, userId: true }));
    setErrors(prev => ({ ...prev, userId: validateUserId(userId) }));
  };

  const handleDobBlur = () => {
    setTouched(prev => ({ ...prev, dob: true }));
    setErrors(prev => ({ ...prev, dob: validateDob(dob) }));
  };

  // Handle calendar date picker selection
  const handleCalendarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value; // yyyy-mm-dd format from date input
    if (dateValue) {
      const [year, month, day] = dateValue.split('-');
      const formattedDate = `${day}-${month}-${year}`; // Convert to dd-mm-yyyy
      setDob(formattedDate);
      if (touched.dob) {
        setErrors(prev => ({ ...prev, dob: validateDob(formattedDate) }));
      }
    }
  };

  const openCalendar = () => {
    (dateInputRef.current as any)?.showPicker?.() || dateInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched for validation feedback
    setTouched({ userId: true, dob: true });

    const userIdError = validateUserId(userId);
    const dobError = validateDob(dob);

    setErrors({ userId: userIdError, dob: dobError });

    // If no errors, send the POST request
    if (!userIdError && !dobError) {
      // Date is already in dd-mm-yyyy format
      const formattedDob = dob;

      const requestBody = {
        dobDate: formattedDob,
        username: userId,
      };

      try {
        const response = await fetch('http://localhost:8080/user/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Login successful:', data);
          localStorage.setItem('userStudentId', data.userStudentId);
          localStorage.setItem('allottedAssessments', JSON.stringify(data.assessments));
          // Navigate to the next page
          window.location.href = '/demographics';
        } else {
          console.error('Login failed:', response.statusText);
          alert('Invalid credentials. Please try again.');
        }
      } catch (error) {
        console.error('Error during login:', error);
        alert('An error occurred. Please try again later.');
      }
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: '2rem 1rem',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'fixed',
      top: 0,
      left: 0,
      overflow: 'auto'
    }}>
      <div
        className="card shadow-lg"
        style={{
          width: '550px',
          maxWidth: '95%',
          borderRadius: '20px',
          border: 'none',
        }}
      >
        <div className="card-body p-5">
          {/* Logo/Icon */}
          <div
            style={{
              width: "80px",
              height: "80px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
              boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </div>

          <h2
            className="text-center mb-2"
            style={{
              fontSize: '2.25rem',
              fontWeight: '700',
              color: '#2d3748',
              marginBottom: '0.5rem',
            }}
          >
            Assessment Login
          </h2>
          <p
            className="text-center mb-5"
            style={{
              color: '#718096',
              fontSize: '1rem',
              marginBottom: '2rem',
            }}
          >
            Sign in to continue to your assessment
          </p>

          <form onSubmit={handleSubmit}>
            {/* User ID Section */}
            <div className="mb-4">
              <label
                htmlFor="userId"
                className="form-label"
                style={{
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  color: '#4a5568',
                  marginBottom: '0.5rem',
                }}
              >
                User ID
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#a0aec0',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <input
                  type="text"
                  className={`form-control ${touched.userId && errors.userId ? 'is-invalid' : touched.userId && !errors.userId ? 'is-valid' : ''}`}
                  id="userId"
                  placeholder="Enter your User ID"
                  value={userId}
                  onChange={handleUserIdChange}
                  onBlur={handleUserIdBlur}
                  style={{
                    padding: '0.875rem 1rem 0.875rem 3rem',
                    fontSize: '1rem',
                    borderRadius: '10px',
                    border: `2px solid ${touched.userId && errors.userId ? '#e53e3e' : '#e2e8f0'}`,
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={(e) => {
                    if (!errors.userId) {
                      e.target.style.borderColor = '#667eea';
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                    }
                  }}
                  onBlurCapture={(e) => {
                    if (!errors.userId) {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = 'none';
                    }
                  }}
                />
              </div>
              {touched.userId && errors.userId && (
                <div style={{ color: '#e53e3e', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  {errors.userId}
                </div>
              )}
            </div>

            {/* DOB Section */}
            <div className="mb-5">
              <label
                htmlFor="dob"
                className="form-label"
                style={{
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  color: '#4a5568',
                  marginBottom: '0.5rem',
                }}
              >
                Date of Birth
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#a0aec0',
                    zIndex: 1,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div className="input-group">
                  <input
                    type="text"
                    className={`form-control ${touched.dob && errors.dob ? 'is-invalid' : touched.dob && !errors.dob ? 'is-valid' : ''}`}
                    id="dob"
                    placeholder="dd-mm-yyyy"
                    maxLength={10}
                    value={dob}
                    onChange={handleDobChange}
                    onBlur={handleDobBlur}
                    style={{
                      padding: '0.875rem 1rem 0.875rem 3rem',
                      fontSize: '1rem',
                      borderRadius: '10px 0 0 10px',
                      border: `2px solid ${touched.dob && errors.dob ? '#e53e3e' : '#e2e8f0'}`,
                      borderRight: 'none',
                      transition: 'all 0.2s ease',
                    }}
                    onFocus={(e) => {
                      if (!errors.dob) {
                        e.target.style.borderColor = '#667eea';
                        e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                      }
                    }}
                    onBlurCapture={(e) => {
                      if (!errors.dob) {
                        e.target.style.borderColor = '#e2e8f0';
                        e.target.style.boxShadow = 'none';
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={openCalendar}
                    style={{
                      border: `2px solid ${touched.dob && errors.dob ? '#e53e3e' : '#e2e8f0'}`,
                      borderLeft: 'none',
                      background: 'white',
                      borderRadius: '0 10px 10px 0',
                      padding: '0 1rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '1.25rem',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f7fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'white';
                    }}
                  >
                    📅
                  </button>
                  <input
                    type="date"
                    ref={dateInputRef}
                    onChange={handleCalendarChange}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                  />
                </div>
              </div>
              {touched.dob && errors.dob && (
                <div style={{ color: '#e53e3e', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  {errors.dob}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn w-100"
              style={{
                padding: '0.875rem',
                fontSize: '1.1rem',
                fontWeight: '600',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s ease',
                marginTop: '1rem',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
              }}
            >
              Sign In
            </button>

            <div
              className="text-center mt-4"
              style={{
                color: '#718096',
                fontSize: '0.9rem'
              }}
            >
              Need help? Contact your administrator
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StudentLoginPage;