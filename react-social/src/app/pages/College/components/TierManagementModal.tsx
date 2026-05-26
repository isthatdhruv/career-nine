import { useEffect, useState, useCallback } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import {
  AssessmentMappingTier,
  getTiers,
  createTier,
  updateTier,
  toggleTier,
  deleteTier,
} from "../../AssessmentMapping/API/AssessmentMapping_APIs";
import { showErrorToast } from "../../../utils/toast";

interface Props {
  mappingId: number;
  show: boolean;
  onHide: () => void;
}

const emptyForm: AssessmentMappingTier = {
  name: "",
  amount: 0,
  sortOrder: 1,
  maxRegistrations: null,
  isActive: true,
};

const TierManagementModal = ({ mappingId, show, onHide }: Props) => {
  const [tiers, setTiers] = useState<AssessmentMappingTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AssessmentMappingTier>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!mappingId) return;
    setLoading(true);
    try {
      const res = await getTiers(mappingId);
      setTiers(res.data || []);
    } catch (e) {
      console.error("Failed to load tiers", e);
    } finally {
      setLoading(false);
    }
  }, [mappingId]);

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

  const openEdit = (t: AssessmentMappingTier) => {
    setForm({ ...t });
    setEditingId(t.tierId ?? null);
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      showErrorToast("Tier name is required");
      return;
    }
    setSaving(true);
    try {
      const payload: AssessmentMappingTier = {
        name: form.name.trim(),
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
        await updateTier(editingId, payload);
      } else {
        await createTier(mappingId, payload);
      }
      setFormOpen(false);
      await load();
    } catch (e: any) {
      showErrorToast("Failed to save tier: " + (e.response?.data || e.message));
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (t: AssessmentMappingTier) => {
    if (!t.tierId) return;
    try {
      await toggleTier(t.tierId);
      await load();
    } catch (e) {
      console.error("Failed to toggle tier", e);
    }
  };

  const onDelete = async (t: AssessmentMappingTier) => {
    if (!t.tierId) return;
    if (!window.confirm(`Delete tier "${t.name}"?`)) return;
    try {
      await deleteTier(t.tierId);
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
              No tiers yet. Add one to set pricing.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Order", "Name", "Amount", "Registrations", "Status", ""].map((h) => (
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

export default TierManagementModal;
