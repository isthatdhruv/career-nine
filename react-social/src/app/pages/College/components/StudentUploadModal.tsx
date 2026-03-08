import React, { useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";

type Props = {
  show: boolean;
  onHide: () => void;
  college: any | null;
  onUploaded?: () => void;
};

const StudentUploadModal: React.FC<Props> = ({ show, onHide, college, onUploaded }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
  };

  const upload = async () => {
    if (!file || !college) {
      setMessage("Please select a file and institute.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Adjust endpoint to match your backend
      const res = await fetch(`/api/colleges/${college.instituteCode || college.id}/students/upload`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      setMessage("Uploaded successfully");
      if (onUploaded) onUploaded();
    } catch (err) {
      console.error(err);
      setMessage("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Upload Students Excel</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div>
          <div><strong>Institute:</strong> {college?.instituteName || "—"}</div>
          <Form.Group className="mt-3">
            <Form.Label>Student file (.xlsx, .xls, .csv)</Form.Label>
            <Form.Control type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} />
            <Form.Text className="text-muted">First row should contain headers (name, email, rollNo etc.)</Form.Text>
          </Form.Group>
          {message && <div className="mt-2">{message}</div>}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>Close</Button>
        <Button variant="primary" onClick={upload} disabled={loading || !file}>
          {loading ? "Uploading…" : "Upload"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default StudentUploadModal;