import { useState } from "react";
import axios from "axios";
import { showErrorToast } from "../../../utils/toast";
import type { RoleItem } from "../RolesAndPermissionsPage";
import { ActionIcon } from "../../../components/ActionIcon";

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

  const actionBtn = (color: string) => ({
    width: "34px", height: "34px", padding: 0,
    display: "flex" as const, alignItems: "center" as const, justifyContent: "center" as const,
    background: "#fff", color: color, border: `2px solid ${color}`, borderRadius: "6px",
    cursor: "pointer" as const,
  });

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", marginBottom: "16px" }}>
      <div style={{ padding: "16px" }}>
        {/* Header */}
        <div className="d-flex align-items-center gap-2 mb-3">
          <i className="bi bi-key-fill" style={{ color: "#2563eb", fontSize: "1rem" }}></i>
          <h6 style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Roles</h6>
          <span style={{ fontSize: "0.78rem", color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: "4px" }}>{roles.length}</span>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm" style={{ color: "#2563eb" }}></div>
            <span className="ms-2" style={{ color: "#6b7280", fontSize: "0.85rem" }}>Loading roles...</span>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="d-flex gap-2 mb-2 px-2" style={{ fontSize: "0.72rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px" }}>
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
                  style={{ padding: "8px", borderRadius: "6px", background: "#f9fafb", border: "1px solid #f3f4f6" }}
                >
                  {editingId === role.id ? (
                    <>
                      <input
                        className="form-control form-control-sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ flex: 1, borderRadius: "6px", fontSize: "0.85rem", border: "1px solid #d1d5db" }}
                      />
                      <input
                        className="form-control form-control-sm"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        style={{ flex: 1, borderRadius: "6px", fontSize: "0.85rem", border: "1px solid #d1d5db" }}
                      />
                      <div className="d-flex gap-1" style={{ width: "80px", justifyContent: "center" }}>
                        <button className="btn btn-sm" onClick={() => handleUpdate(role)} style={actionBtn("#059669")}>
                          <ActionIcon type="approve" size="sm" />
                        </button>
                        <button className="btn btn-sm" onClick={() => setEditingId(null)} style={actionBtn("#6b7280")}>
                          <ActionIcon type="reject" size="sm" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{role.name}</span>
                      <span style={{ flex: 1, fontSize: "0.82rem", color: "#4b5563", fontFamily: "monospace", background: "#f3f4f6", padding: "2px 8px", borderRadius: "4px", display: "inline-block" }}>{role.url}</span>
                      <div className="d-flex gap-1" style={{ width: "80px", justifyContent: "center" }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => { setEditingId(role.id!); setEditName(role.name); setEditUrl(role.url); }}
                          style={actionBtn("#2563eb")}
                        >
                          <ActionIcon type="edit" size="sm" />
                        </button>
                        <button className="btn btn-sm" onClick={() => handleDelete(role.id!)} style={actionBtn("#dc2626")}>
                          <ActionIcon type="delete" size="sm" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new role */}
            <div
              className="d-flex align-items-center gap-2 mt-3"
              style={{ padding: "10px", borderRadius: "6px", background: "#f0f9ff", border: "1px dashed #93c5fd" }}
            >
              <input
                className="form-control form-control-sm"
                placeholder="Role name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ flex: 1, borderRadius: "6px", fontSize: "0.85rem", border: "1px solid #d1d5db" }}
              />
              <input
                className="form-control form-control-sm"
                placeholder="/url-path"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                style={{ flex: 1, borderRadius: "6px", fontSize: "0.85rem", border: "1px solid #d1d5db" }}
              />
              <button
                className="btn btn-sm d-flex align-items-center gap-1"
                onClick={handleCreate}
                disabled={saving || !newName.trim() || !newUrl.trim()}
                style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 14px", fontWeight: 600, fontSize: "0.82rem", whiteSpace: "nowrap" }}
              >
                <ActionIcon type="add" size="sm" />
                {saving ? "Adding..." : "Add Role"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RolesPanel;
