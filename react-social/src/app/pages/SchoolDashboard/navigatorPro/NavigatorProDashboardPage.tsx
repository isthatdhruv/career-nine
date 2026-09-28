import React, { useEffect, useMemo, useState } from "react";
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
  Commentary,
  Emph,
  Empty,
  Kpi,
  OwnerTag,
  PageFooter,
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
 * A reading of one released scope — the whole college, a session, a class, a section or a
 * group — written for faculty, the placement cell, counsellors and the governing board.
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

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "exec", label: "Executive summary", hint: "What we found and the decisions it points to" },
  { id: "board", label: "Board brief", hint: "One page for the governing board" },
  { id: "measure", label: "What we measure", hint: "Every measure, what it tells you, what it doesn't" },
  { id: "map", label: "Will vs Skill map", hint: "Every student on one picture" },
  { id: "will", label: "What drives the batch", hint: "The three parts of Will" },
  { id: "personality", label: "What kind of batch", hint: "Interest families" },
  { id: "improvement", label: "Areas of improvement", hint: "Checks, logic and habits" },
  { id: "directions", label: "Where students want to go", hint: "Best-fit fields and ambition" },
  { id: "industry", label: "Industry & internship plan", hint: "Who to call, where to go" },
  { id: "values", label: "What the batch wants", hint: "Work values" },
  { id: "students", label: "Student list", hint: "Everyone, filterable" },
  { id: "queue", label: "Who needs a person first", hint: "The attention queue" },
];

const LEVEL_ORDER: Record<string, number> = { INSTITUTE: 0, SESSION: 1, CLASS: 2, SECTION: 3, GROUP: 4 };

