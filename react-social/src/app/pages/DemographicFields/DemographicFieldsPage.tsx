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
    <div className='card'>
      <div className='card-header border-0 pt-6'>
        <div className='card-title'>
          <h2>Demographic Fields</h2>
        </div>
        <div className='card-toolbar'>
          <button
            className='btn btn-primary'
            onClick={() => navigate('/demographic-fields/create')}
          >
            + Create New Field
          </button>
        </div>
      </div>
      <div className='card-body py-4'>
        {loading ? (
          <div className='text-center py-20'>
            <div className='spinner-border' role='status'>
              <span className='visually-hidden'>Loading...</span>
            </div>
          </div>
        ) : (
          <DemographicFieldTable
            data={data}
            setPageLoading={setPageLoading}
            refreshData={fetchData}
          />
        )}
        {pageLoading && (
          <div
            className='position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center'
            style={{ backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 9999 }}
          >
            <div className='spinner-border text-primary' role='status'>
              <span className='visually-hidden'>Loading...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DemographicFieldsPage;
