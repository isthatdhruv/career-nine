import React, { useEffect } from "react";
import { SchoolDashboardView } from "./SchoolDashboard_APIs";
import { ScopeView } from "./PrincipalDashboardRelease_APIs";
import { StoredFlags, StoredScope } from "./StoredDashboard";

/**
 * The sheet a school files.
 *
 * Everything else on this dashboard exists to be read on a screen and acted on. This one
 * exists to be printed, signed, sealed and put in a drawer against the day an inspector
 * asks whether career guidance was actually delivered — so it is deliberately plain,
 * fixed-width, dated, and carries both marks (Career-9's and the school's) at the top and
 * a signature block at the bottom.
 *
 * It states only what Career-9 recorded. Where a mandate asks for something the platform
 * does not yet hold — counselling sessions, at the time of writing — the row says so
 * rather than being left off, because a compliance sheet with a silent omission is worse
 * than one with an honest gap.
 */

/** The Career-9 mark, as the rest of the app references it. */
const CAREER9_LOGO = "/media/logos/kcc.webp";

interface Props {
  open: boolean;
  onClose: () => void;
  view: SchoolDashboardView;
  release: ScopeView | null;
  flags: StoredFlags | null;
  storedScope: StoredScope | null;
  schoolName: string;
  /** Whitelabel logo from InstituteDetail.logoUrl; the block is dropped when absent. */
  schoolLogoUrl?: string | null;
}

