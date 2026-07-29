import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../modules/auth";
import { useInstitutes } from "../../lib/queries/lookups";
import { showErrorToast } from "../../utils/toast";
import {
  AbilityRow,
  ClusterRow,
  getSchoolDashboard,
  SchoolDashboardView,
} from "./SchoolDashboard_APIs";
import "./SchoolDashboard.css";

// recharts' polar typings fight TS in this version — the same escape hatch
// PrincipalDashboard uses.
const PolarAngleAxisFixed = PolarAngleAxis as any;
const PolarRadiusAxisFixed = PolarRadiusAxis as any;

type Scope = { i?: number | null };

// ── Palette ───────────────────────────────────────────────────────────────
// Resolved from the CSS custom properties in SchoolDashboard.css so the
// stylesheet stays the single source of truth. The values below are only the
// pre-mount fallback; both light and dark sets were run through the data-viz
// palette validator (the app is currently light-locked, but the dark block in
// the stylesheet keeps the page correct if that is ever lifted).
const FALLBACK = {
  s1: "#2a78d6",
  s2: "#eb6834",
  s3: "#1baf7a",
  divPos: "#2a78d6",
  divNeg: "#e34948",
  divMid: "#f0efec",
  seq: ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"],
  good: "#0ca30c",
  warning: "#fab219",
  muted: "#8a8a96",
  grid: "#eceef4",
  ink: "#16161d",
  inkMuted: "#8a8a96",
  surface: "#ffffff",
};

type Palette = typeof FALLBACK;

function useVizPalette(ref: React.RefObject<HTMLElement>): Palette {
  const [palette, setPalette] = useState<Palette>(FALLBACK);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const read = (name: string, fallback: string) =>
      cs.getPropertyValue(name).trim() || fallback;
    setPalette({
      s1: read("--series-1", FALLBACK.s1),
      s2: read("--series-2", FALLBACK.s2),
      s3: read("--series-3", FALLBACK.s3),
      divPos: read("--div-pos", FALLBACK.divPos),
      divNeg: read("--div-neg", FALLBACK.divNeg),
      divMid: read("--div-mid", FALLBACK.divMid),
      seq: [
        read("--seq-100", FALLBACK.seq[0]),
        read("--seq-250", FALLBACK.seq[1]),
        read("--seq-400", FALLBACK.seq[2]),
        read("--seq-550", FALLBACK.seq[3]),
        read("--seq-700", FALLBACK.seq[4]),
      ],
      good: read("--status-good", FALLBACK.good),
      warning: read("--status-warning", FALLBACK.warning),
      muted: read("--status-muted", FALLBACK.muted),
      grid: read("--grid", FALLBACK.grid),
      ink: read("--ink-primary", FALLBACK.ink),
      inkMuted: read("--ink-muted", FALLBACK.inkMuted),
      surface: read("--surface", FALLBACK.surface),
    });
  }, [ref]);
  return palette;
}

// ── Small building blocks ─────────────────────────────────────────────────

const TABS = ["Overview", "Personality & Learning", "Abilities", "Careers", "By Class"] as const;
type Tab = typeof TABS[number];

const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent: string;
  meterPct?: number;
}> = ({ label, value, sub, accent, meterPct }) => (
  <div className="sd-kpi" style={{ ["--kpi-accent" as any]: accent }}>
    <div className="sd-kpi-label">
      <span
        className="sd-legend-dot"
        style={{ background: accent }}
        aria-hidden="true"
      />
      {label}
    </div>
    <div className="sd-kpi-value">{value}</div>
    {sub != null && <div className="sd-kpi-sub">{sub}</div>}
    {meterPct != null && (
      <div className="sd-meter">
        <div
          className="sd-meter-fill"
          style={{ width: `${Math.max(0, Math.min(100, meterPct))}%`, ["--meter-color" as any]: accent }}
        />
      </div>
    )}
  </div>
);

/** A chart and its WCAG-clean table twin, toggled per card. */
const ChartCard: React.FC<{
  title: string;
  subtitle?: string;
  table: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, table, children }) => {
  const [showTable, setShowTable] = useState(false);
  return (
    <div className="sd-card">
      <div className="sd-card-head">
        <div>
          <h3 className="sd-card-title">{title}</h3>
          {subtitle && <p className="sd-card-sub">{subtitle}</p>}
        </div>
        <button
          type="button"
          className="sd-toggle"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
        >
          {showTable ? "Chart" : "Table"}
        </button>
      </div>
      {showTable ? <div className="sd-table-wrap">{table}</div> : children}
    </div>
  );
};

const Legend: React.FC<{ items: { label: string; color: string }[] }> = ({ items }) => (
  <div className="sd-legend">
    {items.map((it) => (
      <span className="sd-legend-item" key={it.label}>
        <span className="sd-legend-dot" style={{ background: it.color }} aria-hidden="true" />
        {it.label}
      </span>
    ))}
  </div>
);

const TipBox: React.FC<{ title: string; rows: { label: string; value: string; color?: string }[] }> = ({
  title,
  rows,
}) => (
  <div className="sd-tooltip">
    <div className="sd-tooltip-title">{title}</div>
    {rows.map((r) => (
      <div className="sd-tooltip-row" key={r.label}>
        {r.color && <span className="sd-legend-dot" style={{ background: r.color }} aria-hidden="true" />}
        {r.label}: <strong>{r.value}</strong>
      </div>
    ))}
  </div>
);

