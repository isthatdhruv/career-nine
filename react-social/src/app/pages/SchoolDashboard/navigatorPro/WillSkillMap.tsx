import React, { useMemo, useState } from "react";
import { ZoneCount, ZoneKey, ZonePoint } from "./navigatorProTypes";
import { ZONE_COLOURS, ZONE_ORDER } from "./ProWidgets";

/**
 * Every delivered student on one picture: drive (Will) up, what they can already do
 * (Acquired Skill) across. The dashed lines are the batch medians the zones are cut at —
 * the same lines each student's own report drew.
 *
 * Plain SVG rather than a chart library: the quadrant shading, the median captions and
 * the per-zone toggles are the point of the chart, and they are simpler drawn than
 * configured. Text and grid colours come from the page's CSS tokens so both themes read.
 */

const X0 = 60;
const X1 = 690;
const Y0 = 20;
const Y1 = 344;

const sx = (skill: number) => X0 + (Math.max(0, Math.min(100, skill)) / 100) * (X1 - X0);
const sy = (will: number) => Y1 - (Math.max(0, Math.min(100, will)) / 100) * (Y1 - Y0);

/** A small, stable offset so students with identical scores do not hide each other. */
const jitter = (id: number, axis: number) => {
  const h = Math.sin(id * 12.9898 + axis * 78.233) * 43758.5453;
  return (h - Math.floor(h) - 0.5) * 6;
};

interface Props {
  points: ZonePoint[];
  counts: ZoneCount[];
  willMedian: number;
  skillMedian: number;
  names: Map<number, string>;
  onSelect?: (id: number) => void;
}

const WillSkillMap: React.FC<Props> = ({
  points,
  counts,
  willMedian,
  skillMedian,
  names,
  onSelect,
}) => {
  const [hidden, setHidden] = useState<Set<ZoneKey>>(new Set());
  const [tip, setTip] = useState<{ x: number; y: number; p: ZonePoint } | null>(null);

  const labels = useMemo(() => {
    const m = new Map<ZoneKey, string>();
    counts.forEach((c) => m.set(c.key, c.label));
    return m;
  }, [counts]);

  const toggle = (z: ZoneKey) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(z)) next.delete(z);
      else next.add(z);
      return next;
    });

  const mx = sx(skillMedian);
  const my = sy(willMedian);

  return (
    <div className="npd-map">
      <div className="npd-chips" role="group" aria-label="Show or hide a zone">
        {ZONE_ORDER.map((z) => {
          const c = counts.find((x) => x.key === z);
          return (
            <button
              key={z}
              type="button"
              className={`npd-chip${hidden.has(z) ? "" : " is-on"}`}
              style={{ "--zc": ZONE_COLOURS[z] } as React.CSSProperties}
              onClick={() => toggle(z)}
              aria-pressed={!hidden.has(z)}
            >
              <i />
              {c?.label ?? z} · {c?.count ?? 0}
            </button>
          );
        })}
      </div>

      <svg viewBox="0 0 700 404" role="img" aria-label="Will versus Skill map of the batch">
        <rect x={mx} y={Y0} width={X1 - mx} height={my - Y0} fill={ZONE_COLOURS.ready} opacity={0.07} />
        <rect x={X0} y={Y0} width={mx - X0} height={my - Y0} fill={ZONE_COLOURS.motivated} opacity={0.07} />
        <rect x={mx} y={my} width={X1 - mx} height={Y1 - my} fill={ZONE_COLOURS.capable} opacity={0.07} />
        <rect x={X0} y={my} width={mx - X0} height={Y1 - my} fill={ZONE_COLOURS.support} opacity={0.07} />

        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line className="npd-gridline" x1={sx(t)} y1={Y0} x2={sx(t)} y2={Y1} />
            <line className="npd-gridline" x1={X0} y1={sy(t)} x2={X1} y2={sy(t)} />
            <text x={sx(t)} y={Y1 + 15} fontSize="10" textAnchor="middle">
              {t}
            </text>
            <text x={X0 - 8} y={sy(t) + 3} fontSize="10" textAnchor="end">
              {t}
            </text>
          </g>
        ))}

        <line className="npd-median" x1={mx} y1={Y0} x2={mx} y2={Y1} strokeDasharray="5 4" />
        <line className="npd-median" x1={X0} y1={my} x2={X1} y2={my} strokeDasharray="5 4" />
        <text x={mx + 6} y={Y0 + 12} fontSize="10.5">
          median skill {skillMedian}
        </text>
        <text x={X1 - 4} y={my - 6} fontSize="10.5" textAnchor="end">
          median will {willMedian}
        </text>
        <text x={X1} y={398} fontSize="12" textAnchor="end">
          Acquired skill (what they can already do) →
        </text>
        <text x={X0} y={12} fontSize="12">
          ↑ Will (how driven they are)
        </text>

        {points
          .filter((p) => !hidden.has(p.zone))
          .map((p) => (
            <circle
              key={p.id}
              className="npd-dot"
              cx={sx(p.skill) + jitter(p.id, 1)}
              cy={sy(p.will) + jitter(p.id, 2)}
              r={6.5}
              fill={ZONE_COLOURS[p.zone]}
              onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, p })}
              onMouseLeave={() => setTip(null)}
              onClick={() => onSelect?.(p.id)}
            />
          ))}
      </svg>

      {tip && (
        <div className="npd-tip" style={{ left: tip.x + 14, top: tip.y + 12 }}>
          <b>{names.get(tip.p.id) ?? `Student ${tip.p.id}`}</b>
          <br />
          Will {tip.p.will} · Skill {tip.p.skill}
          <br />
          {labels.get(tip.p.zone)}
        </div>
      )}
    </div>
  );
};

export default WillSkillMap;
