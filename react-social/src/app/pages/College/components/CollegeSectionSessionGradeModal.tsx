// CollegeSectionSessionGradeModal.tsx
import React, { useState, useEffect, useMemo } from "react";
import { Modal, Button } from "react-bootstrap-v5";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import {
  CreateSessionData,
  GetSessionsByInstituteCode,
  UpdateSessionData,
  DeleteSessionData,
  UpdateClassData,
  DeleteClassData,
  UpdateSectionData,
  DeleteSectionData
} from "../API/College_APIs";

// ============ TYPE DEFINITIONS ============

type CollegeDataForModal = {
  instituteCode?: string;
  instituteName?: string;
  [key: string]: any;
};

type Props = {
  show: boolean;
  onHide: (v?: boolean) => void;
  setPageLoading: (v: any) => void;
  data?: CollegeDataForModal;
};

interface SectionData {
  id: number | null;
  sectionName: string;
  isNew?: boolean;
}

interface GradeData {
  id: number | null;
  gradeName: string;
  sections: SectionData[];
  isNew?: boolean;
}

interface SessionData {
  id: number | null;
  sessionName: string;
  grades: GradeData[];
  isNew?: boolean;
}

interface EditState {
  type: 'session' | 'grade' | 'section';
  id: number;
  sessionIndex: number;
  gradeIndex?: number;
  sectionIndex?: number;
  originalValue: string;
}

interface DeleteConfirmState {
  type: 'session' | 'grade' | 'section';
  id: number;
  name: string;
  sessionIndex: number;
  gradeIndex?: number;
  sectionIndex?: number;
}

// ============ COMPONENT ============

