import { useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import { getUrlAccessLogs } from "../API/ActivityLog_APIs";

interface UrlAccessLog {
  id: number;
  userId: number;
  url: string;
  httpMethod: string;
  accessTime: string;
}

interface UrlAccessModalProps {
  show: boolean;
  onHide: () => void;
  userId: number;
  userName: string;
  startDate: string;
  endDate: string;
}

const UrlAccessModal = (props: UrlAccessModalProps) => {
  const [urlLogs, setUrlLogs] = useState<UrlAccessLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (props.show && props.userId) {
      setLoading(true);
      getUrlAccessLogs(props.userId, props.startDate, props.endDate)
        .then((response) => {
          setUrlLogs(response.data);
        })
        .catch((error) => {
          console.error("Failed to fetch URL access logs:", error);
          setUrlLogs([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [props.show, props.userId, props.startDate, props.endDate]);

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method?.toUpperCase()) {
      case "GET":
        return "badge bg-success";
      case "POST":
        return "badge bg-primary";
      case "PUT":
        return "badge bg-warning text-dark";
      case "DELETE":
        return "badge bg-danger";
      default:
        return "badge bg-secondary";
    }
  };

  return (
    <Modal show={props.show} onHide={props.onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          URL Access History - {props.userName}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading && (
          <div className="text-center py-5">
            <span className="spinner-border spinner-border-sm align-middle me-2"></span>
            Loading URL access logs...
          </div>
        )}

        {!loading && urlLogs.length === 0 && (
          <div className="text-center text-muted py-5">
            No URL access logs found for this user in the selected date range.
          </div>
        )}

        {!loading && urlLogs.length > 0 && (
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            <table className="table table-striped table-hover table-sm">
              <thead className="table-dark" style={{ position: "sticky", top: 0 }}>
                <tr>
                  <th style={{ width: "80px" }}>Method</th>
                  <th>URL</th>
                  <th style={{ width: "180px" }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {urlLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className={getMethodBadgeClass(log.httpMethod)}>
                        {log.httpMethod}
                      </span>
                    </td>
                    <td style={{ wordBreak: "break-all", fontSize: "0.9em" }}>
                      {log.url}
                    </td>
                    <td style={{ fontSize: "0.85em" }}>
                      {formatTimestamp(log.accessTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && urlLogs.length > 0 && (
          <div className="text-muted mt-2" style={{ fontSize: "0.85em" }}>
            Total: {urlLogs.length} requests
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn-secondary" onClick={props.onHide}>
          Close
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default UrlAccessModal;
