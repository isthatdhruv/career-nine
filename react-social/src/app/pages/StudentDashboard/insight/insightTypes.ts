// Mirrors the backend contract InsightDashboard.java (schemaVersion "insight-v1").
// The dashboard is a list of typed widget sections; the frontend renders each by
// its `type` through a widget registry, so a new engine needs no frontend change.

export type InsightSectionType =
  | "stat"
  | "radar"
  | "bars"
  | "careers"
  | "chips"
  | "flags"
  | "notes"
  | "list";

export interface InsightStudent {
  name?: string;
  studentClass?: string;
  gradeGroup?: string;
  schoolName?: string;
  schoolCity?: string;
}

export interface StatItem {
  label: string;
  value: string;
  hint?: string;
  accent?: "primary" | "good" | "warn" | string;
}

export interface AxisItem {
  label: string;
  value: number; // 0–100
  rawScore?: number;
  stanine?: number;
  level?: string; // "HIGH" | "MODERATE" | "LOW"
}

export interface CareerItem {
  name: string;
  suitability: number;
  potentialMatch: number;
  valuesMatch: number;
  aspiration: boolean;
  matchedValues: string[];
}

export interface FlagItem {
  name: string;
  message: string;
  severity: "info" | "warning" | "critical" | string;
}

export interface NoteItem {
  title?: string;
  body: string;
}

export interface ListItemData {
  label: string;
  detail?: string;
}

export interface InsightSection {
  type: InsightSectionType;
  title: string;
  subtitle?: string;
  // Shape depends on `type`: StatItem[] | AxisItem[] | CareerItem[] | string[] | FlagItem[]
  data: unknown;
}

export interface InsightCta {
  headline?: string;
  message?: string;
}

export interface InsightAccess {
  unlocked: boolean;
  reason: "released" | "purchased" | "locked" | string;
  preview: boolean;
  cta?: InsightCta;
}

export interface InsightDashboardDTO {
  schemaVersion: string;
  engine: string; // "pager" | "bet" | "navigator"
  generatedAt: string;
  student: InsightStudent;
  access: InsightAccess;
  sections: InsightSection[];
}
