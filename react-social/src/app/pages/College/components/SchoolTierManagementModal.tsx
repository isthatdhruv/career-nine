import { useEffect, useState, useCallback } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import {
  SchoolAssessmentTier,
  getSchoolTiers,
  createSchoolTier,
  updateSchoolTier,
  toggleSchoolTier,
  deleteSchoolTier,
} from "../../SchoolRegistration/API/SchoolRegistration_APIs";
import { showErrorToast } from "../../../utils/toast";

interface Props {
  instituteCode: number;
  sessionId: number;
  assessmentId: number;
  assessmentName?: string;
  show: boolean;
  onHide: () => void;
}

const emptyForm: SchoolAssessmentTier = {
  name: "",
  description: "",
  amount: 0,
  sortOrder: 1,
  maxRegistrations: null,
  isActive: true,
};

const SchoolTierManagementModal = ({
  instituteCode,
  sessionId,
  assessmentId,
  assessmentName,
  show,
  onHide,
}: Props) => {
  const [tiers, setTiers] = useState<SchoolAssessmentTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<SchoolAssessmentTier>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!instituteCode || !sessionId || !assessmentId) return;
    setLoading(true);
    try {
      const res = await getSchoolTiers(instituteCode, sessionId, assessmentId);
      setTiers(res.data || []);
    } catch (e) {
      console.error("Failed to load school tiers", e);
    } finally {
      setLoading(false);
    }
  }, [instituteCode, sessionId, assessmentId]);

  useEffect(() => {
    if (show) load();
  }, [show, load]);

  const openAdd = () => {
    const nextSort = tiers.length
      ? Math.max(...tiers.map((t) => t.sortOrder || 0)) + 1
      : 1;
    setForm({ ...emptyForm, sortOrder: nextSort });
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (t: SchoolAssessmentTier) => {
    setForm({ ...t });
    setEditingId(t.tierId ?? null);
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      showErrorToast("Tier name is required");
      return;
    }
    if (!form.description || !form.description.trim()) {
      showErrorToast("Tier description is required");
      return;
    }
    if (form.description.trim().length > 200) {
      showErrorToast("Tier description must be 200 characters or fewer");
      return;
    }
    setSaving(true);
    try {
      const payload: SchoolAssessmentTier = {
        name: form.name.trim(),
        description: form.description.trim(),
        amount: form.amount === null || form.amount === undefined ? 0 : Math.round(Number(form.amount)),
        sortOrder: Number(form.sortOrder),
        maxRegistrations:
          form.maxRegistrations === null ||
          form.maxRegistrations === undefined ||
          String(form.maxRegistrations) === ""
            ? null
            : Math.round(Number(form.maxRegistrations)),
        isActive: form.isActive,
      };
      if (editingId) {
        await updateSchoolTier(editingId, payload);
      } else {
        await createSchoolTier(instituteCode, sessionId, assessmentId, payload);
      }
      setFormOpen(false);
      await load();
    } catch (e: any) {
      showErrorToast("Failed to save tier: " + (e.response?.data || e.message));
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (t: SchoolAssessmentTier) => {
    if (!t.tierId) return;
    try {
      await toggleSchoolTier(t.tierId);
      await load();
    } catch (e) {
      console.error("Failed to toggle tier", e);
    }
  };

  const onDelete = async (t: SchoolAssessmentTier) => {
    if (!t.tierId) return;
    if (!window.confirm(`Delete tier "${t.name}"?`)) return;
    try {
      await deleteSchoolTier(t.tierId);
      await load();
    } catch (e) {
      console.error("Failed to delete tier", e);
    }
  };

  // The live tier = lowest-sortOrder active tier still under cap (mirrors backend).
  const liveTierId = (() => {
    const candidate = [...tiers]
      .filter((t) => t.isActive)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .find((t) => {
        const max = t.maxRegistrations;
        const cur = t.currentCount || 0;
        return max === null || max === 0 || cur < max;
      });
    return candidate?.tierId ?? null;
  })();

  return (
    <>
      <Modal show={show} onHide={onHide} centered size="lg">
        <Modal.Header closeButton style={{ borderBottom: "1px solid #f1f5f9", padding: "20px 28px" }}>
          <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b" }}>
            Pricing Tiers
            {assessmentName && (
              <span style={{ marginLeft: 8, fontWeight: 500, color: "#64748b", fontSize: "0.9rem" }}>
                — {assessmentName}
              </span>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "24px 28px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
              <Spinner animation="border" size="sm" /> Loading tiers...
            </div>
          ) : tiers.length === 0 ? (
            <div style={{
              padding: "32px 24px", textAlign: "center",
              border: "2px dashed #e2e8f0", borderRadius: 12, color: "#94a3b8",
            }}>
              No tiers yet. Add one to set pricing and enable registration.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Order", "Name", "Description", "Amount", "Registrations", "Status", ""].map((h) => (
                    <th key={h} style={{
                      padding: "10px 12px", fontWeight: 700, fontSize: "0.75rem",
                      color: "#64748b", textAlign: "left", borderBottom: "2px solid #e2e8f0",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.tierId}>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>{t.sortOrder}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", fontWeight: 600 }}>
                      {t.name}
                      {t.tierId === liveTierId && (
                        <span style={{
                          marginLeft: 8, background: "#dcfce7", color: "#059669",
                          padding: "2px 8px", borderRadius: 12, fontSize: "0.65rem", fontWeight: 700,
                        }}>LIVE</span>
                      )}
                    </td>
                    <td
                      title={t.description || ""}
                      style={{
                        padding: "10px 12px", borderBottom: "1px solid #f1f5f9",
                        color: t.description ? "#475569" : "#94a3b8",
                        maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}
                    >
                      {t.description || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      {t.amount && t.amount > 0 ? `INR ${t.amount}` : "Free"}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      {t.currentCount || 0} / {t.maxRegistrations && t.maxRegistrations > 0 ? t.maxRegistrations : "∞"}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      <Form.Check
                        type="switch"
                        checked={!!t.isActive}
                        onChange={() => onToggle(t)}
                      />
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                      <Button size="sm" variant="link" onClick={() => openEdit(t)}>Edit</Button>
                      <Button size="sm" variant="link" style={{ color: "#ef4444" }} onClick={() => onDelete(t)}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal.Body>
        <Modal.Footer style={{ justifyContent: "space-between", padding: "16px 28px", borderTop: "1px solid #f1f5f9" }}>
          <Button onClick={openAdd} style={{
            background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
            border: "none", borderRadius: 10, padding: "8px 20px", fontWeight: 600,
          }}>+ Add Tier</Button>
          <Button variant="light" onClick={onHide} style={{ borderRadius: 10, padding: "8px 20px", fontWeight: 600 }}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Add / Edit tier form */}
      <Modal show={formOpen} onHide={() => setFormOpen(false)} centered>
        <Modal.Header closeButton style={{ borderBottom: "1px solid #f1f5f9" }}>
          <Modal.Title style={{ fontSize: "1rem", fontWeight: 700 }}>
            {editingId ? "Edit Tier" : "Add Tier"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem" }}>Name</Form.Label>
            <Form.Control
              value={form.name}
              placeholder="e.g. Pilot"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem" }}>
              Description <span style={{ color: "#ef4444" }}>*</span>
              <span style={{ color: "#94a3b8", fontWeight: 400 }}> — short text, max 200 chars</span>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              maxLength={200}
              required
              value={form.description || ""}
              placeholder="What this tier covers (e.g. Early Bird, Standard, Late)"
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div style={{ textAlign: "right", fontSize: "0.7rem", color: "#94a3b8", marginTop: 2 }}>
              {(form.description || "").length}/200
            </div>
          </div>
          <div>
            <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem" }}>Amount (INR) — 0 = Free</Form.Label>
            <Form.Control
              type="number" min="0"
              value={form.amount ?? 0}
              onChange={(e) => setForm({ ...form, amount: e.target.value === "" ? 0 : Number(e.target.value) })}
            />
          </div>
          <div>
            <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem" }}>Sort Order</Form.Label>
            <Form.Control
              type="number" min="1"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
            />
          </div>
          <div>
            <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem" }}>
              Max Registrations <span style={{ color: "#94a3b8", fontWeight: 400 }}>— blank = unlimited</span>
            </Form.Label>
            <Form.Control
              type="number" min="0"
              value={form.maxRegistrations ?? ""}
              onChange={(e) => setForm({ ...form, maxRegistrations: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
          <Form.Check
            type="switch"
            label="Active"
            checked={!!form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
        </Modal.Body>
        <Modal.Footer style={{ borderTop: "1px solid #f1f5f9" }}>
          <Button variant="light" onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button
            disabled={saving}
            onClick={save}
            style={{ background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)", border: "none", fontWeight: 600 }}
          >
            {saving ? <><Spinner animation="border" size="sm" /> Saving...</> : "Save Tier"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default SchoolTierManagementModal;
