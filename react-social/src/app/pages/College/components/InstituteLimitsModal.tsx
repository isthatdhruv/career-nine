import { FC, useEffect, useState } from "react";
import { Modal, Button } from "react-bootstrap";
import axios from "axios";
import { showSuccessToast, showErrorToast } from "../../../utils/toast";
import SearchableSelect from "../../../components/SearchableSelect";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

/**
 * Modal for setting "max assessments per institute" — once that count is
 * reached, no further assessment-allotment should be allowed for the institute.
 *
 * Backend endpoints expected (Spring controller convention):
 *   GET  /instituteDetail/{id}/limits         -> { maxAssessments: number | null }
 *   PUT  /instituteDetail/{id}/limits         -> { maxAssessments: number | null }
 *
 * If those endpoints don't exist yet, the modal still opens and lets the admin
 * type a value — the save call will fail with a toast until the endpoints land.
 */

type Institute = {
  id?: number;
  instituteCode?: number;
  instituteName?: string;
  name?: string;
  schoolName?: string;
  collegeName?: string;
  maxAssessments?: number | null;
};

const idOf = (i: Institute): number | undefined =>
  i.instituteCode ?? i.id;

interface Props {
  show: boolean;
  onHide: () => void;
  institutes: Institute[];
}

const InstituteLimitsModal: FC<Props> = ({ show, onHide, institutes }) => {
  const [selectedId, setSelectedId] = useState<string>("");
  const [maxAssessments, setMaxAssessments] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const reset = () => {
    setSelectedId("");
    setMaxAssessments("");
  };

  useEffect(() => {
    if (!show) reset();
  }, [show]);

  // When admin picks an institute, fetch the current limit
  useEffect(() => {
    if (!selectedId) return;
    setFetching(true);
    axios
      .get(`${API_URL}/instituteDetail/${selectedId}/limits`)
      .then((res) => {
        const v = res.data?.maxAssessments;
        setMaxAssessments(v == null ? "" : String(v));
      })
      .catch(() => {
        // No record yet — start blank
        setMaxAssessments("");
      })
      .finally(() => setFetching(false));
  }, [selectedId]);

  const handleSave = async () => {
    if (!selectedId) {
      showErrorToast("Pick an institute first");
      return;
    }
    const parsed = maxAssessments.trim() === "" ? null : Number(maxAssessments);
    if (parsed != null && (Number.isNaN(parsed) || parsed < 0)) {
      showErrorToast("Limit must be a non-negative whole number");
      return;
    }
    setLoading(true);
    try {
      await axios.put(`${API_URL}/instituteDetail/${selectedId}/limits`, {
        maxAssessments: parsed,
      });
      showSuccessToast("Institute limit saved");
      onHide();
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || "Save failed";
      showErrorToast(`${status ? `HTTP ${status}: ` : ""}${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const instituteName = (i: Institute) =>
    i.instituteName || i.name || i.schoolName || i.collegeName || `Institute #${idOf(i) ?? "?"}`;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Set max assessments per institute</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "1rem" }}>
          Choose an institute and set how many assessments can be allotted in total.
          Once the limit is hit, new allotments will be blocked.
        </p>

        <div className="fv-row mb-3">
          <label className="fs-6 fw-bold mb-2">Institute</label>
          <SearchableSelect
            options={institutes
              .filter((i) => idOf(i) != null)
              .map((i) => ({ value: String(idOf(i)), label: String(instituteName(i) ?? "") }))}
            value={selectedId}
            onChange={(v) => setSelectedId(v)}
            placeholder="Select institute…"
          />
        </div>

        <div className="fv-row mb-3">
          <label className="fs-6 fw-bold mb-2">
            Max assessments allowed
          </label>
          <input
            type="number"
            min={0}
            placeholder={fetching ? "Loading current limit…" : "e.g. 1000 (leave blank for unlimited)"}
            className="form-control form-control-solid"
            value={maxAssessments}
            disabled={!selectedId || fetching}
            onChange={(e) => setMaxAssessments(e.target.value)}
          />
          <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 6 }}>
            Leave blank to remove the limit (unlimited).
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

export default InstituteLimitsModal;
