import { useNavigate } from "react-router-dom";
import { useAssessment } from "./AssessmentContext";
import axios from "axios";
export default function AllottedAssessmentPage() {
  const assessmentId = localStorage.getItem('assessmentId');
  const userStudentId = localStorage.getItem('UserStudentId');
  const navigate = useNavigate();
  const { fetchAssessmentData, loading } = useAssessment();

  const loadAssessmentisActive = async (assessmentId: string) => {
    const assessmentData = await axios.get(`${process.env.REACT_APP_API_URL}/assessments/${assessmentId}`);
    const isActive = assessmentData.data.isActive;
    return isActive;
  };
  const handleStartAssessment = async () => {


    if (assessmentId) {
      const isActive = await loadAssessmentisActive(assessmentId);
      if (isActive) {
        await fetchAssessmentData(assessmentId);
        navigate('/studentAssessment');
      } else {
        alert("This assessment is not active.");
      }
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