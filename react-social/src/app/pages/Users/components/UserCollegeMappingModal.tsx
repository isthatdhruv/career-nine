import { useEffect, useState } from "react";
import { Modal, Button, Form, Spinner, Badge } from "react-bootstrap";
import { MdDelete, MdSchool } from "react-icons/md";
import { ReadCollegeData } from "../../College/API/College_APIs";
import { GetSessionsByInstituteCode } from "../../College/API/College_APIs";
import {
  mapUserToCollege,
  getUserCollegeMappings,
  unmapUserFromCollege,
  createAccessLevel,
  deleteAccessLevel,
} from "../API/UserMapping_APIs";

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

  // Access level management state
  const [activeMapping, setActiveMapping] = useState<any | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [addingAccess, setAddingAccess] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Derived: classes and sections from selected session/class
  const selectedSessionObj = sessions.find(
    (s: any) => String(s.id) === selectedSession
  );
  const classes: any[] = selectedSessionObj?.schoolClasses || [];

  const selectedClassObj = classes.find(
    (c: any) => String(c.id) === selectedClass
  );
  const sectionsList: any[] = selectedClassObj?.schoolSections || [];

  useEffect(() => {
    if (props.show && props.user) {
      loadData();
      setActiveMapping(null);
      setSessions([]);
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
      // Refresh mappings
      const res = await getUserCollegeMappings(props.user.id);
      setMappings(res.data || []);
      setSelectedInstitute("");
    } catch (error: any) {
      console.error("Failed to map:", error);
      const msg =
        error.response?.data || error.response?.data?.message || error.message;
      alert("Failed to map: " + msg);
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

    try {
      await unmapUserFromCollege(contactPersonId);
      setMappings(mappings.filter((m) => m.id !== contactPersonId));
      if (activeMapping?.id === contactPersonId) {
        setActiveMapping(null);
        setSessions([]);
      }
    } catch (error) {
      console.error("Failed to unmap:", error);
    }
  };

  const handleSelectMapping = async (m: any) => {
    setActiveMapping(m);
    setSelectedSession("");
    setSelectedClass("");
    setSelectedSection("");
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

  const handleAddAccess = async () => {
    if (!activeMapping || !selectedSession) {
      alert("Please select at least a session");
      return;
    }

    const data: any = {
      contactPersonId: activeMapping.id,
      sessionId: Number(selectedSession),
    };
    if (selectedClass) data.classId = Number(selectedClass);
    if (selectedSection) data.sectionId = Number(selectedSection);

    setAddingAccess(true);
    try {
      await createAccessLevel(data);
      // Refresh mappings to get updated access levels
      const res = await getUserCollegeMappings(props.user!.id);
      setMappings(res.data || []);
      // Update active mapping's access levels
      const updated = (res.data || []).find(
        (m: any) => m.id === activeMapping.id
      );
      if (updated) setActiveMapping(updated);
      setSelectedSession("");
      setSelectedClass("");
      setSelectedSection("");
    } catch (error: any) {
      console.error("Failed to add access level:", error);
      alert(
        "Failed to add access level: " +
          (error.response?.data || error.message)
      );
    } finally {
      setAddingAccess(false);
    }
  };

  const handleDeleteAccess = async (accessId: number) => {
    try {
      await deleteAccessLevel(accessId);
      // Refresh
      const res = await getUserCollegeMappings(props.user!.id);
      setMappings(res.data || []);
      const updated = (res.data || []).find(
        (m: any) => m.id === activeMapping?.id
      );
      if (updated) setActiveMapping(updated);
    } catch (error) {
      console.error("Failed to delete access level:", error);
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
        const cls = (session.schoolClasses || []).find(
          (c: any) => c.id === level.classId
        );
        if (cls) {
          parts.push(`Class ${cls.className}`);
          if (level.sectionId) {
            const sec = (cls.schoolSections || []).find(
              (s: any) => s.id === level.sectionId
            );
            parts.push(sec ? `Section ${sec.sectionName}` : `Section #${level.sectionId}`);
          }
          break;
        }
      }
    }
    return parts.join(" / ") || "All";
  };

  // Filter out already-mapped institutes from dropdown
  const mappedInstituteCodes = new Set(
    mappings.map((m) => m.institute?.instituteCode)
  );
  const availableInstitutes = institutes.filter(
    (i) => !mappedInstituteCodes.has(i.instituteCode)
  );

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
            </div>

            {/* Section 2: Mapped Institutes */}
            <h6 className="mb-3">
              Mapped Institutes ({mappings.length})
            </h6>
            {mappings.length === 0 ? (
              <div className="text-muted text-center py-3">
                No institute mappings yet. Map to one above.
              </div>
            ) : (
              <div className="row g-2 mb-4">
                {mappings.map((m: any) => (
                  <div key={m.id} className="col-md-4">
                    <div
                      className={`card h-100 ${
                        activeMapping?.id === m.id
                          ? "border-primary shadow-sm"
                          : ""
                      }`}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-start">
                          <div onClick={() => handleSelectMapping(m)}>
                            <h6 className="mb-1">
                              {m.institute?.instituteName || "Unknown Institute"}
                            </h6>
                            <small className="text-muted">
                              Code: {m.institute?.instituteCode}
                            </small>
                            <br />
                            <Badge bg="info" className="mt-1">
                              {(m.accessLevels || []).length} access{" "}
                              {(m.accessLevels || []).length === 1
                                ? "level"
                                : "levels"}
                            </Badge>
                          </div>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnmap(m.id);
                            }}
                            title="Unmap from institute"
                          >
                            <MdDelete size={16} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Section 3: Access Levels for selected institute */}
            {activeMapping && (
              <div className="card">
                <div className="card-header">
                  <h6 className="mb-0">
                    Access Levels -{" "}
                    {activeMapping.institute?.instituteName}
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
                      {/* Add Access Form */}
                      <div className="row g-3 mb-3">
                        <div className="col-md-3">
                          <Form.Label>Session</Form.Label>
                          <Form.Select
                            value={selectedSession}
                            onChange={(e) => {
                              setSelectedSession(e.target.value);
                              setSelectedClass("");
                              setSelectedSection("");
                            }}
                          >
                            <option value="">Select Session</option>
                            {sessions.map((s: any) => (
                              <option key={s.id} value={s.id}>
                                {s.sessionYear}
                              </option>
                            ))}
                          </Form.Select>
                        </div>
                        <div className="col-md-3">
                          <Form.Label>Class (optional)</Form.Label>
                          <Form.Select
                            value={selectedClass}
                            onChange={(e) => {
                              setSelectedClass(e.target.value);
                              setSelectedSection("");
                            }}
                            disabled={!selectedSession}
                          >
                            <option value="">All Classes</option>
                            {classes.map((c: any) => (
                              <option key={c.id} value={c.id}>
                                {c.className}
                              </option>
                            ))}
                          </Form.Select>
                        </div>
                        <div className="col-md-3">
                          <Form.Label>Section (optional)</Form.Label>
                          <Form.Select
                            value={selectedSection}
                            onChange={(e) => setSelectedSection(e.target.value)}
                            disabled={!selectedClass}
                          >
                            <option value="">All Sections</option>
                            {sectionsList.map((s: any) => (
                              <option key={s.id} value={s.id}>
                                {s.sectionName}
                              </option>
                            ))}
                          </Form.Select>
                        </div>
                        <div className="col-md-3 d-flex align-items-end">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={handleAddAccess}
                            disabled={!selectedSession || addingAccess}
                          >
                            {addingAccess ? (
                              <>
                                <Spinner
                                  animation="border"
                                  size="sm"
                                  className="me-1"
                                />
                                Adding...
                              </>
                            ) : (
                              "Add Access"
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Access Levels Table */}
                      {(activeMapping.accessLevels || []).length === 0 ? (
                        <div className="text-muted text-center py-3">
                          No access levels defined. This user has no granular
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
                            {(activeMapping.accessLevels || []).map(
                              (level: any, idx: number) => (
                                <tr key={level.id}>
                                  <td>{idx + 1}</td>
                                  <td>{getAccessLabel(level)}</td>
                                  <td>
                                    <Button
                                      variant="outline-danger"
                                      size="sm"
                                      onClick={() =>
                                        handleDeleteAccess(level.id)
                                      }
                                    >
                                      <MdDelete size={14} />
                                    </Button>
                                  </td>
                                </tr>
                              )
                            )}
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

export default UserCollegeMappingModal;
