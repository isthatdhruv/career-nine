import { useEffect, useState } from "react";
import { createInstitute, createSession, getAllInstitutes, saveMapping, saveBatchMappings } from "../API/OldDataMapping_APIs";

interface FirebaseSection { id: string; name: string; }
interface FirebaseGrade { id: string; name: string; sections: FirebaseSection[]; }
interface FirebaseSession { id: string; year: string; grades: FirebaseGrade[]; }

interface Props {
  school: { id: string; name: string; sessions: FirebaseSession[] };
  schoolIndex: number;
  totalSchools: number;
  onMapped: (mappingId: number, newInstituteCode: number, newInstituteName: string) => void;
  onAutoMapped: (mappings: { type: string; firebase: string; newName: string }[]) => void;
}

const SchoolMappingStep = ({ school, schoolIndex, totalSchools, onMapped, onAutoMapped }: Props) => {
  const [choice, setChoice] = useState<"new" | "existing" | null>(null);
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [autoCreateProgress, setAutoCreateProgress] = useState("");

  // Form state for new institute (matches College create modal)
  const [newName, setNewName] = useState(school.name);
  const [newCode, setNewCode] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newMaxStudents, setNewMaxStudents] = useState("");
  const [newMaxContactPersons, setNewMaxContactPersons] = useState("");

  useEffect(() => {
    if (choice === "existing") {
      setLoading(true);
      getAllInstitutes()
        .then((res) => setInstitutes(res.data || []))
        .catch(() => setError("Failed to load institutes"))
        .finally(() => setLoading(false));
    }
  }, [choice]);

  const handleCreateNew = async () => {
    if (!newName.trim()) { setError("College Name is required"); return; }
    if (!newCode.trim()) { setError("Institute Code is required"); return; }
    if (!newAddress.trim()) { setError("Institute Address is required"); return; }
    if (!newMaxStudents.trim()) { setError("Maximum Students is required"); return; }
    if (!newMaxContactPersons.trim()) { setError("Maximum Contact Persons is required"); return; }
    setSaving(true); setError("");

    try {
      // 1. Create institute
      setAutoCreateProgress("Creating institute...");
      const res = await createInstitute({
        instituteName: newName.trim(),
        instituteCode: newCode.trim(),
        instituteAddress: newAddress.trim(),
        maxStudents: newMaxStudents.trim(),
        maxContactPersons: newMaxContactPersons.trim(),
        display: 1,
      });
      const newInstitute = res.data;
      const instituteCode = newInstitute.instituteCode;

      // 2. Save school mapping
      setAutoCreateProgress("Saving school mapping...");
      const schoolMappingRes = await saveMapping({
        firebaseId: school.id,
        firebaseName: school.name,
        firebaseType: "SCHOOL",
        newEntityId: instituteCode,
        newEntityName: newInstitute.instituteName,
      });
      const schoolMappingId = schoolMappingRes.data.id;

      const allMappings: { type: string; firebase: string; newName: string }[] = [
        { type: "School", firebase: school.name, newName: newInstitute.instituteName },
      ];

      // 3. Auto-create all sessions with nested classes and sections
      if (school.sessions?.length > 0) {
        setAutoCreateProgress("Creating sessions, grades & sections...");

        // Build the full hierarchy payload for bulk session create
        const sessionPayload = school.sessions.map((sess) => ({
          sessionYear: sess.year,
          instituteCode: instituteCode,
          schoolClasses: (sess.grades || []).map((grade) => ({
            className: grade.name,
            schoolSections: (grade.sections || []).map((section) => ({
              sectionName: section.name,
            })),
          })),
        }));

        const sessionRes = await createSession(sessionPayload);
        const createdSessions = sessionRes.data;

        // 4. Save all child mappings
        setAutoCreateProgress("Saving all mappings...");
        const childMappings: any[] = [];

        for (let si = 0; si < school.sessions.length; si++) {
          const fbSession = school.sessions[si];
          const dbSession = createdSessions[si];
          if (!dbSession) continue;

          childMappings.push({
            firebaseId: fbSession.id,
            firebaseName: fbSession.year,
            firebaseType: "SESSION",
            newEntityId: dbSession.id,
            newEntityName: dbSession.sessionYear,
            parentMappingId: schoolMappingId,
          });
          allMappings.push({ type: "Session", firebase: fbSession.year, newName: dbSession.sessionYear });

          const dbClasses = dbSession.schoolClasses || [];
          for (let gi = 0; gi < (fbSession.grades || []).length; gi++) {
            const fbGrade = fbSession.grades[gi];
            const dbClass = dbClasses[gi];
            if (!dbClass) continue;

            childMappings.push({
              firebaseId: fbGrade.id,
              firebaseName: fbGrade.name,
              firebaseType: "GRADE",
              newEntityId: dbClass.id,
              newEntityName: dbClass.className,
              parentMappingId: schoolMappingId,
            });
            allMappings.push({ type: "Grade", firebase: fbGrade.name, newName: dbClass.className });

            const dbSections = dbClass.schoolSections || [];
            for (let sei = 0; sei < (fbGrade.sections || []).length; sei++) {
              const fbSection = fbGrade.sections[sei];
              const dbSection = dbSections[sei];
              if (!dbSection) continue;

              childMappings.push({
                firebaseId: fbSection.id,
                firebaseName: fbSection.name,
                firebaseType: "SECTION",
                newEntityId: dbSection.id,
                newEntityName: dbSection.sectionName,
                parentMappingId: schoolMappingId,
              });
              allMappings.push({ type: "Section", firebase: fbSection.name, newName: dbSection.sectionName });
            }
          }
        }

        if (childMappings.length > 0) {
          await saveBatchMappings(childMappings);
        }
      }

      // 5. Signal that entire school + children are auto-mapped
      onAutoMapped(allMappings);
    } catch (err: any) {
      console.error("Auto-create error:", err);
      setError("Failed to create. Please try again. " + (err?.response?.data?.message || err?.message || ""));
    } finally {
      setSaving(false);
      setAutoCreateProgress("");
    }
  };

  const handleSelectExisting = async (institute: any) => {
    setSaving(true); setError("");
    try {
      const mappingRes = await saveMapping({
        firebaseId: school.id,
        firebaseName: school.name,
        firebaseType: "SCHOOL",
        newEntityId: institute.instituteCode,
        newEntityName: institute.instituteName,
      });
      onMapped(mappingRes.data.id, institute.instituteCode, institute.instituteName);
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
          <span className="badge badge-light-primary fs-7 mb-2">
            School {schoolIndex + 1} of {totalSchools}
          </span>
          <h4 className="fw-bold text-dark mb-1">Map School</h4>
        </div>
        <div className="bg-light-warning rounded px-4 py-2">
          <span className="fs-6 fw-semibold text-warning-emphasis">
            Firebase: <strong>{school.name}</strong>
          </span>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 mb-4">{error}</div>}

      {!choice && (
        <div className="row g-4">
          <div className="col-12 col-md-6">
            <div
              className="card border border-success border-2 h-100"
              style={{ cursor: "pointer" }}
              onClick={() => setChoice("new")}
            >
              <div className="card-body p-6 text-center">
                <i className="bi bi-plus-circle fs-2x text-success mb-3 d-block"></i>
                <h5 className="fw-bold">Create New Institute</h5>
                <p className="text-muted fs-7">
                  This school doesn't exist in the new system yet.
                  All sessions, grades & sections will be auto-created.
                </p>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div
              className="card border border-primary border-2 h-100"
              style={{ cursor: "pointer" }}
              onClick={() => setChoice("existing")}
            >
              <div className="card-body p-6 text-center">
                <i className="bi bi-search fs-2x text-primary mb-3 d-block"></i>
                <h5 className="fw-bold">Map to Existing</h5>
                <p className="text-muted fs-7">
                  This school already exists in the new system.
                  You'll map sessions, grades & sections one by one.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {choice === "new" && (
        <div className="card border border-success mt-4">
          <div className="card-body p-6">
            <h5 className="fw-bold mb-4">Create New Institute</h5>

            {/* Summary of what will be auto-created */}
            {school.sessions?.length > 0 && (
              <div className="alert alert-light-success border border-success mb-4">
                <i className="bi bi-info-circle me-2 text-success"></i>
                This will also auto-create:{" "}
                <strong>{school.sessions.length}</strong> session(s),{" "}
                <strong>{school.sessions.reduce((sum, s) => sum + (s.grades?.length || 0), 0)}</strong> grade(s),{" "}
                <strong>{school.sessions.reduce((sum, s) => sum + s.grades?.reduce((gs, g) => gs + (g.sections?.length || 0), 0) || 0, 0)}</strong> section(s)
              </div>
            )}

            <div className="mb-4">
              <label className="form-label fw-semibold">College Name : <span className="text-danger">*</span></label>
              <input
                className="form-control"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter College Name"
                disabled={saving}
              />
            </div>
            <div className="mb-4">
              <label className="form-label fw-semibold">Institute Code : <span className="text-danger">*</span></label>
              <input
                className="form-control"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Enter Institute Code"
                disabled={saving}
              />
            </div>
            <div className="mb-4">
              <label className="form-label fw-semibold">Institute Address : <span className="text-danger">*</span></label>
              <input
                className="form-control"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Enter Institute Address"
                disabled={saving}
              />
            </div>
            <div className="mb-4">
              <label className="form-label fw-semibold">Maximum Students : <span className="text-danger">*</span></label>
              <input
                className="form-control"
                value={newMaxStudents}
                onChange={(e) => setNewMaxStudents(e.target.value)}
                placeholder="Enter Maximum Students"
                disabled={saving}
              />
            </div>
            <div className="mb-4">
              <label className="form-label fw-semibold">Maximum Contact Persons : <span className="text-danger">*</span></label>
              <input
                className="form-control"
                value={newMaxContactPersons}
                onChange={(e) => setNewMaxContactPersons(e.target.value)}
                placeholder="Enter Maximum Contact Persons"
                disabled={saving}
              />
            </div>

            {autoCreateProgress && (
              <div className="alert alert-info py-2 mb-4">
                <span className="spinner-border spinner-border-sm me-2" />
                {autoCreateProgress}
              </div>
            )}

            <div className="d-flex gap-3">
              <button className="btn btn-light" onClick={() => setChoice(null)} disabled={saving}>Back</button>
              <button className="btn btn-success" onClick={handleCreateNew} disabled={saving}>
                {saving ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                Create & Map All
              </button>
            </div>
          </div>
        </div>
      )}

      {choice === "existing" && (
        <div className="card border border-primary mt-4">
          <div className="card-body p-6">
            <h5 className="fw-bold mb-4">Select Existing Institute</h5>
            {loading ? (
              <div className="text-center py-4">
                <span className="spinner-border spinner-border-sm me-2" />Loading institutes...
              </div>
            ) : (
              <>
                <div className="mb-4" style={{ maxHeight: 300, overflowY: "auto" }}>
                  {institutes.map((inst: any) => (
                    <div
                      key={inst.instituteCode}
                      className="d-flex align-items-center justify-content-between p-3 border rounded mb-2 cursor-pointer"
                      style={{ cursor: "pointer" }}
                      onClick={() => !saving && handleSelectExisting(inst)}
                    >
                      <span className="fw-semibold">{inst.instituteName}</span>
                      <button className="btn btn-sm btn-primary" disabled={saving}>
                        {saving ? <span className="spinner-border spinner-border-sm" /> : "Select"}
                      </button>
                    </div>
                  ))}
                  {institutes.length === 0 && (
                    <p className="text-muted text-center py-4">No institutes found</p>
                  )}
                </div>
                <button className="btn btn-light" onClick={() => setChoice(null)}>Back</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolMappingStep;
