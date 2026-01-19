import { useNavigate } from "react-router-dom";
import { useAssessment } from "./AssessmentContext";

export default function AllottedAssessmentPage() {
  const assessmentId = localStorage.getItem('assessmentId');
  const userStudentId = localStorage.getItem('UserStudentId');
  const navigate = useNavigate();
  const { fetchAssessmentData, loading } = useAssessment();

  const handleStartAssessment = async () => {
    if (assessmentId) {
      await fetchAssessmentData(assessmentId);
      navigate('/studentAssessment');
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100">
      <div className="card shadow-sm" style={{ width: '500px', maxWidth: '90%' }}>
        <div className="card-body p-5">
          <h2 className="text-center mb-4" style={{ fontSize: '2rem', fontWeight: '600' }}>
            Allotted Assessment
          </h2>
          {assessmentId ? (
            <div className="text-center">
              <p style={{ fontSize: '1.2rem', fontWeight: '500' }}>
                Your Assigned Assessment ID:
              </p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#007bff' }}>
                {assessmentId}
              </h3>
              
              <button 
                className="btn btn-primary mt-4 px-5 py-2"
                onClick={handleStartAssessment}
                disabled={loading}
                style={{ fontSize: '1.1rem', fontWeight: '500' }}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Loading...
                  </>
                ) : (
                  'Start Assessment'
                )}
              </button>
            </div>
          ) : (
            <div className="alert alert-danger" role="alert">
              No assessment has been allotted to you.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}