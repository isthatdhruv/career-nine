import { Modal, Button } from "react-bootstrap";
import AssessmentMappingPanel from "./AssessmentMappingPanel";

interface AssessmentMappingModalProps {
  show: boolean;
  onHide: () => void;
  instituteCode: number;
  instituteName: string;
}

const AssessmentMappingModal = (props: AssessmentMappingModalProps) => {
  return (
    <Modal show={props.show} onHide={props.onHide} size="xl" centered>
      <Modal.Header
        closeButton
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
          borderBottom: "none",
          padding: "24px 32px",
        }}
      >
        <div>
          <Modal.Title style={{ color: "#fff", fontWeight: 700, fontSize: "1.25rem" }}>
            Assessment Mapping
          </Modal.Title>
          <div style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: 4 }}>
            {props.instituteName}
          </div>
        </div>
      </Modal.Header>

      <Modal.Body style={{ padding: 0 }}>
        <AssessmentMappingPanel
          instituteCode={props.instituteCode}
          instituteName={props.instituteName}
          active={props.show}
        />
      </Modal.Body>

      <Modal.Footer style={{ padding: "16px 32px", borderTop: "1px solid #e2e8f0", background: "#fff" }}>
        <Button
          variant="secondary"
          onClick={props.onHide}
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

export default AssessmentMappingModal;
