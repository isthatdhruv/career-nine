import { CSSProperties, FC, ReactNode } from "react";
import { mono, pill } from "../../EmailTemplates/components/MailBadges";
import { MailJobStatus } from "../API/MailAutomation_APIs";

// Small presentational pieces shared by the list, the editor and the queue.

export type ChipTone = "indigo" | "gray" | "amber" | "green" | "red" | "blue";

const TONES: Record<ChipTone, [string, string]> = {
  indigo: ["#eef2ff", "#4338ca"],
  gray: ["#f3f4f6", "#4b5563"],
  amber: ["#fef3c7", "#b45309"],
  green: ["#d1fae5", "#047857"],
  red: ["#fee2e2", "#b91c1c"],
  blue: ["#e0f2fe", "#0369a1"],
};

export const dash = <span style={{ color: "#d1d5db" }}>—</span>;

export const Chip: FC<{ tone?: ChipTone; code?: boolean; title?: string; style?: CSSProperties; children: ReactNode }> = ({ tone = "gray", code, title, style, children }) => {
  const [bg, color] = TONES[tone];
  return (
    <span title={title} style={{ ...pill(bg, color, { fontWeight: 600 }), ...(code ? mono : {}), ...style }}>
      {children}
    </span>
  );
};

// A wrapped row of chips; collapses past `max` into a "+N" chip.
export const ChipList: FC<{ items: { key: string; label: string }[]; tone?: ChipTone; code?: boolean; max?: number; empty?: ReactNode }> = ({ items, tone = "gray", code, max = 4, empty = dash }) => {
  if (items.length === 0) return <>{empty}</>;
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <span className="d-inline-flex flex-wrap gap-1">
      {shown.map((i) => <Chip key={i.key} tone={tone} code={code} title={i.key}>{i.label}</Chip>)}
      {rest > 0 && <Chip tone="gray" title={items.slice(max).map((i) => i.label).join(", ")}>+{rest}</Chip>}
    </span>
  );
};

export const StateBadge: FC<{ enabled: boolean; paused: boolean }> = ({ enabled, paused }) => {
  if (!enabled) return <span style={pill("#f3f4f6", "#6b7280")}>Disabled</span>;
  if (paused) return <span style={pill("#fef3c7", "#b45309")}><i className="bi bi-pause-fill me-1"></i>Paused</span>;
  return <span style={pill("#059669", "#fff")}>Enabled</span>;
};

export const OnOffBadge: FC<{ on: boolean; onLabel?: string; offLabel?: string }> = ({ on, onLabel = "On", offLabel = "Off" }) =>
  on ? <span style={pill("#059669", "#fff")}>{onLabel}</span> : <span style={pill("#f3f4f6", "#6b7280")}>{offLabel}</span>;

const JOB_TONES: Record<MailJobStatus, ChipTone> = {
  PENDING: "blue",
  PROCESSING: "indigo",
  RETRY: "amber",
  SENT: "green",
  FAILED: "red",
  CANCELLED: "gray",
  SKIPPED: "gray",
};

export const JobStatusBadge: FC<{ status: MailJobStatus }> = ({ status }) => {
  const [bg, color] = TONES[JOB_TONES[status] || "gray"];
  return <span style={pill(bg, color)}>{status}</span>;
};

export const WarningBadge: FC<{ count: number; open: boolean; onClick: () => void }> = ({ count, open, onClick }) => {
  if (count === 0) return <>{dash}</>;
  return (
    <button type="button" onClick={onClick} title={open ? "Hide warnings" : "Show warnings"} style={{ ...pill("#fef3c7", "#b45309"), border: "none", cursor: "pointer" }}>
      <i className="bi bi-exclamation-triangle-fill me-1"></i>{count}
      <i className={`bi ${open ? "bi-chevron-up" : "bi-chevron-down"} ms-1`} style={{ fontSize: "0.65rem" }}></i>
    </button>
  );
};

export const StatTile: FC<{ label: string; value: ReactNode; color?: string; hint?: ReactNode }> = ({ label, value, color, hint }) => (
  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px 12px" }}>
    <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.4px", color: "#9ca3af", whiteSpace: "nowrap" }}>{label}</div>
    <div style={{ fontSize: "1.15rem", fontWeight: 700, color: color || "#111827", lineHeight: 1.3 }}>{value}</div>
    {hint && <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{hint}</div>}
  </div>
);
