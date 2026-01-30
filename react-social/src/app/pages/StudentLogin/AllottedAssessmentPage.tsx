import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAssessment } from "./AssessmentContext";

type Assessment = {
  assessmentId: number;
  assessmentName: string;
  studentStatus: string | null;
  isActive: boolean;
};

export default function AllottedAssessmentPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const navigate = useNavigate();
  const { fetchAssessmentData } = useAssessment();

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

    // Check if active
    if (!assessment.isActive) {
      alert("This assessment is not currently active.");
      return;
    }

    setLoadingId(assessment.assessmentId);

    try {
      // Store the selected assessment ID for use in other pages
      localStorage.setItem('assessmentId', String(assessment.assessmentId));

      await fetchAssessmentData(String(assessment.assessmentId));
      navigate('/studentAssessment');
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
    if (status === 'ongoing') return 'In Progress';
    return 'Not Started';
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        padding: '60px 20px',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div style={{ maxWidth: '1200px', width: '100%' }}>
        <header style={{ marginBottom: '50px', textAlign: 'center' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '800',
            color: '#111827',
            marginBottom: '10px',
            letterSpacing: '-0.025em'
          }}>
            My Assessments
          </h1>
          <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>
            Select an assessment below to begin or continue your progress
          </p>
        </header>

        {assessments.length === 0 ? (
          <div
            style={{
              backgroundColor: 'white',
              padding: '40px',
              borderRadius: '16px',
              textAlign: 'center',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              maxWidth: '500px',
              margin: '0 auto'
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>📭</div>
            <h3 style={{ color: '#374151', fontSize: '1.25rem', fontWeight: '600', marginBottom: '10px' }}>No Assessments Found</h3>
            <p style={{ color: '#9ca3af' }}>There are currently no assessments allotted to your account.</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '30px',
            }}
          >
            {assessments.map((assessment) => {
              const statusStyles = getStatusColor(assessment.studentStatus, assessment.isActive);
              const label = getStatusLabel(assessment.studentStatus, assessment.isActive);

              return (
                <div
                  key={assessment.assessmentId}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    position: 'relative',
                    border: '1px solid #f3f4f6'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                  }}
                >
                  <div style={{ padding: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                      <span
                        style={{
                          backgroundColor: statusStyles.bg,
                          color: statusStyles.text,
                          padding: '6px 12px',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          border: `1px solid ${statusStyles.border}30`
                        }}
                      >
                        {label}
                      </span>
                      <span style={{ color: '#9ca3af', fontSize: '0.875rem', fontWeight: '500' }}>#{assessment.assessmentId}</span>
                    </div>

                    <h3
                      style={{
                        fontSize: '1.5rem',
                        fontWeight: '700',
                        color: '#1f2937',
                        marginBottom: '10px',
                        lineHeight: '1.3',
                      }}
                    >
                      {assessment.assessmentName || `Assessment Module`}
                    </h3>

                    <p style={{ color: '#4b5563', fontSize: '0.95rem', marginBottom: '30px', lineHeight: '1.5' }}>
                      Complete this assessment to evaluate your skills and knowledge.
                    </p>

                    <button
                      onClick={() => handleStartAssessment(assessment)}
                      disabled={
                        assessment.studentStatus === 'completed' ||
                        !assessment.isActive ||
                        loadingId === assessment.assessmentId
                      }
                      style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '12px',
                        border: 'none',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: assessment.studentStatus === 'completed' || !assessment.isActive ? 'not-allowed' : 'pointer',
                        backgroundColor:
                          assessment.studentStatus === 'completed' ? '#10b981' :
                            !assessment.isActive ? '#e5e7eb' :
                              '#4f46e5',
                        color:
                          !assessment.isActive ? '#9ca3af' : 'white',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: assessment.studentStatus === 'completed' || !assessment.isActive ? 'none' : '0 4px 6px -1px rgba(79, 70, 229, 0.3)',
                      }}
                    >
                      {loadingId === assessment.assessmentId ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          {assessment.studentStatus === 'completed' && <span>View Results</span>}
                          {!assessment.isActive && <span>Unavailable</span>}
                          {assessment.isActive && assessment.studentStatus !== 'completed' && (
                            <>
                              <span>{assessment.studentStatus === 'ongoing' ? 'Continue' : 'Start Assessment'}</span>
                              <span>→</span>
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
  );
}