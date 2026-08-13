import { useEffect, useMemo, useState } from "react";
import { Modal, Spinner } from "react-bootstrap";
import {
  getReleaseStatus,
  previewRelease,
  releaseDashboard,
  ReleaseMode,
  ReleasePreview,
  ReleaseSelection,
  ReleaseStatus,
  ScopePlanItem,
} from "../../SchoolDashboard/PrincipalDashboardRelease_APIs";
import { getSchoolDashboard } from "../../SchoolDashboard/SchoolDashboard_APIs";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";

interface Props {
  show: boolean;
  onHide: () => void;
  instituteCode: number | null;
  instituteName?: string;
}

interface AssessmentOption {
  assessmentId: number;
  assessmentName: string;
  completed: number;
  total: number;
}

/**
 * Confirmation for "Release Dashboard".
 *
 * <p>Releasing is neither cheap nor private: it spends an OpenAI call per scope and
 * overwrites content the school may already have circulated. So this states what will
 * happen — how many scopes are new, how many are already current, how many sit below the
 * narrative floor — before the button is armed, rather than letting an admin discover it
 * afterwards.
 *
 * <p>The whole school is previewed once and narrowed here. The response carries every
 * scope with its dimensions and verdict, so changing a dropdown filters what is already
 * loaded instead of re-scoring the school on the server.
 *
 * <p>Generation runs server-side; this polls for progress so closing the tab does not
 * abandon the release.
 */
