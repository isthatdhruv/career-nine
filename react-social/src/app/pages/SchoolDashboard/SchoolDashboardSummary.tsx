import React, { useMemo } from "react";
import {
  AbilityRow,
  ByClassSheet,
  IntelligenceRow,
  LabeledSeries,
  SchoolDashboardData,
  SchoolDashboardView,
  StreamRow,
  TraitRow,
  ValueRow,
} from "./SchoolDashboard_APIs";
import { Audience, CardType, Narrative } from "./StoredDashboard";
import { audienceOf } from "./SchoolDashboardInsights";
import { Emphasis } from "./ChartCommentary";

/**
 * The whole release on one page: every outcome summarised, then every class.
 *
 * The rest of the dashboard is arranged by evidence — a tab per instrument, a chart per
 * question. That is the right shape for someone investigating a finding and the wrong
 * shape for someone who has ten minutes before a staff meeting. This tab answers the two
 * questions that get asked first, in the order they get asked: what did the assessment
 * find, and which class does each finding belong to.
 *
 * Nothing here is a new measurement. Every figure is read straight out of the same stored
 * release the other tabs draw from, and every sentence is assembled from those figures by
 * template — so this page can never say something the evidence tabs disagree with.
 */

/** The outcomes a summary is organised around, in the order a principal asks about them. */
type OutcomeKey =
  | "personality"
  | "learning"
  | "abilities"
  | "interests"
  | "career";

const SchoolDashboardSummary: React.FC<{
  view: SchoolDashboardView;
  /** The written analysis, for the advised-actions list. Null when the release has none. */
  narrative: Narrative | null;
  scopeLabel: string;
  /** Whether this scope is the school itself — a class view has one column by class. */
  isSchoolWide: boolean;
}> = ({ view, narrative, scopeLabel, isSchoolWide }) => {
  const d = view.dashboard;
  if (!d) return null;

  return (
    <div className="sd-sum">
      <CohortLine view={view} data={d} scopeLabel={scopeLabel} />
      <OutcomeSummary data={d} />
      <ClassSummary data={d} isSchoolWide={isSchoolWide} />
      <AdvisedActions narrative={narrative} />
    </div>
  );
};

// ────────────────────────────── the cohort ──────────────────────────────

const CohortLine: React.FC<{
  view: SchoolDashboardView;
  data: SchoolDashboardData;
  scopeLabel: string;
}> = ({ view, data, scopeLabel }) => {
  const s = data.summary;
  const weakPct = data.abilities.pctWith5PlusWeak;

  return (
    <section className="sd-sum-lede">
      <p className="sd-sum-kicker">Summarised report · {scopeLabel}</p>
      <p className="sd-sum-lede-line">
        <b>{s.studentsInView.toLocaleString()}</b> student
        {s.studentsInView === 1 ? "" : "s"} scored
        {view.participation.total > 0 && (
          <>
            {" "}
            of <b>{view.participation.total.toLocaleString()}</b> assessed
          </>
        )}
        {s.girls + s.boys > 0 && (
          <>
            {" "}
            · {s.girls} girls, {s.boys} boys
          </>
        )}
        . <b>{s.careerClarityPct}%</b> have at least one career aspiration that matches
        what they are suited to, and <b>{weakPct}%</b> are weak on five or more abilities.
      </p>
    </section>
  );
};

// ────────────────────────────── outcome-wise ──────────────────────────────

/** One ranked row inside an outcome card. */
type Line = { label: string; value: number; unit?: string; tone?: "good" | "bad" };

interface Outcome {
  key: OutcomeKey;
  title: string;
  /** What this outcome measured, in the assessment's own terms. */
  sub: string;
  /** The single sentence this outcome comes down to, assembled from the figures. */
  finding: React.ReactNode;
  /** The strongest and the weakest of whatever was measured. */
  top: { caption: string; lines: Line[] };
  bottom: { caption: string; lines: Line[] } | null;
}

