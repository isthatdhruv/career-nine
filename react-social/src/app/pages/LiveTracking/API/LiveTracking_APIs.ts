import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

export function getAssessmentList() {
  return axios.get(`${API_URL}/assessments/get/list-summary`);
}

export function getLiveTracking(assessmentId: number) {
  return axios.get(`${API_URL}/assessments/${assessmentId}/live-tracking`);
}

export function getLiveTrackingLite(assessmentId: number) {
  return axios.get(`${API_URL}/assessments/${assessmentId}/live-tracking-lite`);
}

export function getRedisPartials(assessmentId?: number) {
  const params = assessmentId ? `?assessmentId=${assessmentId}` : '';
  return axios.get(`${API_URL}/assessment-answer/redis-partials${params}`);
}

export function flushPartialToDb(data: {userStudentId?: number, assessmentId: number}) {
  return axios.post(`${API_URL}/assessment-answer/flush-partial-to-db`, data);
}

export function getRedisPartialDetail(userStudentId: number, assessmentId: number) {
  return axios.get(`${API_URL}/assessment-answer/redis-partial-detail`, {
    params: { userStudentId, assessmentId }
  });
}

export function submitFromRedis(userStudentId: number, assessmentId: number) {
  return axios.post(`${API_URL}/assessment-answer/submit-from-redis`, {
    userStudentId, assessmentId
  });
}

// ─── Pending Persistence (completed students whose data isn't in MySQL yet) ───

export interface PendingPersistenceFailure {
  attemptCount: number;
  firstFailedAt: string;
  lastAttemptAt: string;
  nextRetryAt: string | null;
  lastErrorClass: string | null;
  lastErrorKind: "transient" | "non_transient" | null;
  consecutiveNonTransientCount: number;
}

export type PendingPersistenceDiagnostic =
  | "awaiting_processor"
  | "partial_inflight"
  | "duplicate_cleanup_needed"
  | "excess_pending"
  | "excess_already_persisted"
  | "excess_partial_db"
  | "reconcile_only"
  | "ghost_partial"
  | "ghost_empty";

export type PendingPersistenceAction =
  | "retry_now"
  | "cleanup_redis"
  | "reconcile"
  | "reset_assessment"
  | "inspect";

export interface PendingPersistenceEntry {
  userStudentId: number;
  assessmentId: number;
  studentName: string | null;
  username: string | null;
  status: string;
  persistenceState: string;
  expectedCount: number;
  dbAnswerCount: number;
  redisPresent: boolean;
  redisAnswerCount: number | null;
  redisDistinctQuestionCount: number | null;
  diagnostic: PendingPersistenceDiagnostic;
  recommendedAction: PendingPersistenceAction;
  failure?: PendingPersistenceFailure;
}

export function getPendingPersistence(assessmentId?: number) {
  const params = assessmentId ? `?assessmentId=${assessmentId}` : "";
  return axios.get<PendingPersistenceEntry[]>(
    `${API_URL}/assessment-answer/pending-persistence${params}`
  );
}

export function reconcilePersisted(data: {
  userStudentId: number;
  assessmentId: number;
  adminUserId?: number;
  reason?: string;
}) {
  return axios.post(`${API_URL}/assessment-answer/reconcile`, data);
}

export function cleanupRedis(data: {
  userStudentId: number;
  assessmentId: number;
  adminUserId?: number;
  reason?: string;
}) {
  return axios.post(`${API_URL}/assessment-answer/cleanup-redis`, data);
}

export function retryNow(data: {
  userStudentId: number;
  assessmentId: number;
  adminUserId?: number;
  reason?: string;
}) {
  return axios.post(`${API_URL}/assessment-answer/retry-now`, data);
}

export function resetAssessment(data: {
  userStudentId: number;
  assessmentId: number;
  adminUserId?: number;
  reason?: string;
}) {
  return axios.post(`${API_URL}/student/resetAssessment`, data);
}

export function getSubmissionFailureDetail(userStudentId: number, assessmentId: number) {
  return axios.get(`${API_URL}/assessment-answer/submission-failure-detail`, {
    params: { userStudentId, assessmentId }
  });
}
