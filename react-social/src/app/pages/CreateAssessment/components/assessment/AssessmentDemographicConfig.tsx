import { useState, useEffect } from 'react';
import { getActiveDemographicFields } from '../../../DemographicFields/API/DemographicField_APIs';
import {
  getDemographicsByAssessment,
  saveDemographicMapping,
} from '../../API/Assessment_Demographics_APIs';

type FieldDefinition = {
  fieldId: number;
  fieldName: string;
  displayLabel: string;
  fieldSource: string;
  dataType: string;
};

type MappedField = {
  fieldId: number;
  fieldName: string;
  displayLabel: string;
  fieldSource: string;
  dataType: string;
  isMandatory: boolean;
  displayOrder: number;
  customLabel: string;
};

type Props = {
  assessmentId: number;
};

const AssessmentDemographicConfig = ({ assessmentId }: Props) => {
  const [availableFields, setAvailableFields] = useState<FieldDefinition[]>([]);
  const [mappedFields, setMappedFields] = useState<MappedField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    fetchData();
  }, [assessmentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [fieldsRes, mappingsRes] = await Promise.all([
        getActiveDemographicFields(),
        getDemographicsByAssessment(assessmentId),
      ]);

      setAvailableFields(fieldsRes.data);

      // Convert existing mappings to MappedField format
      const existing: MappedField[] = mappingsRes.data.map((m: any) => ({
        fieldId: m.fieldDefinition.fieldId,
        fieldName: m.fieldDefinition.fieldName,
        displayLabel: m.fieldDefinition.displayLabel,
        fieldSource: m.fieldDefinition.fieldSource,
        dataType: m.fieldDefinition.dataType,
        isMandatory: m.isMandatory ?? true,
        displayOrder: m.displayOrder ?? 0,
        customLabel: m.customLabel || '',
      }));

      setMappedFields(existing);
    } catch (error) {
      console.error('Error loading demographic config:', error);
    } finally {
      setLoading(false);
    }
  };

  const isFieldMapped = (fieldId: number) => {
    return mappedFields.some((f) => f.fieldId === fieldId);
  };

  const toggleField = (field: FieldDefinition) => {
    if (isFieldMapped(field.fieldId)) {
      setMappedFields(mappedFields.filter((f) => f.fieldId !== field.fieldId));
    } else {
      setMappedFields([
        ...mappedFields,
        {
          fieldId: field.fieldId,
          fieldName: field.fieldName,
          displayLabel: field.displayLabel,
          fieldSource: field.fieldSource,
          dataType: field.dataType,
          isMandatory: true,
          displayOrder: mappedFields.length,
          customLabel: '',
        },
      ]);
    }
  };

  const updateMappedField = (index: number, key: keyof MappedField, value: any) => {
    const updated = [...mappedFields];
    (updated[index] as any)[key] = value;
    setMappedFields(updated);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === mappedFields.length - 1)
    )
      return;

    const updated = [...mappedFields];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[swapIndex]] = [updated[swapIndex], updated[index]];
    // Update display orders
    updated.forEach((f, i) => (f.displayOrder = i));
    setMappedFields(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        assessmentId,
        fields: mappedFields.map((f, index) => ({
          fieldId: f.fieldId,
          isMandatory: f.isMandatory,
          displayOrder: index,
          customLabel: f.customLabel || null,
        })),
      };

      await saveDemographicMapping(payload);
      alert('Demographic configuration saved successfully!');
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save demographic configuration');
    } finally {
      setSaving(false);
    }
  };

  const getSourceBadge = (source: string) => {
    const isSystem = source === 'SYSTEM';
    return (
      <span
        style={{
          backgroundColor: isSystem ? '#dbeafe' : '#dcfce7',
          color: isSystem ? '#2563eb' : '#16a34a',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: 600,
        }}
      >
        {source}
      </span>
    );
  };

  return (
    <div className='card mt-5'>
      <div
        className='card-header cursor-pointer'
        onClick={() => setCollapsed(!collapsed)}
        style={{ cursor: 'pointer' }}
      >
        <h3 className='card-title'>
          Demographic Fields Configuration
          {mappedFields.length > 0 && (
            <span className='badge badge-primary ms-2'>{mappedFields.length} fields</span>
          )}
        </h3>
        <div className='card-toolbar'>
          <span className='text-muted'>{collapsed ? 'Click to expand' : 'Click to collapse'}</span>
        </div>
      </div>

      {!collapsed && (
        <div className='card-body'>
          {loading ? (
            <div className='text-center py-10'>
              <div className='spinner-border spinner-border-sm' role='status'></div>
              <span className='ms-2'>Loading...</span>
            </div>
          ) : (
            <>
              <div className='row'>
                {/* Available Fields */}
                <div className='col-md-5'>
                  <h5 className='mb-3'>Available Fields</h5>
                  <div
                    className='border rounded p-3'
                    style={{ maxHeight: '400px', overflowY: 'auto' }}
                  >
                    {availableFields.length === 0 ? (
                      <p className='text-muted text-center'>
                        No fields available. Create fields first.
                      </p>
                    ) : (
                      availableFields.map((field) => (
                        <div
                          key={field.fieldId}
                          className='d-flex align-items-center justify-content-between p-2 mb-1 rounded'
                          style={{
                            backgroundColor: isFieldMapped(field.fieldId) ? '#e8f5e9' : '#f8f9fa',
                            cursor: 'pointer',
                          }}
                          onClick={() => toggleField(field)}
                        >
                          <div>
                            <input
                              type='checkbox'
                              checked={isFieldMapped(field.fieldId)}
                              onChange={() => {}}
                              className='form-check-input me-2'
                            />
                            <span className='fw-bold'>{field.displayLabel}</span>
                            <div className='ms-4'>
                              {getSourceBadge(field.fieldSource)}
                              <span className='text-muted ms-2' style={{ fontSize: '0.8rem' }}>
                                {field.dataType}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Mapped Fields */}
                <div className='col-md-7'>
                  <h5 className='mb-3'>
                    Selected Fields (in form order)
                  </h5>
                  <div
                    className='border rounded p-3'
                    style={{ maxHeight: '400px', overflowY: 'auto' }}
                  >
                    {mappedFields.length === 0 ? (
                      <p className='text-muted text-center'>
                        No fields selected. Click fields on the left to add them.
                      </p>
                    ) : (
                      mappedFields.map((field, index) => (
                        <div
                          key={field.fieldId}
                          className='border rounded p-3 mb-2'
                          style={{ backgroundColor: '#fafafa' }}
                        >
                          <div className='d-flex justify-content-between align-items-start'>
                            <div>
                              <strong>{field.displayLabel}</strong>
                              <div className='mt-1'>
                                {getSourceBadge(field.fieldSource)}
                                <span className='text-muted ms-2' style={{ fontSize: '0.8rem' }}>
                                  {field.dataType}
                                </span>
                              </div>
                            </div>
                            <div className='d-flex gap-1'>
                              <button
                                className='btn btn-sm btn-light'
                                onClick={() => moveField(index, 'up')}
                                disabled={index === 0}
                                title='Move up'
                              >
                                &#9650;
                              </button>
                              <button
                                className='btn btn-sm btn-light'
                                onClick={() => moveField(index, 'down')}
                                disabled={index === mappedFields.length - 1}
                                title='Move down'
                              >
                                &#9660;
                              </button>
                              <button
                                className='btn btn-sm btn-light-danger'
                                onClick={() => toggleField(field)}
                                title='Remove'
                              >
                                &#10005;
                              </button>
                            </div>
                          </div>
                          <div className='row mt-2'>
                            <div className='col-md-6'>
                              <div className='form-check'>
                                <input
                                  type='checkbox'
                                  className='form-check-input'
                                  checked={field.isMandatory}
                                  onChange={(e) =>
                                    updateMappedField(index, 'isMandatory', e.target.checked)
                                  }
                                  id={`mandatory-${field.fieldId}`}
                                />
                                <label
                                  className='form-check-label'
                                  htmlFor={`mandatory-${field.fieldId}`}
                                >
                                  Mandatory
                                </label>
                              </div>
                            </div>
                            <div className='col-md-6'>
                              <input
                                type='text'
                                className='form-control form-control-sm'
                                value={field.customLabel}
                                onChange={(e) =>
                                  updateMappedField(index, 'customLabel', e.target.value)
                                }
                                placeholder='Custom label override (optional)'
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className='mt-4'>
                <button className='btn btn-success' onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <span className='spinner-border spinner-border-sm me-2'></span>
                      Saving...
                    </>
                  ) : (
                    'Save Demographic Configuration'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AssessmentDemographicConfig;