const OutcomeSummary: React.FC<{ data: SchoolDashboardData }> = ({ data }) => {
  const outcomes = useMemo(() => buildOutcomes(data), [data]);
  if (outcomes.length === 0) return null;

  return (
    <section className="sd-sum-block">
      <h2 className="sd-rule">Outcome-wise findings</h2>
      <p className="sd-sum-blurb">
        Each instrument in the assessment, reduced to what it found and the two ends of the
        range it found it across.
      </p>
      <div className="sd-sum-grid">
        {outcomes.map((o) => (
          <OutcomeCard key={o.key} outcome={o} />
        ))}
      </div>
    </section>
  );
};

const OutcomeCard: React.FC<{ outcome: Outcome }> = ({ outcome }) => (
  <article className={`sd-sum-card sd-sum-card--${outcome.key}`}>
    <header>
      <h3>{outcome.title}</h3>
      <p className="sd-sum-card-sub">{outcome.sub}</p>
    </header>

    <p className="sd-sum-finding">{outcome.finding}</p>

    <LineList caption={outcome.top.caption} lines={outcome.top.lines} />
    {outcome.bottom && (
      <LineList caption={outcome.bottom.caption} lines={outcome.bottom.lines} />
    )}
  </article>
);

/**
 * A short ranked list with the number stated, not only drawn.
 *
 * The bar is scaled within the list rather than to 100: these are shares of a cohort and
 * the interesting ones rarely pass 40%, so a bar against a 100 scale would render every
 * finding as a stub.
 */
const LineList: React.FC<{ caption: string; lines: Line[] }> = ({ caption, lines }) => {
  if (lines.length === 0) return null;
  const max = Math.max(1, ...lines.map((l) => Math.abs(l.value)));
  return (
    <div className="sd-sum-lines">
      <div className="sd-sum-lines-cap">{caption}</div>
      {lines.map((l) => (
        <div key={l.label} className="sd-sum-line">
          <span className="sd-sum-line-l">{l.label}</span>
          <span className="sd-sum-line-bar" aria-hidden="true">
            <span
              className={`sd-sum-line-fill${l.tone ? ` is-${l.tone}` : ""}`}
              style={{ width: `${(Math.abs(l.value) / max) * 100}%` }}
            />
          </span>
          <b className="sd-sum-line-v">
            {l.value}
            {l.unit ?? "%"}
          </b>
        </div>
      ))}
    </div>
  );
};

