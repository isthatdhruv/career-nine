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
  description: "",
  amount: 0,
  sortOrder: 1,
  maxRegistrations: null,
  isActive: true,
  isFree: false,
  includesFinalReport: false,
  includesDashboard: false,
  dashboardValidityDays: null,
  includesCounselling: false,
  counsellingSessionCount: null,
  counsellingPrice: null,
  includesLms: false,
  lmsValidityDays: null,
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
      // The free tier (isFree) is fixed at amount 0; only paid waves carry a price.
      const isFreeTier = !!form.isFree;
      const payload: AssessmentMappingTier = {
        name: form.name.trim(),
        description: form.description.trim(),
        amount: isFreeTier
          ? 0
          : form.amount === null || form.amount === undefined ? 0 : Math.round(Number(form.amount)),
        sortOrder: Number(form.sortOrder),
        isFree: isFreeTier,
        maxRegistrations:
          form.maxRegistrations === null ||
          form.maxRegistrations === undefined ||
          String(form.maxRegistrations) === ""
            ? null
            : Math.round(Number(form.maxRegistrations)),
        isActive: form.isActive,
        includesFinalReport: !!form.includesFinalReport,
        includesDashboard: !!form.includesDashboard,
        dashboardValidityDays: form.includesDashboard
          && form.dashboardValidityDays !== null
          && form.dashboardValidityDays !== undefined
          && String(form.dashboardValidityDays) !== ""
            ? Math.round(Number(form.dashboardValidityDays))
            : null,
        includesCounselling: !!form.includesCounselling,
        counsellingSessionCount: form.includesCounselling
          && form.counsellingSessionCount !== null
          && form.counsellingSessionCount !== undefined
          && String(form.counsellingSessionCount) !== ""
            ? Math.round(Number(form.counsellingSessionCount))
            : null,
        // Phase 3b: per-session price (INR) for booking EXTRA counselling sessions
        // beyond what the tier includes. Applies regardless of includesCounselling.
        counsellingPrice: form.counsellingPrice !== null
          && form.counsellingPrice !== undefined
          && String(form.counsellingPrice) !== ""
            ? Math.round(Number(form.counsellingPrice))
            : null,
        includesLms: !!form.includesLms,
        lmsValidityDays: form.includesLms
          && form.lmsValidityDays !== null
          && form.lmsValidityDays !== undefined
          && String(form.lmsValidityDays) !== ""
            ? Math.round(Number(form.lmsValidityDays))
            : null,
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

  // Split the auto-created free tier (free link's included services) from the
  // paid waves so each renders in its own section.
  const freeTier = tiers.find((t) => t.isFree === true) || null;
  const paidTiers = tiers.filter((t) => t.isFree !== true);

  const serviceChips = (t: AssessmentMappingTier): string[] => {
    const chips: string[] = [];
    if (t.includesFinalReport) chips.push("Report");
    if (t.includesDashboard) chips.push(t.dashboardValidityDays ? `Dashboard ${t.dashboardValidityDays}d` : "Dashboard");
    if (t.includesCounselling) chips.push(t.counsellingSessionCount ? `Counselling ×${t.counsellingSessionCount}` : "Counselling");
    if (t.includesLms) chips.push(t.lmsValidityDays ? `LMS ${t.lmsValidityDays}d` : "LMS");
    return chips;
  };

  return (
    <>
      <Modal show={show} onHide={onHide} centered size="xl">
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
          ) : (
            <>
              {/* ── Free link — included services (distinct section for the free tier) ── */}
              {freeTier && (
                <div style={{
                  border: "1.5px solid #a7f3d0", background: "#ecfdf5",
                  borderRadius: 12, padding: "16px 18px", marginBottom: 20,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        background: "#059669", color: "#fff", padding: "3px 10px",
                        borderRadius: 12, fontSize: "0.7rem", fontWeight: 700,
                      }}>FREE LINK</span>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#065f46" }}>
                        Included services
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Form.Check
                        type="switch"
                        title="Free tier active"
                        checked={!!freeTier.isActive}
                        onChange={() => onToggle(freeTier)}
                      />
                      <Button size="sm" variant="link" style={{ color: "#065f46" }} onClick={() => openEdit(freeTier)}>
                        Edit
                      </Button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, alignItems: "center" }}>
                    <span style={{ fontSize: "0.78rem", color: "#047857", fontWeight: 600 }}>
                      Free cap: {freeTier.currentCount || 0} / {freeTier.maxRegistrations && freeTier.maxRegistrations > 0 ? freeTier.maxRegistrations : "∞"}
                    </span>
                    {serviceChips(freeTier).length === 0 ? (
                      <span style={{ fontSize: "0.78rem", color: "#94a3b8", marginLeft: 8 }}>No bundled services</span>
                    ) : (
                      serviceChips(freeTier).map((c) => (
                        <span key={c} style={{
                          background: "#d1fae5", color: "#065f46", padding: "2px 8px",
                          borderRadius: 10, fontSize: "0.68rem", fontWeight: 600, whiteSpace: "nowrap",
                        }}>{c}</span>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ── Paid waves ── */}
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1e293b", marginBottom: 10 }}>
                Paid waves
              </div>
              {paidTiers.length === 0 ? (
                <div style={{
                  padding: "28px 24px", textAlign: "center",
                  border: "2px dashed #e2e8f0", borderRadius: 12, color: "#94a3b8",
                }}>
                  No paid waves yet. Add one to set pricing for the paid link.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Order", "Name", "Description", "Amount", "Registrations", "Services", "Status", ""].map((h) => (
                        <th key={h} style={{
                          padding: "10px 12px", fontWeight: 700, fontSize: "0.75rem",
                          color: "#64748b", textAlign: "left", borderBottom: "2px solid #e2e8f0",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paidTiers.map((t) => (
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
                          {(() => {
                            const chips = serviceChips(t);
                            if (chips.length === 0) return <span style={{ color: "#94a3b8" }}>—</span>;
                            return (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {chips.map((c) => (
                                  <span key={c} style={{
                                    background: "#eef2ff", color: "#4338ca", padding: "2px 8px",
                                    borderRadius: 10, fontSize: "0.65rem", fontWeight: 600, whiteSpace: "nowrap",
                                  }}>{c}</span>
                                ))}
                              </div>
                            );
                          })()}
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
            </>
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
            {form.isFree ? "Edit Free Link Services" : editingId ? "Edit Tier" : "Add Tier"}
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
          {!form.isFree && (
            <div>
              <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem" }}>Amount (INR) — 0 = Free</Form.Label>
              <Form.Control
                type="number" min="0"
                value={form.amount ?? 0}
                onChange={(e) => setForm({ ...form, amount: e.target.value === "" ? 0 : Number(e.target.value) })}
              />
            </div>
          )}
          {!form.isFree && (
            <div>
              <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem" }}>Sort Order</Form.Label>
              <Form.Control
                type="number" min="1"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
            </div>
          )}
          <div>
            <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem" }}>
              {form.isFree ? "Free cap (max registrations)" : "Max Registrations"}{" "}
              <span style={{ color: "#94a3b8", fontWeight: 400 }}>— blank = unlimited</span>
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

          {/* Services included — parity with the B2C pricing tiers. */}
          <div style={{
            borderTop: "1px solid #f1f5f9", paddingTop: 16, display: "flex",
            flexDirection: "column", gap: 12,
          }}>
            <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#1e293b" }}>
              Services included
            </div>

            <Form.Check
              type="switch"
              label="Final report"
              checked={!!form.includesFinalReport}
              onChange={(e) => setForm({ ...form, includesFinalReport: e.target.checked })}
            />

            <Form.Check
              type="switch"
              label="Dashboard"
              checked={!!form.includesDashboard}
              onChange={(e) => setForm({ ...form, includesDashboard: e.target.checked })}
            />
            {form.includesDashboard && (
              <div style={{ marginLeft: 36 }}>
                <Form.Label style={{ fontWeight: 600, fontSize: "0.78rem" }}>
                  Dashboard validity (days) <span style={{ color: "#94a3b8", fontWeight: 400 }}>— blank = unlimited</span>
                </Form.Label>
                <Form.Control
                  type="number" min="0"
                  value={form.dashboardValidityDays ?? ""}
                  onChange={(e) => setForm({
                    ...form,
                    dashboardValidityDays: e.target.value === "" ? null : Number(e.target.value),
                  })}
                />
              </div>
            )}

            <Form.Check
              type="switch"
              label="Counselling"
              checked={!!form.includesCounselling}
              onChange={(e) => setForm({ ...form, includesCounselling: e.target.checked })}
            />
            {form.includesCounselling && (
              <div style={{ marginLeft: 36 }}>
                <Form.Label style={{ fontWeight: 600, fontSize: "0.78rem" }}>
                  Counselling sessions <span style={{ color: "#94a3b8", fontWeight: 400 }}>— blank = unset</span>
                </Form.Label>
                <Form.Control
                  type="number" min="0"
                  value={form.counsellingSessionCount ?? ""}
                  onChange={(e) => setForm({
                    ...form,
                    counsellingSessionCount: e.target.value === "" ? null : Number(e.target.value),
                  })}
                />
              </div>
            )}

            {/* Phase 3b: price for booking an EXTRA counselling session beyond the
                tier's included count (or any session, if the tier includes none).
                Shown always — it's what a student pays when no free session applies. */}
            <div style={{ marginLeft: 36, marginTop: 8 }}>
              <Form.Label style={{ fontWeight: 600, fontSize: "0.78rem" }}>
                Extra counselling session price (₹) <span style={{ color: "#94a3b8", fontWeight: 400 }}>— blank = use default</span>
              </Form.Label>
              <Form.Control
                type="number" min="0"
                value={form.counsellingPrice ?? ""}
                onChange={(e) => setForm({
                  ...form,
                  counsellingPrice: e.target.value === "" ? null : Number(e.target.value),
                })}
              />
            </div>

            <Form.Check
              type="switch"
              label="LMS access"
              checked={!!form.includesLms}
              onChange={(e) => setForm({ ...form, includesLms: e.target.checked })}
            />
            {form.includesLms && (
              <div style={{ marginLeft: 36 }}>
                <Form.Label style={{ fontWeight: 600, fontSize: "0.78rem" }}>
                  LMS validity (days) <span style={{ color: "#94a3b8", fontWeight: 400 }}>— blank = unlimited</span>
                </Form.Label>
                <Form.Control
                  type="number" min="0"
                  value={form.lmsValidityDays ?? ""}
                  onChange={(e) => setForm({
                    ...form,
                    lmsValidityDays: e.target.value === "" ? null : Number(e.target.value),
                  })}
                />
              </div>
            )}
          </div>
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
