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
          <i className="bi bi-collection-fill" style={{ color: "#7c3aed", fontSize: "1rem" }}></i>
          <h6 style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Role Groups</h6>
          <span style={{ fontSize: "0.78rem", color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: "4px" }}>{roleGroups.length}</span>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm" style={{ color: "#7c3aed" }}></div>
            <span className="ms-2" style={{ color: "#6b7280", fontSize: "0.85rem" }}>Loading role groups...</span>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="d-flex gap-2 mb-2 px-2" style={{ fontSize: "0.72rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px" }}>
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
                  style={{ padding: "10px", borderRadius: "6px", background: "#f9fafb", border: "1px solid #f3f4f6" }}
                >
                  {editingId === group.id ? (
                    <>
                      <input
                        className="form-control form-control-sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ flex: 1, borderRadius: "6px", fontSize: "0.85rem", border: "1px solid #d1d5db" }}
                      />
                      <div style={{ flex: 2 }}>
                        <Select
                          isMulti
                          closeMenuOnSelect={false}
                          options={roleOptions}
                          defaultValue={editRoles}
                          onChange={(opt: any) => setEditRoles(opt || [])}
                          styles={{
                            control: (base) => ({ ...base, minHeight: "32px", fontSize: "0.82rem", borderRadius: "6px", borderColor: "#d1d5db" }),
                            multiValue: (base) => ({ ...base, fontSize: "0.78rem", background: "#2563eb", borderRadius: "4px" }),
                            multiValueLabel: (base) => ({ ...base, color: "#fff" }),
                          }}
                          placeholder="Select roles..."
                          noOptionsMessage={() => "No roles available"}
                        />
                      </div>
                      <div className="d-flex gap-1" style={{ width: "80px", justifyContent: "center" }}>
                        <button className="btn btn-sm" onClick={() => handleUpdate(group)} style={actionBtn("#059669")}>
                          <i className="bi bi-check-lg" style={{ fontSize: "0.9rem" }}></i>
                        </button>
                        <button className="btn btn-sm" onClick={() => setEditingId(null)} style={actionBtn("#6b7280")}>
                          <i className="bi bi-x-lg" style={{ fontSize: "0.8rem" }}></i>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{group.name}</span>
                      <div style={{ flex: 2, display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {(group.roleRoleGroupMappings || []).map((m: any, i: number) => (
                          <span
                            key={i}
                            style={{ fontSize: "0.75rem", fontWeight: 600, padding: "3px 10px", borderRadius: "4px", background: "#2563eb", color: "#fff" }}
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
                          style={actionBtn("#2563eb")}
                        >
                          <i className="bi bi-pencil-fill" style={{ fontSize: "0.8rem" }}></i>
                        </button>
                        <button className="btn btn-sm" onClick={() => handleDelete(group.id!)} style={actionBtn("#dc2626")}>
                          <i className="bi bi-trash-fill" style={{ fontSize: "0.8rem" }}></i>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new role group */}
            <div
              className="d-flex align-items-center gap-2 mt-3"
              style={{ padding: "10px", borderRadius: "6px", background: "#faf5ff", border: "1px dashed #c4b5fd" }}
            >
              <input
                className="form-control form-control-sm"
                placeholder="Group name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ flex: 1, borderRadius: "6px", fontSize: "0.85rem", border: "1px solid #d1d5db" }}
              />
              <div style={{ flex: 2 }}>
                <Select
                  isMulti
                  closeMenuOnSelect={false}
                  options={roleOptions}
                  value={newRoles}
                  onChange={(opt: any) => setNewRoles(opt || [])}
                  styles={{
                    control: (base) => ({ ...base, minHeight: "32px", fontSize: "0.82rem", borderRadius: "6px", borderColor: "#d1d5db" }),
                    multiValue: (base) => ({ ...base, fontSize: "0.78rem", background: "#dbeafe", borderRadius: "4px" }),
                    multiValueLabel: (base) => ({ ...base, color: "#1d4ed8" }),
                  }}
                  placeholder="Select roles..."
                  noOptionsMessage={() => "No roles available"}
                />
              </div>
              <button
                className="btn btn-sm d-flex align-items-center gap-1"
                onClick={handleCreate}
                disabled={saving || !newName.trim() || newRoles.length === 0}
                style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 14px", fontWeight: 600, fontSize: "0.82rem", whiteSpace: "nowrap" }}
              >
                <i className="bi bi-plus-lg"></i>
                {saving ? "Adding..." : "Add Group"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RoleGroupsPanel;
