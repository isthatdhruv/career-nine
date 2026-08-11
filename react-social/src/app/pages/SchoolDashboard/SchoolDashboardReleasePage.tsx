import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  AdminScope,
  ContactRecipient,
  getAdminScopes,
  getContacts,
  getReleaseLog,
  getReleaseRuns,
  getReleaseStatus,
  notifyContacts,
  NotifyOutcome,
  previewRelease,
  releaseDashboard,
  ReleaseLogEntry,
  ReleaseMode,
  ReleasePreview,
  ReleaseRun,
  ReleaseStatus,
  ScopePlanItem,
  setPublished,
} from "./PrincipalDashboardRelease_APIs";
import { getSchoolDashboard } from "./SchoolDashboard_APIs";
import { useInstitutes } from "../../lib/queries/lookups";
import { showErrorToast, showSuccessToast } from "../../utils/toast";
import "./SchoolDashboardRelease.css";

interface AssessmentOption {
  assessmentId: number;
  assessmentName: string;
  completed: number;
  total: number;
}

type Panel = "release" | "published" | "log" | "notify";

/**
 * Where a school's dashboard is generated, withdrawn, traced and announced.
 *
 * <p>This used to be a modal on the institute list. Releasing outgrew that: it is not one
 * confirmation but four related jobs — decide what to generate, see what is currently
 * live, find out why a scope failed, and tell the school it is ready. A modal can hold the
 * first; it cannot hold a scrolling step-by-step log next to a recipient picker.
 *
 * <p>Everything is scoped to one institute and one assessment, chosen at the top, because
 * every endpoint underneath is keyed on that pair and letting the two drift is how an
 * admin ends up withdrawing last year's report.
 */
