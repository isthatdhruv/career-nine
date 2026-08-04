import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

/**
 * Release and read the per-scope principal dashboards.
 *
 * A "scope" is a point on the filter lattice: the institute as a whole, a session, a
 * class, a section, or a group. Releasing generates every populated scope in one batch;
 * reading is a pure lookup, so a dashboard that was never released stays empty rather
 * than generating itself on a principal's first visit.
 */

export interface ReleasePreview {
  scopeCount: number;
  canRelease: boolean;
  reason: string | null;
  /** Present only when this institute already has a released dashboard. */
  existingGeneratedAt?: string | null;
  existingStatus?: string | null;
}

export interface ReleaseAccepted {
  releaseId: string;
  scopeCount: number;
}

export interface ReleaseStatus {
  releaseId: string;
  total: number;
  done: number;
  complete: boolean;
  byStatus: Record<string, number>;
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
  studentCount?: number | null;
  stale?: boolean;
  newStudentsSinceGeneration?: number;
  minCohortSize?: number | null;
  /** JSON strings; parsed by the caller only when `released` is true. */
  internalCalculation?: string | null;
  aiResponse?: string | null;
  docxPath?: string | null;
  error?: string;
}

/** The institute-level scope of the most recent release, payload included. */
export interface LatestRelease extends ScopeView {
  /** Every other scope lookup needs this; the page has no other way to learn it. */
  assessmentId?: number;
}

export interface ScopeSummary {
  scopeKey: string;
  scopeLevel: string;
  sessionId: number | null;
  classId: number | null;
  sectionId: number | null;
  groupId: number | null;
  status: ScopeStatus;
  studentCount: number | null;
  generatedAt: string | null;
  stale: boolean;
}

/** What a release would do, without doing it. Backs the confirmation popup. */
export function previewRelease(instituteCode: number, assessmentId: number) {
  return axios.get<ReleasePreview>(
    `${API_URL}/dashboard/principal/release/${instituteCode}/preview`,
    { params: { assessmentId } }
  );
}

/** Trigger a release. Returns 202 immediately; generation continues server-side. */
export function releaseDashboard(instituteCode: number, assessmentId: number) {
  return axios.post<ReleaseAccepted>(
    `${API_URL}/dashboard/principal/release/${instituteCode}`,
    null,
    { params: { assessmentId } }
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
 * The dashboard's entry point: the most recent release for this institute.
 *
 * Resolves the assessment from stored rows rather than from the live computation —
 * asking the live path which assessments exist would reintroduce the recompute the
 * read path exists to avoid.
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
