
import React, { useState, useEffect, useMemo } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { getAssessmentIdNameMap, addStudentInfo, StudentInfo } from "./StudentInfo_APIs";
import { GetSessionsByInstituteCode } from "../College/API/College_APIs";

interface CreateStudentModalProps {
  show: boolean;
  onHide: () => void;
  onSave?: (data: any) => void;
}

const CreateStudentModal: React.FC<CreateStudentModalProps> = ({ show, onHide, onSave }) => {
  const [formData, setFormData] = useState({
    name: "",
    schoolRollNumber: "",
    controlNumber: "",
    phoneNumber: "",
    dob: "",
    selectedAssessmentId: "",
  });

  const [assessmentOptions, setAssessmentOptions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Session/Class/Section cascading state
  const [hierarchyData, setHierarchyData] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");

  useEffect(() => {
    if (show) {
      setLoading(true);
      const instituteId = localStorage.getItem('instituteId');

      const promises: Promise<any>[] = [
        getAssessmentIdNameMap(),
      ];

      if (instituteId) {
        promises.push(GetSessionsByInstituteCode(instituteId));
      }

      Promise.all(promises)
        .then(([assessmentRes, sessionRes]) => {
          const options = Object.entries(assessmentRes.data).map(([id, name]) => ({
            id,
            name: name as string,
          }));
          setAssessmentOptions(options);

          if (sessionRes) {
            setHierarchyData(sessionRes.data || []);
          }
        })
        .catch((err) => console.error("Failed to load data", err))
        .finally(() => setLoading(false));
    }
  }, [show]);

  const classes = useMemo(() => {
    if (!selectedSessionId) return [];
    const session = hierarchyData.find((s: any) => String(s.id) === selectedSessionId);
    return session?.schoolClasses || [];
  }, [hierarchyData, selectedSessionId]);

  const sections = useMemo(() => {
    if (!selectedClassId) return [];
    const cls = classes.find((c: any) => String(c.id) === selectedClassId);
    return cls?.schoolSections || [];
  }, [classes, selectedClassId]);

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
    if (!formData.name || !formData.dob || !formData.selectedAssessmentId || !selectedSectionId) {
      alert("Please fill in all required fields (Name, DOB, Assessment, Section)");
      return;
    }

    setSubmitting(true);
    try {
        const instituteId = localStorage.getItem('instituteId');

        const payload: StudentInfo = {
            name: formData.name,
            schoolRollNumber: formData.schoolRollNumber || "",
            controlNumber: formData.controlNumber ? Number(formData.controlNumber) : undefined,
            phoneNumber: formData.phoneNumber ? Number(formData.phoneNumber) : undefined,
            email: "",
            address: "",
            studentDob: formatDateForBackend(formData.dob),
            instituteId: instituteId ? Number(instituteId) : undefined,
            assesment_id: formData.selectedAssessmentId,
            schoolSectionId: Number(selectedSectionId),
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
            <p className="mt-2 text-muted">Loading...</p>
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
              <Form.Label>Control Number</Form.Label>
              <Form.Control
                type="number"
                name="controlNumber"
                value={formData.controlNumber}
                onChange={handleChange}
                placeholder="Enter control number (optional)"
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
              <Form.Label>Session <span className="text-danger">*</span></Form.Label>
              <Form.Select
                value={selectedSessionId}
                onChange={(e) => {
                  setSelectedSessionId(e.target.value);
                  setSelectedClassId("");
                  setSelectedSectionId("");
                }}
              >
                <option value="">-- Select Session --</option>
                {hierarchyData.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.sessionYear}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Class <span className="text-danger">*</span></Form.Label>
              <Form.Select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setSelectedSectionId("");
                }}
                disabled={!selectedSessionId}
              >
                <option value="">-- Select Class --</option>
                {classes.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.className}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Section <span className="text-danger">*</span></Form.Label>
              <Form.Select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                disabled={!selectedClassId}
              >
                <option value="">-- Select Section --</option>
                {sections.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.sectionName}
                  </option>
                ))}
              </Form.Select>
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
