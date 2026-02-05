import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { usePreventReload } from "./usePreventReload";

type DemographicData = {
  name: string;
  gender: string;
  grade: string;
  schoolBoard: string;
  siblings: string;
  livingWith: string;
};

type ValidationErrors = {
  name?: string;
  gender?: string;
  grade?: string;
  schoolBoard?: string;
  siblings?: string;
  livingWith?: string;
};

const DemographicDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  usePreventReload();
  const [formData, setFormData] = useState<DemographicData>({
    name: "",
    gender: "",
    grade: "",
    schoolBoard: "",
    siblings: "",
    livingWith: "",
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [originalData, setOriginalData] = useState<DemographicData | null>(null);

  // Fetch existing demographics on mount
  useEffect(() => {
    const fetchDemographics = async () => {
      const userStudentId = localStorage.getItem('userStudentId');
      if (!userStudentId) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/student-info/getDemographics/${userStudentId}`
        );

        const data = response.data;

        // Map backend data to form fields
        const mappedData: DemographicData = {
          name: data.name || "",
          gender: data.gender || "",
          grade: data.studentClass ? `${data.studentClass}${data.studentClass === 3 ? 'rd' : data.studentClass === 4 || data.studentClass === 5 ? 'th' : ''} Grade` : "",
          schoolBoard: data.schoolBoard || "",
          siblings: data.sibling !== null && data.sibling !== undefined 
            ? (data.sibling >= 3 ? "3 or more" : String(data.sibling))
            : "",
          livingWith: data.family || "",
        };

        setFormData(mappedData);
        setOriginalData(mappedData); // Store original for comparison
      } catch (error: any) {
        // If no data found (404), that's okay - user hasn't filled form yet
        if (error.response?.status !== 404) {
          console.error("Error fetching demographics:", error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchDemographics();
  }, []);


  const validateField = (field: keyof DemographicData, value: string): string => {
    switch (field) {
      case "name":
        if (!value.trim()) {
          return "Please enter your name";
        }
        if (value.trim().length < 2) {
          return "Name must be at least 2 characters long";
        }
        if (!/^[a-zA-Z\s]+$/.test(value)) {
          return "Name should only contain letters and spaces";
        }
        return "";

      case "gender":
        if (!value) {
          return "Please select your gender";
        }
        return "";

      case "grade":
        if (!value) {
          return "Please select your grade";
        }
        return "";

      case "schoolBoard":
        if (!value) {
          return "Please select your school board";
        }
        return "";

      case "siblings":
        if (!value) {
          return "Please select number of siblings";
        }
        return "";

      case "livingWith":
        if (!value) {
          return "Please select who you live with";
        }
        return "";

      default:
        return "";
    }
  };

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};
    let isValid = true;

    (Object.keys(formData) as Array<keyof DemographicData>).forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    const allTouched: Record<string, boolean> = {};
    Object.keys(formData).forEach(key => {
      allTouched[key] = true;
    });
    setTouched(allTouched);

    // Validate all fields
    if (!validateForm()) {
      // Scroll to first error
      const firstError = document.querySelector('.is-invalid');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Get userStudentId from localStorage
    const userStudentId = localStorage.getItem('userStudentId');
    if (!userStudentId) {
      alert("Session expired. Please login again.");
      navigate("/login");
      return;
    }

    setIsSubmitting(true);

    // Check if data has changed from original
    const hasChanges = !originalData || 
      formData.name !== originalData.name ||
      formData.gender !== originalData.gender ||
      formData.grade !== originalData.grade ||
      formData.schoolBoard !== originalData.schoolBoard ||
      formData.siblings !== originalData.siblings ||
      formData.livingWith !== originalData.livingWith;

    // If no changes, just navigate without API call
    if (!hasChanges) {
      navigate("/allotted-assessment");
      setIsSubmitting(false);
      return;
    }

    try {
      // Parse grade to get class number (e.g., "3rd Grade" -> 3)
      const classMatch = formData.grade.match(/(\d+)/);
      const studentClass = classMatch ? parseInt(classMatch[1]) : null;

      // Parse siblings (handle "3 or more")
      let sibling: number | null = null;
      if (formData.siblings === "3 or more") {
        sibling = 3;
      } else if (formData.siblings) {
        sibling = parseInt(formData.siblings);
      }

      const payload = {
        userStudentId: parseInt(userStudentId),
        name: formData.name.trim(),
        gender: formData.gender,
        studentClass: studentClass,
        schoolBoard: formData.schoolBoard,
        sibling: sibling,
        family: formData.livingWith,
      };

      console.log("Submitting demographics:", payload);

      await axios.post(
        `${process.env.REACT_APP_API_URL}/student-info/updateDemographics`,
        payload
      );

      // Redirect to allotted assessment
      navigate("/allotted-assessment");
    } catch (error: any) {
      console.error("Error saving demographics:", error);
      alert(error.response?.data?.error || "Failed to save demographics. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof DemographicData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Validate field on change if it was touched
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  const handleBlur = (field: keyof DemographicData) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field]);
    setErrors(prev => ({ ...prev, [field]: error }));
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
      }}
    >
      {isLoading ? (
        <div className="text-center">
          <div className="spinner-border text-light" role="status" style={{ width: "3rem", height: "3rem" }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-white fw-semibold">Loading your information...</p>
        </div>
      ) : (
      <div
        className="card shadow-lg"
        style={{
          width: "100%",
          maxWidth: "650px",
          borderRadius: "20px",
          border: "none",
        }}
      >
        <div className="card-body p-5">
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
            {/* Basic Information Section */}
            <div className="mb-4">
              <h5
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  color: "#4a5568",
                  marginBottom: "1rem",
                  paddingBottom: "0.5rem",
                  borderBottom: "2px solid #e2e8f0",
                }}
              >
                1. Basic Information
              </h5>

              {/* Name */}
              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 500, color: "#4a5568" }}>
                  What is your name? <span style={{ color: "#e53e3e" }}>*</span>
                </label>
                <input
                  type="text"
                  className={`form-control ${errors.name && touched.name ? 'is-invalid' : ''}`}
                  placeholder="Enter your name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  onBlur={() => handleBlur("name")}
                  style={{
                    borderRadius: "10px",
                    padding: "0.75rem",
                    border: `2px solid ${errors.name && touched.name ? "#e53e3e" : "#e2e8f0"}`,
                    fontSize: "0.95rem",
                  }}
                />
                {errors.name && touched.name && (
                  <div style={{ color: "#e53e3e", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                    {errors.name}
                  </div>
                )}
              </div>

              {/* Gender */}
              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 500, color: "#4a5568" }}>
                  Are you a boy or a girl? <span style={{ color: "#e53e3e" }}>*</span>
                </label>
                <div className="d-flex gap-3">
                  {["Boy", "Girl"].map((option) => (
                    <label
                      key={option}
                      style={{
                        flex: 1,
                        padding: "0.75rem 1rem",
                        border: `2px solid ${errors.gender && touched.gender
                          ? "#e53e3e"
                          : formData.gender === option
                            ? "#667eea"
                            : "#e2e8f0"
                          }`,
                        borderRadius: "10px",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        background: formData.gender === option ? "#eef2ff" : "white",
                        display: "flex",
                        alignItems: "center",
                        position: "relative",
                      }}
                      onMouseEnter={(e) => {
                        if (formData.gender !== option && !(errors.gender && touched.gender)) {
                          e.currentTarget.style.borderColor = "#cbd5e0";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (formData.gender !== option && !(errors.gender && touched.gender)) {
                          e.currentTarget.style.borderColor = "#e2e8f0";
                        }
                      }}
                    >
                      <input
                        type="radio"
                        name="gender"
                        value={option}
                        checked={formData.gender === option}
                        onChange={(e) => handleChange("gender", e.target.value)}
                        onBlur={() => handleBlur("gender")}
                        style={{
                          width: "20px",
                          height: "20px",
                          marginRight: "0.75rem",
                          cursor: "pointer",
                          accentColor: "#667eea",
                        }}
                      />
                      <span style={{ fontSize: "0.95rem", color: "#2d3748" }}>
                        {option}
                      </span>
                    </label>
                  ))}
                </div>
                {errors.gender && touched.gender && (
                  <div style={{ color: "#e53e3e", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                    {errors.gender}
                  </div>
                )}
              </div>
            </div>

            {/* School Life Section */}
            <div className="mb-4">
              <h5
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  color: "#4a5568",
                  marginBottom: "1rem",
                  paddingBottom: "0.5rem",
                  borderBottom: "2px solid #e2e8f0",
                }}
              >
                2. School Life
              </h5>

              {/* Grade */}
              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 500, color: "#4a5568" }}>
                  What grade are you in? <span style={{ color: "#e53e3e" }}>*</span>
                </label>
                <select
                  className={`form-select ${errors.grade && touched.grade ? 'is-invalid' : ''}`}
                  value={formData.grade}
                  onChange={(e) => handleChange("grade", e.target.value)}
                  onBlur={() => handleBlur("grade")}
                  style={{
                    borderRadius: "10px",
                    padding: "0.75rem",
                    border: `2px solid ${errors.grade && touched.grade ? "#e53e3e" : "#e2e8f0"}`,
                    fontSize: "0.95rem",
                  }}
                >
                  <option value="">Select grade</option>
                  <option value="3rd Grade">3rd Grade</option>
                  <option value="4th Grade">4th Grade</option>
                  <option value="5th Grade">5th Grade</option>
                </select>
                {errors.grade && touched.grade && (
                  <div style={{ color: "#e53e3e", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                    {errors.grade}
                  </div>
                )}
              </div>

              {/* School Board */}
              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 500, color: "#4a5568" }}>
                  Which school board do you study in? <span style={{ color: "#e53e3e" }}>*</span>
                </label>
                <select
                  className={`form-select ${errors.schoolBoard && touched.schoolBoard ? 'is-invalid' : ''}`}
                  value={formData.schoolBoard}
                  onChange={(e) => handleChange("schoolBoard", e.target.value)}
                  onBlur={() => handleBlur("schoolBoard")}
                  style={{
                    borderRadius: "10px",
                    padding: "0.75rem",
                    border: `2px solid ${errors.schoolBoard && touched.schoolBoard ? "#e53e3e" : "#e2e8f0"}`,
                    fontSize: "0.95rem",
                  }}
                >
                  <option value="">Select school board</option>
                  <option value="CBSE">CBSE</option>
                  <option value="ICSE">ICSE</option>
                  <option value="State Board">State Board</option>
                  <option value="IB / IGCSE">IB / IGCSE</option>
                  <option value="I don't know">I don't know</option>
                </select>
                {errors.schoolBoard && touched.schoolBoard && (
                  <div style={{ color: "#e53e3e", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                    {errors.schoolBoard}
                  </div>
                )}
              </div>
            </div>

            {/* Family Background Section */}
            <div className="mb-4">
              <h5
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  color: "#4a5568",
                  marginBottom: "1rem",
                  paddingBottom: "0.5rem",
                  borderBottom: "2px solid #e2e8f0",
                }}
              >
                3. Family Background
              </h5>

              {/* Siblings */}
              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 500, color: "#4a5568" }}>
                  How many brothers and sisters do you have? <span style={{ color: "#e53e3e" }}>*</span>
                </label>
                <select
                  className={`form-select ${errors.siblings && touched.siblings ? 'is-invalid' : ''}`}
                  value={formData.siblings}
                  onChange={(e) => handleChange("siblings", e.target.value)}
                  onBlur={() => handleBlur("siblings")}
                  style={{
                    borderRadius: "10px",
                    padding: "0.75rem",
                    border: `2px solid ${errors.siblings && touched.siblings ? "#e53e3e" : "#e2e8f0"}`,
                    fontSize: "0.95rem",
                  }}
                >
                  <option value="">Select option</option>
                  <option value="0">0 (I am an only child)</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3 or more">3 or more</option>
                </select>
                {errors.siblings && touched.siblings && (
                  <div style={{ color: "#e53e3e", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                    {errors.siblings}
                  </div>
                )}
              </div>

              {/* Living With */}
              <div className="mb-4">
                <label className="form-label" style={{ fontWeight: 500, color: "#4a5568" }}>
                  Who do you live with? <span style={{ color: "#e53e3e" }}>*</span>
                </label>
                <select
                  className={`form-select ${errors.livingWith && touched.livingWith ? 'is-invalid' : ''}`}
                  value={formData.livingWith}
                  onChange={(e) => handleChange("livingWith", e.target.value)}
                  onBlur={() => handleBlur("livingWith")}
                  style={{
                    borderRadius: "10px",
                    padding: "0.75rem",
                    border: `2px solid ${errors.livingWith && touched.livingWith ? "#e53e3e" : "#e2e8f0"}`,
                    fontSize: "0.95rem",
                  }}
                >
                  <option value="">Select option</option>
                  <option value="Small Family">Just my parents and siblings (Small Family)</option>
                  <option value="Big/Joint Family">My parents, siblings, grandparents, uncles, or aunts (Big/Joint Family)</option>
                  <option value="Other">Other</option>
                </select>
                {errors.livingWith && touched.livingWith && (
                  <div style={{ color: "#e53e3e", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                    {errors.livingWith}
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn w-100"
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