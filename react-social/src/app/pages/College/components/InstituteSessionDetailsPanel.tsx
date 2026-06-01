import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import {
  CreateClassData,
  CreateSectionData,
  CreateSessionData,
  DeleteClassData,
  DeleteSectionData,
  DeleteSessionData,
  GetSessionsByInstituteCode,
} from "../API/College_APIs";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";

export interface InstituteSessionDetailsPanelHandle {
  /** Resolves to true when at least one session exists for the institute. */
  save: () => Promise<boolean>;
  hasAnySession: () => boolean;
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
  const [busy, setBusy] = useState(false);

  const [sessionInput, setSessionInput] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [gradeInput, setGradeInput] = useState("");
  const [activeGradeId, setActiveGradeId] = useState<number | null>(null);
  const [sectionInput, setSectionInput] = useState("");

  const fetchExisting = async (): Promise<ExistingSession[]> => {
    if (!instituteCode) return [];
    setLoading(true);
    try {
      const res = await GetSessionsByInstituteCode(instituteCode);
      const data: ExistingSession[] = res.data || [];
      setExisting(data);
      return data;
    } catch (err) {
      console.error("Failed to load sessions", err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExisting();
    setActiveSessionId(null);
    setActiveGradeId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteCode]);

  const activeSession =
    activeSessionId !== null
      ? existing.find((s) => s.id === activeSessionId) || null
      : null;
  const activeGrade =
    activeSession && activeGradeId !== null
      ? activeSession.schoolClasses.find((g) => g.id === activeGradeId) || null
      : null;

  const handleAddSession = async () => {
    const name = sessionInput.trim();
    if (!name) return;
    if (!instituteCode) {
      showErrorToast("Institute code is missing. Save Basic Info first.");
      return;
    }
    if (existing.some((s) => s.sessionYear === name)) {
      showErrorToast("Session already exists for this institute.");
      return;
    }
    setBusy(true);
    try {
      const payload = [
        {
          id: null,
          sessionYear: name,
          schoolClasses: [],
          instituteCode: Number(instituteCode),
        },
      ];
      const res = await CreateSessionData(payload);
      const created = Array.isArray(res.data) ? res.data[0] : res.data;
      showSuccessToast("Session saved");
      setSessionInput("");
      const refreshed = await fetchExisting();
      if (created?.id) {
        setActiveSessionId(created.id);
        setActiveGradeId(null);
      } else {
        const match = refreshed.find((s) => s.sessionYear === name);
        if (match) setActiveSessionId(match.id);
      }
    } catch (err) {
      console.error("Failed to save session", err);
      showErrorToast("Failed to save session");
    } finally {
      setBusy(false);
    }
  };

  const handleAddGrade = async () => {
    if (!activeSession) return;
    const name = gradeInput.trim();
    if (!name) return;
    if (activeSession.schoolClasses.some((g) => g.className === name)) {
      showErrorToast("Class already exists for this session.");
      return;
    }
    setBusy(true);
    try {
      const res = await CreateClassData({
        className: name,
        schoolSession: { id: activeSession.id },
      });
      const created = res.data;
      showSuccessToast("Class saved");
      setGradeInput("");
      await fetchExisting();
      if (created?.id) setActiveGradeId(created.id);
    } catch (err) {
      console.error("Failed to save class", err);
      showErrorToast("Failed to save class");
    } finally {
      setBusy(false);
    }
  };

  const handleAddSection = async () => {
    if (!activeGrade) return;
    const name = sectionInput.trim();
    if (!name) return;
    if (activeGrade.schoolSections.some((s) => s.sectionName === name)) {
      showErrorToast("Section already exists for this class.");
      return;
    }
    setBusy(true);
    try {
      await CreateSectionData({
        sectionName: name,
        schoolClasses: { id: activeGrade.id },
      });
      showSuccessToast("Section saved");
      setSectionInput("");
      await fetchExisting();
    } catch (err) {
      console.error("Failed to save section", err);
      showErrorToast("Failed to save section");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSession = async (id: number) => {
    setBusy(true);
    try {
      await DeleteSessionData(id);
      showSuccessToast("Session deleted");
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setActiveGradeId(null);
      }
      await fetchExisting();
    } catch (err) {
      console.error("Failed to delete session", err);
      showErrorToast("Failed to delete session");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteGrade = async (id: number) => {
    setBusy(true);
    try {
      await DeleteClassData(id);
      showSuccessToast("Class deleted");
      if (activeGradeId === id) setActiveGradeId(null);
      await fetchExisting();
    } catch (err) {
      console.error("Failed to delete class", err);
      showErrorToast("Failed to delete class");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSection = async (id: number) => {
    setBusy(true);
    try {
      await DeleteSectionData(id);
      showSuccessToast("Section deleted");
      await fetchExisting();
    } catch (err) {
      console.error("Failed to delete section", err);
      showErrorToast("Failed to delete section");
    } finally {
      setBusy(false);
    }
  };

  useImperativeHandle(ref, () => ({
    save: async () => {
      // Everything is saved on click, so this is just a validation hook.
      return existing.length > 0;
    },
    hasAnySession: () => existing.length > 0,
  }));

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

      {/* Add — sessions */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <h6 className="fw-semibold mb-2">Add session</h6>
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
                  handleAddSession();
                }
              }}
              disabled={busy}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAddSession}
              disabled={!sessionInput.trim() || busy}
            >
              Add session
            </button>
          </div>

          {existing.length > 0 && (
            <div className="list-group">
              {existing.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                    activeSessionId === s.id ? "active" : ""
                  }`}
                  onClick={() => {
                    setActiveSessionId(s.id);
                    setActiveGradeId(null);
                  }}
                >
                  <span>
                    {s.sessionYear}{" "}
                    <span className="badge bg-secondary ms-2">
                      {s.schoolClasses.length} class
                      {s.schoolClasses.length === 1 ? "" : "es"}
                    </span>
                  </span>
                  <span
                    role="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(s.id);
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

      {/* Add — grades */}
      {activeSession && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <h6 className="fw-semibold mb-2">
              Add class to "{activeSession.sessionYear}"
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
                    handleAddGrade();
                  }
                }}
                disabled={busy}
              />
              <button
                type="button"
                className="btn btn-success"
                onClick={handleAddGrade}
                disabled={!gradeInput.trim() || busy}
              >
                Add class
              </button>
            </div>

            {activeSession.schoolClasses.length > 0 && (
              <div className="list-group">
                {activeSession.schoolClasses.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                      activeGradeId === g.id ? "active" : ""
                    }`}
                    onClick={() => setActiveGradeId(g.id)}
                  >
                    <span>
                      {g.className}{" "}
                      <span className="badge bg-secondary ms-2">
                        {g.schoolSections.length} section
                        {g.schoolSections.length === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span
                      role="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGrade(g.id);
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

      {/* Add — sections */}
      {activeSession && activeGrade && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <h6 className="fw-semibold mb-2">
              Add section to "{activeGrade.className}"
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
                    handleAddSection();
                  }
                }}
                disabled={busy}
              />
              <button
                type="button"
                className="btn btn-info"
                onClick={handleAddSection}
                disabled={!sectionInput.trim() || busy}
              >
                Add section
              </button>
            </div>

            {activeGrade.schoolSections.length > 0 && (
              <div className="d-flex flex-wrap gap-2">
                {activeGrade.schoolSections.map((sec) => (
                  <span
                    key={sec.id}
                    className="badge bg-light text-dark border d-flex align-items-center gap-2"
                    style={{ padding: "0.5rem 0.75rem" }}
                  >
                    {sec.sectionName}
                    <button
                      type="button"
                      className="btn-close btn-close-sm"
                      aria-label="Remove"
                      onClick={() => handleDeleteSection(sec.id)}
                    />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {busy && (
        <div className="text-muted small">
          <span className="spinner-border spinner-border-sm me-2" />
          Saving...
        </div>
      )}
    </div>
  );
});

InstituteSessionDetailsPanel.displayName = "InstituteSessionDetailsPanel";

export default InstituteSessionDetailsPanel;
