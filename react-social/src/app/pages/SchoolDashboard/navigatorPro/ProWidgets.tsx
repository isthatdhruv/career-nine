import React from "react";
import { Action, Owner, PageNarrative, ZoneKey } from "./navigatorProTypes";

/** Zone colours — the same four the student report's quadrant uses. */
export const ZONE_COLOURS: Record<ZoneKey, string> = {
  ready: "#2E7D32",
  motivated: "#F0A427",
  capable: "#3B6FB5",
  support: "#C0392B",
};

export const ZONE_ORDER: ZoneKey[] = ["ready", "motivated", "capable", "support"];

export const ZONE_SHORT: Record<ZoneKey, string> = {
  ready: "high drive + high skill",
  motivated: "high drive, skill growing",
  capable: "skilled, low drive right now",
  support: "both just starting",
};

const OWNER_COLOURS: Record<Owner, string> = {
  Academics: "#2F5FA8",
  "Placement cell": "#0F6E6C",
  Counsellors: "#B0641A",
  Principal: "#7A2E8E",
};

/**
 * Render the narrative's only markup: `**finding**` becomes bold. Everything else is
 * text, so nothing the model writes can inject markup into the page.
 */
export const Emph: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
};

export const OwnerTag: React.FC<{ owner: Owner }> = ({ owner }) => {
  const c = OWNER_COLOURS[owner] ?? "#5B6B84";
  return (
    <span className="npd-owner" style={{ color: c, borderColor: `${c}55`, background: `${c}18` }}>
      {owner}
    </span>
  );
};

export const Kpi: React.FC<{
  value: React.ReactNode;
  label: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
}> = ({ value, label, sub, accent }) => (
  <div className="npd-kpi" style={accent ? { borderTop: `4px solid ${accent}` } : undefined}>
    <div className="npd-kv">{value}</div>
    <div className="npd-kl">
      {label}
      {sub && <div className="npd-ksub">{sub}</div>}
    </div>
  </div>
);

/** One labelled horizontal bar. `max` is the value that fills the track. */
export const BarRow: React.FC<{
  label: React.ReactNode;
  value: number;
  max?: number;
  display?: React.ReactNode;
  colour?: string;
  title?: string;
  wide?: boolean;
}> = ({ label, value, max = 100, display, colour = "#19376D", title, wide }) => {
  const width = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`npd-brow${wide ? " npd-brow--wide" : ""}`} title={title}>
      <span className="npd-bl">{label}</span>
      <div className="npd-btrack">
        <div className="npd-bfill" style={{ width: `${width}%`, background: colour }} />
      </div>
      <span className="npd-bv">{display ?? value}</span>
    </div>
  );
};

/** The rule-based "what to do" box every page ends with. */
export const ActionBox: React.FC<{ actions?: Action[]; title?: string }> = ({
  actions,
  title = "What to do with this page",
}) => {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="npd-actions">
      <div className="npd-actions-title">{title}</div>
      <ol>
        {actions.map((a, i) => (
          <li key={i}>
            <Emph text={a.text} />
            <OwnerTag owner={a.owner} />
          </li>
        ))}
      </ol>
    </div>
  );
};

/**
 * Career-9's written reading of a page, from the release's narrative. Absent when the
 * scope was below the narrative floor — the figures and the rule-based actions above
 * still stand on their own.
 */
export const Commentary: React.FC<{ page?: PageNarrative }> = ({ page }) => {
  if (!page) return null;
  const { insights, implications, actions } = page;
  if (!insights.length && !implications.length && !actions.length) return null;
  return (
    <section className="npd-cc" aria-label="Career-9 reading of this page">
      {insights.length > 0 && (
        <div className="npd-cc-col npd-cc-col--reads">
          <div className="npd-cc-title">What this shows</div>
          <ol>
            {insights.map((t, i) => (
              <li key={i}>
                <Emph text={t} />
              </li>
            ))}
          </ol>
        </div>
      )}
      {implications.length > 0 && (
        <div className="npd-cc-col npd-cc-col--means">
          <div className="npd-cc-title">If nothing changes</div>
          <ol>
            {implications.map((t, i) => (
              <li key={i}>
                <Emph text={t} />
              </li>
            ))}
          </ol>
        </div>
      )}
      {actions.length > 0 && (
        <div className="npd-cc-col npd-cc-col--do">
          <div className="npd-cc-title">Career-9 recommends</div>
          <ol>
            {actions.map((a, i) => (
              <li key={i}>
                <Emph text={a.text} /> <OwnerTag owner={a.owner} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
};

export const PageFooter: React.FC<{ text: string }> = ({ text }) => (
  <>
    <div className="npd-foot">{text}</div>
    <div className="npd-disc">
      <b>Please note:</b> Navigator Pro is a new instrument and its scientific validation is still
      in progress. Use every number here to <b>help</b> students — never to judge, rank, shortlist
      or reject anyone, and never to promise placement results.
    </div>
  </>
);

export const Empty: React.FC<{ title: string; children?: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="npd-empty">
    <div className="npd-empty-title">{title}</div>
    {children}
  </div>
);
