import { useState } from "react";
import { getLoginLogs } from "./API/ActivityLog_APIs";
import UrlAccessModal from "./components/UrlAccessModal";

interface LoginLog {
  id: number;
  userId: number;
  userName: string;
  email: string;
  organisation: string;
  ipAddress: string;
  userAgent: string;
  deviceInfo: string;
  loginTime: string;
}

const ActivityLogPage = () => {
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  // Modal state
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(0);
  const [selectedUserName, setSelectedUserName] = useState("");

  const handleFetch = () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setFetched(true);
    getLoginLogs(startDate, endDate)
      .then((response) => {
        setLoginLogs(response.data);
      })
      .catch((error) => {
        console.error("Failed to fetch login logs:", error);
        setLoginLogs([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleViewUrls = (userId: number, userName: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    setShowUrlModal(true);
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="card">
      <div className="card-header border-0 pt-6">
        <div className="card-title">
          <h1>User Activity Log</h1>
        </div>
      </div>

      <div className="card-body pt-3">
        {/* Date Filter */}
        <div className="row mb-5 align-items-end">
          <div className="col-md-3">
            <label className="form-label fw-bold">Start Date</label>
            <input
              type="date"
              className="form-control"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label fw-bold">End Date</label>
            <input
              type="date"
              className="form-control"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <button
              className="btn btn-primary"
              onClick={handleFetch}
              disabled={loading || !startDate || !endDate}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm align-middle me-2"></span>
                  Fetching...
                </>
              ) : (
                "Fetch Logs"
              )}
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-10">
            <span className="spinner-border spinner-border-sm align-middle me-2"></span>
            Loading activity logs...
          </div>
        )}

        {/* No results */}
        {!loading && fetched && loginLogs.length === 0 && (
          <div className="text-center text-muted py-10">
            No login activity found for the selected date range.
          </div>
        )}

        {/* Login logs table */}
        {!loading && loginLogs.length > 0 && (
          <div className="table-responsive">
            <table className="table table-row-bordered table-row-gray-300 align-middle gs-0 gy-3">
              <thead>
                <tr className="fw-bold text-muted bg-light">
                  <th className="ps-4">#</th>
                  <th>User Name</th>
                  <th>Email</th>
                  <th>Organisation</th>
                  <th>IP Address</th>
                  <th>Device / System</th>
                  <th>Login Time</th>
                  <th className="text-center">URLs</th>
                </tr>
              </thead>
              <tbody>
                {loginLogs.map((log, index) => (
                  <tr key={log.id}>
                    <td className="ps-4">{index + 1}</td>
                    <td className="fw-bold">{log.userName || "-"}</td>
                    <td>{log.email || "-"}</td>
                    <td>{log.organisation || "-"}</td>
                    <td>
                      <span className="badge bg-light text-dark">
                        {log.ipAddress || "-"}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.9em" }}>
                      {log.deviceInfo || "-"}
                    </td>
                    <td style={{ fontSize: "0.9em" }}>
                      {formatTimestamp(log.loginTime)}
                    </td>
                    <td className="text-center">
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() =>
                          handleViewUrls(
                            log.userId,
                            log.userName || log.email
                          )
                        }
                      >
                        View URLs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && loginLogs.length > 0 && (
          <div className="text-muted mt-3">
            Total logins: {loginLogs.length}
          </div>
        )}
      </div>

      {/* URL Access Modal */}
      <UrlAccessModal
        show={showUrlModal}
        onHide={() => setShowUrlModal(false)}
        userId={selectedUserId}
        userName={selectedUserName}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
};

export default ActivityLogPage;
