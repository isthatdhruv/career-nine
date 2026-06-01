/* eslint-disable jsx-a11y/anchor-is-valid */
//
// macOS Spotlight–style global student search.
//
// Lives in `partials/layout` so it sits next to the other header-level
// components (SearchModal, RightToolbar). The fetcher is in this file rather
// than `app/pages/.../API/` because the modal is a layout artifact, not a
// feature page — it would feel out of place under `pages/`.
//
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "../../../app/modules/auth";

// ─── Types ────────────────────────────────────────────────────────────────
// Mirrors what /student-info/global-search returns — the same shape produced
// by assembleStudentsWithMapping() which the Reports Hub table also consumes,
// plus the two decoration fields the controller stitches in (`matchHint`,
// `instituteName`).
export type GlobalSearchRow = {
  id?: number;
  userStudentId?: number;
  name?: string;
  email?: string;
  phoneNumber?: string;
  schoolRollNumber?: string;
  controlNumber?: number | string;
  studentDob?: string;
  schoolSectionId?: number;
  username?: string;
  gender?: string;
  instituteId?: number;
  instituteName?: string;
  matchHint?: string;
  assessments?: { assessmentId: number; assessmentName: string; status: string }[];
  [key: string]: any;
};

// Mirrors the dossier returned by /student-info/global-search/detail/{id}.
// The backend keeps the response flat (LinkedHashMap) so we type loosely
// here — only the fields we actually render are spelled out.
export type StudentReport = {
  generatedReportId: number;
  typeOfReport: string;
  reportStatus: string;
  reportUrl?: string | null;
  visibleToStudent?: boolean;
};

export type StudentDossier = {
  profile: {
    userStudentId: number;
    studentInfoId: number;
    name?: string;
    email?: string;
    phoneNumber?: string;
    schoolRollNumber?: string;
    controlNumber?: number | string;
    studentDob?: string;
    address?: string;
    gender?: string;
    family?: string;
    sibling?: number;
    schoolBoard?: string;
    studentClass?: number;
    username?: string;
    careerNineRollNumber?: string;
    infoCompleted?: boolean;
    counsellingAllowed?: boolean;
    reportsVisible?: boolean;
  };
  institute?: { instituteCode?: number; instituteName?: string } | null;
  schoolSection?: {
    schoolSectionId?: number;
    sectionName?: string;
    className?: string;
    classId?: number;
  } | null;
  demographics: Array<{
    fieldId: number;
    fieldName: string;
    displayLabel: string;
    dataType: string;
    value?: string;
    rawValue?: string;
    submittedAt?: string;
  }>;
  assessments: Array<{
    assessmentId: number;
    assessmentName: string;
    status: string;
    reports: StudentReport[];
  }>;
  payments: Array<{
    transactionId: number;
    amount?: number;
    originalAmount?: number;
    currency?: string;
    status?: string;
    assessmentId?: number;
    assessmentName?: string;
    campaignId?: number;
    promoCode?: string;
    promoDiscountPercent?: number;
    shortUrl?: string;
    paymentLinkUrl?: string;
    razorpayPaymentId?: string;
    failureReason?: string;
    createdAt?: string;
    updatedAt?: string;
  }>;
};

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

/**
 * Fetches matching students. Accepts an `AbortSignal` so the modal can cancel
 * in-flight requests when the user keeps typing — without this we get the
 * classic stale-response race where an older query's results render last.
 */
async function searchStudentsGlobal(q: string, signal: AbortSignal): Promise<GlobalSearchRow[]> {
  const res = await axios.get<GlobalSearchRow[]>(
    `${API_URL}/student-info/global-search`,
    {
      params: { q, limit: 50 },
      signal,
      withCredentials: true,
    }
  );
  return res.data || [];
}

async function fetchStudentDossier(
  userStudentId: number,
  signal: AbortSignal
): Promise<StudentDossier> {
  const res = await axios.get<StudentDossier>(
    `${API_URL}/student-info/global-search/detail/${userStudentId}`,
    { signal, withCredentials: true }
  );
  return res.data;
}

// ─── Component ────────────────────────────────────────────────────────────

type Props = {
  show: boolean;
  handleClose: () => void;
};

