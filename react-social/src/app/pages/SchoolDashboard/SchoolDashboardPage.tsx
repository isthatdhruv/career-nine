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
  SchoolDashboardData,
  SchoolDashboardView,
} from "./SchoolDashboard_APIs";
import {
  getLatestRelease,
  getReleasedScopes,
  getScope,
  ScopeSummary,
  ScopeView,
} from "./PrincipalDashboardRelease_APIs";
import {
  byLabel,
  Narrative,
  parseNarrative,
  parseStoredPayload,
  StoredFlags,
  StoredScope,
} from "./StoredDashboard";
import SchoolDashboardInsights from "./SchoolDashboardInsights";
import "./SchoolDashboard.css";

// recharts' polar typings fight TS in this version — the same escape hatch
// PrincipalDashboard uses.
const PolarAngleAxisFixed = PolarAngleAxis as any;
const PolarRadiusAxisFixed = PolarRadiusAxis as any;

/**
 * One ABAC grant row, as the JWT carries it: institute / session / class /
 * section, mirroring AccessScope.Rule on the server. A null on any dimension
 * is a wildcard — "this grant does not constrain that dimension".
 */
type Scope = { i?: number | null; s?: number | null; c?: number | null; x?: number | null };

/** The hero filter rail's dimensions, in the order they appear. */
type Dim = "s" | "c" | "x";

/**
 * Collapse the user's grants down to a single allowed value set per dimension.
 *
 * null means unrestricted: super-admin, no grant rows at all, or at least one
 * grant that wildcards this dimension. A set with exactly one member is what
 * locks a control — the user has no choice to make, so the select is fixed and
 * labelled "Scoped" rather than pretending to offer options.
 *
 * The server re-checks every request against AccessScope.allows(); this is UI
 * honesty, not the security boundary.
 */
/** One selectable value on the rail, named as it was when it was released. */
type RailOption = { id: number; label: string };

/**
 * Turn released scopes into rail options: one per distinct id, named, and cut down to
 * what the user's grant allows.
 *
 * `allowed` of null means unrestricted — a wildcard grant or a super-admin — which is a
 * different thing from an empty set, where the user may see nothing.
 */
function dedupeScopes(
  scopes: ScopeSummary[],
  id: (s: ScopeSummary) => number | null,
  allowed: Set<number> | null
): RailOption[] {
  const seen = new Map<number, string>();
  for (const scope of scopes) {
    const value = id(scope);
    if (value == null || seen.has(value)) continue;
    if (allowed != null && !allowed.has(value)) continue;
    seen.set(value, scope.scopeLabel || String(value));
  }
  return Array.from(seen, ([id, label]) => ({ id, label }));
}

function allowedValues(scopes: Scope[], dim: Dim, isSuperAdmin: boolean): Set<number> | null {
  if (isSuperAdmin || !scopes.length) return null;
  if (scopes.some((s) => s[dim] == null)) return null;
  return new Set(scopes.map((s) => s[dim] as number));
}

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

// ── Sortable table ────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";

type Column<T> = {
  /** Stable id for the column; also the sort key. */
  key: string;
  label: React.ReactNode;
  /** Right-aligned numeric column. */
  num?: boolean;
  /** The emphasised label column. */
  name?: boolean;
  /**
   * Value to sort on. Numbers compare numerically, strings naturally (so
   * "Class 9" precedes "Class 10"). Return null for "no value" — those rows
   * sink to the bottom in BOTH directions rather than pretending to be zero.
   */
  sortValue?: (row: T) => number | string | null;
  /** Cell content. Defaults to the sort value. */
  cell?: (row: T) => React.ReactNode;
  /** Columns that render a graphic rather than a value opt out. */
  sortable?: boolean;
  thStyle?: React.CSSProperties;
};

/**
 * A table whose columns sort ascending on first click and descending on the
 * next. Sorting is local to the table and never mutates the caller's array, so
 * the chart beside it keeps the order its author intended.
 *
 * Unsorted, rows render in the order given — several of these tables arrive
 * pre-sorted meaningfully (biggest ability gap first), and that default is
 * worth preserving until the user asks for something else.
 */
