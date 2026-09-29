/**
 * The stored Navigator Pro college dashboard, as NavigatorProDashboardCalculator writes it
 * (`internal_calculation`, logic navpro-dashboard-1) and as NavigatorProDashboardAiService
 * narrates it (`ai_response`, prompt navpro-dashboard-v1).
 *
 * Field names mirror the Java maps one for one; a rename on either side must be made on
 * both.
 */

export type ZoneKey = "ready" | "motivated" | "capable" | "support";
export type Owner = "Academics" | "Placement cell" | "Counsellors" | "Principal";

export interface Action {
  text: string;
  owner: Owner;
}

export interface ZoneCount {
  key: ZoneKey;
  label: string;
  count: number;
  pct: number;
  avgWill: number;
  avgSkill: number;
  avgFoundation: number;
  avgReasoning: number;
  means?: string;
  first?: string;
  todo?: string;
}

export interface ZonePoint {
  id: number;
  will: number;
  skill: number;
  zone: ZoneKey;
}

export interface Factor {
  key: string;
  label: string;
  meaning: string;
  avg: number;
  lowCount: number;
  byZone: Record<ZoneKey, number>;
}

export interface Family {
  key: string;
  label: string;
  avg: number;
  topCount: number;
  topPct: number;
  highCount: number;
}

export interface Check {
  key: string;
  label: string;
  passed: number;
  base: number;
  pct: number;
}

export interface Habit {
  key: string;
  label: string;
  avg: number;
  red: number;
  amber: number;
  green: number;
  redPct: number;
  lowestFor: number;
}

export interface Field {
  key: string;
  label: string;
  bestFit: number;
  tiedSecond: number;
  handsOn: number;
  aspiring: number;
  avgFit: number;
}

export interface IndustryCard {
  key: string;
  label: string;
  bestFit: number;
  tiedSecond: number;
  handsOn: number;
  aspiring: number;
  internships: string[];
  organisations: string[];
  visit: string;
  copyDraft: boolean;
}

export interface ValueRow {
  tag: string;
  option: string;
  topFour: number;
  topFourPct: number;
  rankOne: number;
}

export interface AttentionReason {
  code: string;
  priority: 1 | 2 | 3;
  label: string;
  action: string;
  owner: Owner;
}

export interface AttentionItem {
  id: number;
  priority: 1 | 2 | 3;
  reasons: AttentionReason[];
  counselled: boolean;
}

export interface StudentRow {
  id: number;
  section: string | null;
  status: "delivered" | "held";
  gate: string | null;
  gateReason: string | null;
  priority: 1 | 2 | 3 | null;
  counselled: boolean;
  zone?: ZoneKey;
  will?: number;
  skill?: number;
  foundation?: number;
  reasoning?: number;
  topFamily?: string | null;
  secondFamily?: string | null;
  lowHabit?: string;
  explorer?: boolean;
  lean?: string | null;
  leanScore?: number | null;
  second?: string | null;
  tie?: boolean;
  track?: "A" | "B";
  flagged?: boolean;
  values?: string[];
  aspirations?: string[];
  ambitionMatch?: boolean | null;
}

export interface ProPayload {
  v: number;
  engine: string;
  scope: {
    key: string;
    level: string;
    label: string;
    sessionLabel?: string | null;
  };
  assessment: { id: number; name: string };
  institute: { code: number; name: string; city?: string | null; state?: string | null };
  participation: {
    total: number;
    completed: number;
    ongoing: number;
    notStarted: number;
    completedPct: number;
    scored: number;
    unscored: number;
    evaluated: number;
    delivered: number;
  };
  overview: {
    mapped: number;
    assessed: number;
    evaluated: number;
    delivered: number;
    held: number;
    heldByGate: Record<string, number>;
    flagged: number;
    explorers: number;
    tied: number;
    trackA: number;
    counsellingMandatory: number;
    needAttention: number;
    needPersonFirst: number;
    counselled: number;
    completedPct: number;
  };
  norms: {
    batchN: number;
    provisional: boolean;
    willMedian: number;
    skillMedian: number;
    cutsFromNorms: boolean;
  };
  zones: { base: number; counts: ZoneCount[]; points: ZonePoint[] };
  will: {
    base: number;
    avgWill: number;
    avgFoundation: number;
    avgSkill: number;
    avgReasoning: number;
    factors: Factor[];
    weakestFactor: string | null;
  };
  personality: {
    base: number;
    families: Family[];
    strongest: string[];
    weakest: string[];
    tiedProfiles: number;
    tiedPct: number;
    trackA: number;
    trackAPct: number;
  };
  improvement: {
    base: number;
    checks: Check[];
    reasoningDistribution: number[];
    avgReasoning: number;
    lowReasoning: number;
    habits: Habit[];
    lowFoundation: number;
  };
  directions: {
    base: number;
    ranked: number;
    explorers: number;
    ties: number;
    fields: Field[];
    ambitionVsFit: {
      base: number;
      matched: number;
      mismatched: number;
      noAspiration: number;
      mismatchedPct: number;
    };
    recipe: string;
  };
  industry: IndustryCard[];
  values: ValueRow[];
  attention: {
    total: number;
    p1: number;
    p2: number;
    p3: number;
    byReason: Record<string, number>;
    byOwner: Record<string, number>;
    alreadyCounselled: number;
    minutesEstimate: number;
    hoursEstimate: number;
    minutesPerPriority: number[];
    trackABriefing: number;
    items: AttentionItem[];
  };
  actions: Partial<Record<PageId, Action[]>>;
  students: StudentRow[];
  provenance: { generatedAt: string; logicVersion: string };
}

export type PageId =
  | "exec"
  | "map"
  | "will"
  | "personality"
  | "improvement"
  | "directions"
  | "industry"
  | "values"
  | "queue";

export interface PageNarrative {
  page_id: PageId;
  insights: string[];
  implications: string[];
  actions: Action[];
}

export interface ProNarrative {
  headline: string;
  board_summary: {
    paragraphs: string[];
    strengths: string[];
    risks: string[];
    asks: string[];
  };
  pages: PageNarrative[];
  methodology_note: string;
}

/** Parse a stored JSON column; a malformed or absent one reads as "nothing stored". */
export function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** A payload is only drawable if it was written by the Navigator Pro calculator. */
export function parseProPayload(raw: string | null | undefined): ProPayload | null {
  const p = parseJson<ProPayload>(raw);
  return p && p.engine === "navigator_pro" ? p : null;
}
