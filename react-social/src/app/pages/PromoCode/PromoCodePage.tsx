import { useEffect, useState } from "react";
import { Modal, Button, Form, Spinner, Badge } from "react-bootstrap";
import { MdAdd, MdEdit, MdDelete } from "react-icons/md";
import {
  createPromoCode,
  getAllPromoCodes,
  updatePromoCode,
  deletePromoCode,
} from "./API/PromoCode_APIs";
import { showErrorToast } from "../../utils/toast";

interface PromoCodeItem {
  id: number;
  code: string;
  discountPercent: number;
  description: string | null;
  isActive: boolean;
  expiresAt: string | null;
  maxUses: number | null;
  currentUses: number;
  createdAt: string;
}

const PromoCodePage = () => {
  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCodeItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [code, setCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState<number>(10);
  const [description, setDescription] = useState("");
  const [maxUses, setMaxUses] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");

  useEffect(() => {
    loadPromoCodes();
  }, []);

  const loadPromoCodes = async () => {
    try {
      const res = await getAllPromoCodes();
      setPromoCodes(res.data || []);
    } catch (err) {
      console.error("Failed to load promo codes:", err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingPromo(null);
    setCode("");
    setDiscountPercent(10);
    setDescription("");
    setMaxUses("");
    setExpiresAt("");
    setShowModal(true);
  };

  const openEditModal = (promo: PromoCodeItem) => {
    setEditingPromo(promo);
    setCode(promo.code);
    setDiscountPercent(promo.discountPercent);
    setDescription(promo.description || "");
    setMaxUses(promo.maxUses != null ? String(promo.maxUses) : "");
    setExpiresAt(promo.expiresAt ? formatDateForInput(promo.expiresAt) : "");
    setShowModal(true);
  };

  const formatDateForInput = (dateStr: string) => {
    try {
      // Parse dd-MM-yyyy HH:mm:ss format
      const parts = dateStr.split(" ")[0].split("-");
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`; // yyyy-MM-dd
      }
    } catch {}
    return "";
  };

  const handleSubmit = async () => {
    if (!code.trim()) {
      showErrorToast("Promo code is required");
      return;
    }
    if (discountPercent < 1 || discountPercent > 100) {
      showErrorToast("Discount must be between 1 and 100");
      return;
    }

    setSubmitting(true);
    try {
      const data: any = {
        code: code.trim().toUpperCase(),
        discountPercent,
        description: description.trim() || null,
        maxUses: maxUses ? Number(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt + "T23:59:59").getTime() : null,
      };

      if (editingPromo) {
        await updatePromoCode(editingPromo.id, data);
      } else {
        await createPromoCode(data);
      }

      setShowModal(false);
      loadPromoCodes();
    } catch (err: any) {
      showErrorToast(err.response?.data || "Failed to save promo code");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this promo code?")) return;
    try {
      await deletePromoCode(id);
      setPromoCodes(promoCodes.filter((p) => p.id !== id));
    } catch (err) {
      showErrorToast("Failed to delete promo code");
    }
  };

  const handleToggleActive = async (promo: PromoCodeItem) => {
    try {
      await updatePromoCode(promo.id, { isActive: !promo.isActive });
      setPromoCodes(
        promoCodes.map((p) =>
          p.id === promo.id ? { ...p, isActive: !p.isActive } : p
        )
      );
    } catch (err) {
      showErrorToast("Failed to update promo code");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return dateStr.split(" ")[0]; // dd-MM-yyyy
  };

  const isExpired = (promo: PromoCodeItem) => {
    if (!promo.expiresAt) return false;
    try {
      const parts = promo.expiresAt.split(" ")[0].split("-");
      const expDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      return expDate < new Date();
    } catch {
      return false;
    }
  };

  const isMaxedOut = (promo: PromoCodeItem) => {
    return promo.maxUses != null && promo.currentUses >= promo.maxUses;
  };

  return (
    <div style={{ padding: "32px" }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 32,
      }}>
        <div>
          <h4 style={{ margin: 0, fontWeight: 700, color: "#1e293b" }}>Promo Codes</h4>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem", marginTop: 4 }}>
            Manage discount codes for assessment payments
          </p>
        </div>
        <Button
          onClick={openCreateModal}
          style={{
            background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
            border: "none", borderRadius: 10, padding: "10px 24px",
            fontWeight: 600, fontSize: "0.9rem",
            boxShadow: "0 4px 14px rgba(67, 97, 238, 0.3)",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <MdAdd size={18} />
          Create Promo Code
        </Button>
      </div>

      {/* Table */}
      <div style={{
        background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflow: "hidden",
      }}>
        {loading ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "64px 0", color: "#64748b",
          }}>
            <Spinner animation="border" size="sm" style={{ marginRight: 12 }} />
            Loading...
          </div>
        ) : promoCodes.length === 0 ? (
          <div style={{
            padding: "64px 24px", textAlign: "center", color: "#94a3b8",
          }}>
            No promo codes yet. Create one to get started.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Code", "Discount", "Description", "Usage", "Expires", "Status", "Actions"].map((h) => (
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
              {promoCodes.map((promo, idx) => (
                <tr
                  key={promo.id}
                  style={{
                    background: idx % 2 === 0 ? "#fff" : "#fafbfc",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4ff")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#fafbfc")}
                >
                  <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: "0.9rem", color: "#1e293b", fontFamily: "monospace" }}>
                    {promo.code}
                  </td>
                  <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{
                      background: promo.discountPercent === 100 ? "#dcfce7" : "#ede9fe",
                      color: promo.discountPercent === 100 ? "#166534" : "#7c3aed",
                      padding: "4px 12px", borderRadius: 8, fontWeight: 700, fontSize: "0.85rem",
                    }}>
                      {promo.discountPercent}% OFF
                    </span>
                  </td>
                  <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", fontSize: "0.85rem", color: "#475569", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {promo.description || "—"}
                  </td>
                  <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", fontSize: "0.85rem", color: "#475569" }}>
                    {promo.currentUses}{promo.maxUses != null ? ` / ${promo.maxUses}` : " / Unlimited"}
                  </td>
                  <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", fontSize: "0.85rem", color: isExpired(promo) ? "#dc2626" : "#475569" }}>
                    {formatDate(promo.expiresAt)}
                    {isExpired(promo) && (
                      <Badge bg="danger" className="ms-2" style={{ fontSize: "0.7rem" }}>Expired</Badge>
                    )}
                  </td>
                  <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                    <span
                      onClick={() => handleToggleActive(promo)}
                      style={{
                        background: promo.isActive && !isExpired(promo) && !isMaxedOut(promo) ? "#dcfce7" : "#f1f5f9",
                        color: promo.isActive && !isExpired(promo) && !isMaxedOut(promo) ? "#059669" : "#94a3b8",
                        padding: "5px 14px", borderRadius: 20,
                        fontWeight: 600, fontSize: "0.78rem",
                        cursor: "pointer", display: "inline-block",
                      }}
                    >
                      {!promo.isActive ? "Inactive" : isExpired(promo) ? "Expired" : isMaxedOut(promo) ? "Maxed Out" : "Active"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => openEditModal(promo)}
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
                        onClick={() => handleDelete(promo.id)}
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
        <Modal.Header
          closeButton
          style={{
            background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
            borderBottom: "none", padding: "24px 32px",
          }}
        >
          <Modal.Title style={{ color: "#fff", fontWeight: 700, fontSize: "1.15rem" }}>
            {editingPromo ? "Edit Promo Code" : "Create Promo Code"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body style={{ padding: "28px 32px" }}>
          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>
              Code <span style={{ color: "#ef4444" }}>*</span>
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g. WELCOME50"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontFamily: "monospace", fontWeight: 600 }}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>
              Discount Percent <span style={{ color: "#ef4444" }}>*</span>
            </Form.Label>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Form.Range
                min={1}
                max={100}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{
                background: "#ede9fe", color: "#7c3aed",
                padding: "4px 14px", borderRadius: 8,
                fontWeight: 700, fontSize: "0.95rem", minWidth: 65, textAlign: "center",
              }}>
                {discountPercent}%
              </span>
            </div>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>
              Description
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="Optional note"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0" }}
            />
          </Form.Group>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Form.Group>
              <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>
                Max Uses
              </Form.Label>
              <Form.Control
                type="number"
                placeholder="Unlimited"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                min="1"
                style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0" }}
              />
            </Form.Group>

            <Form.Group>
              <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>
                Expires On
              </Form.Label>
              <Form.Control
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0" }}
              />
            </Form.Group>
          </div>
        </Modal.Body>

        <Modal.Footer style={{ padding: "16px 32px", borderTop: "1px solid #e2e8f0" }}>
          <Button
            variant="secondary"
            onClick={() => setShowModal(false)}
            style={{
              borderRadius: 10, padding: "8px 24px", fontWeight: 600,
              background: "#f1f5f9", border: "1.5px solid #e2e8f0", color: "#475569",
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              background: submitting ? "#94a3b8" : "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
              border: "none", borderRadius: 10, padding: "8px 24px",
              fontWeight: 600, boxShadow: submitting ? "none" : "0 4px 14px rgba(67, 97, 238, 0.3)",
            }}
          >
            {submitting ? (
              <><Spinner animation="border" size="sm" className="me-2" />Saving...</>
            ) : editingPromo ? (
              "Update"
            ) : (
              "Create"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PromoCodePage;
