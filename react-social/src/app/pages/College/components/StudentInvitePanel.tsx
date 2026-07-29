import { useEffect, useMemo, useState } from "react";
import { Form, Spinner, Button, Badge } from "react-bootstrap";
import { QRCodeCanvas } from "qrcode.react";
import {
  getAssessmentSummaryList,
  ensureInviteMapping,
  createStudentInvite,
  getInvitesByInstitute,
  revokeInvite,
  getInviteStudents,
  getInvitePricingTiers,
  StudentInviteRow,
  InviteStudentRow,
} from "../../AssessmentMapping/API/AssessmentMapping_APIs";
import { PricingTier } from "../../B2C/API/PricingTier_APIs";

const ASSESSMENT_APP_URL =
  process.env.REACT_APP_ASSESSMENT_APP_URL || "https://assessment.career-9.com";
const inviteUrl = (token: string) => `${ASSESSMENT_APP_URL}/assessment-invite/${token}`;

interface AssessmentSummary {
  id: number;
  assessmentName: string;
  isActive: boolean;
}

interface Props {
  instituteCode: number;
  instituteName?: string;
  active?: boolean;
}

/**
 * Per-student invite wizard: pick an assessment → choose a reusable B2C pricing
 * tier → pick a student of this institute → generate a student-locked link. The
 * student opens it, sees a pre-filled registration page, pays the tier price, and
 * takes the assessment. (Pricing tiers are managed centrally in B2C → Pricing Tiers.)
 */
