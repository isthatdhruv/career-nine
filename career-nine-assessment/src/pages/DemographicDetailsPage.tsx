import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import http from '../api/http';
import { useAssessment } from '../contexts/AssessmentContext';
import { usePreventReload } from '../hooks/usePreventReload';

type DemographicField = {
  mappingId: number;
  fieldId: number;
  fieldName: string;
  displayLabel: string;
  customLabel: string | null;
  fieldSource: string;
  dataType: string;
  validationRegex: string | null;
  validationMessage: string | null;
  minValue: number | null;
  maxValue: number | null;
  placeholder: string | null;
  defaultValue: string | null;
  isMandatory: boolean;
  displayOrder: number;
  currentValue: string | null;
  options: { optionId: number; optionValue: string; optionLabel: string }[];
};

const DemographicDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const { fetchAssessmentData } = useAssessment();
  usePreventReload();

  const [fields, setFields] = useState<DemographicField[]>([]);
  const [values, setValues] = useState<Record<number, string>>({});
  const [multiValues, setMultiValues] = useState<Record<number, string[]>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [touched, setTouched] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userStudentId = localStorage.getItem('userStudentId');

  useEffect(() => {
    if (!userStudentId || !assessmentId) {
      navigate('/student-login');
      return;
    }
    fetchFields();
  }, [assessmentId, userStudentId]);

  const fetchFields = async () => {
    try {
      const response = await http.get(
        `/student-demographics/fields/${assessmentId}/${userStudentId}`
      );
      const fieldData: DemographicField[] = response.data;
      setFields(fieldData);

      // Pre-fill values
      const initialValues: Record<number, string> = {};
      const initialMulti: Record<number, string[]> = {};
      for (const field of fieldData) {
        if (field.dataType === 'SELECT_MULTI') {
          initialMulti[field.fieldId] = field.currentValue
            ? field.currentValue.split(',')
            : [];
        } else {
          initialValues[field.fieldId] = field.currentValue || field.defaultValue || '';
        }
      }
      setValues(initialValues);
      setMultiValues(initialMulti);
    } catch (error) {
      console.error('Error fetching demographic fields:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getLabel = (field: DemographicField) => field.customLabel || field.displayLabel;

  const validateField = (field: DemographicField, value: string): string => {
    if (field.isMandatory && (!value || !value.trim())) {
      return `${getLabel(field)} is required`;
    }

    if (value && value.trim()) {
      if (field.dataType === 'TEXT' && field.validationRegex) {
        try {
          const regex = new RegExp(field.validationRegex);
          if (!regex.test(value)) {
            return field.validationMessage || `Invalid value for ${getLabel(field)}`;
          }
        } catch {
          // Invalid regex pattern, skip validation
        }
      }

      if (field.dataType === 'TEXT' && field.minValue && value.length < field.minValue) {
        return `${getLabel(field)} must be at least ${field.minValue} characters`;
      }
      if (field.dataType === 'TEXT' && field.maxValue && value.length > field.maxValue) {
        return `${getLabel(field)} must be at most ${field.maxValue} characters`;
      }

      if (field.dataType === 'NUMBER') {
        const num = Number(value);
        if (isNaN(num)) return 'Must be a number';
        if (field.minValue !== null && num < field.minValue) return `Minimum value is ${field.minValue}`;
        if (field.maxValue !== null && num > field.maxValue) return `Maximum value is ${field.maxValue}`;
      }
    }

    return '';
  };

  const handleChange = (fieldId: number, value: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    if (touched[fieldId]) {
      const field = fields.find((f) => f.fieldId === fieldId);
      if (field) {
        const error = validateField(field, value);
        setErrors((prev) => ({ ...prev, [fieldId]: error }));
      }
    }
  };

  const handleMultiChange = (fieldId: number, optionValue: string, checked: boolean) => {
    setMultiValues((prev) => {
      const current = prev[fieldId] || [];
      const updated = checked
        ? [...current, optionValue]
        : current.filter((v) => v !== optionValue);
      return { ...prev, [fieldId]: updated };
    });
  };

  const handleBlur = (fieldId: number) => {
    setTouched((prev) => ({ ...prev, [fieldId]: true }));
    const field = fields.find((f) => f.fieldId === fieldId);
    if (field) {
      const value =
        field.dataType === 'SELECT_MULTI'
          ? (multiValues[fieldId] || []).join(',')
          : values[fieldId] || '';
      const error = validateField(field, value);
      setErrors((prev) => ({ ...prev, [fieldId]: error }));
    }
  };

  const startAssessmentAndNavigate = async () => {
    await http.post('/assessments/startAssessment', {
      userStudentId: Number(userStudentId),
      assessmentId: Number(assessmentId),
    });
    await fetchAssessmentData(String(assessmentId));
    navigate('/general-instructions');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all as touched
    const allTouched: Record<number, boolean> = {};
    fields.forEach((f) => (allTouched[f.fieldId] = true));
    setTouched(allTouched);

    // Validate all
    const newErrors: Record<number, string> = {};
    let hasError = false;
    for (const field of fields) {
      const value =
        field.dataType === 'SELECT_MULTI'
          ? (multiValues[field.fieldId] || []).join(',')
          : values[field.fieldId] || '';
      const error = validateField(field, value);
      if (error) {
        newErrors[field.fieldId] = error;
        hasError = true;
      }
    }
    setErrors(newErrors);

    if (hasError) {
      const firstError = document.querySelector('.field-error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const responses = fields.map((field) => ({
        fieldId: field.fieldId,
        value:
          field.dataType === 'SELECT_MULTI'
            ? (multiValues[field.fieldId] || []).join(',')
            : values[field.fieldId] || '',
      }));

      await http.post('/student-demographics/submit', {
        userStudentId: Number(userStudentId),
        assessmentId: Number(assessmentId),
        responses,
      });

      await startAssessmentAndNavigate();
    } catch (error: any) {
      console.error('Error submitting demographics:', error);
      const errorData = error.response?.data;
      if (errorData?.validationErrors) {
        alert('Validation errors:\n' + errorData.validationErrors.join('\n'));
      } else {
        alert(errorData?.error || 'Failed to submit demographics. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: DemographicField) => {
    const label = getLabel(field);
    const error = errors[field.fieldId];
    const isTouched = touched[field.fieldId];

    switch (field.dataType) {
      case 'TEXT':
        return (
          <div className="mb-3" key={field.fieldId}>
            <label className="form-label" style={{ fontWeight: 500, color: '#4a5568' }}>
              {label} {field.isMandatory && <span style={{ color: '#e53e3e' }}>*</span>}
            </label>
            <input
              type="text"
              className={`form-control ${error && isTouched ? 'is-invalid' : ''}`}
              placeholder={field.placeholder || ''}
              value={values[field.fieldId] || ''}
              onChange={(e) => handleChange(field.fieldId, e.target.value)}
              onBlur={() => handleBlur(field.fieldId)}
              style={{
                borderRadius: '10px',
                padding: '0.75rem',
                border: `2px solid ${error && isTouched ? '#e53e3e' : '#e2e8f0'}`,
                fontSize: '0.95rem',
                backgroundColor: '#ffffff',
                color: '#2d3748',
              }}
            />
            {error && isTouched && (
              <div className="field-error" style={{ color: '#e53e3e', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {error}
              </div>
            )}
          </div>
        );

      case 'NUMBER':
        return (
          <div className="mb-3" key={field.fieldId}>
            <label className="form-label" style={{ fontWeight: 500, color: '#4a5568' }}>
              {label} {field.isMandatory && <span style={{ color: '#e53e3e' }}>*</span>}
            </label>
            <input
              type="number"
              className={`form-control ${error && isTouched ? 'is-invalid' : ''}`}
              placeholder={field.placeholder || ''}
              value={values[field.fieldId] || ''}
              onChange={(e) => handleChange(field.fieldId, e.target.value)}
              onBlur={() => handleBlur(field.fieldId)}
              min={field.minValue ?? undefined}
              max={field.maxValue ?? undefined}
              style={{
                borderRadius: '10px',
                padding: '0.75rem',
                border: `2px solid ${error && isTouched ? '#e53e3e' : '#e2e8f0'}`,
                fontSize: '0.95rem',
                backgroundColor: '#ffffff',
                color: '#2d3748',
              }}
            />
            {error && isTouched && (
              <div className="field-error" style={{ color: '#e53e3e', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {error}
              </div>
            )}
          </div>
        );

      case 'DATE':
        return (
          <div className="mb-3" key={field.fieldId}>
            <label className="form-label" style={{ fontWeight: 500, color: '#4a5568' }}>
              {label} {field.isMandatory && <span style={{ color: '#e53e3e' }}>*</span>}
            </label>
            <input
              type="date"
              className={`form-control ${error && isTouched ? 'is-invalid' : ''}`}
              value={values[field.fieldId] || ''}
              onChange={(e) => handleChange(field.fieldId, e.target.value)}
              onBlur={() => handleBlur(field.fieldId)}
              style={{
                borderRadius: '10px',
                padding: '0.75rem',
                border: `2px solid ${error && isTouched ? '#e53e3e' : '#e2e8f0'}`,
                fontSize: '0.95rem',
                backgroundColor: '#ffffff',
                color: '#2d3748',
              }}
            />
            {error && isTouched && (
              <div className="field-error" style={{ color: '#e53e3e', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {error}
              </div>
            )}
          </div>
        );

      case 'SELECT_SINGLE':
        if (field.options.length <= 4) {
          return (
            <div className="mb-3" key={field.fieldId}>
              <label className="form-label" style={{ fontWeight: 500, color: '#4a5568' }}>
                {label} {field.isMandatory && <span style={{ color: '#e53e3e' }}>*</span>}
              </label>
              <div className="d-flex gap-3 flex-wrap">
                {field.options.map((option) => (
                  <label
                    key={option.optionId}
                    style={{
                      flex: field.options.length <= 2 ? 1 : undefined,
                      padding: '0.75rem 1rem',
                      border: `2px solid ${
                        error && isTouched
                          ? '#e53e3e'
                          : values[field.fieldId] === option.optionValue
                          ? '#667eea'
                          : '#e2e8f0'
                      }`,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background:
                        values[field.fieldId] === option.optionValue ? '#eef2ff' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="radio"
                      name={`field-${field.fieldId}`}
                      value={option.optionValue}
                      checked={values[field.fieldId] === option.optionValue}
                      onChange={(e) => handleChange(field.fieldId, e.target.value)}
                      onBlur={() => handleBlur(field.fieldId)}
                      style={{
                        width: '20px',
                        height: '20px',
                        marginRight: '0.75rem',
                        cursor: 'pointer',
                        accentColor: '#667eea',
                      }}
                    />
                    <span style={{ fontSize: '0.95rem', color: '#2d3748' }}>
                      {option.optionLabel}
                    </span>
                  </label>
                ))}
              </div>
              {error && isTouched && (
                <div className="field-error" style={{ color: '#e53e3e', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {error}
                </div>
              )}
            </div>
          );
        }
        return (
          <div className="mb-3" key={field.fieldId}>
            <label className="form-label" style={{ fontWeight: 500, color: '#4a5568' }}>
              {label} {field.isMandatory && <span style={{ color: '#e53e3e' }}>*</span>}
            </label>
            <select
              className={`form-select ${error && isTouched ? 'is-invalid' : ''}`}
              value={values[field.fieldId] || ''}
              onChange={(e) => handleChange(field.fieldId, e.target.value)}
              onBlur={() => handleBlur(field.fieldId)}
              style={{
                borderRadius: '10px',
                padding: '0.75rem',
                border: `2px solid ${error && isTouched ? '#e53e3e' : '#e2e8f0'}`,
                fontSize: '0.95rem',
                backgroundColor: '#ffffff',
                color: '#2d3748',
              }}
            >
              <option value="">Select an option</option>
              {field.options.map((option) => (
                <option key={option.optionId} value={option.optionValue}>
                  {option.optionLabel}
                </option>
              ))}
            </select>
            {error && isTouched && (
              <div className="field-error" style={{ color: '#e53e3e', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {error}
              </div>
            )}
          </div>
        );

      case 'SELECT_MULTI':
        return (
          <div className="mb-3" key={field.fieldId}>
            <label className="form-label" style={{ fontWeight: 500, color: '#4a5568' }}>
              {label} {field.isMandatory && <span style={{ color: '#e53e3e' }}>*</span>}
            </label>
            <div className="d-flex flex-wrap gap-2">
              {field.options.map((option) => {
                const isChecked = (multiValues[field.fieldId] || []).includes(option.optionValue);
                return (
                  <label
                    key={option.optionId}
                    style={{
                      padding: '0.5rem 1rem',
                      border: `2px solid ${isChecked ? '#667eea' : '#e2e8f0'}`,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      background: isChecked ? '#eef2ff' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) =>
                        handleMultiChange(field.fieldId, option.optionValue, e.target.checked)
                      }
                      onBlur={() => handleBlur(field.fieldId)}
                      style={{
                        width: '18px',
                        height: '18px',
                        marginRight: '0.5rem',
                        cursor: 'pointer',
                        accentColor: '#667eea',
                      }}
                    />
                    <span style={{ fontSize: '0.95rem', color: '#2d3748' }}>
                      {option.optionLabel}
                    </span>
                  </label>
                );
              })}
            </div>
            {error && isTouched && (
              <div className="field-error" style={{ color: '#e53e3e', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {error}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        colorScheme: "light",
      }}
    >
      {isLoading ? (
        <div className="text-center">
          <div className="spinner-border text-light" role="status" style={{ width: "3rem", height: "3rem" }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-white fw-semibold">Loading your information...</p>
        </div>
      ) : fields.length === 0 ? (
        <div
          className="card shadow-lg"
          style={{
            width: "100%",
            maxWidth: "650px",
            borderRadius: "20px",
            border: "none",
            background: "#ffffff",
          }}
        >
          <div className="card-body p-5 text-center">
            <p className="text-muted">No demographic fields configured for this assessment.</p>
            <button
              className="btn"
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  await startAssessmentAndNavigate();
                } catch (error) {
                  console.error('Error starting assessment:', error);
                  alert('Failed to start assessment. Please try again.');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                padding: "0.875rem 2rem",
                borderRadius: "10px",
                fontSize: "1.05rem",
                fontWeight: 600,
                border: "none",
                boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
              }}
            >
              {isSubmitting ? 'Loading...' : 'Continue to Assessment'}
            </button>
          </div>
        </div>
      ) : (
        <div
          className="card shadow-lg"
          style={{
            width: "100%",
            maxWidth: "650px",
            borderRadius: "20px",
            border: "none",
            background: "#ffffff",
            colorScheme: "light",
          }}
        >
          <div className="card-body p-5" style={{ background: "#ffffff", color: "#2d3748", borderRadius: "20px" }}>
            {/* Header */}
            <div className="text-center mb-4">
              <div
                style={{
                  width: "70px",
                  height: "70px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1rem",
                  boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
                }}
              >
                <svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h2
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "#2d3748",
                  marginBottom: "0.5rem",
                }}
              >
                Demographic Details
              </h2>
              <p style={{ color: "#718096", fontSize: "1rem" }}>
                Please provide your information to continue
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              {fields.map((field) => renderField(field))}

              {/* Submit Button */}
              <button
                type="submit"
                className="btn w-100 mt-3"
                disabled={isSubmitting}
                style={{
                  background: isSubmitting
                    ? "#a0aec0"
                    : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  padding: "0.875rem",
                  borderRadius: "10px",
                  fontSize: "1.05rem",
                  fontWeight: 600,
                  border: "none",
                  boxShadow: isSubmitting ? "none" : "0 4px 15px rgba(102, 126, 234, 0.4)",
                  transition: "all 0.3s ease",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.5)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.4)";
                  }
                }}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Saving...
                  </>
                ) : (
                  "Save and Continue to Assessment"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DemographicDetailsPage;
