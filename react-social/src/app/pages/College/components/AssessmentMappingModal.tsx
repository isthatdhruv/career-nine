import { useEffect, useState, useCallback } from "react";
import { Modal, Button, Form, Spinner, Badge } from "react-bootstrap";
import { MdContentCopy, MdDelete, MdQrCode, MdDownload, MdPayment } from "react-icons/md";
import { QRCodeCanvas } from "qrcode.react";
import PaymentLinkModal from "./PaymentLinkModal";
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
  const [submitting, setSubmitting] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string>("");
  const [qrVisibleToken, setQrVisibleToken] = useState<string | null>(null);
  const [paymentModalMapping, setPaymentModalMapping] = useState<any | null>(null);

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

  const getRegistrationUrl = (token: string) => {
    return `${process.env.REACT_APP_ASSESSMENT_APP_URL}/assessment-register/${token}`;
  };

  const copyToClipboard = (token: string) => {
    navigator.clipboard.writeText(getRegistrationUrl(token));
    setCopySuccess(token);
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const downloadQrCode = useCallback((token: string, assessmentName: string) => {
    const canvas = document.getElementById(`qr-canvas-${token}`) as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `QR_${assessmentName.replace(/[^a-zA-Z0-9]/g, "_")}_${token.slice(0, 8)}.png`;
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

              {/* Row 1: Assessment + Level */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
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
                        {["Assessment", "Level", "Details", "Status", "Payment", "Actions"].map((h) => (
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
                          <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                            <button
                              onClick={() => setPaymentModalMapping(mapping)}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                padding: "6px 14px", borderRadius: 8,
                                border: "1.5px solid #e0e7ff",
                                background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
                                color: "#4338ca", fontWeight: 600, fontSize: "0.78rem",
                                cursor: "pointer", transition: "all 0.15s",
                              }}
                            >
                              <MdPayment size={14} />
                              Generate Link
                            </button>
                          </td>
                          <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={() => copyToClipboard(mapping.token)}
                                title="Copy registration URL"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 6,
                                  padding: "6px 14px", borderRadius: 8,
                                  border: copySuccess === mapping.token ? "1.5px solid #059669" : "1.5px solid #e2e8f0",
                                  background: copySuccess === mapping.token ? "#dcfce7" : "#fff",
                                  color: copySuccess === mapping.token ? "#059669" : "#475569",
                                  fontWeight: 600, fontSize: "0.78rem", cursor: "pointer",
                                  transition: "all 0.15s",
                                }}
                              >
                                <MdContentCopy size={14} />
                                {copySuccess === mapping.token ? "Copied!" : "Copy URL"}
                              </button>
                              <button
                                onClick={() => setQrVisibleToken(mapping.token)}
                                title="Show QR Code"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 6,
                                  padding: "6px 12px", borderRadius: 8,
                                  border: "1.5px solid #e2e8f0", background: "#fff",
                                  color: "#475569", cursor: "pointer",
                                  transition: "all 0.15s",
                                }}
                              >
                                <MdQrCode size={14} />
                              </button>
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
                                <MdDelete size={14} />
                              </button>
                            </div>
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
        show={!!qrVisibleToken}
        onHide={() => setQrVisibleToken(null)}
        centered
      >
        <Modal.Header
          closeButton
          style={{ borderBottom: "1px solid #f1f5f9", padding: "20px 28px" }}
        >
          <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b" }}>
            QR Code
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "36px 28px", textAlign: "center" }}>
          {qrVisibleToken && (
            <>
              <div style={{
                display: "inline-block", padding: 16, background: "#fff",
                borderRadius: 16, border: "1px solid #e2e8f0",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              }}>
                <QRCodeCanvas
                  id={`qr-canvas-${qrVisibleToken}`}
                  value={getRegistrationUrl(qrVisibleToken)}
                  size={240}
                  level="H"
                  includeMargin
                />
              </div>
              <div style={{
                marginTop: 16, fontSize: "0.78rem", color: "#94a3b8",
                wordBreak: "break-all", padding: "0 12px", lineHeight: 1.5,
              }}>
                {getRegistrationUrl(qrVisibleToken)}
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer style={{
          justifyContent: "center", gap: 12, padding: "20px 28px",
          borderTop: "1px solid #f1f5f9",
        }}>
          {qrVisibleToken && (
            <Button
              onClick={() => {
                const mapping = mappings.find((m) => m.token === qrVisibleToken);
                downloadQrCode(
                  qrVisibleToken,
                  mapping ? getAssessmentName(mapping.assessmentId) : "assessment"
                );
              }}
              style={{
                background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                border: "none", borderRadius: 10, padding: "10px 24px",
                fontWeight: 600, fontSize: "0.9rem",
                boxShadow: "0 4px 14px rgba(5, 150, 105, 0.25)",
              }}
            >
              <MdDownload size={16} style={{ marginRight: 8 }} />
              Download QR
            </Button>
          )}
          <Button
            onClick={() => setQrVisibleToken(null)}
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

      {/* Payment Link Modal */}
      {paymentModalMapping && (
        <PaymentLinkModal
          show={!!paymentModalMapping}
          onHide={() => setPaymentModalMapping(null)}
          mappingId={paymentModalMapping.mappingId}
          assessmentName={getAssessmentName(paymentModalMapping.assessmentId)}
        />
      )}
    </Modal>
  );
};

export default AssessmentMappingModal;
