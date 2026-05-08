import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUpgradeInfo } from '../api-clients/campaignAPI';

type UpgradeInfo = {
    entitlementId: number;
    status: string;
    purchasePath: string;
    alreadyActive: boolean;
    campaign: { campaignId: number; name: string; slug: string; brandLogoUrl?: string };
    assessment: { assessmentId: number; assessmentName: string };
    student: { name?: string; email?: string; phone?: string };
    tiers: Array<{ campaignAssessmentTierId: number; name: string; priceInr: number }>;
    activeTier: null | { name: string; includesDashboard: boolean; includesFinalReport?: boolean };
    dashboardUrl: string | null;
    finalReportUrl: string | null;
    careerLibraryUrl: string;
};

const ThankYouPage: React.FC = () => {
    const navigate = useNavigate();

    const [hoveredRating, setHoveredRating] = useState<number>(0);
    const [submittedRating, setSubmittedRating] = useState<number>(0);
    const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);
    const [ratingError, setRatingError] = useState<string>('');
    const [upgradeInfo, setUpgradeInfo] = useState<UpgradeInfo | null>(null);

    useEffect(() => {
        const webgazerVideo = document.getElementById('webgazerVideoFeed') as HTMLVideoElement | null;
        if (webgazerVideo && webgazerVideo.srcObject) {
            (webgazerVideo.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
            webgazerVideo.srcObject = null;
        }
        ['webgazerVideoContainer', 'webgazerFaceFeedbackBox', 'webgazerGazeDot', 'webgazerFaceOverlay'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
    }, []);

    useEffect(() => {
        const entitlementId = localStorage.getItem('entitlementId');
        if (!entitlementId) return;
        getUpgradeInfo(entitlementId)
            .then((res) => setUpgradeInfo(res.data as UpgradeInfo))
            .catch(() => setUpgradeInfo(null));
    }, []);

    const handleExploreCareerLibrary = () => {
        window.open('https://library.career-9.com', '_blank');
    };

    const handleGoToDashboard = () => {
        if (upgradeInfo?.dashboardUrl) window.open(upgradeInfo.dashboardUrl, '_blank');
    };

    const handleDownloadReport = () => {
        if (upgradeInfo?.finalReportUrl) window.open(upgradeInfo.finalReportUrl, '_blank');
    };

    const handleGetReport = () => {
        if (!upgradeInfo) return;
        const slug = upgradeInfo.campaign.slug;
        const aid = upgradeInfo.assessment.assessmentId;
        const eid = upgradeInfo.entitlementId;
        navigate(`/c/${slug}/${aid}/upgrade/${eid}`);
    };

    const showUpgradeCta =
        !!upgradeInfo &&
        upgradeInfo.status === 'pending' &&
        upgradeInfo.purchasePath === 'B' &&
        upgradeInfo.tiers.length > 0;
    const showActiveButtons = !!upgradeInfo && upgradeInfo.alreadyActive;
    const showDashboardButton = showActiveButtons && !!upgradeInfo?.dashboardUrl;
    const showDownloadReportButton = showActiveButtons && !!upgradeInfo?.finalReportUrl;

    const submitRating = async (rating: number) => {
        if (submittedRating > 0 || isSubmittingRating) return;

        const userStudentId = localStorage.getItem('userStudentId');
        const assessmentId = localStorage.getItem('assessmentId');

        if (!userStudentId || !assessmentId) {
            setRatingError('Unable to record rating — session info missing.');
            return;
        }

        setIsSubmittingRating(true);
        setRatingError('');

        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/assessment-answer/feedback-rating`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({
                        userStudentId: parseInt(userStudentId, 10),
                        assessmentId: parseInt(assessmentId, 10),
                        rating,
                    }),
                },
            );

            if (!res.ok) {
                throw new Error(`Request failed: ${res.status}`);
            }

            setSubmittedRating(rating);
        } catch (err) {
            setRatingError('Could not save your rating. Please try again.');
        } finally {
            setIsSubmittingRating(false);
        }
    };

    const displayRating = submittedRating || hoveredRating;

    return (
        <>
            <div className="assessment-bg" style={{ flexDirection: 'column', position: 'relative', padding: '1.5rem' }}>
                {/* Decorative floating elements - hidden on mobile via CSS */}
                <div className="thank-you-decoration" style={{ top: '10%', left: '5%', width: '120px', height: '120px', animation: 'float 6s ease-in-out infinite' }} />
                <div className="thank-you-decoration" style={{ bottom: '15%', right: '8%', width: '80px', height: '80px', background: 'rgba(255,255,255,0.08)', animation: 'float 8s ease-in-out infinite reverse' }} />

                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-12 col-sm-10 col-md-8 col-lg-7 col-xl-6">
                            <div className="thank-you-card" style={{ animation: 'fadeIn 0.8s ease-out' }}>
                                {/* Success checkmark icon */}
                                <div
                                    className="success-icon mx-auto mb-3"
                                    style={{
                                        width: '75px',
                                        height: '75px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 10px 30px rgba(16, 185, 129, 0.4)',
                                        animation: 'scaleIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                    }}
                                >
                                    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>

                                <img
                                    src="/media/logos/kcc.webp"
                                    alt="Career-9 Logo"
                                    style={{
                                        width: '80px',
                                        height: '80px',
                                        objectFit: 'contain',
                                        borderRadius: '14px',
                                        margin: '0 auto 1.25rem auto',
                                        display: 'block',
                                        boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
                                    }}
                                />

                                <h1
                                    style={{
                                        background: 'linear-gradient(135deg, #5DD68D 0%, #3FB876 100%)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text',
                                        fontSize: '2.25rem',
                                        marginBottom: '0.75rem',
                                        fontWeight: '800',
                                        letterSpacing: '-0.5px',
                                    }}
                                >
                                    Thank You!
                                </h1>

                                <p style={{ color: '#4a5568', fontSize: '1.05rem', marginBottom: '0.75rem', lineHeight: '1.7', fontWeight: '500' }}>
                                    You have successfully completed your assessment.
                                </p>

                                <p style={{ color: '#718096', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                                    Your responses have been recorded securely. <br className="d-none d-sm-inline" />
                                    Now explore your personalized insights and career possibilities!
                                </p>

                                {/* 5-star feedback rating */}
                                <div
                                    style={{
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '14px',
                                        padding: '1rem 1.25rem',
                                        marginBottom: '1.5rem',
                                    }}
                                >
                                    <p
                                        style={{
                                            color: '#2d3748',
                                            fontSize: '0.95rem',
                                            fontWeight: 600,
                                            margin: '0 0 0.5rem 0',
                                        }}
                                    >
                                        How did you find the assessment?
                                    </p>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            marginBottom: submittedRating || ratingError ? '0.5rem' : 0,
                                        }}
                                        onMouseLeave={() => setHoveredRating(0)}
                                    >
                                        {[1, 2, 3, 4, 5].map((star) => {
                                            const isActive = star <= displayRating;
                                            const isLocked = submittedRating > 0 || isSubmittingRating;
                                            return (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    aria-label={`${star} star${star > 1 ? 's' : ''}`}
                                                    onMouseEnter={() => !isLocked && setHoveredRating(star)}
                                                    onClick={() => submitRating(star)}
                                                    disabled={isLocked}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        padding: '4px',
                                                        cursor: isLocked ? 'default' : 'pointer',
                                                        transition: 'transform 0.15s ease',
                                                        transform: isActive && !submittedRating ? 'scale(1.1)' : 'scale(1)',
                                                    }}
                                                >
                                                    <svg
                                                        width="32"
                                                        height="32"
                                                        viewBox="0 0 24 24"
                                                        fill={isActive ? '#f59e0b' : 'none'}
                                                        stroke={isActive ? '#f59e0b' : '#cbd5e0'}
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                    </svg>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {submittedRating > 0 && (
                                        <p style={{ color: '#059669', fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>
                                            Thanks for your feedback!
                                        </p>
                                    )}
                                    {ratingError && (
                                        <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: 0 }}>
                                            {ratingError}
                                        </p>
                                    )}
                                </div>

                                {/* Divider */}
                                <div style={{
                                    height: '2px',
                                    background: 'linear-gradient(90deg, transparent, rgba(93, 214, 141, 0.3), transparent)',
                                    margin: '0 auto 1.5rem auto',
                                    width: '80%',
                                }} />

                                {/* Major upgrade CTA — Try-First students who haven't paid */}
                                {showUpgradeCta && (
                                    <div className="d-flex justify-content-center mb-3">
                                        <div
                                            onClick={handleGetReport}
                                            className="text-center"
                                            style={{
                                                background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                                                borderRadius: '16px',
                                                padding: '1.5rem 1.5rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                boxShadow: '0 10px 35px rgba(245, 158, 11, 0.45)',
                                                width: '100%',
                                                maxWidth: '420px',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                                e.currentTarget.style.boxShadow = '0 15px 45px rgba(245, 158, 11, 0.55)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                                e.currentTarget.style.boxShadow = '0 10px 35px rgba(245, 158, 11, 0.45)';
                                            }}
                                        >
                                            <div style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '12px',
                                                background: 'rgba(255,255,255,0.22)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto 0.85rem auto',
                                            }}>
                                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <polyline points="14 2 14 8 20 8" />
                                                    <line x1="16" y1="13" x2="8" y2="13" />
                                                    <line x1="16" y1="17" x2="8" y2="17" />
                                                    <polyline points="10 9 9 9 8 9" />
                                                </svg>
                                            </div>
                                            <h3 style={{ color: 'white', fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.4rem' }}>
                                                Get your detailed report
                                            </h3>
                                            <p style={{ color: 'rgba(255,255,255,0.92)', fontSize: '0.86rem', lineHeight: '1.45', margin: 0 }}>
                                                Unlock your personalized career insights for {upgradeInfo?.assessment.assessmentName ?? 'this assessment'}.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Active state — student has already paid */}
                                {showActiveButtons && (
                                    <p style={{ color: '#059669', fontSize: '0.88rem', fontWeight: 600, margin: '0 0 1rem 0' }}>
                                        ✓ Your report has been sent to your email.
                                    </p>
                                )}

                                {/* CTA tiles row */}
                                <div className="d-flex justify-content-center flex-wrap" style={{ gap: '14px' }}>
                                    {/* Download Report — only when active and final report included */}
                                    {showDownloadReportButton && (
                                        <div
                                            onClick={handleDownloadReport}
                                            className="text-center"
                                            style={{
                                                background: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)',
                                                borderRadius: '16px',
                                                padding: '1.25rem 1.5rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                boxShadow: '0 10px 35px rgba(245, 158, 11, 0.4)',
                                                width: '100%',
                                                maxWidth: '280px',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                                e.currentTarget.style.boxShadow = '0 15px 45px rgba(245, 158, 11, 0.5)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                                e.currentTarget.style.boxShadow = '0 10px 35px rgba(245, 158, 11, 0.4)';
                                            }}
                                        >
                                            <div style={{
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '10px',
                                                background: 'rgba(255,255,255,0.22)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto 0.75rem auto',
                                            }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <polyline points="7 10 12 15 17 10" />
                                                    <line x1="12" y1="15" x2="12" y2="3" />
                                                </svg>
                                            </div>
                                            <h3 style={{ color: 'white', fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                                Download Report
                                            </h3>
                                            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem', lineHeight: '1.4', margin: 0 }}>
                                                Open your detailed Career-9 report
                                            </p>
                                        </div>
                                    )}

                                    {/* Go to Dashboard — only when active and dashboard included */}
                                    {showDashboardButton && (
                                        <div
                                            onClick={handleGoToDashboard}
                                            className="text-center"
                                            style={{
                                                background: 'linear-gradient(135deg, #93C5FD 0%, #3B82F6 100%)',
                                                borderRadius: '16px',
                                                padding: '1.25rem 1.5rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                boxShadow: '0 10px 35px rgba(59, 130, 246, 0.4)',
                                                width: '100%',
                                                maxWidth: '280px',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                                e.currentTarget.style.boxShadow = '0 15px 45px rgba(59, 130, 246, 0.5)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                                e.currentTarget.style.boxShadow = '0 10px 35px rgba(59, 130, 246, 0.4)';
                                            }}
                                        >
                                            <div style={{
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '10px',
                                                background: 'rgba(255,255,255,0.2)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto 0.75rem auto',
                                            }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="3" width="7" height="9" />
                                                    <rect x="14" y="3" width="7" height="5" />
                                                    <rect x="14" y="12" width="7" height="9" />
                                                    <rect x="3" y="16" width="7" height="5" />
                                                </svg>
                                            </div>
                                            <h3 style={{ color: 'white', fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                                Go to Dashboard
                                            </h3>
                                            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', lineHeight: '1.4', margin: 0 }}>
                                                See your personalized insights & report
                                            </p>
                                        </div>
                                    )}

                                    {/* Career Library — always shown */}
                                    <div
                                        onClick={handleExploreCareerLibrary}
                                        className="text-center"
                                        style={{
                                            background: 'linear-gradient(135deg, #86EFAC 0%, #34D399 100%)',
                                            borderRadius: '16px',
                                            padding: '1.25rem 1.5rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            boxShadow: '0 10px 35px rgba(52, 211, 153, 0.4)',
                                            width: '100%',
                                            maxWidth: '280px',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                            e.currentTarget.style.boxShadow = '0 15px 45px rgba(52, 211, 153, 0.5)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                            e.currentTarget.style.boxShadow = '0 10px 35px rgba(52, 211, 153, 0.4)';
                                        }}
                                    >
                                        <div style={{
                                            width: '42px',
                                            height: '42px',
                                            borderRadius: '10px',
                                            background: 'rgba(255,255,255,0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 0.75rem auto',
                                        }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                                <path d="M8 7h8"></path>
                                                <path d="M8 11h6"></path>
                                            </svg>
                                        </div>
                                        <h3 style={{ color: 'white', fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.4rem' }}>
                                            {showActiveButtons ? 'Go to Career Library' : 'Explore Career Library'}
                                        </h3>
                                        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', lineHeight: '1.4', margin: 0 }}>
                                            Explore 200+ career options from 44+ career categories
                                        </p>
                                    </div>
                                </div>
                            </div>
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
