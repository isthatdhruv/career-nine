

export default function AllottedAssessmentPage() {
  const assessmentId= localStorage.getItem('Assessment id');

  return (
    <div className="d-flex justify-content-center align-items-center vh-100" style={{
      position: 'absolute',
      
    }}>
      <div className="card shadow-sm" style={{ width: '500px', maxWidth: '90%' }}>
        <div className="card-body p-5">
          <h2 className="text-center mb-4" style={{ fontSize: '2rem', fontWeight: '600' }}>Allotted Assessment</h2>
          {assessmentId ? (
            <div className="text-center">
              <p style={{ fontSize: '1.2rem', fontWeight: '500' }}>Your Assigned Assessment ID:</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#007bff' }}>{assessmentId}</h3>
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