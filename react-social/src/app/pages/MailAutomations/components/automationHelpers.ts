import { CSSProperties } from "react";
import {
  MailAutomation,
  MailAutomationPayload,
  MailDeliveryMode,
  MailEventInfo,
  MailEventOption,
} from "../API/MailAutomation_APIs";

// ── Shared styles (same palette as the Email Templates pages) ──────────────

export const card: CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" };
export const th: CSSProperties = { padding: "10px 12px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px", background: "#f9fafb", whiteSpace: "nowrap" };
export const td: CSSProperties = { padding: "8px 12px", verticalAlign: "top" };
export const control: CSSProperties = { borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.85rem" };
export const eyebrow: CSSProperties = { fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.4px", color: "#9ca3af", marginBottom: 4 };
export const fieldLabel: CSSProperties = { fontSize: "0.78rem", fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" };
export const hint: CSSProperties = { fontSize: "0.76rem", color: "#9ca3af" };
export const primaryBtn: CSSProperties = { background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600 };
export const lightBtn: CSSProperties = { borderRadius: "6px" };
export const quickPick: CSSProperties = { fontSize: "0.74rem", padding: "2px 8px", borderRadius: "6px", border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", cursor: "pointer" };

export function apiError(err: any, fallback: string): string {
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;
}

// ── Time formatting ────────────────────────────────────────────────────────

export function formatMinutes(m: number): string {
  const abs = Math.abs(Math.round(m));
  if (abs === 0) return "0m";
  if (abs % 1440 === 0) return `${abs / 1440}d`;
  if (abs % 60 === 0) return `${abs / 60}h`;
  if (abs > 60) return `${Math.floor(abs / 60)}h ${abs % 60}m`;
  return `${abs}m`;
}

// "12h before" / "1h after" / "at the time"
export function offsetText(m: number): string {
  if (m === 0) return "at the time";
  return `${formatMinutes(m)} ${m < 0 ? "before" : "after"}`;
}

export function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

type TimingLike = Pick<MailAutomation, "deliveryMode" | "delayMinutes" | "relativeToField" | "relativeOffsetsMinutes" | "repeatEveryMinutes" | "maxSends">;

// "Immediately" | "After 24h, repeat every 24h, max 2" | "12h and 2h before session start"
export function timingText(a: TimingLike, dateFieldLabel?: string): string {
  if (a.deliveryMode === "IMMEDIATE") return "Immediately";
  if (a.relativeToField) {
    const offsets = a.relativeOffsetsMinutes || [];
    const before = offsets.filter((o) => o < 0).sort((x, y) => x - y).map((o) => formatMinutes(o));
    const at = offsets.some((o) => o === 0);
    const after = offsets.filter((o) => o > 0).sort((x, y) => x - y).map((o) => formatMinutes(o));
    const parts: string[] = [];
    if (before.length) parts.push(`${joinList(before)} before`);
    if (at) parts.push("at");
    if (after.length) parts.push(`${joinList(after)} after`);
    const label = dateFieldLabel || a.relativeToField;
    return parts.length ? `${parts.join(", ")} ${label}` : `Relative to ${label} (no offsets)`;
  }
  const bits: string[] = [a.delayMinutes > 0 ? `After ${formatMinutes(a.delayMinutes)}` : "Immediately (via queue)"];
  if (a.repeatEveryMinutes) bits.push(`repeat every ${formatMinutes(a.repeatEveryMinutes)}`);
  if (a.maxSends) bits.push(`max ${a.maxSends}`);
  return bits.join(", ");
}

// "in 2h 5m" / "3m ago"
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const diff = t - now;
  const mins = Math.round(Math.abs(diff) / 60000);
  let span: string;
  if (mins < 1) span = "under a minute";
  else if (mins < 60) span = `${mins}m`;
  else if (mins < 1440) span = `${Math.floor(mins / 60)}h ${mins % 60}m`;
  else span = `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
  return diff >= 0 ? `in ${span}` : `${span} ago`;
}

// ── Event lookups ──────────────────────────────────────────────────────────

export function eventLabel(events: MailEventInfo[], key: string): string {
  return events.find((e) => e.key === key)?.label || key;
}

// Union (deduped by key, in first-seen order) of one facet across the given events.
// With no keys selected, falls back to every event — used when the trigger is a schedule,
// since audiences do not declare roles/fields; the server validates what actually applies.
export function unionOf(events: MailEventInfo[], keys: string[], pick: (e: MailEventInfo) => MailEventOption[]): MailEventOption[] {
  const source = keys.length ? events.filter((e) => keys.includes(e.key)) : events;
  const seen = new Map<string, MailEventOption>();
  source.forEach((e) => (pick(e) || []).forEach((o) => { if (!seen.has(o.key)) seen.set(o.key, o); }));
  return Array.from(seen.values());
}

export function optionLabel(options: MailEventOption[], key: string): string {
  return options.find((o) => o.key === key)?.label || key;
}

export const SCHEDULED_GROUP = "__scheduled__";

export interface AutomationGroup {
  key: string;
  label: string;
  description: string;
  rows: MailAutomation[];
}

// Groups by the first trigger event (in /mail-events order); cron automations go under "Scheduled".
export function groupAutomations(automations: MailAutomation[], events: MailEventInfo[]): AutomationGroup[] {
  const byKey = new Map<string, AutomationGroup>();
  events.forEach((e) => byKey.set(e.key, { key: e.key, label: e.label, description: e.description, rows: [] }));
  const scheduled: AutomationGroup = { key: SCHEDULED_GROUP, label: "Scheduled", description: "Runs on a cron schedule against an audience", rows: [] };
  automations.forEach((a) => {
    if (a.cron) { scheduled.rows.push(a); return; }
    const primary = a.triggerEvents[0];
    if (!primary) { scheduled.rows.push(a); return; }
    if (!byKey.has(primary)) byKey.set(primary, { key: primary, label: primary, description: "Unknown event", rows: [] });
    byKey.get(primary)!.rows.push(a);
  });
  const groups = Array.from(byKey.values()).filter((g) => g.rows.length > 0);
  if (scheduled.rows.length) groups.push(scheduled);
  return groups;
}

// ── Parsing ────────────────────────────────────────────────────────────────

export function parseExtraRecipients(text: string): string[] {
  const seen = new Set<string>();
  text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).forEach((s) => seen.add(s));
  return Array.from(seen);
}

// {{key}} tokens in a template; section tags ({{#flag}}, {{/flag}}, {{^flag}}) are skipped.
export function templateTokens(...texts: (string | null | undefined)[]): string[] {
  const re = /\{\{\s*([^{}\s]+)\s*\}\}/g;
  const set = new Set<string>();
  texts.forEach((t) => {
    if (!t) return;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      const k = m[1];
      if (/^[#/^!>&]/.test(k)) continue;
      set.add(k);
    }
  });
  return Array.from(set);
}

// ── Quick picks ────────────────────────────────────────────────────────────

export const DELAY_QUICK_PICKS = [
  { label: "1h", minutes: 60 },
  { label: "24h", minutes: 1440 },
  { label: "72h", minutes: 4320 },
];

export const OFFSET_QUICK_PICKS = [
  { label: "12h before", minutes: -720 },
  { label: "2h before", minutes: -120 },
  { label: "15m before", minutes: -15 },
  { label: "1h after", minutes: 60 },
];

// Spring 6-field cron (seconds first).
export const CRON_PRESETS = [
  { label: "Daily 09:00", cron: "0 0 9 * * *" },
  { label: "Weekdays 08:30", cron: "0 30 8 * * MON-FRI" },
  { label: "Every hour", cron: "0 0 * * * *" },
];

// ── Editor draft <-> payload ───────────────────────────────────────────────

export type TriggerMode = "event" | "schedule";
export type TimingMode = "immediate" | "delay" | "relative";
export type ScopeMode = "all" | "some";

export interface AutomationDraft {
  name: string;
  description: string;
  enabled: boolean;
  paused: boolean;
  topic: string;
  deliveryMode: MailDeliveryMode;
  recheckBeforeSend: boolean;
  respectQuietHours: boolean;
  triggerMode: TriggerMode;
  triggerEvents: string[];
  cron: string;
  audienceKey: string;
  conditions: string[];
  timingMode: TimingMode;
  delayMinutes: number;
  repeatEveryMinutes: number | null;
  maxSends: number | null;
  relativeToField: string;
  relativeOffsetsMinutes: number[];
  templateId: number | null;
  recipientRoles: string[];
  extraRecipientsText: string;
  cancelOnEvents: string[];
  scopeMode: ScopeMode;
  scopeInstitutes: number[];
}

export function emptyDraft(): AutomationDraft {
  return {
    name: "", description: "", enabled: false, paused: false, topic: "",
    deliveryMode: "QUEUED", recheckBeforeSend: true, respectQuietHours: true,
    triggerMode: "event", triggerEvents: [], cron: "", audienceKey: "",
    conditions: [],
    timingMode: "immediate", delayMinutes: 0, repeatEveryMinutes: null, maxSends: null,
    relativeToField: "", relativeOffsetsMinutes: [],
    templateId: null,
    recipientRoles: [], extraRecipientsText: "", cancelOnEvents: [],
    scopeMode: "all", scopeInstitutes: [],
  };
}

export function draftFromAutomation(a: MailAutomation | null, duplicate = false): AutomationDraft {
  if (!a) return emptyDraft();
  const timingMode: TimingMode = a.relativeToField ? "relative" : a.delayMinutes > 0 || a.repeatEveryMinutes ? "delay" : "immediate";
  return {
    name: duplicate ? `${a.name} (copy)` : a.name,
    description: a.description ?? "",
    enabled: duplicate ? false : a.enabled,
    paused: duplicate ? false : a.paused,
    topic: a.topic ?? "",
    deliveryMode: a.deliveryMode || "QUEUED",
    recheckBeforeSend: !!a.recheckBeforeSend,
    respectQuietHours: !!a.respectQuietHours,
    triggerMode: a.cron ? "schedule" : "event",
    triggerEvents: [...(a.triggerEvents || [])],
    cron: a.cron ?? "",
    audienceKey: a.audienceKey ?? "",
    conditions: [...(a.conditions || [])],
    timingMode,
    delayMinutes: a.delayMinutes ?? 0,
    repeatEveryMinutes: a.repeatEveryMinutes,
    maxSends: a.maxSends,
    relativeToField: a.relativeToField ?? "",
    relativeOffsetsMinutes: [...(a.relativeOffsetsMinutes || [])],
    templateId: a.templateId,
    recipientRoles: [...(a.recipientRoles || [])],
    extraRecipientsText: (a.extraRecipients || []).join("\n"),
    cancelOnEvents: [...(a.cancelOnEvents || [])],
    scopeMode: a.scopeInstitutes && a.scopeInstitutes.length ? "some" : "all",
    scopeInstitutes: [...(a.scopeInstitutes || [])],
  };
}

export function payloadFromDraft(d: AutomationDraft): MailAutomationPayload {
  const isEvent = d.triggerMode === "event";
  const relative = d.timingMode === "relative";
  const delay = d.timingMode === "delay";
  return {
    name: d.name.trim(),
    description: d.description.trim() || null,
    triggerEvents: isEvent ? d.triggerEvents : [],
    cron: isEvent ? null : d.cron.trim() || null,
    audienceKey: isEvent ? null : d.audienceKey || null,
    conditions: d.conditions,
    delayMinutes: delay ? d.delayMinutes : 0,
    relativeToField: relative ? d.relativeToField || null : null,
    relativeOffsetsMinutes: relative ? d.relativeOffsetsMinutes : [],
    repeatEveryMinutes: delay ? d.repeatEveryMinutes : null,
    maxSends: delay ? d.maxSends : null,
    templateId: d.templateId,
    recipientRoles: d.recipientRoles,
    extraRecipients: parseExtraRecipients(d.extraRecipientsText),
    cancelOnEvents: d.cancelOnEvents,
    deliveryMode: d.deliveryMode,
    recheckBeforeSend: d.recheckBeforeSend,
    respectQuietHours: d.respectQuietHours,
    channel: "EMAIL",
    scopeInstitutes: d.scopeMode === "some" && d.scopeInstitutes.length ? d.scopeInstitutes : null,
    topic: d.topic.trim() || null,
    enabled: d.enabled,
    paused: d.paused,
  };
}

// First client-side problem, or null when the draft can be sent (the server validates further).
export function validateDraft(d: AutomationDraft): string | null {
  if (!d.name.trim()) return "Name is required";
  if (d.triggerMode === "event" && d.triggerEvents.length === 0) return "Pick at least one trigger event";
  if (d.triggerMode === "schedule") {
    if (!d.cron.trim()) return "Enter a cron expression";
    if (!d.audienceKey) return "Pick an audience for the schedule";
  }
  if (d.timingMode === "delay") {
    if (!(d.delayMinutes >= 0)) return "Delay must be zero or more minutes";
    if (d.repeatEveryMinutes !== null && !(d.repeatEveryMinutes > 0)) return "Repeat interval must be positive";
    if (d.maxSends !== null && !(d.maxSends >= 1)) return "Max sends must be at least 1";
  }
  if (d.timingMode === "relative") {
    if (!d.relativeToField) return "Pick the date the timing is relative to";
    if (d.relativeOffsetsMinutes.length === 0) return "Add at least one offset";
  }
  if (d.templateId === null) return "Pick a template";
  if (d.recipientRoles.length === 0 && parseExtraRecipients(d.extraRecipientsText).length === 0) return "Pick a recipient role or add an address";
  if (d.scopeMode === "some" && d.scopeInstitutes.length === 0) return "Pick at least one institute, or choose all institutes";
  return null;
}
