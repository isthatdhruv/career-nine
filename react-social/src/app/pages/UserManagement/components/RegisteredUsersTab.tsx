import { FC, useEffect, useState } from "react";
import axios from "axios";
import { Dropdown } from "react-bootstrap";
import UsersRegistrationEditModal from "../../Users/components/UsersRegistrationEditModal";
import UserCollegeMappingModal from "../../Users/components/UserCollegeMappingModal";
import UserRoleGroupModal from "./UserRoleGroupModal";

const API_URL = process.env.REACT_APP_API_URL;

interface UserRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  organisation: string;
  designation: string;
  isActive: boolean | null;
  provider: string;
  dob?: string;
  roleGroups?: string[];
}

const RegisteredUsersTab: FC = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [selectedMappingUser, setSelectedMappingUser] = useState<UserRow | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRoleUser, setSelectedRoleUser] = useState<UserRow | null>(null);
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
          <p className="mt-3 text-muted">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card border-0 shadow-sm" style={{ borderRadius: "12px", overflow: "hidden" }}>
        <div className="card-body p-3">
          {error && (
            <div className="alert alert-danger d-flex align-items-center mb-3" role="alert">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              <span>{error}</span>
            </div>
          )}

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
              {filtered.length} of {users.length} users
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-person-x d-block mb-2" style={{ fontSize: "2rem", color: "#d1d5db" }}></i>
              <span className="text-muted">No users found.</span>
            </div>
          ) : (
            <>
              <style>{`
                .um-table tbody tr:has(.dropdown-menu.show) { z-index: 10; position: relative; }
                .um-table .dropdown-menu.show { position: fixed !important; z-index: 1050 !important; }
              `}</style>
              <div className="um-table" style={{ overflow: "visible" }}>
                <table className="table table-hover align-middle mb-0" style={{ width: "100%", tableLayout: "auto" }}>
                  <thead>
                    <tr style={{ background: "#f8f9fa" }}>
                      {["#", "Name", "Email", "Phone", "Organisation", "Designation", "Status", "Actions"].map((h) => (
                        <th key={h} style={{ padding: "10px 12px", fontWeight: 600, color: "#1a1a2e", borderBottom: "2px solid #e0e0e0", fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((user, index) => {
                      const active = user.isActive === true;
                      return (
                        <tr key={user.id} style={{ background: index % 2 === 0 ? "#fff" : "#fafbfc" }}>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0", fontSize: "0.82rem", color: "#9ca3af" }}>{index + 1}</td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0" }}>
                            <div className="d-flex align-items-center gap-2">
                              <div style={{
                                width: "30px", height: "30px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                                background: active ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
                                color: active ? "#059669" : "#d97706", fontWeight: 700, fontSize: "0.78rem",
                              }}>
                                {user.name?.charAt(0).toUpperCase() || "U"}
                              </div>
                              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1f2937" }}>{user.name || "-"}</span>
                            </div>
                          </td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0", fontSize: "0.82rem", color: "#6b7280" }}>{user.email || "-"}</td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0", fontSize: "0.82rem", color: "#6b7280" }}>{user.phone || "-"}</td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0", fontSize: "0.82rem", color: "#6b7280" }}>{user.organisation || "-"}</td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0", fontSize: "0.82rem", color: "#6b7280" }}>{user.designation || "-"}</td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0" }}>
                            <span style={{
                              fontSize: "0.75rem", fontWeight: 600, padding: "3px 8px", borderRadius: "6px",
                              background: active ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
                              color: active ? "#059669" : "#d97706",
                            }}>
                              {active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0", textAlign: "center" }}>
                            <Dropdown className="d-inline">
                              <Dropdown.Toggle variant="light" size="sm" id={`dd-${user.id}`} className="btn-active-light-primary" style={{ borderRadius: "6px" }}>
                                <i className="bi bi-three-dots-vertical"></i>
                              </Dropdown.Toggle>
                              <Dropdown.Menu style={{ minWidth: "180px", zIndex: 1050 }} popperConfig={{ strategy: "fixed" }} renderOnMount>
                                <Dropdown.Item as="button" disabled={togglingId === user.id} onClick={() => toggleActive(user.id)} className="d-flex align-items-center px-3 py-2" style={{ fontSize: "0.82rem" }}>
                                  {togglingId === user.id ? <span className="spinner-border spinner-border-sm me-2" /> : <i className={`bi bi-${active ? "x-circle" : "check-circle"} me-2 text-${active ? "danger" : "success"}`}></i>}
                                  {active ? "Deactivate" : "Activate"}
                                </Dropdown.Item>
                                <Dropdown.Item as="button" onClick={() => { setSelectedUser(user); setShowEditModal(true); }} className="d-flex align-items-center px-3 py-2" style={{ fontSize: "0.82rem" }}>
                                  <i className="bi bi-pencil-square me-2 text-primary"></i>Edit
                                </Dropdown.Item>
                                <Dropdown.Item as="button" onClick={() => { setSelectedRoleUser(user); setShowRoleModal(true); }} className="d-flex align-items-center px-3 py-2" style={{ fontSize: "0.82rem" }}>
                                  <i className="bi bi-shield-check me-2 text-warning"></i>Assign Role Groups
                                </Dropdown.Item>
                                <Dropdown.Item as="button" onClick={() => { setSelectedMappingUser(user); setShowMappingModal(true); }} className="d-flex align-items-center px-3 py-2" style={{ fontSize: "0.82rem" }}>
                                  <i className="bi bi-building me-2 text-info"></i>Map to College
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
    </>
  );
};

export default RegisteredUsersTab;
