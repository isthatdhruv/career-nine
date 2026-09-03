import { CSSProperties, FC, ReactNode } from "react";
import { MailEventInfo } from "../API/MailAutomation_APIs";
import { AutomationDraft, control, fieldLabel } from "./automationHelpers";

// Pieces shared by the editor sections.

export interface SectionProps {
  draft: AutomationDraft;
  set: <K extends keyof AutomationDraft>(key: K, value: AutomationDraft[K]) => void;
  events: MailEventInfo[];
  disabled: boolean;
}

export const inputStyle: CSSProperties = control;

export function toggleIn(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

export function parseIntOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

export const Section: FC<{ icon: string; title: string; description?: ReactNode; children: ReactNode }> = ({ icon, title, description, children }) => (
  <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "14px 16px", marginBottom: 12, background: "#fff" }}>
    <div className="d-flex align-items-center mb-1">
      <i className={`bi ${icon} me-2`} style={{ color: "#4f46e5" }}></i>
      <span style={{ fontWeight: 700, color: "#111827", fontSize: "0.9rem" }}>{title}</span>
    </div>
    {description && <div style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: 10 }}>{description}</div>}
    {children}
  </div>
);

export const Field: FC<{ label: string; hint?: ReactNode; children: ReactNode; style?: CSSProperties }> = ({ label, hint, children, style }) => (
  <div style={style}>
    <label style={fieldLabel}>{label}</label>
    {children}
    {hint && <div style={{ fontSize: "0.74rem", color: "#9ca3af", marginTop: 3 }}>{hint}</div>}
  </div>
);

export const Check: FC<{ id: string; label: ReactNode; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; hint?: ReactNode; style?: CSSProperties }> = ({ id, label, checked, disabled, onChange, hint, style }) => (
  <div className="form-check" style={{ fontSize: "0.83rem", ...style }}>
    <input className="form-check-input" type="checkbox" id={id} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    <label className="form-check-label" htmlFor={id} style={{ color: "#374151" }}>{label}</label>
    {hint && <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>{hint}</div>}
  </div>
);

export const Radio: FC<{ name: string; value: string; current: string; label: ReactNode; disabled?: boolean; onChange: (v: string) => void }> = ({ name, value, current, label, disabled, onChange }) => (
  <div className="form-check form-check-inline" style={{ fontSize: "0.83rem" }}>
    <input className="form-check-input" type="radio" name={name} id={`${name}-${value}`} value={value} checked={current === value} disabled={disabled} onChange={() => onChange(value)} />
    <label className="form-check-label" htmlFor={`${name}-${value}`} style={{ color: "#374151" }}>{label}</label>
  </div>
);

// Checkbox list for keys with labels (+ optional description), e.g. events, roles, predicates.
export const KeyCheckList: FC<{
  idPrefix: string;
  options: { key: string; label: string; description?: string }[];
  selected: string[];
  disabled?: boolean;
  onToggle: (key: string) => void;
  empty?: ReactNode;
  columns?: number;
}> = ({ idPrefix, options, selected, disabled, onToggle, empty, columns = 2 }) => {
  if (options.length === 0) return <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>{empty || "Nothing to choose from."}</div>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: "4px 16px" }}>
      {options.map((o) => {
        const id = `${idPrefix}-${o.key}`;
        const on = selected.includes(o.key);
        return (
          <div key={o.key} className="form-check" style={{ fontSize: "0.83rem", background: on ? "#eef2ff" : undefined, borderRadius: 6, padding: "3px 6px 3px 28px" }}>
            <input className="form-check-input" type="checkbox" id={id} checked={on} disabled={disabled} onChange={() => onToggle(o.key)} />
            <label className="form-check-label" htmlFor={id} style={{ color: "#111827", display: "block" }}>
              {o.label}
              <code style={{ fontFamily: "'Courier New', monospace", fontSize: "0.68rem", color: "#9ca3af", marginLeft: 6 }}>{o.key}</code>
              {o.description && <div style={{ fontSize: "0.72rem", color: "#6b7280" }}>{o.description}</div>}
            </label>
          </div>
        );
      })}
    </div>
  );
};
