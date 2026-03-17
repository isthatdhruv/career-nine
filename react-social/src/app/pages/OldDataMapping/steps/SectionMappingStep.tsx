import { useState } from "react";
import { createSection, saveMapping } from "../API/OldDataMapping_APIs";

interface Props {
  section: { id: string; name: string };
  sectionIndex: number;
  totalSections: number;
  classId: number;
  gradeMappingId: number;
  existingSections: any[];
  onMapped: (mappingId: number, newSectionId: number, newSectionName: string) => void;
}

const SectionMappingStep = ({
  section,
  sectionIndex,
  totalSections,
  classId,
  gradeMappingId,
  existingSections,
  onMapped,
}: Props) => {
  const [choice, setChoice] = useState<"new" | "existing" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newSectionName, setNewSectionName] = useState(section.name);

  const handleCreateNew = async () => {
    if (!newSectionName.trim()) { setError("Section name is required"); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        sectionName: newSectionName.trim(),
        schoolClasses: { id: classId },
      };
      const res = await createSection(payload);
      const newSection = res.data;
      const mappingRes = await saveMapping({
        firebaseId: section.id,
        firebaseName: section.name,
        firebaseType: "SECTION",
        newEntityId: newSection.id,
        newEntityName: newSection.sectionName,
        parentMappingId: gradeMappingId,
      });
      onMapped(mappingRes.data.id, newSection.id, newSection.sectionName);
    } catch {
      setError("Failed to create section. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectExisting = async (sec: any) => {
    setSaving(true); setError("");
    try {
      const mappingRes = await saveMapping({
        firebaseId: section.id,
        firebaseName: section.name,
        firebaseType: "SECTION",
        newEntityId: sec.id,
        newEntityName: sec.sectionName,
        parentMappingId: gradeMappingId,
      });
      onMapped(mappingRes.data.id, sec.id, sec.sectionName);
    } catch {
      setError("Failed to save mapping. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-6">
        <div>
          <span className="badge badge-light-warning fs-7 mb-2">
            Section {sectionIndex + 1} of {totalSections}
          </span>
          <h4 className="fw-bold text-dark mb-1">Map Section</h4>
        </div>
        <div className="bg-light-warning rounded px-4 py-2">
          <span className="fs-6 fw-semibold text-warning-emphasis">
            Firebase: <strong>{section.name}</strong>
          </span>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 mb-4">{error}</div>}

      {!choice && (
        <div className="row g-4">
          <div className="col-12 col-md-6">
            <div className="card border border-success border-2 h-100" style={{ cursor: "pointer" }} onClick={() => setChoice("new")}>
              <div className="card-body p-6 text-center">
                <i className="bi bi-plus-circle fs-2x text-success mb-3 d-block"></i>
                <h5 className="fw-bold">Create New Section</h5>
                <p className="text-muted fs-7">This section doesn't exist yet</p>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="card border border-primary border-2 h-100" style={{ cursor: "pointer" }} onClick={() => setChoice("existing")}>
              <div className="card-body p-6 text-center">
                <i className="bi bi-search fs-2x text-primary mb-3 d-block"></i>
                <h5 className="fw-bold">Map to Existing</h5>
                <p className="text-muted fs-7">This section already exists in the new system</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {choice === "new" && (
        <div className="card border border-success mt-4">
          <div className="card-body p-6">
            <h5 className="fw-bold mb-4">Create New Section</h5>
            <div className="mb-4">
              <label className="form-label fw-semibold">Section Name <span className="text-danger">*</span></label>
              <input className="form-control" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} placeholder="e.g. A" />
            </div>
            <div className="d-flex gap-3">
              <button className="btn btn-light" onClick={() => setChoice(null)}>Back</button>
              <button className="btn btn-success" onClick={handleCreateNew} disabled={saving}>
                {saving ? <span className="spinner-border spinner-border-sm me-2" /> : null}Create & Map
              </button>
            </div>
          </div>
        </div>
      )}

      {choice === "existing" && (
        <div className="card border border-primary mt-4">
          <div className="card-body p-6">
            <h5 className="fw-bold mb-4">Select Existing Section</h5>
            <div className="mb-4" style={{ maxHeight: 300, overflowY: "auto" }}>
              {existingSections.map((sec: any) => (
                <div key={sec.id} className="d-flex align-items-center justify-content-between p-3 border rounded mb-2" style={{ cursor: "pointer" }} onClick={() => !saving && handleSelectExisting(sec)}>
                  <span className="fw-semibold">{sec.sectionName}</span>
                  <button className="btn btn-sm btn-primary" disabled={saving}>
                    {saving ? <span className="spinner-border spinner-border-sm" /> : "Select"}
                  </button>
                </div>
              ))}
              {existingSections.length === 0 && <p className="text-muted text-center py-4">No sections found in this class</p>}
            </div>
            <button className="btn btn-light" onClick={() => setChoice(null)}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SectionMappingStep;