const StudentInvitePanel = ({ instituteCode, instituteName }: Props) => {
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [assessmentId, setAssessmentId] = useState<string>("");

  const [mappingId, setMappingId] = useState<number | null>(null);

  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [pricingTierId, setPricingTierId] = useState<string>("");
  const [customPrice, setCustomPrice] = useState<string>("");

  const [students, setStudents] = useState<InviteStudentRow[]>([]);
  const [studentsError, setStudentsError] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentListOpen, setStudentListOpen] = useState(false);
  const [userStudentId, setUserStudentId] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [resolvingMapping, setResolvingMapping] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string>("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<number | null>(null);

  const [invites, setInvites] = useState<StudentInviteRow[]>([]);

  // The reusable B2C pricing tiers are global (not per-institute) — load once.
  useEffect(() => {
    getInvitePricingTiers()
      .then((res) => setPricingTiers((res.data || []).filter((t) => t.tierId != null)))
      .catch(() => setPricingTiers([]));
  }, []);

  // Load assessments + students + existing invites whenever the institute changes.
  useEffect(() => {
    let cancelled = false;
    setAssessmentId("");
    setMappingId(null);
    setPricingTierId("");
    setCustomPrice("");
    setUserStudentId("");
    setGeneratedToken("");
    setError("");

    getAssessmentSummaryList()
      .then((res) => {
        if (cancelled) return;
        const list: AssessmentSummary[] = Array.isArray(res.data) ? res.data : [];
        setAssessments(list.filter((a) => a.isActive !== false));
      })
      .catch(() => !cancelled && setAssessments([]));

    setStudentsError("");
    getInviteStudents(instituteCode)
      .then((res) => !cancelled && setStudents((res.data || []).filter((s) => !s.isDropped)))
      .catch((e) => {
        if (cancelled) return;
        setStudents([]);
        setStudentsError(
          e?.response?.status === 401 || e?.response?.status === 403
            ? "Couldn't load this institute's students — your account may lack the “view institute students” permission."
            : "Couldn't load this institute's students."
        );
      });

    refreshInvites();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteCode]);

  const refreshInvites = () => {
    getInvitesByInstitute(instituteCode)
      .then((res) => setInvites(res.data || []))
      .catch(() => setInvites([]));
  };

  // On assessment select, ensure the INSTITUTE-level mapping the invite registers
  // against (the chosen pricing tier is materialised onto it server-side).
  const handleAssessmentChange = async (value: string) => {
    setAssessmentId(value);
    setMappingId(null);
    setGeneratedToken("");
    setError("");
    if (!value) return;
    setResolvingMapping(true);
    try {
      const res = await ensureInviteMapping(instituteCode, Number(value));
      setMappingId(res.data.mappingId);
    } catch (e: any) {
      setError(readErr(e, "Could not prepare this assessment for invites."));
    } finally {
      setResolvingMapping(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const selectedAssessmentName = useMemo(
    () => assessments.find((a) => String(a.id) === assessmentId)?.assessmentName || "Assessment",
    [assessments, assessmentId]
  );

  const selectedTier = pricingTiers.find((t) => String(t.tierId) === pricingTierId);

  // Only the invites for the currently-selected assessment.
  const invitesForAssessment = useMemo(
    () => invites.filter((inv) => String(inv.assessmentId) === assessmentId),
    [invites, assessmentId]
  );

  const handleGenerate = async () => {
    setError("");
    setGeneratedToken("");
    if (!mappingId || !pricingTierId || !userStudentId) {
      setError("Select an assessment, a pricing tier, and a student.");
      return;
    }
    setBusy(true);
    try {
      const res = await createStudentInvite(
        mappingId,
        Number(pricingTierId),
        Number(userStudentId),
        customPrice.trim() === "" ? undefined : Number(customPrice)
      );
      setGeneratedToken(res.data.token);
      refreshInvites();
    } catch (e: any) {
      setError(readErr(e, "Could not generate the invite link."));
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleCopyInvite = (inv: StudentInviteRow) => {
    navigator.clipboard?.writeText(inviteUrl(inv.token)).then(() => {
      setCopiedInviteId(inv.inviteId);
      setTimeout(() => setCopiedInviteId(null), 1500);
    });
  };

  const handleRevoke = async (inviteId: number) => {
    if (!window.confirm(
      "Revoke this invite link? The student will no longer be able to open or pay with it. This cannot be undone."
    )) return;
    try {
      await revokeInvite(inviteId);
      refreshInvites();
    } catch {
      /* surfaced in the list status on next load */
    }
  };

  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: 16 }}>
        Generate a personalised assessment link for one student of{" "}
        <strong>{instituteName}</strong>. They open it, confirm their pre-filled details,
        pay the tier price, and take the assessment.
      </div>

      {/* Step 1: assessment */}
      <Label>1 · Assessment</Label>
      <Form.Select
        value={assessmentId}
        onChange={(e) => handleAssessmentChange(e.target.value)}
        style={sel}
      >
        <option value="">-- Select an assessment --</option>
        {assessments.map((a) => (
          <option key={a.id} value={a.id}>
            {a.assessmentName}
          </option>
        ))}
      </Form.Select>
      {resolvingMapping && (
        <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 6 }}>
          <Spinner animation="border" size="sm" /> Preparing assessment…
        </div>
      )}

      {/* Selected assessment row. */}
      {mappingId && (
        <div style={assessmentCard}>
          <div>
            <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.95rem" }}>
              {selectedAssessmentName}
            </div>
            <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 2 }}>
              Choose a pricing tier below
            </div>
          </div>
        </div>
      )}

      {/* Step 2: pricing tier (sourced from B2C → Pricing Tiers) */}
      {mappingId && (
        <>
          <Label style={{ marginTop: 20 }}>2 · Pricing tier</Label>
          <Form.Select
            value={pricingTierId}
            onChange={(e) => {
              const id = e.target.value;
              setPricingTierId(id);
              // Default the custom price to the chosen tier's price (admin can override).
              const t = pricingTiers.find((x) => String(x.tierId) === id);
              setCustomPrice(t ? String(t.basePriceInr ?? 0) : "");
            }}
            style={sel}
          >
            <option value="">-- Select a tier --</option>
            {pricingTiers.map((t) => (
              <option key={t.tierId} value={t.tierId}>
                {t.name} — ₹{(t.basePriceInr ?? 0).toLocaleString("en-IN")}
              </option>
            ))}
          </Form.Select>
          {pricingTiers.length === 0 ? (
            <div style={{ fontSize: "0.8rem", color: "#b45309", marginTop: 6 }}>
              No pricing tiers found — create them in <strong>B2C → Pricing Tiers</strong>.
            </div>
          ) : (
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 6 }}>
              Tiers are managed centrally in B2C → Pricing Tiers.
            </div>
          )}

          {/* Custom price — what this student actually pays (defaults to the tier price). */}
          {pricingTierId && (
            <div style={{ marginTop: 16 }}>
              <Label>Custom price (₹)</Label>
              <Form.Control
                type="number"
                min="0"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="Amount the student pays"
                style={sel}
              />
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 6 }}>
                What this student actually pays. Pre-filled with the tier price — change it to charge a custom amount. Set 0 for free.
              </div>
            </div>
          )}
        </>
      )}

      {/* Step 3: student */}
      {mappingId && (
        <>
          <Label style={{ marginTop: 20 }}>3 · Student</Label>
          {/* Type-ahead: matches appear in a list under the box — click one to select. */}
          <div style={{ position: "relative" }}>
            <Form.Control
              type="text"
              placeholder="🔍 Type a name, email or phone…"
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                setUserStudentId("");      // editing the text clears any prior pick
                setStudentListOpen(true);
              }}
              onFocus={() => setStudentListOpen(true)}
              onBlur={() => setTimeout(() => setStudentListOpen(false), 150)}
              style={sel}
            />
            {studentListOpen && students.length > 0 && (
              <div style={comboList}>
                {filteredStudents.length === 0 ? (
                  <div style={{ padding: "10px 14px", color: "#94a3b8", fontSize: "0.84rem" }}>
                    No students match “{studentSearch.trim()}”
                  </div>
                ) : (
                  filteredStudents.slice(0, 50).map((s) => {
                    const selected = String(s.userStudentId) === userStudentId;
                    return (
                      <div
                        key={s.userStudentId}
                        // onMouseDown fires before the input's onBlur, so the pick registers.
                        onMouseDown={() => {
                          setUserStudentId(String(s.userStudentId));
                          setStudentSearch(s.name || "Unnamed");
                          setStudentListOpen(false);
                        }}
                        style={{ ...comboItem, background: selected ? "#eef2ff" : "#fff" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = selected ? "#eef2ff" : "#fff")}
                      >
                        <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.88rem" }}>
                          {s.name || "Unnamed"}
                        </div>
                        {(s.email || s.phone) && (
                          <div style={{ fontSize: "0.76rem", color: "#94a3b8" }}>
                            {[s.email, s.phone].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          {students.length === 0 ? (
            <div style={{ fontSize: "0.8rem", color: "#b45309", marginTop: 6 }}>
              {studentsError || "No students found for this institute."}
            </div>
          ) : userStudentId ? (
            <div style={{ fontSize: "0.78rem", color: "#059669", marginTop: 6 }}>
              ✓ Selected:{" "}
              <strong>{students.find((s) => String(s.userStudentId) === userStudentId)?.name || "student"}</strong>
            </div>
          ) : (
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 6 }}>
              {students.length} students — start typing to find one, then click it.
            </div>
          )}
        </>
      )}

      {/* Generate */}
      {mappingId && (
        <div style={{ marginTop: 22 }}>
          <Button onClick={handleGenerate} disabled={busy}>
            {busy ? (
              <>
                <Spinner animation="border" size="sm" /> Generating…
              </>
            ) : (
              "Generate invite link"
            )}
          </Button>
          {selectedTier && (
            <span style={{ marginLeft: 12, fontSize: "0.82rem", color: "#64748b" }}>
              Student pays ₹{Number(
                customPrice.trim() === "" ? (selectedTier.basePriceInr ?? 0) : customPrice
              ).toLocaleString("en-IN")}
            </span>
          )}
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 12, padding: "10px 14px", background: "#fef2f2",
          border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", fontSize: "0.85rem",
        }}>
          {error}
        </div>
      )}

      {/* Generated link */}
      {generatedToken && (
        <div style={{
          marginTop: 18, background: "#f0fdf4", border: "1.5px solid #a7f3d0",
          borderRadius: 12, padding: "16px 18px",
        }}>
          <div style={{ fontWeight: 700, color: "#065f46", marginBottom: 10 }}>
            Invite link generated
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ background: "#fff", padding: 10, borderRadius: 10, border: "1px solid #d1fae5" }}>
              <QRCodeCanvas value={inviteUrl(generatedToken)} size={104} />
            </div>
            <div style={{ flex: "1 1 280px", minWidth: 240 }}>
              <div style={{
                fontFamily: "monospace", fontSize: "0.82rem", color: "#1e293b",
                background: "#fff", border: "1px solid #d1fae5", borderRadius: 8,
                padding: "8px 12px", wordBreak: "break-all",
              }}>
                {inviteUrl(generatedToken)}
              </div>
              <Button
                variant="success"
                size="sm"
                style={{ marginTop: 10 }}
                onClick={() => handleCopy(inviteUrl(generatedToken))}
              >
                {copied ? "Copied!" : "Copy link"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Existing invites — only once an assessment is chosen, scoped to that assessment. */}
      {assessmentId && (
      <div style={{ marginTop: 28 }}>
        <Label>Generated invites for this assessment</Label>
        {invitesForAssessment.length > 0 && (
          <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: -4, marginBottom: 8 }}>
            <strong>Copy link</strong> copies the student's personal assessment link to share with them.{" "}
            <strong>Revoke</strong> permanently disables a link so it can no longer be opened or paid with.
          </div>
        )}
        {invitesForAssessment.length === 0 ? (
          <div style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: 6 }}>
            No invites generated yet for this assessment.
          </div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={th}>Student</th>
                  <th style={th}>Assessment</th>
                  <th style={th}>Tier</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Status</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitesForAssessment.map((inv) => (
                  <tr key={inv.inviteId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: "#1e293b" }}>{inv.studentName || "—"}</div>
                      <div style={{ color: "#94a3b8", fontSize: "0.78rem" }}>{inv.studentEmail}</div>
                    </td>
                    <td style={td}>{inv.assessmentName || inv.assessmentId}</td>
                    <td style={td}>{inv.tierName || "—"}</td>
                    <td style={td}>₹{(inv.amount ?? 0).toLocaleString("en-IN")}</td>
                    <td style={td}>
                      <Badge bg={statusColor(inv.status)}>{inv.status}</Badge>
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button
                          variant={copiedInviteId === inv.inviteId ? "success" : "primary"}
                          size="sm"
                          title="Copy this student's invite link so you can share it with them"
                          onClick={() => handleCopyInvite(inv)}
                        >
                          {copiedInviteId === inv.inviteId ? "✓ Copied!" : "Copy link"}
                        </Button>
                        {inv.status !== "REVOKED" && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            title="Disable this link — the student can no longer open or pay with it"
                            onClick={() => handleRevoke(inv.inviteId)}
                          >
                            Revoke
                          </Button>
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
      )}
    </div>
  );
};

const statusColor = (status: string) => {
  if (status === "PAID") return "success";
  if (status === "REVOKED") return "secondary";
  return "warning";
};

function readErr(e: any, fallback: string): string {
  const d = e?.response?.data;
  if (typeof d === "string" && d) return d;
  if (d?.message) return d.message;
  const status = e?.response?.status;
  return status ? `${fallback} (HTTP ${status})` : fallback;
}

const Label = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem", color: "#475569", marginBottom: 8, display: "block", ...style }}>
    {children}
  </Form.Label>
);

const sel: React.CSSProperties = {
  padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: "0.9rem",
};
const assessmentCard: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
  padding: "14px 18px", marginTop: 12,
  background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12,
};
const comboList: React.CSSProperties = {
  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
  background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10,
  boxShadow: "0 8px 24px rgba(0,0,0,0.10)", maxHeight: 260, overflowY: "auto",
};
const comboItem: React.CSSProperties = {
  padding: "9px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9",
};
const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 600, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px", verticalAlign: "top" };

export default StudentInvitePanel;
