import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Button, Form, Spinner, Badge } from "react-bootstrap";
import { MdSchool } from "react-icons/md";
import { ActionIcon } from "../../../components/ActionIcon";
import { ReadCollegeData } from "../../College/API/College_APIs";
import { GetSessionsByInstituteCode } from "../../College/API/College_APIs";
import {
  mapUserToCollege,
  getUserCollegeMappings,
  unmapUserFromCollege,
  createAccessLevel,
  deleteAccessLevel,
} from "../API/UserMapping_APIs";
import { showErrorToast } from "../../../utils/toast";

interface UserCollegeMappingModalProps {
  show: boolean;
  onHide: () => void;
  user: { id: number; name: string; email: string } | null;
}

const UserCollegeMappingModal = (props: UserCollegeMappingModalProps) => {
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);

  const [selectedInstitute, setSelectedInstitute] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [mapping, setMapping] = useState(false);

  // Access-level state
  const [activeMapping, setActiveMapping] = useState<any | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<number[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [selectedSectionIds, setSelectedSectionIds] = useState<number[]>([]);
  const [addingAccess, setAddingAccess] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Per-mapping delete spinner (Feature 3): tracks the id being unmapped so
  // its button shows a spinner while the network call is in-flight.
  const [unmappingId, setUnmappingId] = useState<number | null>(null);
  // Per-access-level delete spinner — same idea for the access rows.
  const [deletingAccessId, setDeletingAccessId] = useState<number | null>(null);

  // Derived: classes filtered by the selected sessions.
  // When >1 session is selected, the class label appends "(SessionYear)" so
  // the admin can disambiguate identically-named classes across sessions.
  const classOptions = useMemo(() => {
    const out: { id: number; label: string; sessionId: number; className: string; sessionYear: string }[] = [];
    const showSessionBracket = selectedSessionIds.length > 1;
    for (const s of sessions) {
      if (!selectedSessionIds.includes(s.id)) continue;
      const sessionYear = s.sessionYear ?? `Session #${s.id}`;
      for (const c of s.schoolClasses || []) {
        out.push({
          id: c.id,
          className: c.className,
          sessionYear,
          sessionId: s.id,
          label: showSessionBracket ? `${c.className} (${sessionYear})` : c.className,
        });
      }
    }
    return out;
  }, [sessions, selectedSessionIds]);

  // Derived: sections filtered by the selected classes.
  // When >1 class is selected, label appends "(ClassName, SessionYear)".
  const sectionOptions = useMemo(() => {
    const out: { id: number; label: string; classId: number; sessionId: number }[] = [];
    const showClassBracket = selectedClassIds.length > 1;
    for (const s of sessions) {
      if (!selectedSessionIds.includes(s.id)) continue;
      const sessionYear = s.sessionYear ?? `Session #${s.id}`;
      for (const c of s.schoolClasses || []) {
        if (!selectedClassIds.includes(c.id)) continue;
        for (const sec of c.schoolSections || []) {
          out.push({
            id: sec.id,
            classId: c.id,
            sessionId: s.id,
            label: showClassBracket
              ? `${sec.sectionName} (${c.className}${selectedSessionIds.length > 1 ? `, ${sessionYear}` : ""})`
              : sec.sectionName,
          });
        }
      }
    }
    return out;
  }, [sessions, selectedSessionIds, selectedClassIds]);

  // Prune downstream selections when upstream changes (e.g., deselecting a
  // session should remove its classes/sections from the picked sets).
  useEffect(() => {
    const validClassIds = new Set(classOptions.map((c) => c.id));
    setSelectedClassIds((prev) => prev.filter((id) => validClassIds.has(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionIds, sessions]);

  useEffect(() => {
    const validSectionIds = new Set(sectionOptions.map((s) => s.id));
    setSelectedSectionIds((prev) => prev.filter((id) => validSectionIds.has(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassIds, sessions]);

  // After successful map (Feature 2): when a new mapping appears that wasn't
  // there before, auto-select it so the session/class/section form is the
  // next visible affordance. Tracked via a ref of last-seen IDs.
  const previousMappingIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (props.show && props.user) {
      previousMappingIdsRef.current = new Set();
      loadData();
      setActiveMapping(null);
      setSessions([]);
      setSelectedSessionIds([]);
      setSelectedClassIds([]);
      setSelectedSectionIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.show, props.user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [instituteRes, mappingRes] = await Promise.all([
        ReadCollegeData(),
        getUserCollegeMappings(props.user!.id),
      ]);
      setInstitutes(instituteRes.data || []);
      setMappings(mappingRes.data || []);
      previousMappingIdsRef.current = new Set((mappingRes.data || []).map((m: any) => m.id));
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMapToInstitute = async () => {
    if (!selectedInstitute || !props.user) return;

    setMapping(true);
    try {
      await mapUserToCollege(props.user.id, Number(selectedInstitute));
      // Refresh mappings, then surface the newly-created one so the admin
      // can immediately attach session/class/section attributes (Feature 2).
      const res = await getUserCollegeMappings(props.user.id);
      const list: any[] = res.data || [];
      setMappings(list);
      const previousIds = previousMappingIdsRef.current;
      const newlyCreated = list.find((m) => !previousIds.has(m.id));
      previousMappingIdsRef.current = new Set(list.map((m) => m.id));
      setSelectedInstitute("");
      if (newlyCreated) {
        await handleSelectMapping(newlyCreated);
      }
    } catch (error: any) {
      console.error("Failed to map:", error);
      const msg =
        error.response?.data || error.response?.data?.message || error.message;
      showErrorToast("Failed to map: " + msg);
    } finally {
      setMapping(false);
    }
  };

  const handleUnmap = async (contactPersonId: number) => {
    if (
      !window.confirm(
        "Are you sure? This will remove the college mapping and all access levels."
      )
    )
      return;

    setUnmappingId(contactPersonId);
    try {
      await unmapUserFromCollege(contactPersonId);
      setMappings((prev) => prev.filter((m) => m.id !== contactPersonId));
      previousMappingIdsRef.current.delete(contactPersonId);
      if (activeMapping?.id === contactPersonId) {
        setActiveMapping(null);
        setSessions([]);
        setSelectedSessionIds([]);
        setSelectedClassIds([]);
        setSelectedSectionIds([]);
      }
    } catch (error: any) {
      console.error("Failed to unmap:", error);
      const msg = error.response?.data || error.message || "Failed to unmap";
      showErrorToast(typeof msg === "string" ? msg : "Failed to unmap");
    } finally {
      setUnmappingId(null);
    }
  };

  const handleSelectMapping = async (m: any) => {
    setActiveMapping(m);
    setSelectedSessionIds([]);
    setSelectedClassIds([]);
    setSelectedSectionIds([]);
    setLoadingSessions(true);
    try {
      const res = await GetSessionsByInstituteCode(m.institute.instituteCode);
      setSessions(res.data || []);
    } catch (error) {
      console.error("Failed to load sessions:", error);
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Submit one access-level row per (session, class, section) combination
  // implied by the multi-select picks. Existing backend API accepts one row
  // at a time — we loop with Promise.allSettled so a single failure does not
  // strand the others.
  const handleAddAccess = async () => {
    if (!activeMapping) return;
    if (selectedSessionIds.length === 0) {
      showErrorToast("Please select at least one session");
      return;
    }

    // Build the cartesian list. A pick of (sessions, classes, sections)
    // expands per the dimensions actually chosen:
    //   - if no classes picked → one row per session, class=null
    //   - if classes picked, no sections → one row per (session-of-class, class)
    //   - if sections picked → one row per (session-of-class, class, section)
    type Row = { sessionId: number; classId?: number; sectionId?: number };
    const rows: Row[] = [];

    if (selectedClassIds.length === 0) {
      for (const sid of selectedSessionIds) rows.push({ sessionId: sid });
    } else if (selectedSectionIds.length === 0) {
      for (const c of classOptions) {
        if (selectedClassIds.includes(c.id)) {
          rows.push({ sessionId: c.sessionId, classId: c.id });
        }
      }
    } else {
      for (const sec of sectionOptions) {
        if (selectedSectionIds.includes(sec.id)) {
          rows.push({ sessionId: sec.sessionId, classId: sec.classId, sectionId: sec.id });
        }
      }
    }

    if (rows.length === 0) {
      showErrorToast("Nothing to add — refine your selection");
      return;
    }

    setAddingAccess(true);
    try {
      const results = await Promise.allSettled(
        rows.map((r) =>
          createAccessLevel({
            contactPersonId: activeMapping.id,
            ...r,
          })
        )
      );
      const failures = results.filter((r) => r.status === "rejected").length;
      if (failures > 0) {
        showErrorToast(`${failures} of ${rows.length} access level(s) failed to add`);
      }

      const res = await getUserCollegeMappings(props.user!.id);
      setMappings(res.data || []);
      const updated = (res.data || []).find((m: any) => m.id === activeMapping.id);
      if (updated) setActiveMapping(updated);
      setSelectedSessionIds([]);
      setSelectedClassIds([]);
      setSelectedSectionIds([]);
    } catch (error: any) {
      console.error("Failed to add access level:", error);
      showErrorToast("Failed to add access level: " + (error.response?.data || error.message));
    } finally {
      setAddingAccess(false);
    }
  };

  const handleDeleteAccess = async (accessId: number) => {
    setDeletingAccessId(accessId);
    try {
      await deleteAccessLevel(accessId);
      const res = await getUserCollegeMappings(props.user!.id);
      setMappings(res.data || []);
      const updated = (res.data || []).find((m: any) => m.id === activeMapping?.id);
      if (updated) setActiveMapping(updated);
    } catch (error) {
      console.error("Failed to delete access level:", error);
    } finally {
      setDeletingAccessId(null);
    }
  };

  const getAccessLabel = (level: any) => {
    const parts: string[] = [];
    if (level.sessionId) {
      const s = sessions.find((s: any) => s.id === level.sessionId);
      parts.push(s ? s.sessionYear : `Session #${level.sessionId}`);
    }
    if (level.classId) {
      for (const session of sessions) {
        const cls = (session.schoolClasses || []).find((c: any) => c.id === level.classId);
        if (cls) {
          parts.push(`Class ${cls.className}`);
          if (level.sectionId) {
            const sec = (cls.schoolSections || []).find((s: any) => s.id === level.sectionId);
            parts.push(sec ? `Section ${sec.sectionName}` : `Section #${level.sectionId}`);
          }
          break;
        }
      }
    }
    return parts.join(" / ") || "All";
  };

  const mappedInstituteCodes = new Set(mappings.map((m) => m.institute?.instituteCode));
  const availableInstitutes = institutes.filter((i) => !mappedInstituteCodes.has(i.instituteCode));

  return (
    <Modal show={props.show} onHide={props.onHide} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <MdSchool size={24} className="me-2" />
          College Mapping - {props.user?.name || ""}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" size="sm" className="me-2" />
            Loading...
          </div>
        ) : (
          <>
            {/* Section 1: Map to Institute */}
            <div className="card card-body bg-light mb-4">
              <h6 className="mb-3">Map to Institute</h6>
              <div className="row g-3 align-items-end">
                <div className="col-md-8">
                  <Form.Label>Select Institute</Form.Label>
                  <Form.Select
                    value={selectedInstitute}
                    onChange={(e) => setSelectedInstitute(e.target.value)}
                  >
                    <option value="">Select an institute...</option>
                    {availableInstitutes.map((inst: any) => (
                      <option key={inst.instituteCode} value={inst.instituteCode}>
                        {inst.instituteName}
                      </option>
                    ))}
                  </Form.Select>
                </div>
                <div className="col-md-4">
                  <Button
                    variant="primary"
                    onClick={handleMapToInstitute}
                    disabled={!selectedInstitute || mapping}
                  >
                    {mapping ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-1" />
                        Mapping...
                      </>
                    ) : (
                      "Map to Institute"
                    )}
                  </Button>
                </div>
              </div>
              <Form.Text className="text-muted mt-2 d-block">
                After mapping, the access-level form below will open automatically so you can
                attach sessions, classes, and sections in one step.
              </Form.Text>
            </div>

            {/* Section 2: Mapped Institutes */}
            <h6 className="mb-3">Mapped Institutes ({mappings.length})</h6>
            {mappings.length === 0 ? (
              <div className="text-muted text-center py-3">
                No institute mappings yet. Map to one above.
              </div>
            ) : (
              <div className="row g-2 mb-4">
                {mappings.map((m: any) => {
                  const isBeingDeleted = unmappingId === m.id;
                  return (
                    <div key={m.id} className="col-md-4">
                      <div
                        className={`card h-100 ${
                          activeMapping?.id === m.id ? "border-primary shadow-sm" : ""
                        }`}
                        style={{ cursor: "pointer", opacity: isBeingDeleted ? 0.6 : 1 }}
                      >
                        <div className="card-body p-3">
                          <div className="d-flex justify-content-between align-items-start">
                            <div onClick={() => !isBeingDeleted && handleSelectMapping(m)} style={{ flex: 1 }}>
                              <h6 className="mb-1">
                                {m.institute?.instituteName || "Unknown Institute"}
                              </h6>
                              <small className="text-muted">
                                Code: {m.institute?.instituteCode}
                              </small>
                              <br />
                              <Badge bg="info" className="mt-1">
                                {(m.accessLevels || []).length} access{" "}
                                {(m.accessLevels || []).length === 1 ? "level" : "levels"}
                              </Badge>
                            </div>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              disabled={isBeingDeleted || unmappingId !== null}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnmap(m.id);
                              }}
                              title="Unmap from institute"
                            >
                              {isBeingDeleted ? (
                                <Spinner animation="border" size="sm" />
                              ) : (
                                <ActionIcon type="delete" size="sm" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Section 3: Access Levels for selected institute */}
            {activeMapping && (
              <div className="card">
                <div className="card-header">
                  <h6 className="mb-0">
                    Access Levels - {activeMapping.institute?.instituteName}
                  </h6>
                </div>
                <div className="card-body">
                  {loadingSessions ? (
                    <div className="text-center py-3">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading sessions...
                    </div>
                  ) : (
                    <>
                      <div className="row g-3 mb-3">
                        <div className="col-md-4">
                          <Form.Label>
                            Sessions <span style={{ color: "#dc2626" }}>*</span>
                          </Form.Label>
                          <MultiSelectChecklist
                            options={sessions.map((s: any) => ({
                              id: s.id,
                              label: s.sessionYear ?? `Session #${s.id}`,
                            }))}
                            selected={selectedSessionIds}
                            onChange={setSelectedSessionIds}
                            placeholder="Select Sessions"
                            emptyText="No sessions found for this institute"
                          />
                        </div>
                        <div className="col-md-4">
                          <Form.Label>Classes (optional)</Form.Label>
                          <MultiSelectChecklist
                            options={classOptions.map((c) => ({ id: c.id, label: c.label }))}
                            selected={selectedClassIds}
                            onChange={setSelectedClassIds}
                            disabled={selectedSessionIds.length === 0}
                            placeholder={
                              selectedSessionIds.length === 0
                                ? "Pick session(s) first"
                                : "All classes"
                            }
                            emptyText="No classes in the picked session(s)"
                          />
                        </div>
                        <div className="col-md-4">
                          <Form.Label>Sections (optional)</Form.Label>
                          <MultiSelectChecklist
                            options={sectionOptions.map((s) => ({ id: s.id, label: s.label }))}
                            selected={selectedSectionIds}
                            onChange={setSelectedSectionIds}
                            disabled={selectedClassIds.length === 0}
                            placeholder={
                              selectedClassIds.length === 0
                                ? "Pick class(es) first"
                                : "All sections"
                            }
                            emptyText="No sections in the picked class(es)"
                          />
                        </div>
                        <div className="col-12">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={handleAddAccess}
                            disabled={selectedSessionIds.length === 0 || addingAccess}
                          >
                            {addingAccess ? (
                              <>
                                <Spinner animation="border" size="sm" className="me-1" />
                                Adding...
                              </>
                            ) : (
                              `Add Access${
                                selectedSessionIds.length || selectedClassIds.length || selectedSectionIds.length
                                  ? ` (${
                                      selectedSectionIds.length > 0
                                        ? selectedSectionIds.length
                                        : selectedClassIds.length > 0
                                        ? selectedClassIds.length
                                        : selectedSessionIds.length
                                    } row${
                                      (selectedSectionIds.length || selectedClassIds.length || selectedSessionIds.length) === 1
                                        ? ""
                                        : "s"
                                    })`
                                  : ""
                              }`
                            )}
                          </Button>
                        </div>
                      </div>

                      {(activeMapping.accessLevels || []).length === 0 ? (
                        <div className="text-muted text-center py-3">
                          No access levels defined. This contact-person has no granular
                          access restrictions for this institute.
                        </div>
                      ) : (
                        <table className="table table-striped table-hover table-sm">
                          <thead className="table-dark">
                            <tr>
                              <th>#</th>
                              <th>Access Scope</th>
                              <th style={{ width: "80px" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(activeMapping.accessLevels || []).map((level: any, idx: number) => {
                              const isDeleting = deletingAccessId === level.id;
                              return (
                                <tr key={level.id} style={{ opacity: isDeleting ? 0.5 : 1 }}>
                                  <td>{idx + 1}</td>
                                  <td>{getAccessLabel(level)}</td>
                                  <td>
                                    <Button
                                      variant="outline-danger"
                                      size="sm"
                                      disabled={isDeleting || deletingAccessId !== null}
                                      onClick={() => handleDeleteAccess(level.id)}
                                    >
                                      {isDeleting ? (
                                        <Spinner animation="border" size="sm" />
                                      ) : (
                                        <ActionIcon type="delete" size="sm" />
                                      )}
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={props.onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// ── Multi-select checkbox dropdown ───────────────────────────────────────────
// Lightweight inline component. Click-outside closes the panel. Avoids
// pulling in react-multi-select / react-select just for one screen.
interface MultiSelectOption {
  id: number;
  label: string;
}
interface MultiSelectChecklistProps {
  options: MultiSelectOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
  placeholder: string;
  emptyText: string;
  disabled?: boolean;
}
const MultiSelectChecklist = ({
  options,
  selected,
  onChange,
  placeholder,
  emptyText,
  disabled,
}: MultiSelectChecklistProps) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const toggle = (id: number) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  const summary = (() => {
    if (selected.length === 0) return placeholder;
    if (selected.length <= 2) {
      return options.filter((o) => selected.includes(o.id)).map((o) => o.label).join(", ");
    }
    return `${selected.length} selected`;
  })();

  const canOpen = !disabled && options.length > 0;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="form-select form-select-sm text-start"
        onClick={() => canOpen && setOpen((v) => !v)}
        disabled={disabled}
        style={{
          background: disabled ? "#f3f4f6" : "#fff",
          color: selected.length === 0 ? "#9ca3af" : "#111827",
          cursor: canOpen ? "pointer" : "not-allowed",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={summary}
      >
        {summary}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1080,
            marginTop: 4,
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {options.length === 0 ? (
            <div style={{ padding: "10px 12px", color: "#9ca3af", fontSize: "0.85rem" }}>{emptyText}</div>
          ) : (
            <>
              <div style={{ padding: "6px 12px", borderBottom: "1px solid #f3f4f6", display: "flex", gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0"
                  onClick={() => onChange(options.map((o) => o.id))}
                  style={{ fontSize: "0.78rem", textDecoration: "none" }}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-muted"
                  onClick={() => onChange([])}
                  style={{ fontSize: "0.78rem", textDecoration: "none" }}
                >
                  Clear
                </button>
              </div>
              {options.map((o) => (
                <label
                  key={o.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(o.id)}
                    onChange={() => toggle(o.id)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default UserCollegeMappingModal;
