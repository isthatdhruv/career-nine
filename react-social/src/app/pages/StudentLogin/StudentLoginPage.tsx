import React, { useState } from 'react';

const StudentLoginPage: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [dob, setDob] = useState('');
  const [errors, setErrors] = useState({ userId: '', dob: '' });
  const [touched, setTouched] = useState({ userId: false, dob: false });

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
    const value = e.target.value;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched for validation feedback
    setTouched({ userId: true, dob: true });

    const userIdError = validateUserId(userId);
    const dobError = validateDob(dob);

    setErrors({ userId: userIdError, dob: dobError });

    // If no errors, send the POST request
    if (!userIdError && !dobError) {
      // Format the date to dd-MM-yyyy
      const formattedDob = new Date(dob).toLocaleDateString('en-GB').replace(/\//g, '-'); // 'en-GB' ensures dd/MM/yyyy format, replace '/' with '-'

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
          // Navigate to the next page
          window.location.href = '/studentAssessment';
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
      height: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      overflow: 'hidden',
      backgroundColor: '#f8f9fa',
      position: 'fixed',
      top: 0,
      left: 0
    }}>
      <div className="card shadow-sm" style={{ width: '500px', maxWidth: '90%' }}>
        <div className="card-body p-5">
          <h2 className="text-center mb-4" style={{ fontSize: '2rem', fontWeight: '600' }}>Login</h2>
          <form onSubmit={handleSubmit}>
            {/* User ID Section */}
            <div className="mb-5">
              <label htmlFor="userId" className="form-label" style={{ fontSize: '0.95rem', fontWeight: '500' }}>User ID</label>
              <input
                type="text"
                className={`form-control ${touched.userId && errors.userId ? 'is-invalid' : touched.userId && !errors.userId ? 'is-valid' : ''}`}
                id="userId"
                placeholder="Enter User ID"
                value={userId}
                onChange={handleUserIdChange}
                onBlur={handleUserIdBlur}
                style={{ padding: '0.75rem', fontSize: '1rem' }}
              />
              {touched.userId && errors.userId && (
                <div className="invalid-feedback" style={{ display: 'block' }}>
                  {errors.userId}
                </div>
              )}
            </div>

            {/* DOB Section with Calendar Picker */}
            <div className="mb-5">
              <label htmlFor="dob" className="form-label" style={{ fontSize: '0.95rem', fontWeight: '500' }}>Date of Birth</label>
              <input
                type="date"
                className={`form-control ${touched.dob && errors.dob ? 'is-invalid' : touched.dob && !errors.dob ? 'is-valid' : ''}`}
                id="dob"
                value={dob}
                onChange={handleDobChange}
                onBlur={handleDobBlur}
                style={{ padding: '0.75rem', fontSize: '1rem' }}
              />
              {touched.dob && errors.dob && (
                <div className="invalid-feedback" style={{ display: 'block' }}>
                  {errors.dob}
                </div>
              )}
            </div>

            <button 
              type="submit" 
              className="btn btn-primary w-100 mt-5"
              style={{ padding: '0.75rem', fontSize: '1.1rem', fontWeight: '500' }}
            >
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StudentLoginPage;