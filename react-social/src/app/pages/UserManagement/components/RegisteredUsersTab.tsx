import { FC, useEffect, useState } from "react";
import axios from "axios";
import { Dropdown } from "react-bootstrap";
import UsersRegistrationEditModal from "../../Users/components/UsersRegistrationEditModal";
import UserCollegeMappingModal from "../../Users/components/UserCollegeMappingModal";
import UserRoleGroupModal from "./UserRoleGroupModal";
import UserPasswordResetModal from "./UserPasswordResetModal";

const API_URL = process.env.REACT_APP_API_URL;

interface UserRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  organisation: string;
  designation: string;
  isActive: boolean | null;
  isSuperAdmin?: boolean;
  provider: string;
  dob?: string;
  roleGroups?: string[];
  userRoleGroupMappings?: { id: number; roleGroup: { id: number; name: string } }[];
}

const RegisteredUsersTab: FC = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [togglingSuperAdminId, setTogglingSuperAdminId] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [selectedMappingUser, setSelectedMappingUser] = useState<UserRow | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRoleUser, setSelectedRoleUser] = useState<UserRow | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedPasswordUser, setSelectedPasswordUser] = useState<UserRow | null>(null);
  const [searchText, setSearchText] = useState("");

  const fetchUsers = async () => {
    try {
      setError(null);
      const { data } = await axios.get<UserRow[]>(`${API_URL}/user/registered-users`);
      setUsers(data);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to fetch users";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleActive = async (userId: number) => {
    setTogglingId(userId);
    try {
      await axios.post(`${API_URL}/user/toggle-active/${userId}`);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, isActive: !u.isActive } : u));
    } catch (err) {
      console.error("Failed to toggle user status", err);
    } finally {
      setTogglingId(null);
    }
  };

  const toggleSuperAdmin = async (user: UserRow) => {
    const isSuper = user.isSuperAdmin === true;
    const verb = isSuper ? "revoke super-admin from" : "grant super-admin to";
    const warning = isSuper
      ? ""
      : "\n\nSuper-admins bypass all permission and URL checks across the system.";
    if (!window.confirm(`Are you sure you want to ${verb} ${user.name || user.email}?${warning}\n\nThe user must re-login for the change to fully take effect.`)) {
      return;
    }
    setTogglingSuperAdminId(user.id);
    try {
      const { data } = await axios.post(`${API_URL}/user/toggle-super-admin/${user.id}`);
      const newStatus = typeof data?.isSuperAdmin === "boolean" ? data.isSuperAdmin : !isSuper;
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, isSuperAdmin: newStatus } : u));
      if (data?.message) {
        // Best-effort surface — keep it simple, no toast lib coupling.
        window.alert(data.message);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to toggle super-admin status";
      window.alert(msg);
    } finally {
      setTogglingSuperAdminId(null);
    }
  };

  const filtered = users.filter((u) => {
    if (!searchText.trim()) return true;
    const q = searchText.trim().toLowerCase();
    return (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "48px", textAlign: "center" }}>
        <div className="spinner-border" style={{ color: "#059669" }} role="status"></div>
        <p className="mt-3" style={{ color: "#6b7280" }}>Loading users...</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ padding: "16px" }}>
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "10px 14px", marginBottom: "16px", color: "#b91c1c", fontSize: "0.85rem" }} className="d-flex align-items-center">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Toolbar */}
          <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
            <div className="position-relative" style={{ flex: "1 0 200px", maxWidth: "320px" }}>
              <i className="bi bi-search position-absolute" style={{ left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: "0.85rem" }}></i>
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Search by name or email..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ paddingLeft: 32, borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.85rem" }}
              />
            </div>
            <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
              {filtered.length} of {users.length} users
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-person-x d-block mb-2" style={{ fontSize: "2rem", color: "#d1d5db" }}></i>
              <span style={{ color: "#6b7280" }}>No users found.</span>
            </div>
          ) : (
            <>
              <style>{`
                .um-table tbody tr:has(.dropdown-menu.show) { z-index: 10; position: relative; }
                .um-table .dropdown-menu.show { position: fixed !important; z-index: 1050 !important; }
              `}</style>
              <div className="um-table" style={{ overflow: "visible" }}>
                <table className="table table-hover align-middle mb-0" style={{ width: "100%", tableLayout: "auto", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                      {["#", "Name", "Email", "Phone", "Organisation", "Designation", "Status", "Actions"].map((h) => (
                        <th key={h} style={{ padding: "10px 12px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px", whiteSpace: "nowrap", background: "#f9fafb" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((user, index) => {
                      const active = user.isActive === true;
                      return (
                        <tr key={user.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "8px 12px", color: "#9ca3af" }}>{index + 1}</td>
                          <td style={{ padding: "8px 12px" }}>
                            <div className="d-flex align-items-center gap-2">
                              <div style={{
                                width: "30px", height: "30px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                                background: active ? "#059669" : "#d97706",
                                color: "#fff", fontWeight: 700, fontSize: "0.78rem",
                              }}>
                                {user.name?.charAt(0).toUpperCase() || "U"}
                              </div>
                              <span style={{ fontWeight: 600, color: "#111827" }}>{user.name || "-"}</span>
                              {user.isSuperAdmin && (
                                <span
                                  title="This user is a super admin — bypasses all permission and URL checks"
                                  style={{
                                    fontSize: "0.65rem",
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: "3px",
                                    background: "#7c3aed",
                                    color: "#fff",
                                    letterSpacing: "0.3px",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  <i className="bi bi-shield-fill-check me-1"></i>Super
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "8px 12px", color: "#4b5563" }}>{user.email || "-"}</td>
                          <td style={{ padding: "8px 12px", color: "#4b5563" }}>{user.phone || "-"}</td>
                          <td style={{ padding: "8px 12px", color: "#4b5563" }}>{user.organisation || "-"}</td>
                          <td style={{ padding: "8px 12px", color: "#4b5563" }}>{user.designation || "-"}</td>
                          <td style={{ padding: "8px 12px" }}>
                            <span style={{
                              fontSize: "0.8rem", fontWeight: 700, padding: "5px 12px", borderRadius: "4px", display: "inline-block",
                              background: active ? "#059669" : "#d97706",
                              color: "#fff",
                            }}>
                              {active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "center" }}>
                            <Dropdown className="d-inline">
                              <Dropdown.Toggle variant="light" size="sm" id={`dd-${user.id}`} style={{ borderRadius: "6px", background: "#fff", border: "2px solid #2563eb", color: "#2563eb", width: "36px", height: "36px", padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                                <i className="bi bi-three-dots-vertical" style={{ fontSize: "0.9rem" }}></i>
                              </Dropdown.Toggle>
                              <Dropdown.Menu style={{ minWidth: "220px", zIndex: 1050, borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", padding: "6px" }} popperConfig={{ strategy: "fixed" }} renderOnMount>
                                <Dropdown.Item as="button" disabled={togglingId === user.id} onClick={() => toggleActive(user.id)} className="d-flex align-items-center px-3 py-2" style={{ fontSize: "0.85rem", borderRadius: "6px" }}>
                                  {togglingId === user.id ? <span className="spinner-border spinner-border-sm me-2" /> : <i className={`bi bi-${active ? "x-circle-fill" : "check-circle-fill"} me-2`} style={{ color: active ? "#dc2626" : "#059669", fontSize: "1rem" }}></i>}
                                  {active ? "Deactivate" : "Activate"}
                                </Dropdown.Item>
                                <Dropdown.Item as="button" onClick={() => { setSelectedUser(user); setShowEditModal(true); }} className="d-flex align-items-center px-3 py-2" style={{ fontSize: "0.85rem", borderRadius: "6px" }}>
                                  <i className="bi bi-pencil-square-fill me-2" style={{ color: "#2563eb", fontSize: "1rem" }}></i>Edit User
                                </Dropdown.Item>
                                <Dropdown.Item as="button" onClick={() => { setSelectedRoleUser(user); setShowRoleModal(true); }} className="d-flex align-items-center px-3 py-2" style={{ fontSize: "0.85rem", borderRadius: "6px" }}>
                                  <i className="bi bi-shield-check me-2" style={{ color: "#d97706", fontSize: "1rem" }}></i>Assign Role Groups
                                </Dropdown.Item>
                                <Dropdown.Item as="button" disabled={togglingSuperAdminId === user.id} onClick={() => toggleSuperAdmin(user)} className="d-flex align-items-center px-3 py-2" style={{ fontSize: "0.85rem", borderRadius: "6px" }}>
                                  {togglingSuperAdminId === user.id
                                    ? <span className="spinner-border spinner-border-sm me-2" />
                                    : <i className={`bi bi-shield-${user.isSuperAdmin ? "slash-fill" : "fill-plus"} me-2`} style={{ color: user.isSuperAdmin ? "#dc2626" : "#7c3aed", fontSize: "1rem" }}></i>}
                                  {user.isSuperAdmin ? "Revoke Super Admin" : "Make Super Admin"}
                                </Dropdown.Item>
                                <Dropdown.Item as="button" onClick={() => { setSelectedMappingUser(user); setShowMappingModal(true); }} className="d-flex align-items-center px-3 py-2" style={{ fontSize: "0.85rem", borderRadius: "6px" }}>
                                  <i className="bi bi-building-fill me-2" style={{ color: "#0891b2", fontSize: "1rem" }}></i>Map to College
                                </Dropdown.Item>
                                <Dropdown.Item as="button" onClick={() => { setSelectedPasswordUser(user); setShowPasswordModal(true); }} className="d-flex align-items-center px-3 py-2" style={{ fontSize: "0.85rem", borderRadius: "6px" }}>
                                  <i className="bi bi-key-fill me-2" style={{ color: "#d97706", fontSize: "1rem" }}></i>Reset Password
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <UsersRegistrationEditModal
        show={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedUser(null); }}
        user={selectedUser}
        onSave={fetchUsers}
      />
      <UserCollegeMappingModal
        show={showMappingModal}
        onHide={() => { setShowMappingModal(false); setSelectedMappingUser(null); }}
        user={selectedMappingUser}
      />
      <UserRoleGroupModal
        show={showRoleModal}
        onHide={() => { setShowRoleModal(false); setSelectedRoleUser(null); }}
        user={selectedRoleUser}
      />
      <UserPasswordResetModal
        show={showPasswordModal}
        onHide={() => { setShowPasswordModal(false); setSelectedPasswordUser(null); }}
        user={selectedPasswordUser}
      />
    </>
  );
};

export default RegisteredUsersTab;
