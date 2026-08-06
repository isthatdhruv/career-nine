import React, { useEffect, useState } from "react";
import {
  FlaggedStudent,
  FlagTier,
  getFlaggedStudents,
  logChartData,
  ScopeParams,
  ScopeView,
} from "./PrincipalDashboardRelease_APIs";
import { Emphasis } from "./ChartCommentary";
import {
  CardType,
  InsightCard,
  Narrative,
  NarrativeChart,
  ReportSection,
  StoredFlags,
} from "./StoredDashboard";

/**
 * Which part of the briefing to render.
 *
 * One component, three call sites: the figures belong to the page (they describe the
 * cohort every tab is about), while the analysis and the actions are tabs of their own.
 * Splitting by prop rather than into three components keeps the two payloads parsed
 * once, in one place, so the figures and the prose can never come from different scopes.
 */
export type InsightSection = "stats" | "analysis" | "act";

interface Props {
  section: InsightSection;
  release: ScopeView;
  narrative: Narrative | null;
  flags: StoredFlags | null;
  /** What the rail resolved to, for the heading. */
  scopeLabel: string;
  /** The cohort in view, for the requests that ask about it. */
  scopeParams: ScopeParams;
}

/**
 * The interpretive layer, read from what a release stored.
 *
 * Nothing here is computed in the browser. The figures came out of one scoring pass and
 * the reading of them came out of one model call over those same figures, so a principal
 * and the sentence beside them can never be looking at different numbers.
 *
 * The page is arranged as a briefing rather than a dashboard: one verdict, three things
 * to do about it, then the report as a readable document. An earlier version stacked
 * KPIs, ten cards and a flag strip in front of the analysis, which buried the substantive
 * half behind its own summary.
 */
