import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createDemographicField } from '../API/DemographicField_APIs';

const SYSTEM_FIELD_OPTIONS = [
  { key: 'name', label: 'Student Name', dataType: 'TEXT' },
  { key: 'gender', label: 'Gender', dataType: 'SELECT_SINGLE' },
  { key: 'studentClass', label: 'Student Class/Grade', dataType: 'SELECT_SINGLE' },
  { key: 'schoolBoard', label: 'School Board', dataType: 'SELECT_SINGLE' },
  { key: 'sibling', label: 'Number of Siblings', dataType: 'SELECT_SINGLE' },
  { key: 'family', label: 'Family Type', dataType: 'SELECT_SINGLE' },
  { key: 'phoneNumber', label: 'Phone Number', dataType: 'TEXT' },
  { key: 'email', label: 'Email', dataType: 'TEXT' },
  { key: 'address', label: 'Address', dataType: 'TEXT' },
  { key: 'schoolRollNumber', label: 'School Roll Number', dataType: 'TEXT' },
];

const DATA_TYPES = ['TEXT', 'SELECT_SINGLE', 'SELECT_MULTI', 'NUMBER', 'DATE'];

type FieldOption = {
  optionValue: string;
  optionLabel: string;
  displayOrder: number;
};

const DemographicFieldCreatePage = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const [fieldName, setFieldName] = useState('');
  const [displayLabel, setDisplayLabel] = useState('');
  const [fieldSource, setFieldSource] = useState('CUSTOM');
  const [systemFieldKey, setSystemFieldKey] = useState('');
  const [dataType, setDataType] = useState('TEXT');
  const [validationRegex, setValidationRegex] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [minValue, setMinValue] = useState<number | ''>('');
  const [maxValue, setMaxValue] = useState<number | ''>('');
  const [placeholder, setPlaceholder] = useState('');
  const [defaultValue, setDefaultValue] = useState('');
  const [options, setOptions] = useState<FieldOption[]>([]);

  const handleSystemFieldSelect = (key: string) => {
    setSystemFieldKey(key);
    const systemField = SYSTEM_FIELD_OPTIONS.find((f) => f.key === key);
    if (systemField) {
      setDisplayLabel(systemField.label);
      setFieldName(key);
      setDataType(systemField.dataType);
    }
  };

  const addOption = () => {
    setOptions([
      ...options,
      { optionValue: '', optionLabel: '', displayOrder: options.length },
    ]);
  };

  const updateOption = (index: number, field: keyof FieldOption, value: string | number) => {
    const updated = [...options];
    (updated[index] as any)[field] = value;
    setOptions(updated);
  };

  const removeOption = (index: number) => {
    const updated = options.filter((_, i) => i !== index);
    // Re-index display order
    updated.forEach((opt, i) => (opt.displayOrder = i));
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fieldName.trim() || !displayLabel.trim()) {
      alert('Field name and display label are required');
      return;
    }

    if (fieldSource === 'SYSTEM' && !systemFieldKey) {
      alert('Please select a system field');
      return;
    }

    if ((dataType === 'SELECT_SINGLE' || dataType === 'SELECT_MULTI') && options.length === 0) {
      alert('Select fields must have at least one option');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        fieldName: fieldName.trim(),
        displayLabel: displayLabel.trim(),
        fieldSource,
        systemFieldKey: fieldSource === 'SYSTEM' ? systemFieldKey : null,
        dataType,
        validationRegex: validationRegex || null,
        validationMessage: validationMessage || null,
        minValue: minValue !== '' ? minValue : null,
        maxValue: maxValue !== '' ? maxValue : null,
        placeholder: placeholder || null,
        defaultValue: defaultValue || null,
        isActive: true,
        options:
          dataType === 'SELECT_SINGLE' || dataType === 'SELECT_MULTI'
            ? options.filter((o) => o.optionValue.trim() && o.optionLabel.trim())
            : [],
      };

      await createDemographicField(payload);
      navigate('/demographic-fields');
    } catch (error: any) {
      console.error('Error creating field:', error);
      alert(error.response?.data?.message || 'Failed to create field');
    } finally {
      setSaving(false);
    }
  };

  const isSelectType = dataType === 'SELECT_SINGLE' || dataType === 'SELECT_MULTI';

  return (
    <div className='card'>
      <div className='card-header'>
        <h3 className='card-title'>Create Demographic Field</h3>
      </div>
      <div className='card-body'>
        <form onSubmit={handleSubmit}>
          {/* Source Selection */}
          <div className='row mb-5'>
            <div className='col-md-6'>
              <label className='form-label fw-bold'>Field Source</label>
              <select
                className='form-select'
                value={fieldSource}
                onChange={(e) => {
                  setFieldSource(e.target.value);
                  if (e.target.value === 'CUSTOM') {
                    setSystemFieldKey('');
                  }
                }}
              >
                <option value='CUSTOM'>Custom Field</option>
                <option value='SYSTEM'>System Field (from StudentInfo)</option>
              </select>
              <div className='form-text'>
                System fields map to existing student data. Custom fields are new fields stored
                separately.
              </div>
            </div>

            {fieldSource === 'SYSTEM' && (
              <div className='col-md-6'>
                <label className='form-label fw-bold'>System Field</label>
                <select
                  className='form-select'
                  value={systemFieldKey}
                  onChange={(e) => handleSystemFieldSelect(e.target.value)}
                >
                  <option value=''>Select a system field...</option>
                  {SYSTEM_FIELD_OPTIONS.map((sf) => (
                    <option key={sf.key} value={sf.key}>
                      {sf.label} ({sf.key})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Basic Info */}
          <div className='row mb-5'>
            <div className='col-md-6'>
              <label className='form-label fw-bold'>
                Field Name (slug) <span className='text-danger'>*</span>
              </label>
              <input
                type='text'
                className='form-control'
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value.replace(/\s+/g, '_').toLowerCase())}
                placeholder='e.g., favorite_subject'
                disabled={fieldSource === 'SYSTEM'}
              />
              <div className='form-text'>Unique internal identifier. Use snake_case.</div>
            </div>
            <div className='col-md-6'>
              <label className='form-label fw-bold'>
                Display Label <span className='text-danger'>*</span>
              </label>
              <input
                type='text'
                className='form-control'
                value={displayLabel}
                onChange={(e) => setDisplayLabel(e.target.value)}
                placeholder='e.g., What is your favorite subject?'
              />
              <div className='form-text'>Label shown to students in the form.</div>
            </div>
          </div>

          {/* Data Type */}
          <div className='row mb-5'>
            <div className='col-md-6'>
              <label className='form-label fw-bold'>Data Type</label>
              <select
                className='form-select'
                value={dataType}
                onChange={(e) => setDataType(e.target.value)}
                disabled={fieldSource === 'SYSTEM'}
              >
                {DATA_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {dt.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className='col-md-6'>
              <label className='form-label fw-bold'>Placeholder</label>
              <input
                type='text'
                className='form-control'
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                placeholder='Placeholder text for the input'
              />
            </div>
          </div>

          {/* Validation (for TEXT type) */}
          {dataType === 'TEXT' && (
            <div className='row mb-5'>
              <div className='col-md-4'>
                <label className='form-label fw-bold'>Validation Regex</label>
                <input
                  type='text'
                  className='form-control'
                  value={validationRegex}
                  onChange={(e) => setValidationRegex(e.target.value)}
                  placeholder='e.g., ^[a-zA-Z\s]+$'
                />
              </div>
              <div className='col-md-4'>
                <label className='form-label fw-bold'>Validation Error Message</label>
                <input
                  type='text'
                  className='form-control'
                  value={validationMessage}
                  onChange={(e) => setValidationMessage(e.target.value)}
                  placeholder='Error message when validation fails'
                />
              </div>
              <div className='col-md-2'>
                <label className='form-label fw-bold'>Min Length</label>
                <input
                  type='number'
                  className='form-control'
                  value={minValue}
                  onChange={(e) => setMinValue(e.target.value ? parseInt(e.target.value) : '')}
                />
              </div>
              <div className='col-md-2'>
                <label className='form-label fw-bold'>Max Length</label>
                <input
                  type='number'
                  className='form-control'
                  value={maxValue}
                  onChange={(e) => setMaxValue(e.target.value ? parseInt(e.target.value) : '')}
                />
              </div>
            </div>
          )}

          {/* Number constraints */}
          {dataType === 'NUMBER' && (
            <div className='row mb-5'>
              <div className='col-md-3'>
                <label className='form-label fw-bold'>Min Value</label>
                <input
                  type='number'
                  className='form-control'
                  value={minValue}
                  onChange={(e) => setMinValue(e.target.value ? parseInt(e.target.value) : '')}
                />
              </div>
              <div className='col-md-3'>
                <label className='form-label fw-bold'>Max Value</label>
                <input
                  type='number'
                  className='form-control'
                  value={maxValue}
                  onChange={(e) => setMaxValue(e.target.value ? parseInt(e.target.value) : '')}
                />
              </div>
            </div>
          )}

          {/* Default Value */}
          <div className='row mb-5'>
            <div className='col-md-6'>
              <label className='form-label fw-bold'>Default Value (optional)</label>
              <input
                type='text'
                className='form-control'
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                placeholder='Pre-filled default value'
              />
            </div>
          </div>

          {/* Options (for SELECT types) */}
          {isSelectType && (
            <div className='mb-5'>
              <div className='d-flex justify-content-between align-items-center mb-3'>
                <label className='form-label fw-bold mb-0'>
                  Options <span className='text-danger'>*</span>
                </label>
                <button type='button' className='btn btn-sm btn-primary' onClick={addOption}>
                  + Add Option
                </button>
              </div>

              {options.length === 0 && (
                <div className='text-muted text-center py-5 border rounded'>
                  No options added yet. Click "Add Option" to start.
                </div>
              )}

              {options.map((option, index) => (
                <div key={index} className='row mb-2 align-items-center'>
                  <div className='col-md-1'>
                    <span className='badge badge-light'>{index + 1}</span>
                  </div>
                  <div className='col-md-4'>
                    <input
                      type='text'
                      className='form-control form-control-sm'
                      value={option.optionValue}
                      onChange={(e) => updateOption(index, 'optionValue', e.target.value)}
                      placeholder='Value (stored)'
                    />
                  </div>
                  <div className='col-md-5'>
                    <input
                      type='text'
                      className='form-control form-control-sm'
                      value={option.optionLabel}
                      onChange={(e) => updateOption(index, 'optionLabel', e.target.value)}
                      placeholder='Label (displayed)'
                    />
                  </div>
                  <div className='col-md-2'>
                    <button
                      type='button'
                      className='btn btn-sm btn-light-danger'
                      onClick={() => removeOption(index)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className='d-flex gap-3'>
            <button type='submit' className='btn btn-primary' disabled={saving}>
              {saving ? (
                <>
                  <span className='spinner-border spinner-border-sm me-2'></span>
                  Saving...
                </>
              ) : (
                'Create Field'
              )}
            </button>
            <button
              type='button'
              className='btn btn-secondary'
              onClick={() => navigate('/demographic-fields')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DemographicFieldCreatePage;
