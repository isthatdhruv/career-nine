import RegisteredUsersTab from "./components/RegisteredUsersTab";

const UserManagementPage = () => {
  return (
    <div
      className="min-vh-100"
      style={{
        background: "linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)",
        padding: "1rem 1.25rem",
      }}
    >
      {/* Header */}
      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: "12px" }}>
        <div className="card-body p-3">
          <div className="d-flex align-items-center gap-3">
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <i className="bi bi-people-fill text-white" style={{ fontSize: "1.2rem" }}></i>
            </div>
            <div>
              <h5 className="mb-0 fw-bold" style={{ color: "#1a1a2e" }}>User Management</h5>
              <p className="text-muted mb-0" style={{ fontSize: "0.82rem" }}>
                Manage users, role group assignments, and institute access
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Users table with all actions */}
      <RegisteredUsersTab />
    </div>
  );
};

export default UserManagementPage;
