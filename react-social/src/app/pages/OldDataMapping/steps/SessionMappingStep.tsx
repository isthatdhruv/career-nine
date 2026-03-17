import { useEffect, useState } from "react";
import { createSession, getSessionsByInstitute, saveMapping } from "../API/OldDataMapping_APIs";

interface Props {
  session: { id: string; year: string };
  sessionIndex: number;
  totalSessions: number;
  instituteCode: number;
  schoolMappingId: number;
  onMapped: (mappingId: number, newSessionId: number, newSessionYear: string, existingSessions: any[]) => void;
}

const SessionMappingStep = ({
  session,
  sessionIndex,
  totalSessions,
  instituteCode,
  schoolMappingId,
  onMapped,
}: Props) => {
  const [choice, setChoice] = useState<"new" | "existing" | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newYear, setNewYear] = useState(session.year);

  useEffect(() => {
    if (choice === "existing") {
      setLoading(true);
      getSessionsByInstitute(instituteCode)
        .then((res) => setSessions(res.data || []))
        .catch(() => setError("Failed to load sessions"))
        .finally(() => setLoading(false));
    }
  }, [choice, instituteCode]);

  const handleCreateNew = async () => {
    if (!newYear.trim()) { setError("Session year is required"); return; }
    setSaving(true); setError("");
    try {
      const payload = [{
        sessionYear: newYear.trim(),
        instituteCode: instituteCode,
        schoolClasses: [],
      }];
      const res = await createSession(payload);
      const newSession = res.data[0];
      const mappingRes = await saveMapping({
        firebaseId: session.id,
        firebaseName: session.year,
        firebaseType: "SESSION",
        newEntityId: newSession.id,
        newEntityName: newSession.sessionYear,
        parentMappingId: schoolMappingId,
      });
      onMapped(mappingRes.data.id, newSession.id, newSession.sessionYear, []);
    } catch {
      setError("Failed to create session. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectExisting = async (sess: any) => {
    setSaving(true); setError("");
    try {
      const mappingRes = await saveMapping({
        firebaseId: session.id,
        firebaseName: session.year,
        firebaseType: "SESSION",
        newEntityId: sess.id,
        newEntityName: sess.sessionYear,
        parentMappingId: schoolMappingId,
      });
      onMapped(mappingRes.data.id, sess.id, sess.sessionYear, sess.schoolClasses || []);
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
          <span className="badge badge-light-info fs-7 mb-2">
            Session {sessionIndex + 1} of {totalSessions}
          </span>
          <h4 className="fw-bold text-dark mb-1">Map Session</h4>
        </div>
        <div className="bg-light-warning rounded px-4 py-2">
          <span className="fs-6 fw-semibold text-warning-emphasis">
            Firebase: <strong>{session.year}</strong>
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
                <h5 className="fw-bold">Create New Session</h5>
                <p className="text-muted fs-7">This session doesn't exist yet in the new system</p>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="card border border-primary border-2 h-100" style={{ cursor: "pointer" }} onClick={() => setChoice("existing")}>
              <div className="card-body p-6 text-center">
                <i className="bi bi-search fs-2x text-primary mb-3 d-block"></i>
                <h5 className="fw-bold">Map to Existing</h5>
                <p className="text-muted fs-7">This session already exists in the new system</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {choice === "new" && (
        <div className="card border border-success mt-4">
          <div className="card-body p-6">
            <h5 className="fw-bold mb-4">Create New Session</h5>
            <div className="mb-4">
              <label className="form-label fw-semibold">Session Year <span className="text-danger">*</span></label>
              <input className="form-control" value={newYear} onChange={(e) => setNewYear(e.target.value)} placeholder="e.g. 2024-25" />
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
            <h5 className="fw-bold mb-4">Select Existing Session</h5>
            {loading ? (
              <div className="text-center py-4"><span className="spinner-border spinner-border-sm me-2" />Loading sessions...</div>
            ) : (
              <>
                <div className="mb-4" style={{ maxHeight: 300, overflowY: "auto" }}>
                  {sessions.map((sess: any) => (
                    <div key={sess.id} className="d-flex align-items-center justify-content-between p-3 border rounded mb-2" style={{ cursor: "pointer" }} onClick={() => !saving && handleSelectExisting(sess)}>
                      <span className="fw-semibold">{sess.sessionYear}</span>
                      <button className="btn btn-sm btn-primary" disabled={saving}>
                        {saving ? <span className="spinner-border spinner-border-sm" /> : "Select"}
                      </button>
                    </div>
                  ))}
                  {sessions.length === 0 && <p className="text-muted text-center py-4">No sessions found</p>}
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

export default SessionMappingStep;