/** Strips the "(Realistic)" tail the workbook appends to report labels. */
const shortLabel = (label: string) => label.split("  (")[0].trim();

const CHART_MARGIN = { top: 8, right: 28, bottom: 8, left: 8 };

// ── Page ──────────────────────────────────────────────────────────────────

const SchoolDashboardPage: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const palette = useVizPalette(rootRef);

  const { currentUser } = useAuth();
  const userScopes: Scope[] = useMemo(() => currentUser?.scopes ?? [], [currentUser]);
  const isSuperAdmin = currentUser?.superAdmin === true;

  // null = unrestricted (super-admin, no scope rows, or an institute wildcard).
  const allowedInstituteIds = useMemo<Set<number> | null>(() => {
    if (isSuperAdmin) return null;
    if (!userScopes.length) return null;
    if (userScopes.some((s) => s.i == null)) return null;
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

  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");
  const [classFilter, setClassFilter] = useState("All");
  const [view, setView] = useState<SchoolDashboardView | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("Overview");

  // A single institute in scope needs no picking.
  useEffect(() => {
    if (institutes.length === 1 && selectedInstitute === "") {
      setSelectedInstitute(Number(institutes[0].instituteCode));
    }
  }, [institutes, selectedInstitute]);

  useEffect(() => {
    if (selectedInstitute === "") {
      setView(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getSchoolDashboard(Number(selectedInstitute), classFilter)
      .then((res) => {
        if (!cancelled) setView(res.data);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setView(null);
        showErrorToast(
          "Could not load the dashboard: " + (err?.response?.data?.error || err.message)
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedInstitute, classFilter]);

  // Switching school resets the class filter — class 11 in one school says
  // nothing about the next, and a stale filter would silently narrow the load.
  useEffect(() => {
    setClassFilter("All");
  }, [selectedInstitute]);

  const d = view?.dashboard ?? null;
  const p = view?.participation;

  return (
    <div className="school-dashboard" ref={rootRef}>
      <header className="sd-header">
        <div className="sd-header-top">
          <div>
            <h1 className="sd-title">School Dashboard</h1>
            <p className="sd-subtitle">
              What the Navigator360 results say about this school — participation, the
              personality and ability profile of the cohort, and where students&rsquo;
              ambitions line up with what they are suited to.
            </p>
          </div>
          <div className="sd-institute-picker">
            <label htmlFor="sd-institute">School</label>
            <select
              id="sd-institute"
              value={selectedInstitute}
              onChange={(e) =>
                setSelectedInstitute(e.target.value === "" ? "" : Number(e.target.value))
              }
              disabled={institutesLoading}
            >
              <option value="">
                {institutesLoading ? "Loading schools…" : "Select a school"}
              </option>
              {institutes.map((i: any) => (
                <option key={i.instituteCode} value={i.instituteCode}>
                  {i.instituteName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {selectedInstitute === "" ? (
        <div className="sd-empty">
          <div className="sd-empty-title">Pick a school to begin</div>
          Choose a school above and its full assessment picture loads here.
        </div>
      ) : !view && loading ? (
        <div className="sd-empty">
          <div className="sd-empty-title">Building the dashboard…</div>
          Scoring every completed assessment in this school.
        </div>
      ) : !view ? (
        <div className="sd-empty">
          <div className="sd-empty-title">Nothing to show</div>
          This school has no assessment data yet.
        </div>
      ) : (
        <div className={loading ? "sd-refetching" : undefined}>
          <ParticipationCards view={view} palette={palette} />

          {d && (
            <>
              {/* One filter row above everything it scopes. */}
              <div className="sd-filters">
                <div className="sd-filter-group">
                  <span>Class</span>
                  <button
                    type="button"
                    className={`sd-chip${classFilter === "All" ? " is-active" : ""}`}
                    onClick={() => setClassFilter("All")}
                  >
                    All
                  </button>
                  {(view.classesPresent ?? []).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`sd-chip${classFilter === String(c) ? " is-active" : ""}`}
                      onClick={() => setClassFilter(String(c))}
                    >
                      Class {c}
                    </button>
                  ))}
                </div>
                <span className="sd-filter-note">
                  {d.summary.studentsInView} student
                  {d.summary.studentsInView === 1 ? "" : "s"} in view
                  {classFilter !== "All" && " · participation cards stay school-wide"}
                </span>
              </div>

              <nav className="sd-tabs">
                {TABS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`sd-tab${tab === t ? " is-active" : ""}`}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </nav>
            </>
          )}

          {!d ? (
            <div className="sd-empty">
              <div className="sd-empty-title">No completed assessments yet</div>
              {p && p.total > 0
                ? `${p.ongoing + p.notStarted} of ${p.total} assessments are still open. The insight sections appear as soon as the first student submits.`
                : "Assign an assessment to this school to get started."}
            </div>
          ) : (
            <>
              {tab === "Overview" && <OverviewTab view={view} palette={palette} />}
              {tab === "Personality & Learning" && <PersonalityTab view={view} palette={palette} />}
              {tab === "Abilities" && <AbilitiesTab view={view} palette={palette} />}
              {tab === "Careers" && <CareersTab view={view} palette={palette} />}
              {tab === "By Class" && <ByClassTab view={view} palette={palette} />}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── Participation ─────────────────────────────────────────────────────────

const ParticipationCards: React.FC<{ view: SchoolDashboardView; palette: Palette }> = ({
  view,
  palette,
}) => {
  const p = view.participation;
  return (
    <>
      <div className="sd-kpi-row">
        <StatTile
          label="Total students"
          value={view.distinctStudents.toLocaleString()}
          sub={`${p.total.toLocaleString()} assessment${p.total === 1 ? "" : "s"} assigned in total`}
          accent={palette.s1}
        />
        <StatTile
          label="Completed"
          value={p.completed.toLocaleString()}
          sub={`${p.completedPct}% of all assigned assessments`}
          accent={palette.good}
          meterPct={p.completedPct}
        />
        <StatTile
          label="Ongoing"
          value={p.ongoing.toLocaleString()}
          sub="Started but not submitted"
          accent={palette.warning}
        />
        <StatTile
          label="Not started"
          value={p.notStarted.toLocaleString()}
          sub="Assigned, never opened"
          accent={palette.muted}
        />
      </div>

      <div className="sd-grid">
        <div className="sd-card">
          <div className="sd-card-head">
            <div>
              <h3 className="sd-card-title">Progress by assessment</h3>
              <p className="sd-card-sub">
                Every assessment assigned in this school. Counts are
                student&ndash;assessment pairs, so a student sitting three assessments
                appears three times.
              </p>
            </div>
          </div>
          {view.assessments.map((a) => {
            const seg = (n: number) => (a.total ? (n / a.total) * 100 : 0);
            return (
              <div className="sd-assessment-row" key={a.assessmentId}>
                <div className="sd-assessment-head">
                  <span className="sd-assessment-name">{a.assessmentName}</span>
                  <span className="sd-assessment-meta">
                    {a.completed} of {a.total} complete ({a.completedPct}%)
                    {a.scored > 0 && ` · ${a.scored} scored`}
                  </span>
                </div>
                <div
                  className="sd-stack"
                  role="img"
                  aria-label={`${a.assessmentName}: ${a.completed} completed, ${a.ongoing} ongoing, ${a.notStarted} not started`}
                >
                  {a.completed > 0 && (
                    <div
                      className="sd-stack-seg"
                      style={{ width: `${seg(a.completed)}%`, background: palette.good }}
                      title={`Completed: ${a.completed}`}
                    >
                      {seg(a.completed) > 9 ? a.completed : ""}
                    </div>
                  )}
                  {a.ongoing > 0 && (
                    <div
                      className="sd-stack-seg"
                      style={{ width: `${seg(a.ongoing)}%`, background: palette.warning, color: "#16161d" }}
                      title={`Ongoing: ${a.ongoing}`}
                    >
                      {seg(a.ongoing) > 9 ? a.ongoing : ""}
                    </div>
                  )}
                  {a.notStarted > 0 && (
                    <div
                      className="sd-stack-seg"
                      style={{ width: `${seg(a.notStarted)}%`, background: palette.muted }}
                      title={`Not started: ${a.notStarted}`}
                    >
                      {seg(a.notStarted) > 9 ? a.notStarted : ""}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <Legend
            items={[
              { label: "Completed", color: palette.good },
              { label: "Ongoing", color: palette.warning },
              { label: "Not started", color: palette.muted },
            ]}
          />
          {view.unscoredStudents > 0 && (
            <div className="sd-note">
              <strong>{view.unscoredStudents}</strong> completed assessment
              {view.unscoredStudents === 1 ? "" : "s"} could not be scored — usually a
              partial submission missing whole sections. Those students are counted as
              complete above but are left out of the insight sections below, which are
              built from <strong>{view.scoredStudents}</strong> scored profile
              {view.scoredStudents === 1 ? "" : "s"}.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ── Overview ──────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ view: SchoolDashboardView; palette: Palette }> = ({
  view,
  palette,
}) => {
  const d = view.dashboard!;
  const s = d.summary;
  const clarityGap = d.careerGap.streams.reduce(
    (worst, r) => (Math.abs(r.gap) > Math.abs(worst.gap) ? r : worst),
    d.careerGap.streams[0]
  );

  const classData = s.studentsByClass
    .filter((c) => c.students > 0)
    .map((c) => ({ name: `Class ${c.studentClass}`, students: c.students, pct: c.pctOfSchool }));

  return (
    <>
      <div className="sd-grid">
        <div className="sd-card">
          <div className="sd-card-head">
            <div>
              <h3 className="sd-card-title">The school in one line</h3>
              <p className="sd-card-sub">
                The single strongest signal in each dimension across{" "}
                {s.studentsInView} scored student{s.studentsInView === 1 ? "" : "s"}.
              </p>
            </div>
          </div>
          <div className="sd-headline-grid">
            {[
              ["Dominant personality", shortLabel(s.dominantPersonality)],
              ["Second personality", shortLabel(s.secondPersonality)],
              ["Dominant learning style", shortLabel(s.dominantLearningStyle)],
              ["Weakest learning style", shortLabel(s.weakestLearningStyle)],
              ["Strongest ability", s.strongestAbility],
              ["Most common weak ability", s.weakestAbility],
              ["Top work value", s.topValue],
              ["Best-fit stream", s.bestFitStream],
              ["Most-wanted stream", s.mostWantedStream],
            ].map(([label, value]) => (
              <div className="sd-headline" key={label}>
                <div className="sd-headline-label">{label}</div>
                <div className="sd-headline-value">{value || "—"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sd-kpi-row">
        <StatTile
          label="Career clarity"
          value={`${s.careerClarityPct}%`}
          sub="Have at least one aspiration that matches what they are suited to"
          accent={palette.s1}
          meterPct={s.careerClarityPct}
        />
        <StatTile
          label="Matched aspirations"
          value={s.avgMatchedAspirations.toFixed(2)}
          sub="Average per student, out of 4 chosen"
          accent={palette.s1}
          meterPct={(s.avgMatchedAspirations / 4) * 100}
        />
        <StatTile
          label="Girls / Boys"
          value={`${s.girls} / ${s.boys}`}
          sub={
            s.girls + s.boys === 0
              ? "No gender recorded"
              : `${Math.round((s.girls / Math.max(1, s.girls + s.boys)) * 100)}% girls`
          }
          accent={palette.s2}
        />
        <StatTile
          label="Carrying 5+ weak abilities"
          value={`${d.abilities.pctWith5PlusWeak}%`}
          sub={`${d.abilities.studentsWith5PlusWeak} student${
            d.abilities.studentsWith5PlusWeak === 1 ? "" : "s"
          } scored 8 or under on five or more abilities`}
          accent={palette.s2}
          meterPct={d.abilities.pctWith5PlusWeak}
        />
      </div>

      <div className="sd-grid cols-2">
        <ChartCard
          title="Students by class"
          subtitle="How the scored cohort is spread across the school."
          table={
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th className="num">Students</th>
                  <th className="num">% of school</th>
                </tr>
              </thead>
              <tbody>
                {classData.map((c) => (
                  <tr key={c.name}>
                    <td className="name">{c.name}</td>
                    <td className="num">{c.students}</td>
                    <td className="num">{c.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <ResponsiveContainer width="100%" height={260} className="sd-chart">
            <BarChart data={classData} margin={CHART_MARGIN}>
              <CartesianGrid stroke={palette.grid} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: palette.inkMuted, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.grid }}
              />
              <YAxis
                tick={{ fill: palette.inkMuted, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: palette.grid, fillOpacity: 0.45 }}
                content={({ active, payload, label }: any) =>
                  active && payload?.length ? (
                    <TipBox
                      title={String(label)}
                      rows={[
                        { label: "Students", value: String(payload[0].value), color: palette.s1 },
                        { label: "Share of school", value: `${payload[0].payload.pct}%` },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="students" fill={palette.s1} radius={[4, 4, 0, 0]} maxBarSize={46}>
                <LabelList
                  dataKey="students"
                  position="top"
                  fill={palette.inkMuted}
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Fit versus ambition, by stream"
          subtitle="Suited is what their profile points to. Aspiring is what they picked. The distance between the two is the school's guidance workload."
          table={
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Stream</th>
                  <th className="num">Suited %</th>
                  <th className="num">Aspiring %</th>
                  <th className="num">Gap</th>
                </tr>
              </thead>
              <tbody>
                {d.careerGap.streams.map((r) => (
                  <tr key={r.label}>
                    <td className="name">{r.label}</td>
                    <td className="num">{r.suitedPct}%</td>
                    <td className="num">{r.aspiringPct}%</td>
                    <td className="num">
                      {r.gap > 0 ? "+" : ""}
                      {r.gap}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <ResponsiveContainer width="100%" height={260} className="sd-chart">
            <BarChart data={d.careerGap.streams} margin={CHART_MARGIN} barGap={2}>
              <CartesianGrid stroke={palette.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: palette.inkMuted, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.grid }}
              />
              <YAxis
                tick={{ fill: palette.inkMuted, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                unit="%"
              />
              <Tooltip
                cursor={{ fill: palette.grid, fillOpacity: 0.45 }}
                content={({ active, payload, label }: any) =>
                  active && payload?.length ? (
                    <TipBox
                      title={String(label)}
                      rows={[
                        { label: "Suited", value: `${payload[0].payload.suitedPct}%`, color: palette.s1 },
                        { label: "Aspiring", value: `${payload[0].payload.aspiringPct}%`, color: palette.s2 },
                        {
                          label: "Gap",
                          value: `${payload[0].payload.gap > 0 ? "+" : ""}${payload[0].payload.gap}`,
                        },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="suitedPct" fill={palette.s1} radius={[4, 4, 0, 0]} maxBarSize={40}>
                <LabelList dataKey="suitedPct" position="top" fill={palette.inkMuted} fontSize={11} formatter={(v: any) => `${v}%`} />
              </Bar>
              <Bar dataKey="aspiringPct" fill={palette.s2} radius={[4, 4, 0, 0]} maxBarSize={40}>
                <LabelList dataKey="aspiringPct" position="top" fill={palette.inkMuted} fontSize={11} formatter={(v: any) => `${v}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <Legend
            items={[
              { label: "Suited", color: palette.s1 },
              { label: "Aspiring", color: palette.s2 },
            ]}
          />
          {clarityGap && clarityGap.gap !== 0 && (
            <div className="sd-note">
              <strong>{clarityGap.label}</strong> is the widest mismatch:{" "}
              {clarityGap.aspiringPct}% of students want it while {clarityGap.suitedPct}% fit
              it{clarityGap.gap > 0
                ? " — expect competition for seats and some disappointment at results time."
                : " — a stream the school is under-selling to students who would do well in it."}
            </div>
          )}
        </ChartCard>
      </div>
    </>
  );
};

// ── Personality & Learning ────────────────────────────────────────────────

const PersonalityTab: React.FC<{ view: SchoolDashboardView; palette: Palette }> = ({
  view,
  palette,
}) => {
  const d = view.dashboard!;
  const traits = d.personality.traits.map((t) => ({
    ...t,
    short: shortLabel(t.label),
  }));
  const intelligences = d.learningStyle.intelligences.map((i) => ({
    ...i,
    short: shortLabel(i.label),
  }));

  return (
    <>
      <div className="sd-grid cols-2">
        <ChartCard
          title="Personality profile"
          subtitle="Average raw RIASEC score across the cohort — the shape of the school's temperament."
          table={
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Trait</th>
                  <th className="num">Avg score</th>
                  <th className="num">% top trait</th>
                  <th className="num">% in top three</th>
                </tr>
              </thead>
              <tbody>
                {traits.map((t) => (
                  <tr key={t.label}>
                    <td className="name">{t.label}</td>
                    <td className="num">{t.avgRawScore.toFixed(1)}</td>
                    <td className="num">{t.pctAsTopTrait}%</td>
                    <td className="num">{t.pctInTopThree}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <ResponsiveContainer width="100%" height={300} className="sd-chart">
            <RadarChart data={traits} outerRadius="72%">
              <PolarGrid stroke={palette.grid} />
              <PolarAngleAxisFixed
                dataKey="short"
                tick={{ fill: palette.inkMuted, fontSize: 12 }}
              />
              <PolarRadiusAxisFixed
                tick={{ fill: palette.inkMuted, fontSize: 10 }}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }: any) =>
                  active && payload?.length ? (
                    <TipBox
                      title={payload[0].payload.short}
                      rows={[
                        {
                          label: "Average score",
                          value: payload[0].payload.avgRawScore.toFixed(1),
                          color: palette.s1,
                        },
                        { label: "Top trait for", value: `${payload[0].payload.studentsTopTrait} students` },
                      ]}
                    />
                  ) : null
                }
              />
              <Radar
                dataKey="avgRawScore"
                stroke={palette.s1}
                strokeWidth={2}
                fill={palette.s1}
                fillOpacity={0.18}
              />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Which trait leads"
          subtitle="Share of students with each trait as their strongest, and anywhere in their top three."
          table={
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Trait</th>
                  <th className="num">Top trait</th>
                  <th className="num">In top three</th>
                  <th className="num">Students</th>
                </tr>
              </thead>
              <tbody>
                {traits.map((t) => (
                  <tr key={t.label}>
                    <td className="name">{t.label}</td>
                    <td className="num">{t.pctAsTopTrait}%</td>
                    <td className="num">{t.pctInTopThree}%</td>
                    <td className="num">{t.studentsTopTrait}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <ResponsiveContainer width="100%" height={300} className="sd-chart">
            <BarChart data={traits} layout="vertical" margin={{ ...CHART_MARGIN, left: 24 }} barGap={2}>
              <CartesianGrid stroke={palette.grid} horizontal={false} />
              <XAxis
                type="number"
                unit="%"
                tick={{ fill: palette.inkMuted, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.grid }}
              />
              <YAxis
                type="category"
                dataKey="short"
                width={86}
                tick={{ fill: palette.inkMuted, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: palette.grid, fillOpacity: 0.45 }}
                content={({ active, payload }: any) =>
                  active && payload?.length ? (
                    <TipBox
                      title={payload[0].payload.short}
                      rows={[
                        { label: "Top trait", value: `${payload[0].payload.pctAsTopTrait}%`, color: palette.s1 },
                        { label: "In top three", value: `${payload[0].payload.pctInTopThree}%`, color: palette.s2 },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="pctAsTopTrait" fill={palette.s1} radius={[0, 4, 4, 0]} maxBarSize={16}>
                <LabelList dataKey="pctAsTopTrait" position="right" fill={palette.inkMuted} fontSize={11} formatter={(v: any) => `${v}%`} />
              </Bar>
              <Bar dataKey="pctInTopThree" fill={palette.s2} radius={[0, 4, 4, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
          <Legend
            items={[
              { label: "Strongest trait", color: palette.s1 },
              { label: "Anywhere in top three", color: palette.s2 },
            ]}
          />
          <div className="sd-note">
            Spread is <strong>{d.personality.spread} points</strong> between the most and
            least common leading trait, with{" "}
            <strong>{d.personality.traitsAbove20}</strong> trait
            {d.personality.traitsAbove20 === 1 ? "" : "s"} above 20%.{" "}
            {d.personality.spread <= 15
              ? "That is a broad, mixed cohort — no single temperament dominates."
              : "That is a concentrated cohort — teaching and career talks pitched at the leading trait will land with most of the room, and miss the tail badly."}
          </div>
        </ChartCard>
      </div>

      <div className="sd-grid">
        <ChartCard
          title="Learning styles"
          subtitle="Share scoring strong (10+ out of 12) against share scoring low (8 or under) on each of the eight intelligences. A student scoring 9 is in neither."
          table={
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Intelligence</th>
                  <th className="num">% strong</th>
                  <th className="num">% low</th>
                  <th className="num">Avg score</th>
                  <th className="num">Strong</th>
                  <th className="num">Low</th>
                </tr>
              </thead>
              <tbody>
                {intelligences.map((i) => (
                  <tr key={i.label}>
                    <td className="name">{i.label}</td>
                    <td className="num">{i.pctStrong}%</td>
                    <td className="num">{i.pctLow}%</td>
                    <td className="num">{i.avgScore.toFixed(1)}</td>
                    <td className="num">{i.studentsStrong}</td>
                    <td className="num">{i.studentsLow}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <ResponsiveContainer width="100%" height={340} className="sd-chart">
            <BarChart data={intelligences} layout="vertical" margin={{ ...CHART_MARGIN, left: 24 }} barGap={2}>
              <CartesianGrid stroke={palette.grid} horizontal={false} />
              <XAxis
                type="number"
                unit="%"
                tick={{ fill: palette.inkMuted, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.grid }}
              />
              <YAxis
                type="category"
                dataKey="short"
                width={102}
                tick={{ fill: palette.inkMuted, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: palette.grid, fillOpacity: 0.45 }}
                content={({ active, payload }: any) =>
                  active && payload?.length ? (
                    <TipBox
                      title={payload[0].payload.short}
                      rows={[
                        { label: "Strong", value: `${payload[0].payload.pctStrong}%`, color: palette.s1 },
                        { label: "Low", value: `${payload[0].payload.pctLow}%`, color: palette.s2 },
                        { label: "Average score", value: payload[0].payload.avgScore.toFixed(1) },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="pctStrong" fill={palette.s1} radius={[0, 4, 4, 0]} maxBarSize={14}>
                <LabelList dataKey="pctStrong" position="right" fill={palette.inkMuted} fontSize={11} formatter={(v: any) => `${v}%`} />
              </Bar>
              <Bar dataKey="pctLow" fill={palette.s2} radius={[0, 4, 4, 0]} maxBarSize={14}>
                <LabelList dataKey="pctLow" position="right" fill={palette.inkMuted} fontSize={11} formatter={(v: any) => `${v}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <Legend
            items={[
              { label: "Strong (10+)", color: palette.s1 },
              { label: "Low (8 or under)", color: palette.s2 },
            ]}
          />
        </ChartCard>
      </div>
    </>
  );
};

// ── Abilities ─────────────────────────────────────────────────────────────

const AbilitiesTab: React.FC<{ view: SchoolDashboardView; palette: Palette }> = ({
  view,
  palette,
}) => {
  const d = view.dashboard!;
  // Sorted by gap so the teaching priorities sit at one end.
  const sorted: AbilityRow[] = [...d.abilities.abilities].sort((a, b) => b.gap - a.gap);
  const worst = sorted[0];

  return (
    <>
      <div className="sd-kpi-row">
        <StatTile
          label="Strong abilities per student"
          value={d.abilities.avgAbilities10Plus.toFixed(1)}
          sub="Average count scoring 10 or more, out of 10"
          accent={palette.s1}
          meterPct={d.abilities.avgAbilities10Plus * 10}
        />
        <StatTile
          label="Weak abilities per student"
          value={d.abilities.avgAbilities8OrLess.toFixed(1)}
          sub="Average count scoring 8 or under, out of 10"
          accent={palette.s2}
          meterPct={d.abilities.avgAbilities8OrLess * 10}
        />
        <StatTile
          label="Students needing support"
          value={d.abilities.studentsWith5PlusWeak.toLocaleString()}
          sub={`${d.abilities.pctWith5PlusWeak}% carry five or more weak abilities`}
          accent={palette.s2}
          meterPct={d.abilities.pctWith5PlusWeak}
        />
        <StatTile
          label="Widest ability gap"
          value={worst ? `+${worst.gap}` : "—"}
          sub={worst ? worst.label : "No ability data"}
          accent={palette.divNeg}
        />
      </div>

      <div className="sd-grid">
        <ChartCard
          title="Where the cohort is weak, ability by ability"
          subtitle="Gap = share scoring low minus share scoring strong. Bars to the right are abilities where far more students struggle than excel; bars to the left are genuine strengths."
          table={
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Ability</th>
                  <th className="num">% strong</th>
                  <th className="num">% low</th>
                  <th className="num">Gap</th>
                  <th className="num">Avg score</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => (
                  <tr key={a.label}>
                    <td className="name">{a.label}</td>
                    <td className="num">{a.pctStrong}%</td>
                    <td className="num">{a.pctLow}%</td>
                    <td className="num">
                      {a.gap > 0 ? "+" : ""}
                      {a.gap}
                    </td>
                    <td className="num">{a.avgScore.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <ResponsiveContainer width="100%" height={380} className="sd-chart">
            <BarChart data={sorted} layout="vertical" margin={{ ...CHART_MARGIN, left: 24 }}>
              <CartesianGrid stroke={palette.grid} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: palette.inkMuted, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.grid }}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={188}
                tick={{ fill: palette.inkMuted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <ReferenceLine x={0} stroke={palette.inkMuted} />
              <Tooltip
                cursor={{ fill: palette.grid, fillOpacity: 0.45 }}
                content={({ active, payload }: any) =>
                  active && payload?.length ? (
                    <TipBox
                      title={payload[0].payload.label}
                      rows={[
                        { label: "Strong", value: `${payload[0].payload.pctStrong}%` },
                        { label: "Low", value: `${payload[0].payload.pctLow}%` },
                        {
                          label: "Gap",
                          value: `${payload[0].payload.gap > 0 ? "+" : ""}${payload[0].payload.gap}`,
                          color: payload[0].payload.gap >= 0 ? palette.divNeg : palette.divPos,
                        },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="gap" radius={3} maxBarSize={18}>
                {sorted.map((a) => (
                  <Cell key={a.label} fill={a.gap >= 0 ? palette.divNeg : palette.divPos} />
                ))}
                <LabelList
                  dataKey="gap"
                  position="right"
                  fill={palette.inkMuted}
                  fontSize={11}
                  formatter={(v: any) => (v > 0 ? `+${v}` : String(v))}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <Legend
            items={[
              { label: "More students weak than strong", color: palette.divNeg },
              { label: "More students strong than weak", color: palette.divPos },
            ]}
          />
          {worst && worst.gap > 0 && (
            <div className="sd-note">
              <strong>{worst.label}</strong> is the school's biggest ability deficit —{" "}
              {worst.pctLow}% score low against {worst.pctStrong}% scoring strong. If you
              run one remedial programme this year, this is the one with the widest reach.
            </div>
          )}
        </ChartCard>
      </div>
    </>
  );
};

// ── Careers ───────────────────────────────────────────────────────────────

const CareersTab: React.FC<{ view: SchoolDashboardView; palette: Palette }> = ({
  view,
  palette,
}) => {
  const d = view.dashboard!;
  const values = [...d.values.values].sort((a, b) => b.pctInTopFive - a.pctInTopFive);
  // Only clusters somebody engaged with; the rest are noise at school level.
  const clusters: ClusterRow[] = [...d.careerGap.clusters]
    .filter((c) => c.aspiring > 0 || c.suitedTop3 > 0)
    .sort((a, b) => b.gap - a.gap);
  const maxAbsGap = Math.max(1, ...clusters.map((c) => Math.abs(c.gap)));

  return (
    <>
      <div className="sd-grid">
        <ChartCard
          title="What students want out of work"
          subtitle="Share placing each value anywhere in their top five. This is the language that lands in assemblies and parent evenings."
          table={
            <table className="sd-table">
              <thead>
                <tr>
                  <th className="num">Rank</th>
                  <th>Value</th>
                  <th className="num">% in top five</th>
                  <th className="num">Students</th>
                </tr>
              </thead>
              <tbody>
                {values.map((v) => (
                  <tr key={v.label}>
                    <td className="num">{v.rank ?? "—"}</td>
                    <td className="name">{v.label}</td>
                    <td className="num">{v.pctInTopFive}%</td>
                    <td className="num">{v.students}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <ResponsiveContainer width="100%" height={430} className="sd-chart">
            <BarChart data={values} layout="vertical" margin={{ ...CHART_MARGIN, left: 24 }}>
              <CartesianGrid stroke={palette.grid} horizontal={false} />
              <XAxis
                type="number"
                unit="%"
                tick={{ fill: palette.inkMuted, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.grid }}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={150}
                tick={{ fill: palette.inkMuted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: palette.grid, fillOpacity: 0.45 }}
                content={({ active, payload }: any) =>
                  active && payload?.length ? (
                    <TipBox
                      title={payload[0].payload.label}
                      rows={[
                        { label: "In top five for", value: `${payload[0].payload.pctInTopFive}%`, color: palette.s1 },
                        { label: "Students", value: String(payload[0].payload.students) },
                        { label: "Rank", value: String(payload[0].payload.rank ?? "—") },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="pctInTopFive" fill={palette.s1} radius={[0, 4, 4, 0]} maxBarSize={16}>
                <LabelList dataKey="pctInTopFive" position="right" fill={palette.inkMuted} fontSize={11} formatter={(v: any) => `${v}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="sd-grid">
        <div className="sd-card">
          <div className="sd-card-head">
            <div>
              <h3 className="sd-card-title">Career clusters — supply against demand</h3>
              <p className="sd-card-sub">
                Suited counts students with the cluster in their top three matches;
                aspiring counts students who named it. Readiness is, of the students who
                want it, the share whose own profile backs them up. Clusters nobody
                touched are hidden.
              </p>
            </div>
          </div>
          <div className="sd-table-wrap">
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Career cluster</th>
                  <th>Stream</th>
                  <th className="num">Suited</th>
                  <th className="num">Aspiring</th>
                  <th style={{ minWidth: 150 }}>Gap</th>
                  <th className="num">Readiness</th>
                </tr>
              </thead>
              <tbody>
                {clusters.map((c) => {
                  const width = (Math.abs(c.gap) / maxAbsGap) * 50;
                  return (
                    <tr key={c.label}>
                      <td className="name">{c.label}</td>
                      <td>{c.stream}</td>
                      <td className="num">{c.suitedTop3}</td>
                      <td className="num">{c.aspiring}</td>
                      <td>
                        <div className="sd-bar-cell">
                          <div className="sd-bar-track">
                            <div
                              className="sd-bar-fill"
                              style={{
                                width: `${width}%`,
                                left: c.gap >= 0 ? "50%" : `${50 - width}%`,
                                background: c.gap >= 0 ? palette.divNeg : palette.divPos,
                              }}
                            />
                          </div>
                          <span style={{ minWidth: 26, textAlign: "right" }}>
                            {c.gap > 0 ? "+" : ""}
                            {c.gap}
                          </span>
                        </div>
                      </td>
                      <td className="num">{c.readinessPct == null ? "—" : `${c.readinessPct}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Legend
            items={[
              { label: "Over-subscribed (more want it than fit it)", color: palette.divNeg },
              { label: "Under-subscribed (more fit it than want it)", color: palette.divPos },
            ]}
          />
        </div>
      </div>
    </>
  );
};

// ── By class ──────────────────────────────────────────────────────────────

const ByClassTab: React.FC<{ view: SchoolDashboardView; palette: Palette }> = ({
  view,
  palette,
}) => {
  const d = view.dashboard!;
  const b = d.byClass;
  // Classes with nobody in them would render as a column of empty cells.
  const idx = b.classes.map((_, i) => i).filter((i) => b.students[i] > 0);
  const classes = idx.map((i) => b.classes[i]);

  const clarityData = idx.map((i) => ({
    name: `Class ${b.classes[i]}`,
    clarity: b.careerClarityPct[i],
    students: b.students[i],
    weak: b.fiveOrMoreWeakAbilities[i],
  }));

  const heat = (pct: number) => {
    // Sequential single hue, light→dark. Bands, not a continuous gradient, so
    // adjacent values stay tellable apart.
    if (pct >= 40) return { bg: palette.seq[4], fg: "#ffffff" };
    if (pct >= 30) return { bg: palette.seq[3], fg: "#ffffff" };
    if (pct >= 20) return { bg: palette.seq[2], fg: "#ffffff" };
    if (pct >= 10) return { bg: palette.seq[1], fg: "#16161d" };
    return { bg: palette.seq[0], fg: "#16161d" };
  };

  const heatmap = (title: string, subtitle: string, series: { label: string; values: number[] }[]) => (
    <div className="sd-card">
      <div className="sd-card-head">
        <div>
          <h3 className="sd-card-title">{title}</h3>
          <p className="sd-card-sub">{subtitle}</p>
        </div>
      </div>
      <div className="sd-table-wrap">
        <div
          className="sd-heatmap"
          style={{ gridTemplateColumns: `minmax(150px, auto) repeat(${classes.length}, minmax(52px, 1fr))` }}
        >
          <div />
          {classes.map((c) => (
            <div className="sd-heat-head" key={c}>
              Class {c}
            </div>
          ))}
          {series.map((s) => (
            <React.Fragment key={s.label}>
              <div className="sd-heat-row-label">{s.label.trim()}</div>
              {idx.map((i) => {
                const v = s.values[i];
                const { bg, fg } = heat(v);
                return (
                  <div
                    className="sd-heat-cell"
                    key={`${s.label}-${i}`}
                    style={{ background: bg, color: fg }}
                    title={`${s.label.trim()} · Class ${b.classes[i]}: ${v}%`}
                  >
                    {v}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="sd-scale">
        <span>0%</span>
        <div className="sd-scale-swatches">
          {palette.seq.map((c) => (
            <span className="sd-scale-swatch" key={c} style={{ background: c }} />
          ))}
        </div>
        <span>40%+</span>
        <span style={{ marginLeft: 8 }}>Every cell is a percentage of that class.</span>
      </div>
    </div>
  );

  return (
    <>
      <div className="sd-grid">
        <ChartCard
          title="Career clarity by class"
          subtitle="Share of each class with at least one aspiration that matches their suitability. This sheet ignores the class filter on purpose — the point is the comparison."
          table={
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th className="num">Students</th>
                  <th className="num">Career clarity</th>
                  <th className="num">5+ weak abilities</th>
                </tr>
              </thead>
              <tbody>
                {clarityData.map((c) => (
                  <tr key={c.name}>
                    <td className="name">{c.name}</td>
                    <td className="num">{c.students}</td>
                    <td className="num">{c.clarity}%</td>
                    <td className="num">{c.weak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <ResponsiveContainer width="100%" height={280} className="sd-chart">
            <BarChart data={clarityData} margin={CHART_MARGIN}>
              <CartesianGrid stroke={palette.grid} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: palette.inkMuted, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.grid }}
              />
              <YAxis
                unit="%"
                domain={[0, 100]}
                tick={{ fill: palette.inkMuted, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: palette.grid, fillOpacity: 0.45 }}
                content={({ active, payload, label }: any) =>
                  active && payload?.length ? (
                    <TipBox
                      title={String(label)}
                      rows={[
                        { label: "Career clarity", value: `${payload[0].payload.clarity}%`, color: palette.s1 },
                        { label: "Students", value: String(payload[0].payload.students) },
                        { label: "With 5+ weak abilities", value: String(payload[0].payload.weak) },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="clarity" fill={palette.s1} radius={[4, 4, 0, 0]} maxBarSize={54}>
                <LabelList dataKey="clarity" position="top" fill={palette.inkMuted} fontSize={12} formatter={(v: any) => `${v}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="sd-grid">
        {heatmap(
          "Leading personality by class",
          "Share of each class whose strongest trait is the one on the left. Reading down a column tells you what a year group is made of; reading across a row tells you how a trait shifts as students get older.",
          b.personalityTopTraitPct
        )}
      </div>

      <div className="sd-grid">
        {heatmap(
          "Weak abilities by class",
          "Share of each class scoring 8 or under. Dark cells are where a year group needs help — a dark row across every class is a curriculum problem, a dark single cell is a cohort problem.",
          b.abilityLowPct
        )}
      </div>
    </>
  );
};

export default SchoolDashboardPage;
