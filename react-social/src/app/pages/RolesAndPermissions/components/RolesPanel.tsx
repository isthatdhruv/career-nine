import { useState } from "react";
import axios from "axios";
import { showErrorToast } from "../../../utils/toast";
import type { RoleItem } from "../RolesAndPermissionsPage";

const API_URL = process.env.REACT_APP_API_URL;

interface Props {
  roles: RoleItem[];
  loading: boolean;
  onRefresh: () => void;
}

const RolesPanel = ({ roles, loading, onRefresh }: Props) => {
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const handleCreate = async () => {
    if (!newName.trim() || !newUrl.trim()) return;
    if (!newUrl.startsWith("/")) {
      showErrorToast("URL must start with '/'");
      return;
    }
    setSaving(true);
    try {
      await axios.put(`${API_URL}/role/update`, { values: { name: newName.trim(), url: newUrl.trim(), display: true } });
      setNewName("");
      setNewUrl("");
      onRefresh();
    } catch (e) {
      showErrorToast("Failed to create role");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (role: RoleItem) => {
    if (!editName.trim() || !editUrl.trim()) return;
    if (!editUrl.startsWith("/")) {
      showErrorToast("URL must start with '/'");
      return;
    }
    try {
      await axios.put(`${API_URL}/role/update`, { values: { id: role.id, name: editName.trim(), url: editUrl.trim(), display: true } });
      setEditingId(null);
      onRefresh();
    } catch (e) {
      showErrorToast("Failed to update role");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this role?")) return;
    try {
      await axios.delete(`${API_URL}/role/delete/${id}`);
      onRefresh();
    } catch (e) {
      showErrorToast("Failed to delete role");
    }
  };

  return (
    <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: "12px" }}>
      <div className="card-body p-3">
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-key-fill" style={{ color: "#4361ee", fontSize: "1rem" }}></i>
            <h6 className="mb-0 fw-bold" style={{ color: "#1a1a2e" }}>Roles</h6>
            <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>({roles.length})</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm text-primary"></div>
            <span className="ms-2 text-muted" style={{ fontSize: "0.85rem" }}>Loading roles...</span>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="d-flex gap-2 mb-2 px-1" style={{ fontSize: "0.72rem", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              <div style={{ flex: 1 }}>Role Name</div>
              <div style={{ flex: 1 }}>URL Path</div>
              <div style={{ width: "80px", textAlign: "center" }}>Actions</div>
            </div>

            {/* Existing roles */}
            <div className="d-flex flex-column gap-1">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="d-flex align-items-center gap-2"
                  style={{ padding: "6px 8px", borderRadius: "8px", background: "#fafbfc", border: "1px solid #f0f0f0" }}
                >
                  {editingId === role.id ? (
                    <>
                      <input
                        className="form-control form-control-sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ flex: 1, borderRadius: "6px", fontSize: "0.85rem" }}
                      />
                      <input
                        className="form-control form-control-sm"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        style={{ flex: 1, borderRadius: "6px", fontSize: "0.85rem" }}
                      />
                      <div className="d-flex gap-1" style={{ width: "80px", justifyContent: "center" }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleUpdate(role)}
                          style={{ width: "28px", height: "28px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(16, 185, 129, 0.1)", color: "#059669", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "6px" }}
                        >
                          <i className="bi bi-check-lg" style={{ fontSize: "0.8rem" }}></i>
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => setEditingId(null)}
                          style={{ width: "28px", height: "28px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: "6px" }}
                        >
                          <i className="bi bi-x-lg" style={{ fontSize: "0.7rem" }}></i>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: "0.85rem", fontWeight: 500, color: "#1f2937" }}>{role.name}</span>
                      <span style={{ flex: 1, fontSize: "0.82rem", color: "#6b7280", fontFamily: "monospace" }}>{role.url}</span>
                      <div className="d-flex gap-1" style={{ width: "80px", justifyContent: "center" }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => { setEditingId(role.id!); setEditName(role.name); setEditUrl(role.url); }}
                          style={{ width: "28px", height: "28px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(67, 97, 238, 0.1)", color: "#4361ee", border: "1px solid rgba(67, 97, 238, 0.2)", borderRadius: "6px" }}
                        >
                          <i className="bi bi-pencil-fill" style={{ fontSize: "0.65rem" }}></i>
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleDelete(role.id!)}
                          style={{ width: "28px", height: "28px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(220, 38, 38, 0.1)", color: "#dc2626", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "6px" }}
                        >
                          <i className="bi bi-trash-fill" style={{ fontSize: "0.65rem" }}></i>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new role */}
            <div
              className="d-flex align-items-center gap-2 mt-2"
              style={{ padding: "8px", borderRadius: "8px", background: "rgba(67, 97, 238, 0.03)", border: "1px dashed rgba(67, 97, 238, 0.2)" }}
            >
              <input
                className="form-control form-control-sm"
                placeholder="Role name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ flex: 1, borderRadius: "6px", fontSize: "0.85rem" }}
              />
              <input
                className="form-control form-control-sm"
                placeholder="/url-path"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                style={{ flex: 1, borderRadius: "6px", fontSize: "0.85rem" }}
              />
              <button
                className="btn btn-sm d-flex align-items-center gap-1"
                onClick={handleCreate}
                disabled={saving || !newName.trim() || !newUrl.trim()}
                style={{
                  background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "5px 12px",
                  fontWeight: 600,
                  fontSize: "0.78rem",
                  whiteSpace: "nowrap",
                }}
              >
                <i className="bi bi-plus-lg"></i>
                {saving ? "Adding..." : "Add"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RolesPanel;
