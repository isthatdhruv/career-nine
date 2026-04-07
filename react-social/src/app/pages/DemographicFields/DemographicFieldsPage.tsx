import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllDemographicFields } from './API/DemographicField_APIs';
import DemographicFieldTable from './components/DemographicFieldTable';

const DemographicFieldsPage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await getAllDemographicFields();
      setData(response.data);
    } catch (error) {
      console.error('Error fetching demographic fields:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div
      className="min-vh-100"
      style={{
        background: "linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)",
        padding: "1rem 1.25rem",
      }}
    >
      {/* Header Card */}
      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: "12px" }}>
        <div className="card-body p-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-3">
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <i className="bi bi-person-vcard-fill text-white" style={{ fontSize: "1.2rem" }}></i>
              </div>
              <div>
                <h5 className="mb-0 fw-bold" style={{ color: "#1a1a2e" }}>Demographic Fields</h5>
                <p className="text-muted mb-0" style={{ fontSize: "0.82rem" }}>
                  {loading ? "Loading..." : `${data.length} fields configured`}
                </p>
              </div>
            </div>
            <button
              className="btn btn-sm d-flex align-items-center gap-1"
              onClick={() => navigate('/demographic-fields/create')}
              style={{
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "6px 14px",
                fontWeight: 600,
                fontSize: "0.82rem",
              }}
            >
              <i className="bi bi-plus-lg"></i>
              Create New Field
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: "12px" }}>
          <div className="card-body text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted">Loading demographic fields...</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: "12px", overflow: "hidden" }}>
          <div className="card-body p-3">
            <DemographicFieldTable
              data={data}
              setPageLoading={setPageLoading}
              refreshData={fetchData}
            />
          </div>
        </div>
      )}

      {/* Page loading overlay */}
      {pageLoading && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ backgroundColor: "rgba(0,0,0,0.3)", zIndex: 9999 }}
        >
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DemographicFieldsPage;
