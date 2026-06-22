import { useEffect, useState } from "react";
import { Modal, Button, Form, Spinner, Badge } from "react-bootstrap";
import { MdEdit, MdDelete, MdDownload } from "react-icons/md";
import * as XLSX from "xlsx";
import {
  createReferralCode,
  getAllReferralCodes,
  updateReferralCode,
  deleteReferralCode,
  getReferralCodeAssessments,
  getReferralInstitutes,
  getReferredStudents,
} from "./API/ReferralCode_APIs";
import { showErrorToast, showSuccessToast } from "../../utils/toast";
import PageHeader from "../../components/PageHeader";
import InstituteAssessmentPicker from "./components/InstituteAssessmentPicker";

interface ReferralCodeItem {
  id: number;
  code: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  instituteCode: number;
  description: string | null;
  isActive: boolean;
  expiresAt: string | null;
  maxUses: number | null;
  currentUses: number;
  createdAt: string;
}

const inputStyle = { padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0" };
const labelStyle = { fontWeight: 600, fontSize: "0.85rem", color: "#475569" };

const ReferralCodePage = () => {
  const [referralCodes, setReferralCodes] = useState<ReferralCodeItem[]>([]);
  const [instituteNames, setInstituteNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ReferralCodeItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Form fields
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [instituteCode, setInstituteCode] = useState<number | "">("");
  const [assessmentIds, setAssessmentIds] = useState<number[]>([]);
  const [description, setDescription] = useState("");
  const [maxUses, setMaxUses] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");

  useEffect(() => {
    loadReferralCodes();
    getReferralInstitutes()
      .then((res) => {
        const map: Record<number, string> = {};
        (res.data || []).forEach((i: any) => { map[i.instituteCode] = i.instituteName; });
        setInstituteNames(map);
      })
      .catch(() => {});
  }, []);

  const loadReferralCodes = async () => {
    try {
      const res = await getAllReferralCodes();
      setReferralCodes(res.data || []);
    } catch (err) {
      console.error("Failed to load referral codes:", err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditing(null);
    setCode(""); setName(""); setPhone(""); setEmail("");
    setInstituteCode(""); setAssessmentIds([]);
    setDescription(""); setMaxUses(""); setExpiresAt("");
    setShowModal(true);
  };

  const openEditModal = async (rc: ReferralCodeItem) => {
    setEditing(rc);
    setCode(rc.code);
    setName(rc.name || "");
    setPhone(rc.phone || "");
    setEmail(rc.email || "");
    setInstituteCode(rc.instituteCode);
    setDescription(rc.description || "");
    setMaxUses(rc.maxUses != null ? String(rc.maxUses) : "");
    setExpiresAt(rc.expiresAt ? formatDateForInput(rc.expiresAt) : "");
    setAssessmentIds([]);
    setShowModal(true);
    try {
      const res = await getReferralCodeAssessments(rc.id);
      setAssessmentIds(res.data || []);
    } catch {
      // ignore
    }
  };

  const formatDateForInput = (dateStr: string) => {
    try {
      const parts = dateStr.split(" ")[0].split("-");
      if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`; // yyyy-MM-dd
    } catch {}
    return "";
  };

  const handleSubmit = async () => {
    if (!code.trim()) { showErrorToast("Referral code is required"); return; }
    if (instituteCode === "") { showErrorToast("Please select an institute"); return; }
    if (assessmentIds.length === 0) { showErrorToast("Select at least one assessment"); return; }

    setSubmitting(true);
    try {
      const data: any = {
        code: code.trim().toUpperCase(),
        name: name.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        instituteCode: Number(instituteCode),
        assessmentIds,
        description: description.trim() || null,
        maxUses: maxUses ? Number(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt + "T23:59:59").getTime() : null,
      };

      if (editing) {
        await updateReferralCode(editing.id, data);
      } else {
        await createReferralCode(data);
      }
      setShowModal(false);
      loadReferralCodes();
    } catch (err: any) {
      showErrorToast(err.response?.data || "Failed to save referral code");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this referral code?")) return;
    try {
      await deleteReferralCode(id);
      setReferralCodes(referralCodes.filter((p) => p.id !== id));
    } catch (err) {
      showErrorToast("Failed to delete referral code");
    }
  };

  const handleToggleActive = async (rc: ReferralCodeItem) => {
    try {
      await updateReferralCode(rc.id, { isActive: !rc.isActive });
      setReferralCodes(referralCodes.map((p) => (p.id === rc.id ? { ...p, isActive: !p.isActive } : p)));
    } catch (err) {
      showErrorToast("Failed to update referral code");
    }
  };

  const handleDownloadStudents = async (rc: ReferralCodeItem) => {
    setDownloadingId(rc.id);
    try {
      const res = await getReferredStudents(rc.id);
      const students: any[] = res.data || [];
      if (students.length === 0) {
        showErrorToast("No students have used this referral code yet.");
        return;
      }
      const excelData = students.map((s, idx) => ({
        "S.No": idx + 1,
        "Student Name": s.studentName || "",
        "Email": s.email || "",
        "Phone": s.phone || "",
        "Institute": s.instituteName || "",
        "Assessment": s.assessmentName || "",
        "Registered At": s.registeredAt ? String(s.registeredAt).split(" ")[0] : "",
      }));
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      worksheet["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 28 }, { wch: 16 }, { wch: 30 }, { wch: 30 }, { wch: 16 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Referred Students");
      XLSX.writeFile(workbook, `Referral_${rc.code}_students.xlsx`);
      showSuccessToast("Download started!");
    } catch (err) {
      showErrorToast("Failed to download students.");
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (dateStr: string | null) => (!dateStr ? "—" : dateStr.split(" ")[0]);

  const isExpired = (rc: ReferralCodeItem) => {
    if (!rc.expiresAt) return false;
    try {
      const parts = rc.expiresAt.split(" ")[0].split("-");
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`) < new Date();
    } catch { return false; }
  };

  const isMaxedOut = (rc: ReferralCodeItem) =>
    rc.maxUses != null && rc.currentUses >= rc.maxUses;

  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-people" />}
        title="Referral Codes"
        subtitle={<><strong>{referralCodes.length}</strong> codes · Track student referrals per assessment</>}
        actions={[
          {
            label: "Create Referral Code",
            iconClass: "bi-plus-lg",
            onClick: openCreateModal,
            variant: "primary",
          },
        ]}
      />

      <div style={{
        background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflow: "hidden",
      }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0", color: "#64748b" }}>
            <Spinner animation="border" size="sm" style={{ marginRight: 12 }} />
            Loading...
          </div>
        ) : referralCodes.length === 0 ? (
          <div style={{ padding: "64px 24px", textAlign: "center", color: "#94a3b8" }}>
            No referral codes yet. Create one to get started.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Code", "Referrer", "Institute", "Usage", "Expires", "Status", "Actions"].map((h) => (
                  <th key={h} style={{
                    padding: "14px 18px", fontWeight: 700, fontSize: "0.78rem",
                    color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em",
                    borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {referralCodes.map((rc, idx) => (
                <tr
                  key={rc.id}
                  style={{ background: idx % 2 === 0 ? "#fff" : "#fafbfc", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4ff")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#fafbfc")}
                >
                  <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: "0.9rem", color: "#1e293b", fontFamily: "monospace" }}>
                    {rc.code}
                  </td>
                  <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", fontSize: "0.85rem", color: "#475569" }}>
                    <div style={{ fontWeight: 600, color: "#1e293b" }}>{rc.name || "—"}</div>
                    <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                      {rc.phone || ""}{rc.phone && rc.email ? " · " : ""}{rc.email || ""}
                    </div>
                  </td>
                  <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", fontSize: "0.85rem", color: "#475569" }}>
                    {instituteNames[rc.instituteCode] || `#${rc.instituteCode}`}
                  </td>
                  <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", fontSize: "0.85rem", color: "#475569" }}>
                    {rc.currentUses}{rc.maxUses != null ? ` / ${rc.maxUses}` : " / Unlimited"}
                  </td>
                  <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", fontSize: "0.85rem", color: isExpired(rc) ? "#dc2626" : "#475569" }}>
                    {formatDate(rc.expiresAt)}
                    {isExpired(rc) && <Badge bg="danger" className="ms-2" style={{ fontSize: "0.7rem" }}>Expired</Badge>}
                  </td>
                  <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                    <span
                      onClick={() => handleToggleActive(rc)}
                      style={{
                        background: rc.isActive && !isExpired(rc) && !isMaxedOut(rc) ? "#dcfce7" : "#f1f5f9",
                        color: rc.isActive && !isExpired(rc) && !isMaxedOut(rc) ? "#059669" : "#94a3b8",
                        padding: "5px 14px", borderRadius: 20, fontWeight: 600, fontSize: "0.78rem",
                        cursor: "pointer", display: "inline-block",
                      }}
                    >
                      {!rc.isActive ? "Inactive" : isExpired(rc) ? "Expired" : isMaxedOut(rc) ? "Maxed Out" : "Active"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleDownloadStudents(rc)}
                        title="Download referred students (Excel)"
                        disabled={downloadingId === rc.id}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "6px 12px", borderRadius: 8,
                          border: "1.5px solid #bbf7d0", background: "#fff",
                          color: "#059669", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600,
                        }}
                      >
                        {downloadingId === rc.id ? <Spinner animation="border" size="sm" /> : <MdDownload size={14} />}
                        Students
                      </button>
                      <button
                        onClick={() => openEditModal(rc)}
                        title="Edit"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "6px 12px", borderRadius: 8,
                          border: "1.5px solid #e2e8f0", background: "#fff",
                          color: "#475569", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600,
                        }}
                      >
                        <MdEdit size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(rc.id)}
                        title="Delete"
                        style={{
                          display: "inline-flex", alignItems: "center",
                          padding: "6px 12px", borderRadius: 8,
                          border: "1.5px solid #fee2e2", background: "#fff",
                          color: "#ef4444", cursor: "pointer",
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
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton style={{
          background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
          borderBottom: "none", padding: "24px 32px",
        }}>
          <Modal.Title style={{ color: "#fff", fontWeight: 700, fontSize: "1.15rem" }}>
            {editing ? "Edit Referral Code" : "Create Referral Code"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body style={{ padding: "28px 32px" }}>
          <Form.Group className="mb-3">
            <Form.Label style={labelStyle}>Code <span style={{ color: "#ef4444" }}>*</span></Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g. RAVI2026"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              style={{ ...inputStyle, fontFamily: "monospace", fontWeight: 600 }}
            />
          </Form.Group>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Form.Group className="mb-3">
              <Form.Label style={labelStyle}>Referrer Name</Form.Label>
              <Form.Control type="text" placeholder="Full name" value={name}
                onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label style={labelStyle}>Phone</Form.Label>
              <Form.Control type="text" placeholder="Phone number" value={phone}
                onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
            </Form.Group>
          </div>

          <Form.Group className="mb-3">
            <Form.Label style={labelStyle}>Email</Form.Label>
            <Form.Control type="email" placeholder="email@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </Form.Group>

          <InstituteAssessmentPicker
            instituteCode={instituteCode}
            onInstituteChange={setInstituteCode}
            selectedAssessmentIds={assessmentIds}
            onAssessmentsChange={setAssessmentIds}
          />

          <Form.Group className="mt-3 mb-3">
            <Form.Label style={labelStyle}>Description</Form.Label>
            <Form.Control type="text" placeholder="Optional note" value={description}
              onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
          </Form.Group>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Form.Group>
              <Form.Label style={labelStyle}>Max Uses</Form.Label>
              <Form.Control type="number" placeholder="Unlimited" value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)} min="1" style={inputStyle} />
            </Form.Group>
            <Form.Group>
              <Form.Label style={labelStyle}>Expires On</Form.Label>
              <Form.Control type="date" value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)} style={inputStyle} />
            </Form.Group>
          </div>
        </Modal.Body>

        <Modal.Footer style={{ padding: "16px 32px", borderTop: "1px solid #e2e8f0" }}>
          <Button variant="secondary" onClick={() => setShowModal(false)} style={{
            borderRadius: 10, padding: "8px 24px", fontWeight: 600,
            background: "#f1f5f9", border: "1.5px solid #e2e8f0", color: "#475569",
          }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} style={{
            background: submitting ? "#94a3b8" : "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
            border: "none", borderRadius: 10, padding: "8px 24px",
            fontWeight: 600, boxShadow: submitting ? "none" : "0 4px 14px rgba(67, 97, 238, 0.3)",
          }}>
            {submitting ? (<><Spinner animation="border" size="sm" className="me-2" />Saving...</>) : editing ? "Update" : "Create"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ReferralCodePage;
