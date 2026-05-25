import { useEffect, useState } from "react";
import {
  addReminderSuppression,
  listReminderSuppressions,
  removeReminderSuppression,
} from "../API/Reminder_APIs";
import {
  ALL_SERVICE_TYPES,
  ReminderServiceType,
  ReminderSuppression,
  SERVICE_TYPE_LABEL,
} from "../types";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";

interface Props {
  canManage: boolean;
}

const SuppressionsSection = ({ canManage }: Props) => {
  const [serviceType, setServiceType] = useState<ReminderServiceType | "">("");
  const [rows, setRows] = useState<ReminderSuppression[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [showAdd, setShowAdd] = useState(false);
  const [newStudentId, setNewStudentId] = useState("");
  const [newServiceType, setNewServiceType] = useState<ReminderServiceType>("ASSESSMENT_INVITE_B2C");
  const [newReason, setNewReason] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async (p = 0) => {
    setLoading(true);
    try {
      const res = await listReminderSuppressions({
        serviceType: serviceType || undefined,
        page: p,
        size: 25,
      });
      setRows(res.data.rows);
      setTotalPages(res.data.totalPages);
      setPage(res.data.page);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType]);

  const add = async () => {
    const sid = Number(newStudentId);
    if (!sid) {
      showErrorToast("Student ID required");
      return;
    }
    setAdding(true);
    try {
      await addReminderSuppression({ userStudentId: sid, serviceType: newServiceType, reason: newReason });
      showSuccessToast("Suppression added");
      setShowAdd(false);
      setNewStudentId("");
      setNewReason("");
      load(0);
    } catch (e) {
      console.error(e);
      showErrorToast("Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Remove this suppression?")) return;
    try {
      await removeReminderSuppression(id);
      showSuccessToast("Removed");
      load(page);
    } catch (e) {
      console.error(e);
      showErrorToast("Failed to remove");
    }
  };

  return (
    <div>
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body d-flex justify-content-between align-items-center">
          <div className="d-flex gap-2 align-items-center">
            <label className="form-label small mb-0">Filter by service:</label>
            <select
              className="form-select form-select-sm"
              style={{ maxWidth: 280 }}
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as ReminderServiceType | "")}
            >
              <option value="">All services</option>
              {ALL_SERVICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SERVICE_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary btn-sm"
            disabled={!canManage}
            onClick={() => setShowAdd(true)}
          >
            + Add suppression
          </button>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Student ID</th>
                <th>Service</th>
                <th>Reason</th>
                <th>By</th>
                <th>When</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-5">
                    No suppressions.
                  </td>
                </tr>
              )}
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>{s.userStudentId}</td>
                  <td>{SERVICE_TYPE_LABEL[s.serviceType]}</td>
                  <td className="small">{s.reason || "—"}</td>
                  <td className="small">{s.suppressedBy || "—"}</td>
                  <td className="small">{new Date(s.suppressedAt).toLocaleString()}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      disabled={!canManage}
                      onClick={() => remove(s.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer d-flex justify-content-end gap-1">
          <button className="btn btn-sm btn-light" disabled={page === 0 || loading} onClick={() => load(page - 1)}>
            Previous
          </button>
          <button
            className="btn btn-sm btn-light"
            disabled={page + 1 >= totalPages || loading}
            onClick={() => load(page + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="modal show d-block" tabIndex={-1} style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setShowAdd(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add suppression</h5>
                <button className="btn-close" onClick={() => setShowAdd(false)} />
              </div>
              <div className="modal-body">
                <label className="form-label small">User student ID</label>
                <input
                  type="number"
                  className="form-control mb-3"
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                />
                <label className="form-label small">Service</label>
                <select
                  className="form-select mb-3"
                  value={newServiceType}
                  onChange={(e) => setNewServiceType(e.target.value as ReminderServiceType)}
                >
                  {ALL_SERVICE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {SERVICE_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
                <label className="form-label small">Reason</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                />
              </div>
              <div className="modal-footer">
                <button className="btn btn-light" onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" disabled={adding} onClick={add}>
                  {adding ? "Adding…" : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppressionsSection;
