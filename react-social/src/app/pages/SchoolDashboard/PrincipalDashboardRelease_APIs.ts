import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

/**
 * Release and read the per-scope principal dashboards.
 *
 * A "scope" is a cohort the dashboard can be filtered to: the school as a whole, a
 * session, a class, a section, or a group. A release takes a *selection* — a point on
 * the academic hierarchy, a set of groups, or everything — and expands it downward, so
 * releasing Class 10 also releases 10-A, 10-B and 10-C. Reading is a pure lookup, so a
 * dashboard that was never released stays empty rather than generating itself on a
 * principal's first visit.
 */

/**
 * Which axis the admin selected.
 *
 * ACADEMIC narrows by session/class/section; GROUPS covers groups, which are defined as
 * independent of all three; ALL covers both.
 */
export type ReleaseMode = "ALL" | "ACADEMIC" | "GROUPS";

/** What a release would do to one scope, decided before anything is spent. */
export type Verdict =
  | "NEW"
  | "RETRY"
  | "REFRESH"
  | "NOW_ELIGIBLE"
  | "UNCHANGED"
  | "SKIPPED_SMALL_COHORT"
  | "EMPTY";

export interface ScopePlanItem {
  scopeKey: string;
  scopeLabel: string;
  scopeLevel: "INSTITUTE" | "SESSION" | "CLASS" | "SECTION" | "GROUP";
  sessionId: number | null;
  classId: number | null;
  sectionId: number | null;
  groupId: number | null;
  verdict: Verdict;
  /** Students who completed and scored — the base for every figure in this scope. */
  scoredCount: number;
  /** Everyone in the scope, whatever their status. */
  totalCount: number;
  /** Whether this scope costs an OpenAI call. */
  generatesNarrative: boolean;
}

export interface ReleasePreview {
  canRelease: boolean;
  reason: string | null;
  /** Scopes touched, including the metric-only ones. */
  scopeCount: number;
  /** Scopes that will call OpenAI — the only number that costs anything. */
  narrativeCount: number;
  /** Students a scope needs before it gets a written narrative, as this plan applies it. */
  minCohortSize: number;
  /** The configured floor, so the dialog can say what an override is overriding. */
  configuredMinCohortSize: number;
  cohortFloorIgnored: boolean;
  /** New students in a scope before a refresh is justified. */
  staleThreshold: number;
  /** How long a generated scope stays current regardless of new students. */
  refreshCooldownHours: number;
  byVerdict: Partial<Record<Verdict, number>>;
  scopes: ScopePlanItem[];
  existingGeneratedAt?: string | null;
}

export interface ReleaseAccepted {
  releaseId: string;
  scopeCount: number;
  narrativeCount: number;
  byVerdict: Partial<Record<Verdict, number>>;
}

export interface ReleaseFailure {
  scopeKey: string;
  reason: string;
}

export interface ReleaseStatus {
  releaseId: string;
  total: number;
  done: number;
  complete: boolean;
  byStatus: Record<string, number>;
  /** Distinct reasons — many scopes failing on one missing key is one problem. */
  failures?: ReleaseFailure[];
  minCohortSize?: number;
}

/** Which dimensions a release is narrowed to. Omitted means "all of them". */
export interface ReleaseSelection {
  mode: ReleaseMode;
  sessionId?: number | null;
  classId?: number | null;
  sectionId?: number | null;
  groupIds?: number[];
  /**
   * Bypass the refresh conditions.
   *
   * Normally a generated scope is only re-narrated once enough new students have been
   * scored *and* the cooldown has passed. Force is the escape hatch for "the roster was
   * wrong, redo it now" — and since a release overwrites with no version to fall back
   * to, it is confirmed separately.
   */
  force?: boolean;
  /**
   * Write narratives for cohorts below the minimum size.
   *
   * A separate decision from `force`, which is about *when* to rewrite. This is about
   * *whether a cohort is big enough to describe at all* — under about ten students the
   * percentages stop meaning anything and the writing starts pointing at individuals.
   * A scope with nobody scored is still skipped either way.
   */
  ignoreCohortFloor?: boolean;
}

function selectionParams(selection: ReleaseSelection) {
  return {
    mode: selection.mode,
    sessionId: selection.sessionId ?? undefined,
    classId: selection.classId ?? undefined,
    sectionId: selection.sectionId ?? undefined,
    groupIds: selection.groupIds?.length ? selection.groupIds : undefined,
    force: selection.force ? true : undefined,
    ignoreCohortFloor: selection.ignoreCohortFloor ? true : undefined,
  };
}

