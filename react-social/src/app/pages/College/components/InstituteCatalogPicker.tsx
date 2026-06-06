import { useEffect, useState } from "react";
import { Button, Spinner } from "react-bootstrap";
import {
  getAssessmentSummaryList,
  getCatalog,
  enableCatalog,
  toggleCatalog,
  deleteCatalog,
  InstituteAssessment,
} from "../../AssessmentMapping/API/AssessmentMapping_APIs";
import { showErrorToast } from "../../../utils/toast";

interface Props {
  instituteCode: number;
  active?: boolean;
}

/**
 * Wizard Step 3 "Map Assessments" — a focused catalog picker.
 *
 * Selects which assessments an institute offers (writes via enableCatalog) and
 * lists the current catalog with toggle/remove. Per-level link creation lives in
 * the standalone Assessment Mapping page, not here.
 */
const InstituteCatalogPicker = ({ instituteCode, active = true }: Props) => {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<InstituteAssessment[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (active && instituteCode) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, instituteCode]);

  const load = async () => {
    setLoading(true);
    try {
      const [assessmentRes, catalogRes] = await Promise.all([
        getAssessmentSummaryList(),
        getCatalog(instituteCode),
      ]);
      setAssessments((assessmentRes.data || []).filter((a: any) => a.isActive !== false));
      setCatalog(catalogRes.data || []);
    } catch (error) {
      console.error("Failed to load catalog:", error);
    } finally {
      setLoading(false);
    }
  };

  const togglePick = (id: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEnable = async () => {
    if (picked.size === 0) {
      showErrorToast("Select at least one assessment to enable");
      return;
    }
    setSaving(true);
    try {
      const res = await enableCatalog(instituteCode, Array.from(picked));
      setCatalog(res.data || []);
      setPicked(new Set());
    } catch (error: any) {
      // 400 body is a plain-string message (e.g. maxAssessments cap exceeded).
      showErrorToast(String(error.response?.data || error.message || "Failed to enable assessments"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: InstituteAssessment) => {
    try {
      const res = await toggleCatalog(item.id);
      setCatalog((prev) => prev.map((c) => (c.id === item.id ? res.data : c)));
    } catch (error) {
      console.error("Failed to toggle catalog item:", error);
    }
  };

  const handleRemove = async (item: InstituteAssessment) => {
    if (!window.confirm("Remove this assessment from the institute's catalog?")) return;
    try {
      await deleteCatalog(item.id);
      setCatalog((prev) => prev.filter((c) => c.id !== item.id));
    } catch (error: any) {
      showErrorToast(String(error.response?.data || error.message || "Failed to remove from catalog"));
    }
  };

  const getAssessmentName = (assessmentId: number) => {
    const a = assessments.find((x: any) => Number(x.id) === Number(assessmentId));
    return a ? a.AssessmentName || a.assessmentName || `ID: ${assessmentId}` : `ID: ${assessmentId}`;
  };

  const catalogIds = new Set(catalog.map((c) => Number(c.assessmentId)));
  const addable = assessments.filter((a: any) => !catalogIds.has(Number(a.id)));

  if (loading) {
    return (
      <div className="text-muted small d-flex align-items-center">
        <Spinner animation="border" size="sm" className="me-2" /> Loading assessments...
      </div>
    );
  }

  return (
    <div>
      <p className="text-muted small mb-3">
        Choose which assessments this institute offers. Registration links per
        session / class / section are created later on the Assessment Mapping page.
      </p>

      {/* Current catalog */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="mb-0 fw-semibold">Enabled assessments</h6>
            <span className="badge bg-light text-dark">{catalog.length} enabled</span>
          </div>
          {catalog.length === 0 ? (
            <p className="text-muted small mb-0">No assessments enabled yet.</p>
          ) : (
            <div className="d-flex flex-wrap gap-2">
              {catalog.map((c) => (
                <span
                  key={c.id}
                  className={`badge d-flex align-items-center gap-2 border ${
                    c.isActive ? "bg-success-subtle text-success-emphasis" : "bg-light text-muted"
                  }`}
                  style={{ padding: "0.5rem 0.75rem", fontSize: "0.8rem" }}
                >
                  <span style={{ textDecoration: c.isActive ? "none" : "line-through" }}>
                    {getAssessmentName(c.assessmentId)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-link p-0 text-decoration-none"
                    style={{ fontSize: "0.72rem", fontWeight: 700 }}
                    onClick={() => handleToggle(c)}
                  >
                    {c.isActive ? "On" : "Off"}
                  </button>
                  <button
                    type="button"
                    className="btn-close btn-close-sm"
                    aria-label="Remove"
                    onClick={() => handleRemove(c)}
                  />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add assessments */}
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <h6 className="fw-semibold mb-2">Add assessments</h6>
          {addable.length === 0 ? (
            <p className="text-muted small mb-0">All available assessments are already enabled.</p>
          ) : (
            <>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {addable.map((a: any) => {
                  const isPicked = picked.has(Number(a.id));
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={`btn btn-sm ${isPicked ? "btn-primary" : "btn-outline-secondary"}`}
                      style={{ borderRadius: 999 }}
                      onClick={() => togglePick(Number(a.id))}
                    >
                      {isPicked ? "✓ " : "+ "}
                      {a.AssessmentName || a.assessmentName}
                    </button>
                  );
                })}
              </div>
              <Button
                variant="primary"
                disabled={saving || picked.size === 0}
                onClick={handleEnable}
              >
                {saving ? (
                  <>
                    Enabling... <Spinner animation="border" size="sm" className="ms-2" />
                  </>
                ) : (
                  `Enable ${picked.size || ""} assessment${picked.size === 1 ? "" : "s"}`.trim()
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstituteCatalogPicker;
