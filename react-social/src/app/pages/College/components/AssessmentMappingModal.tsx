import { useEffect, useState, useCallback } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { MdQrCode } from "react-icons/md";
import { ActionIcon } from "../../../components/ActionIcon";
import { QRCodeCanvas } from "qrcode.react";
import { GetSessionsByInstituteCode } from "../API/College_APIs";
import {
  createAssessmentMapping,
  getAssessmentMappingsByInstitute,
  getAssessmentSummaryList,
  deleteAssessmentMapping,
  updateAssessmentMapping,
} from "../../AssessmentMapping/API/AssessmentMapping_APIs";
import { showErrorToast } from '../../../utils/toast';

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
  const [amount, setAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string>("");
  const [qrVisible, setQrVisible] = useState<{ token: string; type: "free" | "paid" } | null>(null);

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
      showErrorToast("Please select an assessment");
      return;
    }

    const data: any = {
      assessmentId: Number(selectedAssessment),
      instituteCode: props.instituteCode,
      mappingLevel: mappingLevel,
    };

    if (mappingLevel === "SESSION") {
      if (!selectedSession) {
        showErrorToast("Please select a session");
        return;
      }
      data.sessionId = Number(selectedSession);
    } else if (mappingLevel === "CLASS") {
      if (!selectedSession || !selectedClass) {
        showErrorToast("Please select a session and class");
        return;
      }
      data.sessionId = Number(selectedSession);
      data.classId = Number(selectedClass);
    } else if (mappingLevel === "SECTION") {
      if (!selectedSession || !selectedClass || !selectedSection) {
        showErrorToast("Please select a session, class, and section");
        return;
      }
      data.sessionId = Number(selectedSession);
      data.classId = Number(selectedClass);
      data.sectionId = Number(selectedSection);
    }

    // Set amount in paise if provided
    if (amount && Number(amount) > 0) {
      data.amount = Math.round(Number(amount) * 100);
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
      setAmount("");
    } catch (error: any) {
      console.error("Failed to create mapping:", error);
      showErrorToast(
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

  const getFreeRegistrationUrl = (token: string) => {
    return `${process.env.REACT_APP_ASSESSMENT_APP_URL}/assessment-register/${token}`;
  };

  const getPaidRegistrationUrl = (token: string) => {
    return `${process.env.REACT_APP_URL}/assessment-register/${token}`;
  };

  const copyToClipboard = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopySuccess(key);
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const downloadQrCode = useCallback((canvasId: string, label: string) => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `QR_${label.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
    link.click();
  }, []);

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
      <Modal.Header
        closeButton
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
          borderBottom: "none",
          padding: "24px 32px",
        }}
      >
        <div>
          <Modal.Title style={{ color: "#fff", fontWeight: 700, fontSize: "1.25rem" }}>
            Assessment Mapping
          </Modal.Title>
          <div style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: 4 }}>
            {props.instituteName}
          </div>
        </div>
      </Modal.Header>

      <Modal.Body style={{ padding: "32px", background: "#f8fafc" }}>
        {loading ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "64px 0", color: "#64748b",
          }}>
            <Spinner animation="border" size="sm" style={{ marginRight: 12 }} />
            Loading data...
          </div>
        ) : (
          <>
            {/* ── Create New Mapping ── */}
            <div style={{
              background: "#fff", borderRadius: 16, padding: "28px 32px",
              border: "1px solid #e2e8f0", marginBottom: 32,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10, marginBottom: 24,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#4361ee",
                }} />
                <h6 style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>
                  Create New Mapping
                </h6>
              </div>

              {/* Row 1: Assessment + Level + Amount */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 20 }}>
                <div>
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem", color: "#475569", marginBottom: 8 }}>
                    Assessment
                  </Form.Label>
                  <Form.Select
                    value={selectedAssessment}
                    onChange={(e) => setSelectedAssessment(e.target.value)}
                    style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: "0.9rem" }}
                  >
                    <option value="">-- Select an assessment --</option>
                    {assessments.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.AssessmentName || a.assessmentName}
                      </option>
                    ))}
                  </Form.Select>
                </div>
                <div>
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem", color: "#475569", marginBottom: 8 }}>
                    Mapping Level
                  </Form.Label>
                  <Form.Select
                    value={mappingLevel}
                    onChange={(e) => {
                      setMappingLevel(e.target.value);
                      setSelectedClass("");
                      setSelectedSection("");
                    }}
                    style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: "0.9rem" }}
                  >
                    <option value="SESSION">Session</option>
                    <option value="CLASS">Class</option>
                    <option value="SECTION">Section</option>
                  </Form.Select>
                </div>
                <div>
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem", color: "#475569", marginBottom: 8 }}>
                    Amount (INR) <span style={{ color: "#94a3b8", fontWeight: 400 }}>-- optional</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    placeholder="0 = Free"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0"
                    style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: "0.9rem" }}
                  />
                </div>
              </div>

              {/* Row 2: Session + Class + Section (conditional) */}
              <div style={{
                display: "grid",
                gridTemplateColumns: mappingLevel === "SECTION" ? "1fr 1fr 1fr" : mappingLevel === "CLASS" ? "1fr 1fr" : "1fr",
                gap: 20, marginBottom: 24,
              }}>
                <div>
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem", color: "#475569", marginBottom: 8 }}>
                    Session
                  </Form.Label>
                  <Form.Select
                    value={selectedSession}
                    onChange={(e) => {
                      setSelectedSession(e.target.value);
                      setSelectedClass("");
                      setSelectedSection("");
                    }}
                    style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: "0.9rem" }}
                  >
                    <option value="">-- Select session --</option>
                    {sessions.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.sessionYear}</option>
                    ))}
                  </Form.Select>
                </div>

                {(mappingLevel === "CLASS" || mappingLevel === "SECTION") && (
                  <div>
                    <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem", color: "#475569", marginBottom: 8 }}>
                      Class
                    </Form.Label>
                    <Form.Select
                      value={selectedClass}
                      onChange={(e) => {
                        setSelectedClass(e.target.value);
                        setSelectedSection("");
                      }}
                      style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: "0.9rem" }}
                    >
                      <option value="">-- Select class --</option>
                      {classes.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.className}</option>
                      ))}
                    </Form.Select>
                  </div>
                )}

                {mappingLevel === "SECTION" && (
                  <div>
                    <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem", color: "#475569", marginBottom: 8 }}>
                      Section
                    </Form.Label>
                    <Form.Select
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: "0.9rem" }}
                    >
                      <option value="">-- Select section --</option>
                      {sections.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.sectionName}</option>
                      ))}
                    </Form.Select>
                  </div>
                )}
              </div>

              <Button
                onClick={handleCreate}
                disabled={submitting}
                style={{
                  background: submitting
                    ? "#94a3b8"
                    : "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                  border: "none", borderRadius: 10, padding: "10px 28px",
                  fontWeight: 600, fontSize: "0.9rem",
                  boxShadow: submitting ? "none" : "0 4px 14px rgba(67, 97, 238, 0.3)",
                }}
              >
                {submitting ? (
                  <>
                    <Spinner animation="border" size="sm" style={{ marginRight: 8 }} />
                    Creating...
                  </>
                ) : (
                  "Create Mapping"
                )}
              </Button>
            </div>

            {/* ── Existing Mappings ── */}
            <div style={{
              background: "#fff", borderRadius: 16, padding: "28px 32px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 24,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "#10b981",
                  }} />
                  <h6 style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>
                    Existing Mappings
                  </h6>
                </div>
                <span style={{
                  background: "#f1f5f9", color: "#475569",
                  padding: "4px 14px", borderRadius: 20,
                  fontSize: "0.8rem", fontWeight: 600,
                }}>
                  {mappings.length} total
                </span>
              </div>

              {mappings.length === 0 ? (
                <div style={{
                  padding: "48px 24px", textAlign: "center",
                  border: "2px dashed #e2e8f0", borderRadius: 12,
                  color: "#94a3b8",
                }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: 8, opacity: 0.5 }}>&#128279;</div>
                  No assessment mappings yet. Create one above.
                </div>
              ) : (
                <div style={{ maxHeight: 420, overflowY: "auto", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Assessment", "Level", "Details", "Amount", "Status", "Free Link (Assessment)", "Paid Link (Dashboard)", "Actions"].map((h) => (
                          <th key={h} style={{
                            padding: "14px 18px", fontWeight: 700, fontSize: "0.78rem",
                            color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.05em",
                            borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap",
                            position: "sticky" as const, top: 0, background: "#f8fafc", zIndex: 1,
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mappings.map((mapping: any, idx: number) => (
                        <tr
                          key={mapping.mappingId}
                          style={{
                            background: idx % 2 === 0 ? "#fff" : "#fafbfc",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4ff")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#fafbfc")}
                        >
                          <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", fontWeight: 600, fontSize: "0.88rem", color: "#1e293b" }}>
                            {getAssessmentName(mapping.assessmentId)}
                          </td>
                          <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                            <span style={{
                              background: mapping.mappingLevel === "SESSION" ? "#ede9fe" : mapping.mappingLevel === "CLASS" ? "#dbeafe" : "#dcfce7",
                              color: mapping.mappingLevel === "SESSION" ? "#7c3aed" : mapping.mappingLevel === "CLASS" ? "#2563eb" : "#059669",
                              padding: "4px 12px", borderRadius: 8,
                              fontWeight: 600, fontSize: "0.75rem",
                            }}>
                              {mapping.mappingLevel}
                            </span>
                          </td>
                          <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", fontSize: "0.85rem", color: "#475569" }}>
                            {getLevelLabel(mapping)}
                          </td>
                          <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                            <span style={{
                              background: mapping.amount && mapping.amount > 0 ? "#fef3c7" : "#f0fdf4",
                              color: mapping.amount && mapping.amount > 0 ? "#92400e" : "#166534",
                              padding: "4px 12px", borderRadius: 8,
                              fontWeight: 600, fontSize: "0.78rem",
                            }}>
                              {mapping.amount && mapping.amount > 0
                                ? `INR ${(mapping.amount / 100).toFixed(0)}`
                                : "Free"}
                            </span>
                          </td>
                          <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                            <span
                              onClick={() => handleToggleActive(mapping)}
                              style={{
                                background: mapping.isActive ? "#dcfce7" : "#f1f5f9",
                                color: mapping.isActive ? "#059669" : "#94a3b8",
                                padding: "5px 14px", borderRadius: 20,
                                fontWeight: 600, fontSize: "0.78rem",
                                cursor: "pointer", display: "inline-block",
                                transition: "all 0.15s",
                              }}
                            >
                              {mapping.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          {/* Free Link (Assessment domain) */}
                          <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", maxWidth: 260 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <a
                                href={getFreeRegistrationUrl(mapping.token)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: "0.75rem", color: "#059669", wordBreak: "break-all",
                                  lineHeight: 1.4, textDecoration: "none",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                              >
                                {getFreeRegistrationUrl(mapping.token)}
                              </a>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <button
                                  onClick={() => copyToClipboard(getFreeRegistrationUrl(mapping.token), `free-${mapping.token}`)}
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    padding: "3px 8px", borderRadius: 6,
                                    border: copySuccess === `free-${mapping.token}` ? "1px solid #059669" : "1px solid #e2e8f0",
                                    background: copySuccess === `free-${mapping.token}` ? "#dcfce7" : "#f8fafc",
                                    color: copySuccess === `free-${mapping.token}` ? "#059669" : "#64748b",
                                    fontWeight: 600, fontSize: "0.7rem", cursor: "pointer",
                                  }}
                                >
                                  <ActionIcon type="copy" size="sm" />
                                  {copySuccess === `free-${mapping.token}` ? "Copied!" : "Copy"}
                                </button>
                                <button
                                  onClick={() => setQrVisible({ token: mapping.token, type: "free" })}
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    padding: "3px 8px", borderRadius: 6,
                                    border: "1px solid #e2e8f0", background: "#f8fafc",
                                    color: "#64748b", fontWeight: 600, fontSize: "0.7rem",
                                    cursor: "pointer",
                                  }}
                                >
                                  <MdQrCode size={11} />
                                  QR
                                </button>
                              </div>
                            </div>
                          </td>
                          {/* Paid Link (Dashboard domain) */}
                          <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", maxWidth: 260 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <a
                                href={getPaidRegistrationUrl(mapping.token)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: "0.75rem", color: "#2563eb", wordBreak: "break-all",
                                  lineHeight: 1.4, textDecoration: "none",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                              >
                                {getPaidRegistrationUrl(mapping.token)}
                              </a>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <button
                                  onClick={() => copyToClipboard(getPaidRegistrationUrl(mapping.token), `paid-${mapping.token}`)}
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    padding: "3px 8px", borderRadius: 6,
                                    border: copySuccess === `paid-${mapping.token}` ? "1px solid #2563eb" : "1px solid #e2e8f0",
                                    background: copySuccess === `paid-${mapping.token}` ? "#dbeafe" : "#f8fafc",
                                    color: copySuccess === `paid-${mapping.token}` ? "#2563eb" : "#64748b",
                                    fontWeight: 600, fontSize: "0.7rem", cursor: "pointer",
                                  }}
                                >
                                  <ActionIcon type="copy" size="sm" />
                                  {copySuccess === `paid-${mapping.token}` ? "Copied!" : "Copy"}
                                </button>
                                <button
                                  onClick={() => setQrVisible({ token: mapping.token, type: "paid" })}
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    padding: "3px 8px", borderRadius: 6,
                                    border: "1px solid #e2e8f0", background: "#f8fafc",
                                    color: "#64748b", fontWeight: 600, fontSize: "0.7rem",
                                    cursor: "pointer",
                                  }}
                                >
                                  <MdQrCode size={11} />
                                  QR
                                </button>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                            <button
                              onClick={() => handleDelete(mapping.mappingId)}
                              title="Delete mapping"
                              style={{
                                display: "inline-flex", alignItems: "center",
                                padding: "6px 12px", borderRadius: 8,
                                border: "1.5px solid #fee2e2", background: "#fff",
                                color: "#ef4444", cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                            >
                              <ActionIcon type="delete" size="sm" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </Modal.Body>

      <Modal.Footer style={{ padding: "16px 32px", borderTop: "1px solid #e2e8f0", background: "#fff" }}>
        <Button
          variant="secondary"
          onClick={props.onHide}
          style={{
            borderRadius: 10, padding: "8px 24px", fontWeight: 600,
            background: "#f1f5f9", border: "1.5px solid #e2e8f0", color: "#475569",
          }}
        >
          Close
        </Button>
      </Modal.Footer>

      {/* QR Code Modal */}
      <Modal
        show={!!qrVisible}
        onHide={() => setQrVisible(null)}
        centered
      >
        <Modal.Header
          closeButton
          style={{ borderBottom: "1px solid #f1f5f9", padding: "20px 28px" }}
        >
          <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b" }}>
            QR Code —{" "}
            <span style={{ color: qrVisible?.type === "free" ? "#059669" : "#2563eb" }}>
              {qrVisible?.type === "free" ? "Free (Assessment)" : "Paid (Dashboard)"}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "36px 28px", textAlign: "center" }}>
          {qrVisible && (
            <>
              <div style={{
                display: "inline-block", padding: 16, background: "#fff",
                borderRadius: 16, border: "1px solid #e2e8f0",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              }}>
                <QRCodeCanvas
                  id={`qr-canvas-${qrVisible.type}-${qrVisible.token}`}
                  value={qrVisible.type === "free"
                    ? getFreeRegistrationUrl(qrVisible.token)
                    : getPaidRegistrationUrl(qrVisible.token)}
                  size={240}
                  level="H"
                  includeMargin
                />
              </div>
              <div style={{
                marginTop: 16, fontSize: "0.78rem", color: "#94a3b8",
                wordBreak: "break-all", padding: "0 12px", lineHeight: 1.5,
              }}>
                {qrVisible.type === "free"
                  ? getFreeRegistrationUrl(qrVisible.token)
                  : getPaidRegistrationUrl(qrVisible.token)}
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer style={{
          justifyContent: "center", gap: 12, padding: "20px 28px",
          borderTop: "1px solid #f1f5f9",
        }}>
          {qrVisible && (
            <Button
              onClick={() => {
                const mapping = mappings.find((m) => m.token === qrVisible.token);
                const label = (mapping ? getAssessmentName(mapping.assessmentId) : "assessment")
                  + `_${qrVisible.type}_${qrVisible.token.slice(0, 8)}`;
                downloadQrCode(`qr-canvas-${qrVisible.type}-${qrVisible.token}`, label);
              }}
              style={{
                background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                border: "none", borderRadius: 10, padding: "10px 24px",
                fontWeight: 600, fontSize: "0.9rem",
                boxShadow: "0 4px 14px rgba(5, 150, 105, 0.25)",
              }}
            >
              <span style={{ marginRight: 8 }}><ActionIcon type="download" size="sm" /></span>
              Download QR
            </Button>
          )}
          <Button
            onClick={() => setQrVisible(null)}
            style={{
              borderRadius: 10, padding: "10px 24px", fontWeight: 600,
              background: "#f1f5f9", border: "1.5px solid #e2e8f0",
              color: "#475569", fontSize: "0.9rem",
            }}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Modal>
  );
};

export default AssessmentMappingModal;
