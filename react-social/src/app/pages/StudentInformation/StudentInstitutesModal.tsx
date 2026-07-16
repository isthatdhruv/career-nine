import { useEffect, useState } from "react";
import { Badge, Button, Form, Modal, Spinner, Table } from "react-bootstrap";
import { showErrorToast, showSuccessToast } from "../../utils/toast";
import {
  addStudentMembership,
  dropStudentMembership,
  getStudentMemberships,
  setStudentPrimaryInstitute,
  StudentMembership,
  undropStudentMembership,
} from "../B2C/API/Membership_APIs";
import { InstituteOption } from "../B2C/API/Campaign_APIs";
import { useInstitutes } from "../../lib/queries/lookups";
import SearchableSelect from "../../components/SearchableSelect";

interface Props {
  show: boolean;
  onHide: () => void;
  userStudentId: number;
  studentName?: string;
}

const StudentInstitutesModal = ({ show, onHide, userStudentId, studentName }: Props) => {
  const [rows, setRows] = useState<StudentMembership[]>([]);
  const { data: institutes = [] } = useInstitutes<InstituteOption>();
  const [loading, setLoading] = useState(false);
  const [busyCode, setBusyCode] = useState<number | null>(null);
  const [addCode, setAddCode] = useState<string>("");

  const load = async () => {
    if (!userStudentId) return;
    setLoading(true);
    try {
      const m = await getStudentMemberships(userStudentId);
      setRows(m.data || []);
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to load memberships");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (show) load(); /* eslint-disable-next-line */ }, [show, userStudentId]);

  const handleDrop = async (m: StudentMembership) => {
    const reason = window.prompt(`Drop ${m.instituteName ?? "institute"}? Optional reason:`, "");
    if (reason === null) return;
    setBusyCode(m.instituteCode);
    try {
      await dropStudentMembership(userStudentId, m.instituteCode, reason || undefined);
      showSuccessToast("Dropped");
      await load();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to drop");
    } finally {
      setBusyCode(null);
    }
  };

  const handleUndrop = async (m: StudentMembership) => {
    setBusyCode(m.instituteCode);
    try {
      await undropStudentMembership(userStudentId, m.instituteCode);
      showSuccessToast("Restored");
      await load();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed");
    } finally {
      setBusyCode(null);
    }
  };

  const handleSetPrimary = async (m: StudentMembership) => {
    setBusyCode(m.instituteCode);
    try {
      await setStudentPrimaryInstitute(userStudentId, m.instituteCode);
      showSuccessToast("Primary updated");
      await load();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed");
    } finally {
      setBusyCode(null);
    }
  };

  const handleAdd = async () => {
    if (!addCode) return;
    const code = Number(addCode);
    setBusyCode(code);
    try {
      await addStudentMembership(userStudentId, code);
      showSuccessToast("Added");
      setAddCode("");
      await load();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to add");
    } finally {
      setBusyCode(null);
    }
  };

  const existingCodes = new Set(rows.map(r => r.instituteCode));
  const addableInstitutes = institutes.filter(i => !existingCodes.has(i.instituteCode));

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Institutes for {studentName ?? `student #${userStudentId}`}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="text-center py-4"><Spinner animation="border" /></div>
        ) : (
          <>
            <Table responsive className="align-middle">
              <thead>
                <tr>
                  <th>Institute</th>
                  <th>Source</th>
                  <th>Added</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted py-3">No memberships yet.</td></tr>
                )}
                {rows.map(m => (
                  <tr key={m.instituteCode}>
                    <td>
                      <strong>{m.instituteName ?? `#${m.instituteCode}`}</strong>
                      {m.isPrimary && <Badge bg="info" className="ms-2">Primary</Badge>}
                    </td>
                    <td><small className="text-muted">{m.source}</small></td>
                    <td><small>{m.addedAt ?? "—"}</small></td>
                    <td>
                      {m.isDropped
                        ? <Badge bg="danger">Dropped{m.droppedAt ? ` · ${m.droppedAt}` : ""}</Badge>
                        : <Badge bg="success">Active</Badge>}
                    </td>
                    <td>
                      {!m.isPrimary && !m.isDropped && (
                        <Button size="sm" variant="outline-info" className="me-1"
                          disabled={busyCode === m.instituteCode}
                          onClick={() => handleSetPrimary(m)}>Make primary</Button>
                      )}
                      {!m.isDropped && (
                        <Button size="sm" variant="outline-danger" className="me-1"
                          disabled={busyCode === m.instituteCode || m.isPrimary}
                          title={m.isPrimary ? "Cannot drop primary — promote another first" : "Drop"}
                          onClick={() => handleDrop(m)}>Drop</Button>
                      )}
                      {m.isDropped && (
                        <Button size="sm" variant="outline-success"
                          disabled={busyCode === m.instituteCode}
                          onClick={() => handleUndrop(m)}>Un-drop</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <hr />
            <h6>Add institute</h6>
            <div className="d-flex gap-2">
              <SearchableSelect
                options={addableInstitutes.map(i => ({
                  value: String(i.instituteCode),
                  label: String(i.instituteName ?? ""),
                }))}
                value={addCode}
                onChange={(v) => setAddCode(v)}
                placeholder="— pick an institute —"
                style={{ flex: 1 }}
              />
              <Button variant="primary" disabled={!addCode || busyCode !== null} onClick={handleAdd}>Add</Button>
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default StudentInstitutesModal;