type AccessScope = { i?: number | null };

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
  const [scopeKey, setScopeKey] = useState<string | null>(null);
  const [row, setRow] = useState<ScopeView | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("exec");
  const [names, setNames] = useState<Map<number, string>>(new Map());
  const [namesLoading, setNamesLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  // Full-width page, as the Navigator 360 dashboard does.
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

  // Entry point: the college's current Navigator Pro release.
  useEffect(() => {
    setRow(null);
    setAssessmentId(null);
    setScopes([]);
    setScopeKey(null);
    if (instituteCode == null) return;
    let cancelled = false;
    setLoading(true);
    getLatestProRelease(instituteCode)
      .then((res) => {
        if (cancelled) return;
        setRow(res.data);
        setAssessmentId(res.data.assessmentId ?? null);
        setScopeKey(res.data.released ? res.data.scopeKey : null);
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

  // Which cohorts were released — the cohort picker offers only these.
  useEffect(() => {
    if (instituteCode == null || assessmentId == null) return;
    let cancelled = false;
    getReleasedScopes(instituteCode, assessmentId)
      .then((res) => {
        if (cancelled) return;
        const usable = (res.data ?? []).filter(
          (s) => s.status === "GENERATED" || s.status === "SKIPPED_SMALL_COHORT"
        );
        usable.sort(
          (a, b) =>
            (LEVEL_ORDER[a.scopeLevel] ?? 9) - (LEVEL_ORDER[b.scopeLevel] ?? 9) ||
            String(a.scopeLabel).localeCompare(String(b.scopeLabel))
        );
        setScopes(usable);
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
    const s = scopes.find((x) => x.scopeKey === scopeKey);
    return {
      instituteCode,
      assessmentId,
      sessionId: s?.sessionId ?? null,
      classId: s?.classId ?? null,
      sectionId: s?.sectionId ?? null,
      groupId: s?.groupId ?? null,
    };
  }, [instituteCode, assessmentId, scopes, scopeKey]);

  // Switching cohort swaps to that scope's stored row.
  const onScopeChange = (key: string) => {
    setScopeKey(key);
    const s = scopes.find((x) => x.scopeKey === key);
    if (!s || instituteCode == null || assessmentId == null) return;
    setLoading(true);
    getScope(instituteCode, {
      assessmentId,
      sessionId: s.sessionId,
      classId: s.classId,
      sectionId: s.sectionId,
      groupId: s.groupId,
    })
      .then((res) => setRow(res.data))
      .catch(() => showErrorToast("Could not load that cohort."))
      .finally(() => setLoading(false));
  };

  const payload: ProPayload | null = useMemo(
    () => (row?.released ? parseProPayload(row.internalCalculation) : null),
    [row]
  );
  const narrative: ProNarrative | null = useMemo(
    () => (row?.released ? parseJson<ProNarrative>(row.aiResponse) : null),
    [row]
  );
  const pageNotes = useMemo(() => {
    const m = new Map<PageId, PageNarrative>();
    narrative?.pages?.forEach((p) => m.set(p.page_id, p));
    return m;
  }, [narrative]);

  // Names, once per loaded scope.
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
      .catch(() => {
        if (!cancelled) setNames(new Map());
      })
      .finally(() => {
        if (!cancelled) setNamesLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  const instituteName =
    payload?.institute?.name ||
    institutes.find((i: any) => Number(i.instituteCode) === instituteCode)?.instituteName ||
    "College dashboard";

  const footer = payload
    ? `${payload.scope.label} · ${payload.overview.delivered} delivered reports of ${payload.overview.assessed} assessed · ` +
      `medians Will ${payload.norms.willMedian} · Skill ${payload.norms.skillMedian}` +
      `${payload.norms.provisional ? " (provisional cut-lines)" : ""} · ${instituteName} × Career-9`
    : "";

  const selectedRow = payload?.students.find((s) => s.id === selected) ?? null;
  const selectedItem = payload?.attention.items.find((i) => i.id === selected);
  const zoneLabel = (key?: string) => payload?.zones.counts.find((c) => c.key === key)?.label ?? "";

  // ─────────────────────────── render ───────────────────────────

  const picker = (
    <div className="npd-pickers">
      <select
        className="form-select form-select-sm"
        value={instituteCode ?? ""}
        onChange={(e) => setInstituteCode(e.target.value === "" ? null : Number(e.target.value))}
        disabled={institutesLoading}
        aria-label="College"
      >
        <option value="">{institutesLoading ? "Loading colleges…" : "Select a college"}</option>
        {institutes.map((i: any) => (
          <option key={i.instituteCode} value={i.instituteCode}>
            {i.instituteName}
          </option>
        ))}
      </select>
      {scopes.length > 1 && (
        <select
          className="form-select form-select-sm"
          value={scopeKey ?? ""}
          onChange={(e) => onScopeChange(e.target.value)}
          aria-label="Cohort"
        >
          {scopes.map((s) => (
            <option key={s.scopeKey} value={s.scopeKey}>
              {s.scopeLevel === "INSTITUTE" ? "Whole college" : s.scopeLabel}
              {s.studentCount != null ? ` · ${s.studentCount}` : ""}
            </option>
          ))}
        </select>
      )}
      {payload && (
        <button type="button" className="btn btn-sm btn-light" onClick={() => window.print()}>
          Print / save PDF
        </button>
      )}
    </div>
  );

  let body: React.ReactNode;
  if (instituteCode == null) {
    body = <Empty title="Choose a college">Pick a college to open its Navigator Pro dashboard.</Empty>;
  } else if (loading && !payload) {
    body = <Empty title="Loading…" />;
  } else if (!row || !row.released) {
    body = (
      <Empty title="Dashboard is not generated yet">
        Career-9 generates and releases this dashboard once the college's Navigator Pro reading is complete.
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
    body = (
      <div className="npd-wrap">
        <nav className="npd-side" aria-label="Dashboard pages">
          <div className="npd-logo">
            Career-<span>9</span>
          </div>
          <div className="npd-sub">
            Navigator Pro · College dashboard
            <br />
            {payload.scope.label}
          </div>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`npd-nav${tab === t.id ? " on" : ""}`}
              onClick={() => setTab(t.id)}
              title={t.hint}
            >
              {t.label}
              {t.id === "queue" && payload.attention.p1 > 0 && (
                <span className="npd-badge">{payload.attention.p1}</span>
              )}
            </button>
          ))}
          <div className="npd-side-note">
            Best-fit recipe: {payload.directions.recipe}. Guidance data — never a selection tool.
          </div>
        </nav>

        <main className="npd-main">
          {row.stale && (
            <div className="npd-stale">
              {row.newStudentsSinceGeneration} more students have finished since this dashboard was generated.
            </div>
          )}
          <ExecPage on={tab === "exec"} p={payload} n={narrative} notes={pageNotes} footer={footer} />
          <BoardPage on={tab === "board"} p={payload} n={narrative} footer={footer} />
          <MeasurePage on={tab === "measure"} p={payload} n={narrative} footer={footer} />
          <Screen on={tab === "map"} id="map" title="Will vs Skill — the batch map"
            intro="Every student on one picture: how driven they are (up) against how much they can already do (right).">
            <WillSkillMap
              points={payload.zones.points}
              counts={payload.zones.counts}
              willMedian={payload.norms.willMedian}
              skillMedian={payload.norms.skillMedian}
              names={names}
              onSelect={setSelected}
            />
            <p className="npd-cap">
              Hover a dot for the student's name and scores; click it for the full profile. Click a colour above
              to hide or show that group. Dots right of the dashed line have more skill than the batch median;
              dots above it have more drive.
            </p>
            <ZoneTable p={payload} />
            <ActionBox actions={payload.actions.map} />
            <Commentary page={pageNotes.get("map")} />
            <PageFooter text={footer} />
          </Screen>
          <WillPage on={tab === "will"} p={payload} notes={pageNotes} footer={footer} />
          <PersonalityPage on={tab === "personality"} p={payload} notes={pageNotes} footer={footer} />
          <ImprovementPage on={tab === "improvement"} p={payload} notes={pageNotes} footer={footer} />
          <DirectionsPage on={tab === "directions"} p={payload} notes={pageNotes} footer={footer} />
          <IndustryPage on={tab === "industry"} p={payload} notes={pageNotes} footer={footer} />
          <ValuesPage on={tab === "values"} p={payload} notes={pageNotes} footer={footer} />
          <Screen on={tab === "students"} id="students" title="Student list"
            intro="Everyone evaluated in this cohort, most driven first. For planning help — never for ranking.">
            <StudentList
              students={payload.students}
              zones={payload.zones.counts}
              names={names}
              namesLoading={namesLoading}
              onSelect={setSelected}
              fileLabel={`${instituteName} - ${payload.scope.label}`}
            />
            <PageFooter text={footer} />
          </Screen>
          <QueuePage on={tab === "queue"} p={payload} notes={pageNotes} footer={footer}
            names={names} onSelect={setSelected} />
        </main>
      </div>
    );
  }

  return (
    <div className="npd">
      <header className="npd-header">
        <div>
          <p className="npd-eyebrow">
            Navigator Pro{payload?.scope.sessionLabel ? ` · ${payload.scope.sessionLabel}` : ""}
          </p>
          <h1 className="npd-title">{instituteName}</h1>
          {row?.generatedAt && payload && (
            <p className="npd-generated">
              Generated {new Date(row.generatedAt).toLocaleDateString(undefined, { dateStyle: "medium" })} ·{" "}
              {payload.assessment.name}
            </p>
          )}
        </div>
        {picker}
      </header>
      {body}
      <StudentDrawer
        student={selectedRow}
        item={selectedItem}
        name={selected == null ? "" : names.get(selected) ?? `Student ${selected}`}
        zoneLabel={zoneLabel(selectedRow?.zone)}
        onClose={() => setSelected(null)}
      />
    </div>
  );
};

export default NavigatorProDashboardPage;

// ───────────────────────────── pages ─────────────────────────────

interface PageProps {
  on: boolean;
  p: ProPayload;
  notes: Map<PageId, PageNarrative>;
  footer: string;
}

const Screen: React.FC<{
  on: boolean;
  id: string;
  title: string;
  intro?: string;
  children?: React.ReactNode;
}> = ({
  on,
  id,
  title,
  intro,
  children,
}) => (
  <section className={`npd-scr${on ? " on" : ""}`} id={`npd-${id}`}>
    <h1>{title}</h1>
    {intro && <p className="npd-intro">{intro}</p>}
    {children}
  </section>
);

const ZoneTiles: React.FC<{ p: ProPayload }> = ({ p }) => (
  <div className="npd-kpirow">
    {ZONE_ORDER.map((z) => {
      const c = p.zones.counts.find((x) => x.key === z);
      return (
        <Kpi
          key={z}
          accent={ZONE_COLOURS[z]}
          value={c?.count ?? 0}
          label={c?.label ?? z}
          sub={`${ZONE_SHORT[z]} · ${c?.pct ?? 0}%`}
        />
      );
    })}
  </div>
);

const ExecPage: React.FC<{
  on: boolean;
  p: ProPayload;
  n: ProNarrative | null;
  notes: Map<PageId, PageNarrative>;
  footer: string;
}> = ({ on, p, n, notes, footer }) => {
  const o = p.overview;
  return (
    <Screen on={on} id="exec" title="Executive summary"
      intro="One reading of this cohort — what it found, and the decisions it points to.">
      {n?.headline && (
        <p className="npd-headline">
          <Emph text={n.headline} />
        </p>
      )}
      <div className="npd-kpirow">
        <Kpi value={o.assessed} label="students assessed" sub={`${o.completedPct}% of ${o.mapped} mapped`} />
        <Kpi value={o.delivered} label="reports delivered" />
        <Kpi value={o.held} label="reports held" sub="need a counsellor first" />
        <Kpi value={o.flagged} label="flagged for review" sub="delivered with a notice" />
        <Kpi value={o.needAttention} label="need a person" sub={`${o.needPersonFirst} priority 1`} />
      </div>
      <ZoneTiles p={p} />
      <div className="npd-kpirow">
        <Kpi value={p.will.avgWill} label="average Will" sub={`median ${p.norms.willMedian}`} />
        <Kpi value={p.will.avgSkill} label="average Acquired skill" sub={`median ${p.norms.skillMedian}`} />
        <Kpi value={p.will.avgFoundation} label="average everyday habits" />
        <Kpi value={p.improvement.avgReasoning} label="everyday logic (of 5)" />
      </div>
      <ActionBox actions={p.actions.exec} />
      <Commentary page={notes.get("exec")} />
      <PageFooter text={footer} />
    </Screen>
  );
};

const BoardPage: React.FC<{ on: boolean; p: ProPayload; n: ProNarrative | null; footer: string }> = ({
  on,
  p,
  n,
  footer,
}) => {
  const b = n?.board_summary;
  return (
    <Screen on={on} id="board" title="Board brief"
      intro="A one-page summary for the governing board: what was measured, what it shows, what we ask for.">
      {n?.headline && (
        <p className="npd-headline">
          <Emph text={n.headline} />
        </p>
      )}
      <ZoneTiles p={p} />
      {!b ? (
        <Empty title="No written brief for this cohort">
          This cohort is below the size Career-9 writes a narrative for. The figures on every page still apply.
        </Empty>
      ) : (
        <>
          {b.paragraphs.map((t, i) => (
            <p key={i} className="npd-para">
              <Emph text={t} />
            </p>
          ))}
          <div className="npd-three">
            <BriefList title="Strengths" items={b.strengths} tone="good" />
            <BriefList title="Risks" items={b.risks} tone="risk" />
            <BriefList title="What we ask the board" items={b.asks} tone="ask" />
          </div>
        </>
      )}
      <PageFooter text={footer} />
    </Screen>
  );
};

const BriefList: React.FC<{ title: string; items: string[]; tone: string }> = ({ title, items, tone }) => (
  <div className={`npd-brief npd-brief--${tone}`}>
    <div className="npd-brief-title">{title}</div>
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
const MEASURES: { name: string; what: string; tells: string; not: string; where: string }[] = [
  {
    name: "Will (drive)",
    what: "How driven a student is right now, 0–100. Built from three parts: Self-Motivation (starting without being pushed), Consistency (staying power when work gets long) and Adaptability (adjusting and still finishing).",
    tells: "Who will act on an opportunity if you put it in front of them, and which part of drive is missing when they don't.",
    not: "Ability or intelligence. Drive changes with circumstances — a low score today is a starting point, not a verdict.",
    where: "Will vs Skill map · What drives the batch",
  },
  {
    name: "Acquired skill",
    what: "How much hands-on exposure a student already has across twelve fields, 0–100.",
    tells: "Who can be pushed into internships and competitions now, and which fields already have a ready pool.",
    not: "Aptitude for a field. Low exposure usually means no opportunity yet, not no talent.",
    where: "Will vs Skill map · Industry plan",
  },
  {
    name: "Everyday habits (Foundation)",
    what: "Five work habits: Numbers & data, Digital & information, Thinking & problem-solving, Creating & improving, Finishing what you start. Each 0–100.",
    tells: "Which habits a class-level programme should target — the weakest bars are the cheapest wins.",
    not: "Marks or grades. These are self-reported habits.",
    where: "Areas of improvement",
  },
  {
    name: "Everyday logic",
    what: "Five short applied checks — numeracy, data reading, causal reasoning, source judgment, spreadsheet logic — scored out of 5.",
    tells: "Which practical skill most students got wrong, so one targeted lab can fix it for many.",
    not: "An IQ score. One question per skill; read the batch pattern, not an individual's number.",
    where: "Areas of improvement",
  },
  {
    name: "Interest families",
    what: "Six work styles: Hands-on, Analytical, Creative, People-focused, Enterprising, Organized.",
    tells: "The character of the batch — what they will enjoy, and what they avoid but placements still demand.",
    not: "Personality type or fixed traits. Interests shift, especially in the first two years.",
    where: "What kind of batch",
  },
  {
    name: "Work values",
    what: "Each student ranked their top four of twelve values (for example Autonomy, Stability, Pay & benefits).",
    tells: "What the batch listens for in pre-placement talks, and which offers they will accept and keep.",
    not: "What they will earn or where they will be placed.",
    where: "What the batch wants",
  },
  {
    name: "Best-fit direction",
    what: "One of twelve engineering and technology fields, ranked for each student from interests (40%), hands-on exposure (40%) and values (20%). Students with no clear leader are Explorers.",
    tells: "Where elective seats, labs, company invites and internship drives will meet real demand.",
    not: "A recommendation to stream or shortlist anyone. Two equally suited fields are shown as ≈.",
    where: "Where students want to go · Industry plan",
  },
  {
    name: "Zones",
    what: "Will against Acquired skill, split at the batch medians: Ready to accelerate, Motivated needs skilling, Capable needs engagement, Needs structured support.",
    tells: "Which programme each student belongs in this semester.",
    not: "A ranking. Half the batch is always below each median by definition.",
    where: "Executive summary · Will vs Skill map",
  },
];

const MeasurePage: React.FC<{ on: boolean; p: ProPayload; n: ProNarrative | null; footer: string }> = ({
  on,
  p,
  n,
  footer,
}) => (
  <Screen on={on} id="measure" title="What we measure, and what it tells you"
    intro="Navigator Pro is a 30-minute reading. This page explains every number on this dashboard — read it before presenting any other page.">
    {n?.methodology_note && (
      <p className="npd-para">
        <Emph text={n.methodology_note} />
      </p>
    )}
    <div className="npd-measures">
      {MEASURES.map((m) => (
        <div key={m.name} className="npd-card">
          <div className="npd-cardh">{m.name}</div>
          <div className="npd-crow">{m.what}</div>
          <div className="npd-crow">
            <b>Tells you:</b> {m.tells}
          </div>
          <div className="npd-crow">
            <b>Does not tell you:</b> {m.not}
          </div>
          <div className="npd-crow npd-muted">Shown on: {m.where}</div>
        </div>
      ))}
    </div>
    <h2>When a report is held or flagged</h2>
    <table className="npd-table npd-table--plain">
      <thead>
        <tr>
          <th>Case</th>
          <th>What happened</th>
          <th>In this cohort</th>
          <th>What to do</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Held · attention check</td>
          <td>The student missed the question that checks they were reading.</td>
          <td>{p.overview.heldByGate.R1 ?? 0}</td>
          <td>Re-sit with a counsellor present.</td>
        </tr>
        <tr>
          <td>Held · incomplete</td>
          <td>Questions unanswered or values not ranked.</td>
          <td>{p.overview.heldByGate.R5 ?? 0}</td>
          <td>Supervised re-sit.</td>
        </tr>
        <tr>
          <td>Held · no strong interest</td>
          <td>No interest family was strong enough to rank directions.</td>
          <td>{p.overview.heldByGate.R3 ?? 0}</td>
          <td>Counsellor-led conversation instead of a report.</td>
        </tr>
        <tr>
          <td>Held · no signal</td>
          <td>Interests tied and no hands-on exposure yet.</td>
          <td>{p.overview.heldByGate.R4 ?? 0}</td>
          <td>Counsellor-led conversation instead of a report.</td>
        </tr>
        <tr>
          <td>Flagged</td>
          <td>Answers were inconsistent; the report went out with a notice.</td>
          <td>{p.overview.flagged}</td>
          <td>Counsellor reads the report with the student.</td>
        </tr>
        <tr>
          <td>Explorer</td>
          <td>No single direction stands out yet; the report works from the student's own aspirations.</td>
          <td>{p.overview.explorers}</td>
          <td>Counselling session built on those aspirations.</td>
        </tr>
      </tbody>
    </table>
    <p className="npd-cap">
      Cut-lines: Will {p.norms.willMedian}, Skill {p.norms.skillMedian}
      {p.norms.provisional
        ? " — provisional, fixed at 50 until the assessment has enough students for live medians."
        : ` — live medians of ${p.norms.batchN} students.`}{" "}
      No percentile is shown anywhere, by design.
    </p>
    <PageFooter text={footer} />
  </Screen>
);

const ZoneTable: React.FC<{ p: ProPayload }> = ({ p }) => (
  <div className="npd-table-wrap">
    <table className="npd-table npd-table--plain">
      <thead>
        <tr>
          <th>Zone</th>
          <th>Students</th>
          <th>Avg Will</th>
          <th>Avg Skill</th>
          <th>Avg habits</th>
          <th>Logic /5</th>
          <th>What moves first</th>
          <th>What to do</th>
        </tr>
      </thead>
      <tbody>
        {p.zones.counts.map((z) => (
          <tr key={z.key}>
            <td style={{ color: ZONE_COLOURS[z.key], fontWeight: 700 }}>{z.label}</td>
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
);

const WillPage: React.FC<PageProps> = ({ on, p, notes, footer }) => (
  <Screen on={on} id="will" title="What drives this batch"
    intro="Will is built from three parts. The weakest one is where mentoring should start.">
    {p.will.factors.map((f) => (
      <BarRow key={f.key} label={f.label} value={f.avg} title={f.meaning}
        colour={f.label === p.will.weakestFactor ? "#C0392B" : "#19376D"} />
    ))}
    <p className="npd-cap">
      Batch average out of 100 · {p.will.factors.map((f) => `${f.label}: ${f.meaning}`).join(" · ")}
    </p>
    <h2>The same three parts, zone by zone</h2>
    <div className="npd-table-wrap">
      <table className="npd-table npd-table--plain">
        <thead>
          <tr>
            <th>Factor</th>
            {p.zones.counts.map((z) => (
              <th key={z.key}>{z.label}</th>
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
    <p className="npd-cap">
      Read across a row: a factor that stays low even in the stronger zones is a batch-wide habit, not a
      few students' problem.
    </p>
    <ActionBox actions={p.actions.will} />
    <Commentary page={notes.get("will")} />
    <PageFooter text={footer} />
  </Screen>
);

const PersonalityPage: React.FC<PageProps> = ({ on, p, notes, footer }) => {
  const maxTop = Math.max(1, ...p.personality.families.map((f) => f.topCount));
  return (
    <Screen on={on} id="personality" title="What kind of batch this is"
      intro="What this batch naturally likes doing — six work styles.">
      <h2>Average interest strength</h2>
      {p.personality.families.map((f) => (
        <BarRow key={f.key} label={f.label} value={f.avg}
          title={`Batch average ${f.avg}/100 on ${f.label} · ${f.highCount} students strong (67+)`} />
      ))}
      <h2>How many students lead with each</h2>
      {p.personality.families.map((f) => (
        <BarRow key={f.key} label={f.label} value={f.topCount} max={maxTop} colour="#2CA6A4"
          display={`${f.topCount} (${f.topPct}%)`} />
      ))}
      <div className="npd-kpirow" style={{ marginTop: 14 }}>
        <Kpi value={p.personality.strongest.join(" + ")} label="strongest styles" />
        <Kpi value={p.personality.weakest.join(" + ")} label="least-preferred styles" />
        <Kpi value={`${p.personality.tiedPct}%`} label="tied interest profiles" sub={`${p.personality.tiedProfiles} students`} />
        <Kpi value={p.personality.trackA} label="alternate-strength plans" sub="led by neither building nor analysis" />
      </div>
      <p className="npd-cap">
        A strong builder-and-analyst character is normal for engineering. The shortest bars show what the
        batch avoids — and what placements still ask for.
      </p>
      <ActionBox actions={p.actions.personality} />
      <Commentary page={notes.get("personality")} />
      <PageFooter text={footer} />
    </Screen>
  );
};

const ragColour = (pct: number) => (pct < 50 ? "#C0392B" : pct < 70 ? "#F0A427" : "#2E7D32");

const ImprovementPage: React.FC<PageProps> = ({ on, p, notes, footer }) => {
  const imp = p.improvement;
  const maxDist = Math.max(1, ...imp.reasoningDistribution);
  return (
    <Screen on={on} id="improvement" title="Areas of improvement"
      intro="Where the batch is weakest — and the cheapest fixes.">
      <h2>Five everyday-logic checks — how many got each right</h2>
      {imp.checks.map((c) => (
        <BarRow key={c.key} label={c.label} value={c.pct} display={`${c.pct}%`} colour={ragColour(c.pct)}
          title={`${c.passed} of ${c.base} answered ${c.label} correctly`} />
      ))}
      <div className="npd-hrow">
        {imp.reasoningDistribution.map((n, score) => (
          <div key={score} className="npd-hcell" title={`${n} students scored ${score}/5`}>
            <div className="npd-hbar"
              style={{ height: `${Math.max(18, (n / maxDist) * 150)}px`, background: score >= 3 ? "#F0A427" : "#A9BBD6" }}>
              {n}
            </div>
            <div className="npd-hlab">{score}/5</div>
          </div>
        ))}
      </div>
      <p className="npd-cap">
        Scores out of 5 · batch average {imp.avgReasoning} · {imp.lowReasoning} students scored 0–1
      </p>
      <h2>Everyday work habits — weakest first</h2>
      <div className="npd-table-wrap">
        <table className="npd-table npd-table--plain">
          <thead>
            <tr>
              <th>Habit</th>
              <th style={{ width: "34%" }}>Batch average</th>
              <th>Early (&lt;34)</th>
              <th>Developing</th>
              <th>Strong (67+)</th>
              <th>Weakest habit for</th>
            </tr>
          </thead>
          <tbody>
            {imp.habits.map((h, i) => (
              <tr key={h.key}>
                <td>
                  <b>{h.label}</b>
                </td>
                <td>
                  <BarRow label="" value={h.avg} colour={i < 2 ? "#C0392B" : "#A9BBD6"} />
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
      <p className="npd-cap">
        {imp.lowFoundation} students have an overall habits score below 34. Each student's own report already
        gave them one task for their two weakest habits.
      </p>
      <ActionBox actions={p.actions.improvement} />
      <Commentary page={notes.get("improvement")} />
      <PageFooter text={footer} />
    </Screen>
  );
};

const DirectionsPage: React.FC<PageProps> = ({ on, p, notes, footer }) => {
  const d = p.directions;
  const max = Math.max(1, ...d.fields.map((f) => f.bestFit));
  const a = d.ambitionVsFit;
  return (
    <Screen on={on} id="directions" title="Where students want to go"
      intro="Longer bar = more students fit best there.">
      <p className="npd-cap">
        Students whose best-fit direction lands in each field (fit = {d.recipe}). {d.ties} students have two
        equally suited fields; {d.explorers} are still exploring and are counted nowhere below.
      </p>
      {d.fields.map((f, i) => (
        <BarRow key={f.key} label={f.label} value={f.bestFit} max={max} wide
          colour={i < 3 && f.bestFit > 0 ? "#F0A427" : "#A9BBD6"}
          display={f.tiedSecond ? `${f.bestFit} +${f.tiedSecond}≈` : f.bestFit}
          title={`${f.bestFit} best-fit · ${f.tiedSecond} equally suited as second · ${f.handsOn} already hands-on · ${f.aspiring} want to go here`} />
      ))}
      <h2>Fit, exposure and ambition side by side</h2>
      <div className="npd-table-wrap">
        <table className="npd-table npd-table--plain">
          <thead>
            <tr>
              <th>Field</th>
              <th>Best fit</th>
              <th>Already hands-on</th>
              <th>Want to go here</th>
              <th>Avg fit score</th>
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
      <h2>Ambition vs fit</h2>
      <div className="npd-kpirow">
        <Kpi value={a.matched} label="aspiration inside their top three fits" accent="#2E7D32" />
        <Kpi value={a.mismatched} label="aspiration outside their top three" sub={`${a.mismatchedPct}% of those who chose`} accent="#C0392B" />
        <Kpi value={a.noAspiration} label="named no aspiration" accent="#A9BBD6" />
      </div>
      <p className="npd-cap">
        A mismatch is a conversation, not a correction: the student may know something the reading does not.
      </p>
      <ActionBox actions={p.actions.directions} />
      <Commentary page={notes.get("directions")} />
      <PageFooter text={footer} />
    </Screen>
  );
};

const IndustryPage: React.FC<PageProps> = ({ on, p, notes, footer }) => (
  <Screen on={on} id="industry" title="Industry & internship plan"
    intro="Ready-made cards: who to call, where to take students, which internship drive to run.">
    <p className="npd-cap">
      Built from demand (how many fit there) and readiness (how many already have hands-on experience).
    </p>
    {p.industry.length === 0 && <Empty title="No field has best-fit students yet" />}
    {p.industry.map((c) => (
      <div key={c.key} className="npd-card">
        <div className="npd-cardtop">
          <div className="npd-cardh">{c.label}</div>
          <div className="npd-cardm">
            <b>{c.bestFit}</b> best-fit{c.tiedSecond ? ` (+${c.tiedSecond} equally suited)` : ""} ·{" "}
            <b>{c.handsOn}</b> already hands-on · <b>{c.aspiring}</b> want to go here
          </div>
        </div>
        {c.organisations.length > 0 && (
          <div className="npd-crow">
            <b>Organisations to approach:</b> {c.organisations.join(" · ")}
          </div>
        )}
        {c.visit && (
          <div className="npd-crow">
            <b>Industry visit to plan:</b> {c.visit}
          </div>
        )}
        {c.internships.length > 0 && (
          <div className="npd-crow">
            <b>Internship drive:</b> {c.internships.join(" · ")}
          </div>
        )}
      </div>
    ))}
    <p className="npd-cap">
      Fields with fewer students still matter individually — each student's report carries personal
      pathways. This page is the batch-level calendar only.
    </p>
    <ActionBox actions={p.actions.industry} />
    <Commentary page={notes.get("industry")} />
    <PageFooter text={footer} />
  </Screen>
);

const ValuesPage: React.FC<PageProps> = ({ on, p, notes, footer }) => {
  const max = Math.max(1, ...p.values.map((v) => v.topFour));
  return (
    <Screen on={on} id="values" title="What this batch wants from work"
      intro="The values students chose — useful for placement messaging and employer conversations.">
      {p.values.map((v) => (
        <BarRow key={v.tag} label={v.tag} value={v.topFour} max={max} colour="#2CA6A4"
          display={`${v.topFour}`}
          title={`${v.topFour} of ${p.overview.delivered} put ${v.tag} in their top four · ${v.rankOne} ranked it first — "${v.option}"`} />
      ))}
      <p className="npd-cap">
        Each student picked their top four of twelve. Long bars = what students want most from a job. Hover a
        bar for how many ranked it first.
      </p>
      <ActionBox actions={p.actions.values} />
      <Commentary page={notes.get("values")} />
      <PageFooter text={footer} />
    </Screen>
  );
};

const QueuePage: React.FC<PageProps & { names: Map<number, string>; onSelect: (id: number) => void }> = ({
  on,
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
    <Screen on={on} id="queue" title="Who needs a person first"
      intro="The students to meet before any class-level programme starts. Work the list top-down.">
      <div className="npd-kpirow">
        <Kpi value={a.p1} label="priority 1" sub="report held or flagged" accent="#C0392B" />
        <Kpi value={a.p2} label="priority 2" sub="Explorer, or starting from the bottom" accent="#F0A427" />
        <Kpi value={a.p3} label="priority 3" sub="targeted help" accent="#3B6FB5" />
        <Kpi value={`~${a.hoursEstimate} h`} label="counsellor time" sub={`${a.minutesPerPriority.join(" / ")} min per P1 / P2 / P3`} />
        <Kpi value={a.alreadyCounselled} label="already counselled" />
      </div>
      <div className="npd-filters">
        {[0, 1, 2, 3].map((n) => (
          <button key={n} type="button" className={`btn btn-sm ${prio === n ? "btn-primary" : "btn-light"}`}
            onClick={() => setPrio(n as any)}>
            {n === 0 ? `All (${a.total})` : `P${n}`}
          </button>
        ))}
        <span className="npd-muted" style={{ alignSelf: "center" }}>
          By owner: {Object.entries(a.byOwner).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"}
        </span>
      </div>
      <div className="npd-table-wrap">
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
                      {r.action} <OwnerTag owner={r.owner} />
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
        <p className="npd-cap">
          <b>Alternate-strength plans ({a.trackABriefing} students):</b> profiles led by neither building nor
          analysis — their plans route through their actual strengths. Brief the counsellors: this is
          orientation, never a deficit label.
        </p>
      )}
      <ActionBox actions={p.actions.queue} />
      <Commentary page={notes.get("queue")} />
      <PageFooter text={footer} />
    </Screen>
  );
};
