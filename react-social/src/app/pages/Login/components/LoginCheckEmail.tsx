import React from 'react';

interface CheckEmailPageProps {
  email?: string;
}

const LoginCheckEmail: React.FC<CheckEmailPageProps> = ({ email = 'bob@reui.io' }) => {
  const handleSkip = () => {
    // Navigate to change password page
    window.location.href = '/login/reset-password/change-password';
  };

  const handleResend = () => {
    console.log('Resending email to:', email);
    // Add your resend logic here
    alert('Email resent successfully!');
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
        <div className="card-body p-5 text-center">
          {/* Illustration */}
          <div className="mb-4">
            <svg width="200" height="150" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto' }}>
              {/* Email envelope illustration */}
              <g transform="translate(50, 40)">
                {/* Person on left */}
                <ellipse cx="30" cy="45" rx="12" ry="15" stroke="#000" strokeWidth="2" fill="none" />
                <circle cx="30" cy="25" r="10" stroke="#000" strokeWidth="2" fill="none" />
                <path d="M 20 45 Q 25 35 30 40" stroke="#000" strokeWidth="1.5" fill="none" />
                
                {/* Email with yellow dot */}
                <rect x="42" y="30" width="20" height="15" rx="2" stroke="#000" strokeWidth="2" fill="none" />
                <path d="M 42 30 L 52 38 L 62 30" stroke="#000" strokeWidth="2" fill="none" />
                <circle cx="48" cy="25" r="5" fill="#FFC107" />
                <line x1="46" y1="22" x2="44" y2="18" stroke="#000" strokeWidth="1" />
                <line x1="50" y1="22" x2="52" y2="18" stroke="#000" strokeWidth="1" />
                
                {/* Person on right */}
                <ellipse cx="80" cy="45" rx="12" ry="15" stroke="#000" strokeWidth="2" fill="none" />
                <circle cx="80" cy="25" r="10" stroke="#000" strokeWidth="2" fill="none" />
                <path d="M 72 30 Q 75 28 78 30" stroke="#000" strokeWidth="1.5" fill="none" />
                <circle cx="77" cy="27" r="1.5" fill="#000" />
                <circle cx="83" cy="27" r="1.5" fill="#000" />
                <line x1="86" y1="18" x2="88" y2="14" stroke="#000" strokeWidth="1.5" />
              </g>
            </svg>
          </div>

          {/* Heading */}
          <h2 className="mb-3" style={{ fontSize: '1.75rem', fontWeight: '600' }}>
            Check your email
          </h2>

          {/* Description */}
          <p className="text-muted mb-4" style={{ fontSize: '1rem', lineHeight: '1.6' }}>
            Please click the link sent to your email{' '}
            <strong style={{ color: '#000' }}>{email}</strong>
            <br />
            to reset your password. Thank you
          </p>

          {/* Skip button */}
          <button
            className="btn btn-primary mb-3"
            onClick={handleSkip}
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              fontWeight: '500',
              minWidth: '150px'
            }}
          >
            Skip for now
          </button>

          {/* Resend link */}
          <div style={{ fontSize: '0.95rem' }}>
            <span className="text-muted">Didn't receive an email? </span>
            <button
              className="btn btn-link p-0"
              onClick={handleResend}
              style={{
                fontSize: '0.95rem',
                fontWeight: '600',
                textDecoration: 'none',
                verticalAlign: 'baseline'
              }}
            >
              Resend
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginCheckEmail;