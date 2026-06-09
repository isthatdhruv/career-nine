import { useEffect, useState } from "react";
import { Spinner } from "react-bootstrap";
import {
  getAssessmentSummaryList,
  getCatalog,
  enableCatalog,
  deleteCatalog,
  InstituteAssessment,
} from "../../AssessmentMapping/API/AssessmentMapping_APIs";
import { showErrorToast } from "../../../utils/toast";
import CatalogSelector from "./CatalogSelector";

interface Props {
  instituteCode: number;
  active?: boolean;
}

/**
 * Wizard Step 3 "Map Assessments" — a focused catalog picker.
 *
 * Selects which assessments an institute offers (a checkbox dropdown + badges,
 * via CatalogSelector). Per-level registration links are created later on the
 * standalone Assessment Mapping page, not here.
 */
const InstituteCatalogPicker = ({ instituteCode, active = true }: Props) => {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<InstituteAssessment[]>([]);
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

  const handleAddOne = async (assessmentId: number) => {
    setSaving(true);
    try {
      const res = await enableCatalog(instituteCode, [assessmentId]);
      setCatalog(res.data || []);
    } catch (error: any) {
      // 400 body is a plain-string message (e.g. maxAssessments cap exceeded).
      showErrorToast(String(error.response?.data || error.message || "Failed to enable assessment"));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (item: InstituteAssessment) => {
    setSaving(true);
    try {
      await deleteCatalog(item.id);
      setCatalog((prev) => prev.filter((c) => c.id !== item.id));
    } catch (error: any) {
      showErrorToast(String(error.response?.data || error.message || "Failed to remove from catalog"));
    } finally {
      setSaving(false);
    }
  };

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
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <h6 className="fw-semibold mb-3">Enabled assessments</h6>
          <CatalogSelector
            assessments={assessments}
            catalog={catalog}
            busy={saving}
            onAdd={handleAddOne}
            onRemove={handleRemove}
          />
        </div>
      </div>
    </div>
  );
};

export default InstituteCatalogPicker;
