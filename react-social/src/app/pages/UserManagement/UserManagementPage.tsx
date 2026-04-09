import RegisteredUsersTab from "./components/RegisteredUsersTab";

const UserManagementPage = () => {
  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px" }}>
      {/* Page Header */}
      <div className="d-flex align-items-center gap-3" style={{ marginBottom: "24px" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="bi bi-people-fill text-white" style={{ fontSize: "1.1rem" }}></i>
        </div>
        <div>
          <h4 style={{ margin: 0, color: "#111827", fontWeight: 700, fontSize: "1.3rem" }}>User Management</h4>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.82rem" }}>
            Manage users, role group assignments, and institute access
          </p>
        </div>
      </div>

      {/* Users table with all actions */}
      <RegisteredUsersTab />
    </div>
  );
};

export default UserManagementPage;