const CollegeSectionSessionGradeModal = (props: Props) => {
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dropdown states
  const [sessionDropdownOpen, setSessionDropdownOpen] = useState(false);
  const [gradeDropdownOpen, setGradeDropdownOpen] = useState(false);
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);

  // Existing data from backend
  const [existingData, setExistingData] = useState<SessionData[]>([]);

  // New data being added (not yet saved)
  const [newSessionsData, setNewSessionsData] = useState<SessionData[]>([]);

  // Input states
  const [newSessionInput, setNewSessionInput] = useState("");
  const [newGradeInput, setNewGradeInput] = useState("");
  const [newSectionInput, setNewSectionInput] = useState("");

  // Currently working with (for new data)
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number | null>(null);
  const [currentGradeIndex, setCurrentGradeIndex] = useState<number | null>(null);

  // Edit mode tracking
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editValue, setEditValue] = useState("");

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);

  // ============ DATA FETCHING ============

  const transformBackendToLocal = (backendData: any[]): SessionData[] => {
    return backendData.map(session => ({
      id: session.id,
      sessionName: session.sessionYear,
      grades: (session.schoolClasses || []).map((cls: any) => ({
        id: cls.id,
        gradeName: cls.className,
        sections: (cls.schoolSections || []).map((sec: any) => ({
          id: sec.id,
          sectionName: sec.sectionName,
          isNew: false
        })),
        isNew: false
      })),
      isNew: false
    }));
  };

  const fetchExistingData = async (instituteCode: string | number) => {
    if (!instituteCode) {
      console.log("No institute code provided, skipping fetch");
      return;
    }

    console.log("Fetching data for institute code:", instituteCode);
    setFetchLoading(true);
    setError(null);
    try {
      const response = await GetSessionsByInstituteCode(instituteCode);
      console.log("API Response:", response.data);
      const transformedData = transformBackendToLocal(response.data);
      console.log("Transformed Data:", transformedData);
      setExistingData(transformedData);
    } catch (err: any) {
      console.error("Error fetching existing data:", err);
      console.error("Error details:", err.response?.data || err.message);
      setError("Failed to load existing data");
    } finally {
      setFetchLoading(false);
    }
  };

  // Reset and fetch when modal opens
  useEffect(() => {
    if (props.show) {
      console.log("Modal opened with data:", props.data);

      // Reset new data states
      setNewSessionsData([]);
      setNewSessionInput("");
      setNewGradeInput("");
      setNewSectionInput("");
      setCurrentSessionIndex(null);
      setCurrentGradeIndex(null);
      setSessionDropdownOpen(false);
      setGradeDropdownOpen(false);
      setSectionDropdownOpen(false);
      setEditState(null);
      setDeleteConfirm(null);
      setError(null);
      setExistingData([]);

      // Fetch existing data if institute code exists
      const instituteCode = props.data?.instituteCode;
      if (instituteCode && instituteCode !== "") {
        fetchExistingData(instituteCode);
      } else {
        console.log("No valid institute code in props.data:", props.data);
      }
    }
  }, [props.show, props.data?.instituteCode]);

  // ============ ADD HANDLERS (for new data) ============

  const handleAddSession = () => {
    if (newSessionInput.trim()) {
      const sessionExists = newSessionsData.some(s => s.sessionName === newSessionInput.trim());
      if (!sessionExists) {
        setNewSessionsData([...newSessionsData, {
          id: null,
          sessionName: newSessionInput.trim(),
          grades: [],
          isNew: true
        }]);
        setNewSessionInput("");
      }
    }
  };

  const handleSelectSession = (index: number) => {
    setCurrentSessionIndex(index);
    setCurrentGradeIndex(null);
    setSessionDropdownOpen(false);
  };

  const handleAddGrade = () => {
    if (currentSessionIndex !== null && newGradeInput.trim()) {
      const updatedSessions = [...newSessionsData];
      const currentSession = updatedSessions[currentSessionIndex];

      const gradeExists = currentSession.grades.some(g => g.gradeName === newGradeInput.trim());
      if (!gradeExists) {
        currentSession.grades.push({
          id: null,
          gradeName: newGradeInput.trim(),
          sections: [],
          isNew: true
        });
        setNewSessionsData(updatedSessions);
        setNewGradeInput("");
      }
    }
  };

  const handleSelectGrade = (gradeIndex: number) => {
    setCurrentGradeIndex(gradeIndex);
    setGradeDropdownOpen(false);
  };

  const handleAddSection = () => {
    if (currentSessionIndex !== null && currentGradeIndex !== null && newSectionInput.trim()) {
      const updatedSessions = [...newSessionsData];
      const currentGrade = updatedSessions[currentSessionIndex].grades[currentGradeIndex];

      const sectionExists = currentGrade.sections.some(s => s.sectionName === newSectionInput.trim());
      if (!sectionExists) {
        currentGrade.sections.push({
          id: null,
          sectionName: newSectionInput.trim(),
          isNew: true
        });
        setNewSessionsData(updatedSessions);
        setNewSectionInput("");
      }
    }
  };

  const handleRemoveNewSection = (sectionIndex: number) => {
    if (currentSessionIndex !== null && currentGradeIndex !== null) {
      const updatedSessions = [...newSessionsData];
      updatedSessions[currentSessionIndex].grades[currentGradeIndex].sections.splice(sectionIndex, 1);
      setNewSessionsData(updatedSessions);
    }
  };

  // ============ EDIT HANDLERS (for existing data) ============

  const handleStartEdit = (
    type: 'session' | 'grade' | 'section',
    id: number,
    sessionIndex: number,
    currentValue: string,
    gradeIndex?: number,
    sectionIndex?: number
  ) => {
    setEditState({
      type,
      id,
      sessionIndex,
      gradeIndex,
      sectionIndex,
      originalValue: currentValue
    });
    setEditValue(currentValue);
  };

  const handleCancelEdit = () => {
    setEditState(null);
    setEditValue("");
  };

  const handleSaveEdit = async () => {
    if (!editState || !editValue.trim()) return;

    // Optimistic update
    const updatedData = [...existingData];
    const session = updatedData[editState.sessionIndex];

    if (editState.type === 'session') {
      session.sessionName = editValue.trim();
    } else if (editState.type === 'grade' && editState.gradeIndex !== undefined) {
      session.grades[editState.gradeIndex].gradeName = editValue.trim();
    } else if (editState.type === 'section' && editState.gradeIndex !== undefined && editState.sectionIndex !== undefined) {
      session.grades[editState.gradeIndex].sections[editState.sectionIndex].sectionName = editValue.trim();
    }

    setExistingData(updatedData);
    setEditState(null);
    setEditValue("");

    try {
      if (editState.type === 'session') {
        await UpdateSessionData(editState.id, { sessionYear: editValue.trim() });
      } else if (editState.type === 'grade') {
        await UpdateClassData(editState.id, { className: editValue.trim() });
      } else if (editState.type === 'section') {
        await UpdateSectionData(editState.id, { sectionName: editValue.trim() });
      }
    } catch (err) {
      console.error("Error updating:", err);
      // Rollback on error
      const rollbackData = [...existingData];
      const rollbackSession = rollbackData[editState.sessionIndex];

      if (editState.type === 'session') {
        rollbackSession.sessionName = editState.originalValue;
      } else if (editState.type === 'grade' && editState.gradeIndex !== undefined) {
        rollbackSession.grades[editState.gradeIndex].gradeName = editState.originalValue;
      } else if (editState.type === 'section' && editState.gradeIndex !== undefined && editState.sectionIndex !== undefined) {
        rollbackSession.grades[editState.gradeIndex].sections[editState.sectionIndex].sectionName = editState.originalValue;
      }

      setExistingData(rollbackData);
      setError("Failed to update. Please try again.");
    }
  };

  // ============ DELETE HANDLERS ============

  const handleDeleteConfirm = (
    type: 'session' | 'grade' | 'section',
    id: number,
    name: string,
    sessionIndex: number,
    gradeIndex?: number,
    sectionIndex?: number
  ) => {
    setDeleteConfirm({ type, id, name, sessionIndex, gradeIndex, sectionIndex });
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirm) return;

    setLoading(true);
    try {
      if (deleteConfirm.type === 'session') {
        await DeleteSessionData(deleteConfirm.id);
      } else if (deleteConfirm.type === 'grade') {
        await DeleteClassData(deleteConfirm.id);
      } else if (deleteConfirm.type === 'section') {
        await DeleteSectionData(deleteConfirm.id);
      }

      // Refresh data after delete
      if (props.data?.instituteCode) {
        await fetchExistingData(props.data.instituteCode);
      }
    } catch (err) {
      console.error("Error deleting:", err);
      setError("Failed to delete. Please try again.");
    } finally {
      setLoading(false);
      setDeleteConfirm(null);
    }
  };

  // ============ SUBMIT NEW DATA ============

  const handleSubmitNew = async () => {
    if (newSessionsData.length === 0) return;

    setLoading(true);

    const formattedOutput = newSessionsData.map((session) => ({
      id: null,
      sessionYear: session.sessionName,
      schoolClasses: session.grades.map((grade) => ({
        id: null,
        className: grade.gradeName,
        schoolSections: grade.sections.map((section) => ({
          id: null,
          sectionName: section.sectionName
        }))
      })),
      instituteCode: props.data?.instituteCode || null
    }));

    try {
      await CreateSessionData(formattedOutput);
      alert('New sessions submitted successfully!');
      setNewSessionsData([]);
      setCurrentSessionIndex(null);
      setCurrentGradeIndex(null);
      if (props.data?.instituteCode) {
        await fetchExistingData(props.data.instituteCode);
      }
    } catch (error) {
      console.error("Error in CreateSessionData:", error);
      alert('Error submitting. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ============ HELPER FUNCTIONS ============

  const getCurrentSessionName = () => {
    if (currentSessionIndex !== null) {
      return newSessionsData[currentSessionIndex]?.sessionName;
    }
    return null;
  };

  const getCurrentGradeName = () => {
    if (currentSessionIndex !== null && currentGradeIndex !== null) {
      return newSessionsData[currentSessionIndex]?.grades[currentGradeIndex]?.gradeName;
    }
    return null;
  };

  const getCurrentSections = () => {
    if (currentSessionIndex !== null && currentGradeIndex !== null) {
      return newSessionsData[currentSessionIndex]?.grades[currentGradeIndex]?.sections || [];
    }
    return [];
  };

  // Flatten existing data for table display
  const tableRows = useMemo(() => {
    const rows: any[] = [];
    existingData.forEach((session, sIdx) => {
      if (session.grades.length === 0) {
        rows.push({
          sessionId: session.id,
          sessionName: session.sessionName,
          sessionIndex: sIdx,
          gradeId: null,
          gradeName: '-',
          gradeIndex: null,
          sectionId: null,
          sectionName: '-',
          sectionIndex: null
        });
      } else {
        session.grades.forEach((grade, gIdx) => {
          if (grade.sections.length === 0) {
            rows.push({
              sessionId: session.id,
              sessionName: session.sessionName,
              sessionIndex: sIdx,
              gradeId: grade.id,
              gradeName: grade.gradeName,
              gradeIndex: gIdx,
              sectionId: null,
              sectionName: '-',
              sectionIndex: null
            });
          } else {
            grade.sections.forEach((section, secIdx) => {
              rows.push({
                sessionId: session.id,
                sessionName: session.sessionName,
                sessionIndex: sIdx,
                gradeId: grade.id,
                gradeName: grade.gradeName,
                gradeIndex: gIdx,
                sectionId: section.id,
                sectionName: section.sectionName,
                sectionIndex: secIdx
              });
            });
          }
        });
      }
    });
    return rows;
  }, [existingData]);

  // ============ RENDER ============

  return (
    <>
      <Modal
        show={props.show}
        onHide={() => props.onHide()}
        centered
        size="xl"
        className="college-modal"
        aria-labelledby="college-detail-modal-title"
        style={{ maxHeight: '90vh' }}
      >
        <style>{`
          .college-modal .modal-dialog {
            max-width: 1200px;
            height: 85vh;
          }

          .college-modal .modal-content {
            height: 100%;
            display: flex;
            flex-direction: column;
          }

          .college-modal .modal-body {
            flex: 1;
            overflow-y: auto;
            max-height: calc(85vh - 180px);
          }

          .college-modal .dropdown-menu {
            max-height: 300px;
          }

          .editable-cell:hover {
            background-color: #f8f9fa;
            cursor: pointer;
          }
        `}</style>

        <Modal.Header className="border-0 pb-0">
          <div className="d-flex flex-column">
            <h3 id="college-detail-modal-title" className="mb-1 fw-bold">
              Institute Details
            </h3>
            <span className="text-muted small">
              {props.data?.instituteName && (
                <span className="fw-semibold me-2">{props.data.instituteName}</span>
              )}
              Manage sessions, grades, and sections
            </span>
          </div>

          <div
            className="btn btn-sm btn-icon btn-light ms-3"
            onClick={() => props.onHide()}
            style={{ cursor: "pointer" }}
          >
            <UseAnimations animation={menu2} size={24} strokeColor={"#181C32"} reverse />
          </div>
        </Modal.Header>

        <div className="form w-100">
          <Modal.Body className="pt-3">
            {error && (
              <div className="alert alert-danger alert-dismissible mb-3">
                {error}
                <button type="button" className="btn-close" onClick={() => setError(null)}></button>
              </div>
            )}

            {/* ====== QUICK ACTIONS - HORIZONTAL LAYOUT ====== */}
            <div className="card shadow-sm border-0 mb-4" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
              <div className="card-body">
                <div className="mb-3">
                  <h5 className="mb-1 fw-semibold">Add New Items</h5>
                  <small className="text-muted">
                    Add new sessions, grades, and sections for this institute
                  </small>
                </div>

                {/* Horizontal row of dropdowns */}
                <div className="d-flex gap-3 flex-wrap">
                  {/* Session Dropdown */}
                  <div className="flex-fill position-relative" style={{ minWidth: '200px' }}>
                    <button
                      type="button"
                      className="btn btn-primary dropdown-toggle d-flex align-items-center justify-content-between gap-2 w-100"
                      onClick={() => {
                        setSessionDropdownOpen(!sessionDropdownOpen);
                        setGradeDropdownOpen(false);
                        setSectionDropdownOpen(false);
                      }}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-calendar-plus"></i>
                        <span>{getCurrentSessionName() || "Session"}</span>
                      </div>
                    </button>
                    {sessionDropdownOpen && (
                      <div
                        className="dropdown-menu show w-100 p-3 shadow-lg"
                        style={{ minWidth: '100%', maxHeight: '300px', overflowY: 'auto', position: 'absolute', zIndex: 1000 }}
                      >
                        <div className="mb-3">
                          <label className="form-label small fw-semibold">Add New Session</label>
                          <div className="input-group">
                            <input
                              type="text"
                              className="form-control"
                              placeholder="e.g., 2024-25"
                              value={newSessionInput}
                              onChange={(e) => setNewSessionInput(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddSession();
                                  e.preventDefault();
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={handleAddSession}
                              disabled={!newSessionInput.trim()}
                            >
                              <i className="bi bi-plus-lg"></i>
                            </button>
                          </div>
                        </div>

                        {newSessionsData.length > 0 && (
                          <>
                            <div className="dropdown-divider"></div>
                            <label className="form-label small fw-semibold">New Sessions</label>
                            <div className="list-group">
                              {newSessionsData.map((session, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  className={`list-group-item list-group-item-action ${currentSessionIndex === index ? 'active' : ''}`}
                                  onClick={() => handleSelectSession(index)}
                                >
                                  <div className="d-flex justify-content-between align-items-center">
                                    <span>{session.sessionName}</span>
                                    <span className="badge bg-secondary">{session.grades.length} grades</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Grade Dropdown */}
                  <div className="flex-fill position-relative" style={{ minWidth: '200px' }}>
                    <button
                      type="button"
                      className="btn btn-success dropdown-toggle d-flex align-items-center justify-content-between gap-2 w-100"
                      onClick={() => {
                        if (currentSessionIndex !== null) {
                          setGradeDropdownOpen(!gradeDropdownOpen);
                          setSessionDropdownOpen(false);
                          setSectionDropdownOpen(false);
                        }
                      }}
                      disabled={currentSessionIndex === null}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-award"></i>
                        <span>{getCurrentGradeName() || "Grade"}</span>
                        {currentSessionIndex === null && <small className="ms-1 text-light">(select session)</small>}
                      </div>
                    </button>
                    {gradeDropdownOpen && currentSessionIndex !== null && (
                      <div
                        className="dropdown-menu show w-100 p-3 shadow-lg"
                        style={{ minWidth: '100%', maxHeight: '300px', overflowY: 'auto', position: 'absolute', zIndex: 1000 }}
                      >
                        <div className="mb-3">
                          <label className="form-label small fw-semibold">
                            Add Grade to "{getCurrentSessionName()}"
                          </label>
                          <div className="input-group">
                            <input
                              type="text"
                              className="form-control"
                              placeholder="e.g., Class 9"
                              value={newGradeInput}
                              onChange={(e) => setNewGradeInput(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddGrade();
                                  e.preventDefault();
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-success"
                              onClick={handleAddGrade}
                              disabled={!newGradeInput.trim()}
                            >
                              <i className="bi bi-plus-lg"></i>
                            </button>
                          </div>
                        </div>

                        {newSessionsData[currentSessionIndex]?.grades.length > 0 && (
                          <>
                            <div className="dropdown-divider"></div>
                            <label className="form-label small fw-semibold">Grades</label>
                            <div className="list-group">
                              {newSessionsData[currentSessionIndex].grades.map((grade, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  className={`list-group-item list-group-item-action ${currentGradeIndex === index ? 'active' : ''}`}
                                  onClick={() => handleSelectGrade(index)}
                                >
                                  <div className="d-flex justify-content-between align-items-center">
                                    <span>{grade.gradeName}</span>
                                    <span className="badge bg-secondary">{grade.sections.length} sections</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Section Dropdown */}
                  <div className="flex-fill position-relative" style={{ minWidth: '200px' }}>
                    <button
                      type="button"
                      className="btn btn-info dropdown-toggle d-flex align-items-center justify-content-between gap-2 w-100"
                      onClick={() => {
                        if (currentGradeIndex !== null) {
                          setSectionDropdownOpen(!sectionDropdownOpen);
                          setSessionDropdownOpen(false);
                          setGradeDropdownOpen(false);
                        }
                      }}
                      disabled={currentGradeIndex === null}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-grid-3x3"></i>
                        <span>Section ({getCurrentSections().length})</span>
                        {currentGradeIndex === null && <small className="ms-1 text-light">(select grade)</small>}
                      </div>
                    </button>
                    {sectionDropdownOpen && currentGradeIndex !== null && (
                      <div
                        className="dropdown-menu show w-100 p-3 shadow-lg"
                        style={{ minWidth: '100%', maxHeight: '300px', overflowY: 'auto', position: 'absolute', zIndex: 1000 }}
                      >
                        <div className="mb-3">
                          <label className="form-label small fw-semibold">
                            Add Section to "{getCurrentGradeName()}"
                          </label>
                          <div className="input-group">
                            <input
                              type="text"
                              className="form-control"
                              placeholder="e.g., A, B, C"
                              value={newSectionInput}
                              onChange={(e) => setNewSectionInput(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddSection();
                                  e.preventDefault();
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-info"
                              onClick={handleAddSection}
                              disabled={!newSectionInput.trim()}
                            >
                              <i className="bi bi-plus-lg"></i>
                            </button>
                          </div>
                        </div>

                        {getCurrentSections().length > 0 && (
                          <>
                            <div className="dropdown-divider"></div>
                            <label className="form-label small fw-semibold">Sections</label>
                            <div className="list-group">
                              {getCurrentSections().map((section, index) => (
                                <div
                                  key={index}
                                  className="list-group-item d-flex justify-content-between align-items-center"
                                >
                                  <span>{section.sectionName}</span>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleRemoveNewSection(index)}
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* New Items Summary */}
                {newSessionsData.length > 0 && (
                  <div className="mt-3 p-3 bg-white rounded border">
                    <h6 className="mb-2 fw-semibold d-flex align-items-center gap-2">
                      <i className="bi bi-plus-circle text-success"></i>
                      New Items to Submit
                    </h6>
                    <div className="d-flex flex-wrap gap-2">
                      {newSessionsData.map((session, idx) => (
                        <span key={idx} className="badge bg-primary px-2 py-1">
                          {session.sessionName} ({session.grades.length} grades)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ====== EXISTING DATA TABLE ====== */}
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h5 className="mb-1 fw-semibold">Existing Data</h5>
                    <small className="text-muted">
                      Click on any cell to edit. Changes are saved immediately.
                    </small>
                  </div>
                  {fetchLoading && (
                    <div className="spinner-border spinner-border-sm text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  )}
                </div>

                {tableRows.length === 0 && !fetchLoading ? (
                  <div className="text-center text-muted py-5">
                    <i className="bi bi-inbox" style={{ fontSize: '3rem' }}></i>
                    <p className="mt-2 mb-0">No existing data for this institute</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-bordered table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: '25%' }}>Session</th>
                          <th style={{ width: '25%' }}>Grade/Class</th>
                          <th style={{ width: '25%' }}>Section</th>
                          <th style={{ width: '25%' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row, idx) => (
                          <tr key={idx}>
                            {/* Session Cell */}
                            <td className="editable-cell">
                              {editState?.type === 'session' && editState.sessionIndex === row.sessionIndex ? (
                                <div className="d-flex gap-1">
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') handleSaveEdit();
                                      if (e.key === 'Escape') handleCancelEdit();
                                    }}
                                    autoFocus
                                  />
                                  <button className="btn btn-sm btn-success" onClick={handleSaveEdit}>
                                    <i className="bi bi-check"></i>
                                  </button>
                                  <button className="btn btn-sm btn-secondary" onClick={handleCancelEdit}>
                                    <i className="bi bi-x"></i>
                                  </button>
                                </div>
                              ) : (
                                <span
                                  onClick={() => row.sessionId && handleStartEdit('session', row.sessionId, row.sessionIndex, row.sessionName)}
                                  title="Click to edit"
                                >
                                  {row.sessionName}
                                </span>
                              )}
                            </td>

                            {/* Grade Cell */}
                            <td className="editable-cell">
                              {editState?.type === 'grade' && editState.sessionIndex === row.sessionIndex && editState.gradeIndex === row.gradeIndex ? (
                                <div className="d-flex gap-1">
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') handleSaveEdit();
                                      if (e.key === 'Escape') handleCancelEdit();
                                    }}
                                    autoFocus
                                  />
                                  <button className="btn btn-sm btn-success" onClick={handleSaveEdit}>
                                    <i className="bi bi-check"></i>
                                  </button>
                                  <button className="btn btn-sm btn-secondary" onClick={handleCancelEdit}>
                                    <i className="bi bi-x"></i>
                                  </button>
                                </div>
                              ) : (
                                <span
                                  onClick={() => row.gradeId && handleStartEdit('grade', row.gradeId, row.sessionIndex, row.gradeName, row.gradeIndex)}
                                  title={row.gradeId ? "Click to edit" : ""}
                                  style={{ color: row.gradeId ? 'inherit' : '#6c757d' }}
                                >
                                  {row.gradeName}
                                </span>
                              )}
                            </td>

                            {/* Section Cell */}
                            <td className="editable-cell">
                              {editState?.type === 'section' && editState.sessionIndex === row.sessionIndex && editState.gradeIndex === row.gradeIndex && editState.sectionIndex === row.sectionIndex ? (
                                <div className="d-flex gap-1">
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') handleSaveEdit();
                                      if (e.key === 'Escape') handleCancelEdit();
                                    }}
                                    autoFocus
                                  />
                                  <button className="btn btn-sm btn-success" onClick={handleSaveEdit}>
                                    <i className="bi bi-check"></i>
                                  </button>
                                  <button className="btn btn-sm btn-secondary" onClick={handleCancelEdit}>
                                    <i className="bi bi-x"></i>
                                  </button>
                                </div>
                              ) : (
                                <span
                                  onClick={() => row.sectionId && handleStartEdit('section', row.sectionId, row.sessionIndex, row.sectionName, row.gradeIndex, row.sectionIndex)}
                                  title={row.sectionId ? "Click to edit" : ""}
                                  style={{ color: row.sectionId ? 'inherit' : '#6c757d' }}
                                >
                                  {row.sectionName}
                                </span>
                              )}
                            </td>

                            {/* Actions Cell */}
                            <td>
                              <div className="d-flex gap-1">
                                {row.sectionId && (
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => handleDeleteConfirm('section', row.sectionId, row.sectionName, row.sessionIndex, row.gradeIndex, row.sectionIndex)}
                                    title="Delete section"
                                  >
                                    <i className="bi bi-trash"></i> Section
                                  </button>
                                )}
                                {row.gradeId && !row.sectionId && (
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => handleDeleteConfirm('grade', row.gradeId, row.gradeName, row.sessionIndex, row.gradeIndex)}
                                    title="Delete grade"
                                  >
                                    <i className="bi bi-trash"></i> Grade
                                  </button>
                                )}
                                {row.sessionId && !row.gradeId && (
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => handleDeleteConfirm('session', row.sessionId, row.sessionName, row.sessionIndex)}
                                    title="Delete session"
                                  >
                                    <i className="bi bi-trash"></i> Session
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </Modal.Body>

          <Modal.Footer className="border-0 pt-0">
            <div className="d-flex justify-content-between w-100 align-items-center">
              <div className="text-muted small">
                {props.data?.instituteCode && (
                  <>
                    <span className="fw-semibold">Institute Code: </span>
                    <span>{props.data.instituteCode}</span>
                  </>
                )}
              </div>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-light"
                  onClick={() => props.onHide()}
                  disabled={loading}
                >
                  Close
                </button>

                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleSubmitNew}
                  disabled={loading || newSessionsData.length === 0}
                >
                  {!loading && (
                    <span className="d-flex align-items-center gap-1">
                      <i className="bi bi-check-circle"></i>
                      Submit New ({newSessionsData.length})
                    </span>
                  )}
                  {loading && (
                    <span className="d-flex align-items-center gap-2">
                      <span className="spinner-border spinner-border-sm" />
                      Submitting...
                    </span>
                  )}
                </button>
              </div>
            </div>
          </Modal.Footer>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={deleteConfirm !== null} onHide={() => setDeleteConfirm(null)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title className="h5">Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">Are you sure you want to delete this {deleteConfirm?.type}?</p>
          <p className="fw-bold text-danger mb-2">"{deleteConfirm?.name}"</p>
          {deleteConfirm?.type === 'session' && (
            <p className="text-warning small mb-0">
              <i className="bi bi-exclamation-triangle me-1"></i>
              This will also delete all grades and sections within this session.
            </p>
          )}
          {deleteConfirm?.type === 'grade' && (
            <p className="text-warning small mb-0">
              <i className="bi bi-exclamation-triangle me-1"></i>
              This will also delete all sections within this grade.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleDeleteConfirmed} disabled={loading}>
            {loading ? (
              <span className="d-flex align-items-center gap-1">
                <span className="spinner-border spinner-border-sm" />
                Deleting...
              </span>
            ) : (
              "Delete"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default CollegeSectionSessionGradeModal;
