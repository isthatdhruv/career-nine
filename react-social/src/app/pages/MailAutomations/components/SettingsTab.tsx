import { FC, useEffect, useState } from "react";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import { formatDateTime } from "../../EmailTemplates/components/MailBadges";
import { MailSettings, getMailSettings, updateMailSettings } from "../API/MailAutomation_APIs";
import { OnOffBadge } from "./Chips";
import { Field } from "./EditorShared";
import { apiError, card, control, hint, primaryBtn } from "./automationHelpers";

const ENGINE_ON_MSG =
  "Switch the automation engine ON?\n\n" +
  "The converted schedulers (reminders, follow-ups and similar) hand over to the engine: enabled automations start queuing and sending, " +
  "and the old scheduler code for those mails stops running.";
const ENGINE_OFF_MSG =
  "Switch the automation engine OFF?\n\n" +
  "The engine stops queuing and sending. The converted schedulers return to the old code, so those mails go out the way they did before.";

function validate(f: MailSettings): string | null {
  if (!(f.dailyCeilingPerAccount >= 0)) return "Daily ceiling must be zero or more";
  if (!(f.reserveForImmediate >= 0)) return "Reserve for immediate sends must be zero or more";
  if (f.reserveForImmediate > f.dailyCeilingPerAccount) return "Reserve cannot exceed the daily ceiling";
  if (!(f.paceSendsPerSecond >= 1) || !Number.isInteger(f.paceSendsPerSecond)) return "Pace must be a whole number of at least 1";
  if (!!f.quietHoursStart !== !!f.quietHoursEnd) return "Set both quiet-hour times, or clear both";
  if (!f.timezone.trim()) return "Timezone is required";
  return null;
}

