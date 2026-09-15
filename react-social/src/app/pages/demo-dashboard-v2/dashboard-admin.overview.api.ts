import axios from "axios";

/**
 * Admin overview cards — one endpoint per card, served by
 * spring-social `AdminOverviewController` (`/dashboard/admin/overview/<key>`).
 *
 * Every endpoint takes the same optional query string:
 *   from, to          ISO dates (inclusive) — omit both for "all time"
 *   instituteCode     narrow to one institute
 *   assessmentIds     comma-separated assessment ids
 *
 * The backend computes each card on its own thread of a dedicated pool and
 * answers the HTTP request asynchronously, so the dashboard fires all of these
 * at once and paints each card as soon as its own number arrives.
 */

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

export type OverviewCardKey =
  | "signups"
  | "active-assessments"
  | "assessments-completed"
  | "assessments-in-progress"
  | "assessments-not-started"
  | "reports-generated"
  | "counselling-booked"
  | "counselling-sessions"
  | "counselling-completed"
  | "students-absent"
  | "counsellors-absent"
  | "payments-completed"
  | "website-registrations";

export const OVERVIEW_CARD_KEYS: OverviewCardKey[] = [
  "signups",
  "active-assessments",
  "assessments-completed",
  "assessments-in-progress",
  "assessments-not-started",
  "reports-generated",
  "counselling-booked",
  "counselling-sessions",
  "counselling-completed",
  "students-absent",
  "counsellors-absent",
  "payments-completed",
  "website-registrations",
];

export interface OverviewCard {
  key: OverviewCardKey | string;
  /** Headline number. */
  value: number;
  /** Secondary numbers for the caption (card-specific keys). */
  extra: Record<string, any>;
  from: string | null;
  to: string | null;
  /** Whether the date window actually narrowed this number. */
  rangeApplied: boolean;
  /** Plain-English note on what the number counts. */
  basis: string;
  computedAt: string;
  /** Diagnostics: server-side query time and the pool thread that ran it. */
  tookMs: number;
  thread: string;
}

export interface OverviewQuery {
  /** ISO date (yyyy-mm-dd) or null for all time. */
  from: string | null;
  to: string | null;
  instituteCode: string | null;
  assessmentIds: string[];
}

const buildParams = (q: OverviewQuery): Record<string, string> => {
  const p: Record<string, string> = {};
  if (q.from && q.to) {
    p.from = q.from;
    p.to = q.to;
  }
  if (q.instituteCode) p.instituteCode = q.instituteCode;
  if (q.assessmentIds.length > 0) p.assessmentIds = q.assessmentIds.join(",");
  return p;
};

export async function fetchOverviewCard(
  key: OverviewCardKey,
  q: OverviewQuery,
  signal?: AbortSignal
): Promise<OverviewCard> {
  const res = await axios.get(`${API_URL}/dashboard/admin/overview/${key}`, {
    params: buildParams(q),
    signal,
  });
  const d = res.data || {};
  return {
    key: d.key ?? key,
    value: Number(d.value ?? 0),
    extra: d.extra ?? {},
    from: d.from ?? null,
    to: d.to ?? null,
    rangeApplied: !!d.rangeApplied,
    basis: String(d.basis ?? ""),
    computedAt: String(d.computedAt ?? ""),
    tookMs: Number(d.tookMs ?? 0),
    thread: String(d.thread ?? ""),
  };
}

/** All cards in one round trip (server fans them out in parallel). Not used by the page; handy for tooling. */
export async function fetchOverviewAll(
  q: OverviewQuery
): Promise<Record<string, OverviewCard>> {
  const res = await axios.get(`${API_URL}/dashboard/admin/overview/all`, {
    params: buildParams(q),
  });
  return res.data || {};
}

/** One column of a drill-down table: the row key and its header label. */
export interface OverviewDetailColumn {
  key: string;
  label: string;
}

/** One page of the students behind a card (`GET /dashboard/admin/overview/<key>/students`). */
export interface OverviewDetail {
  key: string;
  title: string;
  total: number;
  page: number;
  size: number;
  search: string | null;
  columns: OverviewDetailColumn[];
  rows: Record<string, any>[];
  computedAt: string;
  tookMs: number;
  thread: string;
}

export async function fetchOverviewStudents(
  key: OverviewCardKey,
  q: OverviewQuery,
  opts: { page: number; size: number; search?: string },
  signal?: AbortSignal
): Promise<OverviewDetail> {
  const params: Record<string, string> = {
    ...buildParams(q),
    page: String(opts.page),
    size: String(opts.size),
  };
  if (opts.search && opts.search.trim()) params.q = opts.search.trim();
  const res = await axios.get(`${API_URL}/dashboard/admin/overview/${key}/students`, {
    params,
    signal,
  });
  const d = res.data || {};
  return {
    key: String(d.key ?? key),
    title: String(d.title ?? ""),
    total: Number(d.total ?? 0),
    page: Number(d.page ?? opts.page),
    size: Number(d.size ?? opts.size),
    search: d.search ?? null,
    columns: Array.isArray(d.columns) ? d.columns : [],
    rows: Array.isArray(d.rows) ? d.rows : [],
    computedAt: String(d.computedAt ?? ""),
    tookMs: Number(d.tookMs ?? 0),
    thread: String(d.thread ?? ""),
  };
}