const SchoolDashboardReleasePage = () => {
  const location = useLocation();

  const { data: institutes = [], isLoading: institutesLoading } = useInstitutes<any>();

  const [instituteCode, setInstituteCode] = useState<number | null>(null);
  const [assessments, setAssessments] = useState<AssessmentOption[]>([]);
  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [panel, setPanel] = useState<Panel>("release");

  const instituteName = useMemo(() => {
    const found = institutes.find(
      (i: any) => Number(i.instituteCode) === instituteCode
    );
    return found?.instituteName?.trim() || "";
  }, [institutes, instituteCode]);

  const assessmentName = useMemo(
    () => assessments.find((a) => a.assessmentId === assessmentId)?.assessmentName ?? "",
    [assessments, assessmentId]
  );

  /**
   * Preselect from the query string.
   *
   * The institute list still carries a "Release Dashboard" action; it now navigates here
   * with the school already chosen, so the two entry points share one implementation
   * rather than drifting apart as two.
   */
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("institute");
    if (requested && !Number.isNaN(Number(requested))) {
      setInstituteCode(Number(requested));
    }
  }, [location.search]);

  // Which assessments this school has run. Also the only place the page learns an
  // assessment id, which every panel below needs.
  useEffect(() => {
    if (instituteCode == null) {
      setAssessments([]);
      setAssessmentId(null);
      return;
    }
    let cancelled = false;
    setLoadingAssessments(true);
    getSchoolDashboard(instituteCode)
      .then((res) => {
        if (cancelled) return;
        const list: AssessmentOption[] = (res.data?.assessments ?? []).map((a: any) => ({
          assessmentId: a.assessmentId,
          assessmentName: a.assessmentName,
          completed: a.completed,
          total: a.total,
        }));
        setAssessments(list);
        // Most completions first — the one an admin means is almost always the biggest.
        const best = [...list].sort((a, b) => b.completed - a.completed)[0];
        setAssessmentId(best ? best.assessmentId : null);
      })
      .catch(() => {
        if (!cancelled) {
          setAssessments([]);
          setAssessmentId(null);
        }
      })
      .finally(() => !cancelled && setLoadingAssessments(false));
    return () => {
      cancelled = true;
    };
  }, [instituteCode]);

  const ready = instituteCode != null && assessmentId != null;

  return (
    <div className="sdr">
      <header className="sdr-head">
        <div>
          <p className="sdr-eyebrow">Career-9 administration</p>
          <h1 className="sdr-title">School dashboard releases</h1>
          <p className="sdr-lede">
            Generate a school's principal dashboard, withdraw it, trace what a run did, and
            tell the school it is ready.
          </p>
        </div>
      </header>

      <div className="sdr-pickers">
        <label className="sdr-field">
          <span>School</span>
          <select
            value={instituteCode ?? ""}
            onChange={(e) => setInstituteCode(e.target.value ? Number(e.target.value) : null)}
            disabled={institutesLoading}
          >
            <option value="">
              {institutesLoading ? "Loading schools…" : "Choose a school"}
            </option>
            {institutes.map((i: any) => (
              <option key={i.instituteCode} value={i.instituteCode}>
                {i.instituteName?.trim() || `Institute ${i.instituteCode}`}
              </option>
            ))}
          </select>
        </label>

        <label className="sdr-field">
          <span>Assessment</span>
          <select
            value={assessmentId ?? ""}
            onChange={(e) => setAssessmentId(e.target.value ? Number(e.target.value) : null)}
            disabled={instituteCode == null || loadingAssessments || assessments.length === 0}
          >
            <option value="">
              {instituteCode == null
                ? "Choose a school first"
                : loadingAssessments
                ? "Loading…"
                : assessments.length === 0
                ? "No assessments run here"
                : "Choose an assessment"}
            </option>
            {assessments.map((a) => (
              <option key={a.assessmentId} value={a.assessmentId}>
                {a.assessmentName} — {a.completed}/{a.total} completed
              </option>
            ))}
          </select>
        </label>
      </div>

      {!ready ? (
        <div className="sdr-empty">
          Choose a school and an assessment to begin.
        </div>
      ) : (
        <>
          <nav className="sdr-tabs" role="tablist">
            {(
              [
                ["release", "Generate"],
                ["published", "What is live"],
                ["log", "Activity log"],
                ["notify", "Notify the school"],
              ] as [Panel, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={panel === key}
                className={panel === key ? "is-active" : undefined}
                onClick={() => setPanel(key)}
              >
                {label}
              </button>
            ))}
          </nav>

          {panel === "release" && (
            <ReleasePanel
              instituteCode={instituteCode!}
              assessmentId={assessmentId!}
              instituteName={instituteName}
            />
          )}
          {panel === "published" && (
            <PublishedPanel instituteCode={instituteCode!} assessmentId={assessmentId!} />
          )}
          {panel === "log" && <LogPanel instituteCode={instituteCode!} />}
          {panel === "notify" && (
            <NotifyPanel
              instituteCode={instituteCode!}
              instituteName={instituteName}
              assessmentName={assessmentName}
            />
          )}
        </>
      )}
    </div>
  );
};

// ───────────────────────────── generate ─────────────────────────────

/**
 * Decide what to generate, then generate it.
 *
 * The whole school is previewed once and narrowed here: the response already carries every
 * scope with its dimensions and verdict, so changing a dropdown filters what is loaded
 * rather than re-scoring the school on the server.
 */
