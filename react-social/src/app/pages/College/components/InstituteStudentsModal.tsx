import { useEffect, useState } from "react";
import { Badge, Button, Form, Modal, Spinner, Table } from "react-bootstrap";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import {
  dropStudentMembership,
  getInstituteStudents,
  InstituteStudentRow,
  undropStudentMembership,
} from "../../B2C/API/Membership_APIs";

interface Props {
  show: boolean;
  onHide: () => void;
  instituteCode: number;
  instituteName?: string;
}

const InstituteStudentsModal = ({ show, onHide, instituteCode, instituteName }: Props) => {
  const [rows, setRows] = useState<InstituteStudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [includeDropped, setIncludeDropped] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    if (!instituteCode) return;
    setLoading(true);
    try {
      const res = await getInstituteStudents(instituteCode, includeDropped);
      setRows(res.data || []);
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (show) load(); /* eslint-disable-next-line */ }, [show, instituteCode, includeDropped]);

  const handleDrop = async (r: InstituteStudentRow) => {
    if (r.isPrimary) return;
    const reason = window.prompt(`Drop ${r.name ?? "student"} from ${instituteName ?? "this institute"}?`, "");
    if (reason === null) return;
    setBusyId(r.userStudentId);
    try {
      await dropStudentMembership(r.userStudentId, instituteCode, reason || undefined);
      showSuccessToast("Dropped");
      await load();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleUndrop = async (r: InstituteStudentRow) => {
    setBusyId(r.userStudentId);
    try {
      await undropStudentMembership(r.userStudentId, instituteCode);
      showSuccessToast("Restored");
      await load();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Students at {instituteName ?? `institute #${instituteCode}`}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Check
          type="switch"
          id="include-dropped"
          label="Include dropped students"
          checked={includeDropped}
          onChange={e => setIncludeDropped(e.target.checked)}
          className="mb-3"
        />
        {loading ? (
          <div className="text-center py-4"><Spinner animation="border" /></div>
        ) : (
          <Table responsive className="align-middle">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email / Phone</th>
                <th>Source</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted py-3">No students linked to this institute.</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.userStudentId}>
                  <td>
                    <strong>{r.name ?? `#${r.userStudentId}`}</strong>
                    {r.isPrimary && <Badge bg="info" className="ms-2">Primary</Badge>}
                  </td>
                  <td><small>{r.email ?? "—"}<br />{r.phone ?? ""}</small></td>
                  <td><small className="text-muted">{r.source}</small></td>
                  <td>
                    {r.isDropped
                      ? <Badge bg="danger">Dropped{r.droppedAt ? ` · ${r.droppedAt}` : ""}</Badge>
                      : <Badge bg="success">Active</Badge>}
                  </td>
                  <td>
                    {!r.isDropped && (
                      <Button size="sm" variant="outline-danger"
                        disabled={busyId === r.userStudentId || r.isPrimary}
                        title={r.isPrimary ? "Cannot drop — this is the student's primary institute" : "Drop"}
                        onClick={() => handleDrop(r)}>Drop</Button>
                    )}
                    {r.isDropped && (
                      <Button size="sm" variant="outline-success"
                        disabled={busyId === r.userStudentId}
                        onClick={() => handleUndrop(r)}>Un-drop</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default InstituteStudentsModal;