const SettingsTab: FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const [saved, setSaved] = useState<MailSettings | null>(null);
  const [form, setForm] = useState<MailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMailSettings()
      .then((r) => { setSaved(r.data); setForm(r.data); })
      .catch((err) => setError(apiError(err, "Failed to load settings")))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof MailSettings>(key: K, value: MailSettings[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const num = (raw: string, fallback: number) => { const n = Number(raw); return raw.trim() === "" || Number.isNaN(n) ? fallback : n; };

  const handleEngine = (on: boolean) => {
    if (!window.confirm(on ? ENGINE_ON_MSG : ENGINE_OFF_MSG)) return;
    set("engineEnabled", on);
  };

  const handleSave = async () => {
    if (!form) return;
    const problem = validate(form);
    if (problem) { showErrorToast(problem); return; }
    setSaving(true);
    try {
      const { data } = await updateMailSettings({ ...form, timezone: form.timezone.trim(), stagingSinkEmail: form.stagingSinkEmail?.trim() || null });
      setSaved(data);
      setForm(data);
      showSuccessToast(data.engineEnabled === saved?.engineEnabled ? "Settings saved" : `Settings saved. Engine is now ${data.engineEnabled ? "ON" : "OFF"}.`);
    } catch (err: any) {
      showErrorToast(apiError(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ ...card, padding: "48px", textAlign: "center" }}>
        <div className="spinner-border" style={{ color: "#4f46e5" }} role="status"></div>
        <p className="mt-3" style={{ color: "#6b7280" }}>Loading settings…</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "10px 14px", color: "#b91c1c", fontSize: "0.85rem" }}>
        <i className="bi bi-exclamation-triangle-fill me-2"></i>{error || "Settings unavailable"}
      </div>
    );
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const disabled = !canEdit;
  const block: React.CSSProperties = { ...card, padding: "16px", marginBottom: 16 };
  const heading = (icon: string, title: string, text: string) => (
    <>
      <div className="d-flex align-items-center mb-1">
        <i className={`bi ${icon} me-2`} style={{ color: "#4f46e5" }}></i>
        <span style={{ fontWeight: 700, color: "#111827" }}>{title}</span>
      </div>
      <p style={{ fontSize: "0.82rem", color: "#6b7280", marginBottom: "14px" }}>{text}</p>
    </>
  );

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={block}>
        {heading("bi-power", "Engine", "The master switch. Off, nothing here sends and the converted schedulers keep using the old code.")}
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <div className="form-check form-switch m-0" style={{ fontSize: "1rem" }}>
            <input className="form-check-input" type="checkbox" role="switch" id="mail-engine" checked={form.engineEnabled} disabled={disabled} onChange={(e) => handleEngine(e.target.checked)} style={{ cursor: disabled ? "default" : "pointer", width: "2.6em", height: "1.4em" }} />
            <label className="form-check-label ms-2" htmlFor="mail-engine" style={{ fontSize: "0.9rem", fontWeight: 600, color: "#111827" }}>Automation engine</label>
          </div>
          <OnOffBadge on={form.engineEnabled} onLabel="ON" offLabel="OFF" />
          {saved && form.engineEnabled !== saved.engineEnabled && <span style={{ ...hint, color: "#b45309" }}><i className="bi bi-exclamation-circle me-1"></i>Not applied until you save.</span>}
        </div>
      </div>

      <div style={block}>
        {heading("bi-speedometer2", "Ceilings and pace", "Per sending account and per day. Queued sends stop at the ceiling; immediate sends keep a reserve.")}
        <div className="row g-3">
          <div className="col-md-4">
            <Field label="Daily ceiling per account" hint="0 = nothing is sent from the queue.">
              <input type="number" min={0} className="form-control form-control-sm" style={control} value={form.dailyCeilingPerAccount} disabled={disabled} onChange={(e) => set("dailyCeilingPerAccount", num(e.target.value, 0))} />
            </Field>
          </div>
          <div className="col-md-4">
            <Field label="Reserve for immediate sends" hint="Kept back from the ceiling for inline mails.">
              <input type="number" min={0} className="form-control form-control-sm" style={control} value={form.reserveForImmediate} disabled={disabled} onChange={(e) => set("reserveForImmediate", num(e.target.value, 0))} />
            </Field>
          </div>
          <div className="col-md-4">
            <Field label="Pace (sends per second)" hint="Whole number. How fast the queue drains.">
              <input type="number" min={1} step={1} className="form-control form-control-sm" style={control} value={form.paceSendsPerSecond} disabled={disabled} onChange={(e) => set("paceSendsPerSecond", num(e.target.value, 1))} />
            </Field>
          </div>
        </div>
      </div>

      <div style={block}>
        {heading("bi-moon-stars-fill", "Quiet hours", "Automations that respect quiet hours hold their queued sends until the window ends. Leave both empty for no quiet hours.")}
        <div className="row g-3 align-items-end">
          <div className="col-md-3">
            <Field label="Start">
              <input type="time" className="form-control form-control-sm" style={control} value={form.quietHoursStart || ""} disabled={disabled} onChange={(e) => set("quietHoursStart", e.target.value || null)} />
            </Field>
          </div>
          <div className="col-md-3">
            <Field label="End">
              <input type="time" className="form-control form-control-sm" style={control} value={form.quietHoursEnd || ""} disabled={disabled} onChange={(e) => set("quietHoursEnd", e.target.value || null)} />
            </Field>
          </div>
          <div className="col-md-2">
            <button type="button" className="btn btn-sm btn-light w-100" style={{ borderRadius: 6 }} disabled={disabled || (!form.quietHoursStart && !form.quietHoursEnd)} onClick={() => { set("quietHoursStart", null); set("quietHoursEnd", null); }}>
              <i className="bi bi-x-lg me-1"></i>Clear
            </button>
          </div>
          <div className="col-md-4">
            <Field label="Timezone" hint="IANA name, e.g. Asia/Kolkata.">
              <input className="form-control form-control-sm" style={control} value={form.timezone} disabled={disabled} onChange={(e) => set("timezone", e.target.value)} placeholder="Asia/Kolkata" />
            </Field>
          </div>
        </div>
        {form.quietHoursStart && form.quietHoursEnd && (
          <div style={{ ...hint, marginTop: 8 }}>
            Quiet from <strong>{form.quietHoursStart}</strong> to <strong>{form.quietHoursEnd}</strong> ({form.timezone || "timezone?"}){form.quietHoursStart > form.quietHoursEnd ? ", crossing midnight" : ""}.
          </div>
        )}
      </div>

      <div style={block}>
        {heading("bi-inbox-fill", "Staging sink", "On non-production environments every automation mail is redirected to this address instead of the real recipient. Leave empty to send normally.")}
        <div className="row g-3">
          <div className="col-md-6">
            <Field label="Sink address">
              <input type="email" className="form-control form-control-sm" style={control} value={form.stagingSinkEmail || ""} disabled={disabled} onChange={(e) => set("stagingSinkEmail", e.target.value || null)} placeholder="qa-inbox@example.com" />
            </Field>
          </div>
        </div>
      </div>

      <div className="d-flex align-items-center gap-3">
        <span style={hint}>{saved?.updatedAt ? `Last saved ${formatDateTime(saved.updatedAt)}` : "Never saved; showing defaults."}</span>
        {canEdit && (
          <>
            <button type="button" className="btn btn-sm btn-light ms-auto" style={{ borderRadius: 6 }} disabled={!dirty || saving} onClick={() => setForm(saved)}>Discard changes</button>
            <button type="button" className="btn btn-sm" style={primaryBtn} disabled={!dirty || saving} onClick={handleSave}>
              {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check-lg me-1"></i>Save settings</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SettingsTab;
