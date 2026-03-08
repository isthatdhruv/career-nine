import React, { useState } from 'react';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [touched, setTouched] = useState({ email: false, password: false });

  const validateEmail = (email: string): string => {
    if (!email) {
      return 'Email is required';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return '';
  };

  const validatePassword = (password: string): string => {
    if (!password) {
      return 'Password is required';
    }
    if (password.length < 6) {
      return 'Password must be at least 6 characters';
    }
    return '';
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (touched.email) {
      setErrors(prev => ({ ...prev, email: validateEmail(value) }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (touched.password) {
      setErrors(prev => ({ ...prev, password: validatePassword(value) }));
    }
  };

  const handleEmailBlur = () => {
    setTouched(prev => ({ ...prev, email: true }));
    setErrors(prev => ({ ...prev, email: validateEmail(email) }));
  };

  const handlePasswordBlur = () => {
    setTouched(prev => ({ ...prev, password: true }));
    setErrors(prev => ({ ...prev, password: validatePassword(password) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({ email: true, password: true });
    
    // Validate all fields
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    
    setErrors({ email: emailError, password: passwordError });
    
    // If no errors, proceed with login
    if (!emailError && !passwordError) {
      console.log('Login submitted:', { email, password });
      // Navigate to dashboard
      window.location.href = '/dashboard';
    }
  };

  const handleForgotPassword = () => {
    window.location.href = '/login/reset-password/enter-email';
  };

  return (
    <div >
      <div className="card shadow-sm" style={{ width: '500px', maxWidth: '90%' }}>
        <div className="card-body p-5">
          <h2 className="text-center mb-4" style={{ fontSize: '2rem', fontWeight: '600' }}>Login</h2>
          <p className="text-center text-muted mb-5" style={{ fontSize: '1rem' }}>
            Need an account? <a href="/signup" className="text-decoration-none">Sign up</a>
          </p>

          <div>
            <div className="mb-5">
              <label htmlFor="email" className="form-label" style={{ fontSize: '0.95rem', fontWeight: '500' }}>Email</label>
              <input
                type="email"
                className={`form-control ${touched.email && errors.email ? 'is-invalid' : touched.email && !errors.email ? 'is-valid' : ''}`}
                id="email"
                placeholder="email@email.com"
                value={email}
                onChange={handleEmailChange}
                onBlur={handleEmailBlur}
                style={{ padding: '0.75rem', fontSize: '1rem' }}
              />
              {touched.email && errors.email && (
                <div className="invalid-feedback" style={{ display: 'block' }}>
                  {errors.email}
                </div>
              )}
            </div>

            <div className="mb-5">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label htmlFor="password" className="form-label mb-0" style={{ fontSize: '0.95rem', fontWeight: '500' }}>Password</label>
                <button
                  type="button"
                  className="btn btn-link btn-sm text-decoration-none p-0"
                  onClick={handleForgotPassword}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="input-group">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`form-control ${touched.password && errors.password ? 'is-invalid' : touched.password && !errors.password ? 'is-valid' : ''}`}
                  id="password"
                  placeholder="Enter Password"
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={handlePasswordBlur}
                  style={{ padding: '0.75rem', fontSize: '1rem' }}
                />
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ border: '1px solid #ced4da', padding: '0.5rem 0.75rem' }}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                      <line x1="3" y1="3" x2="21" y2="21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {touched.password && errors.password && (
                <div className="invalid-feedback" style={{ display: 'block' }}>
                  {errors.password}
                </div>
              )}
            </div>

            <button 
              type="button" 
              className="btn btn-primary w-100 mt-5"
              onClick={handleSubmit}
              style={{ padding: '0.75rem', fontSize: '1.1rem', fontWeight: '500' }}
            >
              Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;