const SchoolDashboardInsights: React.FC<Props> = ({
  section,
  release,
  narrative,
  flags,
  scopeLabel,
  scopeParams,
}) => {
  // Below the cohort floor a scope keeps its figures but is deliberately not written up:
  // percentages over a handful of students carry no precision, and prose about six
  // children stops describing a cohort. Saying so beats an empty panel.
  if (release.status === "SKIPPED_SMALL_COHORT") {
    return (
      <section className="sd-note">
        <h2>No written analysis for {scopeLabel}</h2>
        <p>
          {release.studentCount ?? 0} student
          {release.studentCount === 1 ? "" : "s"} completed here — under the{" "}
          {release.minCohortSize ?? 10} needed before Career-9 writes up a cohort. The
          figures below are still this group's own.
        </p>
      </section>
    );
  }

  if (!narrative) {
    // Released, figures present, narrative missing or unreadable. The charts below are
    // unaffected, so this is a note rather than an error state.
    return release.released ? (
      <section className="sd-note">
        <h2>Figures only for {scopeLabel}</h2>
        <p>
          The written analysis for this view is not available. Everything below is
          unaffected.
        </p>
      </section>
    ) : null;
  }

  const { kpis, cards, alerts } = narrative.dashboard_insights;
  const sections = narrative.report.sections;

  // Attention before reassurance. The model is asked to order these itself; this is the
  // backstop for when it does not.
  const ranked = [...cards].sort(
    (a, b) => CARD_ORDER.indexOf(a.type) - CARD_ORDER.indexOf(b.type)
  );
  const headlineCards = ranked.slice(0, 3);

  /** Section 9 is the flagged-student section; the tiles hang off it. */
  const flagsSection = sections.some((s) => s.number === 9) ? 9 : null;

  // ── Figures: the page's own, above the tabs ──
  if (section === "stats") {
    if (kpis.length === 0) return null;
    return (
      <div className="sd-stats-strip">
        {kpis.slice(0, 4).map((kpi) => (
          <div key={kpi.id || kpi.label} className="sd-stat">
            <span className="sd-stat-n">
              {formatValue(kpi.value)}
              {kpi.unit && <em>{kpi.unit}</em>}
            </span>
            <span className="sd-stat-l">{kpi.label}</span>
          </div>
        ))}
      </div>
    );
  }

  // ── Act: the three things to do, and who they are about ──
  if (section === "act") {
    return (
      <div className="sd-brief">
        <StaleBanner release={release} />

        {headlineCards.length > 0 ? (
          <div className="sd-actions">
            {headlineCards.map((card) => (
              <ActionCard key={card.id || card.title} card={card} />
            ))}
          </div>
        ) : (
          <div className="sd-note">
            <h2>Nothing flagged to act on</h2>
            <p>The analysis found no gaps or risks worth singling out for {scopeLabel}.</p>
          </div>
        )}

        {alerts.length > 0 && (
          <div className="sd-alerts">
            {alerts.map((alert) => (
              <div key={alert.id || alert.label} className="sd-alert">
                <span className="sd-alert-count">{alert.count}</span>
                <div>
                  <div className="sd-alert-label"><Emphasis text={alert.label} /></div>
                  <div className="sd-alert-action"><Emphasis text={alert.action} /></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {flags && flags.base > 0 && (
          <>
            <h2 className="sd-rule">Students to look at</h2>
            <FlagTiles flags={flags} scopeParams={scopeParams} />
          </>
        )}
      </div>
    );
  }

  // ── Analysis: the verdict and the document ──
  return (
    <div className="sd-brief">
      <StaleBanner release={release} />

      {/* The verdict. A principal who reads nothing else should still leave knowing
          this, which is why it is a sentence at display size rather than a number. */}
      <section className="sd-verdict">
        <p className="sd-verdict-kicker">
          What this cohort is telling you · {scopeLabel}
        </p>
        <p className="sd-verdict-line">
          <Emphasis text={narrative.headline || fallbackHeadline(ranked)} />
        </p>
      </section>

      {sections.length > 0 && (
        <div className="sd-doc">
          <nav className="sd-toc" aria-label="Sections of the analysis">
            <div className="sd-toc-title">Sections</div>
            <ol>
              {sections.map((s) => (
                <li key={s.id || s.number}>
                  <button type="button" onClick={() => scrollToSection(sectionDomId(s))}>
                    {s.title}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <div className="sd-doc-body">
            <header className="sd-doc-head">
              <h3>{scopeLabel}</h3>
              <p>
                Written from {release.studentCount ?? narrative.cohort.n} scored profile
                {(release.studentCount ?? narrative.cohort.n) === 1 ? "" : "s"}
                {release.generatedAt &&
                  ` on ${new Date(release.generatedAt).toLocaleDateString()}`}
                . Every figure states the group it is based on.
              </p>
              {/* TEMPORARY — remove with the backend's /log-chart-data endpoint. */}
              <LogChartDataButton scopeParams={scopeParams} />
            </header>

            {sections.map((s) => (
              <SectionView key={s.id || s.number} section={s} />
            ))}

            <Provenance narrative={narrative} />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * A DOM id for a section.
 *
 * `section.id` is whatever the model wrote — "s2", "programme-summary", or "Section 1"
 * with a space in it. Anything but `[A-Za-z0-9_-]` is replaced, so the value is always a
 * usable id, and the section number keeps two sections from colliding when the model
 * reuses a slug.
 */
function sectionDomId(section: ReportSection): string {
  const raw = `${section.number}-${section.id || "section"}`;
  return `sd-sec-${raw.replace(/[^A-Za-z0-9_-]+/g, "-")}`;
}

/**
 * Take the reader to a section.
 *
 * `scrollIntoView` rather than an `href="#id"` anchor: the page sits inside Metronic's
 * scrolling wrapper rather than the document, so native fragment navigation can land on
 * an element the window never scrolls to. This also survives an id the model wrote that
 * would not have been a valid fragment.
 */
function scrollToSection(domId: string) {
  const el = document.getElementById(domId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Risk first, strength last — the order someone scanning for problems needs. */
const CARD_ORDER: CardType[] = ["risk", "gap", "opportunity", "strength"];

const CARD_WORD: Record<CardType, string> = {
  risk: "Risk",
  gap: "Gap",
  opportunity: "Opportunity",
  strength: "Strength",
};

/**
 * The verdict when the model did not write one.
 *
 * Rows generated before `headline` existed have none, and an empty display-size line is
 * worse than the sharpest finding the report does carry.
 */
function fallbackHeadline(cards: InsightCard[]): string {
  return cards[0]?.insight ?? "";
}

/**
 * One thing to act on: the number, why it matters, and the instruction.
 *
 * The action is the point of the card. A finding without one is a statistic, so it gets
 * its own line under a rule rather than being folded into the prose.
 */
const ActionCard = ({ card }: { card: InsightCard }) => {
  const lead = card.numbers[0];
  return (
    <article className={`sd-action sd-action--${card.type}`}>
      <span className="sd-action-kind">{CARD_WORD[card.type]}</span>
      {lead && (
        <span className="sd-action-n">
          {formatValue(lead.value)}
          {lead.unit && <em>{lead.unit}</em>}
        </span>
      )}
      <h3><Emphasis text={card.title} /></h3>
      <p><Emphasis text={card.insight} /></p>
      {card.action && (
        <p className="sd-action-do">
          <b>Do:</b> <Emphasis text={card.action} />
        </p>
      )}
    </article>
  );
};

const SectionView = ({ section }: { section: ReportSection }) => (
  <section className="sd-sec" id={sectionDomId(section)}>
    <h3>
      <span>{section.number}</span>
      {section.title}
    </h3>

    {section.body.map((paragraph, i) => (
      <p key={i}>
        <Emphasis text={paragraph} />
      </p>
    ))}

    {section.charts.map((chart, i) => (
      <ChartBlock key={i} chart={chart} />
    ))}

    {section.tables.map((table, i) => (
      <div key={i} className="sd-tbl-wrap">
        {table.title && <div className="sd-tbl-title">{table.title}</div>}
        <table className="sd-tbl">
          <thead>
            <tr>
              {table.columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className={c === 0 ? undefined : "num"}>
                    <Emphasis text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ))}

    {section.bullets.map((bullet, i) => (
      <div key={i} className="sd-bullet">
        {bullet.label && (
          <span className="sd-bullet-label">
            <Emphasis text={bullet.label} />
          </span>
        )}
        <p>
          <Emphasis text={bullet.text} />
        </p>
        {bullet.meta.length > 0 && (
          <ul className="sd-bullet-meta">
            {bullet.meta.map((m) => (
              <li key={m.key}>
                <span>{m.key}</span>
                <b>{m.value}</b>
              </li>
            ))}
          </ul>
        )}
      </div>
    ))}

    {section.callouts.map((callout, i) => (
      <div key={i} className="sd-pull">
        <Emphasis text={callout.text} />
      </div>
    ))}
  </section>
);

/**
 * The narrative's own charts, as direct-labelled bars.
 *
 * Every bar carries its number rather than relying on the key: the categorical green sits
 * at 2.74:1 on this surface — fine as a fill, not as the only way to read a value.
 * Bars are scaled against the largest value across all series so two series stay
 * comparable, and a legend appears whenever there is more than one.
 */
const ChartBlock = ({ chart }: { chart: NarrativeChart }) => {
  const series = chart.series.filter((s) => s.values.length > 0);
  if (series.length === 0 || chart.labels.length === 0) return null;

  const max = Math.max(1, ...series.flatMap((s) => s.values.map((v) => Math.abs(v))));
  const slots = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];

  return (
    <figure className="sd-chart">
      {chart.title && (
        <figcaption className="sd-chart-title">
          <Emphasis text={chart.title} />
        </figcaption>
      )}
      {chart.caption && (
        <p className="sd-chart-cap">
          <Emphasis text={chart.caption} />
        </p>
      )}

      {series.length > 1 && (
        <div className="sd-key">
          {series.map((s, i) => (
            <span key={s.name}>
              <i style={{ background: slots[i % slots.length] }} />
              {s.name}
            </span>
          ))}
        </div>
      )}

      <div className="sd-chart-rows">
        {chart.labels.map((label, row) => (
          <div key={label + row} className="sd-chart-row">
            <div className="sd-chart-label">{label}</div>
            <div className="sd-chart-bars">
              {series.map((s, i) => (
                <div key={s.name} className="sd-nbar">
                  <div
                    className="sd-nbar-fill"
                    style={{
                      width: `${(Math.abs(s.values[row] ?? 0) / max) * 100}%`,
                      background: slots[i % slots.length],
                    }}
                  />
                  <span className="sd-nbar-v">
                    {s.values[row] == null ? "—" : formatValue(s.values[row])}
                    {s.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
};

/**
 * Screening counts, from the stored figures rather than the narrative.
 *
 * Shown beside the section that discusses them so the count and the prose are visibly one
 * fact. Deliberately anonymous — a tier is a queue for a conversation, not a label.
 */
/** The three tiers, with the key the endpoint resolves names by. */
const TIERS: { tier: FlagTier; label: string; tone: string }[] = [
  { tier: "acute", label: "No ability at strength level and eight or more weak", tone: "crit" },
  { tier: "abilitySupport", label: "Five or more weak abilities", tone: "warn" },
  { tier: "guidanceMismatch", label: "Aspirations do not overlap their suitability", tone: "warn" },
];

/**
 * Screening counts, from the stored figures rather than the narrative.
 *
 * Opening a tier fetches the students in it. The names are not part of the payload the
 * page loads — they are asked for only when someone opens a tier, so identifiable
 * screening data crosses the wire on request rather than on every view.
 */
const FlagTiles = ({
  flags,
  scopeParams,
}: {
  flags: StoredFlags;
  scopeParams: ScopeParams;
}) => {
  const [open, setOpen] = useState<FlagTier | null>(null);
  const [students, setStudents] = useState<FlaggedStudent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A different cohort is a different list; keep neither the panel nor its contents.
  useEffect(() => {
    setOpen(null);
    setStudents(null);
    setError(null);
  }, [scopeParams]);

  const toggle = (tier: FlagTier) => {
    if (open === tier) {
      setOpen(null);
      return;
    }
    setOpen(tier);
    setStudents(null);
    setError(null);
    if (scopeParams.instituteCode == null || scopeParams.assessmentId == null) return;
    setLoading(true);
    getFlaggedStudents(scopeParams, tier)
      .then((res) => setStudents(res.data ?? []))
      .catch((err: any) =>
        setError(err?.response?.data?.error || err.message || "Could not load the list.")
      )
      .finally(() => setLoading(false));
  };

  const count = (tier: FlagTier) =>
    tier === "acute"
      ? flags.acute
      : tier === "abilitySupport"
      ? flags.abilitySupport
      : flags.guidanceMismatch;

  return (
    <div className="sd-flag-block">
      <div className="sd-flags">
        {TIERS.map(({ tier, label, tone }) => {
          const n = count(tier);
          return (
            <button
              key={tier}
              type="button"
              className={`sd-flag sd-flag--${n > 0 ? tone : "clear"}${
                open === tier ? " is-open" : ""
              }`}
              aria-expanded={open === tier}
              disabled={n === 0}
              onClick={() => toggle(tier)}
            >
              <b>{n}</b>
              <span>{label}</span>
              {n > 0 && (
                <span className="sd-flag-cue">
                  {open === tier ? "Hide students" : "Show students"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {open && (
        <div className="sd-flag-list">
          {loading && <p className="sd-fine">Loading students…</p>}
          {error && <p className="sd-fine">{error}</p>}
          {!loading && !error && students && students.length === 0 && (
            <p className="sd-fine">
              No students recorded for this tier. Dashboards released before this feature
              existed did not store the list — regenerate to populate it.
            </p>
          )}
          {!loading && students && students.length > 0 && (
            <>
              <div className="sd-flag-list-head">
                {students.length} student{students.length === 1 ? "" : "s"} ·{" "}
                {TIERS.find((t) => t.tier === open)?.label}
              </div>
              <ol className="sd-flag-names">
                {students.map((student) => (
                  <li key={student.userStudentId}>
                    <span className="sd-flag-name">{student.name}</span>
                    <span className="sd-flag-meta">
                      {student.studentClass != null && `Class ${student.studentClass}`}
                      {student.rollNumber && ` · Roll ${student.rollNumber}`}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}

      <p className="sd-fine">
        Screening indicators, not diagnoses, counted over {flags.base} scored profiles.
        Those in the first tier may benefit from further professional evaluation.
      </p>
    </div>
  );
};

/**
 * TEMPORARY — asks the server to print this scope's chart data to its console.
 *
 * Remove together with the backend's /log-chart-data endpoint and
 * PrincipalDashboardChartLogger.
 */
const LogChartDataButton = ({ scopeParams }: { scopeParams: ScopeParams }) => {
  const [state, setState] = useState<"idle" | "sending" | "done" | "failed">("idle");

  const send = () => {
    if (scopeParams.instituteCode == null || scopeParams.assessmentId == null) return;
    setState("sending");
    logChartData(scopeParams)
      .then(() => setState("done"))
      .catch(() => setState("failed"));
  };

  return (
    <button type="button" className="sd-debug-btn" onClick={send} disabled={state === "sending"}>
      {state === "sending"
        ? "Printing…"
        : state === "done"
        ? "Printed to server console ✓"
        : state === "failed"
        ? "Failed — check the server"
        : "Log chart data to console"}
    </button>
  );
};

/**
 * What was left out, and what the system could not supply.
 *
 * Both are computed before the model sees them, so this reports rather than reveals — but
 * a report that quietly drops part of its cohort is worse than one that says so.
 */
const Provenance = ({ narrative }: { narrative: Narrative }) => {
  const { excluded } = narrative.data_audit;
  if (excluded.length === 0 && narrative.pending.length === 0) return null;
  return (
    <div className="sd-provenance">
      {excluded.length > 0 && (
        <>
          <div className="sd-provenance-title">Not counted in these figures</div>
          <ul>
            {excluded.map((e, i) => (
              <li key={i}>
                <b>{e.n}</b> {e.what}
              </li>
            ))}
          </ul>
        </>
      )}
      {narrative.pending.length > 0 && (
        <>
          <div className="sd-provenance-title">Not recorded by Career-9 yet</div>
          <ul>
            {narrative.pending.map((p, i) => (
              <li key={i}>{p.note}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

/**
 * How far the cohort has moved since this was written.
 *
 * The figures refresh with every release; the wording does not, because rewriting it
 * costs money and replaces text a principal may already have circulated. When the two
 * ages diverge, saying so beats quietly showing old prose.
 */
const StaleBanner = ({ release }: { release: ScopeView }) => {
  const since = release.newStudentsSinceGeneration ?? 0;
  if (!release.stale || since <= 0) return null;
  return (
    <div className="sd-stale">
      <b>{since}</b> more student{since === 1 ? " has" : "s have"} finished since this
      analysis was written. The figures below are current; the wording is not. Ask the
      Career-9 team to regenerate it.
    </div>
  );
};

/** Whole numbers stay whole; a fraction keeps one decimal and no more. */
function formatValue(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
}

export default SchoolDashboardInsights;
