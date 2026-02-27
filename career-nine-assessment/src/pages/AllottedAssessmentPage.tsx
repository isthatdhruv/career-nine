import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAssessment } from '../contexts/AssessmentContext';
import { usePreventReload } from '../hooks/usePreventReload';
import http from '../api/http';

type Assessment = {
  assessmentId: number;
  assessmentName: string;
  studentStatus: string | null;
  isActive: boolean;
};

export default function AllottedAssessmentPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [showOngoingModal, setShowOngoingModal] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  const navigate = useNavigate();
  const { fetchAssessmentData } = useAssessment();
  usePreventReload();

  // Device detection function
  const isMobileOrTablet = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipod|android|blackberry|windows phone|webos/.test(userAgent);
    const isTablet = /ipad|android(?!.*mobile)|tablet|kindle|silk/.test(userAgent);
    const isSmallScreen = window.innerWidth <= 1024; // Consider screens <= 1024px as non-desktop

    return isMobile || isTablet || isSmallScreen;
  };

  useEffect(() => {
    const storedAssessments = localStorage.getItem('allottedAssessments');
    if (storedAssessments) {
      try {
        setAssessments(JSON.parse(storedAssessments));
      } catch (e) {
        console.error('Error parsing assessments:', e);
      }
    }
  }, []);

  const handleStartAssessment = async (assessment: Assessment) => {
    const userStudentId = localStorage.getItem('userStudentId');

    if (!userStudentId) {
      alert("Session expired. Please login again.");
      navigate('/student-login');
      return;
    }

    // Check if completed
    if (assessment.studentStatus === 'completed') {
      return; // Button should be disabled, but just in case
    }

    // Check if ongoing - show styled modal to contact administrator
    // if (assessment.studentStatus === 'ongoing') {
    //   setShowOngoingModal(true);
    //   return;
    // }

    // Check if active
    if (!assessment.isActive) {
      alert("This assessment is not currently active.");
      return;
    }

    // Check if device is mobile/tablet/iPad - prevent assessment on non-desktop devices
    if (isMobileOrTablet()) {
      setShowMobileWarning(true);
      return;
    }

    setLoadingId(assessment.assessmentId);

    try {
      // Store the selected assessment ID for use in other pages
      localStorage.setItem('assessmentId', String(assessment.assessmentId));

      // Check if demographic fields are configured and need to be filled
      console.log('[Demographics] Checking status for assessment:', assessment.assessmentId, 'student:', userStudentId);
      const statusRes = await http.get(
        `/student-demographics/status/${assessment.assessmentId}/${userStudentId}`
      );
      const demographicStatus = statusRes.data;
      console.log('[Demographics] Status response:', demographicStatus);

      if (demographicStatus.totalFields > 0) {
        navigate(`/demographics/${assessment.assessmentId}`);
        return;
      }

      // No demographics needed or already completed - start assessment directly
      await http.post('/assessments/startAssessment', { userStudentId: Number(userStudentId), assessmentId: assessment.assessmentId });

      await fetchAssessmentData(String(assessment.assessmentId));
      navigate('/general-instructions');
    } catch (error) {
      console.error('Error starting assessment:', error);
      alert('Failed to start assessment. Please try again.');
    } finally {
      setLoadingId(null);
    }
  };

  const getStatusColor = (status: string | null, isActive: boolean) => {
    if (status === 'completed') return { bg: '#d1fae5', text: '#059669', border: '#10b981' };
    if (!isActive) return { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' };
    if (status === 'ongoing') return { bg: '#dbeafe', text: '#2563eb', border: '#3b82f6' };
    return { bg: '#fff7ed', text: '#ea580c', border: '#f97316' }; // Pending/Not Started
  };

  const getStatusLabel = (status: string | null, isActive: boolean) => {
    if (status === 'completed') return 'Completed';
    if (!isActive) return 'Inactive';
    if (status === 'ongoing') return 'Ongoing';
    return 'Not Started';
  };

  const getStatusIcon = (status: string | null, isActive: boolean) => {
    if (status === 'completed') return '✓';
    if (!isActive) return '⏸';
    if (status === 'ongoing') return '⟳';
    return '○';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '3rem 1.5rem',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        {/* Header Section */}
        <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <div
            style={{
              width: '100px',
              height: '100px',
              background: 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(10px)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <h1
            style={{
              fontSize: '3rem',
              fontWeight: '800',
              color: 'white',
              marginBottom: '0.75rem',
              letterSpacing: '-0.025em',
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
            }}
          >
            My Assessments
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.15rem', fontWeight: '400' }}>
            Select an assessment below to begin or continue your progress
          </p>
        </header>

        {assessments.filter((a) => a.isActive).length === 0 ? (
          <div
            style={{
              backgroundColor: 'white',
              padding: '4rem 2.5rem',
              borderRadius: '24px',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
              maxWidth: '550px',
              margin: '0 auto',
            }}
          >
            <div
              style={{
                width: '120px',
                height: '120px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 2rem',
                fontSize: '3.5rem',
              }}
            >
              📭
            </div>
            <h3
              style={{
                color: '#2d3748',
                fontSize: '1.75rem',
                fontWeight: '700',
                marginBottom: '0.75rem',
              }}
            >
              No Assessments Found
            </h3>
            <p style={{ color: '#718096', fontSize: '1.05rem', lineHeight: '1.6' }}>
              There are currently no assessments allotted to your account. Please check back later or contact your administrator.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '2rem',
            }}
          >
            {assessments.filter((a) => a.isActive).map((assessment) => {
              const statusStyles = getStatusColor(assessment.studentStatus, assessment.isActive);
              const label = getStatusLabel(assessment.studentStatus, assessment.isActive);
              const icon = getStatusIcon(assessment.studentStatus, assessment.isActive);

              return (
                <div
                  key={assessment.assessmentId}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.12)',
                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    border: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px)';
                    e.currentTarget.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.12)';
                  }}
                >
                  {/* Gradient Top Border */}
                  <div
                    style={{
                      height: '6px',
                      background: assessment.studentStatus === 'completed'
                        ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                        : !assessment.isActive
                        ? 'linear-gradient(90deg, #9ca3af 0%, #6b7280 100%)'
                        : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                    }}
                  />

                  <div style={{ padding: '2rem' }}>
                    {/* Status Badge and ID */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1.5rem',
                      }}
                    >
                      <span
                        style={{
                          backgroundColor: statusStyles.bg,
                          color: statusStyles.text,
                          padding: '0.5rem 1rem',
                          borderRadius: '50px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          border: `2px solid ${statusStyles.border}40`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <span style={{ fontSize: '1rem' }}>{icon}</span>
                        {label}
                      </span>
                      <span
                        style={{
                          backgroundColor: '#f3f4f6',
                          color: '#6b7280',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '50px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                        }}
                      >
                        #{assessment.assessmentId}
                      </span>
                    </div>

                    {/* Assessment Icon */}
                    <div
                      style={{
                        width: '70px',
                        height: '70px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1.5rem',
                        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                      }}
                    >
                      <svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                    </div>

                    {/* Assessment Title */}
                    <h3
                      style={{
                        fontSize: '1.6rem',
                        fontWeight: '700',
                        color: '#1f2937',
                        marginBottom: '0.75rem',
                        lineHeight: '1.3',
                      }}
                    >
                      {assessment.assessmentName || `Assessment Module`}
                    </h3>

                    {/* Description */}
                    <p
                      style={{
                        color: '#6b7280',
                        fontSize: '0.95rem',
                        marginBottom: '2rem',
                        lineHeight: '1.6',
                      }}
                    >
                      Complete this assessment to evaluate your skills and knowledge.
                    </p>

                    {/* Action Button */}
                    <button
                      onClick={() => handleStartAssessment(assessment)}
                      disabled={
                        assessment.studentStatus === 'completed' ||
                        !assessment.isActive ||
                        loadingId === assessment.assessmentId
                      }
                      style={{
                        width: '100%',
                        padding: '1rem',
                        borderRadius: '14px',
                        border: 'none',
                        fontSize: '1.05rem',
                        fontWeight: '600',
                        cursor: assessment.studentStatus === 'completed' || !assessment.isActive ? 'not-allowed' : 'pointer',
                        background:
                          assessment.studentStatus === 'completed'
                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                            : !assessment.isActive
                            ? '#e5e7eb'
                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: !assessment.isActive ? '#9ca3af' : 'white',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        boxShadow:
                          assessment.studentStatus === 'completed' || !assessment.isActive
                            ? 'none'
                            : '0 4px 15px rgba(102, 126, 234, 0.4)',
                        opacity: assessment.studentStatus === 'completed' || !assessment.isActive ? 0.7 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (assessment.isActive && assessment.studentStatus !== 'completed') {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (assessment.isActive && assessment.studentStatus !== 'completed') {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                        }
                      }}
                    >
                      {loadingId === assessment.assessmentId ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          <span>Preparing Assessment...</span>
                        </>
                      ) : (
                        <>
                          {assessment.studentStatus === 'completed' && (
                            <>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <span>Completed</span>
                            </>
                          )}
                          {!assessment.isActive && (
                            <>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              <span>Unavailable</span>
                            </>
                          )}
                          {assessment.isActive && assessment.studentStatus !== 'completed' && (
                            <>
                              <span>
                                {assessment.studentStatus === 'ongoing' ? 'Continue Assessment' : 'Start Assessment'}
                              </span>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                              </svg>
                            </>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ongoing Assessment Modal */}
      {showOngoingModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setShowOngoingModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '24px',
              padding: '2.5rem',
              maxWidth: '420px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
              animation: 'fadeIn 0.3s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning Icon */}
            <div
              style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
                boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)',
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            {/* Title */}
            <h3
              style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#1f2937',
                marginBottom: '0.75rem',
              }}
            >
              Assessment In Progress
            </h3>

            {/* Message */}
            <p
              style={{
                color: '#6b7280',
                fontSize: '1rem',
                lineHeight: '1.6',
                marginBottom: '2rem',
              }}
            >
              Your assessment is currently in progress. Please contact your <strong>administrator</strong> to reset your assessment if needed.
            </p>

            {/* Close Button */}
            <button
              onClick={() => setShowOngoingModal(false)}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '0.875rem 2.5rem',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s ease',
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
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Mobile Device Warning Modal */}
      {showMobileWarning && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setShowMobileWarning(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '24px',
              padding: '2.5rem',
              maxWidth: '480px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
              animation: 'fadeIn 0.3s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Device Warning Icon */}
            <div
              style={{
                width: '90px',
                height: '90px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
                boxShadow: '0 8px 24px rgba(239, 68, 68, 0.5)',
              }}
            >
              <svg width="45" height="45" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
                <path d="M8 6h8M8 10h8M8 14h5" stroke="white" strokeWidth="1.5" />
              </svg>
            </div>

            {/* Title */}
            <h3
              style={{
                fontSize: '1.65rem',
                fontWeight: '800',
                color: '#1f2937',
                marginBottom: '1rem',
                lineHeight: '1.2',
              }}
            >
              Desktop Required
            </h3>

            {/* Message */}
            <p
              style={{
                color: '#4b5563',
                fontSize: '1.05rem',
                lineHeight: '1.7',
                marginBottom: '1.25rem',
              }}
            >
              This assessment <strong>cannot be completed</strong> on a mobile device, tablet, or iPad.
            </p>

            <div
              style={{
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                borderRadius: '16px',
                padding: '1.25rem',
                marginBottom: '2rem',
                border: '2px solid #fbbf24',
              }}
            >
              <p
                style={{
                  color: '#92400e',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  lineHeight: '1.6',
                  margin: 0,
                }}
              >
                🖥️ Please open this assessment on a <strong>Desktop or Laptop computer</strong> to continue.
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowMobileWarning(false)}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '1rem 3rem',
                borderRadius: '14px',
                fontSize: '1.05rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s ease',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
              }}
            >
              I Understand
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