/** Scope status without the payloads — drives the "not generated" state. */
export type ScopeStatus =
  | "NOT_GENERATED"
  | "PENDING"
  | "GENERATING"
  | "GENERATED"
  | "FAILED"
  | "SKIPPED_SMALL_COHORT";

export interface ScopeView {
  scopeKey: string;
  scopeLabel: string;
  released: boolean;
  status: ScopeStatus;
  generatedAt?: string | null;
  scopeLevel?: string;
  /** Students the stored figures were computed from. */
  studentCount?: number | null;
  /** Students in this scope right now — the two differ once more students finish. */
  liveStudentCount?: number | null;
  stale?: boolean;
  newStudentsSinceGeneration?: number;
  minCohortSize?: number | null;
  /** JSON strings; parsed by the caller only when `released` is true. */
  internalCalculation?: string | null;
  aiResponse?: string | null;
  docxPath?: string | null;
  error?: string;
}

/** The school's live dashboard, payload included. */
export interface LatestRelease extends ScopeView {
  /** Every other scope lookup needs this; the page has no other way to learn it. */
  assessmentId?: number;
}

export interface ScopeSummary {
  scopeKey: string;
  scopeLevel: "INSTITUTE" | "SESSION" | "CLASS" | "SECTION" | "GROUP";
  /** The name resolved when this scope was released — what the filter rail shows. */
  scopeLabel: string | null;
  sessionId: number | null;
  classId: number | null;
  sectionId: number | null;
  groupId: number | null;
  status: ScopeStatus;
  studentCount: number | null;
  generatedAt: string | null;
}

/**
 * What a release would do, without doing it.
 *
 * Ask for the whole school once and narrow client-side: the response carries every scope
 * with its dimensions and its verdict, so re-previewing on each dropdown change would
 * re-score the school to answer a question this response already contains.
 */
export function previewRelease(
  instituteCode: number,
  assessmentId: number,
  selection: ReleaseSelection = { mode: "ALL" }
) {
  return axios.get<ReleasePreview>(
    `${API_URL}/dashboard/principal/release/${instituteCode}/preview`,
    { params: { assessmentId, ...selectionParams(selection) } }
  );
}

/**
 * Trigger a release. Returns 202 immediately; generation continues server-side.
 *
 * Mode defaults to ALL only because the caller must state one — an omitted selection is
 * a bug at the call site, not a reason to guess narrowly.
 */
export function releaseDashboard(
  instituteCode: number,
  assessmentId: number,
  selection: ReleaseSelection
) {
  return axios.post<ReleaseAccepted>(
    `${API_URL}/dashboard/principal/release/${instituteCode}`,
    null,
    { params: { assessmentId, ...selectionParams(selection) } }
  );
}

export function getReleaseStatus(instituteCode: number, releaseId: string) {
  return axios.get<ReleaseStatus>(
    `${API_URL}/dashboard/principal/release/${instituteCode}/status`,
    { params: { releaseId } }
  );
}

/**
 * Read one scope. Pass only the dimensions the filter rail has bound — an omitted
 * dimension means "all", which is a different scope from any specific value.
 */
export function getScope(
  instituteCode: number,
  params: {
    assessmentId: number;
    sessionId?: number | null;
    classId?: number | null;
    sectionId?: number | null;
    groupId?: number | null;
  }
) {
  return axios.get<ScopeView>(`${API_URL}/dashboard/principal/${instituteCode}`, {
    params: {
      assessmentId: params.assessmentId,
      sessionId: params.sessionId ?? undefined,
      classId: params.classId ?? undefined,
      sectionId: params.sectionId ?? undefined,
      groupId: params.groupId ?? undefined,
    },
  });
}

/**
 * The dashboard's entry point: the school's current release.
 *
 * Resolves the assessment from stored rows rather than from the live computation —
 * asking the live path which assessments exist would reintroduce the recompute the read
 * path exists to avoid.
 */
export function getLatestRelease(instituteCode: number) {
  return axios.get<LatestRelease>(`${API_URL}/dashboard/principal/${instituteCode}/latest`);
}

/** Every released scope, so the filter rail can grey out what was never generated. */
export function getReleasedScopes(instituteCode: number, assessmentId: number) {
  return axios.get<ScopeSummary[]>(
    `${API_URL}/dashboard/principal/${instituteCode}/scopes`,
    { params: { assessmentId } }
  );
}
