import {
  AbilityRow,
  ByClassSheet,
  ClassCount,
  ClusterRow,
  IntelligenceRow,
  LabeledSeries,
  SchoolDashboardData,
  SchoolDashboardView,
  StreamRow,
  TraitRow,
  ValueRow,
} from "./SchoolDashboard_APIs";

/**
 * Reads what a release stored.
 *
 * Two payloads come back per scope and this module parses both:
 *
 * - `internal_calculation` — the deterministic figures, written in a compact columnar
 *   form (`{c: [headers], r: [[values]]}`) so a payload of ~570 numbers crosses the wire
 *   in single-digit kilobytes. That form exists for transport, not for rendering, so it
 *   is inflated back into the same typed objects the charts already draw from. The
 *   alternative — teaching 1,900 lines of chart code to read positional arrays — would
 *   be a large diff that buys nothing.
 *
 * - `ai_response` — the narrative, in a schema where every report section carries the
 *   same fields. The uniformity is what lets one renderer walk all eleven sections, and
 *   later lets the .docx renderer walk the identical structure.
 *
 * Both parsers are total: a malformed or half-written payload yields null rather than
 * throwing, because a dashboard that renders nothing is recoverable and one that crashes
 * the page is not.
 */

// ────────────────────────────── compact tables ──────────────────────────────

/** A columnar table as the backend writes it. */
interface CompactTable {
  c: (string | number)[];
  r: any[][];
}

function isTable(value: any): value is CompactTable {
  return !!value && Array.isArray(value.c) && Array.isArray(value.r);
}

/**
 * Turn a columnar table into objects, reading each row positionally against `c`.
 *
 * Column names are looked up rather than assumed by index: the backend appends columns
 * (the school-wide `base_*` comparisons, for one), and a positional assumption here
 * would silently start reading the wrong number the first time that happens.
 */
function rows<T>(table: any, build: (get: (col: string) => any) => T): T[] {
  if (!isTable(table)) return [];
  const index = new Map<string, number>();
  table.c.forEach((name, i) => index.set(String(name), i));
  return table.r
    .filter((row) => Array.isArray(row))
    .map((row) => build((col) => row[index.get(col) ?? -1]));
}

