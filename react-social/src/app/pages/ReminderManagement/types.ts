export type ReminderServiceType =
  | "ASSESSMENT_INVITE_B2C"
  | "COUNSELLING_24H"
  | "COUNSELLING_1H"
  | "ASSESSMENT_MAPPING";

export const SERVICE_TYPE_LABEL: Record<ReminderServiceType, string> = {
  ASSESSMENT_INVITE_B2C: "B2C Assessment Invite",
  COUNSELLING_24H: "Counselling — 24h before",
  COUNSELLING_1H: "Counselling — 1h before",
  ASSESSMENT_MAPPING: "Assessment Mapping",
};

export const ALL_SERVICE_TYPES: ReminderServiceType[] = [
  "ASSESSMENT_INVITE_B2C",
  "COUNSELLING_24H",
  "COUNSELLING_1H",
  "ASSESSMENT_MAPPING",
];

export type ReminderDeliveryStatus =
  | "SENT"
  | "FAILED"
  | "SUPPRESSED"
  | "CAPPED"
  | "DRY_RUN";

export type ReminderTriggerSource = "SCHEDULED" | "MANUAL" | "TEST";

export interface ReminderConfig {
  serviceType: ReminderServiceType;
  enabled: boolean;
  cronExpression: string;
  leadTimeMinutes: number | null;
  maxSendsPerRecipient: number | null;
  subjectTemplate: string;
  bodyTemplate: string;
  updatedAt: string;
  lastSentAt?: string | null;
  sentLast24h?: number;
}

export interface ReminderLogRow {
  id: number;
  serviceType: ReminderServiceType;
  recipient: string | null;
  userStudentId: number | null;
  instituteCode: number | null;
  subject: string | null;
  deliveryStatus: ReminderDeliveryStatus;
  failureReason: string | null;
  triggeredBy: ReminderTriggerSource;
  sentAt: string | null;
  createdAt: string;
}

export interface ReminderLogDetail extends ReminderLogRow {
  body: string | null;
  linkUrl: string | null;
  entitlementId: number | null;
  appointmentId: number | null;
  assessmentMappingId: number | null;
}

export interface ReminderSuppression {
  id: number;
  userStudentId: number;
  serviceType: ReminderServiceType;
  reason: string | null;
  suppressedBy: number | null;
  suppressedAt: string;
}

export interface PagedResponse<T> {
  rows: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface RecipientPreview {
  userStudentId: number | null;
  email: string | null;
  name: string | null;
  instituteCode: number | null;
  instituteName: string | null;
  mappingId: number | null;
  assessmentId: number | null;
}

export const CRON_PRESETS: { label: string; expr: string }[] = [
  { label: "Every hour, at minute 0", expr: "0 0 * * * *" },
  { label: "Every hour, at minute 15", expr: "0 15 * * * *" },
  { label: "Every hour, at minute 23", expr: "0 23 * * * *" },
  { label: "Every 30 minutes", expr: "0 0,30 * * * *" },
  { label: "Every 6 hours", expr: "0 0 */6 * * *" },
  { label: "Daily at 9:00 AM", expr: "0 0 9 * * *" },
  { label: "Daily at 6:00 PM", expr: "0 0 18 * * *" },
];
