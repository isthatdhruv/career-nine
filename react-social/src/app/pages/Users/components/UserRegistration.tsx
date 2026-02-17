import { FC, useEffect, useState } from "react";
import axios from "axios";
import UsersRegistrationEditModal from "./UsersRegistrationEditModal";
import UserCollegeMappingModal from "./UserCollegeMappingModal";
import { useNavigate } from "react-router-dom";

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
}

const UserRegistration: FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [selectedMappingUser, setSelectedMappingUser] = useState<UserRow | null>(null);

  const fetchUsers = async () => {
    try {
      setError(null);
      const { data } = await axios.get<UserRow[]>(`${API_URL}/user/registered-users`);
      setUsers(data);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to fetch users";
      setError(msg);
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleActive = async (userId: number) => {
    setTogglingId(userId);
    try {
      await axios.post(`${API_URL}/user/toggle-active/${userId}`);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, isActive: !(u.isActive) } : u
        )
      );
    } catch (err) {
      console.error("Failed to toggle user status", err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleEditClick = (user: UserRow) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    setSelectedUser(null);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
        <div className="text-center">
          <span className="spinner-border spinner-border-lg text-primary" role="status" />
          <p className="text-muted mt-3 fw-semibold">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card shadow-sm">
        <div className="card-header border-0 pt-6 pb-4">
          <div className="d-flex align-items-center justify-content-between w-100">
            <div>
              <h3 className="card-title fw-bold fs-2 text-gray-900 mb-1">
                Users List
              </h3>
              <p className="text-muted fs-7 mb-0">
                Manage and monitor user registrations
              </p>
            </div>
            <div className="card-toolbar">
              <div className="d-flex align-items-center gap-2">
                <span className="badge badge-light-primary fs-6 px-4 py-2">
                  <i className="bi bi-people-fill me-1"></i>
                  {users.length} {users.length === 1 ? "User" : "Users"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="card-body py-4">
          {error && (
            <div className="alert alert-danger d-flex align-items-center mb-5" role="alert">
              <i className="bi bi-exclamation-triangle-fill fs-3 me-3"></i>
              <div>
                <strong>Error:</strong> {error}
              </div>
            </div>
          )}

          {users.length === 0 ? (
            <div className="text-center py-10">
              <i className="bi bi-person-x fs-3x text-muted mb-4 d-block"></i>
              <h4 className="text-gray-700 fw-semibold mb-2">No Users Found</h4>
              <p className="text-muted">There are no registered users at the moment.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-row-bordered table-row-gray-200 align-middle gs-0 gy-3">
                <thead>
                  <tr className="fw-bold text-muted bg-light">
                    <th className="ps-4 min-w-50px rounded-start">S.No</th>
                    <th className="min-w-150px">Name</th>
                    <th className="min-w-200px">Email</th>
                    <th className="min-w-120px">Phone</th>
                    <th className="min-w-150px">Organisation</th>
                    <th className="min-w-120px">Designation</th>
                    <th className="min-w-100px">Status</th>
                    <th className="min-w-150px text-center pe-4 rounded-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => {
                    const active = user.isActive === true;
                    return (
                      <tr key={user.id} className="hover-elevate-up">
                        <td className="ps-4 text-muted fw-semibold">{index + 1}</td>
                        <td>
                          <div className="d-flex align-items-center">
                            <div className="symbol symbol-35px symbol-circle me-3">
                              <div className={`symbol-label bg-light-${active ? "success" : "warning"} text-${active ? "success" : "warning"} fw-bold fs-6`}>
                                {user.name?.charAt(0).toUpperCase() || "U"}
                              </div>
                            </div>
                            <div className="d-flex flex-column">
                              <span className="text-gray-800 fw-bold text-hover-primary">
                                {user.name || "-"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="text-gray-700">
                            {user.email || "-"}
                          </span>
                        </td>
                        <td>
                          <span className="text-gray-700">
                            {user.phone || "-"}
                          </span>
                        </td>
                        <td>
                          <span className="text-gray-700 fw-semibold">
                            {user.organisation || "-"}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-light fs-7 fw-semibold">
                            {user.designation || "-"}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-${active ? "success" : "warning"} fs-7 fw-bold`}>
                            <i className={`bi bi-${active ? "check-circle" : "dash-circle"} me-1`}></i>
                            {active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="text-center pe-4">
                          <div className="d-flex justify-content-center gap-2">
                            <button
                              className={`btn btn-sm ${active ? "btn-danger" : "btn-success"} fw-bold`}
                              disabled={togglingId === user.id}
                              onClick={() => toggleActive(user.id)}
                              title={active ? "Deactivate user" : "Activate user"}
                            >
                              {togglingId === user.id ? (
                                <span className="spinner-border spinner-border-sm" role="status" />
                              ) : (
                                <>
                                  <i className={`bi bi-${active ? "x-circle" : "check-circle"} me-1`}></i>
                                  {active ? "Deactivate" : "Activate"}
                                </>
                              )}
                            </button>
                            <button
                              className="btn btn-sm btn-primary fw-bold"
                              onClick={() => handleEditClick(user)}
                              title="Edit user details"
                            >
                              <i className="bi bi-pencil-square me-1"></i>
                              Edit
                            </button>
                            <button
                              className="btn btn-sm btn-info fw-bold"
                              onClick={() => {
                                setSelectedMappingUser(user);
                                setShowMappingModal(true);
                              }}
                              title="Map to college"
                            >
                              <i className="bi bi-building me-1"></i>
                              Map to College
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <UsersRegistrationEditModal
        show={showEditModal}
        onClose={handleCloseModal}
        user={selectedUser}
        onSave={fetchUsers}
      />

      <UserCollegeMappingModal
        show={showMappingModal}
        onHide={() => {
          setShowMappingModal(false);
          setSelectedMappingUser(null);
        }}
        user={selectedMappingUser}
      />
    </>
  );
};

export default UserRegistration;