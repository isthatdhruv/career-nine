import { FC, useEffect, useState } from "react";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import { ReadCollegeList } from "../../College/API/College_APIs";
import { EmailTemplate, getEmailTemplates } from "../../EmailTemplates/API/EmailTemplate_APIs";
import { mono, pill } from "../../EmailTemplates/components/MailBadges";
import {
  MailAudience,
  MailAutomation,
  MailDeliveryMode,
  MailEventInfo,
  createMailAutomation,
  updateMailAutomation,
} from "../API/MailAutomation_APIs";
import { Check, Field, Section, inputStyle } from "./EditorShared";
import { CancelOnSection, InstituteOption, RecipientsSection, ScopeSection, TemplateSection } from "./EditorTargetSections";
import { ConditionsSection, TimingSection, TriggerSection } from "./EditorTriggerSections";
import { AutomationDraft, apiError, draftFromAutomation, payloadFromDraft, primaryBtn, validateDraft } from "./automationHelpers";

interface Props {
  show: boolean;
  onHide: () => void;
  automation: MailAutomation | null; // null => create mode
  duplicate: boolean; // true => create mode seeded from `automation`
  events: MailEventInfo[];
  audiences: MailAudience[];
  canEdit: boolean;
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

const twoCol: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "0 12px" };

const AutomationEditorModal: FC<Props> = ({ show, onHide, automation, duplicate, events, audiences, canEdit, onSaved }) => {
  const [draft, setDraft] = useState<AutomationDraft>(() => draftFromAutomation(null));
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [institutes, setInstitutes] = useState<InstituteOption[]>([]);
  const [saving, setSaving] = useState(false);

  const editing = !!automation && !duplicate;
  const disabled = !canEdit;

  useEffect(() => {
    if (!show) return;
    setDraft(draftFromAutomation(automation, duplicate));
  }, [show, automation, duplicate]);

  // Reference data, loaded each time the editor opens.
  useEffect(() => {
    if (!show) return;
    setLoadingTemplates(true);
    getEmailTemplates()
      .then((r) => setTemplates(r.data || []))
      .catch(() => showErrorToast("Could not load the template list"))
      .finally(() => setLoadingTemplates(false));
    ReadCollegeList()
      .then((r) => {
        const rows: any[] = Array.isArray(r.data) ? r.data : [];
        const list = rows
          .map((row) => ({ code: Number(row.instituteCode), name: row.instituteName || `Institute ${row.instituteCode}` }))
          .filter((o: InstituteOption) => !Number.isNaN(o.code));
        setInstitutes(list);
      })
      .catch(() => setInstitutes([]));
  }, [show]);

  const set = <K extends keyof AutomationDraft>(key: K, value: AutomationDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const handleSave = async () => {
    const problem = validateDraft(draft);
    if (problem) {
      showErrorToast(problem);
      return;
    }
    setSaving(true);
    try {
      const payload = payloadFromDraft(draft);
      if (editing && automation) {
        await updateMailAutomation(automation.id, payload);
        showSuccessToast("Automation updated");
      } else {
        await createMailAutomation(payload);
        showSuccessToast(duplicate ? "Automation duplicated" : "Automation created");
      }
      onSaved();
      onHide();
    } catch (err: any) {
      showErrorToast(apiError(err, "Failed to save automation"));
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  const title = editing ? (canEdit ? "Edit automation" : "Automation") : duplicate ? "Duplicate automation" : "New automation";
  const sectionProps = { draft, set, events, disabled };

  return (
    <div style={overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onHide(); }}>
      <div style={{ background: "#fff", borderRadius: "12px", width: "min(1180px, 100%)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
          <i className="bi bi-diagram-3-fill" style={{ color: "#4f46e5", fontSize: "1.1rem" }}></i>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "#111827" }}>{title}</span>
          {editing && automation?.automationKey && <code style={{ ...mono, color: "#6b7280" }}>{automation.automationKey}</code>}
          {editing && automation?.seedOrigin === "SEED" && <span style={pill("#f3f4f6", "#4b5563")}>seed</span>}
          {!canEdit && <span style={pill("#fef3c7", "#b45309")}>read only</span>}
          <button className="btn btn-sm btn-light ms-auto" onClick={onHide} style={{ borderRadius: "6px" }}><i className="bi bi-x-lg"></i></button>
        </div>

        {editing && automation && automation.warnings.length > 0 && (
          <div style={{ padding: "8px 20px", borderBottom: "1px solid #fde68a", background: "#fffbeb", fontSize: "0.78rem", color: "#92400e" }}>
            <div style={{ fontWeight: 700 }}><i className="bi bi-exclamation-triangle-fill me-1"></i>Server warnings</div>
            <ul className="mb-0" style={{ paddingLeft: 18 }}>{automation.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}

        {/* Body */}
        <div style={{ padding: "16px 20px", maxHeight: "calc(100vh - 190px)", overflowY: "auto", background: "#f9fafb" }}>
          <Section icon="bi-card-text" title="Basics">
            <div className="row g-3">
              <div className="col-md-5">
                <Field label="Name">
                  <input className="form-control form-control-sm" style={inputStyle} value={draft.name} onChange={(e) => set("name", e.target.value)} disabled={disabled} placeholder="e.g. Assessment access reminder" />
                </Field>
              </div>
              <div className="col-md-7">
                <Field label="Description">
                  <input className="form-control form-control-sm" style={inputStyle} value={draft.description} onChange={(e) => set("description", e.target.value)} disabled={disabled} placeholder="What this is for, in one line" />
                </Field>
              </div>
              <div className="col-md-4">
                <Field
                  label="Delivery"
                  hint={draft.deliveryMode === "IMMEDIATE"
                    ? "Sent inline when the event is published; timing is ignored."
                    : "Goes through the queue; honours timing, quiet hours and ceilings."}
                >
                  <select className="form-select form-select-sm" style={inputStyle} value={draft.deliveryMode} onChange={(e) => set("deliveryMode", e.target.value as MailDeliveryMode)} disabled={disabled}>
                    <option value="QUEUED">Queued</option>
                    <option value="IMMEDIATE">Immediate (inline)</option>
                  </select>
                </Field>
              </div>
              <div className="col-md-8 d-flex flex-wrap gap-4 align-items-start" style={{ paddingTop: 26 }}>
                <Check id="au-enabled" label="Enabled" hint="Off until you switch it on." checked={draft.enabled} disabled={disabled} onChange={(v) => set("enabled", v)} />
                <Check id="au-recheck" label="Re-check conditions before sending" hint="Skips the send if they no longer hold." checked={draft.recheckBeforeSend} disabled={disabled} onChange={(v) => set("recheckBeforeSend", v)} />
                <Check id="au-quiet" label="Respect quiet hours" hint="Queued sends wait until quiet hours end." checked={draft.respectQuietHours} disabled={disabled} onChange={(v) => set("respectQuietHours", v)} />
              </div>
            </div>
          </Section>

          <TriggerSection {...sectionProps} audiences={audiences} />

          <div style={twoCol}>
            <ConditionsSection {...sectionProps} />
            <TimingSection {...sectionProps} />
          </div>

          <TemplateSection {...sectionProps} templates={templates} loadingTemplates={loadingTemplates} />

          <div style={twoCol}>
            <RecipientsSection {...sectionProps} />
            <div>
              <CancelOnSection {...sectionProps} />
              <ScopeSection {...sectionProps} institutes={institutes} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, alignItems: "center" }}>
          {editing && automation && (
            <span style={{ fontSize: "0.74rem", color: "#9ca3af" }}>Created {new Date(automation.createdAt).toLocaleDateString()} · updated {new Date(automation.updatedAt).toLocaleDateString()}</span>
          )}
          <button className="btn btn-sm btn-light ms-auto" onClick={onHide} style={{ borderRadius: "6px" }}>{canEdit ? "Cancel" : "Close"}</button>
          {canEdit && (
            <button className="btn btn-sm" onClick={handleSave} disabled={saving} style={primaryBtn}>
              {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check-lg me-1"></i>Save</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutomationEditorModal;
