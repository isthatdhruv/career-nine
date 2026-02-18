import React from 'react';
import { useNavigate } from 'react-router-dom';

const ThankYouPage: React.FC = () => {
    const navigate = useNavigate();

    const handleGoHome = () => {
        navigate('/student-login');
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '20px',
                fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            }}
        >
            <div
                style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    padding: '50px 70px',
                    borderRadius: '24px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                    textAlign: 'center',
                    maxWidth: '600px',
                    width: '100%',
                    animation: 'fadeIn 0.8s ease-out',
                }}
            >
                <img
                    src="/media/logos/kcc.jpg"
                    alt="Career-9 Logo"
                    style={{
                        width: '120px',
                        height: '120px',
                        objectFit: 'contain',
                        borderRadius: '12px',
                        margin: '0 auto 30px auto',
                        display: 'block',
                        animation: 'scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    }}
                />

                <h1
                    style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        fontSize: '2.5rem',
                        marginBottom: '20px',
                        fontWeight: '700',
                    }}
                >
                    Thank You!
                </h1>

                <p
                    style={{
                        color: '#4a5568',
                        fontSize: '1.15rem',
                        marginBottom: '40px',
                        lineHeight: '1.8',
                    }}
                >
                    You have successfully completed your assessment.
                    <br />
                    Your responses have been recorded.
                </p>

                <button
                    onClick={handleGoHome}
                    style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '14px 40px',
                        borderRadius: '50px',
                        fontSize: '1.05rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
                    }}
                >
                    ← Back to Home
                </button>
            </div>

            <style>
                {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes scaleIn {
            from { transform: scale(0); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}
            </style>
        </div>
    );
};

export default ThankYouPage;