const GlobalStudentSearchModal: React.FC<Props> = ({ show, handleClose }) => {
  const { currentUser } = useAuth();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Detail-view state — the modal flips between a "results" mode and a
  // "detail" mode when the operator clicks a row. We keep both pieces of
  // state in the same component because they share the panel chrome (input,
  // backdrop, esc handler).
  const [selected, setSelected] = useState<GlobalSearchRow | null>(null);
  const [dossier, setDossier] = useState<StudentDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierError, setDossierError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dossierAbortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Reset state every time the modal opens so a stale query doesn't bleed
  // across sessions. Autofocus the input — Spotlight always lands on the
  // search field, no extra clicks.
  useEffect(() => {
    if (!show) return;
    setQuery("");
    setResults([]);
    setError(null);
    setActiveIdx(0);
    setSelected(null);
    setDossier(null);
    setDossierError(null);
    setDossierLoading(false);
    // setTimeout lets the modal mount before focus is requested; otherwise
    // react-bootstrap's modal transition steals focus back.
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [show]);

  // Debounced fetch. 200ms is a sweet spot: faster than 300 feels responsive
  // for power users, slower than 100 avoids hammering the LIKE-heavy query.
  useEffect(() => {
    if (!show) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    debounceRef.current = window.setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const rows = await searchStudentsGlobal(trimmed, controller.signal);
        // Guard: if the controller was aborted between await + assignment,
        // discard. axios throws on abort, but defensive belt-and-braces.
        if (!controller.signal.aborted) {
          setResults(rows);
          setActiveIdx(0);
        }
      } catch (e: any) {
        if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
        setError("Search failed. Please try again.");
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, show]);

  // Global keyboard handling.
  //  - In results mode: Esc closes, Up/Down navigate, Enter selects.
  //  - In detail mode:  Esc goes back to results (not close — feels more
  //                     spotlight-like and forgiving for misclicks).
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (selected) {
          handleBackToResults();
        } else {
          handleClose();
        }
      } else if (selected) {
        return; // arrows/Enter do nothing in detail mode
      } else if (e.key === "ArrowDown") {
        if (results.length === 0) return;
        e.preventDefault();
        setActiveIdx((i) => Math.min(results.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        if (results.length === 0) return;
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        if (results.length === 0) return;
        e.preventDefault();
        const picked = results[activeIdx];
        if (picked) handleRowSelect(picked);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, results, activeIdx, selected]);

  // Scroll the highlighted row into view when the user arrows through.
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-row-idx="${activeIdx}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const handleRowSelect = (row: GlobalSearchRow) => {
    if (!row.userStudentId) return; // can't fetch a dossier without an id
    setSelected(row);
    setDossier(null);
    setDossierError(null);
    setDossierLoading(true);
    dossierAbortRef.current?.abort();
    const controller = new AbortController();
    dossierAbortRef.current = controller;
    fetchStudentDossier(row.userStudentId, controller.signal)
      .then((d) => {
        if (!controller.signal.aborted) setDossier(d);
      })
      .catch((e: any) => {
        if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
        setDossierError("Could not load student details.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setDossierLoading(false);
      });
  };

  const handleBackToResults = () => {
    dossierAbortRef.current?.abort();
    setSelected(null);
    setDossier(null);
    setDossierError(null);
    setDossierLoading(false);
    // restore focus to the search input so the operator can keep typing
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };

  // The user's scope summary is shown next to the input so they understand
  // why the result set might exclude students they expect.
  const scopeSummary = useMemo(() => {
    if (!currentUser) return "";
    if (currentUser.superAdmin) return "All institutes";
    const instituteIds = (currentUser.scopes ?? [])
      .map((s) => s.i)
      .filter((v): v is number => v != null);
    if (instituteIds.length === 0) return "All accessible";
    if (instituteIds.length === 1) return `Institute ${instituteIds[0]}`;
    return `${instituteIds.length} institutes`;
  }, [currentUser]);

  if (!show) return null;

  // ─── Render ──────────────────────────────────────────────────────────────
  // Custom backdrop + centered panel rather than react-bootstrap Modal — we
  // want the Spotlight-specific look (no header bar, blurred backdrop,
  // single floating panel) and Bootstrap's modal-content chrome fights it.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global student search"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1080,
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        paddingLeft: 16,
        paddingRight: 16,
      }}
      onClick={(e) => {
        // Click outside the panel closes (the panel uses stopPropagation).
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          // Wider in detail mode so all the panels can breathe.
          maxWidth: selected ? 920 : 720,
          background: "rgba(255, 255, 255, 0.98)",
          borderRadius: 14,
          boxShadow: "0 30px 60px -15px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.6)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "85vh",
          transition: "max-width 0.15s ease",
        }}
      >
        {/* Header row — search input OR detail breadcrumb */}
        {selected ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "14px 18px",
              borderBottom: "1px solid #eef2f7",
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={handleBackToResults}
              title="Back to results (esc)"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#f1f5f9",
                border: "none",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "#0f172a",
                cursor: "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {selected.name || dossier?.profile?.name || "Student"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                {dossier?.institute?.instituteName || selected.instituteName || "—"}
                {dossier?.schoolSection &&
                  ` · ${dossier.schoolSection.className ?? ""} ${dossier.schoolSection.sectionName ?? ""}`}
              </div>
            </div>
            <kbd
              style={{
                fontSize: "0.7rem",
                color: "#64748b",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 4,
                padding: "2px 6px",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
              }}
            >
              esc
            </kbd>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "14px 18px",
              borderBottom: "1px solid #eef2f7",
              gap: 12,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search students by name, email, phone, roll no, father name…"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: "1.35rem",
                fontWeight: 400,
                color: "#0f172a",
                background: "transparent",
              }}
            />
            <span
              title="Scope of this search"
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                color: "#475569",
                background: "#f1f5f9",
                padding: "4px 10px",
                borderRadius: 999,
                whiteSpace: "nowrap",
              }}
            >
              {scopeSummary}
            </span>
            <kbd
              style={{
                fontSize: "0.7rem",
                color: "#64748b",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 4,
                padding: "2px 6px",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
              }}
            >
              esc
            </kbd>
          </div>
        )}

        {/* Body — results list OR detail dossier */}
        <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
          {selected ? (
            <DetailPanel
              fallback={selected}
              dossier={dossier}
              loading={dossierLoading}
              error={dossierError}
            />
          ) : (
            <>
              {query.trim().length < 2 && (
                <EmptyState
                  icon="search"
                  title="Search across every student you can see"
                  subtitle="Match by name, email, phone, roll number, control number, address, or any demographic field (father name, mother name, religion, …)."
                />
              )}
              {query.trim().length >= 2 && loading && (
                <div style={{ padding: "20px 18px", color: "#64748b", fontSize: "0.9rem" }}>
                  Searching…
                </div>
              )}
              {error && !loading && (
                <div style={{ padding: "20px 18px", color: "#b91c1c", fontSize: "0.9rem" }}>
                  {error}
                </div>
              )}
              {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
                <EmptyState
                  icon="empty"
                  title="No matches"
                  subtitle={`Nothing matched "${query.trim()}" in your accessible students.`}
                />
              )}
              {!loading && results.length > 0 && (
                <ResultsTable
                  rows={results}
                  activeIdx={activeIdx}
                  onRowHover={(i) => setActiveIdx(i)}
                  onRowClick={handleRowSelect}
                />
              )}
            </>
          )}
        </div>

        {/* Footer — keybind hints change with mode */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 14px",
            borderTop: "1px solid #eef2f7",
            background: "#fafbfc",
            fontSize: "0.72rem",
            color: "#64748b",
          }}
        >
          {selected ? (
            <>
              <span>Student dossier</span>
              <span style={{ display: "flex", gap: 14 }}>
                <KbdHint keys={["esc"]} label="back" />
              </span>
            </>
          ) : (
            <>
              <span>
                <strong>{results.length}</strong> result{results.length === 1 ? "" : "s"}
                {results.length === 50 && " (showing top 50)"}
              </span>
              <span style={{ display: "flex", gap: 14 }}>
                <KbdHint keys={["↑", "↓"]} label="navigate" />
                <KbdHint keys={["↵"]} label="open" />
                <KbdHint keys={["esc"]} label="close" />
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Subcomponents ────────────────────────────────────────────────────────

// Detail-panel chrome shared by every section. Lets us keep a consistent look
// (label / box / spacing) without copy-pasting the same wrapper six times.
const sectionTitleStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#64748b",
  marginBottom: 8,
  marginTop: 4,
};
const sectionBoxStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "12px 14px",
  background: "#fff",
};
const fieldLabelStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "#64748b",
  fontWeight: 500,
  marginBottom: 2,
};
const fieldValueStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "#0f172a",
  fontWeight: 500,
  wordBreak: "break-word",
};

