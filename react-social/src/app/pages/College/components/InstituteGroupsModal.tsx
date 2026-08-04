import { Button, Modal } from "react-bootstrap";
import GroupManagerPanel from "../../GroupManagement/components/GroupManagerPanel";

interface Props {
  show: boolean;
  onHide: () => void;
  instituteCode: number;
  instituteName?: string;
}

/**
 * The Groups action on the institute list — the group manager for one
 * institute, in a modal.
 *
 * <p>All behaviour (and the permission gating on every mutating control) lives
 * in {@link GroupManagerPanel}, which the standalone Group Management page
 * renders too, so the two surfaces cannot drift apart. This file is only the
 * modal frame.
 *
 * <p>The panel is mounted only while the modal is open and keyed on the
 * institute, so reopening on a different school starts from a clean slate
 * rather than carrying the previous school's selected group across.
 */
const InstituteGroupsModal = ({ show, onHide, instituteCode, instituteName }: Props) => (
  <Modal show={show} onHide={onHide} size="xl" centered scrollable>
    <Modal.Header closeButton>
      <Modal.Title className="fs-5">
        Groups
        {instituteName && <span className="text-muted fs-6 fw-normal"> · {instituteName}</span>}
      </Modal.Title>
    </Modal.Header>

    <Modal.Body style={{ minHeight: 460 }}>
      {show && <GroupManagerPanel key={instituteCode} instituteCode={instituteCode} />}
    </Modal.Body>

    <Modal.Footer>
      <Button variant="secondary" onClick={onHide}>Close</Button>
    </Modal.Footer>
  </Modal>
);

export default InstituteGroupsModal;
