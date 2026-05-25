import { useState } from "react";
import { createClass, saveMapping } from "../API/OldDataMapping_APIs";

interface Props {
  grade: { id: string; name: string };
  gradeIndex: number;
  totalGrades: number;
  sessionId: number;
  sessionMappingId: number;
  existingClasses: any[]; // classes already in the mapped session
  onMapped: (mappingId: number, newClassId: number, newClassName: string, existingSections: any[]) => void;
}

const GradeMappingStep = ({
  grade,
  gradeIndex,
  totalGrades,
  sessionId,
  sessionMappingId,
  existingClasses,
  onMapped,
}: Props) => {
  const [choice, setChoice] = useState<"new" | "existing" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newClassName, setNewClassName] = useState(grade.name);

  const handleCreateNew = async () => {
    if (!newClassName.trim()) { setError("Class name is required"); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        className: newClassName.trim(),
        schoolSession: { id: sessionId },
      };
      const res = await createClass(payload);
      const newClass = res.data;
      const mappingRes = await saveMapping({
        firebaseId: grade.id,
        firebaseName: grade.name,
        firebaseType: "GRADE",
        newEntityId: newClass.id,
        newEntityName: newClass.className,
        parentMappingId: sessionMappingId,
      });
      onMapped(mappingRes.data.id, newClass.id, newClass.className, []);
    } catch {
      setError("Failed to create class. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectExisting = async (cls: any) => {
    setSaving(true); setError("");
    try {
      const mappingRes = await saveMapping({
        firebaseId: grade.id,
        firebaseName: grade.name,
        firebaseType: "GRADE",
        newEntityId: cls.id,
        newEntityName: cls.className,
        parentMappingId: sessionMappingId,
      });
      onMapped(mappingRes.data.id, cls.id, cls.className, cls.schoolSections || []);
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
          <span className="badge badge-light-success fs-7 mb-2">
            Grade {gradeIndex + 1} of {totalGrades}
          </span>
          <h4 className="fw-bold text-dark mb-1">Map Grade / Class</h4>
        </div>
        <div className="bg-light-warning rounded px-4 py-2">
          <span className="fs-6 fw-semibold text-warning-emphasis">
            Firebase: <strong>{grade.name}</strong>
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
                <h5 className="fw-bold">Create New Class</h5>
                <p className="text-muted fs-7">This grade/class doesn't exist yet</p>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="card border border-primary border-2 h-100" style={{ cursor: "pointer" }} onClick={() => setChoice("existing")}>
              <div className="card-body p-6 text-center">
                <i className="bi bi-search fs-2x text-primary mb-3 d-block"></i>
                <h5 className="fw-bold">Map to Existing</h5>
                <p className="text-muted fs-7">This grade already exists in the new system</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {choice === "new" && (
        <div className="card border border-success mt-4">
          <div className="card-body p-6">
            <h5 className="fw-bold mb-4">Create New Class</h5>
            <div className="mb-4">
              <label className="form-label fw-semibold">Class Name <span className="text-danger">*</span></label>
              <input className="form-control" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="e.g. Class 10" />
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
            <h5 className="fw-bold mb-4">Select Existing Class</h5>
            <div className="mb-4" style={{ maxHeight: 300, overflowY: "auto" }}>
              {existingClasses.map((cls: any) => (
                <div key={cls.id} className="d-flex align-items-center justify-content-between p-3 border rounded mb-2" style={{ cursor: "pointer" }} onClick={() => !saving && handleSelectExisting(cls)}>
                  <span className="fw-semibold">{cls.className}</span>
                  <button className="btn btn-sm btn-primary" disabled={saving}>
                    {saving ? <span className="spinner-border spinner-border-sm" /> : "Select"}
                  </button>
                </div>
              ))}
              {existingClasses.length === 0 && <p className="text-muted text-center py-4">No classes found in this session</p>}
            </div>
            <button className="btn btn-light" onClick={() => setChoice(null)}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradeMappingStep;
