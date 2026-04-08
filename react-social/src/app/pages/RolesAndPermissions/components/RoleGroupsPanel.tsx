import { useState, useMemo } from "react";
import axios from "axios";
import Select from "react-select";
import { showErrorToast } from "../../../utils/toast";
import type { RoleItem, RoleGroupItem } from "../RolesAndPermissionsPage";

const API_URL = process.env.REACT_APP_API_URL;

interface Props {
  roleGroups: RoleGroupItem[];
  roles: RoleItem[];
  loading: boolean;
  onRefresh: () => void;
}

const RoleGroupsPanel = ({ roleGroups, roles, loading, onRefresh }: Props) => {
  const [newName, setNewName] = useState("");
  const [newRoles, setNewRoles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editRoles, setEditRoles] = useState<any[]>([]);

  const roleOptions = useMemo(
    () => roles.map((r) => ({ label: r.name, value: r.id })),
    [roles]
  );

  const buildPayload = (name: string, id: number | undefined, selectedRoles: any[]) => ({
    values: {
      name,
      id: id || undefined,
      display: 1,
      roleRoleGroupMappings: selectedRoles.map((r: any) => ({
        display: true,
        role: { display: true, name: r.label, id: r.value },
        roleGroup: id || undefined,
      })),
    },
  });

  const handleCreate = async () => {
    if (!newName.trim() || newRoles.length === 0) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/rolegroup/update`, buildPayload(newName.trim(), undefined, newRoles));
      setNewName("");
      setNewRoles([]);
      onRefresh();
    } catch (e) {
      showErrorToast("Failed to create role group");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (group: RoleGroupItem) => {
    if (!editName.trim()) return;
    try {
      await axios.post(`${API_URL}/rolegroup/update`, buildPayload(editName.trim(), group.id, editRoles));
      setEditingId(null);
      onRefresh();
    } catch (e) {
      showErrorToast("Failed to update role group");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this role group?")) return;
    try {
      await axios.get(`${API_URL}/rolegroup/delete/${id}`);
      onRefresh();
    } catch (e) {
      showErrorToast("Failed to delete role group");
    }
  };

  const getDefaultOptions = (group: RoleGroupItem) =>
    (group.roleRoleGroupMappings || []).map((m: any) => ({
      label: m.role?.name || "",
      value: m.role?.id,
    }));

  return (
    <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: "12px" }}>
      <div className="card-body p-3">
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-collection-fill" style={{ color: "#7c3aed", fontSize: "1rem" }}></i>
            <h6 className="mb-0 fw-bold" style={{ color: "#1a1a2e" }}>Role Groups</h6>
            <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>({roleGroups.length})</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm text-primary"></div>
            <span className="ms-2 text-muted" style={{ fontSize: "0.85rem" }}>Loading role groups...</span>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="d-flex gap-2 mb-2 px-1" style={{ fontSize: "0.72rem", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              <div style={{ flex: 1 }}>Group Name</div>
              <div style={{ flex: 2 }}>Assigned Roles</div>
              <div style={{ width: "80px", textAlign: "center" }}>Actions</div>
            </div>

            {/* Existing groups */}
            <div className="d-flex flex-column gap-2">
              {roleGroups.map((group) => (
                <div
                  key={group.id}
                  className="d-flex align-items-center gap-2"
                  style={{ padding: "8px", borderRadius: "8px", background: "#fafbfc", border: "1px solid #f0f0f0" }}
                >
                  {editingId === group.id ? (
                    <>
                      <input
                        className="form-control form-control-sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ flex: 1, borderRadius: "6px", fontSize: "0.85rem" }}
                      />
                      <div style={{ flex: 2 }}>
                        <Select
                          isMulti
                          closeMenuOnSelect={false}
                          options={roleOptions}
                          defaultValue={editRoles}
                          onChange={(opt: any) => setEditRoles(opt || [])}
                          styles={{
                            control: (base) => ({ ...base, minHeight: "32px", fontSize: "0.82rem", borderRadius: "6px" }),
                            multiValue: (base) => ({ ...base, fontSize: "0.78rem" }),
                          }}
                          placeholder="Select roles..."
                          noOptionsMessage={() => "No roles available"}
                        />
                      </div>
                      <div className="d-flex gap-1" style={{ width: "80px", justifyContent: "center" }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleUpdate(group)}
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
                      <span style={{ flex: 1, fontSize: "0.85rem", fontWeight: 600, color: "#1f2937" }}>{group.name}</span>
                      <div style={{ flex: 2, display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {(group.roleRoleGroupMappings || []).map((m: any, i: number) => (
                          <span
                            key={i}
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 500,
                              padding: "2px 8px",
                              borderRadius: "10px",
                              background: "rgba(67, 97, 238, 0.08)",
                              color: "#4361ee",
                            }}
                          >
                            {m.role?.name}
                          </span>
                        ))}
                        {(!group.roleRoleGroupMappings || group.roleRoleGroupMappings.length === 0) && (
                          <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>No roles assigned</span>
                        )}
                      </div>
                      <div className="d-flex gap-1" style={{ width: "80px", justifyContent: "center" }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => {
                            setEditingId(group.id!);
                            setEditName(group.name);
                            setEditRoles(getDefaultOptions(group));
                          }}
                          style={{ width: "28px", height: "28px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(67, 97, 238, 0.1)", color: "#4361ee", border: "1px solid rgba(67, 97, 238, 0.2)", borderRadius: "6px" }}
                        >
                          <i className="bi bi-pencil-fill" style={{ fontSize: "0.65rem" }}></i>
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleDelete(group.id!)}
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

            {/* Add new role group */}
            <div
              className="d-flex align-items-center gap-2 mt-2"
              style={{ padding: "8px", borderRadius: "8px", background: "rgba(124, 58, 237, 0.03)", border: "1px dashed rgba(124, 58, 237, 0.2)" }}
            >
              <input
                className="form-control form-control-sm"
                placeholder="Group name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ flex: 1, borderRadius: "6px", fontSize: "0.85rem" }}
              />
              <div style={{ flex: 2 }}>
                <Select
                  isMulti
                  closeMenuOnSelect={false}
                  options={roleOptions}
                  value={newRoles}
                  onChange={(opt: any) => setNewRoles(opt || [])}
                  styles={{
                    control: (base) => ({ ...base, minHeight: "32px", fontSize: "0.82rem", borderRadius: "6px" }),
                    multiValue: (base) => ({ ...base, fontSize: "0.78rem" }),
                  }}
                  placeholder="Select roles..."
                  noOptionsMessage={() => "No roles available"}
                />
              </div>
              <button
                className="btn btn-sm d-flex align-items-center gap-1"
                onClick={handleCreate}
                disabled={saving || !newName.trim() || newRoles.length === 0}
                style={{
                  background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
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

export default RoleGroupsPanel;
