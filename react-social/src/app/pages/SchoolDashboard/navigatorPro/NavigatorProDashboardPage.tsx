import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../modules/auth";
import { useInstitutes } from "../../../lib/queries/lookups";
import { showErrorToast } from "../../../utils/toast";
import {
  getReleasedScopes,
  getScope,
  ScopeParams,
  ScopeSummary,
  ScopeView,
} from "../PrincipalDashboardRelease_APIs";
import { getLatestProRelease, getScopeStudentNames } from "./NavigatorProDashboard_APIs";
import {
  PageId,
  PageNarrative,
  ProNarrative,
  ProPayload,
  parseJson,
  parseProPayload,
} from "./navigatorProTypes";
import {
  ActionBox,
  BarRow,
  Card,
  Commentary,
  Emph,
  Empty,
  Kpi,
  OwnerTag,
  PageFooter,
  PageHead,
  ZONE_COLOURS,
  ZONE_ORDER,
  ZONE_SHORT,
} from "./ProWidgets";
import WillSkillMap from "./WillSkillMap";
import StudentList, { StudentDrawer } from "./StudentList";
import "./NavigatorProDashboard.css";

/**
 * The Navigator Pro college dashboard.
 *
 * Built on the Navigator 360 School Dashboard's visual system — the same header card,
 * filter rail and tokens — and laid out as one detailed page per question, chosen from a
 * section menu on the left. The page spans the full width of the content area.
 *
 * Every figure comes from the stored release (`internal_calculation`); every paragraph
 * from its stored narrative (`ai_response`). Nothing is computed on view, so the numbers
 * a principal reads are the numbers the narrative was written against.
 */

type Tab =
  | "exec"
  | "board"
  | "measure"
  | "map"
  | "will"
  | "personality"
  | "improvement"
  | "directions"
  | "industry"
  | "values"
  | "students"
  | "queue";

const MENU: { group: string; items: { id: Tab; label: string }[] }[] = [
  {
    group: "Overview",
    items: [
      { id: "exec", label: "Executive summary" },
      { id: "board", label: "Board brief" },
      { id: "measure", label: "What we measure" },
    ],
  },
  {
    group: "The batch",
    items: [
      { id: "map", label: "Will vs Skill map" },
      { id: "will", label: "What drives the batch" },
      { id: "personality", label: "What kind of batch" },
      { id: "improvement", label: "Areas of improvement" },
    ],
  },
  {
    group: "Direction & placement",
    items: [
      { id: "directions", label: "Where students want to go" },
      { id: "industry", label: "Industry & internship plan" },
      { id: "values", label: "What the batch wants" },
    ],
  },
  {
    group: "People",
    items: [
      { id: "students", label: "Student list" },
      { id: "queue", label: "Who needs a person first" },
    ],
  },
];

type AccessScope = { i?: number | null };
type Filter = number | "All";
type Option = { id: number; label: string };

/** One option per released id, in release order. */
function options(scopes: ScopeSummary[], id: (s: ScopeSummary) => number | null): Option[] {
  const seen = new Set<number>();
  const out: Option[] = [];
  scopes.forEach((s) => {
    const v = id(s);
    if (v == null || seen.has(v)) return;
    seen.add(v);
    out.push({ id: v, label: s.scopeLabel || String(v) });
  });
  return out;
}

const zoneVar = (z: string) => ({ "--zc": ZONE_COLOURS[z as keyof typeof ZONE_COLOURS] } as React.CSSProperties);

const NavigatorProDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.superAdmin === true;
  const userScopes: AccessScope[] = useMemo(() => (currentUser as any)?.scopes ?? [], [currentUser]);

  const allowedInstituteIds = useMemo<Set<number> | null>(() => {
    if (isSuperAdmin || !userScopes.length || userScopes.some((s) => s.i == null)) return null;
    return new Set(userScopes.map((s) => s.i!).filter((v) => v != null));
  }, [isSuperAdmin, userScopes]);

  const { data: allInstitutes = [], isLoading: institutesLoading } = useInstitutes<any>();
  const institutes = useMemo(
    () =>
      allowedInstituteIds == null
        ? allInstitutes
        : allInstitutes.filter((i: any) => allowedInstituteIds.has(Number(i.instituteCode))),
    [allInstitutes, allowedInstituteIds]
  );

  const [instituteCode, setInstituteCode] = useState<number | null>(null);
  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [scopes, setScopes] = useState<ScopeSummary[]>([]);
  const [row, setRow] = useState<ScopeView | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("exec");
  const [names, setNames] = useState<Map<number, string>>(new Map());
  const [namesLoading, setNamesLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const [sessionF, setSessionF] = useState<Filter>("All");
  const [classF, setClassF] = useState<Filter>("All");
  const [sectionF, setSectionF] = useState<Filter>("All");
  const [groupF, setGroupF] = useState<Filter>("All");

  // Full width, exactly as the Navigator 360 School Dashboard: opt out of Metronic's
  // fixed .container while mounted (.sd-fluid is defined in SchoolDashboard.css).
  useEffect(() => {
    const container = document.getElementById("kt_content_container");
    container?.classList.add("sd-fluid");
    return () => container?.classList.remove("sd-fluid");
  }, []);

  useEffect(() => {
    if (institutes.length === 1 && instituteCode == null) {
      setInstituteCode(Number(institutes[0].instituteCode));
    }
  }, [institutes, instituteCode]);

  // Entry point: the college's current Navigator Pro release, which also names the
  // assessment every other lookup needs.
  useEffect(() => {
    setRow(null);
    setAssessmentId(null);
    setScopes([]);
    setSessionF("All");
    setClassF("All");
    setSectionF("All");
    setGroupF("All");
    if (instituteCode == null) return;
    let cancelled = false;
    setLoading(true);
    getLatestProRelease(instituteCode)
      .then((res) => {
        if (cancelled) return;
        setRow(res.data);
        setAssessmentId(res.data.assessmentId ?? null);
      })
      .catch((err: any) => {
        if (!cancelled) {
          showErrorToast("Could not load the dashboard: " + (err?.response?.data?.error || err.message));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [instituteCode]);

  // Which cohorts were released — the rail offers only these.
  useEffect(() => {
    if (instituteCode == null || assessmentId == null) return;
    let cancelled = false;
    getReleasedScopes(instituteCode, assessmentId)
      .then((res) => {
        if (cancelled) return;
        setScopes(
          (res.data ?? []).filter((s) => s.status === "GENERATED" || s.status === "SKIPPED_SMALL_COHORT")
        );
      })
      .catch(() => {
        if (!cancelled) setScopes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [instituteCode, assessmentId]);

  const scopeParams: ScopeParams | null = useMemo(() => {
    if (instituteCode == null || assessmentId == null) return null;
    const academic = groupF === "All";
    return {
      instituteCode,
      assessmentId,
      sessionId: academic && sessionF !== "All" ? sessionF : null,
      classId: academic && classF !== "All" ? classF : null,
      sectionId: academic && sectionF !== "All" ? sectionF : null,
      groupId: academic ? null : (groupF as number),
    };
  }, [instituteCode, assessmentId, sessionF, classF, sectionF, groupF]);

  const isWholeCollege = sessionF === "All" && classF === "All" && sectionF === "All" && groupF === "All";

  // Narrowing the rail swaps to that cohort's stored row. Nothing is computed — a cohort
  // that was never released says so rather than being invented.
  useEffect(() => {
    if (!scopeParams) return;
    let cancelled = false;
    setLoading(true);
    getScope(scopeParams.instituteCode!, {
      assessmentId: scopeParams.assessmentId!,
      sessionId: scopeParams.sessionId,
      classId: scopeParams.classId,
      sectionId: scopeParams.sectionId,
      groupId: scopeParams.groupId,
    })
      .then((res) => !cancelled && setRow(res.data))
      .catch(() => !cancelled && showErrorToast("Could not load that cohort."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeParams]);

  const reset = () => {
    setSessionF("All");
    setClassF("All");
    setSectionF("All");
    setGroupF("All");
  };

  // Rail options, from released scopes only.
  const sessionOptions = useMemo(
    () => options(scopes.filter((s) => s.scopeLevel === "SESSION"), (s) => s.sessionId),
    [scopes]
  );
  const classOptions = useMemo(
    () =>
      options(
        scopes.filter(
          (s) => s.scopeLevel === "CLASS" && (sessionF === "All" || s.sessionId === sessionF)
        ),
        (s) => s.classId
      ),
    [scopes, sessionF]
  );
  const sectionOptions = useMemo(
    () =>
      classF === "All"
        ? []
        : options(
            scopes.filter((s) => s.scopeLevel === "SECTION" && s.classId === classF),
            (s) => s.sectionId
          ),
    [scopes, classF]
  );
  const groupOptions = useMemo(
    () => options(scopes.filter((s) => s.scopeLevel === "GROUP"), (s) => s.groupId),
    [scopes]
  );

  const payload: ProPayload | null = useMemo(
    () => (row?.released ? parseProPayload(row.internalCalculation) : null),
    [row]
  );
  const narrative: ProNarrative | null = useMemo(
    () => (row?.released ? parseJson<ProNarrative>(row.aiResponse) : null),
    [row]
  );
  const notes = useMemo(() => {
    const m = new Map<PageId, PageNarrative>();
    narrative?.pages?.forEach((p) => m.set(p.page_id, p));
    return m;
  }, [narrative]);

  // Names, once per loaded cohort.
  useEffect(() => {
    if (!payload || !scopeParams) {
      setNames(new Map());
      return;
    }
    let cancelled = false;
    setNamesLoading(true);
    getScopeStudentNames(scopeParams)
      .then((res) => {
        if (cancelled) return;
        const m = new Map<number, string>();
        (res.data ?? []).forEach((s) => m.set(s.userStudentId, s.name));
        setNames(m);
      })
      .catch(() => !cancelled && setNames(new Map()))
      .finally(() => !cancelled && setNamesLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  const goTo = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const instituteName =
    payload?.institute?.name ||
    institutes.find((i: any) => Number(i.instituteCode) === instituteCode)?.instituteName ||
    "College Dashboard";

  const footer = payload
    ? `${payload.scope.label} · ${payload.overview.delivered} delivered reports of ${payload.overview.assessed} assessed · ` +
      `medians Will ${payload.norms.willMedian} · Skill ${payload.norms.skillMedian}` +
      `${payload.norms.provisional ? " (provisional)" : ""} · ${instituteName} × Career-9`
    : "";

  const selectedRow = payload?.students.find((s) => s.id === selected) ?? null;
  const selectedItem = payload?.attention.items.find((i) => i.id === selected);
  const zoneLabel = (key?: string) => payload?.zones.counts.find((c) => c.key === key)?.label ?? "";
  const closeDrawer = useCallback(() => setSelected(null), []);

  // ─────────────────────────── render ───────────────────────────

  const header = (
    <header className="npd-hd">
      <div className="npd-hd-top">
        <div>
          <p className="npd-eyebrow">
            Navigator Pro
            {payload?.scope.sessionLabel ? ` · ${payload.scope.sessionLabel}` : ""}
            {payload ? ` · ${payload.assessment.name}` : ""}
          </p>
          <h1 className="npd-title">{instituteName}</h1>
          <p className="npd-subtitle">
            What this reading measured in your students, what it tells you, and which students
            need someone this week.
          </p>
        </div>
        <div className="npd-hd-side">
          <div className="npd-field">
            <label htmlFor="npd-college">College</label>
            <select
              id="npd-college"
              value={instituteCode ?? ""}
              onChange={(e) => setInstituteCode(e.target.value === "" ? null : Number(e.target.value))}
              disabled={institutesLoading || institutes.length === 1}
            >
              <option value="">{institutesLoading ? "Loading colleges…" : "Select a college"}</option>
              {institutes.map((i: any) => (
                <option key={i.instituteCode} value={i.instituteCode}>
                  {i.instituteName}
                </option>
              ))}
            </select>
          </div>
          {payload && (
            <>
              <button type="button" className="npd-btn" onClick={() => goTo("students")}>
                Student list
              </button>
              <button type="button" className="npd-btn npd-btn--primary" onClick={() => window.print()}>
                Print board pack
              </button>
            </>
          )}
        </div>
      </div>

      {assessmentId != null && (
        <div className="npd-rail">
          {sessionOptions.length > 0 && (
            <div className="npd-field">
              <label htmlFor="npd-f-session">Session</label>
              <select
                id="npd-f-session"
                value={sessionF}
                disabled={groupF !== "All"}
                onChange={(e) => {
                  setSessionF(e.target.value === "All" ? "All" : Number(e.target.value));
                  setClassF("All");
                  setSectionF("All");
                }}
              >
                <option value="All">All sessions</option>
                {sessionOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="npd-field">
            <label htmlFor="npd-f-class">Year / class</label>
            <select
              id="npd-f-class"
              value={classF}
              disabled={groupF !== "All" || classOptions.length === 0}
              onChange={(e) => {
                setClassF(e.target.value === "All" ? "All" : Number(e.target.value));
                setSectionF("All");
              }}
            >
              <option value="All">{classOptions.length === 0 ? "No years released" : "All years"}</option>
              {classOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="npd-field">
            <label htmlFor="npd-f-section">Section / branch</label>
            <select
              id="npd-f-section"
              value={sectionF}
              disabled={groupF !== "All" || classF === "All" || sectionOptions.length === 0}
              onChange={(e) => setSectionF(e.target.value === "All" ? "All" : Number(e.target.value))}
            >
              <option value="All">
                {classF === "All"
                  ? "Pick a year first"
                  : sectionOptions.length === 0
                  ? "No sections released"
                  : "All sections"}
              </option>
              {sectionOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="npd-field">
            <label htmlFor="npd-f-group">Group</label>
            <select
              id="npd-f-group"
              value={groupF}
              disabled={groupOptions.length === 0}
              onChange={(e) => {
                // A group cuts across years and sections, so it clears them.
                setGroupF(e.target.value === "All" ? "All" : Number(e.target.value));
                setSessionF("All");
                setClassF("All");
                setSectionF("All");
              }}
            >
              <option value="All">{groupOptions.length === 0 ? "No groups released" : "All groups"}</option>
              {groupOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="npd-rail-end">
            <div className="npd-inview">
              <b>{payload ? payload.overview.assessed : "—"}</b>
              <span>in view</span>
            </div>
            <button type="button" className="npd-btn" onClick={reset} disabled={isWholeCollege}>
              Reset
            </button>
          </div>
        </div>
      )}

      {payload && row && (
        <div className="npd-status">
          {row.generatedAt && (
            <span>
              Generated{" "}
              <b>{new Date(row.generatedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</b>
            </span>
          )}
          <span>
            <b>
              {payload.overview.delivered} of {payload.overview.assessed}
            </b>{" "}
            reports delivered
          </span>
          <span>
            Cut-lines{" "}
            <b>
              Will {payload.norms.willMedian} · Skill {payload.norms.skillMedian}
            </b>
          </span>
          {payload.norms.provisional && (
            <span className="npd-pill npd-pill--warn">
              Provisional cut-lines — fewer than 60 students in the assessment
            </span>
          )}
          {row.stale && (
            <span className="npd-pill npd-pill--crit">
              {row.newStudentsSinceGeneration} more students finished since this was generated
            </span>
          )}
        </div>
      )}
    </header>
  );

  let body: React.ReactNode;
  if (instituteCode == null) {
    body = <Empty title="Pick a college to begin">Its Navigator Pro dashboard loads here.</Empty>;
  } else if (loading && !payload) {
    body = <Empty title="Loading the dashboard…">Reading the analysis Career-9 generated for this college.</Empty>;
  } else if (!row || !row.released) {
    body = (
      <Empty title="Dashboard is not generated yet">
        Please contact your administrator / Career-9 team.
        {!isWholeCollege && (
          <div className="npd-muted" style={{ marginTop: 10 }}>
            This applies to the selection above — other views of this college may already be generated.
          </div>
        )}
      </Empty>
    );
  } else if (!payload) {
    body = (
      <Empty title="This release is not a Navigator Pro dashboard">
        Open the School Dashboard for Navigator 360 results.
      </Empty>
    );
  } else if (payload.overview.evaluated === 0) {
    body = (
      <Empty title="No completed readings in this cohort yet">
        {payload.participation.total} students are mapped; results appear once they submit.
      </Empty>
    );
  } else {
    const p = payload;
    const pageProps = { p, notes, footer };
    body = (
      <div className="npd-body">
        <nav className="npd-menu" aria-label="Dashboard sections">
          {MENU.map((g) => (
            <React.Fragment key={g.group}>
              <div className="npd-menu-group">{g.group}</div>
              {g.items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={`npd-mi${tab === it.id ? " is-active" : ""}`}
                  onClick={() => goTo(it.id)}
                  aria-current={tab === it.id ? "page" : undefined}
                >
                  <span>{it.label}</span>
                  {it.id === "queue" && p.attention.p1 > 0 ? (
                    <span className="npd-mi-count">{p.attention.p1}</span>
                  ) : it.id === "students" ? (
                    <span className="npd-mi-meta">{p.overview.evaluated}</span>
                  ) : it.id === "directions" ? (
                    <span className="npd-mi-meta">12 fields</span>
                  ) : null}
                </button>
              ))}
            </React.Fragment>
          ))}
          <div className="npd-menu-foot">
            Best-fit recipe: {p.directions.recipe}. Guidance data — never a selection tool.
          </div>
        </nav>

        <main className="npd-main">
          <Page on={tab === "exec"}>
            <ExecPage {...pageProps} n={narrative} goTo={goTo} />
          </Page>
          <Page on={tab === "board"}>
            <BoardPage {...pageProps} n={narrative} />
          </Page>
          <Page on={tab === "measure"}>
            <MeasurePage {...pageProps} n={narrative} />
          </Page>
          <Page on={tab === "map"}>
            <PageHead
              group="The batch"
              title="Will vs Skill — the batch map"
              lede="Every student on one picture: how driven they are (up) against how much they can already do (right)."
              how="Dots right of the dashed line have more skill than the batch median; dots above it have more drive. Hover for a name, click for the full profile, click a zone to hide or show it."
            />
            <Card>
              <WillSkillMap
                points={p.zones.points}
                counts={p.zones.counts}
                willMedian={p.norms.willMedian}
                skillMedian={p.norms.skillMedian}
                names={names}
                onSelect={setSelected}
              />
            </Card>
            <ZoneTable p={p} />
            <ActionBox actions={p.actions.map} />
            <Commentary page={notes.get("map")} />
            <PageFooter text={footer} />
          </Page>
          <Page on={tab === "will"}>
            <WillPage {...pageProps} />
          </Page>
          <Page on={tab === "personality"}>
            <PersonalityPage {...pageProps} />
          </Page>
          <Page on={tab === "improvement"}>
            <ImprovementPage {...pageProps} />
          </Page>
          <Page on={tab === "directions"}>
            <DirectionsPage {...pageProps} />
          </Page>
          <Page on={tab === "industry"}>
            <IndustryPage {...pageProps} />
          </Page>
          <Page on={tab === "values"}>
            <ValuesPage {...pageProps} />
          </Page>
          <Page on={tab === "students"}>
            <PageHead
              group="People"
              title="Student list"
              lede="Everyone evaluated in this cohort. For planning — never for ranking."
            />
            <Card>
              <StudentList
                students={p.students}
                zones={p.zones.counts}
                names={names}
                namesLoading={namesLoading}
                onSelect={setSelected}
                fileLabel={`${instituteName} - ${p.scope.label}`}
              />
            </Card>
            <PageFooter text={footer} />
          </Page>
          <Page on={tab === "queue"}>
            <QueuePage {...pageProps} names={names} onSelect={setSelected} />
          </Page>
        </main>
      </div>
    );
  }

  return (
    <div className="npd">
      {header}
      {body}
      <StudentDrawer
        student={selectedRow}
        item={selectedItem}
        name={selected == null ? "" : names.get(selected) ?? `Student ${selected}`}
        zoneLabel={zoneLabel(selectedRow?.zone)}
        onClose={closeDrawer}
      />
    </div>
  );
};

export default NavigatorProDashboardPage;

// ───────────────────────────── pages ─────────────────────────────

interface PageProps {
  p: ProPayload;
  notes: Map<PageId, PageNarrative>;
  footer: string;
}

const Page: React.FC<{ on: boolean; children?: React.ReactNode }> = ({ on, children }) => (
  <section className={`npd-page${on ? " is-active" : ""}`}>{children}</section>
);

const ZoneTiles: React.FC<{ p: ProPayload }> = ({ p }) => (
  <div className="npd-zones">
    {ZONE_ORDER.map((z) => {
      const c = p.zones.counts.find((x) => x.key === z);
      return (
        <div key={z} className="npd-zone" style={zoneVar(z)}>
          <div className="npd-zone-n">
            {c?.count ?? 0}
            <small>{c?.pct ?? 0}%</small>
          </div>
          <div className="npd-zone-l">{c?.label ?? z}</div>
          <div className="npd-zone-d">{ZONE_SHORT[z]}</div>
          {c?.todo && (
            <div className="npd-zone-do">
              <b>Next:</b> {c.todo}
            </div>
          )}
        </div>
      );
    })}
  </div>
);

const Headline: React.FC<{ tag: string; text?: string }> = ({ tag, text }) =>
  text ? (
    <div className="npd-headline">
      <span className="npd-headline-tag">{tag}</span>
      <p>
        <Emph text={text} />
      </p>
    </div>
  ) : null;

const ExecPage: React.FC<PageProps & { n: ProNarrative | null; goTo: (t: Tab) => void }> = ({
  p,
  n,
  notes,
  footer,
  goTo,
}) => {
  const o = p.overview;
  const topFields = p.directions.fields.filter((f) => f.bestFit > 0).slice(0, 5);
  const maxField = Math.max(1, ...topFields.map((f) => f.bestFit));
  return (
    <>
      <PageHead
        group="Overview"
        title="Executive summary"
        lede="One reading of this cohort — what it found, and the decisions it points to."
      />
      <Headline tag="The one thing" text={n?.headline} />
      <div className="npd-kpis">
        <Kpi label="Students assessed" value={o.assessed} sub={`${o.completedPct}% of ${o.mapped} mapped`} />
        <Kpi
          label="Reports delivered"
          value={o.delivered}
          sub={o.held ? `${o.held} held for a counsellor` : "none held"}
          accent="var(--status-good-ink)"
        />
        <Kpi label="Flagged for review" value={o.flagged} sub="delivered with a notice" accent="var(--status-warning-ink)" />
        <Kpi
          label="Need a person"
          value={o.needAttention}
          sub={`${o.needPersonFirst} priority 1 · ~${p.attention.hoursEstimate} counsellor hours`}
          accent="var(--status-critical-ink)"
        />
      </div>
      <Card
        title="Where the batch stands"
        aside="Will × Acquired skill, split at the batch medians"
        sub="Every delivered report lands in one of four zones. The zone decides which programme a student belongs in this semester."
      >
        <ZoneTiles p={p} />
      </Card>
      <div className="npd-grid2">
        <Card title="Batch at a glance" sub="Averages out of 100 unless marked.">
          <div className="npd-bars">
            <BarRow label="Will (drive)" value={p.will.avgWill} />
            <BarRow label="Acquired skill" value={p.will.avgSkill} />
            <BarRow label="Everyday habits" value={p.will.avgFoundation} />
            <BarRow label="Everyday logic" value={p.improvement.avgReasoning * 20} display={`${p.improvement.avgReasoning}/5`} />
          </div>
        </Card>
        <Card title="Top fields by best fit" sub="Where electives, labs and company invites will meet demand.">
          <div className="npd-bars">
            {topFields.map((f) => (
              <BarRow key={f.key} label={f.label} value={f.bestFit} max={maxField} colour={ZONE_COLOURS.motivated} />
            ))}
          </div>
          <p className="npd-card-s npd-card-s--end">
            <button type="button" className="npd-btn" onClick={() => goTo("directions")}>
              See all twelve fields
            </button>
          </p>
        </Card>
      </div>
      <ActionBox actions={p.actions.exec} title="Decisions this page points to" />
      <Commentary page={notes.get("exec")} />
      <PageFooter text={footer} />
    </>
  );
};

const BoardPage: React.FC<PageProps & { n: ProNarrative | null }> = ({ p, n, footer }) => {
  const b = n?.board_summary;
  return (
    <>
      <PageHead
        group="Overview"
        title="Board brief"
        lede="A one-page summary for the governing board: what we measured, what it shows, what we ask for. Prints as the first page of the board pack."
      />
      <Headline tag="For the board" text={n?.headline} />
      <Card title="Where the batch stands">
        <ZoneTiles p={p} />
      </Card>
      {!b ? (
        <Empty title="No written brief for this cohort">
          This cohort is below the size Career-9 writes a narrative for. The figures on every page still apply.
        </Empty>
      ) : (
        <>
          <Card className="npd-prose">
            {b.paragraphs.map((t, i) => (
              <p key={i}>
                <Emph text={t} />
              </p>
            ))}
          </Card>
          <div className="npd-brief">
            <BriefList title="Strengths" items={b.strengths} tone="good" />
            <BriefList title="Risks" items={b.risks} tone="risk" />
            <BriefList title="What we ask the board" items={b.asks} tone="ask" />
          </div>
        </>
      )}
      <PageFooter text={footer} />
    </>
  );
};

const BriefList: React.FC<{ title: string; items: string[]; tone: string }> = ({ title, items, tone }) => (
  <div className={`npd-bl npd-bl--${tone}`}>
    <h4>{title}</h4>
    <ul>
      {items.map((t, i) => (
        <li key={i}>
          <Emph text={t} />
        </li>
      ))}
    </ul>
  </div>
);

/** For faculty and board members: every measure, what it tells you and what it does not. */
const MEASURES: { name: string; scale: string; what: string; tells: string; not: string; where: string }[] = [
  {
    name: "Will (drive)",
    scale: "0–100 · three parts",
    what: "How driven a student is right now: Self-Motivation (starting without being pushed), Consistency (staying power when work gets long) and Adaptability (adjusting and still finishing).",
    tells: "Who will act on an opportunity, and which part of drive is missing when they don't.",
    not: "Ability or intelligence. Drive changes with circumstances — a low score today is a starting point.",
    where: "Will vs Skill map · What drives the batch",
  },
  {
    name: "Acquired skill",
    scale: "0–100 · twelve fields",
    what: "How much hands-on exposure a student already has across twelve engineering and technology fields.",
    tells: "Who can be pushed into internships and competitions now, and which fields have a ready pool.",
    not: "Aptitude for a field. Low exposure usually means no opportunity yet, not no talent.",
    where: "Will vs Skill map · Industry plan",
  },
  {
    name: "Everyday habits",
    scale: "0–100 · five habits",
    what: "Numbers & data, Digital & information, Thinking & problem-solving, Creating & improving, Finishing what you start.",
    tells: "Which habit a class-level programme should target — the weakest bars are the cheapest wins.",
    not: "Marks or grades. These are self-reported habits.",
    where: "Areas of improvement",
  },
  {
    name: "Everyday logic",
    scale: "Score out of 5",
    what: "Five short applied checks — numeracy, data reading, causal reasoning, source judgment, spreadsheet logic.",
    tells: "Which practical skill most students got wrong, so one targeted lab fixes it for many.",
    not: "An IQ score. One question per skill — read the batch pattern, not one student's number.",
    where: "Areas of improvement",
  },
  {
    name: "Interest families",
    scale: "0–100 · six styles",
    what: "Hands-on, Analytical, Creative, People-focused, Enterprising, Organized.",
    tells: "The character of the batch — what it enjoys, and what it avoids but placements still demand.",
    not: "A fixed personality type. Interests shift, especially in the first two years.",
    where: "What kind of batch",
  },
  {
    name: "Work values",
    scale: "Top 4 of 12",
    what: "What students want most from a job — Autonomy, Stability, Pay & benefits and nine more.",
    tells: "What the batch listens for in pre-placement talks, and which offers they will accept and keep.",
    not: "What they will earn or where they will be placed.",
    where: "What the batch wants",
  },
  {
    name: "Best-fit direction",
    scale: "1 of 12 fields",
    what: "Ranked from interests (40%), hands-on exposure (40%) and values (20%). No clear leader makes the student an Explorer.",
    tells: "Where elective seats, labs, company invites and internship drives will meet real demand.",
    not: "A reason to stream or shortlist anyone. Two equally suited fields are shown as ≈.",
    where: "Where students want to go · Industry plan",
  },
  {
    name: "Zones",
    scale: "Will × Skill",
    what: "Will against Acquired skill, split at the batch medians into four groups.",
    tells: "Which programme each student belongs in this semester.",
    not: "A ranking. Half the batch is always below each median by definition.",
    where: "Executive summary · Will vs Skill map",
  },
];

const MeasurePage: React.FC<PageProps & { n: ProNarrative | null }> = ({ p, n, footer }) => {
  const g = p.overview.heldByGate;
  return (
    <>
      <PageHead
        group="Overview"
        title="What we measure, and what it tells you"
        lede="Read this before presenting any other page. Every number on this dashboard comes from one of these eight measures."
      />
      {n?.methodology_note && (
        <Card className="npd-prose">
          <p>
            <Emph text={n.methodology_note} />
          </p>
        </Card>
      )}
      <div className="npd-meas">
        {MEASURES.map((m) => (
          <div key={m.name} className="npd-m">
            <h4>{m.name}</h4>
            <div className="npd-m-scale">{m.scale}</div>
            <p>{m.what}</p>
            <div className="npd-yes">{m.tells}</div>
            <div className="npd-no">{m.not}</div>
            <div className="npd-m-where">Shown on: {m.where}</div>
          </div>
        ))}
      </div>
      <Card
        title="When a report is held or flagged"
        sub="These students are on the attention queue — none of them are dropped from the college's plan."
      >
        <div className="npd-tw">
          <table className="npd-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>What happened</th>
                <th>This cohort</th>
                <th>What to do</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Held · attention check", "Missed the question that checks they were reading.", g.R1 ?? 0, "Re-sit with a counsellor present."],
                ["Held · incomplete", "Questions unanswered or values not ranked.", g.R5 ?? 0, "Supervised re-sit."],
                ["Held · no strong interest", "No interest family strong enough to rank directions.", g.R3 ?? 0, "Counsellor-led conversation instead of a report."],
                ["Held · no signal", "Interests tied and no hands-on exposure yet.", g.R4 ?? 0, "Counsellor-led conversation instead of a report."],
                ["Flagged", "Answers were inconsistent; delivered with a notice.", p.overview.flagged, "Counsellor reads the report with the student."],
                ["Explorer", "No single direction stands out yet.", p.overview.explorers, "Session built on the student's own aspirations."],
              ].map((r) => (
                <tr key={String(r[0])}>
                  <td>
                    <b>{r[0]}</b>
                  </td>
                  <td>{r[1]}</td>
                  <td>{r[2]}</td>
                  <td>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="npd-card-s npd-card-s--end">
          Cut-lines: Will {p.norms.willMedian}, Skill {p.norms.skillMedian}
          {p.norms.provisional
            ? " — provisional, fixed at 50 until the assessment has 60 students for live medians."
            : ` — live medians of ${p.norms.batchN} students.`}{" "}
          No percentile appears anywhere, by design.
        </p>
      </Card>
      <PageFooter text={footer} />
    </>
  );
};

const ZoneTable: React.FC<{ p: ProPayload }> = ({ p }) => (
  <Card title="The four zones in numbers" sub="What each group looks like on average, and what moves first.">
    <div className="npd-tw">
      <table className="npd-table">
        <thead>
          <tr>
            <th>Zone</th>
            <th>Students</th>
            <th>Avg Will</th>
            <th>Avg Skill</th>
            <th>Habits</th>
            <th>Logic /5</th>
            <th>What moves first</th>
            <th>This semester</th>
          </tr>
        </thead>
        <tbody>
          {p.zones.counts.map((z) => (
            <tr key={z.key}>
              <td>
                <span className="npd-zdot" style={zoneVar(z.key)} />
                <b>{z.label}</b>
              </td>
              <td>
                {z.count} <span className="npd-muted">({z.pct}%)</span>
              </td>
              <td>{z.avgWill}</td>
              <td>{z.avgSkill}</td>
              <td>{z.avgFoundation}</td>
              <td>{z.avgReasoning}</td>
              <td>{z.first}</td>
              <td>{z.todo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);

const WillPage: React.FC<PageProps> = ({ p, notes, footer }) => (
  <>
    <PageHead
      group="The batch"
      title="What drives this batch"
      lede="Will is built from three parts. The weakest part is where mentoring should start."
    />
    <Card title="The three parts of Will" sub="Batch average out of 100, weakest first. Red marks the weakest part.">
      <div className="npd-bars">
        {p.will.factors.map((f) => (
          <BarRow
            key={f.key}
            label={f.label}
            sub={f.meaning}
            value={f.avg}
            colour={f.label === p.will.weakestFactor ? ZONE_COLOURS.support : undefined}
          />
        ))}
      </div>
    </Card>
    <Card
      title="The same three parts, zone by zone"
      sub="A part that stays low even in the strong zones is a batch habit, not a few students' problem."
    >
      <div className="npd-tw">
        <table className="npd-table">
          <thead>
            <tr>
              <th>Part</th>
              {p.zones.counts.map((z) => (
                <th key={z.key}>
                  <span className="npd-zdot" style={zoneVar(z.key)} />
                  {z.label}
                </th>
              ))}
              <th>Students below 34</th>
            </tr>
          </thead>
          <tbody>
            {p.will.factors.map((f) => (
              <tr key={f.key}>
                <td>
                  <b>{f.label}</b>
                </td>
                {p.zones.counts.map((z) => (
                  <td key={z.key}>{f.byZone[z.key]}</td>
                ))}
                <td>{f.lowCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
    <ActionBox actions={p.actions.will} />
    <Commentary page={notes.get("will")} />
    <PageFooter text={footer} />
  </>
);

const PersonalityPage: React.FC<PageProps> = ({ p, notes, footer }) => {
  const byAvg = [...p.personality.families].sort((a, b) => b.avg - a.avg);
  const byTop = [...p.personality.families].sort((a, b) => b.topCount - a.topCount);
  const maxTop = Math.max(1, ...byTop.map((f) => f.topCount));
  return (
    <>
      <PageHead
        group="The batch"
        title="What kind of batch this is"
        lede="What this batch naturally likes doing — six work styles."
      />
      <div className="npd-grid2">
        <Card title="Average interest strength" sub="Out of 100.">
          <div className="npd-bars">
            {byAvg.map((f) => (
              <BarRow key={f.key} label={f.label} value={f.avg} title={`${f.highCount} students strong (67+)`} />
            ))}
          </div>
        </Card>
        <Card title="How many students lead with each" sub="Each student's strongest style.">
          <div className="npd-bars">
            {byTop.map((f) => (
              <BarRow
                key={f.key}
                label={f.label}
                value={f.topCount}
                max={maxTop}
                display={`${f.topCount} · ${f.topPct}%`}
                colour={ZONE_COLOURS.capable}
              />
            ))}
          </div>
        </Card>
      </div>
      <div className="npd-kpis">
        <Kpi label="Strongest styles" value={p.personality.strongest.join(" + ")} textValue />
        <Kpi label="Least preferred" value={p.personality.weakest.join(" + ")} textValue accent="var(--status-warning-ink)" />
        <Kpi label="Tied profiles" value={`${p.personality.tiedPct}%`} sub={`${p.personality.tiedProfiles} students`} />
        <Kpi
          label="Alternate-strength plans"
          value={p.personality.trackA}
          sub="led by neither building nor analysis"
        />
      </div>
      <ActionBox actions={p.actions.personality} />
      <Commentary page={notes.get("personality")} />
      <PageFooter text={footer} />
    </>
  );
};

const ragColour = (pct: number) =>
  pct < 50 ? ZONE_COLOURS.support : pct < 70 ? ZONE_COLOURS.motivated : ZONE_COLOURS.ready;

const ImprovementPage: React.FC<PageProps> = ({ p, notes, footer }) => {
  const imp = p.improvement;
  const maxDist = Math.max(1, ...imp.reasoningDistribution);
  return (
    <>
      <PageHead
        group="The batch"
        title="Areas of improvement"
        lede="Where the batch is weakest — and the cheapest fixes."
      />
      <div className="npd-grid2">
        <Card
          title="Five everyday-logic checks"
          sub={`Share of ${imp.base} students who got each right. Red under 50%, amber under 70%.`}
        >
          <div className="npd-bars">
            {imp.checks.map((c) => (
              <BarRow
                key={c.key}
                label={c.label}
                value={c.pct}
                display={`${c.pct}%`}
                colour={ragColour(c.pct)}
                title={`${c.passed} of ${c.base} answered correctly`}
              />
            ))}
          </div>
        </Card>
        <Card
          title="Scores out of 5"
          sub={`Batch average ${imp.avgReasoning} · ${imp.lowReasoning} students scored 0–1.`}
        >
          <div className="npd-hist">
            {imp.reasoningDistribution.map((n, score) => (
              <div key={score} className="npd-hc" title={`${n} students scored ${score}/5`}>
                <div
                  className="npd-hb"
                  style={
                    {
                      height: `${(n / maxDist) * 100}%`,
                      "--c": score < 2 ? ZONE_COLOURS.support : score < 3 ? "var(--bar-soft)" : "var(--bar)",
                    } as React.CSSProperties
                  }
                >
                  {n}
                </div>
              </div>
            ))}
          </div>
          <div className="npd-hl">
            {imp.reasoningDistribution.map((_, i) => (
              <div key={i}>{i}/5</div>
            ))}
          </div>
        </Card>
      </div>
      <Card
        title="Everyday work habits — weakest first"
        sub="How many students sit in each band, and for how many it is their single weakest habit."
      >
        <div className="npd-tw">
          <table className="npd-table">
            <thead>
              <tr>
                <th>Habit</th>
                <th style={{ width: "32%" }}>Batch average</th>
                <th>Early (&lt;34)</th>
                <th>Developing</th>
                <th>Strong (67+)</th>
                <th>Weakest for</th>
              </tr>
            </thead>
            <tbody>
              {imp.habits.map((h, i) => (
                <tr key={h.key}>
                  <td>
                    <b>{h.label}</b>
                  </td>
                  <td>
                    <BarRow value={h.avg} colour={i < 2 ? ZONE_COLOURS.support : "var(--bar-soft)"} />
                  </td>
                  <td>{h.red}</td>
                  <td>{h.amber}</td>
                  <td>{h.green}</td>
                  <td>{h.lowestFor} students</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="npd-card-s npd-card-s--end">
          {imp.lowFoundation} students have an overall habits score below 34. Each student's own report
          already gave them one task for their two weakest habits.
        </p>
      </Card>
      <ActionBox actions={p.actions.improvement} />
      <Commentary page={notes.get("improvement")} />
      <PageFooter text={footer} />
    </>
  );
};

const DirectionsPage: React.FC<PageProps> = ({ p, notes, footer }) => {
  const d = p.directions;
  const max = Math.max(1, ...d.fields.map((f) => f.bestFit));
  const a = d.ambitionVsFit;
  return (
    <>
      <PageHead
        group="Direction & placement"
        title="Where students want to go"
        lede={`Best-fit direction for each student: ${d.recipe}.`}
        how="≈ counts students with two equally suited fields. A mismatch between ambition and fit is a conversation, not a correction."
      />
      <Card
        title="Best-fit direction by field"
        sub={`${d.ties} students have two equally suited fields; ${d.explorers} are still exploring and are counted nowhere below.`}
      >
        <div className="npd-bars">
          {d.fields.map((f, i) => (
            <BarRow
              key={f.key}
              label={f.label}
              value={f.bestFit}
              max={max}
              colour={i < 3 && f.bestFit > 0 ? ZONE_COLOURS.motivated : "var(--bar-soft)"}
              display={f.tiedSecond ? `${f.bestFit} +${f.tiedSecond}≈` : f.bestFit}
              title={`${f.bestFit} best-fit · ${f.tiedSecond} equally suited · ${f.handsOn} already hands-on · ${f.aspiring} want to go here`}
            />
          ))}
        </div>
      </Card>
      <div className="npd-grid2">
        <Card title="Fit, exposure and ambition" sub="Demand next to readiness and what students say they want.">
          <div className="npd-tw">
            <table className="npd-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Best fit</th>
                  <th>Hands-on</th>
                  <th>Want it</th>
                  <th>Avg fit</th>
                </tr>
              </thead>
              <tbody>
                {d.fields.map((f) => (
                  <tr key={f.key}>
                    <td>{f.label}</td>
                    <td>{f.bestFit}</td>
                    <td>{f.handsOn}</td>
                    <td>{f.aspiring}</td>
                    <td>{f.avgFit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Ambition vs fit" sub="Is the field a student chose among their top three fits?">
          <div className="npd-kpis npd-kpis--tight">
            <Kpi label="Inside top three" value={a.matched} accent="var(--status-good-ink)" />
            <Kpi
              label="Outside top three"
              value={a.mismatched}
              sub={`${a.mismatchedPct}% of those who chose`}
              accent="var(--status-critical-ink)"
            />
            <Kpi label="Named none" value={a.noAspiration} accent="var(--hairline)" />
          </div>
          <p className="npd-card-s npd-card-s--end">
            Filter the student list by "Ambition outside top three fits" to see who — each deserves a
            15-minute conversation.
          </p>
        </Card>
      </div>
      <ActionBox actions={p.actions.directions} />
      <Commentary page={notes.get("directions")} />
      <PageFooter text={footer} />
    </>
  );
};

const IndustryPage: React.FC<PageProps> = ({ p, notes, footer }) => (
  <>
    <PageHead
      group="Direction & placement"
      title="Industry & internship plan"
      lede="Ready-made cards for the placement cell: who to call, where to take students, which internship drive to run."
      how="Built from demand (how many fit there) and readiness (how many already have hands-on experience). Fields with fewer students still matter individually — each student's report carries personal pathways."
    />
    {p.industry.length === 0 ? (
      <Empty title="No field has best-fit students yet" />
    ) : (
      <div className="npd-ind">
        {p.industry.map((c) => (
          <article key={c.key} className="npd-ic">
            <h4>{c.label}</h4>
            <div className="npd-ic-nums">
              <div>
                <b>{c.bestFit}</b>
                <span>best fit</span>
              </div>
              {c.tiedSecond > 0 && (
                <div>
                  <b>+{c.tiedSecond}</b>
                  <span>equally suited</span>
                </div>
              )}
              <div>
                <b>{c.handsOn}</b>
                <span>hands-on</span>
              </div>
              <div>
                <b>{c.aspiring}</b>
                <span>want it</span>
              </div>
            </div>
            <dl>
              {c.organisations.length > 0 && (
                <>
                  <dt>Approach</dt>
                  <dd>{c.organisations.join(" · ")}</dd>
                </>
              )}
              {c.visit && (
                <>
                  <dt>Visit</dt>
                  <dd>{c.visit}</dd>
                </>
              )}
              {c.internships.length > 0 && (
                <>
                  <dt>Internships</dt>
                  <dd>{c.internships.join(" · ")}</dd>
                </>
              )}
            </dl>
          </article>
        ))}
      </div>
    )}
    <ActionBox actions={p.actions.industry} />
    <Commentary page={notes.get("industry")} />
    <PageFooter text={footer} />
  </>
);

const ValuesPage: React.FC<PageProps> = ({ p, notes, footer }) => {
  const max = Math.max(1, ...p.values.map((v) => v.topFour));
  return (
    <>
      <PageHead
        group="Direction & placement"
        title="What this batch wants from work"
        lede="The values students chose — use them in placement messaging and employer conversations."
      />
      <Card
        title="Top-four picks out of twelve values"
        sub={`How many of ${p.overview.delivered} students put each value in their top four.`}
      >
        <div className="npd-bars">
          {p.values.map((v) => (
            <BarRow
              key={v.tag}
              label={v.tag}
              sub={`${v.rankOne} ranked it first`}
              value={v.topFour}
              max={max}
              colour={ZONE_COLOURS.ready}
              title={`"${v.option}"`}
            />
          ))}
        </div>
      </Card>
      <ActionBox actions={p.actions.values} />
      <Commentary page={notes.get("values")} />
      <PageFooter text={footer} />
    </>
  );
};

const QueuePage: React.FC<PageProps & { names: Map<number, string>; onSelect: (id: number) => void }> = ({
  p,
  notes,
  footer,
  names,
  onSelect,
}) => {
  const a = p.attention;
  const [prio, setPrio] = useState<0 | 1 | 2 | 3>(0);
  const items = a.items.filter((i) => prio === 0 || i.priority === prio);
  return (
    <>
      <PageHead
        group="People"
        title="Who needs a person first"
        lede="The students to meet before any class-level programme starts. Work the list top-down."
      />
      <div className="npd-kpis">
        <Kpi label="Priority 1" value={a.p1} sub="report held or flagged" accent="var(--status-critical-ink)" />
        <Kpi label="Priority 2" value={a.p2} sub="Explorer, or starting from the bottom" accent="var(--status-warning-ink)" />
        <Kpi label="Priority 3" value={a.p3} sub="targeted help" />
        <Kpi
          label="Counsellor time"
          value={`~${a.hoursEstimate} h`}
          sub={`${a.minutesPerPriority.join(" / ")} min per P1 / P2 / P3`}
        />
      </div>
      <Card>
        <div className="npd-filters">
          <div className="npd-seg" role="group" aria-label="Priority">
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                className={prio === n ? "is-active" : undefined}
                onClick={() => setPrio(n as 0 | 1 | 2 | 3)}
              >
                {n === 0 ? `All · ${a.total}` : `P${n}`}
              </button>
            ))}
          </div>
          <span className="npd-muted">
            By owner: {Object.entries(a.byOwner).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"}
            {a.alreadyCounselled > 0 ? ` · ${a.alreadyCounselled} already counselled` : ""}
          </span>
        </div>
        <div className="npd-tw">
          <table className="npd-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Student</th>
                <th>Why</th>
                <th>What to do</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="npd-row" onClick={() => onSelect(i.id)}>
                  <td>
                    <span className={`npd-prio npd-prio--${i.priority}`}>P{i.priority}</span>
                  </td>
                  <td>
                    <b>{names.get(i.id) ?? `Student ${i.id}`}</b>
                    {i.counselled && <div className="npd-muted">already counselled</div>}
                  </td>
                  <td>
                    {i.reasons.map((r) => (
                      <div key={r.code}>{r.label}</div>
                    ))}
                  </td>
                  <td>
                    {i.reasons.map((r) => (
                      <div key={r.code}>
                        {r.action}
                        <OwnerTag owner={r.owner} />
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="npd-muted" style={{ textAlign: "center", padding: 18 }}>
                    Nobody at this priority.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {a.trackABriefing > 0 && (
          <p className="npd-card-s npd-card-s--end">
            <b>Alternate-strength plans ({a.trackABriefing} students):</b> profiles led by neither building
            nor analysis — their plans route through their actual strengths. Brief the counsellors: this is
            orientation, never a deficit label.
          </p>
        )}
      </Card>
      <ActionBox actions={p.actions.queue} />
      <Commentary page={notes.get("queue")} />
      <PageFooter text={footer} />
    </>
  );
};