function SortableTable<T>({
  columns,
  rows,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null);

  const ordered = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    // Decorate with the original index so ties keep their incoming order —
    // Array.prototype.sort is only guaranteed stable from ES2019 and this also
    // documents the intent.
    return rows
      .map((row, i) => [row, i] as [T, number])
      .sort((a, b) => {
        const av = col.sortValue!(a[0]);
        const bv = col.sortValue!(b[0]);
        if (av == null || bv == null) {
          if (av == null && bv == null) return a[1] - b[1];
          return av == null ? 1 : -1;
        }
        let cmp: number;
        if (typeof av === "number" && typeof bv === "number") {
          cmp = av - bv;
        } else {
          cmp = String(av).localeCompare(String(bv), undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }
        return cmp === 0 ? a[1] - b[1] : cmp * dir;
      })
      .map(([row]) => row);
  }, [rows, sort, columns]);

  const toggle = (key: string) =>
    setSort((s) => (s && s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  return (
    <table className="sd-table">
      <thead>
        <tr>
          {columns.map((col) => {
            const canSort = col.sortable !== false && !!col.sortValue;
            const active = sort?.key === col.key;
            return (
              <th
                key={col.key}
                className={col.num ? "num" : undefined}
                style={col.thStyle}
                aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}
              >
                {canSort ? (
                  <button
                    type="button"
                    className={`sd-sort${active ? " is-active" : ""}`}
                    onClick={() => toggle(col.key)}
                  >
                    <span>{col.label}</span>
                    <span className="sd-sort-arrow" aria-hidden="true">
                      {active ? (sort!.dir === "asc" ? "▲" : "▼") : "▾"}
                    </span>
                  </button>
                ) : (
                  col.label
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {ordered.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((col) => (
              <td
                key={col.key}
                className={col.num ? "num" : col.name ? "name" : undefined}
              >
                {col.cell ? col.cell(row) : col.sortValue ? col.sortValue(row) : null}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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

/**
 * How this cohort's figure sits against the whole school's.
 *
 * Signed and in percentage points, because the question is direction and size, not the
 * school's own number — that is one column to the left and always available. A dash when
 * the school-wide sheet has no matching row, never a zero, which would read as "the same"
 * rather than "not comparable".
 *
 * Colour is not the only cue: the sign carries the meaning on its own for anyone who
 * cannot separate the two inks.
 */
const VsSchool: React.FC<{ value: number; baseline?: number }> = ({ value, baseline }) => {
  if (typeof baseline !== "number") return <span className="sd-vs sd-vs--none">—</span>;
  const diff = Math.round(value - baseline);
  if (diff === 0) return <span className="sd-vs sd-vs--same">same</span>;
  return (
    <span className={`sd-vs sd-vs--${diff > 0 ? "up" : "down"}`}>
      {diff > 0 ? "+" : "−"}
      {Math.abs(diff)} pts
    </span>
  );
};

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

  /**
   * The rail's other three dimensions.
   *
   * Session, grade and section combine; group does not. A group is stored as
   * independent of all three — cutting across classes is what a group is for — so
   * "Class 10 and the debate team" is not a scope that exists, and picking a group
   * clears the academic filters rather than pretending to intersect them.
   */
  const [sessionFilter, setSessionFilter] = useState<number | "All">("All");
  const [sectionFilter, setSectionFilter] = useState<number | "All">("All");
  const [groupFilter, setGroupFilter] = useState<number | "All">("All");

  /** Scopes this school actually had generated — what the rail is allowed to offer. */
  const [availableScopes, setAvailableScopes] = useState<ScopeSummary[]>([]);
  /** The narrative for the scope in view. */
  const [narrative, setNarrative] = useState<Narrative | null>(null);
  /** Screening counts for the scope in view. */
  const [flags, setFlags] = useState<StoredFlags | null>(null);
  /** The scope the payload was generated for, named as it was at release time. */
  const [storedScope, setStoredScope] = useState<StoredScope | null>(null);
  /**
   * The whole school, held alongside a narrowed view purely for comparison.
   *
   * "42% strong on speed and accuracy" is a fact; "42% against 58% school-wide" is the
   * finding a principal opened a class view to get. Fetched once per school, and null
   * while the school-wide scope is itself what's being shown.
   */
  const [baseline, setBaseline] = useState<SchoolDashboardData | null>(null);

  // A single institute in scope needs no picking.
  useEffect(() => {
    if (institutes.length === 1 && selectedInstitute === "") {
      setSelectedInstitute(Number(institutes[0].instituteCode));
    }
  }, [institutes, selectedInstitute]);

  // Release state for the scope the filter rail resolves to. This IS the data source:
  // the page renders what was generated, never a fresh computation, so a principal and
  // the narrative beside them are always looking at the same numbers.
  const [release, setRelease] = useState<ScopeView | null>(null);
  const [assessmentId, setAssessmentId] = useState<number | null>(null);

  /**
   * Unpack one scope row into everything the page draws from.
   *
   * Both stored payloads are read here, in one place, so the figures and the narrative
   * beside them can never come from different scopes.
   */
  const applyScopeRow = (row: ScopeView) => {
    const stored = row.released ? parseStoredPayload(row.internalCalculation) : null;
    setView(stored?.view ?? null);
    setFlags(stored?.flags ?? null);
    setStoredScope(stored?.scope ?? null);
    setNarrative(row.released ? parseNarrative(row.aiResponse) : null);
  };

  // Entry point: the newest release for this school. It also carries the assessmentId,
  // which the page has no other way to learn without recomputing.
  useEffect(() => {
    if (selectedInstitute === "") {
      setView(null);
      setRelease(null);
      setAssessmentId(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getLatestRelease(Number(selectedInstitute))
      .then((res) => {
        if (cancelled) return;
        setRelease(res.data);
        setAssessmentId(res.data.assessmentId ?? null);
        applyScopeRow(res.data);
        // The school-wide sheets double as the comparison every narrowed view is read
        // against, so they are kept aside before any filter narrows the page.
        const stored = res.data.released
          ? parseStoredPayload(res.data.internalCalculation)
          : null;
        setBaseline(stored?.view.dashboard ?? null);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setRelease(null);
        setView(null);
        setNarrative(null);
        setBaseline(null);
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
  }, [selectedInstitute]);

  // Switching school resets every filter — class 11 in one school says nothing about
  // the next, and a stale filter would silently narrow the load.
  useEffect(() => {
    setClassFilter("All");
    setSessionFilter("All");
    setSectionFilter("All");
    setGroupFilter("All");
  }, [selectedInstitute]);

  /**
   * Which scopes were actually generated.
   *
   * The rail offers only these. A filter that resolves to a scope nobody released would
   * show "not generated yet" on a page that was working a moment ago, which reads as a
   * fault rather than as an admin decision.
   */
  useEffect(() => {
    if (selectedInstitute === "" || assessmentId == null) {
      setAvailableScopes([]);
      return;
    }
    let cancelled = false;
    getReleasedScopes(Number(selectedInstitute), assessmentId)
      .then((res) => {
        if (!cancelled) setAvailableScopes(res.data ?? []);
      })
      .catch(() => {
        // The rail falls back to the grades in the payload; not fatal.
        if (!cancelled) setAvailableScopes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedInstitute, assessmentId]);

  // Narrowing the filter swaps to that scope's generated row. Nothing is computed —
  // if the scope was never released, the page says so rather than inventing it.
  useEffect(() => {
    if (selectedInstitute === "" || assessmentId == null) return;
    let cancelled = false;
    setLoading(true);
    const academic = groupFilter === "All";
    getScope(Number(selectedInstitute), {
      assessmentId,
      sessionId: academic && sessionFilter !== "All" ? Number(sessionFilter) : null,
      classId: academic && classFilter !== "All" ? Number(classFilter) : null,
      sectionId: academic && sectionFilter !== "All" ? Number(sectionFilter) : null,
      groupId: academic ? null : Number(groupFilter),
    })
      .then((res) => {
        if (cancelled) return;
        setRelease(res.data);
        applyScopeRow(res.data);
      })
      .catch(() => {
        if (!cancelled) setRelease(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedInstitute, assessmentId, sessionFilter, classFilter, sectionFilter, groupFilter]);

  /** Whether the view in hand is the school itself — nothing to compare it against. */
  const isSchoolWide =
    sessionFilter === "All" &&
    classFilter === "All" &&
    sectionFilter === "All" &&
    groupFilter === "All";

  const d = view?.dashboard ?? null;
  const p = view?.participation;

  // ── Hero ────────────────────────────────────────────────────────────────
  // Lead with the school's own name; the page title is the eyebrow's job.
  const schoolName =
    view?.instituteName ||
    (institutes.find((i: any) => Number(i.instituteCode) === selectedInstitute) as any)
      ?.instituteName ||
    "School Dashboard";

  // Which rail dimensions the user's ABAC grant pins to a single value.
  const allowedSessions = useMemo(
    () => allowedValues(userScopes, "s", isSuperAdmin),
    [userScopes, isSuperAdmin]
  );
  const allowedClasses = useMemo(
    () => allowedValues(userScopes, "c", isSuperAdmin),
    [userScopes, isSuperAdmin]
  );
  const allowedSections = useMemo(
    () => allowedValues(userScopes, "x", isSuperAdmin),
    [userScopes, isSuperAdmin]
  );

  const lockedSession = allowedSessions != null && allowedSessions.size === 1;

  /**
   * The rail is built from scopes that were actually released, intersected with the
   * user's grants.
   *
   * Two filters, and both matter. Offering a combination nobody generated puts the page
   * into "not generated yet" on a click that looked ordinary; offering one outside a
   * user's grant invites a request the server will refuse. Only scopes holding real
   * content are listed — a failed or still-running scope is not a destination.
   */
  const usableScopes = useMemo(
    () =>
      availableScopes.filter(
        (s) => s.status === "GENERATED" || s.status === "SKIPPED_SMALL_COHORT"
      ),
    [availableScopes]
  );

  const sessionOptions = useMemo(
    () =>
      dedupeScopes(
        usableScopes.filter((s) => s.scopeLevel === "SESSION"),
        (s) => s.sessionId,
        allowedSessions
      ),
    [usableScopes, allowedSessions]
  );

  const classScopes = useMemo(
    () =>
      usableScopes.filter(
        (s) =>
          s.scopeLevel === "CLASS" &&
          (sessionFilter === "All" || s.sessionId === Number(sessionFilter))
      ),
    [usableScopes, sessionFilter]
  );

  /**
   * Grades offered are the classes that were released, intersected with the user's class
   * grants — a school-scoped head of Grade 9 should not be shown Grade 10 just because
   * the school has one. Falls back to the payload's own grade list when the scope
   * lookup is unavailable, so the rail degrades rather than emptying.
   */
  const gradeOptions = useMemo(() => {
    const released = classScopes
      .map((s) => s.classId)
      .filter((c): c is number => c != null);
    const present = released.length > 0 ? released : view?.classesPresent ?? [];
    const unique = Array.from(new Set(present)).sort((a, b) => a - b);
    if (allowedClasses == null) return unique;
    return unique.filter((c) => allowedClasses.has(c));
  }, [classScopes, view, allowedClasses]);

  const sectionOptions = useMemo(
    () =>
      classFilter === "All"
        ? []
        : dedupeScopes(
            usableScopes.filter(
              (s) => s.scopeLevel === "SECTION" && s.classId === Number(classFilter)
            ),
            (s) => s.sectionId,
            allowedSections
          ),
    [usableScopes, classFilter, allowedSections]
  );

  const groupOptions = useMemo(
    () =>
      dedupeScopes(
        usableScopes.filter((s) => s.scopeLevel === "GROUP"),
        (s) => s.groupId,
        null
      ),
    [usableScopes]
  );

  const lockedSection = allowedSections != null && allowedSections.size === 1;
  const lockedGrade = gradeOptions.length === 1 && allowedClasses != null;

  // A group cuts across classes, so an academic filter alongside it would describe a
  // cohort nobody generated. Picking one clears the other.
  useEffect(() => {
    if (groupFilter !== "All") {
      setSessionFilter("All");
      setClassFilter("All");
      setSectionFilter("All");
    }
  }, [groupFilter]);

  // A section belongs to a class; changing the class abandons it.
  useEffect(() => {
    setSectionFilter("All");
  }, [classFilter]);

  // A grant that pins exactly one grade should pin the request too, not just
  // the control — otherwise the page loads school-wide behind a locked filter.
  useEffect(() => {
    if (lockedGrade && classFilter !== String(gradeOptions[0])) {
      setClassFilter(String(gradeOptions[0]));
    }
  }, [lockedGrade, gradeOptions, classFilter]);

  const studentsInView = d ? d.summary.studentsInView : view?.distinctStudents ?? null;

  const scopeSummary = useMemo(() => {
    if (isSuperAdmin) return "Full access — every school, grade and section.";
    if (!userScopes.length) return "No access restrictions are set on your account.";
    const parts: string[] = [];
    parts.push(
      allowedInstituteIds == null
        ? "All schools"
        : `${allowedInstituteIds.size} school${allowedInstituteIds.size === 1 ? "" : "s"}`
    );
    parts.push(
      allowedClasses == null
        ? "all grades"
        : `grade${allowedClasses.size === 1 ? "" : "s"} ${Array.from(allowedClasses)
            .sort((a, b) => a - b)
            .join(", ")}`
    );
    parts.push(allowedSections == null ? "all sections" : `${allowedSections.size} section(s)`);
    return `${parts.join(" · ")} — locked filters are fixed by your role and cannot be widened here.`;
  }, [isSuperAdmin, userScopes, allowedInstituteIds, allowedClasses, allowedSections]);

  return (
    <div className="school-dashboard" ref={rootRef}>
      <header className="sd-header">
        <div className="sd-header-top">
          <div>
            {/* The session comes off the generated payload rather than the rail: it is
                the session the figures were computed for, which stays right even when
                the rail leaves the dimension unbound. */}
            <p className="sd-eyebrow">
              Navigator 360
              {storedScope?.sessionLabel ? ` · ${storedScope.sessionLabel}` : ""}
            </p>
            <h1 className="sd-title">{schoolName}</h1>
            <p className="sd-subtitle">
              Where every class stands right now — who has finished, who has stalled,
              and which sections need a teacher to step in this week.
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
              disabled={institutesLoading || institutes.length === 1}
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

        {/* One filter row above everything it scopes. Each control offers only what was
            released, so a selection always lands on generated content. Group sits apart
            from the other three: it is stored as independent of them, so choosing one
            clears the rest rather than implying an intersection that has no scope. */}
        <div className="sd-rail">
          {sessionOptions.length > 0 && (
            <div className="sd-field">
              <label htmlFor="sd-f-session">
                Session
                {lockedSession && <span className="sd-lock">Scoped</span>}
              </label>
              <select
                id="sd-f-session"
                value={sessionFilter}
                disabled={!view || groupFilter !== "All"}
                onChange={(e) =>
                  setSessionFilter(e.target.value === "All" ? "All" : Number(e.target.value))
                }
              >
                <option value="All">All sessions</option>
                {sessionOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="sd-field">
            <label htmlFor="sd-f-grade">
              Grade
              {lockedGrade && <span className="sd-lock">Scoped</span>}
            </label>
            <select
              id="sd-f-grade"
              value={classFilter}
              disabled={!view || lockedGrade || groupFilter !== "All"}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="All">All grades</option>
              {gradeOptions.map((c) => (
                <option key={c} value={String(c)}>
                  Grade {c}
                </option>
              ))}
            </select>
          </div>

          <div className="sd-field">
            <label htmlFor="sd-f-section">
              Section
              {lockedSection && <span className="sd-lock">Scoped</span>}
            </label>
            <select
              id="sd-f-section"
              value={sectionFilter}
              disabled={!view || classFilter === "All" || sectionOptions.length === 0 || groupFilter !== "All"}
              onChange={(e) =>
                setSectionFilter(e.target.value === "All" ? "All" : Number(e.target.value))
              }
            >
              <option value="All">
                {classFilter === "All"
                  ? "Pick a grade first"
                  : sectionOptions.length === 0
                  ? "No sections released"
                  : "All sections"}
              </option>
              {sectionOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sd-field">
            <label htmlFor="sd-f-group">Group</label>
            <select
              id="sd-f-group"
              value={groupFilter}
              disabled={!view || groupOptions.length === 0}
              onChange={(e) =>
                setGroupFilter(e.target.value === "All" ? "All" : Number(e.target.value))
              }
            >
              <option value="All">
                {groupOptions.length === 0 ? "No groups released" : "All groups"}
              </option>
              {groupOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sd-rail-end">
            <div className="sd-inview">
              <b>{studentsInView == null ? "—" : studentsInView.toLocaleString()}</b>
              <span>in view</span>
            </div>
            <button
              type="button"
              className="sd-reset"
              onClick={() => {
                setSessionFilter("All");
                setClassFilter("All");
                setSectionFilter("All");
                setGroupFilter("All");
              }}
              disabled={isSchoolWide}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="sd-scope">
          <span className="sd-scope-key">Your access</span>
          {scopeSummary}
        </div>
      </header>

      {selectedInstitute === "" ? (
        <div className="sd-empty">
          <div className="sd-empty-title">Pick a school to begin</div>
          Choose a school above and its full assessment picture loads here.
        </div>
      ) : !view && loading ? (
        <div className="sd-empty">
          <div className="sd-empty-title">Loading the dashboard…</div>
          Reading the analysis Career-9 generated for this school.
        </div>
      ) : !release || !release.released ? (
        /* Checked before the empty-data case, and deliberately so: an ungenerated scope
           has no view either, and "nothing to show" would blame the school for a step
           nobody has run. The dashboard is produced by an explicit Release, never
           computed on view, so this tells the reader who to ask. */
        <div className="sd-empty">
          <div className="sd-empty-title">Dashboard is not Generated Yet</div>
          Please contact your administrator / Career-9 team.
          {release?.status === "FAILED" && (
            <div className="sd-empty-detail">
              The last attempt to generate this dashboard failed. The Career-9 team can
              retry it.
            </div>
          )}
          {(release?.status === "PENDING" || release?.status === "GENERATING") && (
            <div className="sd-empty-detail">
              Generation is running now. This page will have data shortly.
            </div>
          )}
          {!isSchoolWide && (
            <div className="sd-empty-detail">
              This applies to {release?.scopeLabel || "the selection above"} — other views
              of this school may already be generated.
            </div>
          )}
        </div>
      ) : !view ? (
        <div className="sd-empty">
          <div className="sd-empty-title">Nothing to show</div>
          This school has no assessment data yet.
        </div>
      ) : (
        <div className={loading ? "sd-refetching" : undefined}>
          {/* The generated narrative leads: the charts below say what the numbers are,
              this says what they mean and what to do — which is the part a principal
              cannot read off a bar chart. */}
          {release && release.released && (
            <SchoolDashboardInsights
              release={release}
              narrative={narrative}
              flags={flags}
              scopeLabel={release.scopeLabel || "Whole school"}
            />
          )}

          <ParticipationCards view={view} palette={palette} />

          {d && (
            <>
              {/* Every figure below is this scope's own — participation included, which
                  is why the old school-wide caveat is gone. What a narrowed view cannot
                  say on its own is how it compares, so that is what this line carries. */}
              {!isSchoolWide && (
                <div className="sd-filters">
                  <span className="sd-filter-note">
                    {release?.scopeLabel || "This selection"} ·{" "}
                    {view.scoredStudents} scored of {view.participation.total}
                    {baseline && " · figures compared against the whole school below"}
                  </span>
                </div>
              )}

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
              {/* The whole school is passed only when the view is narrower than it —
                  comparing the school to itself is a column of zeroes. */}
              {tab === "Personality & Learning" && (
                <PersonalityTab
                  view={view}
                  palette={palette}
                  baseline={isSchoolWide ? null : baseline}
                />
              )}
              {tab === "Abilities" && (
                <AbilitiesTab
                  view={view}
                  palette={palette}
                  baseline={isSchoolWide ? null : baseline}
                />
              )}
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

/**
 * How a completion rate reads to a principal. The thresholds are the point of
 * the row: a bare percentage makes you do the arithmetic, a word does not.
 */
function completionFlag(pct: number): { label: string; ink: string; bg: string } {
  if (pct >= 85) return { label: "On track", ink: "var(--status-good-ink)", bg: "var(--status-good-bg)" };
  if (pct >= 60) return { label: "Slipping", ink: "var(--status-warning-ink)", bg: "var(--status-warning-bg)" };
  return { label: "Needs attention", ink: "var(--status-critical-ink)", bg: "var(--status-critical-bg)" };
}

/**
 * One assessment, collapsed to a single line: name, progress bar, and the
 * completed/total count. Expanding reveals the four counts as chips.
 *
 * The class-by-class split a principal ultimately wants lives behind
 * SchoolDashboardView.assessments, which is school-wide per assessment — the
 * per-class breakdown needs the endpoint to return it, so the expanded body
 * says what it knows rather than inventing a table.
 */
const AssessmentRow: React.FC<{
  a: SchoolDashboardView["assessments"][number];
  palette: Palette;
}> = ({ a, palette }) => {
  const [open, setOpen] = useState(false);
  const seg = (n: number) => (a.total ? (n / a.total) * 100 : 0);
  const flag = completionFlag(a.completedPct);

  return (
    <div className={`sd-assessment-row${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="sd-assessment-sum"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sd-chevron" aria-hidden="true">
          ▶
        </span>
        <span>
          <span className="sd-assessment-name">{a.assessmentName}</span>
          <span className="sd-assessment-meta">
            {a.scored > 0 ? `${a.scored} scored & ready` : "Not scored yet"}
          </span>
        </span>
        <span
          className="sd-stack is-compact"
          role="img"
          aria-label={`${a.assessmentName}: ${a.completed} completed, ${a.ongoing} ongoing, ${a.notStarted} not started`}
        >
          {a.completed > 0 && (
            <span className="sd-stack-seg" style={{ width: `${seg(a.completed)}%`, background: palette.good }} />
          )}
          {a.ongoing > 0 && (
            <span className="sd-stack-seg" style={{ width: `${seg(a.ongoing)}%`, background: palette.warning }} />
          )}
          {a.notStarted > 0 && (
            <span className="sd-stack-seg" style={{ width: `${seg(a.notStarted)}%`, background: palette.muted }} />
          )}
        </span>
        <span className="sd-assessment-count">
          <b>
            {a.completed} / {a.total}
          </b>
          <span>{a.completedPct}% complete</span>
        </span>
      </button>

      {open && (
        <div className="sd-assessment-body">
          <div className="sd-chips">
            <span className="sd-flag" style={{ ["--flag-ink" as any]: flag.ink, ["--flag-bg" as any]: flag.bg }}>
              {flag.label}
            </span>
            <span className="sd-chip-stat">
              <span className="sd-legend-dot" style={{ background: palette.good }} aria-hidden="true" />
              {a.completed} <small>completed</small>
            </span>
            <span className="sd-chip-stat">
              <span className="sd-legend-dot" style={{ background: palette.warning }} aria-hidden="true" />
              {a.ongoing} <small>ongoing</small>
            </span>
            <span className="sd-chip-stat">
              <span className="sd-legend-dot" style={{ background: palette.muted }} aria-hidden="true" />
              {a.notStarted} <small>not started</small>
            </span>
            <span className="sd-chip-stat">
              <span className="sd-legend-dot" style={{ background: palette.s1 }} aria-hidden="true" />
              {a.scored} <small>scored &amp; ready</small>
            </span>
          </div>
          <p className="sd-note">
            <strong>{a.notStarted}</strong> student{a.notStarted === 1 ? " has" : "s have"} not opened
            this assessment yet, and <strong>{a.ongoing}</strong> started without submitting. Use the
            Grade filter above to see how a single grade is doing.
          </p>
        </div>
      )}
    </div>
  );
};

const ParticipationCards: React.FC<{ view: SchoolDashboardView; palette: Palette }> = ({
  view,
  palette,
}) => {
  const p = view.participation;
  const [cardOpen, setCardOpen] = useState(true);
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
        <div className={`sd-card${cardOpen ? "" : " is-collapsed"}`}>
          {/* The whole card folds away, not just its rows — a principal who has
              read the participation numbers wants the insight tabs, not this. */}
          <button
            type="button"
            className="sd-card-head sd-card-toggle"
            aria-expanded={cardOpen}
            aria-controls="sd-assessment-panel"
            onClick={() => setCardOpen((v) => !v)}
          >
            <div>
              <h3 className="sd-card-title">
                <span className="sd-chevron" aria-hidden="true">
                  ▶
                </span>
                Progress by assessment
              </h3>
              <p className="sd-card-sub">
                {cardOpen
                  ? "Every assessment assigned in this school. Counts are student–assessment pairs, so a student sitting three assessments appears three times."
                  : `${view.assessments.length} assessment${
                      view.assessments.length === 1 ? "" : "s"
                    } · ${p.completedPct}% complete overall`}
              </p>
            </div>
            <span className="sd-card-hint">{cardOpen ? "Hide" : "Show"}</span>
          </button>

          {cardOpen && (
            <div id="sd-assessment-panel">
              {view.assessments.map((a) => (
                <AssessmentRow key={a.assessmentId} a={a} palette={palette} />
              ))}
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
            <SortableTable
              rows={classData}
              rowKey={(c) => c.name}
              columns={[
                { key: "name", label: "Class", name: true, sortValue: (c) => c.name },
                { key: "students", label: "Students", num: true, sortValue: (c) => c.students },
                {
                  key: "pct",
                  label: "% of school",
                  num: true,
                  sortValue: (c) => c.pct,
                  cell: (c) => `${c.pct}%`,
                },
              ]}
            />
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
            <SortableTable
              rows={d.careerGap.streams}
              rowKey={(r) => r.label}
              columns={[
                { key: "label", label: "Stream", name: true, sortValue: (r) => r.label },
                {
                  key: "suited",
                  label: "Suited %",
                  num: true,
                  sortValue: (r) => r.suitedPct,
                  cell: (r) => `${r.suitedPct}%`,
                },
                {
                  key: "aspiring",
                  label: "Aspiring %",
                  num: true,
                  sortValue: (r) => r.aspiringPct,
                  cell: (r) => `${r.aspiringPct}%`,
                },
                {
                  key: "gap",
                  label: "Gap",
                  num: true,
                  sortValue: (r) => r.gap,
                  cell: (r) => `${r.gap > 0 ? "+" : ""}${r.gap}`,
                },
              ]}
            />
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

const PersonalityTab: React.FC<{
  view: SchoolDashboardView;
  palette: Palette;
  baseline: SchoolDashboardData | null;
}> = ({ view, palette, baseline }) => {
  const d = view.dashboard!;
  const schoolWide = byLabel(baseline?.personality.traits);
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
            <SortableTable
              rows={traits}
              rowKey={(t) => t.label}
              columns={[
                { key: "label", label: "Trait", name: true, sortValue: (t) => t.label },
                {
                  key: "avg",
                  label: "Avg score",
                  num: true,
                  sortValue: (t) => t.avgRawScore,
                  cell: (t) => t.avgRawScore.toFixed(1),
                },
                {
                  key: "top",
                  label: "% top trait",
                  num: true,
                  sortValue: (t) => t.pctAsTopTrait,
                  cell: (t) => `${t.pctAsTopTrait}%`,
                },
                // Only on a narrowed view — a class's character is only interesting
                // against the school it sits in.
                ...(schoolWide.size > 0
                  ? [
                      {
                        key: "vsSchool",
                        label: "vs school",
                        num: true,
                        sortValue: (t: typeof traits[number]) =>
                          t.pctAsTopTrait -
                          (schoolWide.get(t.label)?.pctAsTopTrait ?? t.pctAsTopTrait),
                        cell: (t: typeof traits[number]) => (
                          <VsSchool
                            value={t.pctAsTopTrait}
                            baseline={schoolWide.get(t.label)?.pctAsTopTrait}
                          />
                        ),
                      },
                    ]
                  : []),
                {
                  key: "top3",
                  label: "% in top three",
                  num: true,
                  sortValue: (t) => t.pctInTopThree,
                  cell: (t) => `${t.pctInTopThree}%`,
                },
              ]}
            />
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
            <SortableTable
              rows={traits}
              rowKey={(t) => t.label}
              columns={[
                { key: "label", label: "Trait", name: true, sortValue: (t) => t.label },
                {
                  key: "top",
                  label: "Top trait",
                  num: true,
                  sortValue: (t) => t.pctAsTopTrait,
                  cell: (t) => `${t.pctAsTopTrait}%`,
                },
                {
                  key: "top3",
                  label: "In top three",
                  num: true,
                  sortValue: (t) => t.pctInTopThree,
                  cell: (t) => `${t.pctInTopThree}%`,
                },
                {
                  key: "students",
                  label: "Students",
                  num: true,
                  sortValue: (t) => t.studentsTopTrait,
                },
              ]}
            />
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
            <SortableTable
              rows={intelligences}
              rowKey={(i) => i.label}
              columns={[
                { key: "label", label: "Intelligence", name: true, sortValue: (i) => i.label },
                {
                  key: "strongPct",
                  label: "% strong",
                  num: true,
                  sortValue: (i) => i.pctStrong,
                  cell: (i) => `${i.pctStrong}%`,
                },
                {
                  key: "lowPct",
                  label: "% low",
                  num: true,
                  sortValue: (i) => i.pctLow,
                  cell: (i) => `${i.pctLow}%`,
                },
                {
                  key: "avg",
                  label: "Avg score",
                  num: true,
                  sortValue: (i) => i.avgScore,
                  cell: (i) => i.avgScore.toFixed(1),
                },
                { key: "strong", label: "Strong", num: true, sortValue: (i) => i.studentsStrong },
                { key: "low", label: "Low", num: true, sortValue: (i) => i.studentsLow },
              ]}
            />
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

const AbilitiesTab: React.FC<{
  view: SchoolDashboardView;
  palette: Palette;
  baseline: SchoolDashboardData | null;
}> = ({ view, palette, baseline }) => {
  const d = view.dashboard!;
  // Sorted by gap so the teaching priorities sit at one end.
  const sorted: AbilityRow[] = [...d.abilities.abilities].sort((a, b) => b.gap - a.gap);
  const worst = sorted[0];
  const schoolWide = byLabel(baseline?.abilities.abilities);

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
            <SortableTable
              rows={sorted}
              rowKey={(a) => a.label}
              columns={[
                { key: "label", label: "Ability", name: true, sortValue: (a) => a.label },
                {
                  key: "strongPct",
                  label: "% strong",
                  num: true,
                  sortValue: (a) => a.pctStrong,
                  cell: (a) => `${a.pctStrong}%`,
                },
                // Only present on a narrowed view: "42% strong" is a fact, "42% against
                // 58% school-wide" is the reason someone opened a class.
                ...(schoolWide.size > 0
                  ? [
                      {
                        key: "vsSchool",
                        label: "vs school",
                        num: true,
                        sortValue: (a: AbilityRow) =>
                          a.pctStrong - (schoolWide.get(a.label)?.pctStrong ?? a.pctStrong),
                        cell: (a: AbilityRow) => (
                          <VsSchool
                            value={a.pctStrong}
                            baseline={schoolWide.get(a.label)?.pctStrong}
                          />
                        ),
                      },
                    ]
                  : []),
                {
                  key: "lowPct",
                  label: "% low",
                  num: true,
                  sortValue: (a) => a.pctLow,
                  cell: (a) => `${a.pctLow}%`,
                },
                {
                  key: "gap",
                  label: "Gap",
                  num: true,
                  sortValue: (a) => a.gap,
                  cell: (a) => `${a.gap > 0 ? "+" : ""}${a.gap}`,
                },
                {
                  key: "avg",
                  label: "Avg score",
                  num: true,
                  sortValue: (a) => a.avgScore,
                  cell: (a) => a.avgScore.toFixed(1),
                },
              ]}
            />
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
            <SortableTable
              rows={values}
              rowKey={(v) => v.label}
              columns={[
                {
                  key: "rank",
                  label: "Rank",
                  num: true,
                  // Unranked values sink to the bottom either way — a missing
                  // rank is not rank zero.
                  sortValue: (v) => v.rank,
                  cell: (v) => v.rank ?? "—",
                },
                { key: "label", label: "Value", name: true, sortValue: (v) => v.label },
                {
                  key: "pct",
                  label: "% in top five",
                  num: true,
                  sortValue: (v) => v.pctInTopFive,
                  cell: (v) => `${v.pctInTopFive}%`,
                },
                { key: "students", label: "Students", num: true, sortValue: (v) => v.students },
              ]}
            />
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
            <SortableTable
              rows={clusters}
              rowKey={(c) => c.label}
              columns={[
                { key: "label", label: "Career cluster", name: true, sortValue: (c) => c.label },
                { key: "stream", label: "Stream", sortValue: (c) => c.stream },
                { key: "suited", label: "Suited", num: true, sortValue: (c) => c.suitedTop3 },
                { key: "aspiring", label: "Aspiring", num: true, sortValue: (c) => c.aspiring },
                {
                  key: "gap",
                  label: "Gap",
                  thStyle: { minWidth: 150 },
                  // Sorts on the signed gap, so ascending runs from the most
                  // under-subscribed cluster to the most over-subscribed.
                  sortValue: (c) => c.gap,
                  cell: (c) => {
                    const width = (Math.abs(c.gap) / maxAbsGap) * 50;
                    return (
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
                    );
                  },
                },
                {
                  key: "readiness",
                  label: "Readiness",
                  num: true,
                  sortValue: (c) => c.readinessPct,
                  cell: (c) => (c.readinessPct == null ? "—" : `${c.readinessPct}%`),
                },
              ]}
            />
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
            <SortableTable
              rows={clarityData}
              rowKey={(c) => c.name}
              columns={[
                { key: "name", label: "Class", name: true, sortValue: (c) => c.name },
                { key: "students", label: "Students", num: true, sortValue: (c) => c.students },
                {
                  key: "clarity",
                  label: "Career clarity",
                  num: true,
                  sortValue: (c) => c.clarity,
                  cell: (c) => `${c.clarity}%`,
                },
                { key: "weak", label: "5+ weak abilities", num: true, sortValue: (c) => c.weak },
              ]}
            />
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