function buildOutcomes(d: SchoolDashboardData): Outcome[] {
  const out: Outcome[] = [];
  const s = d.summary;

  // ── Personality ──
  const traits = ranked<TraitRow>(d.personality.traits, (t) => t.pctAsTopTrait);
  if (traits.length > 0) {
    const lead = traits[0];
    const spread = d.personality.spread;
    out.push({
      key: "personality",
      title: "Personality",
      sub: "Which of the six work-personality types leads, as a share of students it is strongest in.",
      finding: (
        <>
          <b>{clean(lead.label)}</b> leads at <b>{lead.pctAsTopTrait}%</b>
          {traits[1] && (
            <>
              , with {clean(traits[1].label)} behind it at {traits[1].pctAsTopTrait}%
            </>
          )}
          .{" "}
          {spread > 0 && (
            <>
              The spread between the commonest and rarest type is {spread} points —{" "}
              {spread >= 25
                ? "this cohort leans hard one way, so a single teaching style will fit most of it and fail the rest."
                : "the cohort is mixed, so no single teaching style will serve all of it."}
            </>
          )}
        </>
      ),
      top: {
        caption: "Most common",
        lines: traits.slice(0, 3).map((t) => ({
          label: clean(t.label),
          value: t.pctAsTopTrait,
        })),
      },
      bottom: {
        caption: "Least common",
        lines: traits
          .slice(-2)
          .reverse()
          .map((t) => ({ label: clean(t.label), value: t.pctAsTopTrait, tone: "bad" as const })),
      },
    });
  }

  // ── Learning styles ──
  const strong = ranked<IntelligenceRow>(d.learningStyle.intelligences, (i) => i.pctStrong);
  const weakLearning = ranked<IntelligenceRow>(d.learningStyle.intelligences, (i) => i.pctLow);
  if (strong.length > 0) {
    out.push({
      key: "learning",
      title: "Learning style",
      sub: "The intelligences students are strong on — how this cohort takes information in.",
      finding: (
        <>
          <b>{clean(strong[0].label)}</b> is the strongest at{" "}
          <b>{strong[0].pctStrong}%</b> of students, and{" "}
          <b>{clean(weakLearning[0]?.label ?? s.weakestLearningStyle)}</b> the weakest
          {weakLearning[0] && <> at {weakLearning[0].pctLow}% scoring low</>}. Lessons
          pitched to the first will land; anything that depends on the second needs
          scaffolding.
        </>
      ),
      top: {
        caption: "Strongest",
        lines: strong.slice(0, 3).map((i) => ({
          label: clean(i.label),
          value: i.pctStrong,
          tone: "good" as const,
        })),
      },
      bottom: {
        caption: "Weakest — share scoring low",
        lines: weakLearning.slice(0, 3).map((i) => ({
          label: clean(i.label),
          value: i.pctLow,
          tone: "bad" as const,
        })),
      },
    });
  }

  // ── Abilities ──
  const abilityStrong = ranked<AbilityRow>(d.abilities.abilities, (a) => a.pctStrong);
  const abilityWeak = ranked<AbilityRow>(d.abilities.abilities, (a) => a.pctLow);
  if (abilityStrong.length > 0) {
    // Creativity is called out by name when the battery measured it: it is the ability
    // schools are asked about most and the one that reads worst as a row in a table.
    const creativity = d.abilities.abilities.find((a) => /creativ/i.test(a.label));
    out.push({
      key: "abilities",
      title: "Abilities",
      sub: "What students can already do — the share at strength level against the share scoring low.",
      finding: (
        <>
          Strongest is <b>{clean(abilityStrong[0].label)}</b> (
          {abilityStrong[0].pctStrong}% at strength level); weakest is{" "}
          <b>{clean(abilityWeak[0].label)}</b> ({abilityWeak[0].pctLow}% scoring low).{" "}
          <b>{d.abilities.pctWith5PlusWeak}%</b> of students are weak on five or more
          abilities at once.
          {creativity && (
            <>
              {" "}
              Creativity specifically: <b>{creativity.pctStrong}%</b> strong,{" "}
              <b>{creativity.pctLow}%</b> low.
            </>
          )}
        </>
      ),
      top: {
        caption: "Strongest",
        lines: abilityStrong.slice(0, 3).map((a) => ({
          label: clean(a.label),
          value: a.pctStrong,
          tone: "good" as const,
        })),
      },
      bottom: {
        caption: "Weakest — share scoring low",
        lines: abilityWeak.slice(0, 4).map((a) => ({
          label: clean(a.label),
          value: a.pctLow,
          tone: "bad" as const,
        })),
      },
    });
  }

  // ── Interests / values ──
  const values = ranked<ValueRow>(d.values.values, (v) => v.pctInTopFive);
  if (values.length > 0) {
    out.push({
      key: "interests",
      title: "Interests & work values",
      sub: "What students say matters to them in a job — the share ranking each in their top five.",
      finding: (
        <>
          <b>{clean(values[0].label)}</b> is what this cohort wants most from work, chosen
          by <b>{values[0].pctInTopFive}%</b>
          {values[1] && (
            <>
              , then {clean(values[1].label)} at {values[1].pctInTopFive}%
            </>
          )}
          . These are the terms a career talk has to be pitched in to be heard.
        </>
      ),
      top: {
        caption: "Most valued",
        lines: values.slice(0, 4).map((v) => ({
          label: clean(v.label),
          value: v.pctInTopFive,
        })),
      },
      bottom: {
        caption: "Least valued",
        lines: values
          .slice(-2)
          .reverse()
          .map((v) => ({ label: clean(v.label), value: v.pctInTopFive, tone: "bad" as const })),
      },
    });
  }

  // ── Career fit ──
  const streams = d.careerGap.streams;
  if (streams.length > 0) {
    // gap = aspiring − suited on the backend's own definition; positive means more
    // students want it than are suited to it, which is the finding worth leading with.
    const wanted = [...streams].sort((a, b) => b.gap - a.gap)[0];
    const under = [...streams].sort((a, b) => a.gap - b.gap)[0];
    out.push({
      key: "career",
      title: "Career fit",
      sub: "Where students are suited against where they say they want to go.",
      finding: (
        <>
          {wanted && wanted.gap > 0 ? (
            <>
              <b>{wanted.aspiringPct}%</b> of students aspire to{" "}
              <b>{clean(wanted.label)}</b>, but only <b>{wanted.suitedPct}%</b> have the
              profile for it — a gap of {Math.abs(wanted.gap)} points.
            </>
          ) : (
            <>
              Aspirations broadly track suitability in this cohort — no stream is
              over-chosen by more than {Math.abs(wanted?.gap ?? 0)} points.
            </>
          )}
          {under && under.gap < 0 && (
            <>
              {" "}
              The reverse holds for <b>{clean(under.label)}</b>: {under.suitedPct}% are
              suited and only {under.aspiringPct}% want it.
            </>
          )}{" "}
          Career clarity across the cohort is <b>{s.careerClarityPct}%</b>.
        </>
      ),
      top: {
        caption: "Over-chosen — want it more than they fit it",
        lines: streamLines(streams, (r) => r.gap > 0, (a, b) => b.gap - a.gap, "bad"),
      },
      bottom: {
        caption: "Under-chosen — fit it more than they want it",
        lines: streamLines(streams, (r) => r.gap < 0, (a, b) => a.gap - b.gap, "good"),
      },
    });
  }

  return out;
}

