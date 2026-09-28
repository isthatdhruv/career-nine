import React from "react";
import { Action, Owner, PageNarrative, ZoneKey } from "./navigatorProTypes";

/**
 * Zone colours — the validated categorical slots the Navigator 360 dashboard charts with.
 * Hex rather than CSS variables because the map's SVG takes them as fill attributes;
 * they read on both the light and the dark surface.
 */
export const ZONE_COLOURS: Record<ZoneKey, string> = {
  ready: "#1baf7a",
  motivated: "#eb6834",
  capable: "#2a78d6",
  support: "#e34948",
};

export const ZONE_ORDER: ZoneKey[] = ["ready", "motivated", "capable", "support"];

export const ZONE_SHORT: Record<ZoneKey, string> = {
  ready: "high drive + high skill",
  motivated: "high drive, skill still growing",
  capable: "skilled, low drive right now",
  support: "both just starting",
};

const OWNER_CLASS: Record<Owner, string> = {
  Academics: "academics",
  "Placement cell": "placement",
  Counsellors: "counsellors",
  Principal: "principal",
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

export const OwnerTag: React.FC<{ owner: Owner }> = ({ owner }) => (
  <span className={`npd-own npd-own--${OWNER_CLASS[owner] ?? "academics"}`}>{owner}</span>
);

/** A stat tile in the Navigator 360 style: label, big figure, a line of context. */
export const Kpi: React.FC<{
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
  textValue?: boolean;
}> = ({ label, value, sub, accent, textValue }) => (
  <div
    className="npd-kpi"
    style={accent ? ({ "--kpi-accent": accent } as React.CSSProperties) : undefined}
  >
    <div className="npd-kpi-l">{label}</div>
    <div className={`npd-kpi-v${textValue ? " npd-kpi-v--text" : ""}`}>{value}</div>
    {sub != null && sub !== "" && <div className="npd-kpi-s">{sub}</div>}
  </div>
);

/** One labelled horizontal bar. `max` is the value that fills the track. */
export const BarRow: React.FC<{
  label?: React.ReactNode;
  sub?: React.ReactNode;
  value: number;
  max?: number;
  display?: React.ReactNode;
  colour?: string;
  title?: string;
}> = ({ label, sub, value, max = 100, display, colour, title }) => {
  const width = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const bare = label == null;
  return (
    <div className={`npd-br${bare ? " npd-br--bare" : ""}`} title={title}>
      {!bare && (
        <div className="npd-br-l">
          {label}
          {sub && <small>{sub}</small>}
        </div>
      )}
      <div className="npd-br-t">
        <div
          className="npd-br-f"
          style={{ width: `${width}%`, ...(colour ? ({ "--c": colour } as React.CSSProperties) : {}) }}
        />
      </div>
      <div className="npd-br-v">{display ?? value}</div>
    </div>
  );
};

export const Card: React.FC<{
  title?: React.ReactNode;
  aside?: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}> = ({ title, aside, sub, className, children }) => (
  <section className={`npd-card${className ? ` ${className}` : ""}`}>
    {(title || aside) && (
      <div className="npd-card-h">
        {title && <h3 className="npd-card-t">{title}</h3>}
        {aside && <span className="npd-muted">{aside}</span>}
      </div>
    )}
    {sub && <p className="npd-card-s">{sub}</p>}
    {children}
  </section>
);

/** The page head every section opens with. */
export const PageHead: React.FC<{
  group: string;
  title: string;
  lede: React.ReactNode;
  how?: React.ReactNode;
}> = ({ group, title, lede, how }) => (
  <div className="npd-ph">
    <p className="npd-eyebrow">{group}</p>
    <h2>{title}</h2>
    <p>{lede}</p>
    {how && (
      <div className="npd-how">
        <b>How to read it</b>
        <span>{how}</span>
      </div>
    )}
  </div>
);

/** The rule-based "what to do" list every page ends with. */
export const ActionBox: React.FC<{ actions?: Action[]; title?: string }> = ({
  actions,
  title = "What to do with this page",
}) => {
  if (!actions || actions.length === 0) return null;
  return (
    <section className="npd-todo">
      <h3>{title}</h3>
      <ol>
        {actions.map((a, i) => (
          <li key={i}>
            <Emph text={a.text} />
            <OwnerTag owner={a.owner} />
          </li>
        ))}
      </ol>
    </section>
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
      <div className="npd-cc-h">
        <b>Career-9 reading</b>
        <span>Written from this cohort's figures</span>
      </div>
      <div className="npd-cc-col npd-cc-col--reads">
        <div className="npd-cc-t">What this shows</div>
        <ul>
          {insights.map((t, i) => (
            <li key={i}>
              <Emph text={t} />
            </li>
          ))}
        </ul>
      </div>
      <div className="npd-cc-col npd-cc-col--means">
        <div className="npd-cc-t">If nothing changes</div>
        <ul>
          {implications.map((t, i) => (
            <li key={i}>
              <Emph text={t} />
            </li>
          ))}
        </ul>
      </div>
      <div className="npd-cc-col npd-cc-col--do">
        <div className="npd-cc-t">Career-9 recommends</div>
        <ul>
          {actions.map((a, i) => (
            <li key={i}>
              <Emph text={a.text} />
              <OwnerTag owner={a.owner} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export const PageFooter: React.FC<{ text: string }> = ({ text }) => (
  <div className="npd-foot">
    <span>{text}</span>
    <span>
      <b>Guidance, never selection.</b> Navigator Pro is a new instrument still being
      validated — use these numbers to help students, never to rank, shortlist or reject
      anyone, or to promise placements.
    </span>
  </div>
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
