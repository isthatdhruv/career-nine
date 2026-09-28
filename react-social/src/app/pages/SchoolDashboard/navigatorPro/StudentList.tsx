import React, { useMemo, useState } from "react";
import { AttentionItem, StudentRow, ZoneCount, ZoneKey } from "./navigatorProTypes";
import { OwnerTag, ZONE_COLOURS, ZONE_ORDER } from "./ProWidgets";

/**
 * Every evaluated student in the scope. Built for planning — who goes into which
 * programme — so it sorts and filters freely, but it is never presented as a ranking.
 */

type SortKey = "name" | "will" | "skill" | "foundation" | "reasoning" | "lean" | "priority";

const GATE_TEXT: Record<string, string> = {
  R1: "Held — attention check",
  R3: "Held — no strong interest",
  R4: "Held — no signal",
  R5: "Held — incomplete",
};

interface Props {
  students: StudentRow[];
  zones: ZoneCount[];
  names: Map<number, string>;
  namesLoading: boolean;
  onSelect: (id: number) => void;
  fileLabel: string;
}

const StudentList: React.FC<Props> = ({
  students,
  zones,
  names,
  namesLoading,
  onSelect,
  fileLabel,
}) => {
  const [q, setQ] = useState("");
  const [zone, setZone] = useState<ZoneKey | "all" | "held">("all");
  const [field, setField] = useState("all");
  const [attention, setAttention] = useState<"all" | "1" | "2" | "3" | "any">("all");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "will", desc: true });

  const zoneLabel = (z?: ZoneKey) => zones.find((c) => c.key === z)?.label ?? "";
  const nameOf = (id: number) => names.get(id) ?? `Student ${id}`;

  const fields = useMemo(
    () =>
      Array.from(new Set(students.map((s) => s.lean).filter((x): x is string => !!x))).sort(),
    [students]
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = students.filter((s) => {
      if (needle && !nameOf(s.id).toLowerCase().includes(needle)) return false;
      if (zone === "held" && s.status !== "held") return false;
      if (zone !== "all" && zone !== "held" && s.zone !== zone) return false;
      if (field !== "all" && s.lean !== field) return false;
      if (attention === "any" && s.priority == null) return false;
      if (["1", "2", "3"].includes(attention) && String(s.priority) !== attention) return false;
      return true;
    });
    const val = (s: StudentRow): number | string => {
      switch (sort.key) {
        case "name":
          return nameOf(s.id).toLowerCase();
        case "lean":
          return (s.lean ?? "~").toLowerCase();
        case "priority":
          return s.priority ?? 9;
        default:
          return (s[sort.key] as number | undefined) ?? -1;
      }
    };
    return [...filtered].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = x < y ? -1 : x > y ? 1 : 0;
      return sort.desc ? -c : c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, names, q, zone, field, attention, sort]);

  const header = (key: SortKey, label: string) => (
    <th
      className="npd-sortable"
      onClick={() =>
        setSort((prev) => ({ key, desc: prev.key === key ? !prev.desc : key !== "name" }))
      }
      aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}
    >
      {label}
      {sort.key === key ? (sort.desc ? " ▾" : " ▴") : ""}
    </th>
  );

  const exportCsv = () => {
    const cols = [
      "Name", "Section", "Status", "Zone", "Will", "Skill", "Foundation", "Everyday logic (of 5)",
      "Top interest", "Best-fit direction", "Second direction", "Two equally suited", "Track",
      "Weakest habit", "Top values", "Aspirations", "Ambition matches fit", "Attention priority",
      "Counselled",
    ];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.join(",")];
    rows.forEach((s) => {
      lines.push(
        [
          nameOf(s.id),
          s.section,
          s.status === "held" ? GATE_TEXT[s.gate ?? ""] ?? "Held" : "Delivered",
          zoneLabel(s.zone),
          s.will,
          s.skill,
          s.foundation,
          s.reasoning,
          s.topFamily,
          s.explorer ? "Explorer" : s.lean,
          s.second,
          s.tie ? "yes" : "",
          s.track,
          s.lowHabit,
          (s.values ?? []).join(" / "),
          (s.aspirations ?? []).join(" / "),
          s.ambitionMatch == null ? "" : s.ambitionMatch ? "yes" : "no",
          s.priority ?? "",
          s.counselled ? "yes" : "",
        ]
          .map(esc)
          .join(",")
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileLabel} - Navigator Pro students.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="npd-filters">
        <input
          className="form-control form-control-sm"
          placeholder={namesLoading ? "Loading names…" : "Search by name"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="form-select form-select-sm" value={zone} onChange={(e) => setZone(e.target.value as any)}>
          <option value="all">All zones</option>
          {ZONE_ORDER.map((z) => (
            <option key={z} value={z}>
              {zoneLabel(z)}
            </option>
          ))}
          <option value="held">Report held</option>
        </select>
        <select className="form-select form-select-sm" value={field} onChange={(e) => setField(e.target.value)}>
          <option value="all">All directions</option>
          {fields.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select
          className="form-select form-select-sm"
          value={attention}
          onChange={(e) => setAttention(e.target.value as any)}
        >
          <option value="all">Everyone</option>
          <option value="any">Needs attention</option>
          <option value="1">Priority 1</option>
          <option value="2">Priority 2</option>
          <option value="3">Priority 3</option>
        </select>
        <button type="button" className="btn btn-sm btn-light-primary" onClick={exportCsv}>
          Export CSV ({rows.length})
        </button>
      </div>

      <div className="npd-table-wrap">
        <table className="npd-table">
          <thead>
            <tr>
              {header("name", "Name")}
              <th>Zone</th>
              {header("will", "Will")}
              {header("skill", "Skill")}
              {header("foundation", "Habits")}
              {header("reasoning", "Logic /5")}
              {header("lean", "Best-fit direction")}
              <th>Top interest</th>
              {header("priority", "Attention")}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} onClick={() => onSelect(s.id)} className="npd-row">
                <td>
                  <b>{nameOf(s.id)}</b>
                  {s.section && <div className="npd-muted">{s.section}</div>}
                </td>
                <td>
                  {s.status === "held" ? (
                    <span className="npd-held">{GATE_TEXT[s.gate ?? ""] ?? "Report held"}</span>
                  ) : (
                    <span style={{ color: s.zone ? ZONE_COLOURS[s.zone] : undefined, fontWeight: 700 }}>
                      {zoneLabel(s.zone)}
                    </span>
                  )}
                </td>
                <td>{s.will ?? "—"}</td>
                <td>{s.skill ?? "—"}</td>
                <td>{s.foundation ?? "—"}</td>
                <td>{s.reasoning ?? "—"}</td>
                <td>
                  {s.explorer ? (
                    <i>Explorer</i>
                  ) : (
                    <>
                      {s.lean ?? "—"}
                      {s.tie && (
                        <span className="npd-tie" title={`Two equally suited: also ${s.second}`}>
                          {" "}≈
                        </span>
                      )}
                    </>
                  )}
                </td>
                <td>{s.topFamily ?? "—"}</td>
                <td>
                  {s.priority ? <span className={`npd-prio npd-prio--${s.priority}`}>P{s.priority}</span> : ""}
                  {s.flagged && <span title="Report delivered with a consistency notice"> ⚠️</span>}
                  {s.counselled && <span className="npd-muted" title="Already counselled"> ✓</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="npd-muted" style={{ textAlign: "center", padding: 18 }}>
                  No students match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="npd-cap">
        ≈ two directions equally suited · ⚠️ report delivered with a consistency notice · ✓ already
        counselled · P1–P3 attention priority. Click a row for the full profile.
      </p>
    </div>
  );
};

export default StudentList;

// ───────────────────────────── drawer ─────────────────────────────

export const StudentDrawer: React.FC<{
  student: StudentRow | null;
  item: AttentionItem | undefined;
  name: string;
  zoneLabel: string;
  onClose: () => void;
}> = ({ student, item, name, zoneLabel, onClose }) => {
  if (!student) return null;
  const s = student;
  return (
    <div className="npd-drawer-backdrop" onClick={onClose}>
      <aside className="npd-drawer" onClick={(e) => e.stopPropagation()} aria-label={`Profile of ${name}`}>
        <button type="button" className="btn btn-sm btn-light npd-drawer-close" onClick={onClose}>
          Close
        </button>
        <h3>{name}</h3>
        {s.section && <div className="npd-muted">{s.section}</div>}

        {s.status === "held" ? (
          <div className="npd-disc" style={{ marginTop: 12 }}>
            <b>Report held ({s.gate}).</b> {s.gateReason}. No report was delivered; a counsellor should
            meet this student first.
          </div>
        ) : (
          <>
            <div className="npd-drawer-zone" style={{ borderColor: s.zone ? ZONE_COLOURS[s.zone] : "#ccc" }}>
              {zoneLabel}
            </div>
            <div className="npd-drawer-grid">
              <Stat label="Will" value={s.will} />
              <Stat label="Acquired skill" value={s.skill} />
              <Stat label="Everyday habits" value={s.foundation} />
              <Stat label="Everyday logic" value={`${s.reasoning}/5`} />
            </div>
            <dl className="npd-dl">
              <dt>Best-fit direction</dt>
              <dd>
                {s.explorer
                  ? "Explorer — no single direction stands out yet"
                  : `${s.lean} (${s.leanScore})${s.tie ? ` — equally suited to ${s.second}` : `, then ${s.second}`}`}
              </dd>
              <dt>Interests</dt>
              <dd>
                {s.topFamily}
                {s.secondFamily ? `, then ${s.secondFamily}` : ""}
                {s.track === "A" ? " · alternate-strength plan" : ""}
              </dd>
              <dt>Weakest habit</dt>
              <dd>{s.lowHabit}</dd>
              <dt>Top values</dt>
              <dd>{(s.values ?? []).join(", ") || "—"}</dd>
              <dt>Wants to go into</dt>
              <dd>
                {(s.aspirations ?? []).join(", ") || "—"}
                {s.ambitionMatch === false && (
                  <span className="npd-muted"> · outside their top three fits — worth a conversation</span>
                )}
              </dd>
            </dl>
          </>
        )}

        {item && (
          <div className="npd-drawer-attn">
            <div className="npd-actions-title">
              Needs a person · <span className={`npd-prio npd-prio--${item.priority}`}>P{item.priority}</span>
              {item.counselled && <span className="npd-muted"> · already counselled</span>}
            </div>
            <ul>
              {item.reasons.map((r) => (
                <li key={r.code}>
                  <b>{r.label}.</b> {r.action}. <OwnerTag owner={r.owner} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="npd-stat">
    <div className="npd-stat-v">{value ?? "—"}</div>
    <div className="npd-stat-l">{label}</div>
  </div>
);
