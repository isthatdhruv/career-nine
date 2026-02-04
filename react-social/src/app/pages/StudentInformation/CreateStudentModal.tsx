
import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { getAssessmentIdNameMap, addStudentInfo, StudentInfo } from "./StudentInfo_APIs";

interface CreateStudentModalProps {
  show: boolean;
  onHide: () => void;
  onSave?: (data: any) => void;
}

const CreateStudentModal: React.FC<CreateStudentModalProps> = ({ show, onHide, onSave }) => {
  const [formData, setFormData] = useState({
    name: "",
    schoolRollNumber: "",
    phoneNumber: "",
    dob: "",
    selectedAssessmentId: "",
  });

  const [assessmentOptions, setAssessmentOptions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (show) {
      setLoading(true);
      getAssessmentIdNameMap()
        .then((response) => {
          // Response data is { id: "Name", id2: "Name2" }
          const options = Object.entries(response.data).map(([id, name]) => ({
            id,
            name,
          }));
          setAssessmentOptions(options);
        })
        .catch((err) => console.error("Failed to load assessments", err))
        .finally(() => setLoading(false));
    }
  }, [show]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Helper to format date YYYY-MM-DD -> DD-MM-YYYY
  const formatDateForBackend = (dateString: string): string => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("-");
    return `${day}-${month}-${year}`;
  };

  const handleSubmit = async () => {
    // Basic validation
    if (!formData.name || !formData.dob || !formData.selectedAssessmentId) {
      alert("Please fill in all required fields (Name, DOB, Assessment)");
      return;
    }

    setSubmitting(true);
    try {
        const instituteId = localStorage.getItem('instituteId');
        
        const payload: StudentInfo = {
            name: formData.name,
            schoolRollNumber: formData.schoolRollNumber || "",
            phoneNumber: formData.phoneNumber ? Number(formData.phoneNumber) : undefined, // Check if this should be string or number based on interface
            email: "",
            address: "",
            studentDob: formatDateForBackend(formData.dob),
            instituteId: instituteId ? Number(instituteId) : undefined,
            assesment_id: formData.selectedAssessmentId
        };
        
        console.log("Submitting Payload:", payload);

        await addStudentInfo(payload);
        
        alert("Student added successfully!");
        
        if (onSave) {
            onSave(payload);
        } else {
             // force refresh or just close
             window.location.reload(); 
        }
        onHide();
    } catch (error) {
      console.error("Error creating student:", error);
      alert("Failed to create student");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Add New Student</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Loading assessments...</p>
          </div>
        ) : (
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Student Name <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter full name"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Roll Number</Form.Label>
              <Form.Control
                type="text"
                name="schoolRollNumber"
                value={formData.schoolRollNumber}
                onChange={handleChange}
                placeholder="Enter roll number"
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Phone Number</Form.Label>
              <Form.Control
                type="text"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="Enter phone number (optional)"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Date of Birth <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
              />
              <Form.Text className="text-muted">
                Format: DD-MM-YYYY (Handled by date picker)
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Assign Assessment <span className="text-danger">*</span></Form.Label>
              <Form.Select
                name="selectedAssessmentId"
                value={formData.selectedAssessmentId}
                onChange={handleChange}
              >
                <option value="">-- Select Assessment --</option>
                {assessmentOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Form>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={submitting}>
          Cancel
        </Button>
        <Button 
            variant="primary" 
            onClick={handleSubmit} 
            disabled={submitting || loading}
            style={{
                background: 'linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)',
                border: 'none'
            }}
        >
          {submitting ? 'Saving...' : 'Add Student'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CreateStudentModal;
