import React, { useState } from "react";
import { ScopeView } from "./PrincipalDashboardRelease_APIs";
import { CardType, InsightCard, Narrative, ReportSection, StoredFlags } from "./StoredDashboard";

interface Props {
  release: ScopeView;
  narrative: Narrative | null;
  flags: StoredFlags | null;
  /** What the rail resolved to, for the heading. */
  scopeLabel: string;
}

/**
 * The interpretive layer, read from what a release stored.
 *
 * Nothing here is computed in the browser. The figures came out of one scoring pass and
 * the reading of them came out of one model call over those same figures, so a principal
 * and the sentence beside them can never be looking at different numbers — which is the
 * whole reason the dashboard reads stored content rather than recomputing on view.
 *
 * Order is deliberate: what needs attention, then what it means, then the long form. A
 * principal opens this page for the cards; the eleven-section report is for whoever wants
 * the argument behind one of them.
 */
const SchoolDashboardInsights: React.FC<Props> = ({
  release,
  narrative,
  flags,
  scopeLabel,
}) => {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  // Below the cohort floor a scope keeps its figures but is deliberately not written up:
  // percentages over a handful of students carry no precision, and prose about six
  // children stops describing a cohort. Saying so beats an empty panel.
  if (release.status === "SKIPPED_SMALL_COHORT") {
    return (
      <section className="sd-narrative sd-narrative--muted">
        <h2 className="sd-narrative-title">No written analysis for {scopeLabel}</h2>
        <p className="sd-narrative-lede">
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
      <section className="sd-narrative sd-narrative--muted">
        <h2 className="sd-narrative-title">Figures only for {scopeLabel}</h2>
        <p className="sd-narrative-lede">
          The written analysis for this view is not available. Everything below is
          unaffected.
        </p>
      </section>
    ) : null;
  }

  const { kpis, cards, alerts } = narrative.dashboard_insights;
  const sections = narrative.report.sections;

  // Attention before reassurance: someone scanning this needs the risks and gaps first,
  // and the strengths still get read on the way past.
  const ranked = [...cards].sort(
    (a, b) => CARD_ORDER.indexOf(a.type) - CARD_ORDER.indexOf(b.type)
  );

  return (
    <section className="sd-narrative">
      <StaleBanner release={release} />

      <header className="sd-narrative-head">
        <div>
          <span className="sd-narrative-eyebrow">Career-9 analysis</span>
          <h2 className="sd-narrative-title">{scopeLabel}</h2>
        </div>
        {release.generatedAt && (
          <span className="sd-narrative-stamp">
            Written {new Date(release.generatedAt).toLocaleDateString()} from{" "}
            {release.studentCount ?? narrative.cohort.n} scored profile
            {(release.studentCount ?? narrative.cohort.n) === 1 ? "" : "s"}
          </span>
        )}
      </header>

      {kpis.length > 0 && (
        <div className="sd-ins-kpis">
          {kpis.map((kpi) => (
            <div key={kpi.id || kpi.label} className="sd-ins-kpi">
              <span className="sd-ins-kpi-value">
                {formatValue(kpi.value)}
                {kpi.unit && <em>{kpi.unit}</em>}
              </span>
              <span className="sd-ins-kpi-label">{kpi.label}</span>
              {kpi.target != null && (
                <span className="sd-ins-kpi-target">
                  target {formatValue(kpi.target)}
                  {kpi.unit}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {alerts.length > 0 && (
        <div className="sd-alerts">
          {alerts.map((alert) => (
            <div key={alert.id || alert.label} className="sd-alert">
              <span className="sd-alert-count">{alert.count}</span>
              <div>
                <div className="sd-alert-label">{alert.label}</div>
                <div className="sd-alert-action">{alert.action}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {ranked.length > 0 && (
        <div className="sd-ins-cards">
          {ranked.map((card) => (
            <InsightCardView
              key={card.id || card.title}
              card={card}
              onOpen={
                card.section_ref
                  ? () => {
                      setShowReport(true);
                      setOpenSection(card.section_ref);
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {flags && flags.base > 0 && <FlagStrip flags={flags} />}

      {sections.length > 0 && (
        <div className="sd-report">
          <button
            type="button"
            className="sd-report-toggle"
            aria-expanded={showReport}
            onClick={() => setShowReport((open) => !open)}
          >
            {showReport ? "Hide" : "Read"} the full analysis
            <span className="sd-report-count">
              {sections.length} section{sections.length === 1 ? "" : "s"}
            </span>
          </button>

          {showReport && (
            <div className="sd-report-body">
              {sections.map((section) => (
                <SectionView
                  key={section.id || section.number}
                  section={section}
                  open={openSection === section.id}
                  onToggle={() =>
                    setOpenSection((current) => (current === section.id ? null : section.id))
                  }
                />
              ))}
              <Provenance narrative={narrative} />
            </div>
          )}
        </div>
      )}
    </section>
  );
};

/** Risk first, strength last — the order someone scanning for problems needs. */
const CARD_ORDER: CardType[] = ["risk", "gap", "opportunity", "strength"];

const CARD_WORD: Record<CardType, string> = {
  risk: "Risk",
  gap: "Gap",
  opportunity: "Opportunity",
  strength: "Strength",
};

const InsightCardView = ({ card, onOpen }: { card: InsightCard; onOpen?: () => void }) => (
  <article className={`sd-ins-card sd-ins-card--${card.type}`}>
    <div className="sd-ins-card-head">
      <span className="sd-ins-card-kind">{CARD_WORD[card.type]}</span>
      <h3 className="sd-ins-card-title">{card.title}</h3>
    </div>
    <p className="sd-ins-card-insight">{card.insight}</p>
    {card.numbers.length > 0 && (
      <dl className="sd-ins-card-numbers">
        {card.numbers.map((n) => (
          <div key={n.key}>
            <dt>{n.key}</dt>
            <dd>
              {formatValue(n.value)}
              {n.unit}
            </dd>
          </div>
        ))}
      </dl>
    )}
    {onOpen && (
      <button type="button" className="sd-ins-card-link" onClick={onOpen}>
        Read the detail
      </button>
    )}
  </article>
);

/**
 * Screening counts, taken from the stored figures rather than from the narrative.
 *
 * These are the numbers behind the model's section on flagged students, shown beside it
 * so the count and the prose are visibly one fact. Deliberately anonymous — a tier is a
 * queue for a conversation, not a label on a child.
 */
const FlagStrip = ({ flags }: { flags: StoredFlags }) => (
  <div className="sd-flags">
    <span className="sd-flags-title">Students to look at, of {flags.base}</span>
    <div className="sd-flags-row">
      <Flag
        n={flags.acute}
        label="No ability at strength level, eight or more weak"
        tone="critical"
      />
      <Flag n={flags.abilitySupport} label="Five or more weak abilities" tone="warning" />
      <Flag
        n={flags.guidanceMismatch}
        label="Aspirations don't overlap their suitability"
        tone="warning"
      />
    </div>
    <p className="sd-flags-note">
      Screening indicators, not diagnoses. Students in the first tier may benefit from
      further professional evaluation.
    </p>
  </div>
);

const Flag = ({ n, label, tone }: { n: number; label: string; tone: string }) => (
  <div className={`sd-flag sd-flag--${n > 0 ? tone : "clear"}`}>
    <b>{n}</b>
    <span>{label}</span>
  </div>
);

const SectionView = ({
  section,
  open,
  onToggle,
}: {
  section: ReportSection;
  open: boolean;
  onToggle: () => void;
}) => (
  <article className={`sd-section${open ? " is-open" : ""}`}>
    <button type="button" className="sd-section-head" aria-expanded={open} onClick={onToggle}>
      <span className="sd-section-number">{section.number}</span>
      <span className="sd-section-title">{section.title}</span>
      <span className="sd-section-chev" aria-hidden="true">
        {open ? "−" : "+"}
      </span>
    </button>

    {open && (
      <div className="sd-section-body">
        {section.body.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}

        {section.bullets.map((bullet, i) => (
          <div key={i} className="sd-bullet">
            {bullet.label && <span className="sd-bullet-label">{bullet.label}</span>}
            <p>{bullet.text}</p>
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

        {section.tables.map((table, i) => (
          <div key={i} className="sd-table-wrap">
            {table.title && <div className="sd-table-title">{table.title}</div>}
            <table className="sd-table">
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
                      <td key={c}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Charts arrive bindable, but a section body is prose — a table of the same
            series reads better here than a second chart language beside the real ones
            below, and it keeps the .docx renderer's job identical. */}
        {section.charts.map((chart, i) => (
          <div key={i} className="sd-table-wrap">
            <div className="sd-table-title">{chart.title}</div>
            <table className="sd-table">
              <thead>
                <tr>
                  <th>&nbsp;</th>
                  {chart.labels.map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.series.map((series) => (
                  <tr key={series.name}>
                    <th scope="row">{series.name}</th>
                    {chart.labels.map((_, c) => (
                      <td key={c}>
                        {series.values[c] == null ? "—" : formatValue(series.values[c])}
                        {series.unit}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {chart.caption && <p className="sd-chart-caption">{chart.caption}</p>}
          </div>
        ))}

        {section.callouts.map((callout, i) => (
          <div key={i} className="sd-callout">
            {callout.text}
          </div>
        ))}
      </div>
    )}
  </article>
);

/**
 * What was left out, and what the system could not supply.
 *
 * Both are computed before the model sees them, so this reports rather than reveals —
 * but a report that quietly drops a fifth of its cohort is worse than one that says so.
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
 * The figures on this page refresh with every release; the wording does not, because
 * rewriting it costs money and replaces text a principal may already have circulated.
 * When the two ages diverge, saying so is more useful than quietly showing old prose.
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