const ReleasePanel = ({
  instituteCode,
  assessmentId,
  instituteName,
}: {
  instituteCode: number;
  assessmentId: number;
  instituteName: string;
}) => {
  const [preview, setPreview] = useState<ReleasePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [progress, setProgress] = useState<ReleaseStatus | null>(null);

  const [mode, setMode] = useState<ReleaseMode>("ALL");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [force, setForce] = useState(false);
  const [ignoreCohortFloor, setIgnoreCohortFloor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    previewRelease(instituteCode, assessmentId, { mode: "ALL", ignoreCohortFloor })
      .then((res) => !cancelled && setPreview(res.data))
      .catch(() => !cancelled && setPreview(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [instituteCode, assessmentId, ignoreCohortFloor]);

  const scopes = preview?.scopes ?? [];

  const sessions = useMemo(() => distinct(scopes, "sessionId"), [scopes]);
  const classes = useMemo(
    () => distinct(scopes.filter((s) => matchSession(s, sessionId)), "classId"),
    [scopes, sessionId]
  );
  const sections = useMemo(
    () =>
      distinct(
        scopes.filter((s) => matchSession(s, sessionId) && s.classId === classId),
        "sectionId"
      ),
    [scopes, sessionId, classId]
  );
  const groups = useMemo(
    () => scopes.filter((s) => s.groupId != null),
    [scopes]
  );

  /** Exactly the scopes this selection would touch. */
  const selected = useMemo(() => {
    if (mode === "ALL") return scopes;
    if (mode === "GROUPS") {
      return groupIds.length === 0
        ? groups
        : groups.filter((s) => groupIds.includes(s.groupId!));
    }
    return scopes.filter((s) => {
      if (s.groupId != null) return false;
      if (sessionId != null && s.sessionId !== sessionId) return false;
      if (classId != null && s.classId !== classId) return false;
      if (sectionId != null && s.sectionId !== sectionId) return false;
      // An unbound dimension means "and everything under it", which is what a release of
      // Class 10 covering 10-A, 10-B and 10-C means.
      if (classId == null && s.classId != null && sessionId == null) return true;
      return true;
    });
  }, [mode, scopes, groups, groupIds, sessionId, classId, sectionId]);

  const narrativeCount = selected.filter((s) => s.generatesNarrative).length;

  const run = async () => {
    setReleasing(true);
    setProgress(null);
    try {
      const res = await releaseDashboard(instituteCode, assessmentId, {
        mode,
        sessionId,
        classId,
        sectionId,
        groupIds,
        force,
        ignoreCohortFloor,
      });
      const releaseId = res.data.releaseId;
      showSuccessToast(`Release started for ${instituteName || "this school"}.`);
      poll(releaseId);
    } catch (e: any) {
      setReleasing(false);
      showErrorToast(e?.response?.data?.message ?? "Could not start the release.");
    }
  };

  /**
   * Watch a running release.
   *
   * Never returns to the button screen on its own: an admin who has just spent a hundred
   * API calls needs to see how it ended, not a form that looks like nothing happened.
   */
  const poll = useCallback(
    (releaseId: string) => {
      const tick = () => {
        getReleaseStatus(instituteCode, releaseId)
          .then((res) => {
            setProgress(res.data);
            if (res.data.complete) {
              setReleasing(false);
            } else {
              window.setTimeout(tick, 2500);
            }
          })
          .catch(() => {
            setReleasing(false);
          });
      };
      tick();
    },
    [instituteCode]
  );

  if (loading) return <div className="sdr-empty">Working out what a release would do…</div>;
  if (!preview) return <div className="sdr-empty">Could not load a release plan for this school.</div>;
  if (!preview.canRelease) {
    return <div className="sdr-empty">{preview.reason ?? "This school cannot be released yet."}</div>;
  }

  return (
    <div className="sdr-panel">
      {progress && <ProgressBlock progress={progress} running={releasing} />}

      <div className="sdr-modes" role="group" aria-label="What to release">
        {(
          [
            ["ALL", "Everything", "The school, every grade and section, and every group"],
            ["ACADEMIC", "By grade", "A session, grade or section — and everything under it"],
            ["GROUPS", "By group", "Groups only; these cut across grades by design"],
          ] as [ReleaseMode, string, string][]
        ).map(([value, label, hint]) => (
          <button
            key={value}
            type="button"
            className={mode === value ? "is-active" : undefined}
            onClick={() => setMode(value)}
            disabled={releasing}
          >
            <b>{label}</b>
            <span>{hint}</span>
          </button>
        ))}
      </div>

      {mode === "ACADEMIC" && (
        <div className="sdr-narrow">
          {sessions.length > 1 && (
            <Picker
              label="Session"
              value={sessionId}
              onChange={(v) => {
                setSessionId(v);
                setClassId(null);
                setSectionId(null);
              }}
              options={sessions.map((s) => ({ value: s, label: labelFor(scopes, "sessionId", s) }))}
              allLabel="All sessions"
              disabled={releasing}
            />
          )}
          <Picker
            label="Grade"
            value={classId}
            onChange={(v) => {
              setClassId(v);
              setSectionId(null);
            }}
            options={classes.map((c) => ({ value: c, label: `Grade ${c}` }))}
            allLabel="All grades"
            disabled={releasing}
          />
          <Picker
            label="Section"
            value={sectionId}
            onChange={setSectionId}
            options={sections.map((s) => ({
              value: s,
              label: labelFor(scopes, "sectionId", s),
            }))}
            allLabel={classId == null ? "Pick a grade first" : "All sections"}
            disabled={releasing || classId == null}
          />
        </div>
      )}

      {mode === "GROUPS" && (
        <div className="sdr-groups">
          {groups.length === 0 ? (
            <p className="sdr-hint">This school has no groups.</p>
          ) : (
            groups.map((g) => (
              <label key={g.groupId} className="sdr-check">
                <input
                  type="checkbox"
                  checked={groupIds.includes(g.groupId!)}
                  disabled={releasing}
                  onChange={(e) =>
                    setGroupIds((current) =>
                      e.target.checked
                        ? [...current, g.groupId!]
                        : current.filter((id) => id !== g.groupId)
                    )
                  }
                />
                {g.scopeLabel} <span>{g.scoredCount} scored</span>
              </label>
            ))
          )}
        </div>
      )}

      <div className="sdr-plan">
        <div className="sdr-plan-figures">
          <div>
            <b>{selected.length}</b>
            <span>cohorts touched</span>
          </div>
          <div>
            <b>{narrativeCount}</b>
            <span>written up — each is one paid API call</span>
          </div>
        </div>
        <VerdictBreakdown scopes={selected} />
      </div>

      <div className="sdr-options">
        <label className="sdr-check">
          <input
            type="checkbox"
            checked={force}
            disabled={releasing}
            onChange={(e) => setForce(e.target.checked)}
          />
          <span>
            <b>Rewrite what is already current.</b> Without this, a cohort written recently
            is left alone. Rewriting overwrites text the school may already have circulated
            and cannot be undone.
          </span>
        </label>
        <label className="sdr-check">
          <input
            type="checkbox"
            checked={ignoreCohortFloor}
            disabled={releasing}
            onChange={(e) => setIgnoreCohortFloor(e.target.checked)}
          />
          <span>
            <b>Write up cohorts below {preview.configuredMinCohortSize} students.</b> Small
            cohorts are skipped by default: percentages over a handful of students say more
            about the handful, and the writing starts pointing at individuals.
          </span>
        </label>
      </div>

      <button
        type="button"
        className="sdr-run"
        onClick={run}
        disabled={releasing || selected.length === 0}
      >
        {releasing
          ? "Releasing…"
          : `Release ${selected.length} cohort${selected.length === 1 ? "" : "s"}`}
      </button>
    </div>
  );
};

const ProgressBlock = ({
  progress,
  running,
}: {
  progress: ReleaseStatus;
  running: boolean;
}) => {
  const pct = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100);
  return (
    <div className={`sdr-progress${progress.complete ? " is-done" : ""}`}>
      <div className="sdr-progress-head">
        <b>
          {progress.complete ? "Release finished" : "Releasing…"} {progress.done} of{" "}
          {progress.total}
        </b>
        <span>{pct}%</span>
      </div>
      <div className="sdr-progress-track">
        <div className="sdr-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="sdr-progress-counts">
        {Object.entries(progress.byStatus).map(([status, count]) => (
          <span key={status}>
            <b>{count}</b> {status.toLowerCase().replace(/_/g, " ")}
          </span>
        ))}
      </div>
      {progress.failures && progress.failures.length > 0 && (
        <div className="sdr-failures">
          <b>Why scopes failed</b>
          <ul>
            {progress.failures.map((f, i) => (
              <li key={i}>
                <code>{f.scopeKey}</code> {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!running && progress.complete && (
        <p className="sdr-hint">
          The full step-by-step trace is under <b>Activity log</b>.
        </p>
      )}
    </div>
  );
};

const VerdictBreakdown = ({ scopes }: { scopes: ScopePlanItem[] }) => {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    scopes.forEach((s) => map.set(s.verdict, (map.get(s.verdict) ?? 0) + 1));
    // Array.from, not a spread: the project targets es5 without downlevelIteration,
    // so spreading a Map iterator does not compile.
    return Array.from(map.entries());
  }, [scopes]);

  if (counts.length === 0) return null;
  return (
    <ul className="sdr-verdicts">
      {counts.map(([verdict, count]) => (
        <li key={verdict}>
          <b>{count}</b> {VERDICT_WORDS[verdict] ?? verdict.toLowerCase()}
        </li>
      ))}
    </ul>
  );
};

const VERDICT_WORDS: Record<string, string> = {
  NEW: "never generated",
  RETRY: "failed last time",
  REFRESH: "will be rewritten",
  NOW_ELIGIBLE: "now big enough to write up",
  UNCHANGED: "already current — left alone",
  SKIPPED_SMALL_COHORT: "too small to write up",
  EMPTY: "no students",
};

// ───────────────────────────── what is live ─────────────────────────────

/**
 * What the school can currently see, and the control to take it away.
 *
 * Withdrawing flips a flag rather than deleting: the principal is gated immediately, but
 * the figures and the paid narrative survive, so putting it back is instant and free.
 */
const PublishedPanel = ({
  instituteCode,
  assessmentId,
}: {
  instituteCode: number;
  assessmentId: number;
}) => {
  const [scopes, setScopes] = useState<AdminScope[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getAdminScopes(instituteCode, assessmentId)
      .then((res) => setScopes(res.data))
      .catch(() => setScopes([]))
      .finally(() => setLoading(false));
  }, [instituteCode, assessmentId]);

  useEffect(load, [load]);

  const toggle = async (published: boolean, scopeKey?: string) => {
    setBusy(scopeKey ?? "ALL");
    try {
      await setPublished(instituteCode, assessmentId, published, scopeKey);
      showSuccessToast(
        published
          ? "Back on the school's dashboard."
          : "Withdrawn. The school now sees the not-generated message."
      );
      load();
    } catch {
      showErrorToast("Could not change what is published.");
    } finally {
      setBusy(null);
    }
  };

  const live = scopes.filter((s) => s.published).length;

  if (loading) return <div className="sdr-empty">Loading…</div>;
  if (scopes.length === 0) {
    return <div className="sdr-empty">Nothing has been generated for this assessment yet.</div>;
  }

  return (
    <div className="sdr-panel">
      <div className="sdr-live-head">
        <div>
          <b>
            {live} of {scopes.length} cohorts are live
          </b>
          <span>
            Withdrawing keeps the figures and the written analysis — putting it back costs
            nothing.
          </span>
        </div>
        <div className="sdr-live-actions">
          <button type="button" onClick={() => toggle(false)} disabled={busy != null || live === 0}>
            Withdraw all
          </button>
          <button
            type="button"
            onClick={() => toggle(true)}
            disabled={busy != null || live === scopes.length}
          >
            Republish all
          </button>
        </div>
      </div>

      <div className="sdr-table-wrap">
        <table className="sdr-table">
          <thead>
            <tr>
              <th>Cohort</th>
              <th>Level</th>
              <th className="num">Students</th>
              <th>Status</th>
              <th>Generated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {scopes.map((s) => (
              <tr key={s.scopeKey} className={s.published ? undefined : "is-withdrawn"}>
                <td>{s.scopeLabel || s.scopeKey}</td>
                <td className="muted">{s.scopeLevel.toLowerCase()}</td>
                <td className="num">{s.studentCount ?? "—"}</td>
                <td>
                  <StatusPill scope={s} />
                </td>
                <td className="muted">
                  {s.generatedAt ? new Date(s.generatedAt).toLocaleDateString() : "—"}
                </td>
                <td className="right">
                  <button
                    type="button"
                    className="sdr-link"
                    disabled={busy != null}
                    onClick={() => toggle(!s.published, s.scopeKey)}
                  >
                    {s.published ? "Withdraw" : "Republish"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatusPill = ({ scope }: { scope: AdminScope }) => {
  if (!scope.published) return <span className="sdr-pill sdr-pill--off">Withdrawn</span>;
  if (scope.status === "FAILED") {
    return (
      <span className="sdr-pill sdr-pill--bad" title={scope.error ?? undefined}>
        Failed
      </span>
    );
  }
  if (scope.status === "SKIPPED_SMALL_COHORT") {
    return <span className="sdr-pill sdr-pill--warn">Figures only</span>;
  }
  if (scope.status === "GENERATED") {
    return <span className="sdr-pill sdr-pill--good">Live</span>;
  }
  return <span className="sdr-pill">{scope.status.toLowerCase().replace(/_/g, " ")}</span>;
};

// ───────────────────────────── activity log ─────────────────────────────

/**
 * Where a release got to, step by step, and why it stopped.
 *
 * A run walks many cohorts off-thread and each goes through several stages. The status on
 * a cohort says where it ended; this says how it got there — and for a failure, carries
 * the actual reason rather than a count.
 */
const LogPanel = ({ instituteCode }: { instituteCode: number }) => {
  const [runs, setRuns] = useState<ReleaseRun[]>([]);
  const [releaseId, setReleaseId] = useState<string>("");
  const [entries, setEntries] = useState<ReleaseLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [failuresOnly, setFailuresOnly] = useState(false);

  useEffect(() => {
    getReleaseRuns(instituteCode)
      .then((res) => setRuns(res.data))
      .catch(() => setRuns([]));
  }, [instituteCode]);

  const load = useCallback(() => {
    setLoading(true);
    getReleaseLog(instituteCode, releaseId || undefined)
      .then((res) => setEntries(res.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [instituteCode, releaseId]);

  useEffect(load, [load]);

  const shown = failuresOnly ? entries.filter((e) => e.outcome === "FAILED") : entries;

  return (
    <div className="sdr-panel">
      <div className="sdr-log-controls">
        <label className="sdr-field">
          <span>Run</span>
          <select value={releaseId} onChange={(e) => setReleaseId(e.target.value)}>
            <option value="">Everything recent</option>
            {runs.map((r) => (
              <option key={r.releaseId} value={r.releaseId}>
                {new Date(r.startedAt).toLocaleString()} — {r.entries} steps
              </option>
            ))}
          </select>
        </label>
        <label className="sdr-check inline">
          <input
            type="checkbox"
            checked={failuresOnly}
            onChange={(e) => setFailuresOnly(e.target.checked)}
          />
          <span>Failures only</span>
        </label>
        <button type="button" className="sdr-link" onClick={load}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="sdr-empty">Loading…</div>
      ) : shown.length === 0 ? (
        <div className="sdr-empty">
          {failuresOnly ? "No failures recorded." : "Nothing logged for this school yet."}
        </div>
      ) : (
        <ol className="sdr-log">
          {shown.map((entry) => (
            <li key={entry.id} className={`sdr-log-${entry.outcome.toLowerCase()}`}>
              <time>{new Date(entry.createdAt).toLocaleTimeString()}</time>
              <span className="sdr-log-step">{STEP_WORDS[entry.step] ?? entry.step}</span>
              <span className="sdr-log-scope">{entry.scopeLabel || entry.scopeKey || "—"}</span>
              <span className="sdr-log-msg">{entry.message}</span>
              <span className="sdr-log-ms">
                {entry.durationMs == null ? "" : formatMs(entry.durationMs)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

const STEP_WORDS: Record<string, string> = {
  RELEASE_STARTED: "Started",
  PLANNED: "Planned",
  SNAPSHOT: "Scored roster",
  METRICS: "Figures",
  AI_REQUEST: "Sent to AI",
  AI_RESPONSE: "AI replied",
  SAVED: "Saved",
  SKIPPED: "Skipped",
  FAILED: "Failed",
  RELEASE_FINISHED: "Finished",
  UNPUBLISHED: "Withdrawn",
  REPUBLISHED: "Republished",
  EMAILED: "Emailed",
};

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// ───────────────────────────── notify ─────────────────────────────

/**
 * Tell the school its dashboard is live.
 *
 * Sent by hand, to chosen people. A release may be re-run several times while an admin
 * gets a school's data right, and mailing the principal on each of those would teach them
 * to ignore the mail.
 */
const NotifyPanel = ({
  instituteCode,
  instituteName,
  assessmentName,
}: {
  instituteCode: number;
  instituteName: string;
  assessmentName: string;
}) => {
  const [contacts, setContacts] = useState<ContactRecipient[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [outcomes, setOutcomes] = useState<NotifyOutcome[] | null>(null);

  useEffect(() => {
    setLoading(true);
    setOutcomes(null);
    setSelected([]);
    getContacts(instituteCode)
      .then((res) => setContacts(res.data))
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, [instituteCode]);

  const send = async () => {
    setSending(true);
    try {
      const res = await notifyContacts(instituteCode, selected, instituteName, assessmentName);
      setOutcomes(res.data);
      const sent = res.data.filter((o) => o.sent).length;
      if (sent === res.data.length) {
        showSuccessToast(`Emailed ${sent} contact${sent === 1 ? "" : "s"}.`);
      } else {
        showErrorToast(`${sent} of ${res.data.length} emails went out.`);
      }
    } catch {
      showErrorToast("Could not send the emails.");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="sdr-empty">Loading contacts…</div>;
  if (contacts.length === 0) {
    return (
      <div className="sdr-empty">
        No contact persons are on file for this school. Add one on the institute's detail
        page before sending.
      </div>
    );
  }

  return (
    <div className="sdr-panel">
      <p className="sdr-hint">
        Sends an email explaining what the dashboard is, how to open it, and who to contact
        if something looks wrong.
      </p>

      <div className="sdr-contacts">
        {contacts.map((c) => (
          <label
            key={c.id}
            className={`sdr-check${c.emailable ? "" : " is-disabled"}`}
            title={c.emailable ? undefined : "No email address on file"}
          >
            <input
              type="checkbox"
              disabled={!c.emailable || sending}
              checked={selected.includes(c.id)}
              onChange={(e) =>
                setSelected((current) =>
                  e.target.checked ? [...current, c.id] : current.filter((id) => id !== c.id)
                )
              }
            />
            <span>
              <b>{c.name || "Unnamed contact"}</b>
              {c.designation && <em>{c.designation}</em>}
              <small>{c.email || "No email address"}</small>
            </span>
          </label>
        ))}
      </div>

      <button
        type="button"
        className="sdr-run"
        onClick={send}
        disabled={sending || selected.length === 0}
      >
        {sending
          ? "Sending…"
          : `Send to ${selected.length} contact${selected.length === 1 ? "" : "s"}`}
      </button>

      {outcomes && (
        <ul className="sdr-outcomes">
          {outcomes.map((o) => (
            <li key={o.contactPersonId} className={o.sent ? "is-ok" : "is-bad"}>
              <b>{o.name || o.email}</b>
              {o.sent ? " — sent" : ` — failed: ${o.error ?? "unknown error"}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ───────────────────────────── helpers ─────────────────────────────

const Picker = ({
  label,
  value,
  onChange,
  options,
  allLabel,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  options: { value: number; label: string }[];
  allLabel: string;
  disabled?: boolean;
}) => (
  <label className="sdr-field">
    <span>{label}</span>
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

/** The distinct non-null values of one dimension across a plan, in order. */
function distinct(scopes: ScopePlanItem[], key: keyof ScopePlanItem): number[] {
  const seen = new Set<number>();
  scopes.forEach((s) => {
    const value = s[key];
    if (typeof value === "number") seen.add(value);
  });
  return Array.from(seen).sort((a, b) => a - b);
}

/** A scope whose session matches, treating "no session bound" as matching everything. */
function matchSession(scope: ScopePlanItem, sessionId: number | null): boolean {
  return sessionId == null || scope.sessionId === sessionId;
}

/** The label the backend resolved for a dimension value, so sections read as names. */
function labelFor(
  scopes: ScopePlanItem[],
  key: "sessionId" | "sectionId",
  value: number
): string {
  const found = scopes.find((s) => s[key] === value && s.scopeLabel);
  return found?.scopeLabel ?? String(value);
}

export default SchoolDashboardReleasePage;
