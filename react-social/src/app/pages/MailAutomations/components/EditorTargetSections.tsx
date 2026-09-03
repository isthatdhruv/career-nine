import { FC, useMemo, useState } from "react";
import SearchableSelect from "../../../components/SearchableSelect";
import { EmailTemplate } from "../../EmailTemplates/API/EmailTemplate_APIs";
import { mono, pill } from "../../EmailTemplates/components/MailBadges";
import { Field, KeyCheckList, Radio, Section, SectionProps, inputStyle, toggleIn } from "./EditorShared";
import { withSelectedExtras } from "./EditorTriggerSections";
import { ScopeMode, fieldLabel, hint, parseExtraRecipients, templateTokens, unionOf } from "./automationHelpers";

// Template, Recipients, Cancel-on and Scope sections of the automation editor.

export interface InstituteOption {
  code: number;
  name: string;
}

const LiveBadge: FC<{ t: EmailTemplate }> = ({ t }) => {
  if (t.live) return <span style={pill("#d1fae5", "#047857")}>live</span>;
  if (t.portState === "CONTENT_ONLY") return <span style={pill("#fef3c7", "#b45309")} title="Its sender still builds this mail in Java">content-only</span>;
  return <span style={pill("#f3f4f6", "#6b7280")}>{t.active ? "not default" : "inactive"}</span>;
};

export const TemplateSection: FC<SectionProps & { templates: EmailTemplate[]; loadingTemplates: boolean }> = ({ draft, set, events, disabled, templates, loadingTemplates }) => {
  const [q, setQ] = useState("");
  const selected = templates.find((t) => t.id === draft.templateId) || null;

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? templates.filter((t) => [t.name, t.mailKey, t.emailType].filter(Boolean).join(" ").toLowerCase().includes(s)) : templates;
    return list.slice(0, 40);
  }, [templates, q]);

  // {{placeholders}} the template uses that the trigger event(s) do not supply. Only computed
  // when the row carries a body and the trigger is an event (audiences declare no fields).
  const missing = useMemo(() => {
    if (!selected || !selected.bodyTemplate || draft.triggerMode !== "event" || draft.triggerEvents.length === 0) return null;
    const fields = unionOf(events, draft.triggerEvents, (e) => e.fields).map((f) => f.key);
    return templateTokens(selected.bodyTemplate, selected.subjectTemplate).filter((k) => !fields.includes(k));
  }, [selected, events, draft.triggerMode, draft.triggerEvents]);

  return (
    <Section icon="bi-envelope-paper-fill" title="Template" description="The subject and body that get sent. The email type is taken from the template.">
      {selected ? (
        <div style={{ border: "1px solid #c7d2fe", background: "#eef2ff", borderRadius: 8, padding: "8px 12px" }} className="d-flex align-items-start gap-2 flex-wrap">
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span style={{ fontWeight: 700, color: "#111827" }}>{selected.name}</span>
              {selected.mailKey && <code style={{ ...mono, color: "#4338ca" }}>{selected.mailKey}</code>}
              <LiveBadge t={selected} />
            </div>
            <div style={{ fontSize: "0.76rem", color: "#4b5563" }}>
              {selected.emailType}{selected.subjectTemplate ? ` · ${selected.subjectTemplate}` : ""}
            </div>
          </div>
          {!disabled && (
            <button type="button" className="btn btn-sm btn-light" style={{ borderRadius: 6, color: "#4f46e5", fontWeight: 600 }} onClick={() => set("templateId", null)}>Change</button>
          )}
        </div>
      ) : (
        <>
          <input className="form-control form-control-sm mb-2" style={inputStyle} placeholder="Search templates by name, key or type…" value={q} onChange={(e) => setQ(e.target.value)} disabled={disabled} autoFocus />
          {loadingTemplates ? (
            <div style={hint}><span className="spinner-border spinner-border-sm me-2" style={{ width: 12, height: 12, borderWidth: 1 }} />Loading templates…</div>
          ) : shown.length === 0 ? (
            <div style={hint}>No templates match.</div>
          ) : (
            <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
              {shown.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => set("templateId", t.id)}
                  style={{ display: "flex", width: "100%", textAlign: "left", gap: 8, alignItems: "center", padding: "6px 10px", border: "none", borderBottom: "1px solid #f3f4f6", background: "#fff", cursor: "pointer", fontSize: "0.83rem" }}
                >
                  <span style={{ fontWeight: 600, color: "#111827" }}>{t.name}</span>
                  {t.mailKey && <code style={{ ...mono, color: "#6b7280" }}>{t.mailKey}</code>}
                  <span style={{ ...hint, marginLeft: "auto" }}>{t.emailType}</span>
                  <LiveBadge t={t} />
                </button>
              ))}
              {templates.length > shown.length && <div style={{ ...hint, padding: "6px 10px" }}>Showing {shown.length} of {templates.length}. Refine the search to see more.</div>}
            </div>
          )}
        </>
      )}

      {missing && missing.length > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "6px 10px", fontSize: "0.78rem", color: "#92400e", marginTop: 8 }}>
          <i className="bi bi-exclamation-triangle-fill me-1"></i>These placeholders are not supplied by the trigger event(s):
          <span className="d-inline-flex flex-wrap gap-1 ms-1">
            {missing.map((k) => <code key={k} style={{ ...mono, background: "#fff", borderRadius: 4, padding: "0 4px", color: "#92400e" }}>{`{{${k}}}`}</code>)}
          </span>
        </div>
      )}
      {missing && missing.length === 0 && (
        <div style={{ ...hint, color: "#047857", marginTop: 8 }}><i className="bi bi-check-circle-fill me-1"></i>Every placeholder in this template is supplied by the trigger event(s).</div>
      )}
    </Section>
  );
};

