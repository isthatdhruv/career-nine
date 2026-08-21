import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Select from "react-select";
import type { Scope } from "../../../modules/auth/core/_models";
import { ActionIcon } from "../../../components/ActionIcon";

const API_URL = process.env.REACT_APP_API_URL;

/**
 * Editor for a set of ABAC scope rows ({i,s,c,x,g} — institute / session /
 * class / section / student group; blank = wildcard). The same shape the
 * backend stores in user_role_scope and serves from
 * GET /userrolegroupmapping/{mappingId}/scopes.
 *
 * Containment rules are mirrored client-side (the PUT validates them again):
 * session & class need an institute, section needs a class, group needs an
 * institute (and must belong to it — group options are loaded per institute,
 * so the UI cannot produce a cross-institute pair).
 */
interface Props {
  value: Scope[];
  onChange: (rows: Scope[]) => void;
  disabled?: boolean;
}

interface Opt {
  label: string;
  value: number;
}

// Module-level caches — the editor may be mounted several times per page
// (one per assignment row); the lookups are static per session.
let institutesCache: Opt[] | null = null;
let sessionsCache: Opt[] | null = null;
let sectionsCache: Opt[] | null = null;
const coursesCache: Record<number, Opt[]> = {};
const groupsCache: Record<number, Opt[]> = {};

