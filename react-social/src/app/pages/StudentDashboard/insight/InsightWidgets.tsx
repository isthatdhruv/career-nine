import React from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  AxisItem,
  CareerItem,
  FlagItem,
  InsightSection,
  ListItemData,
  NoteItem,
  StatItem,
} from "./insightTypes";

// Shared palette — the "same look & feel across all engines" lives here.
const COLORS = {
  primary: "#1a6b3c",
  good: "#059669",
  warn: "#f59e0b",
  bad: "#ef4444",
  ink: "#1f2937",
  sub: "#6b7280",
  line: "#e5e7eb",
};

function levelColor(level?: string): string {
  switch ((level || "").toUpperCase()) {
    case "HIGH":
      return COLORS.good;
    case "LOW":
      return COLORS.warn;
    default:
      return "#3b82f6"; // MODERATE / unknown
  }
}

function accentColor(accent?: string): string {
  switch (accent) {
    case "good":
      return COLORS.good;
    case "warn":
      return COLORS.warn;
    default:
      return COLORS.primary;
  }
}

// ───────────────────────── widgets ─────────────────────────

const StatRow: React.FC<{ items: StatItem[] }> = ({ items }) => (
  <div className="idb-stat-grid">
    {items.map((s, i) => (
      <div className="idb-stat-card" key={i} style={{ borderTopColor: accentColor(s.accent) }}>
        <div className="idb-stat-value" style={{ color: accentColor(s.accent) }}>
          {s.value}
        </div>
        <div className="idb-stat-label">{s.label}</div>
        {s.hint && <div className="idb-stat-hint">{s.hint}</div>}
      </div>
    ))}
  </div>
);

const RadarWidget: React.FC<{ items: AxisItem[] }> = ({ items }) => {
  const data = items.map((a) => ({ subject: a.label, value: a.value, fullMark: 100 }));
  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke={COLORS.line} />
          {/* @ts-ignore recharts 3 typing quirk on PolarAngleAxis tick */}
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: COLORS.sub }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip formatter={(v: number) => [`${v}%`, "Score"]} />
          <Radar
            dataKey="value"
            stroke={COLORS.primary}
            fill={COLORS.primary}
            fillOpacity={0.22}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

const BarsWidget: React.FC<{ items: AxisItem[] }> = ({ items }) => (
  <div className="idb-bars">
    {items.map((a, i) => (
      <div className="idb-bar-row" key={i}>
        <div className="idb-bar-label" title={a.label}>
          {a.label}
        </div>
        <div className="idb-bar-track">
          <div
            className="idb-bar-fill"
            style={{ width: `${Math.max(0, Math.min(100, a.value))}%`, background: levelColor(a.level) }}
          />
        </div>
        <div className="idb-bar-meta">
          <span className="idb-bar-value">{Math.round(a.value)}%</span>
          {a.level && (
            <span className="idb-bar-level" style={{ color: levelColor(a.level) }}>
              {a.level.charAt(0) + a.level.slice(1).toLowerCase()}
            </span>
          )}
        </div>
      </div>
    ))}
  </div>
);

const CareersWidget: React.FC<{ items: CareerItem[] }> = ({ items }) => (
  <div className="idb-careers">
    {items.map((c, i) => (
      <div className="idb-career" key={i}>
        <div className="idb-career-rank">{i + 1}</div>
        <div className="idb-career-body">
          <div className="idb-career-head">
            <span className="idb-career-name">{c.name}</span>
            {c.aspiration && <span className="idb-career-asp">Your aspiration</span>}
          </div>
          <div className="idb-career-track">
            <div className="idb-career-fill" style={{ width: `${c.suitability}%` }} />
          </div>
          <div className="idb-career-sub">
            <span>Suitability <b>{c.suitability}%</b></span>
            <span>Potential <b>{c.potentialMatch}%</b></span>
            <span>Values <b>{c.valuesMatch}%</b></span>
          </div>
          {c.matchedValues && c.matchedValues.length > 0 && (
            <div className="idb-chips idb-chips-sm">
              {c.matchedValues.map((v, k) => (
                <span className="idb-chip" key={k}>
                  {v}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    ))}
  </div>
);

const ChipsWidget: React.FC<{ items: string[] }> = ({ items }) => (
  <div className="idb-chips">
    {items.map((v, i) => (
      <span className="idb-chip" key={i}>
        {v}
      </span>
    ))}
  </div>
);

const FlagsWidget: React.FC<{ items: FlagItem[] }> = ({ items }) => (
  <div className="idb-flags">
    {items.map((f, i) => (
      <div className={`idb-flag idb-flag-${(f.severity || "info").toLowerCase()}`} key={i}>
        <div className="idb-flag-name">{f.name}</div>
        {f.message && <div className="idb-flag-msg">{f.message}</div>}
      </div>
    ))}
  </div>
);

const NotesWidget: React.FC<{ items: NoteItem[] }> = ({ items }) => (
  <div className="idb-notes">
    {items.map((n, i) => (
      <div className="idb-note" key={i}>
        {n.title && <div className="idb-note-title">{n.title}</div>}
        <div className="idb-note-body">{n.body}</div>
      </div>
    ))}
  </div>
);

const ListWidget: React.FC<{ items: ListItemData[] }> = ({ items }) => (
  <ol className="idb-list">
    {items.map((it, i) => (
      <li className="idb-list-item" key={i}>
        <span className="idb-list-rank">{i + 1}</span>
        <span className="idb-list-label">{it.label}</span>
        {it.detail && <span className="idb-list-detail">{it.detail}</span>}
      </li>
    ))}
  </ol>
);

// ───────────────────────── registry ─────────────────────────

/** Renders one section by its type. Unknown types render nothing (forward-compatible). */
export const SectionRenderer: React.FC<{ section: InsightSection }> = ({ section }) => {
  const body = (() => {
    switch (section.type) {
      case "stat":
        return <StatRow items={(section.data as StatItem[]) || []} />;
      case "radar":
        return <RadarWidget items={(section.data as AxisItem[]) || []} />;
      case "bars":
        return <BarsWidget items={(section.data as AxisItem[]) || []} />;
      case "careers":
        return <CareersWidget items={(section.data as CareerItem[]) || []} />;
      case "chips":
        return <ChipsWidget items={(section.data as string[]) || []} />;
      case "flags":
        return <FlagsWidget items={(section.data as FlagItem[]) || []} />;
      case "notes":
        return <NotesWidget items={(section.data as NoteItem[]) || []} />;
      case "list":
        return <ListWidget items={(section.data as ListItemData[]) || []} />;
      default:
        return null;
    }
  })();

  if (!body) return null;

  // "stat" is presented as a bare grid (no card chrome); everything else gets a card.
  if (section.type === "stat") {
    return (
      <section className="idb-section idb-section-bare">
        {body}
      </section>
    );
  }

  return (
    <section className="idb-section">
      <div className="idb-section-head">
        <h2 className="idb-section-title">{section.title}</h2>
        {section.subtitle && <p className="idb-section-sub">{section.subtitle}</p>}
      </div>
      {body}
    </section>
  );
};