const fmtDate = (v?: string) => {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toLocaleDateString();
  } catch {
    return v;
  }
};
const fmtMoney = (amt?: number, currency?: string) => {
  if (amt == null) return "—";
  // Razorpay stores paise — we display rupees for INR (the only currency the
  // model documents). Other currencies fall through as-is, no scaling.
  const isInr = (currency || "INR").toUpperCase() === "INR";
  const value = isInr ? amt / 100 : amt;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value} ${currency || ""}`;
  }
};

const KV: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div style={{ minWidth: 0 }}>
    <div style={fieldLabelStyle}>{label}</div>
    <div style={fieldValueStyle}>
      {value === undefined || value === null || value === "" ? (
        <span style={{ color: "#94a3b8" }}>—</span>
      ) : (
        value
      )}
    </div>
  </div>
);

const statusPill = (text: string, kind: "ok" | "warn" | "info" | "danger" | "muted") => {
  const palette: Record<string, { bg: string; fg: string }> = {
    ok: { bg: "#dcfce7", fg: "#059669" },
    warn: { bg: "#fef3c7", fg: "#b45309" },
    info: { bg: "#dbeafe", fg: "#2563eb" },
    danger: { bg: "#fee2e2", fg: "#b91c1c" },
    muted: { bg: "#f1f5f9", fg: "#475569" },
  };
  const p = palette[kind];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: "0.7rem",
        fontWeight: 700,
        background: p.bg,
        color: p.fg,
        textTransform: "capitalize",
      }}
    >
      {text}
    </span>
  );
};

const assessmentStatusKind = (s?: string) => {
  const v = (s || "").toLowerCase();
  if (v === "completed" || v === "complete") return "ok";
  if (v === "ongoing" || v === "inprogress" || v === "in_progress") return "info";
  return "warn";
};
const paymentStatusKind = (s?: string) => {
  const v = (s || "").toLowerCase();
  if (v === "paid" || v === "captured" || v === "success") return "ok";
  if (v === "failed" || v === "cancelled" || v === "canceled") return "danger";
  if (v === "created" || v === "pending" || v === "issued") return "info";
  return "muted";
};

const DetailPanel: React.FC<{
  fallback: GlobalSearchRow;
  dossier: StudentDossier | null;
  loading: boolean;
  error: string | null;
}> = ({ fallback, dossier, loading, error }) => {
  if (error) {
    return (
      <div style={{ padding: "20px 18px", color: "#b91c1c", fontSize: "0.9rem" }}>{error}</div>
    );
  }
  if (loading && !dossier) {
    return (
      <div style={{ padding: "20px 18px", color: "#64748b", fontSize: "0.9rem" }}>
        Loading student details…
      </div>
    );
  }
  // While the dossier hasn't loaded yet but we have a fallback row (the search
  // hit), render what we know so the panel doesn't feel empty.
  const profile = dossier?.profile;
  const inst = dossier?.institute;
  const sect = dossier?.schoolSection;
  const demo = dossier?.demographics ?? [];
  const asmts = dossier?.assessments ?? [];
  const pays = dossier?.payments ?? [];

  return (
    <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* PROFILE */}
      <div>
        <div style={sectionTitleStyle}>Profile</div>
        <div style={sectionBoxStyle}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 14,
            }}
          >
            <KV label="Full name" value={profile?.name ?? fallback.name} />
            <KV label="Email" value={profile?.email ?? fallback.email} />
            <KV label="Phone" value={profile?.phoneNumber ?? fallback.phoneNumber} />
            <KV label="DOB" value={fmtDate(profile?.studentDob ?? fallback.studentDob)} />
            <KV label="Gender" value={profile?.gender ?? fallback.gender} />
            <KV label="Username" value={profile?.username ?? fallback.username} />
            <KV
              label="School roll no."
              value={profile?.schoolRollNumber ?? fallback.schoolRollNumber}
            />
            <KV
              label="Control no."
              value={profile?.controlNumber ?? fallback.controlNumber}
            />
            <KV
              label="Career9 roll no."
              value={profile?.careerNineRollNumber}
            />
            <KV label="Family" value={profile?.family} />
            <KV label="Siblings" value={profile?.sibling} />
            <KV label="School board" value={profile?.schoolBoard} />
            <KV label="Address" value={profile?.address} />
          </div>
        </div>
      </div>

      {/* SCHOOL / INSTITUTE */}
      <div>
        <div style={sectionTitleStyle}>Institute &amp; class</div>
        <div style={sectionBoxStyle}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 14,
            }}
          >
            <KV label="Institute" value={inst?.instituteName ?? fallback.instituteName} />
            <KV label="Institute code" value={inst?.instituteCode ?? fallback.instituteId} />
            <KV label="Class" value={sect?.className} />
            <KV label="Section" value={sect?.sectionName} />
            <KV label="Counselling" value={profile?.counsellingAllowed ? "Allowed" : "Not allowed"} />
            <KV
              label="Reports visibility"
              value={profile?.reportsVisible ? "Visible to student" : "Hidden"}
            />
          </div>
        </div>
      </div>

      {/* DEMOGRAPHICS */}
      <div>
        <div style={sectionTitleStyle}>Demographic responses</div>
        <div style={sectionBoxStyle}>
          {demo.length === 0 ? (
            <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
              No demographic responses recorded.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 14,
              }}
            >
              {demo.map((d) => (
                <KV key={d.fieldId} label={d.displayLabel || d.fieldName} value={d.value || d.rawValue} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ASSESSMENTS */}
      <div>
        <div style={sectionTitleStyle}>Assessments</div>
        <div style={sectionBoxStyle}>
          {asmts.length === 0 ? (
            <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>No assessments allotted.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {asmts.map((a) => (
                <AssessmentRow key={a.assessmentId} assessment={a} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* REPORTS — flattened cross-assessment view so the operator can see
          "what can I download right now?" without scanning each assessment
          card. The same report rows are still shown inline above; this is
          the dedicated download surface. */}
      <div>
        <div style={sectionTitleStyle}>Reports</div>
        <div style={sectionBoxStyle}>
          <ReportsSection assessments={asmts} />
        </div>
      </div>

      {/* PAYMENTS */}
      <div>
        <div style={sectionTitleStyle}>Payments</div>
        <div style={sectionBoxStyle}>
          {pays.length === 0 ? (
            <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>No payment transactions.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pays.map((p) => (
                <div
                  key={p.transactionId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 10px",
                    border: "1px solid #f1f5f9",
                    borderRadius: 8,
                    background: "#fafbfc",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0f172a" }}>
                      {fmtMoney(p.amount, p.currency)}{" "}
                      {p.assessmentName && (
                        <span style={{ color: "#64748b", fontWeight: 500 }}>
                          · {p.assessmentName}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 2 }}>
                      {fmtDate(p.createdAt)}
                      {p.promoCode && ` · promo ${p.promoCode}`}
                      {p.promoDiscountPercent != null && ` (-${p.promoDiscountPercent}%)`}
                      {p.razorpayPaymentId && ` · ${p.razorpayPaymentId}`}
                    </div>
                    {p.failureReason && (
                      <div style={{ fontSize: "0.7rem", color: "#b91c1c", marginTop: 2 }}>
                        {p.failureReason}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {statusPill(p.status || "—", paymentStatusKind(p.status))}
                    {p.shortUrl && (
                      <a
                        href={p.shortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "0.7rem",
                          color: "#2563eb",
                          textDecoration: "none",
                          fontWeight: 600,
                        }}
                      >
                        Open link ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Per-assessment block: status pill plus a row of download links for whatever
// reports have been generated. We only show "Download" when reportUrl is
// present — the modal is for quick reference, not for triggering generation
// (the operator still has Reports Hub for that workflow).
const AssessmentRow: React.FC<{
  assessment: StudentDossier["assessments"][number];
}> = ({ assessment }) => {
  const ready = assessment.reports.filter((r) => !!r.reportUrl);
  return (
    <div
      style={{
        padding: "10px 12px",
        border: "1px solid #f1f5f9",
        borderRadius: 8,
        background: "#fafbfc",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#0f172a" }}>
            {assessment.assessmentName}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: 2 }}>
            ID {assessment.assessmentId}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {statusPill(assessment.status || "—", assessmentStatusKind(assessment.status))}
        </div>
      </div>
      {/* Reports row — only shown if at least one report row exists; "ready"
          ones get a clickable download, others surface their state so the
          operator knows why no link is offered. */}
      {assessment.reports.length > 0 && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {assessment.reports.map((r) => {
            const hasUrl = !!r.reportUrl;
            return (
              <a
                key={r.generatedReportId}
                href={hasUrl ? (r.reportUrl as string) : undefined}
                target={hasUrl ? "_blank" : undefined}
                rel={hasUrl ? "noopener noreferrer" : undefined}
                onClick={(e) => {
                  if (!hasUrl) e.preventDefault();
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 10px",
                  borderRadius: 6,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  background: hasUrl ? "#eff6ff" : "#f1f5f9",
                  color: hasUrl ? "#2563eb" : "#94a3b8",
                  border: `1px solid ${hasUrl ? "#bfdbfe" : "#e2e8f0"}`,
                  cursor: hasUrl ? "pointer" : "not-allowed",
                }}
                title={hasUrl ? "Open report in new tab" : `Report status: ${r.reportStatus}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {r.typeOfReport}
                {!hasUrl && (
                  <span style={{ marginLeft: 2, fontSize: "0.65rem", opacity: 0.8 }}>
                    ({r.reportStatus})
                  </span>
                )}
              </a>
            );
          })}
          {ready.length === 0 && (
            <span style={{ fontSize: "0.72rem", color: "#94a3b8", alignSelf: "center" }}>
              No downloadable reports yet.
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// Friendly labels for the raw report-type slugs the backend stores
// (`navigator`, `fourPager`, `bet`, etc.). Falls through to the slug itself
// when we haven't seen the type before so new report kinds don't render as
// "—".
const REPORT_TYPE_LABEL: Record<string, string> = {
  navigator: "Career Navigator",
  navigator360: "Navigator 360",
  fourpager: "Four Pager",
  fourPager: "Four Pager",
  bet: "BET Report",
};
const reportTypeLabel = (t?: string) => {
  if (!t) return "Report";
  return REPORT_TYPE_LABEL[t] || REPORT_TYPE_LABEL[t.toLowerCase()] || t;
};
const reportStatusKind = (s?: string) => {
  const v = (s || "").toLowerCase();
  if (v === "generated" || v === "ready" || v === "complete") return "ok";
  if (v === "generating" || v === "pending" || v === "in_progress") return "info";
  if (v === "failed" || v === "error") return "danger";
  return "muted";
};

type FlatReport = {
  assessmentId: number;
  assessmentName: string;
  assessmentStatus: string;
} & StudentReport;

// Flatten every assessment's generated reports into a single, downloadable
// list. We split into two groups — "ready" (has reportUrl, click to download)
// and "in-progress / not yet generated" — so the operator's eye lands on the
// actionable rows first.
const ReportsSection: React.FC<{
  assessments: StudentDossier["assessments"];
}> = ({ assessments }) => {
  const flat: FlatReport[] = [];
  for (const a of assessments) {
    for (const r of a.reports) {
      flat.push({
        ...r,
        assessmentId: a.assessmentId,
        assessmentName: a.assessmentName,
        assessmentStatus: a.status,
      });
    }
  }

  if (flat.length === 0) {
    return (
      <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
        No reports generated yet for this student.
      </div>
    );
  }

  const ready = flat.filter((r) => !!r.reportUrl);
  const pending = flat.filter((r) => !r.reportUrl);

  const Header: React.FC<{ text: string; count: number }> = ({ text, count }) => (
    <div
      style={{
        fontSize: "0.7rem",
        fontWeight: 700,
        color: "#475569",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        marginTop: 4,
        marginBottom: 6,
      }}
    >
      {text} <span style={{ color: "#94a3b8", fontWeight: 600 }}>· {count}</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {ready.length > 0 && (
        <div>
          <Header text="Available to download" count={ready.length} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ready.map((r) => (
              <ReportRow key={r.generatedReportId} report={r} />
            ))}
          </div>
        </div>
      )}
      {pending.length > 0 && (
        <div>
          <Header text="Not ready" count={pending.length} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pending.map((r) => (
              <ReportRow key={r.generatedReportId} report={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ReportRow: React.FC<{ report: FlatReport }> = ({ report }) => {
  const hasUrl = !!report.reportUrl;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 10px",
        border: "1px solid #f1f5f9",
        borderRadius: 8,
        background: hasUrl ? "#fff" : "#fafbfc",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: hasUrl ? "#eff6ff" : "#f1f5f9",
          color: hasUrl ? "#2563eb" : "#94a3b8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      {/* Title + sub */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.88rem",
            fontWeight: 600,
            color: "#0f172a",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {reportTypeLabel(report.typeOfReport)}
        </div>
        <div
          style={{
            fontSize: "0.72rem",
            color: "#64748b",
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {report.assessmentName}
          {report.visibleToStudent ? " · visible to student" : ""}
        </div>
      </div>
      {/* Status + action */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        {statusPill(report.reportStatus || "—", reportStatusKind(report.reportStatus))}
        {hasUrl ? (
          <a
            href={report.reportUrl as string}
            target="_blank"
            rel="noopener noreferrer"
            download
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: "0.75rem",
              fontWeight: 700,
              background: "#2563eb",
              color: "#fff",
              textDecoration: "none",
              border: "none",
              cursor: "pointer",
            }}
            title="Download report"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </a>
        ) : (
          <span
            style={{
              fontSize: "0.72rem",
              color: "#94a3b8",
              fontStyle: "italic",
            }}
          >
            Not yet generated
          </span>
        )}
      </div>
    </div>
  );
};

const ResultsTable: React.FC<{
  rows: GlobalSearchRow[];
  activeIdx: number;
  onRowHover: (i: number) => void;
  onRowClick: (row: GlobalSearchRow) => void;
}> = ({ rows, activeIdx, onRowHover, onRowClick }) => {
  // Columns intentionally mirror the Reports Hub table so the operator's
  // mental model carries over. Action columns from Reports Hub are dropped —
  // this view is for jumping, not bulk-acting.
  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    fontWeight: 600,
    color: "#0f172a",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
    fontSize: "0.72rem",
    textAlign: "left",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: "#f8fafc",
    position: "sticky",
    top: 0,
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: "0.85rem",
    color: "#1e293b",
    borderBottom: "1px solid #f1f5f9",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Institute</th>
            <th style={thStyle}>Roll No.</th>
            <th style={thStyle}>Email</th>
            <th style={thStyle}>Phone</th>
            <th style={thStyle}>Matched on</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isActive = i === activeIdx;
            return (
              <tr
                key={`${r.id ?? r.userStudentId}-${i}`}
                data-row-idx={i}
                onMouseEnter={() => onRowHover(i)}
                onClick={() => onRowClick(r)}
                style={{
                  cursor: "pointer",
                  background: isActive ? "#eff6ff" : "transparent",
                  borderLeft: isActive ? "3px solid #2563eb" : "3px solid transparent",
                }}
              >
                <td style={{ ...tdStyle, fontWeight: 600 }}>
                  {r.name || <span style={{ color: "#94a3b8" }}>—</span>}
                  {r.username && (
                    <div style={{ fontSize: "0.7rem", color: "#64748b", fontFamily: "monospace" }}>
                      {r.username}
                    </div>
                  )}
                </td>
                <td style={tdStyle}>
                  {r.instituteName || (r.instituteId ? `#${r.instituteId}` : "—")}
                </td>
                <td style={tdStyle}>{r.schoolRollNumber || "—"}</td>
                <td style={tdStyle}>{r.email || "—"}</td>
                <td style={tdStyle}>{r.phoneNumber || "—"}</td>
                <td style={{ ...tdStyle, color: "#475569", fontSize: "0.78rem" }}>
                  {r.matchHint || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const EmptyState: React.FC<{
  icon: "search" | "empty";
  title: string;
  subtitle: string;
}> = ({ icon, title, subtitle }) => (
  <div
    style={{
      padding: "40px 24px",
      textAlign: "center",
      color: "#64748b",
    }}
  >
    <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
      {icon === "search" ? (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ) : (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      )}
    </div>
    <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>
      {title}
    </div>
    <div style={{ fontSize: "0.8rem", lineHeight: 1.5, maxWidth: 460, margin: "0 auto" }}>
      {subtitle}
    </div>
  </div>
);

const KbdHint: React.FC<{ keys: string[]; label: string }> = ({ keys, label }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
    {keys.map((k) => (
      <kbd
        key={k}
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          fontSize: "0.7rem",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 4,
          padding: "1px 5px",
          color: "#475569",
        }}
      >
        {k}
      </kbd>
    ))}
    <span>{label}</span>
  </span>
);

export { GlobalStudentSearchModal };
