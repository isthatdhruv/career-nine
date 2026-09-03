import { CSSProperties, FC } from "react";
import { EmailMailClass, EmailReviewStatus, EmailSeedOrigin, LintSeverity } from "../API/EmailTemplate_APIs";

// Small presentational helpers shared by the mail catalogue and the template editor,
// so provenance/class/severity read the same everywhere.

export const mono: CSSProperties = { fontFamily: "'Courier New', monospace", fontSize: "0.76rem" };

export const pill = (bg: string, color: string, extra?: CSSProperties): CSSProperties => ({
  display: "inline-block",
  fontSize: "0.7rem",
  fontWeight: 700,
  padding: "2px 8px",
  borderRadius: "4px",
  background: bg,
  color,
  whiteSpace: "nowrap",
  lineHeight: 1.6,
  ...extra,
});

export const REVIEW_LABELS: Record<EmailReviewStatus, string> = {
  NOT_REVIEWED: "Not reviewed",
  APPROVED: "Approved",
  NEEDS_CHANGE: "Needs change",
};

const ORIGIN_LABELS: Record<EmailSeedOrigin, string> = {
  CODE_PORT: "from code",
  REMINDER_CONFIG: "reminder config",
  SEED: "seed",
  MANUAL: "manual",
};

export const OriginBadge: FC<{ origin: EmailSeedOrigin | null }> = ({ origin }) => {
  if (!origin) return <span style={{ color: "#d1d5db" }}>—</span>;
  const styles: Record<EmailSeedOrigin, [string, string]> = {
    CODE_PORT: ["#ede9fe", "#6d28d9"],
    REMINDER_CONFIG: ["#e0f2fe", "#0369a1"],
    SEED: ["#f3f4f6", "#4b5563"],
    MANUAL: ["#ecfdf5", "#047857"],
  };
  const [bg, color] = styles[origin];
  return <span style={pill(bg, color)}>{ORIGIN_LABELS[origin]}</span>;
};

export const MailClassBadge: FC<{ mailClass: EmailMailClass | null }> = ({ mailClass }) => {
  if (!mailClass) return <span style={{ color: "#d1d5db" }}>—</span>;
  const styles: Record<EmailMailClass, [string, string]> = {
    TRANSACTIONAL: ["#eef2ff", "#4338ca"],
    SUBSCRIBED: ["#fef3c7", "#b45309"],
    INTERNAL: ["#f3f4f6", "#4b5563"],
  };
  const [bg, color] = styles[mailClass];
  return <span style={pill(bg, color)}>{mailClass}</span>;
};

export const SeverityBadge: FC<{ severity: LintSeverity }> = ({ severity }) =>
  severity === "WARN"
    ? <span style={pill("#fee2e2", "#b91c1c")}>WARN</span>
    : <span style={pill("#f3f4f6", "#6b7280")}>INFO</span>;

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
