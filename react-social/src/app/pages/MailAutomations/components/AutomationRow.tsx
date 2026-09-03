import { FC } from "react";
import { formatDateTime, mono } from "../../EmailTemplates/components/MailBadges";
import { MailAutomation, MailEventInfo } from "../API/MailAutomation_APIs";
import { Chip, ChipList, StateBadge, WarningBadge, dash } from "./Chips";
import { eventLabel, optionLabel, relativeTime, td, timingText, unionOf } from "./automationHelpers";

interface Props {
  a: MailAutomation;
  events: MailEventInfo[];
  audienceLabel: (key: string) => string;
  canEdit: boolean;
  busy: boolean;
  warningsOpen: boolean;
  columnCount: number;
  onToggleWarnings: () => void;
  onEnabled: (enabled: boolean) => void;
  onPaused: (paused: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const small: React.CSSProperties = { fontSize: "0.74rem", color: "#6b7280" };
const iconBtn: React.CSSProperties = { borderRadius: "6px", padding: "2px 7px" };

const AutomationRow: FC<Props> = ({ a, events, audienceLabel, canEdit, busy, warningsOpen, columnCount, onToggleWarnings, onEnabled, onPaused, onEdit, onDuplicate, onDelete }) => {
  const roles = unionOf(events, a.triggerEvents, (e) => e.roles);
  const predicates = unionOf(events, a.triggerEvents, (e) => e.predicates);
  const dateFields = unionOf(events, a.triggerEvents, (e) => e.dateFields);
  const dateLabel = a.relativeToField ? optionLabel(dateFields, a.relativeToField) : undefined;
  const s = a.stats || { queued: 0, sent: 0, failed: 0, skipped: 0, cancelled: 0, last7dSent: 0, lastSentAt: null };

  return (
    <>
      <tr style={{ borderBottom: "1px solid #f3f4f6", opacity: busy ? 0.6 : 1 }}>
        <td style={{ ...td, minWidth: 200 }}>
          <div style={{ fontWeight: 600, color: "#111827" }}>{a.name}</div>
          {a.description && <div style={small}>{a.description}</div>}
          {a.automationKey && <code style={{ ...mono, color: "#6b7280", fontSize: "0.7rem" }}>{a.automationKey}</code>}
        </td>
        <td style={td}>
          {a.cron ? (
            <>
              <Chip tone="blue" code title="Cron schedule">{a.cron}</Chip>
              <div style={small}>{a.audienceKey ? audienceLabel(a.audienceKey) : "no audience"}</div>
            </>
          ) : (
            <ChipList tone="indigo" items={a.triggerEvents.map((k) => ({ key: k, label: eventLabel(events, k) }))} />
          )}
        </td>
        <td style={{ ...td, minWidth: 150, color: "#374151" }}>
          {timingText(a, dateLabel)}
          <div style={small}>
            {a.deliveryMode === "IMMEDIATE" ? "inline at publish" : "via queue"}
            {a.recheckBeforeSend && " · rechecked"}
            {a.respectQuietHours && " · quiet hours"}
          </div>
        </td>
        <td style={td}>
          <ChipList tone="gray" items={a.conditions.map((k) => ({ key: k, label: optionLabel(predicates, k) }))} />
        </td>
        <td style={{ ...td, minWidth: 140 }}>
          {a.templateName ? <div style={{ color: "#111827" }}>{a.templateName}</div> : <span style={{ color: "#b45309" }}><i className="bi bi-exclamation-circle me-1"></i>No template</span>}
          {a.templateMailKey && <code style={{ ...mono, color: "#6b7280", fontSize: "0.7rem" }}>{a.templateMailKey}</code>}
        </td>
        <td style={td}>
          <span className="d-inline-flex flex-wrap gap-1">
            <ChipList tone="indigo" items={a.recipientRoles.map((k) => ({ key: k, label: optionLabel(roles, k) }))} empty={a.extraRecipients.length ? null : dash} />
            {a.extraRecipients.length > 0 && <Chip tone="gray" title={a.extraRecipients.join(", ")}>+{a.extraRecipients.length} address{a.extraRecipients.length === 1 ? "" : "es"}</Chip>}
          </span>
        </td>
        <td style={td}>
          <ChipList tone="red" items={a.cancelOnEvents.map((k) => ({ key: k, label: eventLabel(events, k) }))} />
        </td>
        <td style={{ ...td, whiteSpace: "nowrap" }}>
          <div className="d-flex align-items-center gap-2">
            <StateBadge enabled={a.enabled} paused={a.paused} />
            <div className="form-check form-switch m-0" title={a.enabled ? "Disable" : "Enable"}>
              <input className="form-check-input" type="checkbox" role="switch" checked={a.enabled} disabled={!canEdit || busy} onChange={(e) => onEnabled(e.target.checked)} style={{ cursor: canEdit ? "pointer" : "default" }} />
            </div>
            <button
              type="button"
              className="btn btn-sm btn-light"
              style={{ ...iconBtn, color: a.paused ? "#059669" : "#b45309" }}
              title={a.paused ? "Resume (new jobs are queued again)" : "Pause (keeps it enabled, stops queuing new jobs)"}
              disabled={!canEdit || busy || !a.enabled}
              onClick={() => onPaused(!a.paused)}
            >
              <i className={`bi ${a.paused ? "bi-play-fill" : "bi-pause-fill"}`}></i>
            </button>
          </div>
        </td>
        <td style={{ ...td, whiteSpace: "nowrap" }}>
          <div style={{ fontSize: "0.78rem", color: "#374151" }}>
            <span style={{ color: "#059669", fontWeight: 600 }}>{s.sent}</span> sent
            <span style={{ color: "#d1d5db" }}> · </span>
            <span style={{ color: "#6b7280", fontWeight: 600 }}>{s.skipped}</span> skipped
            <span style={{ color: "#d1d5db" }}> · </span>
            <span style={{ color: s.failed ? "#dc2626" : "#6b7280", fontWeight: 600 }}>{s.failed}</span> failed
          </div>
          <div style={small}>
            {s.queued > 0 && <span>{s.queued} queued · </span>}
            {s.lastSentAt ? <span title={formatDateTime(s.lastSentAt)}>last sent {relativeTime(s.lastSentAt)}</span> : "never sent"}
          </div>
        </td>
        <td style={td}>
          <WarningBadge count={a.warnings?.length || 0} open={warningsOpen} onClick={onToggleWarnings} />
        </td>
        <td style={{ ...td, whiteSpace: "nowrap" }}>
          <button className="btn btn-sm btn-light me-1" onClick={onEdit} disabled={busy} style={{ ...iconBtn, color: "#2563eb" }} title={canEdit ? "Edit" : "View"}><i className={`bi ${canEdit ? "bi-pencil-square" : "bi-eye"}`}></i></button>
          {canEdit && (
            <>
              <button className="btn btn-sm btn-light me-1" onClick={onDuplicate} disabled={busy} style={{ ...iconBtn, color: "#4f46e5" }} title="Duplicate"><i className="bi bi-files"></i></button>
              <button className="btn btn-sm btn-light" onClick={onDelete} disabled={busy} style={{ ...iconBtn, color: "#dc2626" }} title="Delete"><i className="bi bi-trash"></i></button>
            </>
          )}
        </td>
      </tr>
      {warningsOpen && a.warnings.length > 0 && (
        <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
          <td colSpan={columnCount} style={{ padding: "0 12px 10px" }}>
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", padding: "8px 12px", fontSize: "0.8rem", color: "#92400e" }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}><i className="bi bi-exclamation-triangle-fill me-1"></i>Warnings for "{a.name}"</div>
              <ul className="mb-0" style={{ paddingLeft: 18 }}>
                {a.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default AutomationRow;
