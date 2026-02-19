import React from 'react';
import { useNavigate } from 'react-router-dom';

const ThankYouPage: React.FC = () => {
    const navigate = useNavigate();

    const handleGoToDashboard = () => {
        navigate('/student-dashboard');
    };

    const handleExploreCareerLibrary = () => {
        window.open('https://library.career-9.com', '_blank');
    };

    return (
        <>
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
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Decorative floating elements */}
                <div style={{
                    position: 'absolute',
                    top: '10%',
                    left: '5%',
                    width: '150px',
                    height: '150px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)',
                    animation: 'float 6s ease-in-out infinite',
                }} />
                <div style={{
                    position: 'absolute',
                    bottom: '15%',
                    right: '8%',
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.08)',
                    animation: 'float 8s ease-in-out infinite reverse',
                }} />
                <div style={{
                    position: 'absolute',
                    top: '60%',
                    left: '10%',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)',
                    animation: 'float 5s ease-in-out infinite',
                }} />

                <div
                    style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.98)',
                        padding: '50px 60px',
                        borderRadius: '28px',
                        boxShadow: '0 25px 80px rgba(0,0,0,0.25)',
                        textAlign: 'center',
                        maxWidth: '700px',
                        width: '100%',
                        animation: 'fadeIn 0.8s ease-out',
                        position: 'relative',
                        zIndex: 1,
                    }}
                >
                    {/* Success checkmark icon */}
                    <div
                        style={{
                            width: '90px',
                            height: '90px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 25px auto',
                            boxShadow: '0 10px 30px rgba(16, 185, 129, 0.4)',
                            animation: 'scaleIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        }}
                    >
                        <svg
                            width="45"
                            height="45"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>

                    <img
                        src="/media/logos/kcc.jpg"
                        alt="Career-9 Logo"
                        style={{
                            width: '100px',
                            height: '100px',
                            objectFit: 'contain',
                            borderRadius: '16px',
                            margin: '0 auto 25px auto',
                            display: 'block',
                            boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
                        }}
                    />

                    <h1
                        style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            fontSize: '2.8rem',
                            marginBottom: '15px',
                            fontWeight: '800',
                            letterSpacing: '-0.5px',
                        }}
                    >
                        🎉 Thank You!
                    </h1>

                    <p
                        style={{
                            color: '#4a5568',
                            fontSize: '1.2rem',
                            marginBottom: '15px',
                            lineHeight: '1.8',
                            fontWeight: '500',
                        }}
                    >
                        You have successfully completed your assessment.
                    </p>

                    <p
                        style={{
                            color: '#718096',
                            fontSize: '1rem',
                            marginBottom: '35px',
                            lineHeight: '1.6',
                        }}
                    >
                        Your responses have been recorded securely. <br />
                        Now explore your personalized insights and career possibilities!
                    </p>

                    {/* Divider */}
                    <div style={{
                        height: '2px',
                        background: 'linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.3), transparent)',
                        margin: '0 auto 35px auto',
                        width: '80%',
                    }} />

                    {/* Button Cards Container */}
                    <div
                        style={{
                            display: 'flex',
                            gap: '20px',
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                        }}
                    >
                        {/* Dashboard Button Card */}
                        <div
                            onClick={handleGoToDashboard}
                            style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                borderRadius: '20px',
                                padding: '25px 30px',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 10px 35px rgba(102, 126, 234, 0.4)',
                                flex: '1',
                                minWidth: '240px',
                                maxWidth: '280px',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 15px 45px rgba(102, 126, 234, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 10px 35px rgba(102, 126, 234, 0.4)';
                            }}
                        >
                            <div style={{
                                width: '50px',
                                height: '50px',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 15px auto',
                            }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="7" height="9"></rect>
                                    <rect x="14" y="3" width="7" height="5"></rect>
                                    <rect x="14" y="12" width="7" height="9"></rect>
                                    <rect x="3" y="16" width="7" height="5"></rect>
                                </svg>
                            </div>
                            <h3 style={{
                                color: 'white',
                                fontSize: '1.15rem',
                                fontWeight: '700',
                                marginBottom: '8px',
                            }}>
                                Go to Dashboard
                            </h3>
                            <p style={{
                                color: 'rgba(255,255,255,0.85)',
                                fontSize: '0.85rem',
                                lineHeight: '1.5',
                                margin: 0,
                            }}>
                                Comprehensive Student Insight Dashboard
                            </p>
                        </div>

                        {/* Career Library Button Card */}
                        <div
                            
                            style={{
                                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                borderRadius: '20px',
                                padding: '25px 30px',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 10px 35px rgba(245, 87, 108, 0.4)',
                                flex: '1',
                                minWidth: '240px',
                                maxWidth: '280px',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 15px 45px rgba(245, 87, 108, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 10px 35px rgba(245, 87, 108, 0.4)';
                            }}
                        >
                            <div 
                            onClick={handleExploreCareerLibrary}
                            style={{
                                
                                width: '50px',
                                height: '50px',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 15px auto',
                            }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                    <path d="M8 7h8"></path>
                                    <path d="M8 11h6"></path>
                                </svg>
                            </div>
                            <h3 style={{
                                color: 'white',
                                fontSize: '1.15rem',
                                fontWeight: '700',
                                marginBottom: '8px',
                            }}>
                                Explore Career Library
                            </h3>
                            <p style={{
                                color: 'rgba(255,255,255,0.85)',
                                fontSize: '0.85rem',
                                lineHeight: '1.5',
                                margin: 0,
                            }}>
                                Explore 200+ career options from 44+ career categories
                            </p>
                        </div>
                    </div>
                </div>

                <style>
                    {`
                        @keyframes fadeIn {
                            from { opacity: 0; transform: translateY(30px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                        @keyframes scaleIn {
                            from { transform: scale(0); opacity: 0; }
                            to { transform: scale(1); opacity: 1; }
                        }
                        @keyframes float {
                            0%, 100% { transform: translateY(0px); }
                            50% { transform: translateY(-20px); }
                        }
                    `}
                </style>
            </div>
        </>
    );
};

export default ThankYouPage;
