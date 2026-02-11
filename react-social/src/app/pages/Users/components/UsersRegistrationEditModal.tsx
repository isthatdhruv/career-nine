import { FC, useEffect, useState } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

interface UserRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  organisation: string;
  designation: string;
  isActive: boolean | null;
  provider: string;
  dob?: string;
}

interface UsersRegistrationEditModalProps {
  show: boolean;
  onClose: () => void;
  user: UserRow | null;
  onSave?: () => void;
}

const UsersRegistrationEditModal: FC<UsersRegistrationEditModalProps> = ({
  show,
  onClose,
  user,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    organisation: '',
    designation: '',
    dob: '',
    isActive: false,
  });
  const [errors, setErrors] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset form data whenever user prop changes
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.name?.split(' ')[0] || '',
        lastName: user.name?.split(' ').slice(1).join(' ') || '',
        email: user.email || '',
        phone: user.phone || '',
        organisation: user.organisation || '',
        designation: user.designation || '',
        dob: user.dob || '',
        isActive: user.isActive === true,
      });
      setErrors({});
      setSaveError(null);
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev: any) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: any = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }
    if (!formData.organisation.trim()) {
      newErrors.organisation = 'Organisation is required';
    }
    if (!formData.designation.trim()) {
      newErrors.designation = 'Designation is required';
    }
    if (!formData.dob) {
      newErrors.dob = 'Date of birth is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (!validateForm() || !user) return;

    setSaving(true);
    try {
      await axios.put(`${API_URL}/user/update-details/${user.id}`, {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        phone: formData.phone,
        organisation: formData.organisation,
        designation: formData.designation,
        dob: formData.dob,
        isActive: formData.isActive,
      });

      if (onSave) {
        onSave();
      }
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to update user";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      role="dialog"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
        <div className="modal-content">
          {/* Modal Header */}
          <div className="modal-header border-0 pb-0">
            <div>
              <h3 className="modal-title fw-bold text-gray-900 mb-1">
                Edit User Details
              </h3>
              <p className="text-muted fs-7 mb-0">
                Update user information for <span className="fw-semibold text-gray-800">{user?.name}</span>
              </p>
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>

          {/* Modal Body */}
          <div className="modal-body pt-4">
            {saveError && (
              <div className="alert alert-danger d-flex align-items-center mb-4" role="alert">
                <i className="bi bi-exclamation-triangle-fill fs-4 me-2"></i>
                <div>{saveError}</div>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="row g-4">
                {/* First Name */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-gray-700 required">
                    First Name
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0">
                      <i className="bi bi-person text-gray-600"></i>
                    </span>
                    <input
                      type="text"
                      name="firstName"
                      className={`form-control form-control-lg border-start-0 ps-0 ${
                        errors.firstName ? 'is-invalid' : ''
                      }`}
                      placeholder="Enter first name"
                      value={formData.firstName}
                      onChange={handleInputChange}
                    />
                  </div>
                  {errors.firstName && (
                    <div className="text-danger fs-7 mt-1">{errors.firstName}</div>
                  )}
                </div>

                {/* Last Name */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-gray-700 required">
                    Last Name
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0">
                      <i className="bi bi-person text-gray-600"></i>
                    </span>
                    <input
                      type="text"
                      name="lastName"
                      className={`form-control form-control-lg border-start-0 ps-0 ${
                        errors.lastName ? 'is-invalid' : ''
                      }`}
                      placeholder="Enter last name"
                      value={formData.lastName}
                      onChange={handleInputChange}
                    />
                  </div>
                  {errors.lastName && (
                    <div className="text-danger fs-7 mt-1">{errors.lastName}</div>
                  )}
                </div>

                {/* Email */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-gray-700 required">
                    Email Address
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0">
                      <i className="bi bi-envelope text-gray-600"></i>
                    </span>
                    <input
                      type="email"
                      name="email"
                      className={`form-control form-control-lg border-start-0 ps-0 ${
                        errors.email ? 'is-invalid' : ''
                      }`}
                      placeholder="user@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                    />
                  </div>
                  {errors.email && (
                    <div className="text-danger fs-7 mt-1">{errors.email}</div>
                  )}
                </div>

                {/* Phone Number */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-gray-700 required">
                    Phone Number
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0">
                      <i className="bi bi-telephone text-gray-600"></i>
                    </span>
                    <input
                      type="tel"
                      name="phone"
                      className={`form-control form-control-lg border-start-0 ps-0 ${
                        errors.phone ? 'is-invalid' : ''
                      }`}
                      placeholder="+1 234 567 8900"
                      value={formData.phone}
                      onChange={handleInputChange}
                    />
                  </div>
                  {errors.phone && (
                    <div className="text-danger fs-7 mt-1">{errors.phone}</div>
                  )}
                </div>

                {/* Organisation */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-gray-700 required">
                    Organisation
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0">
                      <i className="bi bi-building text-gray-600"></i>
                    </span>
                    <input
                      type="text"
                      name="organisation"
                      className={`form-control form-control-lg border-start-0 ps-0 ${
                        errors.organisation ? 'is-invalid' : ''
                      }`}
                      placeholder="Company name"
                      value={formData.organisation}
                      onChange={handleInputChange}
                    />
                  </div>
                  {errors.organisation && (
                    <div className="text-danger fs-7 mt-1">{errors.organisation}</div>
                  )}
                </div>

                {/* Designation */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-gray-700 required">
                    Designation
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0">
                      <i className="bi bi-briefcase text-gray-600"></i>
                    </span>
                    <input
                      type="text"
                      name="designation"
                      className={`form-control form-control-lg border-start-0 ps-0 ${
                        errors.designation ? 'is-invalid' : ''
                      }`}
                      placeholder="Job title"
                      value={formData.designation}
                      onChange={handleInputChange}
                    />
                  </div>
                  {errors.designation && (
                    <div className="text-danger fs-7 mt-1">{errors.designation}</div>
                  )}
                </div>

                {/* Date of Birth */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-gray-700 required">
                    Date of Birth
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0">
                      <i className="bi bi-calendar-event text-gray-600"></i>
                    </span>
                    <input
                      type="date"
                      name="dob"
                      className={`form-control form-control-lg border-start-0 ps-0 ${
                        errors.dob ? 'is-invalid' : ''
                      }`}
                      value={formData.dob}
                      onChange={handleInputChange}
                    />
                  </div>
                  {errors.dob && (
                    <div className="text-danger fs-7 mt-1">{errors.dob}</div>
                  )}
                </div>

                {/* Status Toggle */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-gray-700">
                    Account Status
                  </label>
                  <div className="d-flex align-items-center h-100 pt-2">
                    <div className="form-check form-switch form-check-custom form-check-solid">
                      <input
                        className="form-check-input h-30px w-50px"
                        type="checkbox"
                        name="isActive"
                        id="statusToggle"
                        checked={formData.isActive}
                        onChange={handleInputChange}
                      />
                      <label
                        className="form-check-label fw-semibold text-gray-700 ms-3"
                        htmlFor="statusToggle"
                      >
                        {formData.isActive ? 'Active' : 'Inactive'}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Info Section */}
              <div className="mt-6 p-4 bg-light rounded">
                <div className="d-flex align-items-center mb-3">
                  <i className="bi bi-info-circle text-primary fs-4 me-2"></i>
                  <h6 className="mb-0 fw-bold text-gray-800">
                    Additional Information
                  </h6>
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <small className="text-muted d-block mb-1">User ID</small>
                    <span className="badge badge-light-primary fs-7">
                      {user?.id}
                    </span>
                  </div>
                  <div className="col-md-6">
                    <small className="text-muted d-block mb-1">Provider</small>
                    <span className="badge badge-light-info fs-7">
                      {user?.provider || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer border-0 pt-4">
            <button
              type="button"
              className="btn btn-light btn-lg fw-bold"
              onClick={onClose}
              disabled={saving}
            >
              <i className="bi bi-x-lg me-2"></i>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg fw-bold"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <span className="spinner-border spinner-border-sm me-2" role="status" />
              ) : (
                <i className="bi bi-check-lg me-2"></i>
              )}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsersRegistrationEditModal;
