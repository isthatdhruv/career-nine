import { useEffect, useState } from "react";
import { Modal, Spinner } from "react-bootstrap";
import {
  getReleaseStatus,
  previewRelease,
  releaseDashboard,
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
  const [releasing, setReleasing] = useState(false);
  const [progress, setProgress] = useState<ReleaseStatus | null>(null);

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
    setProgress(null);
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

  const handleRelease = async () => {
    if (instituteCode == null || assessmentId == null) return;
    setReleasing(true);
    try {
      const res = await releaseDashboard(instituteCode, assessmentId);
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
      setReleasing(false);
    }
  };

  const failed = progress?.byStatus?.FAILED ?? 0;
  const skipped = progress?.byStatus?.SKIPPED_SMALL_COHORT ?? 0;

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
          <>
            <p className="mb-2">
              Generating <strong>{progress.done}</strong> of{" "}
              <strong>{progress.total}</strong> dashboards.
            </p>
            <div className="progress" style={{ height: 6 }}>
              <div
                className="progress-bar"
                role="progressbar"
                style={{
                  width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
            {progress.complete ? (
              <p className="text-muted fs-7 mt-3 mb-0">
                Finished.
                {skipped > 0 &&
                  ` ${skipped} scope${skipped === 1 ? "" : "s"} had too few students for a narrative.`}
                {failed > 0 && ` ${failed} failed — retry from the dashboard.`}
              </p>
            ) : (
              <p className="text-muted fs-7 mt-3 mb-0">
                This continues on the server; you can close this window.
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

            <p className="text-muted fs-7 mb-0">
              Each scope is analysed separately, so this takes a few minutes and runs in
              the background. Scopes with very few students get their numbers but no
              written narrative.
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
            disabled={
              releasing ||
              loadingPreview ||
              assessmentId == null ||
              !preview?.canRelease ||
              (preview?.scopeCount ?? 0) === 0
            }
            onClick={handleRelease}
          >
            {releasing ? "Starting…" : "Release Dashboard"}
          </button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default ReleaseDashboardModal;
