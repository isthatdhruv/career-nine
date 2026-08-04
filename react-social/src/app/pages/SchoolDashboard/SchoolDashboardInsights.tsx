import React, { useMemo, useState } from "react";
import { ScopeView } from "./PrincipalDashboardRelease_APIs";

/**
 * Renders the generated narrative — the `ai_response` half of a released dashboard.
 *
 * <p>The charts below this panel answer "what do the numbers say". This answers "so
 * what, and what should the school do about it", which is the part a principal cannot
 * derive by looking at a bar chart. It therefore leads the page rather than trailing it.
 *
 * <p>Shape is fixed by the json_schema the generator is pinned to
 * (PrincipalDashboardAiService): headline, summary, findings[], sections[]. Anything
 * outside that shape is treated as a malformed payload and shown as such — a dashboard
 * silently rendering half a narrative is worse than one that says it is broken.
 */

interface Finding {
  label: string;
  detail: string;
  action: string;
  severity: "critical" | "watch" | "good";
}

interface Section {
  id: string;
  title: string;
  body: string[];
  callout: string;
}

interface AiReport {
  headline: string;
  summary: string;
  findings: Finding[];
  sections: Section[];
}

const SEVERITY: Record<Finding["severity"], { label: string; ink: string; bg: string; accent: string }> = {
  critical: { label: "Act now", ink: "var(--status-critical-ink)", bg: "var(--status-critical-bg)", accent: "var(--div-neg)" },
  watch: { label: "Watch", ink: "var(--status-warning-ink)", bg: "var(--status-warning-bg)", accent: "var(--status-warning)" },
  good: { label: "On track", ink: "var(--status-good-ink)", bg: "var(--status-good-bg)", accent: "var(--status-good)" },
};

/** A finding, collapsed to its claim and opening to the detail plus the action. */
const FindingRow: React.FC<{ f: Finding }> = ({ f }) => {
  const [open, setOpen] = useState(false);
  const s = SEVERITY[f.severity] ?? SEVERITY.watch;
  return (
    <div className={`sd-finding${open ? " is-open" : ""}`} style={{ ["--finding-accent" as any]: s.accent }}>
      <button
        type="button"
        className="sd-finding-sum"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sd-chevron" aria-hidden="true">
          ▶
        </span>
        <span className="sd-finding-label">{f.label}</span>
        <span className="sd-flag" style={{ ["--flag-ink" as any]: s.ink, ["--flag-bg" as any]: s.bg }}>
          {s.label}
        </span>
      </button>
      {open && (
        <div className="sd-finding-body">
          <p className="sd-finding-detail">{f.detail}</p>
          {f.action && (
            <div className="sd-finding-action">
              <span className="sd-finding-action-key">What to do</span>
              {f.action}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SectionCard: React.FC<{ s: Section }> = ({ s }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`sd-card${open ? "" : " is-collapsed"}`}>
      <button
        type="button"
        className="sd-card-head sd-card-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <h3 className="sd-card-title">
            <span className="sd-chevron" aria-hidden="true">
              ▶
            </span>
            {s.title}
          </h3>
        </div>
        <span className="sd-card-hint">{open ? "Hide" : "Read"}</span>
      </button>
      {open && (
        <div className="sd-card-body">
          {(s.body ?? []).map((para, i) => (
            <p className="sd-insight-para" key={i}>
              {para}
            </p>
          ))}
          {s.callout && <div className="sd-note sd-note-brand">{s.callout}</div>}
        </div>
      )}
    </div>
  );
};

const SchoolDashboardInsights: React.FC<{ release: ScopeView }> = ({ release }) => {
  const report = useMemo<AiReport | null>(() => {
    if (!release.aiResponse) return null;
    try {
      const parsed = JSON.parse(release.aiResponse);
      // Guard the contract rather than trusting it: a stored payload predates any
      // later schema change, and a half-rendered narrative reads as a product bug.
      if (typeof parsed?.headline !== "string" || !Array.isArray(parsed?.findings)) return null;
      return parsed as AiReport;
    } catch {
      return null;
    }
  }, [release.aiResponse]);

  const generatedOn = release.generatedAt
    ? new Date(release.generatedAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  // Cohort below the floor: the numbers still render below, but the narrative is
  // deliberately withheld, and saying why is better than showing nothing.
  if (release.status === "SKIPPED_SMALL_COHORT") {
    return (
      <div className="sd-note">
        <strong>No written analysis for this selection.</strong> It covers{" "}
        {release.studentCount ?? 0} student
        {release.studentCount === 1 ? "" : "s"}, below the {release.minCohortSize ?? 10}
        {" "}needed for a reliable reading. The figures below are still accurate — widen the
        filter for the written analysis.
      </div>
    );
  }

  if (!release.aiResponse) return null;

  if (!report) {
    return (
      <div className="sd-note">
        <strong>The written analysis could not be displayed.</strong> The stored content
        does not match the current report format. The figures below are unaffected.
      </div>
    );
  }

  const ordered = [...report.findings].sort((a, b) => {
    const rank = { critical: 0, watch: 1, good: 2 } as Record<string, number>;
    return (rank[a.severity] ?? 1) - (rank[b.severity] ?? 1);
  });

  return (
    <>
      <div className="sd-headline">
        <div className="sd-headline-key">
          What this means
          {generatedOn && <span className="sd-headline-date"> · analysed {generatedOn}</span>}
        </div>
        <h2 className="sd-headline-title">{report.headline}</h2>
        {report.summary && <p className="sd-headline-sub">{report.summary}</p>}
      </div>

      {release.stale && (
        <div className="sd-stale">
          <strong>{release.newStudentsSinceGeneration}</strong> students have been assessed
          since this analysis was written{generatedOn ? ` on ${generatedOn}` : ""}. The
          figures below are current; the written analysis is not. Ask your administrator to
          release an updated dashboard.
        </div>
      )}

      {ordered.length > 0 && (
        <div className="sd-findings">
          {ordered.map((f, i) => (
            <FindingRow key={`${f.label}-${i}`} f={f} />
          ))}
        </div>
      )}

      {(report.sections ?? []).length > 0 && (
        <div className="sd-grid">
          {report.sections.map((s, i) => (
            <SectionCard key={s.id || i} s={s} />
          ))}
        </div>
      )}
    </>
  );
};

export default SchoolDashboardInsights;
