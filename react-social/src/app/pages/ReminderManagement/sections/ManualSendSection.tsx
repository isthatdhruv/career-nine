import { useState } from "react";
import { previewManualReminder, sendManualReminder } from "../API/Reminder_APIs";
import {
  ALL_SERVICE_TYPES,
  RecipientPreview,
  ReminderServiceType,
  SERVICE_TYPE_LABEL,
} from "../types";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";

interface Props {
  canSend: boolean;
}

const ManualSendSection = ({ canSend }: Props) => {
  const [serviceType, setServiceType] = useState<ReminderServiceType>("ASSESSMENT_MAPPING");
  const [assessmentId, setAssessmentId] = useState("");
  const [instituteCode, setInstituteCode] = useState("");
  const [status, setStatus] = useState("notstarted");
  const [previewing, setPreviewing] = useState(false);
  const [recipients, setRecipients] = useState<RecipientPreview[]>([]);
  const [previewNote, setPreviewNote] = useState<string | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [overrideSubject, setOverrideSubject] = useState("");
  const [overrideBody, setOverrideBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    sent: number;
    failed: number;
    suppressed: number;
    capped: number;
  } | null>(null);

  const preview = async () => {
    setPreviewing(true);
    setResult(null);
    try {
      const res = await previewManualReminder({
        serviceType,
        assessmentId: assessmentId ? Number(assessmentId) : undefined,
        instituteCode: instituteCode ? Number(instituteCode) : undefined,
        status: status || undefined,
      });
      setRecipients(res.data.recipients || []);
      setPreviewNote(res.data.note);
    } catch (e) {
      console.error(e);
      showErrorToast("Preview failed");
    } finally {
      setPreviewing(false);
    }
  };

  const send = async () => {
    setSending(true);
    try {
      const res = await sendManualReminder({
        serviceType,
        assessmentId: assessmentId ? Number(assessmentId) : undefined,
        instituteCode: instituteCode ? Number(instituteCode) : undefined,
        status: status || undefined,
        subject: overrideSubject || undefined,
        body: overrideBody || undefined,
      });
      setResult(res.data);
      showSuccessToast(`Sent ${res.data.sent} of ${res.data.total}`);
      setConfirmOpen(false);
    } catch (e) {
      console.error(e);
      showErrorToast("Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="row g-3">
      <div className="col-md-4">
        <div className="card shadow-sm border-0">
          <div className="card-body">
            <h6 className="fw-semibold mb-3">Targeting</h6>
            <label className="form-label small">Service</label>
            <select
              className="form-select mb-3"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as ReminderServiceType)}
            >
              {ALL_SERVICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SERVICE_TYPE_LABEL[t]}
                </option>
              ))}
            </select>

            {serviceType === "ASSESSMENT_MAPPING" && (
              <>
                <label className="form-label small">Assessment ID</label>
                <input
                  type="number"
                  className="form-control mb-3"
                  placeholder="(any)"
                  value={assessmentId}
                  onChange={(e) => setAssessmentId(e.target.value)}
                />
                <label className="form-label small">Institute Code</label>
                <input
                  type="number"
                  className="form-control mb-3"
                  placeholder="(any)"
                  value={instituteCode}
                  onChange={(e) => setInstituteCode(e.target.value)}
                />
                <label className="form-label small">Mapping status</label>
                <select className="form-select mb-3" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="notstarted">notstarted</option>
                  <option value="ongoing">ongoing</option>
                  <option value="completed">completed</option>
                </select>
              </>
            )}

            {serviceType !== "ASSESSMENT_MAPPING" && (
              <div className="alert alert-info small">
                Preview is only implemented for ASSESSMENT_MAPPING in this build. For other service types, the
                schedulers handle ongoing reminders. Use the Templates tab to adjust copy.
              </div>
            )}

            <hr />
            <h6 className="fw-semibold mb-2">Template overrides (optional)</h6>
            <label className="form-label small">Subject</label>
            <input
              type="text"
              className="form-control mb-2"
              placeholder="leave empty to use saved template"
              value={overrideSubject}
              onChange={(e) => setOverrideSubject(e.target.value)}
            />
            <label className="form-label small">Body</label>
            <textarea
              rows={5}
              className="form-control mb-3"
              placeholder="leave empty to use saved template"
              value={overrideBody}
              onChange={(e) => setOverrideBody(e.target.value)}
            />

            <button
              type="button"
              className="btn btn-primary w-100"
              disabled={previewing || serviceType !== "ASSESSMENT_MAPPING"}
              onClick={preview}
            >
              {previewing ? "Loading…" : "Preview recipients"}
            </button>
          </div>
        </div>
      </div>

      <div className="col-md-8">
        <div className="card shadow-sm border-0">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0 fw-semibold">
                Recipients <span className="badge bg-secondary ms-2">{recipients.length}</span>
              </h6>
              <button
                type="button"
                className="btn btn-danger"
                disabled={!canSend || recipients.length === 0}
                onClick={() => setConfirmOpen(true)}
              >
                Send to {recipients.length} now
              </button>
            </div>

            {previewNote && <div className="alert alert-warning small mb-3">{previewNote}</div>}

            {result && (
              <div className="alert alert-success small mb-3">
                Sent <strong>{result.sent}</strong> of <strong>{result.total}</strong>.
                {result.failed > 0 && <> Failed: {result.failed}.</>}
                {result.suppressed > 0 && <> Suppressed: {result.suppressed}.</>}
                {result.capped > 0 && <> Capped: {result.capped}.</>}
              </div>
            )}

            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Student ID</th>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Institute</th>
                    <th>Assessment</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        Run "Preview recipients" to see who would be emailed.
                      </td>
                    </tr>
                  )}
                  {recipients.map((r, i) => (
                    <tr key={i}>
                      <td>{r.userStudentId}</td>
                      <td className="small">{r.email}</td>
                      <td className="small">{r.name}</td>
                      <td className="small">{r.instituteName || r.instituteCode}</td>
                      <td>{r.assessmentId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="modal show d-block" tabIndex={-1} style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setConfirmOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm send</h5>
                <button className="btn-close" onClick={() => setConfirmOpen(false)} />
              </div>
              <div className="modal-body">
                You are about to send <strong>{recipients.length}</strong> emails for{" "}
                <strong>{SERVICE_TYPE_LABEL[serviceType]}</strong>. Suppressions and caps will still be honoured.
              </div>
              <div className="modal-footer">
                <button className="btn btn-light" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </button>
                <button className="btn btn-danger" disabled={sending} onClick={send}>
                  {sending ? "Sending…" : "Send now"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualSendSection;
