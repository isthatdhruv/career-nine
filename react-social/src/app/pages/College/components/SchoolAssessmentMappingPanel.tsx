import { useEffect, useState, useCallback } from "react";
import { Button, Form, Spinner } from "react-bootstrap";
import { MdQrCode } from "react-icons/md";
import { ActionIcon } from "../../../components/ActionIcon";
import { QRCodeCanvas } from "qrcode.react";
import { GetSessionsByInstituteCode } from "../API/College_APIs";
import {
  batchSaveSchoolConfigs,
  getSchoolConfigs,
  generateSchoolLink,
  getSchoolLink,
  toggleSchoolLink,
} from "../../SchoolRegistration/API/SchoolRegistration_APIs";
import { getAssessmentSummaryList } from "../../AssessmentMapping/API/AssessmentMapping_APIs";
import { showErrorToast } from "../../../utils/toast";
import SchoolTierManagementModal from "./SchoolTierManagementModal";

interface Props {
  instituteCode: number;
  instituteName: string;
  active?: boolean;
}

const SchoolAssessmentMappingPanel = ({ instituteCode, instituteName, active = true }: Props) => {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [classConfigs, setClassConfigs] = useState<Record<string, { assessmentId: string; configId?: number }>>({});

  const [bulkSelectedClasses, setBulkSelectedClasses] = useState<Set<string>>(new Set());
  const [bulkAssessmentId, setBulkAssessmentId] = useState<string>("");

  const [link, setLink] = useState<any>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const [tierModalAssessmentId, setTierModalAssessmentId] = useState<number | null>(null);

  const selectedSessionObj = sessions.find((s: any) => String(s.id) === selectedSession);
  const classes: any[] = selectedSessionObj?.schoolClasses || [];

  useEffect(() => {
    if (active && instituteCode) {
      loadInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, instituteCode]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [assessmentRes, sessionRes] = await Promise.all([
        getAssessmentSummaryList(),
        GetSessionsByInstituteCode(instituteCode),
      ]);
      setAssessments((assessmentRes.data || []).filter((a: any) => a.isActive !== false));
      setSessions(sessionRes.data || []);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadConfigsForSession = async (sessionId: string) => {
    if (!sessionId) return;
    try {
      const [configRes, linkRes] = await Promise.all([
        getSchoolConfigs(instituteCode, Number(sessionId)),
        getSchoolLink(instituteCode, Number(sessionId)),
      ]);

      const configs: Record<string, { assessmentId: string; configId?: number }> = {};
      for (const c of configRes.data || []) {
        configs[String(c.classId)] = {
          assessmentId: String(c.assessmentId),
          configId: c.configId,
        };
      }
      setClassConfigs(configs);
      setLink(linkRes.data || null);
    } catch {
      setClassConfigs({});
      setLink(null);
    }
  };

  const handleSessionChange = (val: string) => {
    setSelectedSession(val);
    setClassConfigs({});
    setLink(null);
    if (val) loadConfigsForSession(val);
  };

  const updateClassConfig = (classId: string, field: "assessmentId", value: string) => {
    setClassConfigs((prev) => ({
      ...prev,
      [classId]: { ...prev[classId], [field]: value },
    }));
  };

  const toggleBulkClass = (classId: string) => {
    setBulkSelectedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  const toggleBulkSelectAll = () => {
    if (bulkSelectedClasses.size === classes.length) {
      setBulkSelectedClasses(new Set());
    } else {
      setBulkSelectedClasses(new Set(classes.map((c: any) => String(c.id))));
    }
  };

  const handleApplyBulk = () => {
    if (!bulkAssessmentId) {
      showErrorToast("Please select an assessment to bulk apply");
      return;
    }
    if (bulkSelectedClasses.size === 0) {
      showErrorToast("Please select at least one class");
      return;
    }
    setClassConfigs((prev) => {
      const next = { ...prev };
      bulkSelectedClasses.forEach((classId) => {
        next[classId] = {
          ...next[classId],
          assessmentId: bulkAssessmentId,
        };
      });
      return next;
    });
    setBulkSelectedClasses(new Set());
    setBulkAssessmentId("");
  };

  const handleSaveAll = async () => {
    if (!selectedSession) return;

    const configs: { classId: number; assessmentId: number }[] = classes
      .filter((c: any) => classConfigs[String(c.id)]?.assessmentId)
      .map((c: any) => {
        const cfg = classConfigs[String(c.id)];
        return {
          classId: c.id,
          assessmentId: Number(cfg.assessmentId),
        };
      });

    if (configs.length === 0) {
      showErrorToast("Please map at least one class to an assessment");
      return;
    }

    setSaving(true);
    try {
      await batchSaveSchoolConfigs({
        instituteCode,
        sessionId: Number(selectedSession),
        configs,
      });
      await loadConfigsForSession(selectedSession);
    } catch (error: any) {
      showErrorToast("Failed to save: " + (error.response?.data || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!selectedSession) return;
    try {
      const res = await generateSchoolLink({
        instituteCode,
        sessionId: Number(selectedSession),
      });
      setLink(res.data);
    } catch (error) {
      showErrorToast("Failed to generate link");
    }
  };

  const handleToggleLink = async () => {
    if (!link?.linkId) return;
    try {
      const res = await toggleSchoolLink(link.linkId);
      setLink(res.data);
    } catch (error) {
      showErrorToast("Failed to toggle link");
    }
  };

  const getRegistrationUrl = () => {
    if (!link?.token) return "";
    return `${process.env.REACT_APP_URL}/school-register/${link.token}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getRegistrationUrl());
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const downloadQrCode = useCallback(() => {
    const canvas = document.getElementById("school-qr-canvas") as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `QR_School_${instituteName.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
    a.click();
  }, [instituteName]);

  return (
    <div style={{ padding: "32px", background: "#f8fafc", borderRadius: 12 }}>
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0", color: "#64748b" }}>
          <Spinner animation="border" size="sm" style={{ marginRight: 12 }} />
          Loading data...
        </div>
      ) : (
        <>
          {/* Session Selector */}
          <div style={{
            background: "#fff", borderRadius: 16, padding: "24px 28px",
            border: "1px solid #e2e8f0", marginBottom: 24,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <Form.Label style={{ fontWeight: 600, fontSize: "0.82rem", color: "#475569", marginBottom: 8 }}>
              Select Session
            </Form.Label>
            <Form.Select
              value={selectedSession}
              onChange={(e) => handleSessionChange(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: "0.9rem" }}
            >
              <option value="">-- Select session --</option>
              {sessions.map((s: any) => (
                <option key={s.id} value={s.id}>{s.sessionYear}</option>
              ))}
            </Form.Select>
          </div>

          {/* Bulk Assign Section */}
          {selectedSession && classes.length > 0 && (
            <div style={{
              background: "linear-gradient(135deg, #eff6ff, #f0f9ff)",
              borderRadius: 16, padding: "20px 24px",
              border: "1.5px dashed #93c5fd", marginBottom: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
                <h6 style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "#1e3a8a" }}>
                  Bulk Assign
                </h6>
                <span style={{ fontSize: "0.78rem", color: "#3b82f6", fontWeight: 500 }}>
                  Select multiple classes &amp; apply one assessment. Pricing is set per assessment below.
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
                <div>
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.75rem", color: "#475569", marginBottom: 6 }}>
                    Assessment
                  </Form.Label>
                  <Form.Select
                    value={bulkAssessmentId}
                    onChange={(e) => setBulkAssessmentId(e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #bfdbfe", fontSize: "0.85rem", background: "#fff" }}
                  >
                    <option value="">-- Select assessment --</option>
                    {assessments.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.AssessmentName || a.assessmentName}</option>
                    ))}
                  </Form.Select>
                </div>
                <Button
                  onClick={handleApplyBulk}
                  disabled={!bulkAssessmentId || bulkSelectedClasses.size === 0}
                  style={{
                    background: !bulkAssessmentId || bulkSelectedClasses.size === 0
                      ? "#94a3b8"
                      : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    border: "none", borderRadius: 10, padding: "9px 20px",
                    fontWeight: 600, fontSize: "0.85rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  Apply to {bulkSelectedClasses.size || "selected"}
                </Button>
              </div>
              {bulkSelectedClasses.size > 0 && (
                <div style={{ fontSize: "0.78rem", color: "#1e40af", marginTop: 10, fontWeight: 500 }}>
                  {bulkSelectedClasses.size} class{bulkSelectedClasses.size !== 1 ? "es" : ""} selected
                </div>
              )}
            </div>
          )}

          {/* Class-Assessment Mapping Table */}
          {selectedSession && classes.length > 0 && (
            <div style={{
              background: "#fff", borderRadius: 16, padding: "24px 28px",
              border: "1px solid #e2e8f0", marginBottom: 24,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                  <h6 style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>
                    Class → Assessment Mapping
                  </h6>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{
                    background: "#dcfce7", color: "#065f46",
                    padding: "4px 12px", borderRadius: 20,
                    fontSize: "0.78rem", fontWeight: 600,
                  }}>
                    {Object.values(classConfigs).filter((c) => c.configId).length} saved
                  </span>
                  <span style={{
                    background: "#f1f5f9", color: "#475569",
                    padding: "4px 12px", borderRadius: 20,
                    fontSize: "0.78rem", fontWeight: 600,
                  }}>
                    {classes.length} total
                  </span>
                </div>
              </div>

              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{
                        padding: "12px 16px", fontWeight: 700, fontSize: "0.78rem",
                        color: "#64748b", borderBottom: "2px solid #e2e8f0", width: 40,
                      }}>
                        <input
                          type="checkbox"
                          checked={bulkSelectedClasses.size === classes.length && classes.length > 0}
                          onChange={toggleBulkSelectAll}
                          style={{ cursor: "pointer", width: 16, height: 16 }}
                          title="Select all"
                        />
                      </th>
                      {["Class", "Assessment", "Status"].map((h) => (
                        <th key={h} style={{
                          padding: "12px 16px", fontWeight: 700, fontSize: "0.78rem",
                          color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.05em",
                          borderBottom: "2px solid #e2e8f0",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((cls: any) => {
                      const cfg = classConfigs[String(cls.id)] || { assessmentId: "" };
                      const isSelected = bulkSelectedClasses.has(String(cls.id));
                      return (
                        <tr key={cls.id} style={{
                          borderBottom: "1px solid #f1f5f9",
                          background: isSelected ? "#eff6ff" : "transparent",
                        }}>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleBulkClass(String(cls.id))}
                              style={{ cursor: "pointer", width: 16, height: 16 }}
                            />
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: "0.9rem", color: "#1e293b" }}>
                            {cls.className}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <Form.Select
                              value={cfg.assessmentId}
                              onChange={(e) => updateClassConfig(String(cls.id), "assessmentId", e.target.value)}
                              style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.85rem" }}
                            >
                              <option value="">-- No assessment --</option>
                              {assessments.map((a: any) => (
                                <option key={a.id} value={a.id}>
                                  {a.AssessmentName || a.assessmentName}
                                </option>
                              ))}
                            </Form.Select>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            {cfg.configId ? (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                background: "#dcfce7", color: "#065f46",
                                padding: "4px 10px", borderRadius: 20,
                                fontSize: "0.72rem", fontWeight: 700,
                              }}>
                                &#10003; Saved
                              </span>
                            ) : cfg.assessmentId ? (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                background: "#fef3c7", color: "#92400e",
                                padding: "4px 10px", borderRadius: 20,
                                fontSize: "0.72rem", fontWeight: 700,
                              }}>
                                Unsaved
                              </span>
                            ) : (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                background: "#f1f5f9", color: "#94a3b8",
                                padding: "4px 10px", borderRadius: 20,
                                fontSize: "0.72rem", fontWeight: 700,
                              }}>
                                Not mapped
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 20 }}>
                <Button
                  onClick={handleSaveAll}
                  disabled={saving}
                  style={{
                    background: saving
                      ? "#94a3b8"
                      : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    border: "none", borderRadius: 10, padding: "10px 24px",
                    fontWeight: 600, fontSize: "0.9rem",
                    boxShadow: saving ? "none" : "0 4px 14px rgba(16, 185, 129, 0.3)",
                  }}
                >
                  {saving ? (
                    <><Spinner animation="border" size="sm" style={{ marginRight: 8 }} />Saving...</>
                  ) : (
                    <><span style={{ marginRight: 8 }}><ActionIcon type="approve" size="sm" /></span>Save All Mappings</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Assessment Tiers Section — pricing + caps per unique assessment mapped above */}
          {selectedSession && (
            <div style={{
              background: "#fff", borderRadius: 16, padding: "24px 28px",
              border: "1px solid #e2e8f0", marginBottom: 24,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4361ee" }} />
                  <h6 style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>
                    Assessment Tiers
                  </h6>
                </div>
                <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 500 }}>
                  Pricing &amp; registration caps come from tiers — required before students can register.
                </span>
              </div>

              {(() => {
                const uniqueAssessments = Array.from(new Set(
                  Object.values(classConfigs)
                    .map((c) => c.assessmentId)
                    .filter((id) => id)
                )).map((id) => {
                  const a = assessments.find((x: any) => String(x.id) === String(id));
                  return {
                    id: Number(id),
                    name: a ? (a.AssessmentName || a.assessmentName) : `Assessment #${id}`,
                  };
                });

                if (uniqueAssessments.length === 0) {
                  return (
                    <div style={{
                      padding: "24px", textAlign: "center",
                      border: "2px dashed #e2e8f0", borderRadius: 12, color: "#94a3b8",
                      fontSize: "0.85rem",
                    }}>
                      Map at least one class to an assessment above, then configure tiers per assessment here.
                    </div>
                  );
                }

                return (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Assessment", ""].map((h) => (
                          <th key={h} style={{
                            padding: "10px 12px", fontWeight: 700, fontSize: "0.75rem",
                            color: "#64748b", textAlign: "left", borderBottom: "2px solid #e2e8f0",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uniqueAssessments.map((a) => (
                        <tr key={a.id}>
                          <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", fontWeight: 600, color: "#1e293b" }}>
                            {a.name}
                          </td>
                          <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>
                            <button
                              onClick={() => setTierModalAssessmentId(a.id)}
                              style={{
                                padding: "5px 14px", borderRadius: 8,
                                border: "1.5px solid #e2e8f0", background: "#f8fafc",
                                color: "#4361ee", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer",
                              }}
                            >
                              Manage Tiers
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          )}

          {/* Registration Link Section */}
          {selectedSession && (
            <div style={{
              background: "#fff", borderRadius: 16, padding: "24px 28px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
                <h6 style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>
                  Registration Link
                </h6>
              </div>

              {!link?.token ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
                    Pricing and registration caps are set per assessment in the Assessment Tiers section above.
                  </div>
                  <Button
                    onClick={handleGenerateLink}
                    style={{
                      background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                      border: "none", borderRadius: 10, padding: "10px 24px",
                      fontWeight: 600, fontSize: "0.9rem",
                      boxShadow: "0 4px 14px rgba(59, 130, 246, 0.3)",
                      alignSelf: "flex-start",
                    }}
                  >
                    Generate School Registration Link
                  </Button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Status row — prominent on/off toggle so admins can immediately
                      fix the public "Link Unavailable" screen by flipping it back on. */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                    padding: "12px 16px", borderRadius: 10,
                    background: link.isActive ? "#ecfdf5" : "#fef2f2",
                    border: `1.5px solid ${link.isActive ? "#a7f3d0" : "#fecaca"}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                      <span style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: link.isActive ? "#10b981" : "#ef4444",
                        boxShadow: link.isActive
                          ? "0 0 0 4px rgba(16, 185, 129, 0.15)"
                          : "0 0 0 4px rgba(239, 68, 68, 0.15)",
                      }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.88rem", color: link.isActive ? "#065f46" : "#991b1b" }}>
                          {link.isActive ? "Link enabled" : "Link disabled"}
                        </div>
                        <div style={{ fontSize: "0.74rem", color: link.isActive ? "#047857" : "#b91c1c", marginTop: 2 }}>
                          {link.isActive
                            ? "Students can open this URL and register."
                            : "Students see “Link Unavailable”. Turn on to re-enable."}
                        </div>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={!!link.isActive}
                      onChange={handleToggleLink}
                      ariaLabel="Toggle school registration link"
                    />
                  </div>

                  <div style={{
                    fontSize: "0.82rem", color: "#64748b",
                    padding: "10px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
                  }}>
                    Pricing and per-assessment caps are managed in the Assessment Tiers section above.
                    Per-tier registration counts are visible inside each assessment&rsquo;s tier modal.
                  </div>
                  <a
                    href={getRegistrationUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: "0.82rem",
                      color: link.isActive ? "#2563eb" : "#94a3b8",
                      wordBreak: "break-all",
                      lineHeight: 1.5,
                      textDecoration: link.isActive ? "none" : "line-through",
                    }}
                    onMouseEnter={(e) => { if (link.isActive) e.currentTarget.style.textDecoration = "underline"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = link.isActive ? "none" : "line-through"; }}
                  >
                    {getRegistrationUrl()}
                  </a>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={copyToClipboard}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "6px 14px", borderRadius: 8,
                        border: copySuccess ? "1.5px solid #059669" : "1.5px solid #e2e8f0",
                        background: copySuccess ? "#dcfce7" : "#fff",
                        color: copySuccess ? "#059669" : "#475569",
                        fontWeight: 600, fontSize: "0.78rem", cursor: "pointer",
                      }}
                    >
                      <ActionIcon type="copy" size="sm" />
                      {copySuccess ? "Copied!" : "Copy URL"}
                    </button>
                    <button
                      onClick={() => setShowQr(!showQr)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "6px 14px", borderRadius: 8,
                        border: "1.5px solid #e2e8f0", background: "#fff",
                        color: "#475569", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer",
                      }}
                    >
                      <MdQrCode size={14} />
                      {showQr ? "Hide QR" : "Show QR"}
                    </button>
                  </div>

                  {showQr && (
                    <div style={{ textAlign: "center", marginTop: 12 }}>
                      <div style={{
                        display: "inline-block", padding: 16, background: "#fff",
                        borderRadius: 16, border: "1px solid #e2e8f0",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                      }}>
                        <QRCodeCanvas
                          id="school-qr-canvas"
                          value={getRegistrationUrl()}
                          size={200}
                          level="H"
                          includeMargin
                        />
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <button
                          onClick={downloadQrCode}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "8px 18px", borderRadius: 8,
                            border: "none",
                            background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                            color: "#fff", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer",
                          }}
                        >
                          <ActionIcon type="download" size="sm" />
                          Download QR
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tierModalAssessmentId !== null && selectedSession && (
        <SchoolTierManagementModal
          instituteCode={instituteCode}
          sessionId={Number(selectedSession)}
          assessmentId={tierModalAssessmentId}
          assessmentName={(() => {
            const a = assessments.find((x: any) => Number(x.id) === tierModalAssessmentId);
            return a ? (a.AssessmentName || a.assessmentName) : undefined;
          })()}
          show={tierModalAssessmentId !== null}
          onHide={() => setTierModalAssessmentId(null)}
        />
      )}
    </div>
  );
};

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  ariaLabel?: string;
}

const ToggleSwitch = ({ checked, onChange, ariaLabel }: ToggleSwitchProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={onChange}
    style={{
      position: "relative",
      width: 48,
      height: 26,
      borderRadius: 999,
      border: "none",
      padding: 0,
      cursor: "pointer",
      background: checked ? "#10b981" : "#cbd5e1",
      transition: "background 0.2s ease",
      flexShrink: 0,
    }}
  >
    <span
      style={{
        position: "absolute",
        top: 3,
        left: checked ? 25 : 3,
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        transition: "left 0.2s ease",
      }}
    />
  </button>
);

export default SchoolAssessmentMappingPanel;
