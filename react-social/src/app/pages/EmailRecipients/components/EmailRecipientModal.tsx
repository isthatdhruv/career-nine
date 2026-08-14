import { FC, useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import {
  EmailRecipient,
  EmailRecipientPayload,
  RecipientKind,
  RecipientOptions,
} from "../API/EmailRecipient_APIs";

interface Props {
  show: boolean;
  onHide: () => void;
  onSave: (payload: EmailRecipientPayload) => Promise<void>;
  /** Null when adding. */
  editing: EmailRecipient | null;
  emailType: string;
  options: RecipientOptions | null;
  /** Whether the lead-type / source filters apply to the selected scenario. */
  showLeadFilters: boolean;
}

const EMPTY: EmailRecipientPayload = {
  emailType: "",
  email: "",
  label: null,
  recipientKind: "TO",
  leadType: null,
  source: null,
  active: true,
};

const EmailRecipientModal: FC<Props> = ({
  show,
  onHide,
  onSave,
  editing,
  emailType,
  options,
  showLeadFilters,
}) => {
  const [form, setForm] = useState<EmailRecipientPayload>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on every open so a cancelled edit never leaks into the next add.
  useEffect(() => {
    if (!show) return;
    setError(null);
    setForm(
      editing
        ? {
            emailType: editing.emailType,
            email: editing.email,
            label: editing.label,
            recipientKind: editing.recipientKind,
            leadType: editing.leadType,
            source: editing.source,
            active: editing.active,
          }
        : { ...EMPTY, emailType }
    );
  }, [show, editing, emailType]);

  const set = <K extends keyof EmailRecipientPayload>(key: K, value: EmailRecipientPayload[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.email.trim()) {
      setError("An email address is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...form,
        email: form.email.trim(),
        // Blank inputs mean "no filter", which the server stores as null.
        label: form.label && form.label.trim() ? form.label.trim() : null,
        source: form.source && form.source.trim() ? form.source.trim() : null,
        leadType: form.leadType || null,
      });
      onHide();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Could not save the recipient.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 700 }}>
          {editing ? "Edit recipient" : "Add recipient"}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 6,
              padding: "10px 14px",
              marginBottom: 16,
              color: "#b91c1c",
              fontSize: "0.85rem",
            }}
          >
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </div>
        )}

        <div className="mb-3">
          <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>
            Email address <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            type="email"
            className="form-control form-control-sm"
            placeholder="sales@career-9.com"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            autoFocus
          />
        </div>

        <div className="mb-3">
          <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>
            Label
          </label>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Sales desk"
            value={form.label ?? ""}
            onChange={(e) => set("label", e.target.value)}
          />
          <div className="form-text" style={{ fontSize: "0.75rem" }}>
            Shown on this page only — never in the email.
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>
            Send as
          </label>
          <select
            className="form-select form-select-sm"
            value={form.recipientKind}
            onChange={(e) => set("recipientKind", e.target.value as RecipientKind)}
          >
            {(options?.recipientKinds ?? ["TO", "CC", "BCC"]).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        {showLeadFilters && (
          <>
            <hr style={{ margin: "18px 0", borderColor: "#e5e7eb" }} />
            <div className="mb-3" style={{ fontSize: "0.8rem", color: "#6b7280" }}>
              Leave both filters blank to be notified about <strong>every</strong> lead.
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>
                Only this lead type
              </label>
              <select
                className="form-select form-select-sm"
                value={form.leadType ?? ""}
                onChange={(e) => set("leadType", e.target.value || null)}
              >
                <option value="">All lead types</option>
                {(options?.leadTypes ?? []).map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>
                Only this source
              </label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="website-signup"
                value={form.source ?? ""}
                onChange={(e) => set("source", e.target.value)}
              />
              <div className="form-text" style={{ fontSize: "0.75rem" }}>
                Matches the <code>source</code> field the form sends. Blank = every source.
              </div>
            </div>
          </>
        )}

        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            id="recipient-active"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          <label className="form-check-label" htmlFor="recipient-active" style={{ fontSize: "0.85rem" }}>
            Active — receives notifications
          </label>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <button className="btn btn-sm btn-light" onClick={onHide} disabled={saving}>
          Cancel
        </button>
        <button
          className="btn btn-sm"
          onClick={submit}
          disabled={saving}
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          {saving ? <span className="spinner-border spinner-border-sm me-2" /> : null}
          {editing ? "Save changes" : "Add recipient"}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default EmailRecipientModal;