export const RecipientsSection: FC<SectionProps> = ({ draft, set, events, disabled }) => {
  const scheduled = draft.triggerMode === "schedule";
  const noEvents = !scheduled && draft.triggerEvents.length === 0;
  const roles = unionOf(events, scheduled ? [] : draft.triggerEvents, (e) => e.roles);
  const extra = parseExtraRecipients(draft.extraRecipientsText);
  return (
    <Section
      icon="bi-people-fill"
      title="Recipients"
      description={scheduled
        ? "Roles are resolved per subject in the audience; every known role is listed."
        : "Roles are resolved from the event's subject, e.g. the student, their parent or the counsellor."}
    >
      <label style={fieldLabel}>Roles</label>
      {noEvents
        ? <div style={hint}>Pick a trigger event first.</div>
        : <KeyCheckList idPrefix="role" options={withSelectedExtras(roles, draft.recipientRoles)} selected={draft.recipientRoles} disabled={disabled} onToggle={(k) => set("recipientRoles", toggleIn(draft.recipientRoles, k))} columns={2} empty="The selected trigger(s) offer no roles." />}
      <Field label="Extra addresses" style={{ marginTop: 12 }} hint={extra.length ? `${extra.length} address${extra.length === 1 ? "" : "es"}, always included` : "One per line or comma separated. Always included."}>
        <textarea className="form-control form-control-sm" style={{ ...inputStyle, minHeight: 70 }} value={draft.extraRecipientsText} onChange={(e) => set("extraRecipientsText", e.target.value)} disabled={disabled} placeholder={"ops@example.com\ncounselling@example.com"} />
      </Field>
    </Section>
  );
};

export const CancelOnSection: FC<SectionProps> = ({ draft, set, events, disabled }) => (
  <Section icon="bi-x-octagon-fill" title="Cancel on" description="Pending jobs for the same subject are cancelled when one of these events arrives, e.g. stop payment reminders once the payment succeeds.">
    <div className="d-flex flex-wrap gap-1">
      {events.map((e) => {
        const on = draft.cancelOnEvents.includes(e.key);
        return (
          <button
            key={e.key}
            type="button"
            disabled={disabled}
            title={e.description}
            onClick={() => set("cancelOnEvents", toggleIn(draft.cancelOnEvents, e.key))}
            style={{ fontSize: "0.76rem", fontWeight: 600, padding: "3px 10px", borderRadius: 999, border: `1px solid ${on ? "#fca5a5" : "#e5e7eb"}`, background: on ? "#fee2e2" : "#fff", color: on ? "#b91c1c" : "#4b5563", cursor: disabled ? "default" : "pointer" }}
          >
            {on && <i className="bi bi-check-lg me-1"></i>}{e.label}
          </button>
        );
      })}
      {events.length === 0 && <span style={hint}>No events available.</span>}
    </div>
  </Section>
);

export const ScopeSection: FC<SectionProps & { institutes: InstituteOption[] }> = ({ draft, set, disabled, institutes }) => {
  const nameOf = (code: number) => institutes.find((i) => i.code === code)?.name || `Institute #${code}`;
  const options = institutes.filter((i) => !draft.scopeInstitutes.includes(i.code)).map((i) => ({ value: String(i.code), label: `${i.name} (${i.code})` }));
  return (
    <Section icon="bi-building-fill" title="Scope" description="Limit the automation to events from particular institutes.">
      <div className="mb-2">
        <Radio name="scope-mode" value="all" current={draft.scopeMode} label="All institutes" disabled={disabled} onChange={(v) => set("scopeMode", v as ScopeMode)} />
        <Radio name="scope-mode" value="some" current={draft.scopeMode} label="Only these institutes" disabled={disabled} onChange={(v) => set("scopeMode", v as ScopeMode)} />
      </div>
      {draft.scopeMode === "some" && (
        <>
          <div className="d-flex flex-wrap gap-1 mb-2">
            {draft.scopeInstitutes.map((code) => (
              <span key={code} style={pill("#eef2ff", "#4338ca", { fontWeight: 600 })}>
                {nameOf(code)}
                {!disabled && (
                  <button type="button" onClick={() => set("scopeInstitutes", draft.scopeInstitutes.filter((c) => c !== code))} style={{ background: "none", border: "none", padding: "0 0 0 6px", color: "#4338ca", cursor: "pointer" }} title="Remove"><i className="bi bi-x"></i></button>
                )}
              </span>
            ))}
            {draft.scopeInstitutes.length === 0 && <span style={hint}>No institutes picked yet.</span>}
          </div>
          <SearchableSelect
            options={options}
            value=""
            onChange={(v) => { if (v) set("scopeInstitutes", [...draft.scopeInstitutes, Number(v)]); }}
            placeholder={institutes.length ? "Add an institute…" : "Loading institutes…"}
            disabled={disabled || institutes.length === 0}
            isClearable={false}
            style={{ maxWidth: 420 }}
          />
        </>
      )}
    </Section>
  );
};