const num = (v: any, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Blank cells are absent values, never zero — a rank of 0 would sort as first place. */
const nullableNum = (v: any): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const text = (v: any): string => (typeof v === "string" ? v : "");

// ────────────────────────────── stored payload ──────────────────────────────

export interface StoredScope {
  key: string;
  level: "INSTITUTE" | "SESSION" | "CLASS" | "SECTION" | "GROUP";
  label: string;
  sessionId: number | null;
  sessionLabel: string | null;
  classId: number | null;
  sectionId: number | null;
  sectionLabel: string | null;
  groupId: number | null;
  groupLabel: string | null;
}

/** Screening counts, computed in code so the narrative never has to see a student row. */
export interface StoredFlags {
  acute: number;
  abilitySupport: number;
  guidanceMismatch: number;
  base: number;
}

export interface StoredPayload {
  scope: StoredScope | null;
  flags: StoredFlags | null;
  /** The charts' data source, rebuilt from the compact form. */
  view: SchoolDashboardView;
  generatedAt: string | null;
}

/** The dimensions a scope binds, for driving the filter rail off stored data. */
export function parseScope(internalCalculation?: string | null): StoredScope | null {
  const payload = safeParse(internalCalculation);
  return payload ? readScope(payload) : null;
}

export function parseStoredPayload(
  internalCalculation?: string | null
): StoredPayload | null {
  const payload = safeParse(internalCalculation);
  if (!payload) return null;

  const participation = payload.participation ?? {};
  const cohort = payload.cohort ?? {};
  const institute = payload.institute ?? {};
  const assessment = payload.assessment ?? {};
  const sheets = payload.sheets ?? {};

  const scored = num(participation.scored);
  const total = num(participation.total);

  const view: SchoolDashboardView = {
    instituteCode: nullableNum(institute.code),
    instituteName: typeof institute.name === "string" ? institute.name : null,
    classFilter: text(payload.scope?.label) || "All",
    classesPresent: Array.isArray(cohort.gradesPresent)
      ? cohort.gradesPresent.filter((g: any) => typeof g === "number")
      : [],
    participation: {
      total,
      completed: num(participation.completed),
      ongoing: num(participation.ongoing),
      notStarted: num(participation.notStarted),
      completedPct: num(participation.completedPct),
    },
    // A release covers exactly one assessment, so this is always a single entry —
    // it stays a list because the card that renders it was built for many, and one
    // row of the right shape is better than a special case.
    assessments: assessment.id
      ? [
          {
            assessmentId: num(assessment.id),
            assessmentName: text(assessment.name) || `Assessment ${assessment.id}`,
            total,
            completed: num(participation.completed),
            ongoing: num(participation.ongoing),
            notStarted: num(participation.notStarted),
            completedPct: num(participation.completedPct),
            scored,
          },
        ]
      : [],
    scoredStudents: scored,
    unscoredStudents: num(participation.unscored),
    distinctStudents: total,
    dashboard: inflateSheets(sheets, cohort),
  };

  return {
    scope: readScope(payload),
    flags: payload.flags
      ? {
          acute: num(payload.flags.acute),
          abilitySupport: num(payload.flags.abilitySupport),
          guidanceMismatch: num(payload.flags.guidanceMismatch),
          base: num(payload.flags.base),
        }
      : null,
    view,
    generatedAt: typeof payload.provenance?.generatedAt === "string"
      ? payload.provenance.generatedAt
      : null,
  };
}

function readScope(payload: any): StoredScope | null {
  const scope = payload?.scope;
  if (!scope) return null;
  return {
    key: text(scope.key),
    level: (scope.level ?? "INSTITUTE") as StoredScope["level"],
    label: text(scope.label) || "Whole school",
    sessionId: nullableNum(scope.sessionId),
    sessionLabel: typeof scope.sessionLabel === "string" ? scope.sessionLabel : null,
    classId: nullableNum(scope.classId),
    sectionId: nullableNum(scope.sectionId),
    sectionLabel: typeof scope.sectionLabel === "string" ? scope.sectionLabel : null,
    groupId: nullableNum(scope.groupId),
    groupLabel: typeof scope.groupLabel === "string" ? scope.groupLabel : null,
  };
}

/**
 * Rebuild the sheets.
 *
 * Returns null when nothing was computed — a scope with no scored students stores its
 * counts and an empty `sheets`, and a page of zeroes reads as real data.
 */
function inflateSheets(sheets: any, cohort: any): SchoolDashboardData | null {
  if (!sheets || Object.keys(sheets).length === 0) return null;

  const traits: TraitRow[] = rows(sheets.personality, (get) => ({
    label: text(get("trait")),
    riasecName: text(get("riasec")),
    avgRawScore: num(get("avgRaw")),
    pctAsTopTrait: num(get("topTraitPct")),
    pctInTopThree: num(get("topThreePct")),
    studentsTopTrait: num(get("nTop")),
    studentsInTopThree: num(get("nTop3")),
  }));

  const intelligences: IntelligenceRow[] = rows(sheets.learningStyle, (get) => ({
    label: text(get("intelligence")),
    pctStrong: num(get("strongPct")),
    pctLow: num(get("lowPct")),
    avgScore: num(get("avg")),
    studentsStrong: num(get("nStrong")),
    studentsLow: num(get("nLow")),
  }));

  const abilities: AbilityRow[] = rows(sheets.abilities, (get) => ({
    label: text(get("ability")),
    pctStrong: num(get("strongPct")),
    pctLow: num(get("lowPct")),
    gap: num(get("gap")),
    avgScore: num(get("avg")),
    studentsStrong: num(get("nStrong")),
    studentsLow: num(get("nLow")),
  }));

  const values: ValueRow[] = rows(sheets.values, (get) => ({
    label: text(get("value")),
    pctInTopFive: num(get("topFivePct")),
    students: num(get("n")),
    rank: nullableNum(get("rank")),
  }));

  const streams: StreamRow[] = rows(sheets.careerGap?.streams, (get) => ({
    label: text(get("stream")),
    suitedPct: num(get("suitedPct")),
    aspiringPct: num(get("aspiringPct")),
    gap: num(get("gap")),
    studentsSuited: num(get("nSuited")),
    studentsAspiring: num(get("nAspiring")),
  }));

  const clusters: ClusterRow[] = rows(sheets.careerGap?.clusters, (get) => ({
    label: text(get("cluster")),
    suitedTop3: num(get("suitedTop3")),
    aspiring: num(get("aspiring")),
    gap: num(get("gap")),
    readinessPct: nullableNum(get("readinessPct")),
    stream: text(get("stream")),
  }));

  const studentsByClass: ClassCount[] = rows(sheets.summary?.studentsByClass, (get) => {
    const studentClass = num(get("class"));
    return {
      label: `Class ${studentClass}`,
      studentClass,
      students: num(get("n")),
      pctOfSchool: num(get("pctOfSchool")),
    };
  });

  const summary = sheets.summary ?? {};

  return {
    filter: { label: "All", min: 0, max: 99 },
    summary: {
      studentsInView: num(summary.studentsInView),
      girls: num(summary.girls ?? cohort?.girls),
      boys: num(summary.boys ?? cohort?.boys),
      careerClarityPct: num(summary.careerClarityPct),
      avgMatchedAspirations: num(summary.avgMatchedAspirations),
      studentsByClass,
      totalStudents: num(summary.studentsInView),
      dominantPersonality: text(summary.dominantPersonality),
      secondPersonality: text(summary.secondPersonality),
      dominantLearningStyle: text(summary.dominantLearningStyle),
      weakestLearningStyle: text(summary.weakestLearningStyle),
      strongestAbility: text(summary.strongestAbility),
      weakestAbility: text(summary.weakestAbility),
      topValue: text(summary.topValue),
      bestFitStream: text(summary.bestFitStream),
      mostWantedStream: text(summary.mostWantedStream),
    },
    personality: {
      traits,
      // Not stored: it is the sum of the column it summarises, so recomputing keeps
      // the payload smaller without losing anything.
      totalTopTraitPct: traits.reduce((sum, t) => sum + t.pctAsTopTrait, 0),
      highestTraitShare: num(sheets.personality?.highestShare),
      lowestTraitShare: num(sheets.personality?.lowestShare),
      spread: num(sheets.personality?.spread),
      traitsAbove20: num(sheets.personality?.traitsAbove20),
    },
    learningStyle: { intelligences },
    abilities: {
      abilities,
      avgAbilities10Plus: num(sheets.abilities?.avgStrong),
      avgAbilities8OrLess: num(sheets.abilities?.avgWeak),
      studentsWith5PlusWeak: num(sheets.abilities?.nWith5PlusWeak),
      pctWith5PlusWeak: num(sheets.abilities?.pctWith5PlusWeak),
    },
    values: { values },
    careerGap: { streams, clusters },
    byClass: inflateByClass(sheets.byClass),
  };
}

/**
 * Sheet 8, where the class list is the column header rather than a parallel array.
 *
 * Below school level this narrows on its own — a class view has one column, a section
 * view has one column — because the rows it was computed from were already scoped.
 */
function inflateByClass(byClass: any): ByClassSheet {
  const classes: number[] = Array.isArray(byClass?.classes)
    ? byClass.classes.filter((c: any) => typeof c === "number")
    : [];

  const headline = (metric: string): number[] => {
    if (!isTable(byClass?.headline)) return [];
    const row = byClass.headline.r.find((r: any[]) => r?.[0] === metric);
    return row ? row.slice(1).map((v: any) => num(v)) : [];
  };

  const series = (table: any): LabeledSeries[] => {
    if (!isTable(table)) return [];
    return table.r
      .filter((row: any[]) => Array.isArray(row) && row.length > 0)
      .map((row: any[]) => ({
        label: text(row[0]),
        values: row.slice(1).map((v: any) => num(v)),
      }));
  };

  return {
    classes,
    students: headline("students"),
    careerClarityPct: headline("careerClarityPct"),
    fiveOrMoreWeakAbilities: headline("weak5Plus"),
    personalityTopTraitPct: series(byClass?.personalityTopTraitPct),
    learningStyleStrongPct: series(byClass?.learningStyleStrongPct),
    abilityLowPct: series(byClass?.abilityLowPct),
    streamFitVsWish: series(byClass?.streamFitVsWish),
  };
}

// ────────────────────────────── narrative ──────────────────────────────

export interface Kpi {
  id: string;
  label: string;
  value: number;
  unit: string;
  target: number | null;
}

export type CardType = "strength" | "gap" | "risk" | "opportunity";

/**
 * Who an action item is addressed to.
 *
 * The Act tab is split by this. Nothing generated so far carries it — the field is read
 * when present and inferred from the wording when it is not (see `audienceOf` in
 * SchoolDashboardInsights), so a later prompt change that starts writing a real tag
 * takes over from the inference without a second frontend change.
 */
export type Audience = "teacher" | "counsellor" | "parent";

const AUDIENCES: Audience[] = ["teacher", "counsellor", "parent"];

/** The stored tag, or null when the release predates it / wrote something unknown. */
function audienceField(value: any): Audience | null {
  return AUDIENCES.includes(value) ? value : null;
}

export interface InsightCard {
  id: string;
  title: string;
  /** One sentence, carrying its number and its base. */
  insight: string;
  /** The concrete next step. Printed under the insight, so a card without one is half a card. */
  action: string;
  numbers: { key: string; value: number; unit: string }[];
  type: CardType;
  /** The report section that expands this card. */
  section_ref: string;
  /** Set only when the release stored one; otherwise inferred at render time. */
  audience: Audience | null;
}

export interface Alert {
  id: string;
  label: string;
  count: number;
  action: string;
  audience: Audience | null;
}

export interface NarrativeChart {
  id: string;
  type: string;
  title: string;
  caption: string;
  labels: string[];
  series: { name: string; values: number[]; unit: string }[];
}

export interface NarrativeTable {
  id: string;
  title: string;
  columns: string[];
  rows: string[][];
}

export interface NarrativeBullet {
  label: string;
  text: string;
  meta: { key: string; value: string }[];
}

/** Every section carries the same fields; unused arrays come back empty. */
export interface ReportSection {
  id: string;
  number: number;
  title: string;
  body: string[];
  charts: NarrativeChart[];
  tables: NarrativeTable[];
  bullets: NarrativeBullet[];
  callouts: { type: string; text: string }[];
}

/**
 * Commentary for one chart.
 *
 * Ids match the roster in PrincipalDashboardAiService — the page looks each block up by
 * id rather than by title, so renaming a chart heading never orphans its commentary.
 * The prompt asks for three to five entries per list. Only the ceiling is enforced here —
 * it is a display decision, and a model that returns six should not quietly get six. The
 * floor is not enforced: a short list is worth showing, and dropping a chart's commentary
 * because it came back with two would lose the two.
 */
export interface ChartNotes {
  chartId: string;
  insights: string[];
  implications: string[];
  actions: string[];
}

export interface Narrative {
  /** The one sentence the page leads with. */
  headline: string;
  /** Chart commentary, keyed by chart id. */
  chartNotes: Map<string, ChartNotes>;
  school: { name: string; location: string | null; location_status: string };
  cohort: { label: string; n: number; girls: number; boys: number; grades_present: number[] };
  pending: { field: string; note: string }[];
  data_audit: {
    excluded: { what: string; n: number }[];
    cured: { what: string; n: number }[];
    noted: string[];
  };
  dashboard_insights: { kpis: Kpi[]; cards: InsightCard[]; alerts: Alert[] };
  report: { sections: ReportSection[] };
}

/**
 * Parse the stored narrative.
 *
 * Every collection is defaulted rather than trusted. The response is schema-constrained
 * at the API, but rows written by an earlier prompt version are not, and a principal
 * should see the sections that survived rather than an error page.
 */
export function parseNarrative(aiResponse?: string | null): Narrative | null {
  const parsed = safeParse(aiResponse);
  if (!parsed) return null;

  const insights = parsed.dashboard_insights ?? {};
  const chartNotes = new Map<string, ChartNotes>();
  for (const raw of list(parsed.chart_notes)) {
    const chartId = text(raw?.chart_id);
    if (!chartId) continue;
    const notes: ChartNotes = {
      chartId,
      insights: sentences(raw?.insights),
      implications: sentences(raw?.implications),
      actions: sentences(raw?.actions),
    };
    // An entry with nothing in it is a chart the model declined to comment on; an
    // empty block under a chart reads as a fault rather than as silence.
    if (notes.insights.length || notes.implications.length || notes.actions.length) {
      chartNotes.set(chartId, notes);
    }
  }

  return {
    headline: text(parsed.headline),
    chartNotes,
    school: {
      name: text(parsed.school?.name),
      location: typeof parsed.school?.location === "string" ? parsed.school.location : null,
      location_status: text(parsed.school?.location_status),
    },
    cohort: {
      label: text(parsed.cohort?.label),
      n: num(parsed.cohort?.n),
      girls: num(parsed.cohort?.girls),
      boys: num(parsed.cohort?.boys),
      grades_present: list(parsed.cohort?.grades_present).filter(
        (g: any) => typeof g === "number"
      ),
    },
    pending: list(parsed.pending).map((p: any) => ({
      field: text(p?.field),
      note: text(p?.note),
    })),
    data_audit: {
      excluded: auditEntries(parsed.data_audit?.excluded),
      cured: auditEntries(parsed.data_audit?.cured),
      noted: list(parsed.data_audit?.noted).filter((n: any) => typeof n === "string"),
    },
    dashboard_insights: {
      kpis: list(insights.kpis).map((k: any) => ({
        id: text(k?.id),
        label: text(k?.label),
        value: num(k?.value),
        unit: text(k?.unit),
        target: nullableNum(k?.target),
      })),
      cards: list(insights.cards)
        .map((c: any) => ({
          id: text(c?.id),
          title: text(c?.title),
          insight: text(c?.insight),
          action: text(c?.action),
          numbers: list(c?.numbers).map((n: any) => ({
            key: text(n?.key),
            value: num(n?.value),
            unit: text(n?.unit),
          })),
          type: cardType(c?.type),
          section_ref: text(c?.section_ref),
          audience: audienceField(c?.audience),
        }))
        .filter((c) => c.insight.length > 0),
      alerts: list(insights.alerts).map((a: any) => ({
        id: text(a?.id),
        label: text(a?.label),
        count: num(a?.count),
        action: text(a?.action),
        audience: audienceField(a?.audience),
      })),
    },
    report: {
      sections: list(parsed.report?.sections)
        .map((s: any) => ({
          id: text(s?.id),
          number: num(s?.number),
          title: text(s?.title),
          body: list(s?.body).filter((b: any) => typeof b === "string"),
          charts: list(s?.charts).map(
            (c: any): NarrativeChart => ({
              id: text(c?.id),
              type: text(c?.type),
              title: text(c?.title),
              caption: text(c?.caption),
              labels: list(c?.labels).map((l: any) => text(l)),
              series: list(c?.series).map((sr: any) => ({
                name: text(sr?.name),
                values: list(sr?.values).map((v: any) => num(v)),
                unit: text(sr?.unit),
              })),
            })
          ),
          tables: list(s?.tables).map(
            (t: any): NarrativeTable => ({
              id: text(t?.id),
              title: text(t?.title),
              columns: list(t?.columns).map((c: any) => text(c)),
              rows: list(t?.rows).map((r: any) => list(r).map((cell: any) => text(cell))),
            })
          ),
          bullets: list(s?.bullets).map(
            (b: any): NarrativeBullet => ({
              label: text(b?.label),
              text: text(b?.text),
              meta: list(b?.meta).map((m: any) => ({
                key: text(m?.key),
                value: text(m?.value),
              })),
            })
          ),
          callouts: list(s?.callouts).map((c: any) => ({
            type: text(c?.type),
            text: text(c?.text),
          })),
        }))
        // A section with no content at all is one the model declined to write; showing
        // an empty accordion for it is worse than omitting it.
        .filter(
          (s) =>
            s.body.length > 0 ||
            s.charts.length > 0 ||
            s.tables.length > 0 ||
            s.bullets.length > 0
        )
        .sort((a, b) => a.number - b.number),
    },
  };
}

const CARD_TYPES: CardType[] = ["strength", "gap", "risk", "opportunity"];

function cardType(value: any): CardType {
  return CARD_TYPES.includes(value) ? value : "gap";
}

function auditEntries(value: any): { what: string; n: number }[] {
  return list(value).map((e: any) => ({ what: text(e?.what), n: num(e?.n) }));
}

/** Non-empty strings only, capped at five. */
function sentences(value: any): string[] {
  return list(value)
    .filter((v: any) => typeof v === "string" && v.trim().length > 0)
    .slice(0, 5);
}

function list(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function safeParse(raw?: string | null): any | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

// ────────────────────────────── baseline ──────────────────────────────

/**
 * How a scope's figure compares to the same figure school-wide.
 *
 * A class dashboard showing "42% strong on speed and accuracy" states a fact; showing it
 * against the school's 58% states a finding, and the finding is the reason a principal
 * opened a class view rather than the school one. Null when there is nothing to compare
 * against — at school level, or for a label the school-wide sheet does not carry.
 */
export interface Delta {
  value: number;
  baseline: number;
  diff: number;
}

export function delta(value: number, baseline: number | null | undefined): Delta | null {
  if (typeof baseline !== "number" || !Number.isFinite(baseline)) return null;
  return { value, baseline, diff: value - baseline };
}

/** Index a sheet's rows by label, for comparing a scope against the school. */
export function byLabel<T extends { label: string }>(items: T[] | undefined): Map<string, T> {
  const map = new Map<string, T>();
  (items ?? []).forEach((item) => map.set(item.label, item));
  return map;
}
