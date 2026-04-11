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
  isLocked?: boolean;
};

export default function AllottedAssessmentPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [showOngoingModal, setShowOngoingModal] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  const navigate = useNavigate();
  const { fetchAssessmentData } = useAssessment();
  usePreventReload();

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

    if (assessment.studentStatus === 'completed') return;

    if (!assessment.isActive) {
      alert("This assessment is not currently active.");
      return;
    }

    setLoadingId(assessment.assessmentId);

    try {
      localStorage.setItem('assessmentId', String(assessment.assessmentId));

      navigate(`/demographics/${assessment.assessmentId}`);
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
    return { bg: '#fff7ed', text: '#ea580c', border: '#f97316' };
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
    <div className="assessment-bg--full">
      <div className="assessment-scroll-container" style={{ padding: '2rem 1rem' }}>
      <div className="container-lg">
        {/* Header Section */}
        <header className="allotted-header text-center mb-4 mb-md-5">
          <div
            className="header-icon mx-auto mb-3"
            style={{
              width: '80px',
              height: '80px',
              background: 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(10px)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <h1>My Assessments</h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1rem' }}>
            Select an assessment below to begin or continue your progress
          </p>
        </header>

        {assessments.filter((a) => a.isActive).length === 0 ? (
          <div className="row justify-content-center">
            <div className="col-12 col-sm-10 col-md-8 col-lg-6">
              <div
                className="assessment-card p-4 p-md-5 text-center"
                style={{ borderRadius: '24px', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)' }}
              >
                <div
                  style={{
                    width: '100px',
                    height: '100px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem',
                    fontSize: '3rem',
                  }}
                >
                  📭
                </div>
                <h3 style={{ color: '#2d3748', fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.75rem' }}>
                  No Assessments Found
                </h3>
                <p style={{ color: '#718096', fontSize: '1rem', lineHeight: '1.6' }}>
                  There are currently no assessments allotted to your account. Please check back later or contact your administrator.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="assessment-cards-grid">
            {assessments.filter((a) => a.isActive).map((assessment) => {
              const statusStyles = getStatusColor(assessment.studentStatus, assessment.isActive);
              const label = getStatusLabel(assessment.studentStatus, assessment.isActive);
              const icon = getStatusIcon(assessment.studentStatus, assessment.isActive);

              return (
                <div
                  key={assessment.assessmentId}
                  className="card border-0"
                  style={{
                    borderRadius: '20px',
                    overflow: 'hidden',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.12)',
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-6px)';
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
                      height: '5px',
                      background: assessment.studentStatus === 'completed'
                        ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                        : !assessment.isActive
                        ? 'linear-gradient(90deg, #9ca3af 0%, #6b7280 100%)'
                        : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                    }}
                  />

                  <div className="p-3 p-md-4">
                    {/* Status Badge and ID */}
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <span
                        style={{
                          backgroundColor: statusStyles.bg,
                          color: statusStyles.text,
                          padding: '0.4rem 0.85rem',
                          borderRadius: '50px',
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          border: `2px solid ${statusStyles.border}40`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <span style={{ fontSize: '0.9rem' }}>{icon}</span>
                        {label}
                      </span>
                      <span
                        style={{
                          backgroundColor: '#f3f4f6',
                          color: '#6b7280',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '50px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                        }}
                      >
                        #{assessment.assessmentId}
                      </span>
                    </div>

                    {/* Assessment Icon */}
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1rem',
                        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                      }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
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
                        fontSize: '1.35rem',
                        fontWeight: '700',
                        color: '#1f2937',
                        marginBottom: '0.5rem',
                        lineHeight: '1.3',
                      }}
                    >
                      {assessment.assessmentName || `Assessment Module`}
                    </h3>

                    <p
                      style={{
                        color: '#6b7280',
                        fontSize: '0.9rem',
                        marginBottom: '1.5rem',
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
                      className="btn w-100"
                      style={{
                        padding: '0.75rem',
                        borderRadius: '12px',
                        border: 'none',
                        fontSize: '1rem',
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
                        gap: '0.5rem',
                        boxShadow:
                          assessment.studentStatus === 'completed' || !assessment.isActive
                            ? 'none'
                            : '0 4px 15px rgba(102, 126, 234, 0.4)',
                        opacity: assessment.studentStatus === 'completed' || !assessment.isActive ? 0.7 : 1,
                      }}
                    >
                      {loadingId === assessment.assessmentId ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          <span>Preparing...</span>
                        </>
                      ) : (
                        <>
                          {assessment.studentStatus === 'completed' && (
                            <>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <span>Completed</span>
                            </>
                          )}
                          {!assessment.isActive && <span>Unavailable</span>}
                          {assessment.isActive && assessment.studentStatus !== 'completed' && (
                            <>
                              <span>{assessment.studentStatus === 'ongoing' ? 'Continue Assessment' : 'Start Assessment'}</span>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
      </div>

      {/* Ongoing Assessment Modal */}
      {showOngoingModal && (
        <div className="assessment-modal-overlay" onClick={() => setShowOngoingModal(false)}>
          <div className="assessment-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="assessment-icon-circle--md mx-auto mb-3" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', width: '70px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)' }}>
              <svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.75rem' }}>Assessment In Progress</h3>
            <p style={{ color: '#6b7280', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              Your assessment is currently in progress. Please contact your <strong>administrator</strong> to reset your assessment if needed.
            </p>
            <button onClick={() => setShowOngoingModal(false)} className="btn btn-assessment-primary px-4">Got it</button>
          </div>
        </div>
      )}

      {/* Mobile Device Warning Modal */}
      {showMobileWarning && (
        <div className="assessment-modal-overlay" onClick={() => setShowMobileWarning(false)}>
          <div className="assessment-modal-content" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: '75px', height: '75px', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', boxShadow: '0 8px 24px rgba(239, 68, 68, 0.5)' }}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1f2937', marginBottom: '0.75rem' }}>Desktop Required</h3>
            <p style={{ color: '#4b5563', fontSize: '1rem', lineHeight: '1.6', marginBottom: '1rem' }}>
              This assessment <strong>cannot be completed</strong> on a mobile device, tablet, or iPad.
            </p>
            <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', border: '2px solid #fbbf24' }}>
              <p style={{ color: '#92400e', fontSize: '0.9rem', fontWeight: '600', lineHeight: '1.5', margin: 0 }}>
                Please open this assessment on a <strong>Desktop or Laptop computer</strong> to continue.
              </p>
            </div>
            <button onClick={() => setShowMobileWarning(false)} className="btn btn-assessment-primary w-100">I Understand</button>
          </div>
        </div>
      )}
    </div>
  );
}
