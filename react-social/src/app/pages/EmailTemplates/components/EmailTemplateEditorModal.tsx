import { FC, useEffect, useMemo, useRef, useState } from "react";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import {
  EmailDeliveryMode,
  EmailMailClass,
  EmailTemplate,
  EmailTemplatePayload,
  EmailTypeCatalogEntry,
  LintFinding,
  createEmailTemplate,
  lintEmailTemplate,
  previewEmailTemplate,
  testEmailTemplate,
  updateEmailTemplate,
} from "../API/EmailTemplate_APIs";
import { MailClassBadge, OriginBadge, SeverityBadge, mono, pill } from "./MailBadges";

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

const CONTENT_ONLY_NOTE = "Ported from code for review. Its sender still builds this mail in Java, so it cannot be made the default yet.";

const EmailTemplateEditorModal: FC<Props> = ({ show, onHide, template, catalog, defaultType, onSaved }) => {
  const [name, setName] = useState("");
  const [emailType, setEmailType] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [textTemplate, setTextTemplate] = useState("");
  const [showText, setShowText] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<EmailDeliveryMode>("ASYNC");
  const [mailClass, setMailClass] = useState<EmailMailClass | "">("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [showPreviewText, setShowPreviewText] = useState(false);
  const [whitelabel, setWhitelabel] = useState(false);
  const [flagOn, setFlagOn] = useState<Record<string, boolean>>({});

  const [findings, setFindings] = useState<LintFinding[]>([]);
  const [lintState, setLintState] = useState<"idle" | "checking" | "error">("idle");

  const subjectRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const lastFocused = useRef<"subject" | "body">("body");

  const variantFlags = useMemo(() => template?.variantFlags ?? [], [template]);
  const contentOnly = template?.portState === "CONTENT_ONLY";
  const hasProvenance = !!template && !!(template.sourceRef || template.seedOrigin);

  useEffect(() => {
    if (!show) return;
    if (template) {
      setName(template.name || "");
      setEmailType(template.emailType || "");
      setSubject(template.subjectTemplate || "");
      setBody(template.bodyTemplate || "");
      setTextTemplate(template.textTemplate || "");
      setShowText(!!template.textTemplate);
      setIsDefault(!!template.isDefault);
      setDeliveryMode(template.deliveryMode || "ASYNC");
      setMailClass(template.mailClass || "");
      setActive(template.active !== false);
      const flags: Record<string, boolean> = {};
      (template.variantFlags || []).forEach((f) => { flags[f] = true; });
      setFlagOn(flags);
    } else {
      const t = defaultType || (catalog[0]?.key ?? "");
      setName("");
      setEmailType(t);
      setSubject("");
      setBody("");
      setTextTemplate("");
      setShowText(false);
      setIsDefault(false);
      setDeliveryMode((catalog.find((c) => c.key === t)?.defaultDeliveryMode as EmailDeliveryMode) || "ASYNC");
      setMailClass("");
      setActive(true);
      setFlagOn({});
    }
    setWhitelabel(false);
    setPreviewText("");
    setShowPreviewText(false);
    setFindings([]);
    setLintState("idle");
  }, [show, template, defaultType, catalog]);

  const selectedEntry = useMemo(() => catalog.find((c) => c.key === emailType), [catalog, emailType]);

  // Variant flag → "true" renders its {{#flag}} section, "" hides it.
  const previewOverrides = useMemo(() => {
    const o: Record<string, string> = {};
    variantFlags.forEach((f) => { o[f] = flagOn[f] === false ? "" : "true"; });
    return o;
  }, [variantFlags, flagOn]);
  const overridesKey = JSON.stringify(previewOverrides);

  // Debounced server-side preview (real placeholder substitution + branding).
  useEffect(() => {
    if (!show) return;
    const handle = setTimeout(() => {
      previewEmailTemplate(buildPayload(), { previewOverrides, whitelabel })
        .then(({ data }) => {
          setPreviewHtml(data.html || "");
          setPreviewSubject(data.subject || "");
          setPreviewText(data.text || "");
        })
        .catch(() => {
          // Fall back to the raw body so the pane is never blank.
          setPreviewHtml(body);
          setPreviewSubject(subject);
          setPreviewText("");
        });
    }, 450);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, subject, body, textTemplate, emailType, overridesKey, whitelabel]);

  // Debounced lint of the unsaved edits; advisory only, never blocks saving.
  useEffect(() => {
    if (!show) return;
    setLintState("checking");
    const handle = setTimeout(() => {
      lintEmailTemplate(buildPayload())
        .then(({ data }) => {
          setFindings(Array.isArray(data) ? data : []);
          setLintState("idle");
        })
        .catch(() => setLintState("error"));
    }, 450);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, subject, body, textTemplate, emailType, mailClass, isDefault]);

  const buildPayload = (): EmailTemplatePayload => ({
    name: name.trim(),
    emailType,
    subjectTemplate: subject,
    bodyTemplate: body,
    isDefault,
    deliveryMode,
    active,
    mailKey: template?.mailKey ?? undefined,
    textTemplate,
    mailClass: mailClass || "",
    variantFlags,
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
  const eyebrow: React.CSSProperties = { fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.4px", color: "#9ca3af", marginBottom: 6 };
  const linkBtn: React.CSSProperties = { background: "none", border: "none", padding: 0, fontSize: "0.78rem", fontWeight: 600, color: "#4f46e5", cursor: "pointer" };
  const codeBox: React.CSSProperties = { ...input, fontFamily: "'Courier New', monospace", fontSize: "0.78rem" };

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

        {/* Provenance strip (read-only) */}
        {template && hasProvenance && (
          <div style={{ padding: "8px 20px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb", fontSize: "0.78rem", color: "#4b5563" }}>
            <div className="d-flex align-items-center gap-3 flex-wrap">
              {template.mailKey && (
                <span><span style={{ color: "#9ca3af" }}>Key </span><code style={{ ...mono, color: "#111827" }}>{template.mailKey}</code></span>
              )}
              <span className="d-inline-flex align-items-center gap-1"><span style={{ color: "#9ca3af" }}>Origin </span><OriginBadge origin={template.seedOrigin} /></span>
              {template.sourceRef && (
                <span title={template.sourceRef}><span style={{ color: "#9ca3af" }}>Source </span><code style={{ ...mono, color: "#111827" }}>{template.sourceRef}</code></span>
              )}
              {template.mailClass && (
                <span className="d-inline-flex align-items-center gap-1"><span style={{ color: "#9ca3af" }}>Class </span><MailClassBadge mailClass={template.mailClass} /></span>
              )}
            </div>
            {contentOnly && (
              <div style={{ marginTop: 6, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", padding: "6px 10px" }}>
                <i className="bi bi-exclamation-triangle-fill me-1"></i>{CONTENT_ONLY_NOTE}
              </div>
            )}
          </div>
        )}

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
                style={{ ...codeBox, minHeight: "260px" }}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onFocus={() => (lastFocused.current = "body")}
                placeholder="<html>… use {{placeholders}} from the palette →</html>"
              />
            </div>

            {/* Plain-text version (collapsible) */}
            <div className="mt-3">
              <button type="button" onClick={() => setShowText((s) => !s)} style={linkBtn}>
                <i className={`bi ${showText ? "bi-chevron-down" : "bi-chevron-right"} me-1`}></i>
                Plain-text version
                <span style={{ fontWeight: 400, color: "#9ca3af" }}> {textTemplate ? `(${textTemplate.length} chars)` : "(none)"}</span>
              </button>
              {showText && (
                <textarea
                  className="form-control form-control-sm mt-2"
                  style={{ ...codeBox, minHeight: "140px" }}
                  value={textTemplate}
                  onChange={(e) => setTextTemplate(e.target.value)}
                  placeholder="Optional text/plain alternative. Same {{placeholders}}; leave empty to send HTML only."
                />
              )}
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
                <select className="form-select form-select-sm" style={{ ...input, width: "150px" }} value={deliveryMode} onChange={(e) => setDeliveryMode(e.target.value as EmailDeliveryMode)}>
                  <option value="ASYNC">ASYNC (fire & forget)</option>
                  <option value="SYNC">SYNC (blocking)</option>
                </select>
              </div>
              <div>
                <label style={label}>Mail class</label>
                <select className="form-select form-select-sm" style={{ ...input, width: "150px" }} value={mailClass} onChange={(e) => setMailClass(e.target.value as EmailMailClass | "")}>
                  <option value="">— unset —</option>
                  <option value="TRANSACTIONAL">Transactional</option>
                  <option value="SUBSCRIBED">Subscribed</option>
                  <option value="INTERNAL">Internal</option>
                </select>
              </div>
              <div className="form-check mt-4" title={contentOnly ? CONTENT_ONLY_NOTE : undefined}>
                <input className="form-check-input" type="checkbox" id="tpl-default" checked={isDefault} disabled={contentOnly} onChange={(e) => setIsDefault(e.target.checked)} />
                <label className="form-check-label" htmlFor="tpl-default" style={{ fontSize: "0.82rem", color: contentOnly ? "#9ca3af" : undefined }}>Default for this type</label>
              </div>
              <div className="form-check mt-4">
                <input className="form-check-input" type="checkbox" id="tpl-active" checked={active} onChange={(e) => setActive(e.target.checked)} />
                <label className="form-check-label" htmlFor="tpl-active" style={{ fontSize: "0.82rem" }}>Active</label>
              </div>
            </div>
          </div>

          {/* ── Right: live preview ── */}
          <div style={{ flex: "1 1 44%", borderLeft: "1px solid #e5e7eb", background: "#f9fafb", padding: "18px 20px", overflowY: "auto" }}>
            <div style={eyebrow}>Live preview (sample data)</div>

            {/* Preview toolbar */}
            <div className="d-flex align-items-center gap-3 flex-wrap mb-2" style={{ fontSize: "0.78rem" }}>
              <div className="form-check form-check-inline m-0">
                <input className="form-check-input" type="checkbox" id="pv-whitelabel" checked={whitelabel} onChange={(e) => setWhitelabel(e.target.checked)} />
                <label className="form-check-label" htmlFor="pv-whitelabel">Whitelabel</label>
              </div>
              {variantFlags.map((f) => (
                <div key={f} className="form-check form-check-inline m-0" title={`{{#${f}}} section`}>
                  <input className="form-check-input" type="checkbox" id={`pv-flag-${f}`} checked={flagOn[f] !== false} onChange={(e) => setFlagOn((s) => ({ ...s, [f]: e.target.checked }))} />
                  <label className="form-check-label" htmlFor={`pv-flag-${f}`} style={mono}>{f}</label>
                </div>
              ))}
            </div>

            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#111827", marginBottom: 8 }}>
              <span style={{ color: "#6b7280" }}>Subject: </span>{previewSubject || <span style={{ color: "#d1d5db" }}>—</span>}
            </div>

            {previewText && (
              <div style={{ marginBottom: 8 }}>
                <button type="button" onClick={() => setShowPreviewText((s) => !s)} style={linkBtn}>
                  <i className={`bi ${showPreviewText ? "bi-chevron-down" : "bi-chevron-right"} me-1`}></i>Text version
                </button>
                {showPreviewText && (
                  <pre style={{ ...mono, marginTop: 6, marginBottom: 0, padding: "8px 10px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", maxHeight: "160px", overflow: "auto", whiteSpace: "pre-wrap", color: "#374151" }}>{previewText}</pre>
                )}
              </div>
            )}

            <iframe
              title="Email preview"
              srcDoc={previewHtml}
              style={{ width: "100%", height: "460px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff" }}
            />

            {/* Findings */}
            <div style={{ marginTop: 12 }}>
              <div className="d-flex align-items-center gap-2" style={eyebrow}>
                <span>Findings</span>
                {lintState === "checking" && <span className="spinner-border spinner-border-sm" style={{ width: 10, height: 10, borderWidth: 1 }} />}
                {lintState === "idle" && findings.length > 0 && <span style={pill("#fee2e2", "#b91c1c")}>{findings.length}</span>}
              </div>
              {lintState === "error" ? (
                <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Lint unavailable right now.</div>
              ) : findings.length === 0 ? (
                <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}><i className="bi bi-check-circle me-1" style={{ color: "#059669" }}></i>No findings</div>
              ) : (
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px 10px" }}>
                  {findings.map((f, i) => (
                    <div key={`${f.code}-${i}`} className="d-flex align-items-start gap-2" style={{ fontSize: "0.8rem", padding: "3px 0" }}>
                      <SeverityBadge severity={f.severity} />
                      <code style={{ ...mono, color: "#4338ca", whiteSpace: "nowrap" }}>{f.code}</code>
                      <span style={{ color: "#374151" }}>{f.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
