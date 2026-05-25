import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import {
  CreateSessionData,
  GetSessionsByInstituteCode,
} from "../API/College_APIs";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";

export interface InstituteSessionDetailsPanelHandle {
  /** Persist any unsaved new sessions/grades/sections.
   *  Resolves to true when at least one session exists for the institute
   *  (either pre-existing or newly created). */
  save: () => Promise<boolean>;
  hasAnySession: () => boolean;
}

interface NewSection {
  sectionName: string;
}
interface NewGrade {
  gradeName: string;
  sections: NewSection[];
}
interface NewSession {
  sessionName: string;
  grades: NewGrade[];
}

interface ExistingSection {
  id: number;
  sectionName: string;
}
interface ExistingGrade {
  id: number;
  className: string;
  schoolSections: ExistingSection[];
}
interface ExistingSession {
  id: number;
  sessionYear: string;
  schoolClasses: ExistingGrade[];
}

interface Props {
  instituteCode: string | number;
}

const InstituteSessionDetailsPanel = forwardRef<
  InstituteSessionDetailsPanelHandle,
  Props
>(({ instituteCode }, ref) => {
  const [existing, setExisting] = useState<ExistingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newSessions, setNewSessions] = useState<NewSession[]>([]);
  const [sessionInput, setSessionInput] = useState("");
  const [activeSessionIdx, setActiveSessionIdx] = useState<number | null>(null);
  const [gradeInput, setGradeInput] = useState("");
  const [activeGradeIdx, setActiveGradeIdx] = useState<number | null>(null);
  const [sectionInput, setSectionInput] = useState("");

  const fetchExisting = async () => {
    if (!instituteCode) return;
    setLoading(true);
    try {
      const res = await GetSessionsByInstituteCode(instituteCode);
      setExisting(res.data || []);
    } catch (err) {
      console.error("Failed to load sessions", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteCode]);

  const addSession = () => {
    const name = sessionInput.trim();
    if (!name) return;
    if (newSessions.some((s) => s.sessionName === name)) return;
    setNewSessions([...newSessions, { sessionName: name, grades: [] }]);
    setSessionInput("");
  };

  const addGrade = () => {
    if (activeSessionIdx === null) return;
    const name = gradeInput.trim();
    if (!name) return;
    const updated = [...newSessions];
    if (updated[activeSessionIdx].grades.some((g) => g.gradeName === name)) return;
    updated[activeSessionIdx].grades.push({ gradeName: name, sections: [] });
    setNewSessions(updated);
    setGradeInput("");
  };

  const addSection = () => {
    if (activeSessionIdx === null || activeGradeIdx === null) return;
    const name = sectionInput.trim();
    if (!name) return;
    const updated = [...newSessions];
    const grade = updated[activeSessionIdx].grades[activeGradeIdx];
    if (grade.sections.some((s) => s.sectionName === name)) return;
    grade.sections.push({ sectionName: name });
    setNewSessions(updated);
    setSectionInput("");
  };

  const removeNewSession = (idx: number) => {
    setNewSessions(newSessions.filter((_, i) => i !== idx));
    if (activeSessionIdx === idx) {
      setActiveSessionIdx(null);
      setActiveGradeIdx(null);
    }
  };

  const removeNewGrade = (sIdx: number, gIdx: number) => {
    const updated = [...newSessions];
    updated[sIdx].grades.splice(gIdx, 1);
    setNewSessions(updated);
    if (activeSessionIdx === sIdx && activeGradeIdx === gIdx) setActiveGradeIdx(null);
  };

  const removeNewSection = (sIdx: number, gIdx: number, secIdx: number) => {
    const updated = [...newSessions];
    updated[sIdx].grades[gIdx].sections.splice(secIdx, 1);
    setNewSessions(updated);
  };

  useImperativeHandle(ref, () => ({
    save: async () => {
      if (newSessions.length === 0) {
        // Nothing new to save — succeed only if institute already has data.
        return existing.length > 0;
      }
      setSaving(true);
      try {
        const payload = newSessions.map((s) => ({
          id: null,
          sessionYear: s.sessionName,
          schoolClasses: s.grades.map((g) => ({
            id: null,
            className: g.gradeName,
            schoolSections: g.sections.map((sec) => ({
              id: null,
              sectionName: sec.sectionName,
            })),
          })),
          instituteCode: instituteCode || null,
        }));
        await CreateSessionData(payload);
        showSuccessToast("Session details saved");
        setNewSessions([]);
        setActiveSessionIdx(null);
        setActiveGradeIdx(null);
        await fetchExisting();
        return true;
      } catch (err) {
        console.error("Failed to save session details", err);
        showErrorToast("Failed to save session details");
        return false;
      } finally {
        setSaving(false);
      }
    },
    hasAnySession: () => existing.length > 0 || newSessions.length > 0,
  }));

  const activeSession =
    activeSessionIdx !== null ? newSessions[activeSessionIdx] : null;
  const activeGrade =
    activeSession && activeGradeIdx !== null
      ? activeSession.grades[activeGradeIdx]
      : null;

  return (
    <div>
      {/* Existing data summary */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="mb-0 fw-semibold">Existing sessions</h6>
            {loading && (
              <span className="spinner-border spinner-border-sm text-primary" />
            )}
          </div>
          {existing.length === 0 && !loading ? (
            <p className="text-muted small mb-0">
              No sessions have been added yet for this institute.
            </p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-bordered mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Session</th>
                    <th>Class</th>
                    <th>Section</th>
                  </tr>
                </thead>
                <tbody>
                  {existing.flatMap((s) =>
                    s.schoolClasses.length === 0
                      ? [
                          <tr key={`s-${s.id}`}>
                            <td>{s.sessionYear}</td>
                            <td className="text-muted">—</td>
                            <td className="text-muted">—</td>
                          </tr>,
                        ]
                      : s.schoolClasses.flatMap((c) =>
                          c.schoolSections.length === 0
                            ? [
                                <tr key={`c-${c.id}`}>
                                  <td>{s.sessionYear}</td>
                                  <td>{c.className}</td>
                                  <td className="text-muted">—</td>
                                </tr>,
                              ]
                            : c.schoolSections.map((sec) => (
                                <tr key={`sec-${sec.id}`}>
                                  <td>{s.sessionYear}</td>
                                  <td>{c.className}</td>
                                  <td>{sec.sectionName}</td>
                                </tr>
                              ))
                        )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add new — sessions */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <h6 className="fw-semibold mb-2">Add new session(s)</h6>
          <div className="input-group mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="e.g., 2025-26"
              value={sessionInput}
              onChange={(e) => setSessionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSession();
                }
              }}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={addSession}
              disabled={!sessionInput.trim()}
            >
              Add session
            </button>
          </div>

          {newSessions.length > 0 && (
            <div className="list-group">
              {newSessions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                    activeSessionIdx === i ? "active" : ""
                  }`}
                  onClick={() => {
                    setActiveSessionIdx(i);
                    setActiveGradeIdx(null);
                  }}
                >
                  <span>
                    {s.sessionName}{" "}
                    <span className="badge bg-secondary ms-2">
                      {s.grades.length} class{s.grades.length === 1 ? "" : "es"}
                    </span>
                  </span>
                  <span
                    role="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNewSession(i);
                    }}
                  >
                    Remove
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add new — grades */}
      {activeSession && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <h6 className="fw-semibold mb-2">
              Add class to "{activeSession.sessionName}"
            </h6>
            <div className="input-group mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="e.g., Class 9"
                value={gradeInput}
                onChange={(e) => setGradeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addGrade();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-success"
                onClick={addGrade}
                disabled={!gradeInput.trim()}
              >
                Add class
              </button>
            </div>

            {activeSession.grades.length > 0 && (
              <div className="list-group">
                {activeSession.grades.map((g, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                      activeGradeIdx === i ? "active" : ""
                    }`}
                    onClick={() => setActiveGradeIdx(i)}
                  >
                    <span>
                      {g.gradeName}{" "}
                      <span className="badge bg-secondary ms-2">
                        {g.sections.length} section
                        {g.sections.length === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span
                      role="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNewGrade(activeSessionIdx!, i);
                      }}
                    >
                      Remove
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add new — sections */}
      {activeSession && activeGrade && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <h6 className="fw-semibold mb-2">
              Add section to "{activeGrade.gradeName}"
            </h6>
            <div className="input-group mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="e.g., A"
                value={sectionInput}
                onChange={(e) => setSectionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSection();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-info"
                onClick={addSection}
                disabled={!sectionInput.trim()}
              >
                Add section
              </button>
            </div>

            {activeGrade.sections.length > 0 && (
              <div className="d-flex flex-wrap gap-2">
                {activeGrade.sections.map((sec, i) => (
                  <span
                    key={i}
                    className="badge bg-light text-dark border d-flex align-items-center gap-2"
                    style={{ padding: "0.5rem 0.75rem" }}
                  >
                    {sec.sectionName}
                    <button
                      type="button"
                      className="btn-close btn-close-sm"
                      aria-label="Remove"
                      onClick={() =>
                        removeNewSection(activeSessionIdx!, activeGradeIdx!, i)
                      }
                    />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {saving && (
        <div className="text-muted small">
          <span className="spinner-border spinner-border-sm me-2" />
          Saving session details...
        </div>
      )}
    </div>
  );
});

InstituteSessionDetailsPanel.displayName = "InstituteSessionDetailsPanel";

export default InstituteSessionDetailsPanel;
