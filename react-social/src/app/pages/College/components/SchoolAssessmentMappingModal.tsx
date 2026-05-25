import { Modal, Button } from "react-bootstrap";
import SchoolAssessmentMappingPanel from "./SchoolAssessmentMappingPanel";

interface Props {
  show: boolean;
  onHide: () => void;
  instituteCode: number;
  instituteName: string;
}

const SchoolAssessmentMappingModal = ({ show, onHide, instituteCode, instituteName }: Props) => {
  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header
        closeButton
        style={{
          background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
          borderBottom: "none",
          padding: "24px 32px",
        }}
      >
        <div>
          <Modal.Title style={{ color: "#fff", fontWeight: 700, fontSize: "1.25rem" }}>
            School Assessment Mapping
          </Modal.Title>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.85rem", marginTop: 4 }}>
            {instituteName}
          </div>
        </div>
      </Modal.Header>

      <Modal.Body style={{ padding: 0 }}>
        <SchoolAssessmentMappingPanel
          instituteCode={instituteCode}
          instituteName={instituteName}
          active={show}
        />
      </Modal.Body>

      <Modal.Footer style={{ padding: "16px 32px", borderTop: "1px solid #e2e8f0", background: "#fff" }}>
        <Button
          variant="secondary"
          onClick={onHide}
          style={{
            borderRadius: 10, padding: "8px 24px", fontWeight: 600,
            background: "#f1f5f9", border: "1.5px solid #e2e8f0", color: "#475569",
          }}
        >
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default SchoolAssessmentMappingModal;
