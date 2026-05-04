import { FC, useEffect, useState } from "react";
import { Modal, Button } from "react-bootstrap";
import axios from "axios";
import { showSuccessToast, showErrorToast } from "../../../../utils/toast";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

/**
 * Modal for setting "max reset count per student per assessment".
 * Once a student has had their assessment reset that many times, further
 * resets should be blocked.
 *
 * Backend endpoints expected:
 *   GET  /assessments/{id}/reset-policy   -> { maxResetsPerStudent: number | null }
 *   PUT  /assessments/{id}/reset-policy   -> { maxResetsPerStudent: number | null }
 *
 * If those endpoints don't exist yet, the form still opens — save will fail
 * with a toast until the backend lands.
 */

type Assessment = {
  id: number;
  assessmentName?: string;
  name?: string;
  title?: string;
  maxResetsPerStudent?: number | null;
};

interface Props {
  show: boolean;
  onHide: () => void;
  assessments: Assessment[];
}

const AssessmentResetLimitModal: FC<Props> = ({ show, onHide, assessments }) => {
  const [selectedId, setSelectedId] = useState<string>("");
  const [maxResets, setMaxResets] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const reset = () => {
    setSelectedId("");
    setMaxResets("");
  };

  useEffect(() => {
    if (!show) reset();
  }, [show]);

  useEffect(() => {
    if (!selectedId) return;
    setFetching(true);
    axios
      .get(`${API_URL}/assessments/${selectedId}/reset-policy`)
      .then((res) => {
        const v = res.data?.maxResetsPerStudent;
        setMaxResets(v == null ? "" : String(v));
      })
      .catch(() => setMaxResets(""))
      .finally(() => setFetching(false));
  }, [selectedId]);

  const handleSave = async () => {
    if (!selectedId) {
      showErrorToast("Pick an assessment first");
      return;
    }
    const parsed = maxResets.trim() === "" ? null : Number(maxResets);
    if (parsed != null && (Number.isNaN(parsed) || parsed < 0)) {
      showErrorToast("Reset limit must be a non-negative whole number");
      return;
    }
    setLoading(true);
    try {
      await axios.put(`${API_URL}/assessments/${selectedId}/reset-policy`, {
        maxResetsPerStudent: parsed,
      });
      showSuccessToast("Reset limit saved");
      onHide();
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || "Save failed";
      showErrorToast(`${status ? `HTTP ${status}: ` : ""}${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const assessmentName = (a: Assessment) =>
    a.assessmentName || a.name || a.title || `Assessment #${a.id}`;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Set max resets per student</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "1rem" }}>
          Choose an assessment and set how many times each student is allowed to
          have it reset. After this limit, further resets will be blocked.
        </p>

        <div className="fv-row mb-3">
          <label className="fs-6 fw-bold mb-2">Assessment</label>
          <select
            className="form-control form-control-solid"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Select assessment…</option>
            {assessments.map((a) => (
              <option key={a.id} value={a.id}>
                {assessmentName(a)}
              </option>
            ))}
          </select>
        </div>

        <div className="fv-row mb-3">
          <label className="fs-6 fw-bold mb-2">Max resets per student</label>
          <input
            type="number"
            min={0}
            placeholder={fetching ? "Loading current limit…" : "e.g. 2 (leave blank for unlimited)"}
            className="form-control form-control-solid"
            value={maxResets}
            disabled={!selectedId || fetching}
            onChange={(e) => setMaxResets(e.target.value)}
          />
          <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 6 }}>
            Leave blank to remove the limit (unlimited resets).
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={loading || fetching || !selectedId}>
          {loading ? "Saving…" : "Save limit"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AssessmentResetLimitModal;
