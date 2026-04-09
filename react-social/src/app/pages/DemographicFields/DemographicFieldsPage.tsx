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
    <div style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px" }}>
      {/* Page Header */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3" style={{ marginBottom: "24px" }}>
        <div className="d-flex align-items-center gap-3">
          <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#d97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="bi bi-person-vcard-fill text-white" style={{ fontSize: "1.1rem" }}></i>
          </div>
          <div>
            <h4 style={{ margin: 0, color: "#111827", fontWeight: 700, fontSize: "1.3rem" }}>Demographic Fields</h4>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "0.82rem" }}>
              {loading ? "Loading..." : `${data.length} fields configured`}
            </p>
          </div>
        </div>
        <button
          className="btn d-flex align-items-center gap-2"
          onClick={() => navigate('/demographic-fields/create')}
          style={{ background: "#d97706", color: "#fff", border: "none", borderRadius: "6px", padding: "8px 16px", fontWeight: 600, fontSize: "0.85rem" }}
        >
          <i className="bi bi-plus-lg"></i>
          Create New Field
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "48px", textAlign: "center" }}>
          <div className="spinner-border" style={{ color: "#d97706" }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3" style={{ color: "#6b7280" }}>Loading demographic fields...</p>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "16px" }}>
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
