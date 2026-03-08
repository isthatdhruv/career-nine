// CollegeSectionSessionGradeModal.tsx
import React, { useState, useEffect, useMemo } from "react";
import { Modal, Button } from "react-bootstrap-v5";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import {
  CreateSessionData,
  CreateClassData,
  CreateSectionData,
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

  // Track whether selection is from existing or new data
  const [selectionSource, setSelectionSource] = useState<'new' | 'existing' | null>(null);
  const [existingSessionIdx, setExistingSessionIdx] = useState<number | null>(null);
  const [existingGradeIdx, setExistingGradeIdx] = useState<number | null>(null);

  // Edit mode tracking
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editValue, setEditValue] = useState("");

  // Inline edit in dropdowns (existing items saved to backend)
  const [dropdownEdit, setDropdownEdit] = useState<{ type: 'session' | 'grade' | 'section'; index: number; id: number; value: string } | null>(null);

  // Inline edit for new (unsaved) items in dropdowns
  const [newItemEdit, setNewItemEdit] = useState<{ type: 'session' | 'grade' | 'section'; index: number; value: string } | null>(null);

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
      setSelectionSource(null);
      setExistingSessionIdx(null);
      setExistingGradeIdx(null);
      setEditState(null);
      setDropdownEdit(null);
      setNewItemEdit(null);
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
    setSelectionSource('new');
    setCurrentSessionIndex(index);
    setCurrentGradeIndex(null);
    setExistingSessionIdx(null);
    setExistingGradeIdx(null);
    setSessionDropdownOpen(false);
  };

  const handleSelectExistingSession = (index: number) => {
    setSelectionSource('existing');
    setExistingSessionIdx(index);
    setExistingGradeIdx(null);
    setCurrentSessionIndex(null);
    setCurrentGradeIndex(null);
    setSessionDropdownOpen(false);
  };

  const handleAddGrade = async () => {
    if (!newGradeInput.trim()) return;

    if (selectionSource === 'existing' && existingSessionIdx !== null) {
      // Add grade to existing session via API
      const session = existingData[existingSessionIdx];
      const gradeExists = session.grades.some(g => g.gradeName === newGradeInput.trim());
      if (gradeExists) return;

      setLoading(true);
      try {
        await CreateClassData({ className: newGradeInput.trim(), schoolSession: { id: session.id } });
        setNewGradeInput("");
        if (props.data?.instituteCode) await fetchExistingData(props.data.instituteCode);
      } catch (err) {
        console.error("Error creating class:", err);
        setError("Failed to add grade. Please try again.");
      } finally {
        setLoading(false);
      }
    } else if (selectionSource === 'new' && currentSessionIndex !== null) {
      const updatedSessions = [...newSessionsData];
      const currentSession = updatedSessions[currentSessionIndex];
      const gradeExists = currentSession.grades.some(g => g.gradeName === newGradeInput.trim());
      if (!gradeExists) {
        currentSession.grades.push({ id: null, gradeName: newGradeInput.trim(), sections: [], isNew: true });
        setNewSessionsData(updatedSessions);
        setNewGradeInput("");
      }
    }
  };

  const handleSelectGrade = (gradeIndex: number) => {
    if (selectionSource === 'existing') {
      setExistingGradeIdx(gradeIndex);
    } else {
      setCurrentGradeIndex(gradeIndex);
    }
    setGradeDropdownOpen(false);
  };

  const handleAddSection = async () => {
    if (!newSectionInput.trim()) return;

    if (selectionSource === 'existing' && existingSessionIdx !== null && existingGradeIdx !== null) {
      // Add section to existing grade via API
      const grade = existingData[existingSessionIdx].grades[existingGradeIdx];
      const sectionExists = grade.sections.some(s => s.sectionName === newSectionInput.trim());
      if (sectionExists) return;

      setLoading(true);
      try {
        await CreateSectionData({ sectionName: newSectionInput.trim(), schoolClasses: { id: grade.id } });
        setNewSectionInput("");
        if (props.data?.instituteCode) await fetchExistingData(props.data.instituteCode);
      } catch (err) {
        console.error("Error creating section:", err);
        setError("Failed to add section. Please try again.");
      } finally {
        setLoading(false);
      }
    } else if (selectionSource === 'new' && currentSessionIndex !== null && currentGradeIndex !== null) {
      const updatedSessions = [...newSessionsData];
      const currentGrade = updatedSessions[currentSessionIndex].grades[currentGradeIndex];
      const sectionExists = currentGrade.sections.some(s => s.sectionName === newSectionInput.trim());
      if (!sectionExists) {
        currentGrade.sections.push({ id: null, sectionName: newSectionInput.trim(), isNew: true });
        setNewSessionsData(updatedSessions);
        setNewSectionInput("");
      }
    }
  };

  const handleRemoveNewSection = (sectionIndex: number) => {
    if (selectionSource === 'new' && currentSessionIndex !== null && currentGradeIndex !== null) {
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

  // ============ DROPDOWN INLINE EDIT ============

  const handleDropdownEditSave = async () => {
    if (!dropdownEdit || !dropdownEdit.value.trim()) return;

    setLoading(true);
    try {
      if (dropdownEdit.type === 'session') {
        await UpdateSessionData(dropdownEdit.id, { sessionYear: dropdownEdit.value.trim() });
      } else if (dropdownEdit.type === 'grade') {
        await UpdateClassData(dropdownEdit.id, { className: dropdownEdit.value.trim() });
      } else if (dropdownEdit.type === 'section') {
        await UpdateSectionData(dropdownEdit.id, { sectionName: dropdownEdit.value.trim() });
      }
      if (props.data?.instituteCode) await fetchExistingData(props.data.instituteCode);
    } catch (err) {
      console.error("Error updating:", err);
      setError("Failed to update. Please try again.");
    } finally {
      setLoading(false);
      setDropdownEdit(null);
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
    if (selectionSource === 'existing' && existingSessionIdx !== null) {
      return existingData[existingSessionIdx]?.sessionName;
    }
    if (selectionSource === 'new' && currentSessionIndex !== null) {
      return newSessionsData[currentSessionIndex]?.sessionName;
    }
    return null;
  };

  const getCurrentGradeName = () => {
    if (selectionSource === 'existing' && existingSessionIdx !== null && existingGradeIdx !== null) {
      return existingData[existingSessionIdx]?.grades[existingGradeIdx]?.gradeName;
    }
    if (selectionSource === 'new' && currentSessionIndex !== null && currentGradeIndex !== null) {
      return newSessionsData[currentSessionIndex]?.grades[currentGradeIndex]?.gradeName;
    }
    return null;
  };

  const getCurrentSections = (): SectionData[] => {
    if (selectionSource === 'existing' && existingSessionIdx !== null && existingGradeIdx !== null) {
      return existingData[existingSessionIdx]?.grades[existingGradeIdx]?.sections || [];
    }
    if (selectionSource === 'new' && currentSessionIndex !== null && currentGradeIndex !== null) {
      return newSessionsData[currentSessionIndex]?.grades[currentGradeIndex]?.sections || [];
    }
    return [];
  };

  const getCurrentGrades = (): GradeData[] => {
    if (selectionSource === 'existing' && existingSessionIdx !== null) {
      return existingData[existingSessionIdx]?.grades || [];
    }
    if (selectionSource === 'new' && currentSessionIndex !== null) {
      return newSessionsData[currentSessionIndex]?.grades || [];
    }
    return [];
  };

  const isSessionSelected = selectionSource !== null && (
    (selectionSource === 'new' && currentSessionIndex !== null) ||
    (selectionSource === 'existing' && existingSessionIdx !== null)
  );

  const isGradeSelected = isSessionSelected && (
    (selectionSource === 'new' && currentGradeIndex !== null) ||
    (selectionSource === 'existing' && existingGradeIdx !== null)
  );

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

                        {existingData.length > 0 && (
                          <>
                            <div className="dropdown-divider"></div>
                            <label className="form-label small fw-semibold">Existing Sessions</label>
                            <div className="list-group">
                              {existingData.map((session, index) => (
                                <div
                                  key={`existing-${index}`}
                                  className={`list-group-item ${selectionSource === 'existing' && existingSessionIdx === index ? 'active' : ''}`}
                                >
                                  {dropdownEdit?.type === 'session' && dropdownEdit.index === index ? (
                                    <div className="d-flex gap-1">
                                      <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        value={dropdownEdit.value}
                                        onChange={(e) => setDropdownEdit({ ...dropdownEdit, value: e.target.value })}
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter') handleDropdownEditSave();
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Escape') setDropdownEdit(null);
                                        }}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <button className="btn btn-sm btn-success" onClick={(e) => { e.stopPropagation(); handleDropdownEditSave(); }}>
                                        <i className="bi bi-check"></i>
                                      </button>
                                      <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setDropdownEdit(null); }}>
                                        <i className="bi bi-x"></i>
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="d-flex justify-content-between align-items-center">
                                      <span
                                        className="flex-grow-1"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => handleSelectExistingSession(index)}
                                      >
                                        {session.sessionName}
                                      </span>
                                      <div className="d-flex align-items-center gap-1">
                                        <span className="badge bg-primary me-1">{session.grades.length} grades</span>
                                        <button
                                          className="btn btn-sm btn-outline-primary py-0 px-1"
                                          style={{ fontSize: '0.7rem', lineHeight: 1.2 }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDropdownEdit({ type: 'session', index, id: session.id!, value: session.sessionName });
                                          }}
                                          title="Edit session"
                                        >
                                          <i className="bi bi-pencil"></i>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        {newSessionsData.length > 0 && (
                          <>
                            <div className="dropdown-divider"></div>
                            <label className="form-label small fw-semibold">New Sessions</label>
                            <div className="list-group">
                              {newSessionsData.map((session, index) => (
                                <div
                                  key={`new-${index}`}
                                  className={`list-group-item ${selectionSource === 'new' && currentSessionIndex === index ? 'active' : ''}`}
                                >
                                  {newItemEdit?.type === 'session' && newItemEdit.index === index ? (
                                    <div className="d-flex gap-1">
                                      <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        value={newItemEdit.value}
                                        onChange={(e) => setNewItemEdit({ ...newItemEdit, value: e.target.value })}
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter') {
                                            if (newItemEdit.value.trim()) {
                                              const updated = [...newSessionsData];
                                              updated[index].sessionName = newItemEdit.value.trim();
                                              setNewSessionsData(updated);
                                            }
                                            setNewItemEdit(null);
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Escape') setNewItemEdit(null);
                                        }}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <button className="btn btn-sm btn-success" onClick={(e) => {
                                        e.stopPropagation();
                                        if (newItemEdit.value.trim()) {
                                          const updated = [...newSessionsData];
                                          updated[index].sessionName = newItemEdit.value.trim();
                                          setNewSessionsData(updated);
                                        }
                                        setNewItemEdit(null);
                                      }}>
                                        <i className="bi bi-check"></i>
                                      </button>
                                      <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setNewItemEdit(null); }}>
                                        <i className="bi bi-x"></i>
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="d-flex justify-content-between align-items-center">
                                      <span
                                        className="flex-grow-1"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => handleSelectSession(index)}
                                      >
                                        {session.sessionName}
                                      </span>
                                      <div className="d-flex align-items-center gap-1">
                                        <span className="badge bg-secondary me-1">{session.grades.length} grades</span>
                                        <button
                                          className="btn btn-sm btn-outline-primary py-0 px-1"
                                          style={{ fontSize: '0.7rem', lineHeight: 1.2 }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setNewItemEdit({ type: 'session', index, value: session.sessionName });
                                          }}
                                          title="Edit session"
                                        >
                                          <i className="bi bi-pencil"></i>
                                        </button>
                                        <button
                                          className="btn btn-sm btn-outline-danger py-0 px-1"
                                          style={{ fontSize: '0.7rem', lineHeight: 1.2 }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const updated = newSessionsData.filter((_, i) => i !== index);
                                            setNewSessionsData(updated);
                                            if (currentSessionIndex === index) {
                                              setCurrentSessionIndex(null);
                                              setCurrentGradeIndex(null);
                                              setSelectionSource(null);
                                            } else if (currentSessionIndex !== null && currentSessionIndex > index) {
                                              setCurrentSessionIndex(currentSessionIndex - 1);
                                            }
                                          }}
                                          title="Remove session"
                                        >
                                          <i className="bi bi-trash"></i>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
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
                        if (isSessionSelected) {
                          setGradeDropdownOpen(!gradeDropdownOpen);
                          setSessionDropdownOpen(false);
                          setSectionDropdownOpen(false);
                        }
                      }}
                      disabled={!isSessionSelected}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-award"></i>
                        <span>{getCurrentGradeName() || "Grade"}</span>
                        {!isSessionSelected && <small className="ms-1 text-light">(select session)</small>}
                      </div>
                    </button>
                    {gradeDropdownOpen && isSessionSelected && (
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

                        {getCurrentGrades().length > 0 && (
                          <>
                            <div className="dropdown-divider"></div>
                            <label className="form-label small fw-semibold">Grades</label>
                            <div className="list-group">
                              {getCurrentGrades().map((grade, index) => {
                                const isActive = selectionSource === 'existing'
                                  ? existingGradeIdx === index
                                  : currentGradeIndex === index;
                                const isExistingGrade = selectionSource === 'existing' && grade.id;
                                return (
                                  <div
                                    key={index}
                                    className={`list-group-item ${isActive ? 'active' : ''}`}
                                  >
                                    {isExistingGrade && dropdownEdit?.type === 'grade' && dropdownEdit.index === index ? (
                                      <div className="d-flex gap-1">
                                        <input
                                          type="text"
                                          className="form-control form-control-sm"
                                          value={dropdownEdit.value}
                                          onChange={(e) => setDropdownEdit({ ...dropdownEdit, value: e.target.value })}
                                          onKeyPress={(e) => {
                                            if (e.key === 'Enter') handleDropdownEditSave();
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Escape') setDropdownEdit(null);
                                          }}
                                          autoFocus
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <button className="btn btn-sm btn-success" onClick={(e) => { e.stopPropagation(); handleDropdownEditSave(); }}>
                                          <i className="bi bi-check"></i>
                                        </button>
                                        <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setDropdownEdit(null); }}>
                                          <i className="bi bi-x"></i>
                                        </button>
                                      </div>
                                    ) : !isExistingGrade && newItemEdit?.type === 'grade' && newItemEdit.index === index ? (
                                      <div className="d-flex gap-1">
                                        <input
                                          type="text"
                                          className="form-control form-control-sm"
                                          value={newItemEdit.value}
                                          onChange={(e) => setNewItemEdit({ ...newItemEdit, value: e.target.value })}
                                          onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                              if (newItemEdit.value.trim() && currentSessionIndex !== null) {
                                                const updated = [...newSessionsData];
                                                updated[currentSessionIndex].grades[index].gradeName = newItemEdit.value.trim();
                                                setNewSessionsData(updated);
                                              }
                                              setNewItemEdit(null);
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Escape') setNewItemEdit(null);
                                          }}
                                          autoFocus
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <button className="btn btn-sm btn-success" onClick={(e) => {
                                          e.stopPropagation();
                                          if (newItemEdit.value.trim() && currentSessionIndex !== null) {
                                            const updated = [...newSessionsData];
                                            updated[currentSessionIndex].grades[index].gradeName = newItemEdit.value.trim();
                                            setNewSessionsData(updated);
                                          }
                                          setNewItemEdit(null);
                                        }}>
                                          <i className="bi bi-check"></i>
                                        </button>
                                        <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setNewItemEdit(null); }}>
                                          <i className="bi bi-x"></i>
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="d-flex justify-content-between align-items-center">
                                        <span
                                          className="flex-grow-1"
                                          style={{ cursor: 'pointer' }}
                                          onClick={() => handleSelectGrade(index)}
                                        >
                                          {grade.gradeName}
                                        </span>
                                        <div className="d-flex align-items-center gap-1">
                                          <span className="badge bg-secondary me-1">{grade.sections.length} sections</span>
                                          {isExistingGrade ? (
                                            <button
                                              className="btn btn-sm btn-outline-primary py-0 px-1"
                                              style={{ fontSize: '0.7rem', lineHeight: 1.2 }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDropdownEdit({ type: 'grade', index, id: grade.id!, value: grade.gradeName });
                                              }}
                                              title="Edit grade"
                                            >
                                              <i className="bi bi-pencil"></i>
                                            </button>
                                          ) : (
                                            <button
                                              className="btn btn-sm btn-outline-primary py-0 px-1"
                                              style={{ fontSize: '0.7rem', lineHeight: 1.2 }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setNewItemEdit({ type: 'grade', index, value: grade.gradeName });
                                              }}
                                              title="Edit grade"
                                            >
                                              <i className="bi bi-pencil"></i>
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
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
                        if (isGradeSelected) {
                          setSectionDropdownOpen(!sectionDropdownOpen);
                          setSessionDropdownOpen(false);
                          setGradeDropdownOpen(false);
                        }
                      }}
                      disabled={!isGradeSelected}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-grid-3x3"></i>
                        <span>Section ({getCurrentSections().length})</span>
                        {!isGradeSelected && <small className="ms-1 text-light">(select grade)</small>}
                      </div>
                    </button>
                    {sectionDropdownOpen && isGradeSelected && (
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
                                  className="list-group-item"
                                >
                                  {selectionSource === 'existing' && dropdownEdit?.type === 'section' && dropdownEdit.index === index ? (
                                    <div className="d-flex gap-1">
                                      <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        value={dropdownEdit.value}
                                        onChange={(e) => setDropdownEdit({ ...dropdownEdit, value: e.target.value })}
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter') handleDropdownEditSave();
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Escape') setDropdownEdit(null);
                                        }}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <button className="btn btn-sm btn-success" onClick={(e) => { e.stopPropagation(); handleDropdownEditSave(); }}>
                                        <i className="bi bi-check"></i>
                                      </button>
                                      <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setDropdownEdit(null); }}>
                                        <i className="bi bi-x"></i>
                                      </button>
                                    </div>
                                  ) : selectionSource === 'new' && newItemEdit?.type === 'section' && newItemEdit.index === index ? (
                                    <div className="d-flex gap-1">
                                      <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        value={newItemEdit.value}
                                        onChange={(e) => setNewItemEdit({ ...newItemEdit, value: e.target.value })}
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter') {
                                            if (newItemEdit.value.trim() && currentSessionIndex !== null && currentGradeIndex !== null) {
                                              const updated = [...newSessionsData];
                                              updated[currentSessionIndex].grades[currentGradeIndex].sections[index].sectionName = newItemEdit.value.trim();
                                              setNewSessionsData(updated);
                                            }
                                            setNewItemEdit(null);
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Escape') setNewItemEdit(null);
                                        }}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <button className="btn btn-sm btn-success" onClick={(e) => {
                                        e.stopPropagation();
                                        if (newItemEdit.value.trim() && currentSessionIndex !== null && currentGradeIndex !== null) {
                                          const updated = [...newSessionsData];
                                          updated[currentSessionIndex].grades[currentGradeIndex].sections[index].sectionName = newItemEdit.value.trim();
                                          setNewSessionsData(updated);
                                        }
                                        setNewItemEdit(null);
                                      }}>
                                        <i className="bi bi-check"></i>
                                      </button>
                                      <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setNewItemEdit(null); }}>
                                        <i className="bi bi-x"></i>
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="d-flex justify-content-between align-items-center">
                                      <span>
                                        {section.sectionName}
                                        {section.id && <span className="badge bg-light text-muted ms-2" style={{ fontSize: '0.65rem' }}>existing</span>}
                                      </span>
                                      <div className="d-flex align-items-center gap-1">
                                        {section.id && selectionSource === 'existing' && (
                                          <button
                                            className="btn btn-sm btn-outline-primary py-0 px-1"
                                            style={{ fontSize: '0.7rem', lineHeight: 1.2 }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDropdownEdit({ type: 'section', index, id: section.id!, value: section.sectionName });
                                            }}
                                            title="Edit section"
                                          >
                                            <i className="bi bi-pencil"></i>
                                          </button>
                                        )}
                                        {selectionSource === 'new' && (
                                          <>
                                            <button
                                              className="btn btn-sm btn-outline-primary py-0 px-1"
                                              style={{ fontSize: '0.7rem', lineHeight: 1.2 }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setNewItemEdit({ type: 'section', index, value: section.sectionName });
                                              }}
                                              title="Edit section"
                                            >
                                              <i className="bi bi-pencil"></i>
                                            </button>
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-outline-danger py-0 px-1"
                                              style={{ fontSize: '0.7rem', lineHeight: 1.2 }}
                                              onClick={() => handleRemoveNewSection(index)}
                                              title="Remove section"
                                            >
                                              <i className="bi bi-trash"></i>
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  )}
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
                      Use the edit and delete buttons to manage existing data. Changes are saved immediately.
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
                              <div className="d-flex gap-1 flex-wrap">
                                {/* Edit buttons */}
                                {row.sectionId && (
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => handleStartEdit('section', row.sectionId, row.sessionIndex, row.sectionName, row.gradeIndex, row.sectionIndex)}
                                    title="Edit section"
                                  >
                                    <i className="bi bi-pencil"></i>
                                  </button>
                                )}
                                {row.gradeId && !row.sectionId && (
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => handleStartEdit('grade', row.gradeId, row.sessionIndex, row.gradeName, row.gradeIndex)}
                                    title="Edit grade"
                                  >
                                    <i className="bi bi-pencil"></i>
                                  </button>
                                )}
                                {row.sessionId && !row.gradeId && (
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => handleStartEdit('session', row.sessionId, row.sessionIndex, row.sessionName)}
                                    title="Edit session"
                                  >
                                    <i className="bi bi-pencil"></i>
                                  </button>
                                )}
                                {/* Delete buttons */}
                                {row.sectionId && (
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => handleDeleteConfirm('section', row.sectionId, row.sectionName, row.sessionIndex, row.gradeIndex, row.sectionIndex)}
                                    title="Delete section"
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                )}
                                {row.gradeId && !row.sectionId && (
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => handleDeleteConfirm('grade', row.gradeId, row.gradeName, row.sessionIndex, row.gradeIndex)}
                                    title="Delete grade"
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                )}
                                {row.sessionId && !row.gradeId && (
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => handleDeleteConfirm('session', row.sessionId, row.sessionName, row.sessionIndex)}
                                    title="Delete session"
                                  >
                                    <i className="bi bi-trash"></i>
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
