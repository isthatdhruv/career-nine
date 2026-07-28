import { FC, useEffect, useMemo, useRef, useState } from "react";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import {
  EmailDeliveryMode,
  EmailTemplate,
  EmailTemplatePayload,
  EmailTypeCatalogEntry,
  createEmailTemplate,
  previewEmailTemplate,
  testEmailTemplate,
  updateEmailTemplate,
} from "../API/EmailTemplate_APIs";

interface Props {
  show: boolean;
  onHide: () => void;
  template: EmailTemplate | null; // null => create mode
  catalog: EmailTypeCatalogEntry[];
  defaultType?: string;
  onSaved: () => void;
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(17,24,39,0.55)",
  zIndex: 1060,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "24px",
  overflowY: "auto",
};

const EmailTemplateEditorModal: FC<Props> = ({ show, onHide, template, catalog, defaultType, onSaved }) => {
  const [name, setName] = useState("");
  const [emailType, setEmailType] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<EmailDeliveryMode>("ASYNC");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");

  const subjectRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const lastFocused = useRef<"subject" | "body">("body");

  useEffect(() => {
    if (!show) return;
    if (template) {
      setName(template.name || "");
      setEmailType(template.emailType || "");
      setSubject(template.subjectTemplate || "");
      setBody(template.bodyTemplate || "");
      setIsDefault(!!template.isDefault);
      setDeliveryMode(template.deliveryMode || "ASYNC");
      setActive(template.active !== false);
    } else {
      const t = defaultType || (catalog[0]?.key ?? "");
      setName("");
      setEmailType(t);
      setSubject("");
      setBody("");
      setIsDefault(false);
      setDeliveryMode((catalog.find((c) => c.key === t)?.defaultDeliveryMode as EmailDeliveryMode) || "ASYNC");
      setActive(true);
    }
  }, [show, template, defaultType, catalog]);

  const selectedEntry = useMemo(() => catalog.find((c) => c.key === emailType), [catalog, emailType]);

  // Debounced server-side preview (real placeholder substitution + branding).
  useEffect(() => {
    if (!show) return;
    const handle = setTimeout(() => {
      previewEmailTemplate(buildPayload())
        .then(({ data }) => {
          setPreviewHtml(data.html || "");
          setPreviewSubject(data.subject || "");
        })
        .catch(() => {
          // Fall back to the raw body so the pane is never blank.
          setPreviewHtml(body);
          setPreviewSubject(subject);
        });
    }, 450);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, subject, body, emailType]);

  const buildPayload = (): EmailTemplatePayload => ({
    name: name.trim(),
    emailType,
    subjectTemplate: subject,
    bodyTemplate: body,
    isDefault,
    deliveryMode,
    active,
  });

  const insertPlaceholder = (key: string) => {
    const token = `{{${key}}}`;
    if (lastFocused.current === "subject" && subjectRef.current) {
      const el = subjectRef.current;
      const start = el.selectionStart ?? subject.length;
      const end = el.selectionEnd ?? subject.length;
      const next = subject.slice(0, start) + token + subject.slice(end);
      setSubject(next);
      requestAnimationFrame(() => {
        el.focus();
        el.selectionStart = el.selectionEnd = start + token.length;
      });
    } else {
      const el = bodyRef.current;
      const start = el?.selectionStart ?? body.length;
      const end = el?.selectionEnd ?? body.length;
      const next = body.slice(0, start) + token + body.slice(end);
      setBody(next);
      requestAnimationFrame(() => {
        if (el) {
          el.focus();
          el.selectionStart = el.selectionEnd = start + token.length;
        }
      });
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showErrorToast("Template name is required");
      return;
    }
    if (!emailType) {
      showErrorToast("Pick an email type");
      return;
    }
    setSaving(true);
    try {
      if (template) {
        await updateEmailTemplate(template.id, buildPayload());
        showSuccessToast("Template updated");
      } else {
        await createEmailTemplate(buildPayload());
        showSuccessToast("Template created");
      }
      onSaved();
      onHide();
    } catch (err: any) {
      showErrorToast(err?.response?.data?.error || err?.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!template) {
      showErrorToast("Save the template first, then send a test");
      return;
    }
    const to = window.prompt("Send a test of this template to which address?");
    if (!to || !to.trim()) return;
    try {
      const { data } = await testEmailTemplate(template.id, to.trim());
      if (data.success) {
        showSuccessToast(`Test sent to ${to.trim()}${data.logId ? ` (log #${data.logId})` : ""}`);
      } else {
        showErrorToast(`Test failed${data.status ? ` [${data.status}]` : ""}: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || err?.message || "Failed to send test");
    }
  };

  if (!show) return null;

  const placeholders = selectedEntry?.placeholders ?? [];
  const groups = Array.from(new Set(placeholders.map((p) => p.group)));

  const label: React.CSSProperties = { fontSize: "0.78rem", fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" };
  const input: React.CSSProperties = { borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.85rem" };

  return (
    <div style={overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onHide(); }}>
      <div style={{ background: "#fff", borderRadius: "12px", width: "min(1120px, 100%)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center" }}>
          <i className="bi bi-envelope-paper-fill me-2" style={{ color: "#4f46e5", fontSize: "1.1rem" }}></i>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "#111827" }}>
            {template ? "Edit template" : "New template"}
          </span>
          <button className="btn btn-sm btn-light ms-auto" onClick={onHide} style={{ borderRadius: "6px" }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div style={{ display: "flex", gap: 0, maxHeight: "calc(100vh - 180px)" }}>
          {/* ── Left: form ── */}
          <div style={{ flex: "1 1 56%", padding: "18px 20px", overflowY: "auto" }}>
            <div className="row g-3">
              <div className="col-md-7">
                <label style={label}>Template name</label>
                <input className="form-control form-control-sm" style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Login credentials (default)" />
              </div>
              <div className="col-md-5">
                <label style={label}>Email type (scenario)</label>
                <select
                  className="form-select form-select-sm"
                  style={input}
                  value={emailType}
                  onChange={(e) => setEmailType(e.target.value)}
                  disabled={!!template}
                >
                  {catalog.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label} ({c.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label style={label}>Subject</label>
              <input
                ref={subjectRef}
                className="form-control form-control-sm"
                style={input}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                onFocus={() => (lastFocused.current = "subject")}
                placeholder="e.g. Your {{school_name}} login credentials"
              />
            </div>

            <div className="mt-3">
              <label style={label}>HTML body</label>
              <textarea
                ref={bodyRef}
                className="form-control form-control-sm"
                style={{ ...input, fontFamily: "'Courier New', monospace", minHeight: "260px", fontSize: "0.78rem" }}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onFocus={() => (lastFocused.current = "body")}
                placeholder="<html>… use {{placeholders}} from the palette →</html>"
              />
            </div>

            {/* Placeholder palette */}
            <div className="mt-3">
              <label style={label}>Insert variable {selectedEntry ? `(for ${selectedEntry.label})` : ""}</label>
              {placeholders.length === 0 ? (
                <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>No variables for this type.</div>
              ) : (
                groups.map((g) => (
                  <div key={g} className="mb-2">
                    <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.4px", color: "#9ca3af", marginBottom: 3 }}>{g}</div>
                    <div className="d-flex flex-wrap gap-1">
                      {placeholders.filter((p) => p.group === g).map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          title={p.label}
                          onClick={() => insertPlaceholder(p.key)}
                          style={{ fontSize: "0.74rem", fontFamily: "'Courier New', monospace", padding: "3px 8px", borderRadius: "6px", border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", cursor: "pointer" }}
                        >
                          {`{{${p.key}}}`}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Toggles */}
            <div className="d-flex align-items-center gap-4 mt-3 flex-wrap">
              <div>
                <label style={label}>Delivery</label>
                <select className="form-select form-select-sm" style={{ ...input, width: "130px" }} value={deliveryMode} onChange={(e) => setDeliveryMode(e.target.value as EmailDeliveryMode)}>
                  <option value="ASYNC">ASYNC (fire & forget)</option>
                  <option value="SYNC">SYNC (blocking)</option>
                </select>
              </div>
              <div className="form-check mt-4">
                <input className="form-check-input" type="checkbox" id="tpl-default" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                <label className="form-check-label" htmlFor="tpl-default" style={{ fontSize: "0.82rem" }}>Default for this type</label>
              </div>
              <div className="form-check mt-4">
                <input className="form-check-input" type="checkbox" id="tpl-active" checked={active} onChange={(e) => setActive(e.target.checked)} />
                <label className="form-check-label" htmlFor="tpl-active" style={{ fontSize: "0.82rem" }}>Active</label>
              </div>
            </div>
          </div>

          {/* ── Right: live preview ── */}
          <div style={{ flex: "1 1 44%", borderLeft: "1px solid #e5e7eb", background: "#f9fafb", padding: "18px 20px", overflowY: "auto" }}>
            <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.4px", color: "#9ca3af", marginBottom: 6 }}>Live preview (sample data)</div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#111827", marginBottom: 8 }}>
              <span style={{ color: "#6b7280" }}>Subject: </span>{previewSubject || <span style={{ color: "#d1d5db" }}>—</span>}
            </div>
            <iframe
              title="Email preview"
              srcDoc={previewHtml}
              style={{ width: "100%", height: "460px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff" }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8 }}>
          {template && (
            <button className="btn btn-sm btn-light" onClick={handleTest} style={{ borderRadius: "6px" }}>
              <i className="bi bi-send me-1"></i>Send test
            </button>
          )}
          <button className="btn btn-sm btn-light ms-auto" onClick={onHide} style={{ borderRadius: "6px" }}>Cancel</button>
          <button
            className="btn btn-sm"
            onClick={handleSave}
            disabled={saving}
            style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600 }}
          >
            {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check-lg me-1"></i>Save</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailTemplateEditorModal;
