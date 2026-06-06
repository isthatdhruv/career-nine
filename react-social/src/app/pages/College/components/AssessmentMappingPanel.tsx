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
  getCatalog,
  enableCatalog,
  toggleCatalog,
  deleteCatalog,
  toggleLink,
  AssessmentInstituteMapping,
  InstituteAssessment,
} from "../../AssessmentMapping/API/AssessmentMapping_APIs";
import { showErrorToast } from "../../../utils/toast";
import TierManagementModal from "./TierManagementModal";

interface Props {
  instituteCode: number;
  instituteName: string;
  active?: boolean;
}

const assessmentAppBase = process.env.REACT_APP_ASSESSMENT_APP_URL || "https://assessment.career-9.com";
const registrationUrl = (token: string) => `${assessmentAppBase}/assessment-register/${token}`;

const AssessmentMappingPanel = ({ instituteCode, active = true }: Props) => {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [mappings, setMappings] = useState<AssessmentInstituteMapping[]>([]);
  const [catalog, setCatalog] = useState<InstituteAssessment[]>([]);

  const [selectedAssessment, setSelectedAssessment] = useState<string>("");
  const [mappingLevel, setMappingLevel] = useState<string>("INSTITUTE");
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");

  // Catalog add control: multi-select of assessment ids to enable.
  const [catalogToAdd, setCatalogToAdd] = useState<Set<number>>(new Set());
  const [catalogSaving, setCatalogSaving] = useState(false);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string>("");
  const [qrVisible, setQrVisible] = useState<{ token: string; type: "free" | "paid" } | null>(null);
  const [tierModalMappingId, setTierModalMappingId] = useState<number | null>(null);

  const selectedSessionObj = sessions.find((s: any) => String(s.id) === selectedSession);
  const classes: any[] = selectedSessionObj?.schoolClasses || [];

  const selectedClassObj = classes.find((c: any) => String(c.id) === selectedClass);
  const sections: any[] = selectedClassObj?.schoolSections || [];

  useEffect(() => {
    if (active && instituteCode) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, instituteCode]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assessmentRes, sessionRes, mappingRes, catalogRes] = await Promise.all([
        getAssessmentSummaryList(),
        GetSessionsByInstituteCode(instituteCode),
        getAssessmentMappingsByInstitute(instituteCode),
        getCatalog(instituteCode),
      ]);
      setAssessments((assessmentRes.data || []).filter((a: any) => a.isActive !== false));
      setSessions(sessionRes.data || []);
      setMappings(mappingRes.data || []);
      setCatalog(catalogRes.data || []);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const reloadCatalog = async () => {
    try {
      const res = await getCatalog(instituteCode);
      setCatalog(res.data || []);
    } catch (error) {
      console.error("Failed to reload catalog:", error);
    }
  };

  // ── Catalog handlers ──
  const toggleCatalogPick = (id: number) => {
    setCatalogToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddToCatalog = async () => {
    if (catalogToAdd.size === 0) {
      showErrorToast("Select at least one assessment to enable");
      return;
    }
    setCatalogSaving(true);
    try {
      const res = await enableCatalog(instituteCode, Array.from(catalogToAdd));
      setCatalog(res.data || []);
      setCatalogToAdd(new Set());
    } catch (error: any) {
      // 400 body is a plain-string message (e.g. maxAssessments cap exceeded).
      showErrorToast(String(error.response?.data || error.message || "Failed to enable assessments"));
    } finally {
      setCatalogSaving(false);
    }
  };

  const handleToggleCatalog = async (item: InstituteAssessment) => {
    try {
      const res = await toggleCatalog(item.id);
      setCatalog((prev) => prev.map((c) => (c.id === item.id ? res.data : c)));
    } catch (error) {
      console.error("Failed to toggle catalog item:", error);
    }
  };

  const handleRemoveCatalog = async (item: InstituteAssessment) => {
    if (!window.confirm("Remove this assessment from the institute's catalog?")) return;
    try {
      await deleteCatalog(item.id);
      setCatalog((prev) => prev.filter((c) => c.id !== item.id));
    } catch (error: any) {
      showErrorToast(String(error.response?.data || error.message || "Failed to remove from catalog"));
    }
  };

  // Assessment ids already in the catalog — hide them from the add picker.
  const catalogAssessmentIds = new Set(catalog.map((c) => Number(c.assessmentId)));
  const addableAssessments = assessments.filter((a: any) => !catalogAssessmentIds.has(Number(a.id)));

  const handleCreate = async () => {
    if (!selectedAssessment) {
      showErrorToast("Please select an assessment");
      return;
    }

    const data: any = {
      assessmentId: Number(selectedAssessment),
      instituteCode: instituteCode,
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
    // INSTITUTE level needs no coordinates.

    setSubmitting(true);
    try {
      const createRes = await createAssessmentMapping(data);
      const [mappingRes] = await Promise.all([
        getAssessmentMappingsByInstitute(instituteCode),
        reloadCatalog(), // create auto-enrols the assessment in the catalog
      ]);
      setMappings(mappingRes.data || []);
      setSelectedAssessment("");
      setSelectedSession("");
      setSelectedClass("");
      setSelectedSection("");
      const newMappingId = createRes?.data?.mappingId;
      if (newMappingId) setTierModalMappingId(newMappingId);
    } catch (error: any) {
      console.error("Failed to create mapping:", error);
      showErrorToast("Failed to create mapping: " + (error.response?.data || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this mapping?")) return;
    try {
      await deleteAssessmentMapping(id);
      setMappings(mappings.filter((m) => m.mappingId !== id));
    } catch (error) {
      console.error("Failed to delete mapping:", error);
    }
  };

  const handleToggleActive = async (mapping: AssessmentInstituteMapping) => {
    try {
      await updateAssessmentMapping(mapping.mappingId, { isActive: !mapping.isActive });
      setMappings(mappings.map((m) =>
        m.mappingId === mapping.mappingId ? { ...m, isActive: !m.isActive } : m
      ));
    } catch (error) {
      console.error("Failed to update mapping:", error);
    }
  };

  const handleToggleLink = async (mapping: AssessmentInstituteMapping, linkType: "free" | "paid") => {
    try {
      const res = await toggleLink(mapping.mappingId, linkType);
      setMappings(mappings.map((m) =>
        m.mappingId === mapping.mappingId ? { ...m, ...res.data } : m
      ));
    } catch (error) {
      console.error("Failed to toggle link:", error);
    }
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
    const a = assessments.find((a: any) => Number(a.id) === Number(assessmentId));
    return a ? a.AssessmentName || a.assessmentName || `ID: ${assessmentId}` : `ID: ${assessmentId}`;
  };

  const getLevelLabel = (mapping: AssessmentInstituteMapping) => {
    const parts: string[] = [];
    if (mapping.sessionId) {
      const s = sessions.find((s: any) => s.id === mapping.sessionId);
      if (s) parts.push(s.sessionYear);
    }
    if (mapping.classId) {
      for (const session of sessions) {
        const cls = (session.schoolClasses || []).find((c: any) => c.id === mapping.classId);
        if (cls) {
          parts.push(`Class ${cls.className}`);
          if (mapping.sectionId) {
            const sec = (cls.schoolSections || []).find((s: any) => s.id === mapping.sectionId);
            if (sec) parts.push(`Section ${sec.sectionName}`);
          }
          break;
        }
      }
    }
    if (mapping.mappingLevel === "INSTITUTE") return "Whole institute";
    return parts.join(" / ") || mapping.mappingLevel;
  };

  // Resolve the active token used for the QR overlay (free vs paid).
  const qrMapping = qrVisible
    ? mappings.find((m) =>
        (qrVisible.type === "free" ? m.freeToken : m.paidToken) === qrVisible.token
      )
    : undefined;

  return (
    <div style={{ padding: "32px", background: "#f8fafc", borderRadius: 12 }}>
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0", color: "#64748b" }}>
          <Spinner animation="border" size="sm" style={{ marginRight: 12 }} />
          Loading data...
        </div>
      ) : (
        <>
          {/* ── Institute Assessment Catalog ── */}
          <div style={{
            background: "#fff", borderRadius: 16, padding: "28px 32px",
            border: "1px solid #e2e8f0", marginBottom: 32,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                <h6 style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>
                  Enabled Assessments
                </h6>
              </div>
              <span style={{
                background: "#fef3c7", color: "#92400e",
                padding: "4px 14px", borderRadius: 20,
                fontSize: "0.78rem", fontWeight: 600,
              }}>
                {catalog.length} enabled
              </span>
            </div>

            {/* Current catalog chips */}
            {catalog.length === 0 ? (
              <div style={{
                padding: "20px 16px", textAlign: "center",
                border: "2px dashed #e2e8f0", borderRadius: 12,
                color: "#94a3b8", fontSize: "0.85rem", marginBottom: 18,
              }}>
                No assessments enabled for this institute yet. Add some below.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
                {catalog.map((c) => (
                  <span key={c.id} style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: c.isActive ? "#ecfdf5" : "#f1f5f9",
                    border: `1.5px solid ${c.isActive ? "#a7f3d0" : "#e2e8f0"}`,
                    color: c.isActive ? "#065f46" : "#94a3b8",
                    padding: "6px 12px", borderRadius: 999,
                    fontSize: "0.82rem", fontWeight: 600,
                  }}>
                    <span style={{ textDecoration: c.isActive ? "none" : "line-through" }}>
                      {getAssessmentName(c.assessmentId)}
                    </span>
                    <button
                      onClick={() => handleToggleCatalog(c)}
                      title={c.isActive ? "Disable" : "Enable"}
                      style={{
                        border: "none", background: "transparent", cursor: "pointer",
                        fontSize: "0.72rem", fontWeight: 700,
                        color: c.isActive ? "#059669" : "#64748b",
                      }}
                    >
                      {c.isActive ? "On" : "Off"}
                    </button>
                    <button
                      onClick={() => handleRemoveCatalog(c)}
                      title="Remove from catalog"
                      style={{
                        border: "none", background: "transparent", cursor: "pointer",
                        color: "#ef4444", fontWeight: 700, fontSize: "0.9rem", lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add to catalog */}
            <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
              <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem", color: "#475569", marginBottom: 8 }}>
                Add assessments to this institute
              </Form.Label>
              {addableAssessments.length === 0 ? (
                <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                  All available assessments are already in the catalog.
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                    {addableAssessments.map((a: any) => {
                      const picked = catalogToAdd.has(Number(a.id));
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleCatalogPick(Number(a.id))}
                          style={{
                            padding: "6px 14px", borderRadius: 999,
                            border: picked ? "1.5px solid #4361ee" : "1.5px solid #e2e8f0",
                            background: picked ? "#eef2ff" : "#fff",
                            color: picked ? "#4361ee" : "#475569",
                            fontWeight: 600, fontSize: "0.8rem", cursor: "pointer",
                          }}
                        >
                          {picked ? "✓ " : "+ "}{a.AssessmentName || a.assessmentName}
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    onClick={handleAddToCatalog}
                    disabled={catalogSaving || catalogToAdd.size === 0}
                    style={{
                      background: catalogSaving || catalogToAdd.size === 0
                        ? "#94a3b8"
                        : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                      border: "none", borderRadius: 10, padding: "9px 22px",
                      fontWeight: 600, fontSize: "0.85rem",
                    }}
                  >
                    {catalogSaving ? (
                      <><Spinner animation="border" size="sm" style={{ marginRight: 8 }} />Enabling...</>
                    ) : (
                      `Enable ${catalogToAdd.size || ""} assessment${catalogToAdd.size === 1 ? "" : "s"}`.trim()
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* ── Create New Mapping ── */}
          <div style={{
            background: "#fff", borderRadius: 16, padding: "28px 32px",
            border: "1px solid #e2e8f0", marginBottom: 32,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4361ee" }} />
              <h6 style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>
                Create New Mapping
              </h6>
            </div>

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
                    setSelectedSession("");
                    setSelectedClass("");
                    setSelectedSection("");
                  }}
                  style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: "0.9rem" }}
                >
                  <option value="INSTITUTE">Institute (whole institute)</option>
                  <option value="SESSION">Session</option>
                  <option value="CLASS">Class</option>
                  <option value="SECTION">Section</option>
                </Form.Select>
              </div>
            </div>

            {mappingLevel !== "INSTITUTE" && (
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
            )}

            <Button
              onClick={handleCreate}
              disabled={submitting}
              style={{
                background: submitting ? "#94a3b8" : "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
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
              <div style={{ maxHeight: 480, overflowY: "auto", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Assessment", "Level", "Details", "Status", "Free Link", "Paid Link", "Actions"].map((h) => (
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
                    {mappings.map((mapping, idx: number) => (
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
                            background:
                              mapping.mappingLevel === "INSTITUTE" ? "#fef3c7"
                              : mapping.mappingLevel === "SESSION" ? "#ede9fe"
                              : mapping.mappingLevel === "CLASS" ? "#dbeafe" : "#dcfce7",
                            color:
                              mapping.mappingLevel === "INSTITUTE" ? "#92400e"
                              : mapping.mappingLevel === "SESSION" ? "#7c3aed"
                              : mapping.mappingLevel === "CLASS" ? "#2563eb" : "#059669",
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

                        {/* Free Link — distinct freeToken */}
                        <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", maxWidth: 280 }}>
                          <LinkCell
                            url={registrationUrl(mapping.freeToken)}
                            accent="#059669"
                            copied={copySuccess === `free-${mapping.freeToken}`}
                            onCopy={() => copyToClipboard(registrationUrl(mapping.freeToken), `free-${mapping.freeToken}`)}
                            onQr={() => setQrVisible({ token: mapping.freeToken, type: "free" })}
                            active={!!mapping.freeActive}
                            onToggle={() => handleToggleLink(mapping, "free")}
                          />
                        </td>

                        {/* Paid Link — distinct paidToken + Manage Tiers */}
                        <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", maxWidth: 280 }}>
                          <LinkCell
                            url={registrationUrl(mapping.paidToken)}
                            accent="#2563eb"
                            copied={copySuccess === `paid-${mapping.paidToken}`}
                            onCopy={() => copyToClipboard(registrationUrl(mapping.paidToken), `paid-${mapping.paidToken}`)}
                            onQr={() => setQrVisible({ token: mapping.paidToken, type: "paid" })}
                            active={!!mapping.paidActive}
                            onToggle={() => handleToggleLink(mapping, "paid")}
                          />
                          <button
                            onClick={() => setTierModalMappingId(mapping.mappingId)}
                            style={{
                              marginTop: 8,
                              padding: "5px 14px", borderRadius: 8,
                              border: "1.5px solid #e2e8f0", background: "#f8fafc",
                              color: "#4361ee", fontWeight: 600, fontSize: "0.75rem", cursor: "pointer",
                            }}
                          >
                            Manage Tiers
                          </button>
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

      {/* QR Code Modal — overlay popup */}
      <Modal show={!!qrVisible} onHide={() => setQrVisible(null)} centered>
        <Modal.Header closeButton style={{ borderBottom: "1px solid #f1f5f9", padding: "20px 28px" }}>
          <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b" }}>
            QR Code —{" "}
            <span style={{ color: qrVisible?.type === "free" ? "#059669" : "#2563eb" }}>
              {qrVisible?.type === "free" ? "Free link" : "Paid link"}
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
                  value={registrationUrl(qrVisible.token)}
                  size={240}
                  level="H"
                  includeMargin
                />
              </div>
              <div style={{
                marginTop: 16, fontSize: "0.78rem", color: "#94a3b8",
                wordBreak: "break-all", padding: "0 12px", lineHeight: 1.5,
              }}>
                {registrationUrl(qrVisible.token)}
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
                const label = (qrMapping ? getAssessmentName(qrMapping.assessmentId) : "assessment")
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
      {tierModalMappingId !== null && (
        <TierManagementModal
          mappingId={tierModalMappingId}
          show={tierModalMappingId !== null}
          onHide={() => setTierModalMappingId(null)}
        />
      )}
    </div>
  );
};

// ── A single registration-link cell: url + copy + QR + active toggle. ──
interface LinkCellProps {
  url: string;
  accent: string;
  copied: boolean;
  onCopy: () => void;
  onQr: () => void;
  active: boolean;
  onToggle: () => void;
}

const LinkCell = ({ url, accent, copied, onCopy, onQr, active, onToggle }: LinkCellProps) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        fontSize: "0.75rem", color: active ? accent : "#94a3b8",
        wordBreak: "break-all", lineHeight: 1.4, textDecoration: active ? "none" : "line-through",
      }}
      onMouseEnter={(e) => { if (active) e.currentTarget.style.textDecoration = "underline"; }}
      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = active ? "none" : "line-through"; }}
    >
      {url}
    </a>
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <button
        onClick={onCopy}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "3px 8px", borderRadius: 6,
          border: copied ? `1px solid ${accent}` : "1px solid #e2e8f0",
          background: copied ? `${accent}1a` : "#f8fafc",
          color: copied ? accent : "#64748b",
          fontWeight: 600, fontSize: "0.7rem", cursor: "pointer",
        }}
      >
        <ActionIcon type="copy" size="sm" />
        {copied ? "Copied!" : "Copy"}
      </button>
      <button
        onClick={onQr}
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
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={active}
        title={active ? "Link enabled — click to disable" : "Link disabled — click to enable"}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "3px 8px", borderRadius: 6,
          border: active ? `1px solid ${accent}` : "1px solid #e2e8f0",
          background: active ? `${accent}1a` : "#f8fafc",
          color: active ? accent : "#94a3b8",
          fontWeight: 600, fontSize: "0.7rem", cursor: "pointer",
        }}
      >
        {active ? "On" : "Off"}
      </button>
    </div>
  </div>
);

export default AssessmentMappingPanel;