function streamLines(
  streams: StreamRow[],
  keep: (r: StreamRow) => boolean,
  order: (a: StreamRow, b: StreamRow) => number,
  tone: "good" | "bad"
): Line[] {
  return streams
    .filter(keep)
    .sort(order)
    .slice(0, 3)
    .map((r) => ({
      label: `${clean(r.label)} — ${r.aspiringPct}% want / ${r.suitedPct}% fit`,
      value: Math.abs(r.gap),
      unit: " pts",
      tone,
    }));
}

// ────────────────────────────── class-wise ──────────────────────────────

/** One class, reduced to the same five findings the outcome cards make school-wide. */
interface ClassLine {
  classLabel: string;
  students: number;
  clarityPct: number;
  weak5Plus: number;
  weak5PlusPct: number;
  topTrait: string;
  strongestStyle: string;
  weakestAbility: string;
  wants: string;
  fits: string;
  /** True when the class's leading aspiration is not its leading suitability. */
  mismatched: boolean;
}

const ClassSummary: React.FC<{ data: SchoolDashboardData; isSchoolWide: boolean }> = ({
  data,
  isSchoolWide,
}) => {
  const lines = useMemo(() => buildClassLines(data.byClass), [data.byClass]);
  if (lines.length === 0) return null;

  return (
    <section className="sd-sum-block">
      <h2 className="sd-rule">Class-wise summary</h2>
      <p className="sd-sum-blurb">
        {isSchoolWide
          ? "Every class in this release on one row. A class whose leading aspiration differs from its leading suitability is marked — that is where a counselling session is worth the timetable slot."
          : "This view is already narrowed to one part of the school, so the table below covers only the classes inside it."}
      </p>

      <div className="sd-table-wrap">
        <table className="sd-table sd-sum-table">
          <thead>
            <tr>
              <th>Class</th>
              <th className="num">Students</th>
              <th className="num">Career clarity</th>
              <th className="num">5+ weak abilities</th>
              <th>Leading personality</th>
              <th>Strongest learning style</th>
              <th>Weakest ability</th>
              <th>Wants vs fits</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.classLabel}>
                <td className="name">{l.classLabel}</td>
                <td className="num">{l.students}</td>
                <td className="num">
                  <span
                    className={`sd-sum-pill ${
                      l.clarityPct >= 60 ? "is-good" : l.clarityPct >= 35 ? "is-mid" : "is-bad"
                    }`}
                  >
                    {l.clarityPct}%
                  </span>
                </td>
                <td className="num">
                  {l.weak5Plus}
                  {l.students > 0 && (
                    <small className="sd-sum-of"> ({l.weak5PlusPct}%)</small>
                  )}
                </td>
                <td>{l.topTrait}</td>
                <td>{l.strongestStyle}</td>
                <td>{l.weakestAbility}</td>
                <td>
                  {l.wants === "—" ? (
                    "—"
                  ) : l.mismatched ? (
                    <span className="sd-sum-mismatch">
                      wants {l.wants} · fits {l.fits}
                    </span>
                  ) : (
                    <span className="sd-sum-aligned">both {l.wants}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

function buildClassLines(b: ByClassSheet): ClassLine[] {
  return b.classes.map((cls, i) => {
    const students = at(b.students, i);
    const weak5Plus = at(b.fiveOrMoreWeakAbilities, i);
    const suited = leaderAt(b.streamFitVsWish, i, (label) => label.includes("suited"));
    const aspiring = leaderAt(b.streamFitVsWish, i, (label) => label.includes("aspiring"));
    const wants = streamName(aspiring);
    const fits = streamName(suited);

    return {
      classLabel: `Class ${cls}`,
      students,
      clarityPct: at(b.careerClarityPct, i),
      weak5Plus,
      weak5PlusPct: students > 0 ? Math.round((weak5Plus / students) * 100) : 0,
      topTrait: leaderAt(b.personalityTopTraitPct, i) ?? "—",
      strongestStyle: leaderAt(b.learningStyleStrongPct, i) ?? "—",
      weakestAbility: leaderAt(b.abilityLowPct, i) ?? "—",
      wants,
      fits,
      mismatched: wants !== "—" && fits !== "—" && wants !== fits,
    };
  });
}

/**
 * The label of whichever series is highest for one class.
 *
 * Ties keep the first series, which is the order the backend wrote them in. Returns null
 * when nothing was measured rather than the first label at zero — a class with no data
 * should read as blank, not as unanimously one thing.
 */
function leaderAt(
  series: LabeledSeries[],
  index: number,
  keep?: (label: string) => boolean
): string | null {
  let best: { label: string; value: number } | null = null;
  for (const s of series) {
    if (keep && !keep(s.label)) continue;
    const value = at(s.values, index);
    if (value <= 0) continue;
    if (!best || value > best.value) best = { label: s.label, value };
  }
  return best ? clean(best.label) : null;
}

/** "Science — suited" → "Science". The suffix is the series, not the stream. */
function streamName(label: string | null): string {
  if (!label) return "—";
  return clean(label.split("—")[0]);
}

// ────────────────────────────── advised actions ──────────────────────────────

/** One instruction the release gives, and where in the analysis it came from. */
interface AdvisedAction {
  text: string;
  /** The finding this action answers — a card title, an alert, or a chart. */
  source: string;
  audience: Audience;
  /** Risk-derived actions lead the list; chart commentary comes last. */
  rank: number;
}

const AUDIENCE_WORD: Record<Audience, string> = {
  teacher: "Teachers",
  counsellor: "Counsellors",
  parent: "Parents",
};

/**
 * Everything Career-9 advises for this cohort, in one list.
 *
 * The Act tab already carries these split three ways by who has to do them, which is the
 * right shape for handing a brief to one person. It is the wrong shape for the question
 * this tab answers — "what does Career-9 say we should do?" — because the answer is spread
 * across three tabs nobody has clicked yet. So the same instructions are gathered here,
 * unsplit and numbered, with the audience kept only as a tag.
 *
 * Nothing is invented or reworded: each row is an `action` string the release stored.
 */
const AdvisedActions: React.FC<{ narrative: Narrative | null }> = ({ narrative }) => {
  const actions = useMemo(() => collectActions(narrative), [narrative]);

  return (
    <section className="sd-sum-block">
      <h2 className="sd-rule">Actions advised by Career-9</h2>

      {actions.length === 0 ? (
        <p className="sd-sum-blurb">
          {narrative
            ? "The written analysis for this view does not spell out any actions. The findings above still stand on their own."
            : "This view has figures but no written analysis, so there are no advised actions to list. Ask the Career-9 team to generate it."}
        </p>
      ) : (
        <>
          <p className="sd-sum-blurb">
            Every step this release recommends, drawn from the written analysis and the
            commentary on each chart. The same items appear on the <strong>Act</strong> tab
            grouped by who carries them out.
          </p>

          <ol className="sd-todo">
            {actions.map((action, i) => (
              <li key={`${action.source}-${i}`} className="sd-todo-item">
                <span className="sd-todo-n" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="sd-todo-body">
                  <p className="sd-todo-do">
                    <Emphasis text={action.text} />
                  </p>
                  <p className="sd-todo-meta">
                    <span className={`sd-todo-who sd-todo-who--${action.audience}`}>
                      {AUDIENCE_WORD[action.audience]}
                    </span>
                    <span className="sd-todo-src">{action.source}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
};

/** Risk first, then the rest of the findings, then per-chart commentary. */
const CARD_RANK: Record<CardType, number> = { risk: 0, gap: 1, opportunity: 2, strength: 3 };

function collectActions(narrative: Narrative | null): AdvisedAction[] {
  if (!narrative) return [];

  const out: AdvisedAction[] = [];
  // Two findings can arrive at the same instruction — "run a stream-choice workshop for
  // Class 11" is a fair reading of three different charts. Numbering it three times makes
  // a list of eight look like a list of twenty.
  const seen = new Set<string>();

  const push = (text: string, source: string, audience: Audience, rank: number) => {
    const line = (text ?? "").trim();
    if (line.length < 8) return;
    const key = line.replace(/\*\*/g, "").toLowerCase().replace(/[.\s]+$/, "");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text: line, source, audience, rank });
  };

  const { cards, alerts } = narrative.dashboard_insights;

  cards.forEach((card) => {
    if (!card.action) return;
    push(card.action, card.title || "Finding", audienceOf(card), CARD_RANK[card.type] ?? 1);
  });

  alerts.forEach((alert) => {
    if (!alert.action) return;
    push(alert.action, alert.label || "Alert", audienceOf(alert), 4);
  });

  // Chart commentary last: it is the most granular advice and repeats the headline cards
  // often enough that leading with it would bury the findings the report was built around.
  narrative.chartNotes.forEach((notes) => {
    const source = chartLabel(notes.chartId);
    notes.actions.forEach((action) =>
      push(action, source, audienceOf({ audience: null, insight: action, title: source }), 5)
    );
  });

  return out.sort((a, b) => a.rank - b.rank);
}

/** "stream-fit-vs-ambition" → "Stream fit vs ambition", so a row names a chart a reader saw. */
function chartLabel(chartId: string): string {
  const words = (chartId || "").replace(/[-_]+/g, " ").trim();
  if (!words) return "Chart commentary";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function at(values: number[] | undefined, i: number): number {
  const v = values?.[i];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Sheet labels are written with leading indent spaces for the workbook export. */
function clean(label: string): string {
  return (label ?? "").trim();
}

/** A copy sorted by one field, descending, with zero-only rows kept — they are findings too. */
function ranked<T>(rows: T[] | undefined, by: (row: T) => number): T[] {
  return [...(rows ?? [])].sort((a, b) => by(b) - by(a));
}

export default SchoolDashboardSummary;