const ScopeRowsEditor = ({ value, onChange, disabled }: Props) => {
  const [institutes, setInstitutes] = useState<Opt[]>(institutesCache || []);
  const [sessions, setSessions] = useState<Opt[]>(sessionsCache || []);
  const [sections, setSections] = useState<Opt[]>(sectionsCache || []);
  const [coursesByInstitute, setCoursesByInstitute] = useState<Record<number, Opt[]>>({ ...coursesCache });
  const [groupsByInstitute, setGroupsByInstitute] = useState<Record<number, Opt[]>>({ ...groupsCache });

  useEffect(() => {
    if (!institutesCache) {
      axios
        .get(`${API_URL}/instituteDetail/get`)
        .then((res) => {
          institutesCache = (res.data || []).map((i: any) => ({
            label: i.instituteName || `#${i.instituteCode}`,
            value: i.instituteCode,
          }));
          setInstitutes(institutesCache!);
        })
        .catch(() => setInstitutes([]));
    }
    if (!sessionsCache) {
      axios
        .get(`${API_URL}/instituteSession/get`)
        .then((res) => {
          sessionsCache = (res.data || []).map((s: any) => ({
            label: [s.sessionStartDate, s.sessionEndDate].filter(Boolean).join(" – ") || `#${s.sessionId}`,
            value: s.sessionId,
          }));
          setSessions(sessionsCache!);
        })
        .catch(() => setSessions([]));
    }
    if (!sectionsCache) {
      axios
        .get(`${API_URL}/section/get`)
        .then((res) => {
          sectionsCache = (res.data || []).map((s: any) => ({
            label: s.name || `#${s.id}`,
            value: s.id,
          }));
          setSections(sectionsCache!);
        })
        .catch(() => setSections([]));
    }
  }, []);

  const ensureInstituteLookups = (instituteCode: number) => {
    if (coursesCache[instituteCode] === undefined) {
      coursesCache[instituteCode] = [];
      axios
        .get(`${API_URL}/instituteCourse/getbyCollegeId/${instituteCode}`)
        .then((res) => {
          coursesCache[instituteCode] = (res.data || []).map((c: any) => ({
            label: c.courseName || `#${c.courseCode}`,
            value: c.courseCode,
          }));
          setCoursesByInstitute({ ...coursesCache });
        })
        .catch(() => {});
    }
    if (groupsCache[instituteCode] === undefined) {
      groupsCache[instituteCode] = [];
      axios
        .get(`${API_URL}/student-groups`, { params: { instituteCode } })
        .then((res) => {
          groupsCache[instituteCode] = (res.data || []).map((g: any) => ({
            label: g.name || `#${g.id}`,
            value: g.id,
          }));
          setGroupsByInstitute({ ...groupsCache });
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    for (const row of value) {
      if (row.i != null) ensureInstituteLookups(row.i);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const setRow = (idx: number, patch: Partial<Scope>) => {
    const next = value.map((r, j) => (j === idx ? { ...r, ...patch } : r));
    onChange(next);
  };

  const selectStyles = useMemo(
    () => ({
      control: (base: any) => ({ ...base, minHeight: "32px", fontSize: "0.8rem", borderRadius: "6px" }),
      menuPortal: (base: any) => ({ ...base, zIndex: 10001 }),
    }),
    []
  );

  const find = (opts: Opt[], v: number | undefined | null) =>
    v == null ? null : opts.find((o) => o.value === v) || { label: `#${v}`, value: v };

  return (
    <div>
      {value.length === 0 && (
        <div style={{ fontSize: "0.78rem", color: "#9ca3af", marginBottom: 6 }}>
          No scope rows — this assignment is unrestricted (permission-only).
          Add a row to limit it to an institute, session, class, section or
          student group.
        </div>
      )}
      {value.map((row, idx) => {
        const courses = row.i != null ? coursesByInstitute[row.i] || [] : [];
        const groups = row.i != null ? groupsByInstitute[row.i] || [] : [];
        return (
          <div
            key={idx}
            className="d-flex align-items-center gap-2 mb-2 flex-wrap"
            style={{ background: "#fafbfc", border: "1px solid #f0f0f0", borderRadius: 8, padding: "6px 8px" }}
          >
            <div style={{ flex: "1 1 160px", minWidth: 150 }}>
              <Select
                options={institutes}
                value={find(institutes, row.i)}
                onChange={(opt: any) => {
                  const i = opt ? opt.value : undefined;
                  if (i != null) ensureInstituteLookups(i);
                  // Institute anchors every other dim — clearing or changing it
                  // resets the dependent selections.
                  setRow(idx, { i, s: undefined, c: undefined, x: undefined, g: undefined });
                }}
                placeholder="Institute (all)"
                isClearable
                isDisabled={disabled}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                styles={selectStyles}
              />
            </div>
            <div style={{ flex: "1 1 130px", minWidth: 120 }}>
              <Select
                options={sessions}
                value={find(sessions, row.s)}
                onChange={(opt: any) => setRow(idx, { s: opt ? opt.value : undefined })}
                placeholder="Session (all)"
                isClearable
                isDisabled={disabled || row.i == null}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                styles={selectStyles}
              />
            </div>
            <div style={{ flex: "1 1 130px", minWidth: 120 }}>
              <Select
                options={courses}
                value={find(courses, row.c)}
                onChange={(opt: any) =>
                  setRow(idx, { c: opt ? opt.value : undefined, x: opt ? row.x : undefined })
                }
                placeholder="Class (all)"
                isClearable
                isDisabled={disabled || row.i == null}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                styles={selectStyles}
              />
            </div>
            <div style={{ flex: "1 1 120px", minWidth: 110 }}>
              <Select
                options={sections}
                value={find(sections, row.x)}
                onChange={(opt: any) => setRow(idx, { x: opt ? opt.value : undefined })}
                placeholder="Section (all)"
                isClearable
                isDisabled={disabled || row.c == null}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                styles={selectStyles}
              />
            </div>
            <div style={{ flex: "1 1 140px", minWidth: 130 }}>
              <Select
                options={groups}
                value={find(groups, row.g)}
                onChange={(opt: any) => setRow(idx, { g: opt ? opt.value : undefined })}
                placeholder="Student group (all)"
                isClearable
                isDisabled={disabled || row.i == null}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                styles={selectStyles}
              />
            </div>
            <button
              className="btn btn-sm"
              onClick={() => onChange(value.filter((_, j) => j !== idx))}
              disabled={disabled}
              title="Remove scope row"
              style={{
                width: 26, height: 26, padding: 0, display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(220,38,38,0.08)", color: "#dc2626",
                border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6, flexShrink: 0,
              }}
            >
              <ActionIcon type="delete" size="sm" />
            </button>
          </div>
        );
      })}
      <button
        className="btn btn-sm btn-light"
        onClick={() => onChange([...value, {}])}
        disabled={disabled}
        style={{ borderRadius: 6, fontSize: "0.78rem" }}
      >
        <ActionIcon type="add" size="sm" className="me-1" />
        Add scope row
      </button>
    </div>
  );
};

export default ScopeRowsEditor;
