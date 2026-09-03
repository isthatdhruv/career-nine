import { FC } from "react";
import { MailAudience, MailEventOption } from "../API/MailAutomation_APIs";
import { Field, KeyCheckList, Radio, Section, SectionProps, inputStyle, parseIntOrNull, toggleIn } from "./EditorShared";
import { CRON_PRESETS, DELAY_QUICK_PICKS, OFFSET_QUICK_PICKS, TimingMode, TriggerMode, fieldLabel, formatMinutes, hint, offsetText, quickPick, unionOf } from "./automationHelpers";

// Trigger, Conditions and Timing sections of the automation editor.

const NOT_OFFERED = "Not offered by the selected trigger(s) — kept so nothing is lost on save.";

// Selected keys the current trigger does not offer stay visible so they can be unticked deliberately.
export function withSelectedExtras(options: MailEventOption[], selected: string[]): { key: string; label: string; description?: string }[] {
  const extras = selected.filter((k) => !options.some((o) => o.key === k)).map((k) => ({ key: k, label: k, description: NOT_OFFERED }));
  return [...options, ...extras];
}

export const TriggerSection: FC<SectionProps & { audiences: MailAudience[] }> = ({ draft, set, events, disabled, audiences }) => (
  <Section icon="bi-lightning-charge-fill" title="Trigger" description="Fire when the code publishes an event, or on a schedule against an audience.">
    <div className="mb-2">
      <Radio name="trigger-mode" value="event" current={draft.triggerMode} label="Event" disabled={disabled} onChange={(v) => set("triggerMode", v as TriggerMode)} />
      <Radio name="trigger-mode" value="schedule" current={draft.triggerMode} label="Schedule (cron + audience)" disabled={disabled} onChange={(v) => set("triggerMode", v as TriggerMode)} />
    </div>
    {draft.triggerMode === "event" ? (
      <KeyCheckList
        idPrefix="trig"
        options={events.map((e) => ({ key: e.key, label: e.label, description: e.description }))}
        selected={draft.triggerEvents}
        disabled={disabled}
        onToggle={(k) => set("triggerEvents", toggleIn(draft.triggerEvents, k))}
        empty="No events are published yet."
      />
    ) : (
      <div className="row g-3">
        <div className="col-md-6">
          <Field label="Cron expression" hint="Spring format, six fields: sec min hour day month weekday.">
            <input className="form-control form-control-sm" style={{ ...inputStyle, fontFamily: "'Courier New', monospace" }} value={draft.cron} onChange={(e) => set("cron", e.target.value)} disabled={disabled} placeholder="0 0 9 * * *" />
          </Field>
          <div className="d-flex gap-1 mt-2 flex-wrap">
            {CRON_PRESETS.map((p) => (
              <button key={p.cron} type="button" style={quickPick} disabled={disabled} onClick={() => set("cron", p.cron)}>{p.label}</button>
            ))}
          </div>
        </div>
        <div className="col-md-6">
          <Field label="Audience" hint={audiences.find((a) => a.key === draft.audienceKey)?.description || "The set of subjects the schedule runs over."}>
            <select className="form-select form-select-sm" style={inputStyle} value={draft.audienceKey} onChange={(e) => set("audienceKey", e.target.value)} disabled={disabled}>
              <option value="">— pick an audience —</option>
              {audiences.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </Field>
        </div>
      </div>
    )}
  </Section>
);

export const ConditionsSection: FC<SectionProps> = ({ draft, set, events, disabled }) => {
  const scheduled = draft.triggerMode === "schedule";
  const noEvents = !scheduled && draft.triggerEvents.length === 0;
  const predicates = unionOf(events, scheduled ? [] : draft.triggerEvents, (e) => e.predicates);
  return (
    <Section
      icon="bi-funnel-fill"
      title="Conditions"
      description={scheduled
        ? "Every known predicate is listed for schedules; the server rejects ones the audience cannot answer."
        : "All must hold when the event arrives (and again at send time when re-checking is on)."}
    >
      {noEvents
        ? <div style={hint}>Pick a trigger event first.</div>
        : <KeyCheckList idPrefix="cond" options={withSelectedExtras(predicates, draft.conditions)} selected={draft.conditions} disabled={disabled} onToggle={(k) => set("conditions", toggleIn(draft.conditions, k))} columns={1} empty="The selected trigger(s) offer no conditions." />}
    </Section>
  );
};

const OffsetsEditor: FC<{ offsets: number[]; disabled: boolean; onChange: (v: number[]) => void }> = ({ offsets, disabled, onChange }) => {
  const add = (m: number) => { if (!offsets.includes(m)) onChange([...offsets, m].sort((a, b) => a - b)); };
  const update = (i: number, m: number) => { const next = offsets.slice(); next[i] = m; onChange(next); };
  const remove = (i: number) => onChange(offsets.filter((_, j) => j !== i));
  return (
    <div className="mt-3">
      <label style={fieldLabel}>Offsets (minutes; negative = before)</label>
      {offsets.length === 0 ? (
        <div style={hint}>No offsets yet. One mail is sent per offset.</div>
      ) : (
        <div className="d-flex flex-column gap-1">
          {offsets.map((m, i) => (
            <div key={i} className="d-flex align-items-center gap-2">
              <input type="number" step={5} className="form-control form-control-sm" style={{ ...inputStyle, width: 120 }} value={m} onChange={(e) => update(i, parseIntOrNull(e.target.value) ?? 0)} disabled={disabled} />
              <span style={{ fontSize: "0.8rem", color: "#374151", minWidth: 100 }}>{offsetText(m)}</span>
              <button type="button" className="btn btn-sm btn-light" style={{ borderRadius: 6, color: "#dc2626", padding: "2px 7px" }} disabled={disabled} onClick={() => remove(i)} title="Remove"><i className="bi bi-x-lg"></i></button>
            </div>
          ))}
        </div>
      )}
      <div className="d-flex gap-1 mt-2 flex-wrap align-items-center">
        {OFFSET_QUICK_PICKS.map((q) => (
          <button key={q.minutes} type="button" style={quickPick} disabled={disabled} onClick={() => add(q.minutes)}>{q.label}</button>
        ))}
        <button type="button" className="btn btn-sm btn-light" style={{ borderRadius: 6, fontSize: "0.74rem" }} disabled={disabled} onClick={() => add(offsets.length ? Math.min(...offsets) - 60 : -60)}>
          <i className="bi bi-plus-lg me-1"></i>Custom
        </button>
      </div>
    </div>
  );
};

export const TimingSection: FC<SectionProps> = ({ draft, set, events, disabled }) => {
  const scheduled = draft.triggerMode === "schedule";
  const dateFields = unionOf(events, scheduled ? [] : draft.triggerEvents, (e) => e.dateFields);
  const dateOptions = draft.relativeToField && !dateFields.some((f) => f.key === draft.relativeToField)
    ? [...dateFields, { key: draft.relativeToField, label: `${draft.relativeToField} (not offered by the trigger)` }]
    : dateFields;
  const inline = draft.deliveryMode === "IMMEDIATE";
  const off = disabled || inline;
  const numberInput = (value: number | null, onChange: (v: number | null) => void, min: number, extra?: React.CSSProperties) => (
    <input type="number" min={min} className="form-control form-control-sm" style={{ ...inputStyle, ...extra }} value={value ?? ""} onChange={(e) => onChange(parseIntOrNull(e.target.value))} disabled={off} />
  );

  return (
    <Section icon="bi-clock-fill" title="Timing" description="When the mail goes out, counted from the moment the event arrives.">
      {inline && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "6px 10px", fontSize: "0.78rem", color: "#92400e", marginBottom: 10 }}>
          <i className="bi bi-info-circle-fill me-1"></i>Delivery is set to Immediate: the mail is sent inline when the event is published and this timing is ignored.
        </div>
      )}
      <div className="mb-2">
        <Radio name="timing-mode" value="immediate" current={draft.timingMode} label="Immediately" disabled={off} onChange={(v) => set("timingMode", v as TimingMode)} />
        <Radio name="timing-mode" value="delay" current={draft.timingMode} label="After a delay" disabled={off} onChange={(v) => set("timingMode", v as TimingMode)} />
        <Radio name="timing-mode" value="relative" current={draft.timingMode} label="Relative to a date in the event" disabled={off} onChange={(v) => set("timingMode", v as TimingMode)} />
      </div>

      {draft.timingMode === "delay" && (
        <div className="row g-3">
          <div className="col-md-4">
            <Field label="Delay (minutes)" hint={draft.delayMinutes > 0 ? `= ${formatMinutes(draft.delayMinutes)}` : "0 = as soon as the queue picks it up"}>
              {numberInput(draft.delayMinutes, (v) => set("delayMinutes", Math.max(0, v ?? 0)), 0)}
            </Field>
            <div className="d-flex gap-1 mt-1">
              {DELAY_QUICK_PICKS.map((q) => <button key={q.minutes} type="button" style={quickPick} disabled={off} onClick={() => set("delayMinutes", q.minutes)}>{q.label}</button>)}
            </div>
          </div>
          <div className="col-md-4">
            <Field label="Repeat every (minutes)" hint={draft.repeatEveryMinutes ? `= ${formatMinutes(draft.repeatEveryMinutes)}` : "Empty = send once"}>
              {numberInput(draft.repeatEveryMinutes, (v) => set("repeatEveryMinutes", v), 1)}
            </Field>
            <div className="d-flex gap-1 mt-1">
              {DELAY_QUICK_PICKS.map((q) => <button key={q.minutes} type="button" style={quickPick} disabled={off} onClick={() => set("repeatEveryMinutes", q.minutes)}>{q.label}</button>)}
            </div>
          </div>
          <div className="col-md-4">
            <Field label="Max sends (total)" hint="Counts the first send. Empty = unlimited, so pair repeats with a cancel-on event.">
              {numberInput(draft.maxSends, (v) => set("maxSends", v), 1)}
            </Field>
          </div>
        </div>
      )}

      {draft.timingMode === "relative" && (
        <>
          <Field label="Relative to" hint="A date carried by the trigger event, e.g. the session start.">
            <select className="form-select form-select-sm" style={{ ...inputStyle, maxWidth: 360 }} value={draft.relativeToField} onChange={(e) => set("relativeToField", e.target.value)} disabled={off}>
              <option value="">— pick a date field —</option>
              {dateOptions.map((f) => <option key={f.key} value={f.key}>{f.label} ({f.key})</option>)}
            </select>
          </Field>
          {dateFields.length === 0 && <div style={{ ...hint, color: "#b45309", marginTop: 4 }}>The selected trigger(s) carry no date fields.</div>}
          <OffsetsEditor offsets={draft.relativeOffsetsMinutes} disabled={off} onChange={(v) => set("relativeOffsetsMinutes", v)} />
        </>
      )}
    </Section>
  );
};
