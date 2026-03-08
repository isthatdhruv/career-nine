import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getMappingInfoByToken,
  registerStudentByToken,
} from "../AssessmentMapping/API/AssessmentMapping_APIs";

const AssessmentRegisterPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [mappingInfo, setMappingInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");

  useEffect(() => {
    if (token) {
      getMappingInfoByToken(token)
        .then((res) => {
          setMappingInfo(res.data);
          setLoading(false);
        })
        .catch(() => {
          setError("Invalid or expired assessment link.");
          setLoading(false);
        });
    }
  }, [token]);

  // Auto-format DOB as dd-mm-yyyy
  const handleDobChange = (value: string) => {
    // Remove non-numeric and non-dash characters
    let cleaned = value.replace(/[^0-9-]/g, "");
    // Auto-insert dashes
    const digits = cleaned.replace(/-/g, "");
    if (digits.length <= 2) {
      cleaned = digits;
    } else if (digits.length <= 4) {
      cleaned = digits.slice(0, 2) + "-" + digits.slice(2);
    } else {
      cleaned =
        digits.slice(0, 2) + "-" + digits.slice(2, 4) + "-" + digits.slice(4, 8);
    }
    setDob(cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !dob.trim()) {
      alert("Please fill in all required fields (Name, Email, Date of Birth).");
      return;
    }

    // Validate DOB format
    const dobRegex = /^\d{2}-\d{2}-\d{4}$/;
    if (!dobRegex.test(dob)) {
      alert("Date of Birth must be in dd-mm-yyyy format.");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const data: any = {
        name: name.trim(),
        email: email.trim(),
        dob: dob,
        phone: phone.trim(),
        gender: gender,
      };

      if (selectedClassId) {
        data.classId = Number(selectedClassId);
      }
      if (selectedSectionId) {
        data.schoolSectionId = Number(selectedSectionId);
      }

      const res = await registerStudentByToken(token!, data);
      setResult(res.data);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data ||
        "Registration failed. Please try again.";
      alert(typeof msg === "string" ? msg : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // Available classes/sections from mapping info (for SESSION/CLASS level)
  const availableClasses: any[] = mappingInfo?.availableClasses || [];
  const availableSections: any[] = mappingInfo?.availableSections || [];

  // For SESSION level, when user picks a class, show its sections
  const selectedClassSections: any[] = selectedClassId
    ? (
        availableClasses.find(
          (c: any) => String(c.id) === selectedClassId
        )?.schoolSections || []
      )
    : [];

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" />
            <p className="mt-3 text-muted">Loading assessment information...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div className="text-center py-5">
            <div style={{ fontSize: "4rem", color: "#dc3545" }}>!</div>
            <h4 className="text-danger">{error}</h4>
            <p className="text-muted mt-3">
              This link may have expired or been deactivated. Please contact your
              school administrator for a valid link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success/Already registered view
  if (result) {
    const isAlreadyRegistered = result.status === "already_registered";
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div className="text-center py-4">
            <div
              style={{
                fontSize: "3rem",
                color: isAlreadyRegistered ? "#ffc107" : "#28a745",
              }}
            >
              {isAlreadyRegistered ? "!" : "\u2713"}
            </div>
            <h4 className={isAlreadyRegistered ? "text-warning" : "text-success"}>
              {result.message}
            </h4>

            {result.username && (
              <div
                className="mt-4 p-3 bg-light rounded"
                style={{ display: "inline-block", textAlign: "left" }}
              >
                <h6 className="mb-3">Your Login Credentials:</h6>
                <p className="mb-1">
                  <strong>Username:</strong>{" "}
                  <span className="badge bg-primary fs-6">{result.username}</span>
                </p>
                <p className="mb-0">
                  <strong>Date of Birth:</strong>{" "}
                  <span className="badge bg-primary fs-6">{result.dob}</span>
                </p>
              </div>
            )}

            <p className="text-muted mt-4" style={{ fontSize: "0.9em" }}>
              Please save these credentials. You will need them to log in and take the assessment.
            </p>

            <button
              className="btn btn-primary mt-3"
              onClick={() => navigate("/student-login")}
            >
              Go to Student Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Registration form
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            padding: "24px",
            borderRadius: "12px 12px 0 0",
            color: "white",
          }}
        >
          <h4 className="mb-1">
            {mappingInfo?.assessmentName || "Assessment Registration"}
          </h4>
          <p className="mb-0" style={{ opacity: 0.9, fontSize: "0.9em" }}>
            {mappingInfo?.instituteName || ""}
            {mappingInfo?.className && ` - Class ${mappingInfo.className}`}
            {mappingInfo?.sectionName && ` (${mappingInfo.sectionName})`}
            {mappingInfo?.sessionYear && ` | ${mappingInfo.sessionYear}`}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
          <div className="row g-3">
            {/* Name */}
            <div className="col-12">
              <label className="form-label fw-bold">
                Full Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Email */}
            <div className="col-md-6">
              <label className="form-label fw-bold">
                Email <span className="text-danger">*</span>
              </label>
              <input
                type="email"
                className="form-control"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* DOB */}
            <div className="col-md-6">
              <label className="form-label fw-bold">
                Date of Birth <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="dd-mm-yyyy"
                value={dob}
                onChange={(e) => handleDobChange(e.target.value)}
                maxLength={10}
                required
              />
            </div>

            {/* Phone */}
            <div className="col-md-6">
              <label className="form-label fw-bold">Phone Number</label>
              <input
                type="tel"
                className="form-control"
                placeholder="Enter phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {/* Gender */}
            <div className="col-md-6">
              <label className="form-label fw-bold">Gender</label>
              <select
                className="form-select"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Class dropdown for SESSION level */}
            {mappingInfo?.mappingLevel === "SESSION" &&
              availableClasses.length > 0 && (
                <div className="col-md-6">
                  <label className="form-label fw-bold">
                    Class <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={selectedClassId}
                    onChange={(e) => {
                      setSelectedClassId(e.target.value);
                      setSelectedSectionId("");
                    }}
                    required
                  >
                    <option value="">Select Class</option>
                    {availableClasses.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.className}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            {/* Section dropdown for SESSION level (after class selection) */}
            {mappingInfo?.mappingLevel === "SESSION" &&
              selectedClassSections.length > 0 && (
                <div className="col-md-6">
                  <label className="form-label fw-bold">Section</label>
                  <select
                    className="form-select"
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                  >
                    <option value="">Select Section (Optional)</option>
                    {selectedClassSections.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.sectionName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            {/* Section dropdown for CLASS level */}
            {mappingInfo?.mappingLevel === "CLASS" &&
              availableSections.length > 0 && (
                <div className="col-md-6">
                  <label className="form-label fw-bold">Section</label>
                  <select
                    className="form-select"
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                  >
                    <option value="">Select Section (Optional)</option>
                    {availableSections.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.sectionName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            {/* Pre-filled info for SECTION level */}
            {mappingInfo?.mappingLevel === "SECTION" && (
              <div className="col-12">
                <div className="alert alert-info mb-0" style={{ fontSize: "0.9em" }}>
                  Class: <strong>{mappingInfo.className}</strong> | Section:{" "}
                  <strong>{mappingInfo.sectionName}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="mt-4">
            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={submitting}
              style={{ padding: "10px" }}
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Registering...
                </>
              ) : (
                "Register"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
    padding: "20px",
  },
  card: {
    width: "100%",
    maxWidth: "600px",
    background: "white",
    borderRadius: "12px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
    overflow: "hidden",
  },
};

export default AssessmentRegisterPage;
