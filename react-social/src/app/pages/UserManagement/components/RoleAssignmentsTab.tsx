import { useEffect, useState } from "react";
import axios from "axios";
import Select from "react-select";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import { ActionIcon } from "../../../components/ActionIcon";

const API_URL = process.env.REACT_APP_API_URL;

interface UserMapping {
  id: number;
  name: string;
  email?: string;
  isActive?: boolean | null;
  userRoleGroupMappings: { id: number; roleGroup: { id: number; name: string } }[];
}

const RoleAssignmentsTab = () => {
  const [users, setUsers] = useState<UserMapping[]>([]);
  const [roleGroupOptions, setRoleGroupOptions] = useState<any[]>([]);
  const [userOptions, setUserOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // New assignment form
  const [newUser, setNewUser] = useState<any>(null);
  const [newGroups, setNewGroups] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupsRes, usersRes] = await Promise.all([
        axios.get(`${API_URL}/rolegroup/get`),
        axios.get(`${API_URL}/user/registered-users`),
      ]);

      setRoleGroupOptions((groupsRes.data || []).map((g: any) => ({ label: g.name, value: g.id })));

      const userList = usersRes.data || [];
      setUserOptions(userList.map((u: any) => ({ label: u.name || u.email, value: u.id })));

      // Build user mappings from userRoleGroupMappings
      setUsers(userList.filter((u: any) => u.userRoleGroupMappings && u.userRoleGroupMappings.length > 0));
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleActive = async (userId: number) => {
    setTogglingId(userId);
    try {
      await axios.post(`${API_URL}/user/toggle-active/${userId}`);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, isActive: !u.isActive } : u));
    } catch (err) {
      showErrorToast("Failed to toggle user status");
    } finally {
      setTogglingId(null);
    }
  };

  const handleAssign = async () => {
    if (!newUser || newGroups.length === 0) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/userrolegroupmapping/update`, {
        values: {
          user: newUser.value,
          roleGroupTemp: newGroups.map((g: any) => g.value),
          display: 1,
        },
      });
      showSuccessToast("Role groups assigned successfully");
      setNewUser(null);
      setNewGroups([]);
      fetchData();
    } catch (e) {
      showErrorToast("Failed to assign role groups");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMapping = async (userId: number) => {
    if (!window.confirm("Remove all role group assignments for this user?")) return;
    try {
      await axios.get(`${API_URL}/userrolegroupmapping/delete/${userId}`);
      fetchData();
    } catch (e) {
      showErrorToast("Failed to remove assignment");
    }
  };

  const filtered = users.filter((u) => {
    if (!searchText.trim()) return true;
    const q = searchText.trim().toLowerCase();
    return (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="card border-0 shadow-sm" style={{ borderRadius: "12px" }}>
        <div className="card-body text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="mt-3 text-muted">Loading assignments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-0 shadow-sm" style={{ borderRadius: "12px" }}>
      <div className="card-body p-3">
        {/* Toolbar */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <div className="position-relative" style={{ flex: "1 0 200px", maxWidth: "320px" }}>
            <i className="bi bi-search position-absolute" style={{ left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}></i>
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder="Search users..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ paddingLeft: 36, borderRadius: "8px", border: "1.5px solid #e0e0e0", fontSize: "0.85rem" }}
            />
          </div>
          <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
            {filtered.length} users with assignments
          </span>
        </div>

        {/* Assignments list */}
        <div className="d-flex flex-column gap-2 mb-3">
          {filtered.map((user) => {
            const active = user.isActive === true;
            return (
            <div
              key={user.id}
              className="d-flex align-items-center gap-3"
              style={{ padding: "10px 12px", borderRadius: "8px", background: "#fafbfc", border: "1px solid #f0f0f0" }}
            >
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
                color: active ? "#059669" : "#d97706", fontWeight: 700, fontSize: "0.78rem", flexShrink: 0,
              }}>
                {user.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#1f2937" }}>{user.name}</span>
                {user.email && <span style={{ fontSize: "0.75rem", color: "#9ca3af", marginLeft: 8 }}>{user.email}</span>}
              </div>
              <div style={{ flex: 2, display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {(user.userRoleGroupMappings || []).map((m, i) => (
                  <span key={i} style={{
                    fontSize: "0.72rem", fontWeight: 500, padding: "2px 8px", borderRadius: "10px",
                    background: "rgba(67, 97, 238, 0.08)", color: "#4361ee",
                  }}>
                    {m.roleGroup?.name}
                  </span>
                ))}
              </div>
              {/* Status badge */}
              <span style={{
                fontSize: "0.72rem", fontWeight: 600, padding: "3px 8px", borderRadius: "6px",
                background: active ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
                color: active ? "#059669" : "#d97706", whiteSpace: "nowrap",
              }}>
                {active ? "Active" : "Inactive"}
              </span>
              {/* Toggle active/inactive */}
              <button
                className="btn btn-sm"
                onClick={() => toggleActive(user.id)}
                disabled={togglingId === user.id}
                title={active ? "Deactivate" : "Activate"}
                style={{
                  width: "28px", height: "28px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: active ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)",
                  color: active ? "#d97706" : "#059669",
                  border: `1px solid ${active ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)"}`,
                  borderRadius: "6px",
                }}
              >
                {togglingId === user.id
                  ? <span className="spinner-border spinner-border-sm" style={{ width: "12px", height: "12px" }}></span>
                  : <i className={`bi bi-${active ? "pause-fill" : "play-fill"}`} style={{ fontSize: "0.7rem" }}></i>
                }
              </button>
              {/* Delete */}
              <button
                className="btn btn-sm"
                onClick={() => handleDeleteMapping(user.id)}
                title="Remove assignments"
                style={{
                  width: "28px", height: "28px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(220, 38, 38, 0.1)", color: "#dc2626", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "6px",
                }}
              >
                <ActionIcon type="delete" size="sm" />
              </button>
            </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-4 text-muted" style={{ fontSize: "0.85rem" }}>
              <i className="bi bi-diagram-3 d-block mb-2" style={{ fontSize: "1.5rem", opacity: 0.3 }}></i>
              No role group assignments found.
            </div>
          )}
        </div>

        {/* Create new assignment */}
        <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: "12px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
            Create New Assignment
          </div>
          <div className="d-flex align-items-center gap-2">
            <div style={{ flex: 1 }}>
              <Select
                options={userOptions}
                value={newUser}
                onChange={(opt: any) => setNewUser(opt)}
                placeholder="Select user..."
                isClearable
                styles={{
                  control: (base) => ({ ...base, minHeight: "34px", fontSize: "0.82rem", borderRadius: "6px" }),
                }}
              />
            </div>
            <div style={{ flex: 2 }}>
              <Select
                isMulti
                closeMenuOnSelect={false}
                options={roleGroupOptions}
                value={newGroups}
                onChange={(opt: any) => setNewGroups(opt || [])}
                placeholder="Select role groups..."
                styles={{
                  control: (base) => ({ ...base, minHeight: "34px", fontSize: "0.82rem", borderRadius: "6px" }),
                  multiValue: (base) => ({ ...base, fontSize: "0.78rem" }),
                }}
              />
            </div>
            <button
              className="btn btn-sm d-flex align-items-center gap-1"
              onClick={handleAssign}
              disabled={saving || !newUser || newGroups.length === 0}
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#fff", border: "none", borderRadius: "6px", padding: "6px 14px",
                fontWeight: 600, fontSize: "0.78rem", whiteSpace: "nowrap",
              }}
            >
              <ActionIcon type="add" size="sm" />
              {saving ? "Saving..." : "Assign"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleAssignmentsTab;