const ReleaseDashboardModal = ({
  show,
  onHide,
  instituteCode,
  instituteName,
}: Props) => {
  const [assessments, setAssessments] = useState<AssessmentOption[]>([]);
  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [preview, setPreview] = useState<ReleasePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [progress, setProgress] = useState<ReleaseStatus | null>(null);

  const [mode, setMode] = useState<ReleaseMode>("ALL");
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [force, setForce] = useState(false);
  const [ignoreCohortFloor, setIgnoreCohortFloor] = useState(false);

  /**
   * Progress is cleared only when the dialog is opened.
   *
   * Deliberately keyed on `show` alone: clearing it from the preview effect instead would
   * mean any re-run of that effect — a re-selected assessment, a parent re-render —
   * silently threw away a running or finished release and bounced the admin back to the
   * button screen with no record of what happened.
   */
  useEffect(() => {
    if (show) {
      setProgress(null);
      setMode("ALL");
      setSessionId(null);
      setClassId(null);
      setSectionId(null);
      setForce(false);
      setIgnoreCohortFloor(false);
    }
  }, [show]);

  // A release is always of one assessment, and the institute page carries no assessment
  // context — so the choice has to be made here rather than guessed.
  useEffect(() => {
    if (!show || instituteCode == null) return;
    let cancelled = false;
    setLoadingAssessments(true);
    setAssessmentId(null);
    setAssessments([]);
    getSchoolDashboard(instituteCode)
      .then((res) => {
        if (cancelled) return;
        const list = (res.data.assessments ?? []).map((a) => ({
          assessmentId: a.assessmentId,
          assessmentName: a.assessmentName,
          completed: a.completed,
          total: a.total,
        }));
        setAssessments(list);
        // Only one assessment is not a choice worth making.
        if (list.length === 1) setAssessmentId(list[0].assessmentId);
      })
      .catch((err: any) => {
        if (!cancelled) {
          showErrorToast(
            "Could not load this school's assessments: " +
              (err?.response?.data?.error || err.message)
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAssessments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [show, instituteCode]);

  // One whole-school preview per assessment. Narrowing happens client-side below.
  useEffect(() => {
    if (!show || instituteCode == null || assessmentId == null) return;
    let cancelled = false;
    setPreview(null);
    setLoadingPreview(true);
    previewRelease(instituteCode, assessmentId, { mode: "ALL", force, ignoreCohortFloor })
      .then((res) => {
        if (!cancelled) setPreview(res.data);
      })
      .catch((err: any) => {
        if (!cancelled) {
          showErrorToast(
            "Could not check this school: " + (err?.response?.data?.error || err.message)
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [show, instituteCode, assessmentId, force, ignoreCohortFloor]);

  // Poll while a release is in flight. Generation is per scope, so progress moves
  // steadily rather than jumping from 0 to done.
  useEffect(() => {
    if (!progress || progress.complete || instituteCode == null) return;
    const t = setTimeout(() => {
      getReleaseStatus(instituteCode, progress.releaseId)
        .then((res) => setProgress(res.data))
        .catch(() => {
          /* a dropped poll is not a failed release — the next tick retries */
        });
    }, 3000);
    return () => clearTimeout(t);
  }, [progress, instituteCode]);

  const allScopes = preview?.scopes ?? [];

  // Selector options, read off the whole-school preview: only dimensions that actually
  // have assessed students appear, so an admin cannot select a section that will produce
  // nothing.
  const sessions = useMemo(
    () => uniqueBy(allScopes.filter((s) => s.scopeLevel === "SESSION"), (s) => s.sessionId),
    [allScopes]
  );
  const classes = useMemo(
    () => uniqueBy(allScopes.filter((s) => s.scopeLevel === "CLASS"), (s) => s.classId),
    [allScopes]
  );
  const sections = useMemo(
    () =>
      uniqueBy(
        allScopes.filter((s) => s.scopeLevel === "SECTION" && s.classId === classId),
        (s) => s.sectionId
      ),
    [allScopes, classId]
  );
  const groups = useMemo(
    () => uniqueBy(allScopes.filter((s) => s.scopeLevel === "GROUP"), (s) => s.groupId),
    [allScopes]
  );

  /**
   * What the current selection covers.
   *
   * Mirrors the server's expansion: selecting a class takes the class *and its sections*,
   * because a dashboard whose class view works but whose section filter says "not
   * generated" is the failure this feature exists to remove.
   */
  const selected = useMemo(() => {
    if (mode === "ALL") return allScopes;
    if (mode === "GROUPS") return allScopes.filter((s) => s.scopeLevel === "GROUP");
    return allScopes.filter((s) => {
      if (s.scopeLevel === "GROUP") return false;
      if (sectionId != null) return s.sectionId === sectionId;
      // A class takes its sections with it, which is what `classId ===` already gives:
      // section scopes carry their class.
      if (classId != null) return s.classId === classId;
      // The session selector only appears when a school has more than one, and in that
      // case every scope below the institute carries its session — so matching on it
      // does not sweep in another year's classes.
      if (sessionId != null) return s.sessionId === sessionId;
      return true;
    });
  }, [allScopes, mode, sessionId, classId, sectionId]);

  const willNarrate = selected.filter((s) => s.generatesNarrative).length;
  const unchanged = selected.filter((s) => s.verdict === "UNCHANGED").length;
  const belowFloor = selected.filter((s) => s.verdict === "SKIPPED_SMALL_COHORT").length;

  const selection: ReleaseSelection = {
    mode,
    sessionId: mode === "ACADEMIC" ? sessionId : null,
    classId: mode === "ACADEMIC" ? classId : null,
    sectionId: mode === "ACADEMIC" ? sectionId : null,
    groupIds: mode === "GROUPS" ? (groups.map((g) => g.groupId!) as number[]) : undefined,
    force,
    ignoreCohortFloor,
  };

  const handleRelease = async () => {
    if (instituteCode == null || assessmentId == null) return;
    setReleasing(true);
    try {
      const res = await releaseDashboard(instituteCode, assessmentId, selection);
      showSuccessToast(
        `Releasing ${res.data.scopeCount} dashboards — this runs in the background.`
      );
      setProgress({
        releaseId: res.data.releaseId,
        total: res.data.scopeCount,
        done: 0,
        complete: false,
        byStatus: {},
      });
    } catch (err: any) {
      showErrorToast("Release failed: " + (err?.response?.data?.error || err.message));
    } finally {
      setReleasing(false);
    }
  };

  const failed = progress?.byStatus?.FAILED ?? 0;
  const skipped = progress?.byStatus?.SKIPPED_SMALL_COHORT ?? 0;
  // Skipped scopes are a normal outcome, not a failure: they still hold their computed
  // figures, they just carry no written narrative.
  const generated = progress?.byStatus?.GENERATED ?? 0;

  const blocked =
    releasing ||
    loadingPreview ||
    assessmentId == null ||
    !preview?.canRelease ||
    selected.length === 0;

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title className="fs-5">
          Release Dashboard
          {instituteName && (
            <span className="text-muted fs-6 fw-normal"> · {instituteName}</span>
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {!progress && (
          <div className="mb-3">
            <label htmlFor="rd-assessment" className="form-label fs-7 fw-bold text-muted">
              ASSESSMENT
            </label>
            <select
              id="rd-assessment"
              className="form-select form-select-sm"
              value={assessmentId ?? ""}
              disabled={loadingAssessments || assessments.length === 0}
              onChange={(e) =>
                setAssessmentId(e.target.value === "" ? null : Number(e.target.value))
              }
            >
              <option value="">
                {loadingAssessments
                  ? "Loading assessments…"
                  : assessments.length === 0
                  ? "No assessments assigned to this school"
                  : "Select an assessment"}
              </option>
              {assessments.map((a) => (
                <option key={a.assessmentId} value={a.assessmentId}>
                  {a.assessmentName} — {a.completed} of {a.total} complete
                </option>
              ))}
            </select>
            <div className="form-text fs-8">
              School dashboards are generated from Navigator360 assessments.
            </div>
          </div>
        )}

        {assessmentId == null ? (
          <div className="alert alert-light border py-2 px-3 fs-7 mb-0">
            Choose an assessment to see what will be generated.
          </div>
        ) : loadingPreview ? (
          <div className="d-flex align-items-center gap-2 text-muted">
            <Spinner animation="border" size="sm" /> Checking this school…
          </div>
        ) : progress ? (
          /* Once a release starts, this view stays until the admin closes the window —
             it never reverts to the button screen on its own, because the outcome is the
             only record of what a release actually did. */
          <>
            {progress.complete ? (
              <div
                className={`alert py-2 px-3 mb-3 ${
                  failed > 0 ? "alert-warning" : "alert-success"
                }`}
              >
                <div className="fw-bold">
                  {failed > 0 ? "Generation finished with errors" : "Generation complete"}
                </div>
                <div className="fs-7">
                  {generated} of {progress.total} dashboard
                  {progress.total === 1 ? "" : "s"} are ready to view.
                </div>
              </div>
            ) : (
              <p className="mb-2">
                Generating <strong>{progress.done}</strong> of{" "}
                <strong>{progress.total}</strong> dashboards.
              </p>
            )}

            <div className="progress" style={{ height: 6 }}>
              <div
                className={`progress-bar${
                  progress.complete ? "" : " progress-bar-striped progress-bar-animated"
                }`}
                role="progressbar"
                aria-valuenow={progress.done}
                aria-valuemin={0}
                aria-valuemax={progress.total}
                style={{
                  width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                }}
              />
            </div>

            {progress.complete ? (
              <>
                <div className="mt-3 fs-7">
                  <div className="d-flex justify-content-between border-bottom py-1">
                    <span>Generated</span>
                    <strong>{generated}</strong>
                  </div>
                  {skipped > 0 && (
                    <div className="d-flex justify-content-between border-bottom py-1">
                      <span>
                        Skipped — under {progress.minCohortSize ?? preview?.minCohortSize ?? 10}{" "}
                        students
                        <span className="text-muted"> (figures still available)</span>
                      </span>
                      <strong>{skipped}</strong>
                    </div>
                  )}
                  {failed > 0 && (
                    <div className="d-flex justify-content-between border-bottom py-1 text-danger">
                      <span>Failed</span>
                      <strong>{failed}</strong>
                    </div>
                  )}
                </div>
                {failed > 0 && (
                  <>
                    {(progress.failures ?? []).length > 0 && (
                      <div className="alert alert-danger py-2 px-3 fs-7 mt-3 mb-2">
                        <div className="fw-bold mb-1">
                          Why {failed === 1 ? "it" : "they"} failed
                        </div>
                        {(progress.failures ?? []).map((f) => (
                          <div key={f.scopeKey} className="mb-1">
                            {f.reason}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-muted fs-7 mt-2 mb-0">
                      The scopes that failed kept their previous content. Releasing again
                      retries them.
                    </p>
                  </>
                )}
              </>
            ) : (
              <p className="text-muted fs-7 mt-3 mb-0">
                This continues on the server — closing this window will not stop it.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="mb-3">
              <div className="form-label fs-7 fw-bold text-muted">RELEASE FOR</div>
              <div className="btn-group btn-group-sm w-100" role="group">
                {(
                  [
                    ["ALL", "Everything"],
                    ["ACADEMIC", "Class / section"],
                    ["GROUPS", "Groups"],
                  ] as [ReleaseMode, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`btn ${
                      mode === value ? "btn-primary" : "btn-outline-secondary"
                    }`}
                    onClick={() => {
                      setMode(value);
                      setSessionId(null);
                      setClassId(null);
                      setSectionId(null);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {mode === "ACADEMIC" && (
              <div className="row g-2 mb-3">
                {sessions.length > 1 && (
                  <div className="col">
                    <label className="form-label fs-8 text-muted mb-1">SESSION</label>
                    <select
                      className="form-select form-select-sm"
                      value={sessionId ?? ""}
                      onChange={(e) => {
                        setSessionId(e.target.value === "" ? null : Number(e.target.value));
                        setClassId(null);
                        setSectionId(null);
                      }}
                    >
                      <option value="">All sessions</option>
                      {sessions.map((s) => (
                        <option key={s.scopeKey} value={s.sessionId!}>
                          {s.scopeLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="col">
                  <label className="form-label fs-8 text-muted mb-1">CLASS</label>
                  <select
                    className="form-select form-select-sm"
                    value={classId ?? ""}
                    onChange={(e) => {
                      setClassId(e.target.value === "" ? null : Number(e.target.value));
                      setSectionId(null);
                    }}
                  >
                    <option value="">All classes</option>
                    {classes.map((c) => (
                      <option key={c.scopeKey} value={c.classId!}>
                        {c.scopeLabel}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col">
                  <label className="form-label fs-8 text-muted mb-1">SECTION</label>
                  <select
                    className="form-select form-select-sm"
                    value={sectionId ?? ""}
                    disabled={classId == null || sections.length === 0}
                    onChange={(e) =>
                      setSectionId(e.target.value === "" ? null : Number(e.target.value))
                    }
                  >
                    <option value="">
                      {classId == null
                        ? "Pick a class first"
                        : sections.length === 0
                        ? "No sections"
                        : "All sections"}
                    </option>
                    {sections.map((s) => (
                      <option key={s.scopeKey} value={s.sectionId!}>
                        {s.scopeLabel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {mode === "ACADEMIC" && classId != null && sectionId == null && (
              <p className="text-muted fs-8 mb-3">
                Releasing a class also releases each of its sections.
              </p>
            )}

            <div className="border rounded p-3 mb-3">
              <div className="d-flex justify-content-between align-items-baseline mb-2">
                <span className="fw-bold">
                  {selected.length} dashboard{selected.length === 1 ? "" : "s"}
                </span>
                <span className="text-muted fs-7">
                  {willNarrate} will be written
                </span>
              </div>
              <div className="fs-7">
                <VerdictRow label="New" scopes={selected} verdict="NEW" />
                <VerdictRow label="Will be rewritten" scopes={selected} verdict="REFRESH" />
                <VerdictRow
                  label="Newly large enough to write"
                  scopes={selected}
                  verdict="NOW_ELIGIBLE"
                />
                <VerdictRow label="Retrying after a failure" scopes={selected} verdict="RETRY" />
                {unchanged > 0 && (
                  <div className="d-flex justify-content-between py-1 text-muted">
                    <span>Already current — figures refresh, wording is kept</span>
                    <strong>{unchanged}</strong>
                  </div>
                )}
                {belowFloor > 0 && (
                  <div className="d-flex justify-content-between py-1 text-muted">
                    <span>
                      {ignoreCohortFloor
                        ? "No scored students — nothing to write about"
                        : `Under ${
                            preview?.configuredMinCohortSize ?? 10
                          } students — figures only, no narrative`}
                    </span>
                    <strong>{belowFloor}</strong>
                  </div>
                )}
              </div>
            </div>

            {(belowFloor > 0 || ignoreCohortFloor) && (
              <div className="form-check mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="rd-ignore-floor"
                  checked={ignoreCohortFloor}
                  onChange={(e) => setIgnoreCohortFloor(e.target.checked)}
                />
                <label className="form-check-label fs-7" htmlFor="rd-ignore-floor">
                  Write narratives for small cohorts too
                  <span className="text-muted d-block fs-8">
                    Normally a scope needs {preview?.configuredMinCohortSize ?? 10}{" "}
                    scored students before it gets written up. Below that, percentages
                    rest on too few students to mean much, and the writing can end up
                    describing an identifiable child rather than a cohort. Scopes with no
                    scored students are still skipped.
                  </span>
                </label>
              </div>
            )}

            {unchanged > 0 && (
              <div className="form-check mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="rd-force"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                />
                <label className="form-check-label fs-7" htmlFor="rd-force">
                  Rewrite everything, including scopes that are already current
                  <span className="text-muted d-block fs-8">
                    Normally a dashboard is only rewritten once{" "}
                    {preview?.staleThreshold ?? 25} more students have finished and{" "}
                    {preview?.refreshCooldownHours ?? 24} hours have passed. There is no
                    earlier version to go back to.
                  </span>
                </label>
              </div>
            )}

            {preview?.existingGeneratedAt && (
              <div className="alert alert-warning py-2 px-3 fs-7">
                This <strong>overwrites</strong> the dashboard released on{" "}
                {new Date(preview.existingGeneratedAt).toLocaleString()}. Anything a
                principal has already read will be rewritten.
              </div>
            )}

            {preview && !preview.canRelease && (
              <div className="alert alert-danger py-2 px-3 fs-7 mb-0">{preview.reason}</div>
            )}

            <p className="text-muted fs-7 mb-0">
              Each scope is analysed separately, so this takes a few minutes and runs in
              the background.
            </p>
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <button type="button" className="btn btn-light btn-sm" onClick={onHide}>
          {progress ? "Close" : "Cancel"}
        </button>
        {!progress && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={blocked}
            onClick={handleRelease}
          >
            {releasing ? "Starting…" : `Release ${selected.length} dashboard${
              selected.length === 1 ? "" : "s"
            }`}
          </button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

/** One line of the breakdown, hidden when the count is zero. */
const VerdictRow = ({
  label,
  scopes,
  verdict,
}: {
  label: string;
  scopes: ScopePlanItem[];
  verdict: ScopePlanItem["verdict"];
}) => {
  const count = scopes.filter((s) => s.verdict === verdict).length;
  if (count === 0) return null;
  return (
    <div className="d-flex justify-content-between py-1">
      <span>{label}</span>
      <strong>{count}</strong>
    </div>
  );
};

/** First scope per distinct dimension value, preserving the server's order. */
function uniqueBy(
  scopes: ScopePlanItem[],
  key: (s: ScopePlanItem) => number | null
): ScopePlanItem[] {
  const seen = new Set<number>();
  const out: ScopePlanItem[] = [];
  for (const scope of scopes) {
    const value = key(scope);
    if (value == null || seen.has(value)) continue;
    seen.add(value);
    out.push(scope);
  }
  return out;
}

export default ReleaseDashboardModal;
