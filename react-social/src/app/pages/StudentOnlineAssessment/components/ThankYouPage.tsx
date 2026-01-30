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
                background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                padding: '20px',
                fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            }}
        >
            <div
                style={{
                    backgroundColor: 'white',
                    padding: '40px 60px',
                    borderRadius: '15px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    textAlign: 'center',
                    maxWidth: '600px',
                    width: '100%',
                    animation: 'fadeIn 0.8s ease-out',
                }}
            >
                <div
                    style={{
                        fontSize: '80px',
                        color: '#28a745',
                        marginBottom: '20px',
                        animation: 'scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    }}
                >
                    ✓
                </div>

                <h1
                    style={{
                        color: '#333',
                        fontSize: '2.5rem',
                        marginBottom: '20px',
                        fontWeight: '600',
                    }}
                >
                    Thank You!
                </h1>

                <p
                    style={{
                        color: '#666',
                        fontSize: '1.2rem',
                        marginBottom: '40px',
                        lineHeight: '1.6',
                    }}
                >
                    You have successfully completed your assessment.
                    <br />
                    Your responses have been recorded.
                </p>

                <button
                    onClick={handleGoHome}
                    style={{
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        padding: '12px 30px',
                        borderRadius: '50px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s, background-color 0.2s',
                        boxShadow: '0 4px 6px rgba(0, 123, 255, 0.2)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 123, 255, 0.3)';
                        e.currentTarget.style.backgroundColor = '#0056b3';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 123, 255, 0.2)';
                        e.currentTarget.style.backgroundColor = '#007bff';
                    }}
                >
                    Back to Home
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