const ComplianceReport: React.FC<Props> = ({
  open,
  onClose,
  view,
  release,
  flags,
  storedScope,
  schoolName,
  schoolLogoUrl,
}) => {
  /**
   * Printing is scoped by a class on <body>, not by a stylesheet that hides the app.
   *
   * This page lives inside Metronic's layout — header, aside, toolbar, footer — and a
   * print rule that tried to name all of those would break the first time the layout
   * changed. Marking the body instead lets one rule hide everything and un-hide this
   * sheet, whatever is around it.
   */
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("sd-printing");
    return () => document.body.classList.remove("sd-printing");
  }, [open]);

  // Esc closes, as it does for any dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const d = view.dashboard;
  const p = view.participation;
  const assessment = view.assessments[0];
  const asOn = new Date();

  const classRows = (d?.byClass.classes ?? []).map((cls, i) => ({
    cls,
    scored: numAt(d?.byClass.students, i),
    clarityPct: numAt(d?.byClass.careerClarityPct, i),
    weak5Plus: numAt(d?.byClass.fiveOrMoreWeakAbilities, i),
  }));

  const totals = classRows.reduce(
    (acc, r) => ({
      scored: acc.scored + r.scored,
      weak5Plus: acc.weak5Plus + r.weak5Plus,
    }),
    { scored: 0, weak5Plus: 0 }
  );

  return (
    <div className="sd-print-overlay" role="dialog" aria-modal="true" aria-label="Compliance report">
      <div className="sd-print-bar">
        <div>
          <b>Compliance record</b>
          <span>
            Printable. Check your browser's print dialog is set to A4 with background
            graphics on.
          </span>
        </div>
        <div className="sd-print-bar-actions">
          <button type="button" className="sd-print-go" onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className="sd-print-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="sd-sheet-scroll">
        <article className="sd-sheet">
          {/* ── Letterhead ── */}
          <header className="sd-sheet-head">
            <div className="sd-sheet-marks">
              <img
                className="sd-sheet-logo"
                src={CAREER9_LOGO}
                alt="Career-9"
                onError={hideBrokenImage}
              />
              {schoolLogoUrl && (
                <>
                  <span className="sd-sheet-rule" aria-hidden="true" />
                  <img
                    className="sd-sheet-logo"
                    src={schoolLogoUrl}
                    alt={`${schoolName} logo`}
                    onError={hideBrokenImage}
                  />
                </>
              )}
            </div>
            <div className="sd-sheet-titles">
              <h1>{schoolName}</h1>
              <p className="sd-sheet-doc">
                Career Guidance &amp; Assessment — Compliance Record
              </p>
              <p className="sd-sheet-issuer">
                Issued by Career-9 · Navigator 360
                {storedScope?.sessionLabel ? ` · ${storedScope.sessionLabel}` : ""}
              </p>
            </div>
          </header>

          {/* ── What this covers ── */}
          <dl className="sd-sheet-meta">
            <Meta k="Assessment" v={assessment?.assessmentName ?? "—"} />
            <Meta k="Coverage" v={release?.scopeLabel || "Whole school"} />
            <Meta
              k="Analysis generated"
              v={release?.generatedAt ? longDate(new Date(release.generatedAt)) : "—"}
            />
            <Meta k="Statement as on" v={longDate(asOn)} />
          </dl>

          {/* ── A. Participation ── */}
          <section className="sd-sheet-sec">
            <h2>A · Assessment coverage</h2>
            <table className="sd-sheet-table">
              <tbody>
                <Row k="Students on record for this assessment" v={p.total} />
                <Row k="Completed the assessment" v={p.completed} />
                <Row k="Started but not submitted" v={p.ongoing} />
                <Row k="Not started" v={p.notStarted} />
                <Row k="Scored and reported on" v={view.scoredStudents} />
                <Row k="Completion rate" v={`${p.completedPct}%`} strong />
              </tbody>
            </table>
          </section>

          {/* ── B. Class-wise ── */}
          <section className="sd-sheet-sec">
            <h2>B · Class-wise assessment outcomes</h2>
            {classRows.length === 0 ? (
              <p className="sd-sheet-none">
                No class-level breakdown is held for this release.
              </p>
            ) : (
              <table className="sd-sheet-table sd-sheet-table--grid">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th className="num">Students scored</th>
                    <th className="num">Career clarity</th>
                    <th className="num">Needing ability support</th>
                  </tr>
                </thead>
                <tbody>
                  {classRows.map((r) => (
                    <tr key={r.cls}>
                      <td>Class {r.cls}</td>
                      <td className="num">{r.scored}</td>
                      <td className="num">{r.clarityPct}%</td>
                      <td className="num">{r.weak5Plus}</td>
                    </tr>
                  ))}
                  <tr className="sd-sheet-total">
                    <td>Total</td>
                    <td className="num">{totals.scored}</td>
                    <td className="num">{d ? `${d.summary.careerClarityPct}%` : "—"}</td>
                    <td className="num">{totals.weak5Plus}</td>
                  </tr>
                </tbody>
              </table>
            )}
            <p className="sd-sheet-fine">
              "Career clarity" is the share of scored students with at least one stated
              career aspiration matching a career they are assessed as suited to.
              "Needing ability support" counts students weak on five or more abilities.
            </p>
          </section>

          {/* ── C. Screening ── */}
          <section className="sd-sheet-sec">
            <h2>C · Screening outcomes</h2>
            {flags && flags.base > 0 ? (
              <table className="sd-sheet-table">
                <tbody>
                  <Row
                    k="Referred for immediate attention (no ability at strength level and eight or more weak)"
                    v={flags.acute}
                  />
                  <Row k="Flagged for ability support (five or more weak)" v={flags.abilitySupport} />
                  <Row
                    k="Flagged for guidance (aspirations do not overlap suitability)"
                    v={flags.guidanceMismatch}
                  />
                  <Row k="Screened in total" v={flags.base} strong />
                </tbody>
              </table>
            ) : (
              <p className="sd-sheet-none">No screening counts are held for this release.</p>
            )}
            <p className="sd-sheet-fine">
              Screening indicators, not diagnoses. Students in the first tier may benefit
              from further professional evaluation.
            </p>
          </section>

          {/* ── D. Counselling ── */}
          <section className="sd-sheet-sec">
            <h2>D · Counselling delivered</h2>
            {/*
              Deliberately present and deliberately empty. The mandate asks for
              counselling alongside assessment, and a sheet that simply omitted the
              section would read as though it had been answered. Career-9 records
              counselling appointments elsewhere; they are not yet part of the released
              dashboard payload, so nothing here can be stated per class without
              inventing it.
            */}
            <p className="sd-sheet-none">
              Class-wise counselling statistics are not part of this release. Career-9
              records counselling appointments separately; attach the counselling register
              for the same period alongside this sheet, or ask the Career-9 team to
              include it in a future release.
            </p>
            <table className="sd-sheet-table sd-sheet-table--grid">
              <thead>
                <tr>
                  <th>Class</th>
                  <th className="num">Sessions booked</th>
                  <th className="num">Sessions held</th>
                  <th>Counsellor</th>
                </tr>
              </thead>
              <tbody>
                {(classRows.length > 0 ? classRows.map((r) => r.cls) : [null]).map(
                  (cls, i) => (
                    <tr key={cls ?? i}>
                      <td>{cls == null ? "" : `Class ${cls}`}</td>
                      <td className="num" />
                      <td className="num" />
                      <td />
                    </tr>
                  )
                )}
              </tbody>
            </table>
            <p className="sd-sheet-fine">To be completed by hand from the school's counselling register.</p>
          </section>

          {/* ── Sign-off ── */}
          <section className="sd-sheet-signoff">
            <h2>Certified</h2>
            <p className="sd-sheet-cert">
              The figures in sections A to C are reproduced from the Career-9 Navigator 360
              analysis released for {release?.scopeLabel || "this school"} and are correct
              as on {longDate(asOn)}.
            </p>
            <div className="sd-sheet-sigs">
              <Signature role="Principal" sub={schoolName} />
              <Signature role="Career-9 authorised signatory" sub="Career-9 · Navigator 360" />
              <div className="sd-sheet-seal">
                <span>School seal</span>
              </div>
            </div>
          </section>

          <footer className="sd-sheet-foot">
            <span>{schoolName} · Career-9 Navigator 360 compliance record</span>
            <span>Printed {longDate(asOn)}</span>
          </footer>
        </article>
      </div>
    </div>
  );
};

const Meta: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div>
    <dt>{k}</dt>
    <dd>{v}</dd>
  </div>
);

const Row: React.FC<{ k: string; v: React.ReactNode; strong?: boolean }> = ({
  k,
  v,
  strong,
}) => (
  <tr className={strong ? "sd-sheet-total" : undefined}>
    <td>{k}</td>
    <td className="num">{v}</td>
  </tr>
);

/** A ruled line to sign on, with the role under it — never a pre-filled name. */
const Signature: React.FC<{ role: string; sub: string }> = ({ role, sub }) => (
  <div className="sd-sheet-sig">
    <span className="sd-sheet-sig-line" aria-hidden="true" />
    <b>{role}</b>
    <span>{sub}</span>
    <span className="sd-sheet-sig-date">Date: ______________</span>
  </div>
);

/**
 * A logo that will not load leaves no gap.
 *
 * The school's mark is a whitelabel URL somebody typed into an admin form, so a dead link
 * is an ordinary outcome. A broken-image glyph on a document that gets signed and filed
 * is not.
 */
function hideBrokenImage(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}

function numAt(values: number[] | undefined, i: number): number {
  const v = values?.[i];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** "13 August 2026" — unambiguous on a document that may be read years later. */
function longDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default ComplianceReport;
