import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteDemographicField } from '../API/DemographicField_APIs';

type FieldDefinition = {
  fieldId: number;
  fieldName: string;
  displayLabel: string;
  fieldSource: string;
  systemFieldKey: string | null;
  dataType: string;
  isActive: boolean;
  options: any[];
};

type Props = {
  data: FieldDefinition[];
  setPageLoading: (loading: boolean) => void;
  refreshData: () => void;
};

const DemographicFieldTable = ({ data, setPageLoading, refreshData }: Props) => {
  const navigate = useNavigate();
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    try {
      setPageLoading(true);
      await deleteDemographicField(id);
      refreshData();
    } catch (error) {
      console.error('Error deleting field:', error);
      alert('Failed to delete field');
    } finally {
      setPageLoading(false);
      setDeleteConfirm(null);
    }
  };

  const getDataTypeBadge = (dataType: string) => {
    const colors: Record<string, string> = {
      TEXT: '#3b82f6',
      SELECT_SINGLE: '#8b5cf6',
      SELECT_MULTI: '#a855f7',
      NUMBER: '#f59e0b',
      DATE: '#10b981',
    };
    return (
      <span
        style={{
          backgroundColor: `${colors[dataType] || '#6b7280'}20`,
          color: colors[dataType] || '#6b7280',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '0.8rem',
          fontWeight: 600,
        }}
      >
        {dataType}
      </span>
    );
  };

  const getSourceBadge = (source: string) => {
    const isSystem = source === 'SYSTEM';
    return (
      <span
        style={{
          backgroundColor: isSystem ? '#dbeafe' : '#dcfce7',
          color: isSystem ? '#2563eb' : '#16a34a',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '0.8rem',
          fontWeight: 600,
        }}
      >
        {source}
      </span>
    );
  };

  return (
    <div className='table-responsive'>
      <table className='table table-row-bordered table-row-gray-100 align-middle gs-0 gy-3'>
        <thead>
          <tr className='fw-bold text-muted'>
            <th>ID</th>
            <th>Field Name</th>
            <th>Display Label</th>
            <th>Source</th>
            <th>Data Type</th>
            <th>Options</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((field) => (
            <tr key={field.fieldId}>
              <td>{field.fieldId}</td>
              <td>
                <span className='text-dark fw-bold'>{field.fieldName}</span>
                {field.systemFieldKey && (
                  <div className='text-muted fs-7'>maps to: {field.systemFieldKey}</div>
                )}
              </td>
              <td>{field.displayLabel}</td>
              <td>{getSourceBadge(field.fieldSource)}</td>
              <td>{getDataTypeBadge(field.dataType)}</td>
              <td>{field.options ? field.options.length : 0}</td>
              <td>
                <span
                  className={`badge ${field.isActive ? 'badge-light-success' : 'badge-light-danger'}`}
                >
                  {field.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>
                <button
                  className='btn btn-sm btn-light-primary me-2'
                  onClick={() => navigate(`/demographic-fields/edit/${field.fieldId}`)}
                >
                  Edit
                </button>
                {deleteConfirm === field.fieldId ? (
                  <>
                    <button
                      className='btn btn-sm btn-danger me-1'
                      onClick={() => handleDelete(field.fieldId)}
                    >
                      Confirm
                    </button>
                    <button
                      className='btn btn-sm btn-secondary'
                      onClick={() => setDeleteConfirm(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className='btn btn-sm btn-light-danger'
                    onClick={() => setDeleteConfirm(field.fieldId)}
                  >
                    Deactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={8} className='text-center text-muted py-10'>
                No demographic fields found. Create one to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DemographicFieldTable;
