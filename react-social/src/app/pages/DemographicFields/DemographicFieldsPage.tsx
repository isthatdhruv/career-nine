import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllDemographicFields } from './API/DemographicField_APIs';
import DemographicFieldTable from './components/DemographicFieldTable';
import PageHeader from '../../components/PageHeader';

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
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-person-vcard" />}
        title="Demographic Fields"
        subtitle={
          loading ? (
            "Loading..."
          ) : (
            <>
              <strong>{data.length}</strong> fields configured
            </>
          )
        }
        actions={[
          {
            label: "Create New Field",
            iconClass: "bi-plus-lg",
            onClick: () => navigate('/demographic-fields/create'),
            variant: "primary",
          },
        ]}
      />

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
