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
  const { fetchAssessmentData, preloadAssessmentData } = useAssessment();
  usePreventReload();

  const [fields, setFields] = useState<DemographicField[]>([]);
  const [values, setValues] = useState<Record<number, string>>({});
  const [multiValues, setMultiValues] = useState<Record<number, string[]>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [touched, setTouched] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactErrors, setContactErrors] = useState<{ email?: string; phone?: string }>({});
  const [contactTouched, setContactTouched] = useState<{ email?: boolean; phone?: boolean }>({});

  const userStudentId = localStorage.getItem('userStudentId');

  useEffect(() => {
    if (!userStudentId || !assessmentId) {
      navigate('/student-login');
      return;
    }
    fetchContactInfo();
    fetchFields();
    preloadAssessmentData(assessmentId);
  }, [assessmentId, userStudentId]);

  const fetchContactInfo = async () => {
    try {
      const res = await http.get(`/student-demographics/contact-info/${userStudentId}`);
      setContactEmail(res.data.email || '');
      setContactPhone(res.data.phoneNumber || '');
    } catch (error) {
      console.error('Error fetching contact info:', error);
    }
  };

  const validateContactEmail = (value: string): string => {
    if (!value.trim()) return 'Email is required';
    if (!/^[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(value)) return 'Invalid email format';
    return '';
  };

  const validateContactPhone = (value: string): string => {
    if (!value.trim()) return 'Phone number is required';
    if (!/^[0-9]{10}$/.test(value)) return 'Phone number must be 10 digits';
    return '';
  };

  const fetchFields = async () => {
    try {
      const response = await http.get(
        `/student-demographics/fields/${assessmentId}/${userStudentId}`
      );
      const fieldData: DemographicField[] = response.data;
      setFields(fieldData);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate contact fields
    const emailErr = validateContactEmail(contactEmail);
    const phoneErr = validateContactPhone(contactPhone);
    setContactTouched({ email: true, phone: true });
    setContactErrors({ email: emailErr || undefined, phone: phoneErr || undefined });

    const allTouched: Record<number, boolean> = {};
    fields.forEach((f) => (allTouched[f.fieldId] = true));
    setTouched(allTouched);

    const newErrors: Record<number, string> = {};
    let hasError = !!emailErr || !!phoneErr;
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
      // Save contact info first (lightweight)
      await http.post(`/student-demographics/contact-info/${userStudentId}`, {
        email: contactEmail.trim(),
        phoneNumber: contactPhone.trim(),
      });

      // Save dynamic demographics if any
      if (fields.length > 0) {
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
      }

      await Promise.all([
        http.post('/assessments/startAssessment', {
          userStudentId: Number(userStudentId),
          assessmentId: Number(assessmentId),
        }),
        fetchAssessmentData(String(assessmentId)),
      ]);

      navigate('/general-instructions');
    } catch (error: any) {
      console.error('Error submitting demographics:', error);
      const errorData = error.response?.data;
      if (errorData?.validationErrors) {
        alert('Validation errors:\n' + errorData.validationErrors.join('\n'));
      } else {
        alert(errorData?.error || 'Failed to save demographics. Please try again.');
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
              <div className="field-error" style={{ color: '#e53e3e', fontSize: '0.85rem', marginTop: '0.25rem' }}>{error}</div>
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
              <div className="field-error" style={{ color: '#e53e3e', fontSize: '0.85rem', marginTop: '0.25rem' }}>{error}</div>
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
              <div className="field-error" style={{ color: '#e53e3e', fontSize: '0.85rem', marginTop: '0.25rem' }}>{error}</div>
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
              <div className="d-flex gap-2 gap-md-3 flex-wrap">
                {field.options.map((option) => (
                  <label
                    key={option.optionId}
                    style={{
                      flex: field.options.length <= 2 ? 1 : undefined,
                      padding: '0.6rem 0.85rem',
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
                      style={{ width: '18px', height: '18px', marginRight: '0.5rem', cursor: 'pointer', accentColor: '#667eea' }}
                    />
                    <span style={{ fontSize: '0.9rem', color: '#2d3748' }}>{option.optionLabel}</span>
                  </label>
                ))}
              </div>
              {error && isTouched && (
                <div className="field-error" style={{ color: '#e53e3e', fontSize: '0.85rem', marginTop: '0.25rem' }}>{error}</div>
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
                <option key={option.optionId} value={option.optionValue}>{option.optionLabel}</option>
              ))}
            </select>
            {error && isTouched && (
              <div className="field-error" style={{ color: '#e53e3e', fontSize: '0.85rem', marginTop: '0.25rem' }}>{error}</div>
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
                      padding: '0.4rem 0.85rem',
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
                      onChange={(e) => handleMultiChange(field.fieldId, option.optionValue, e.target.checked)}
                      onBlur={() => handleBlur(field.fieldId)}
                      style={{ width: '16px', height: '16px', marginRight: '0.5rem', cursor: 'pointer', accentColor: '#667eea' }}
                    />
                    <span style={{ fontSize: '0.9rem', color: '#2d3748' }}>{option.optionLabel}</span>
                  </label>
                );
              })}
            </div>
            {error && isTouched && (
              <div className="field-error" style={{ color: '#e53e3e', fontSize: '0.85rem', marginTop: '0.25rem' }}>{error}</div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const inputStyle = (hasError: boolean) => ({
    borderRadius: '10px',
    padding: '0.75rem',
    border: `2px solid ${hasError ? '#e53e3e' : '#e2e8f0'}`,
    fontSize: '0.95rem',
    backgroundColor: '#ffffff',
    color: '#2d3748',
    transition: 'border-color 0.2s ease',
  });

  return (
    <div className="assessment-bg">
      {isLoading ? (
        <div className="text-center">
          <div className="spinner-border text-light" role="status" style={{ width: "3rem", height: "3rem" }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-white fw-semibold">Loading your information...</p>
        </div>
      ) : (
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-12 col-md-8 col-lg-6 col-xl-5">
              <div className="assessment-card card shadow-lg">
                <div className="card-body p-3 p-sm-4 p-md-5">
                  {/* Header */}
                  <div className="text-center mb-4">
                    <div className="assessment-icon-circle assessment-icon-circle--sm mx-auto mb-3">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <h2 className="assessment-heading" style={{ fontSize: '1.5rem' }}>Your Details</h2>
                    <p className="assessment-subheading" style={{ marginBottom: 0 }}>Please verify your contact information to continue</p>
                  </div>

                  <form onSubmit={handleSubmit} noValidate>
                    {/* Contact Info Section */}
                    <div className="mb-3">
                      <label className="form-label" style={{ fontWeight: 500, color: '#4a5568' }}>
                        Email Address <span style={{ color: '#e53e3e' }}>*</span>
                      </label>
                      <input
                        type="email"
                        className={`form-control ${contactErrors.email && contactTouched.email ? 'is-invalid' : ''}`}
                        placeholder="you@example.com"
                        value={contactEmail}
                        onChange={(e) => {
                          setContactEmail(e.target.value);
                          if (contactTouched.email) {
                            setContactErrors((prev) => ({ ...prev, email: validateContactEmail(e.target.value) || undefined }));
                          }
                        }}
                        onBlur={() => {
                          setContactTouched((prev) => ({ ...prev, email: true }));
                          setContactErrors((prev) => ({ ...prev, email: validateContactEmail(contactEmail) || undefined }));
                        }}
                        style={inputStyle(!!(contactErrors.email && contactTouched.email))}
                      />
                      {contactErrors.email && contactTouched.email && (
                        <div className="field-error" style={{ color: '#e53e3e', fontSize: '0.85rem', marginTop: '0.25rem' }}>{contactErrors.email}</div>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="form-label" style={{ fontWeight: 500, color: '#4a5568' }}>
                        Phone Number <span style={{ color: '#e53e3e' }}>*</span>
                      </label>
                      <input
                        type="tel"
                        className={`form-control ${contactErrors.phone && contactTouched.phone ? 'is-invalid' : ''}`}
                        placeholder="10-digit phone number"
                        value={contactPhone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setContactPhone(val);
                          if (contactTouched.phone) {
                            setContactErrors((prev) => ({ ...prev, phone: validateContactPhone(val) || undefined }));
                          }
                        }}
                        onBlur={() => {
                          setContactTouched((prev) => ({ ...prev, phone: true }));
                          setContactErrors((prev) => ({ ...prev, phone: validateContactPhone(contactPhone) || undefined }));
                        }}
                        style={inputStyle(!!(contactErrors.phone && contactTouched.phone))}
                      />
                      {contactErrors.phone && contactTouched.phone && (
                        <div className="field-error" style={{ color: '#e53e3e', fontSize: '0.85rem', marginTop: '0.25rem' }}>{contactErrors.phone}</div>
                      )}
                    </div>

                    {/* Divider + dynamic fields */}
                    {fields.length > 0 && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0' }}>
                          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                          <span style={{ fontSize: '0.8rem', color: '#a0aec0', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Additional Details</span>
                          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                        </div>
                        {fields.map((field) => renderField(field))}
                      </>
                    )}

                    <button
                      type="submit"
                      className="btn btn-assessment-primary w-100 mt-4 py-2 py-md-3"
                      disabled={isSubmitting}
                      style={{ fontSize: '1rem', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DemographicDetailsPage;
