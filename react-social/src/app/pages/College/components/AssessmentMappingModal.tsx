import { useEffect, useState } from "react";
import { Modal, Button, Form, Spinner, Badge } from "react-bootstrap";
import { MdContentCopy, MdDelete } from "react-icons/md";
import { GetSessionsByInstituteCode } from "../API/College_APIs";
import {
  createAssessmentMapping,
  getAssessmentMappingsByInstitute,
  getAssessmentSummaryList,
  deleteAssessmentMapping,
  updateAssessmentMapping,
} from "../../AssessmentMapping/API/AssessmentMapping_APIs";

interface AssessmentMappingModalProps {
  show: boolean;
  onHide: () => void;
  instituteCode: number;
  instituteName: string;
}

const AssessmentMappingModal = (props: AssessmentMappingModalProps) => {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);

  const [selectedAssessment, setSelectedAssessment] = useState<string>("");
  const [mappingLevel, setMappingLevel] = useState<string>("CLASS");
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string>("");

  // Derived: classes and sections from selected session/class
  const selectedSessionObj = sessions.find(
    (s: any) => String(s.id) === selectedSession
  );
  const classes: any[] = selectedSessionObj?.schoolClasses || [];

  const selectedClassObj = classes.find(
    (c: any) => String(c.id) === selectedClass
  );
  const sections: any[] = selectedClassObj?.schoolSections || [];

  useEffect(() => {
    if (props.show && props.instituteCode) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.show, props.instituteCode]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assessmentRes, sessionRes, mappingRes] = await Promise.all([
        getAssessmentSummaryList(),
        GetSessionsByInstituteCode(props.instituteCode),
        getAssessmentMappingsByInstitute(props.instituteCode),
      ]);
      setAssessments(
        (assessmentRes.data || []).filter((a: any) => a.isActive !== false)
      );
      setSessions(sessionRes.data || []);
      setMappings(mappingRes.data || []);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedAssessment) {
      alert("Please select an assessment");
      return;
    }

    const data: any = {
      assessmentId: Number(selectedAssessment),
      instituteCode: props.instituteCode,
      mappingLevel: mappingLevel,
    };

    if (mappingLevel === "SESSION") {
      if (!selectedSession) {
        alert("Please select a session");
        return;
      }
      data.sessionId = Number(selectedSession);
    } else if (mappingLevel === "CLASS") {
      if (!selectedSession || !selectedClass) {
        alert("Please select a session and class");
        return;
      }
      data.sessionId = Number(selectedSession);
      data.classId = Number(selectedClass);
    } else if (mappingLevel === "SECTION") {
      if (!selectedSession || !selectedClass || !selectedSection) {
        alert("Please select a session, class, and section");
        return;
      }
      data.sessionId = Number(selectedSession);
      data.classId = Number(selectedClass);
      data.sectionId = Number(selectedSection);
    }

    setSubmitting(true);
    try {
      await createAssessmentMapping(data);
      // Refresh mappings
      const res = await getAssessmentMappingsByInstitute(props.instituteCode);
      setMappings(res.data || []);
      // Reset form
      setSelectedAssessment("");
      setSelectedSession("");
      setSelectedClass("");
      setSelectedSection("");
    } catch (error: any) {
      console.error("Failed to create mapping:", error);
      alert(
        "Failed to create mapping: " +
          (error.response?.data || error.message)
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this mapping?"))
      return;
    try {
      await deleteAssessmentMapping(id);
      setMappings(mappings.filter((m) => m.mappingId !== id));
    } catch (error) {
      console.error("Failed to delete mapping:", error);
    }
  };

  const handleToggleActive = async (mapping: any) => {
    try {
      await updateAssessmentMapping(mapping.mappingId, {
        isActive: !mapping.isActive,
      });
      setMappings(
        mappings.map((m) =>
          m.mappingId === mapping.mappingId
            ? { ...m, isActive: !m.isActive }
            : m
        )
      );
    } catch (error) {
      console.error("Failed to update mapping:", error);
    }
  };

  const getRegistrationUrl = (token: string) => {
    return `${process.env.ASSESSMENT_APP_URL}/assessment-register/${token}`;
  };

  const copyToClipboard = (token: string) => {
    navigator.clipboard.writeText(getRegistrationUrl(token));
    setCopySuccess(token);
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const getAssessmentName = (assessmentId: number) => {
    const a = assessments.find((a: any) => a.id === assessmentId);
    return a ? a.AssessmentName || a.assessmentName || `ID: ${assessmentId}` : `ID: ${assessmentId}`;
  };

  const getLevelLabel = (mapping: any) => {
    const parts: string[] = [];
    if (mapping.sessionId) {
      const s = sessions.find((s: any) => s.id === mapping.sessionId);
      if (s) parts.push(s.sessionYear);
    }
    if (mapping.classId) {
      // Find class in sessions
      for (const session of sessions) {
        const cls = (session.schoolClasses || []).find(
          (c: any) => c.id === mapping.classId
        );
        if (cls) {
          parts.push(`Class ${cls.className}`);
          if (mapping.sectionId) {
            const sec = (cls.schoolSections || []).find(
              (s: any) => s.id === mapping.sectionId
            );
            if (sec) parts.push(`Section ${sec.sectionName}`);
          }
          break;
        }
      }
    }
    return parts.join(" / ") || mapping.mappingLevel;
  };

  return (
    <Modal show={props.show} onHide={props.onHide} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          Assessment Mapping - {props.instituteName}
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
            {/* Create Form */}
            <div className="card card-body bg-light mb-4">
              <h6 className="mb-3">Create New Mapping</h6>
              <div className="row g-3">
                <div className="col-md-4">
                  <Form.Label>Assessment</Form.Label>
                  <Form.Select
                    value={selectedAssessment}
                    onChange={(e) => setSelectedAssessment(e.target.value)}
                  >
                    <option value="">Select Assessment</option>
                    {assessments.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.AssessmentName || a.assessmentName}
                      </option>
                    ))}
                  </Form.Select>
                </div>

                <div className="col-md-2">
                  <Form.Label>Level</Form.Label>
                  <Form.Select
                    value={mappingLevel}
                    onChange={(e) => {
                      setMappingLevel(e.target.value);
                      setSelectedClass("");
                      setSelectedSection("");
                    }}
                  >
                    <option value="SESSION">Session</option>
                    <option value="CLASS">Class</option>
                    <option value="SECTION">Section</option>
                  </Form.Select>
                </div>

                <div className="col-md-2">
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

                {(mappingLevel === "CLASS" || mappingLevel === "SECTION") && (
                  <div className="col-md-2">
                    <Form.Label>Class</Form.Label>
                    <Form.Select
                      value={selectedClass}
                      onChange={(e) => {
                        setSelectedClass(e.target.value);
                        setSelectedSection("");
                      }}
                    >
                      <option value="">Select Class</option>
                      {classes.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.className}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                )}

                {mappingLevel === "SECTION" && (
                  <div className="col-md-2">
                    <Form.Label>Section</Form.Label>
                    <Form.Select
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                    >
                      <option value="">Select Section</option>
                      {sections.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.sectionName}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreate}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-1" />
                      Creating...
                    </>
                  ) : (
                    "Create Mapping"
                  )}
                </Button>
              </div>
            </div>

            {/* Existing Mappings Table */}
            <h6 className="mb-3">
              Existing Mappings ({mappings.length})
            </h6>
            {mappings.length === 0 ? (
              <div className="text-muted text-center py-3">
                No assessment mappings yet. Create one above.
              </div>
            ) : (
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                <table className="table table-striped table-hover table-sm">
                  <thead
                    className="table-dark"
                    style={{ position: "sticky", top: 0 }}
                  >
                    <tr>
                      <th>Assessment</th>
                      <th>Level</th>
                      <th>Details</th>
                      <th>Status</th>
                      <th>URL</th>
                      <th style={{ width: "100px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((mapping: any) => (
                      <tr key={mapping.mappingId}>
                        <td>{getAssessmentName(mapping.assessmentId)}</td>
                        <td>
                          <Badge bg="info">{mapping.mappingLevel}</Badge>
                        </td>
                        <td style={{ fontSize: "0.85em" }}>
                          {getLevelLabel(mapping)}
                        </td>
                        <td>
                          <Badge
                            bg={mapping.isActive ? "success" : "secondary"}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleToggleActive(mapping)}
                          >
                            {mapping.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => copyToClipboard(mapping.token)}
                            title="Copy URL"
                          >
                            <MdContentCopy size={14} />
                            {copySuccess === mapping.token ? (
                              <span className="ms-1" style={{ fontSize: "0.8em" }}>
                                Copied!
                              </span>
                            ) : (
                              <span className="ms-1" style={{ fontSize: "0.8em" }}>
                                Copy
                              </span>
                            )}
                          </Button>
                        </td>
                        <td>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDelete(mapping.mappingId)}
                          >
                            <MdDelete size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

export default AssessmentMappingModal;
