import { useEffect, useState } from "react";
import { Modal, Spinner } from "react-bootstrap";
import {
  getReleaseStatus,
  previewRelease,
  releaseDashboard,
  ReleaseMode,
  ReleasePreview,
  ReleaseStatus,
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
 * <p>Releasing is not a cheap or private act: it regenerates every scope on the filter
 * lattice, spends money on an OpenAI call per scope, and overwrites content the school
 * may already have circulated. So the dialog states the size of the job and the date of
 * what it replaces <em>before</em> the button is armed, rather than letting an admin
 * discover either afterwards.
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
  /** Which mode is mid-request, so only that button shows a pending label. */
  const [releasing, setReleasing] = useState<ReleaseMode | null>(null);
  const [progress, setProgress] = useState<ReleaseStatus | null>(null);

  /**
   * Progress is cleared only when the dialog is opened.
   *
   * Deliberately keyed on `show` alone: clearing it from the preview effect instead
   * would mean any re-run of that effect — a re-selected assessment, a parent
   * re-render — silently threw away a running or finished release and bounced the
   * admin back to the button screen with no record of what happened.
   */
  useEffect(() => {
    if (show) setProgress(null);
  }, [show]);

  // A release is always of one assessment, and the institute page carries no
  // assessment context — so the choice has to be made here rather than guessed.
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

  useEffect(() => {
    if (!show || instituteCode == null || assessmentId == null) return;
    let cancelled = false;
    setPreview(null);
    setLoadingPreview(true);
    previewRelease(instituteCode, assessmentId)
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
  }, [show, instituteCode, assessmentId]);

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

  const handleRelease = async (mode: ReleaseMode) => {
    if (instituteCode == null || assessmentId == null) return;
    setReleasing(mode);
    try {
      const res = await releaseDashboard(instituteCode, assessmentId, mode);
      showSuccessToast(`Releasing ${res.data.scopeCount} dashboards — this runs in the background.`);
      setProgress({
        releaseId: res.data.releaseId,
        total: res.data.scopeCount,
        done: 0,
        complete: false,
        byStatus: {},
      });
    } catch (err: any) {
      showErrorToast(
        "Release failed: " + (err?.response?.data?.error || err.message)
      );
    } finally {
      setReleasing(null);
    }
  };

  const failed = progress?.byStatus?.FAILED ?? 0;
  const skipped = progress?.byStatus?.SKIPPED_SMALL_COHORT ?? 0;
  // Skipped scopes are a normal outcome, not a failure: they still hold their
  // computed figures, they just carry no written narrative.
  const generated = progress?.byStatus?.GENERATED ?? 0;

  // One condition for both buttons — they are blocked by the same things, and
  // duplicating it is how the two drift apart.
  const blocked =
    releasing !== null ||
    loadingPreview ||
    assessmentId == null ||
    !preview?.canRelease ||
    (preview?.scopeCount ?? 0) === 0;

  return (
    <Modal show={show} onHide={onHide} centered>
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
          /* Once a release starts, this view stays until the admin closes the
             window — it never reverts to the button screen on its own, because
             the outcome is the only record of what a release actually did. */
          <>
            {progress.complete ? (
              <div
                className={`alert py-2 px-3 mb-3 ${
                  failed > 0 ? "alert-warning" : "alert-success"
                }`}
              >
                <div className="fw-bold">
                  {failed > 0
                    ? "Generation finished with errors"
                    : "Generation complete"}
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
                        Skipped — under {preview?.minCohortSize ?? 10} students
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
            <p className="mb-3">
              This generates <strong>{preview?.scopeCount ?? "…"}</strong> scoped
              dashboards for this school — one for the school as a whole, and one for
              each session, class, section and group that has assessed students.
            </p>

            {preview?.existingGeneratedAt && (
              <div className="alert alert-warning py-2 px-3 fs-7">
                This <strong>overwrites</strong> the dashboard released on{" "}
                {new Date(preview.existingGeneratedAt).toLocaleString()}. Anything a
                principal has already read will be rewritten.
              </div>
            )}

            {preview && !preview.canRelease && (
              <div className="alert alert-danger py-2 px-3 fs-7 mb-0">
                {preview.reason}
              </div>
            )}

            <p className="text-muted fs-7 mb-2">
              Each scope is analysed separately, so this takes a few minutes and runs in
              the background. Scopes with very few students get their numbers but no
              written narrative.
            </p>

            {preview && preview.fullScopeCount > preview.scopeCount && (
              <div className="border rounded p-3 bg-light fs-7">
                <div className="fw-bold mb-1">Release All</div>
                Also generates every cross-combination — a group within one section, a
                class without its session:{" "}
                <strong>{preview.fullScopeCount}</strong> dashboards instead of{" "}
                <strong>{preview.scopeCount}</strong>.
                <div className="text-muted mt-1">
                  Those extra scopes cannot be selected from the dashboard's filters, so
                  most are generated without ever being opened. Use it when you need the
                  data available for export rather than for the page.
                </div>
              </div>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <button type="button" className="btn btn-light btn-sm" onClick={onHide}>
          {progress ? "Close" : "Cancel"}
        </button>
        {!progress && (
          <>
            {preview && preview.fullScopeCount > preview.scopeCount && (
              <button
                type="button"
                className="btn btn-light-primary btn-sm"
                disabled={blocked}
                onClick={() => handleRelease("FULL")}
                title="Every cross-combination, including scopes the dashboard filters cannot select"
              >
                {releasing === "FULL"
                  ? "Starting…"
                  : `Release All (${preview.fullScopeCount})`}
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={blocked}
              onClick={() => handleRelease("LATTICE")}
            >
              {releasing === "LATTICE"
                ? "Starting…"
                : `Release Dashboard${preview ? ` (${preview.scopeCount})` : ""}`}
            </button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default ReleaseDashboardModal;
