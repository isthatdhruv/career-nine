import { CSSProperties, FC, Fragment, useEffect, useMemo, useState } from "react";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import {
  EmailReviewStatus,
  EmailTemplate,
  EmailTypeCatalogEntry,
  LintFinding,
  MailCatalogue as MailCatalogueData,
  MailCatalogueRow,
  MailCatalogueSummary,
  MailCatalogueUnlisted,
  getEmailTemplate,
  getEmailTypeCatalog,
  getMailCatalogue,
  reviewEmailTemplate,
} from "../API/EmailTemplate_APIs";
import EmailTemplateEditorModal from "./EmailTemplateEditorModal";
import { MailClassBadge, OriginBadge, REVIEW_LABELS, SeverityBadge, formatDateTime, mono, pill } from "./MailBadges";

// ── Filters ────────────────────────────────────────────────────────────────

type StateFilter = "" | "live" | "content-only" | "inactive";
const UNSET_CLASS = "__unset__";

interface Filters {
  search: string;
  category: string;
  mailClass: string;
  reviewStatus: string;
  state: StateFilter;
  hasFindings: boolean;
  uneditedOnly: boolean;
}

const EMPTY_FILTERS: Filters = { search: "", category: "", mailClass: "", reviewStatus: "", state: "", hasFindings: false, uneditedOnly: false };

function matchesFilters(row: MailCatalogueRow, f: Filters): boolean {
  const q = f.search.trim().toLowerCase();
  if (q) {
    const hay = [row.name, row.mailKey, row.sourceRef].filter(Boolean).join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.category && row.category !== f.category) return false;
  if (f.mailClass === UNSET_CLASS) {
    if (row.mailClass) return false;
  } else if (f.mailClass && row.mailClass !== f.mailClass) return false;
  if (f.reviewStatus && row.reviewStatus !== f.reviewStatus) return false;
  if (f.state === "live" && !row.live) return false;
  if (f.state === "content-only" && row.portState !== "CONTENT_ONLY") return false;
  if (f.state === "inactive" && row.active) return false;
  if (f.hasFindings && row.findings.length === 0) return false;
  if (f.uneditedOnly && row.edited) return false;
  return true;
}

// ── Shared styles ──────────────────────────────────────────────────────────

const COLUMNS = ["Mail", "Category", "Class", "Origin", "Source", "State", "Edited", "Review", "Findings", "Actions"];
const REVIEW_KEYS = Object.keys(REVIEW_LABELS) as EmailReviewStatus[];
const REVIEW_SUMMARY_KEY: Record<EmailReviewStatus, keyof MailCatalogueSummary> = { NOT_REVIEWED: "notReviewed", APPROVED: "approved", NEEDS_CHANGE: "needsChange" };

const card: CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" };
const th: CSSProperties = { padding: "10px 12px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px", background: "#f9fafb", whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "8px 12px", verticalAlign: "top" };
const control: CSSProperties = { borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.85rem" };
const eyebrow: CSSProperties = { fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.4px", color: "#9ca3af", marginBottom: 4 };
const dash = <span style={{ color: "#d1d5db" }}>—</span>;
const primaryBtn: CSSProperties = { background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600 };

// ── Summary strip ──────────────────────────────────────────────────────────

const SummaryStrip: FC<{ summary: MailCatalogueSummary }> = ({ summary }) => {
  const tiles: { label: string; value: number; color?: string; hint?: string }[] = [
    { label: "Total mails", value: summary.total, hint: `${summary.manual} added manually` },
    { label: "Live", value: summary.live, color: "#059669" },
    { label: "Not live yet", value: summary.contentOnly, color: "#b45309", hint: "sender still in code" },
    { label: "Unedited from code", value: summary.unedited, color: "#6b7280" },
    { label: "Not reviewed", value: summary.notReviewed, color: "#6b7280" },
    { label: "Approved", value: summary.approved, color: "#059669" },
    { label: "Needs change", value: summary.needsChange, color: "#dc2626" },
    { label: "With findings", value: summary.withFindings, color: "#b91c1c" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))", gap: "10px", marginBottom: "16px" }}>
      {tiles.map((t) => (
        <div key={t.label} style={{ ...card, padding: "10px 12px" }}>
          <div style={{ ...eyebrow, fontSize: "0.68rem", whiteSpace: "nowrap", marginBottom: 0 }}>{t.label}</div>
          <div style={{ fontSize: "1.15rem", fontWeight: 700, color: t.color || "#111827", lineHeight: 1.3 }}>{t.value}</div>
          {t.hint && <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{t.hint}</div>}
        </div>
      ))}
    </div>
  );
};

// ── Filter bar ─────────────────────────────────────────────────────────────

const CatalogueFilters: FC<{
  filters: Filters;
  categories: string[];
  shown: number;
  total: number;
  onChange: (f: Filters) => void;
  onRefresh: () => void;
}> = ({ filters, categories, shown, total, onChange, onRefresh }) => {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  const dirty = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const sel: CSSProperties = { ...control, width: "auto", maxWidth: "180px" };
  return (
    <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
      <input className="form-control form-control-sm" style={{ ...control, maxWidth: "230px" }} placeholder="Search name, key or source…" value={filters.search} onChange={(e) => set("search", e.target.value)} />
      <select className="form-select form-select-sm" style={sel} value={filters.category} onChange={(e) => set("category", e.target.value)}>
        <option value="">All categories</option>
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select className="form-select form-select-sm" style={sel} value={filters.mailClass} onChange={(e) => set("mailClass", e.target.value)}>
        <option value="">Any class</option>
        <option value="TRANSACTIONAL">Transactional</option>
        <option value="SUBSCRIBED">Subscribed</option>
        <option value="INTERNAL">Internal</option>
        <option value={UNSET_CLASS}>Unset</option>
      </select>
      <select className="form-select form-select-sm" style={sel} value={filters.reviewStatus} onChange={(e) => set("reviewStatus", e.target.value)}>
        <option value="">Any review</option>
        {REVIEW_KEYS.map((k) => <option key={k} value={k}>{REVIEW_LABELS[k]}</option>)}
      </select>
      <select className="form-select form-select-sm" style={sel} value={filters.state} onChange={(e) => set("state", e.target.value as StateFilter)}>
        <option value="">Any state</option>
        <option value="live">Live</option>
        <option value="content-only">Not live (sender in code)</option>
        <option value="inactive">Inactive</option>
      </select>
      <div className="form-check form-check-inline m-0" style={{ fontSize: "0.82rem" }}>
        <input className="form-check-input" type="checkbox" id="mc-findings" checked={filters.hasFindings} onChange={(e) => set("hasFindings", e.target.checked)} />
        <label className="form-check-label" htmlFor="mc-findings">Has findings</label>
      </div>
      <div className="form-check form-check-inline m-0" style={{ fontSize: "0.82rem" }}>
        <input className="form-check-input" type="checkbox" id="mc-unedited" checked={filters.uneditedOnly} onChange={(e) => set("uneditedOnly", e.target.checked)} />
        <label className="form-check-label" htmlFor="mc-unedited">Unedited only</label>
      </div>
      <span className="ms-auto" style={{ fontSize: "0.8rem", color: "#6b7280" }}>
        {dirty ? `${shown} of ${total}` : shown} mail{total === 1 ? "" : "s"}
      </span>
      {dirty && (
        <button type="button" className="btn btn-sm btn-light" onClick={() => onChange(EMPTY_FILTERS)} style={{ borderRadius: "6px" }}>Clear</button>
      )}
      <button type="button" className="btn btn-sm btn-light" onClick={onRefresh} title="Refresh" style={{ borderRadius: "6px" }}>
        <i className="bi bi-arrow-clockwise"></i>
      </button>
    </div>
  );
};

// ── Cells ──────────────────────────────────────────────────────────────────

const StateBadge: FC<{ row: MailCatalogueRow }> = ({ row }) => {
  if (row.live) return <span style={pill("#059669", "#fff")}>Live</span>;
  if (row.portState === "CONTENT_ONLY") {
    return <span style={pill("#fef3c7", "#b45309", { whiteSpace: "normal" })} title="Ported from code for review. Its sender still builds this mail in Java.">Not live, sender still in code</span>;
  }
  if (!row.active) return <span style={pill("#f3f4f6", "#6b7280")}>Inactive</span>;
  return <span style={pill("#f3f4f6", "#374151")}>Not default</span>;
};

const EditedCell: FC<{ row: MailCatalogueRow }> = ({ row }) =>
  row.edited ? (
    <div>
      <span style={{ fontWeight: 600, color: "#111827" }}>Edited</span>
      <div style={{ fontSize: "0.72rem", color: "#6b7280", whiteSpace: "nowrap" }}>{formatDateTime(row.updatedAt)}</div>
    </div>
  ) : (
    <span style={{ color: "#9ca3af" }}>Unedited</span>
  );

const FindingsBadge: FC<{ findings: LintFinding[]; open: boolean; onToggle: () => void }> = ({ findings, open, onToggle }) => {
  if (findings.length === 0) return dash;
  const warn = findings.filter((f) => f.severity === "WARN").length;
  const info = findings.length - warn;
  return (
    <button type="button" onClick={onToggle} title={open ? "Hide findings" : "Show findings"} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 0, border: "none", background: "transparent", cursor: "pointer" }}>
      {warn > 0 && <span style={pill("#fee2e2", "#b91c1c")}>{warn} warn</span>}
      {info > 0 && <span style={pill("#f3f4f6", "#6b7280")}>{info} info</span>}
      <i className={`bi ${open ? "bi-chevron-up" : "bi-chevron-down"}`} style={{ fontSize: "0.7rem", color: "#9ca3af" }}></i>
    </button>
  );
};

const FindingsRow: FC<{ findings: LintFinding[] }> = ({ findings }) => (
  <tr>
    <td colSpan={COLUMNS.length} style={{ padding: "8px 12px 10px 24px", background: "#fffbeb", borderBottom: "1px solid #f3f4f6" }}>
      <div style={eyebrow}>Findings</div>
      {findings.map((f, i) => (
        <div key={`${f.code}-${i}`} className="d-flex align-items-start gap-2" style={{ fontSize: "0.82rem", marginBottom: 3 }}>
          <SeverityBadge severity={f.severity} />
          <code style={{ ...mono, color: "#4338ca", whiteSpace: "nowrap" }}>{f.code}</code>
          <span style={{ color: "#374151" }}>{f.message}</span>
        </div>
      ))}
    </td>
  </tr>
);

const NotesRow: FC<{ row: MailCatalogueRow; draft: string; busy: boolean; onDraft: (v: string) => void; onSave: () => void; onClose: () => void }> = ({ row, draft, busy, onDraft, onSave, onClose }) => (
  <tr>
    <td colSpan={COLUMNS.length} style={{ padding: "8px 12px 12px 24px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
      <div style={eyebrow}>
        Review notes
        {row.reviewedAt && <span style={{ textTransform: "none", letterSpacing: 0 }}> · last reviewed {formatDateTime(row.reviewedAt)}</span>}
      </div>
      <textarea className="form-control form-control-sm" style={{ ...control, minHeight: "72px", maxWidth: "720px" }} value={draft} onChange={(e) => onDraft(e.target.value)} placeholder="What is wrong with this mail, or what should change?" />
      <div className="d-flex gap-2 mt-2">
        <button type="button" className="btn btn-sm" style={primaryBtn} disabled={busy} onClick={onSave}>
          {busy ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check-lg me-1"></i>Save notes</>}
        </button>
        <button type="button" className="btn btn-sm btn-light" style={{ borderRadius: "6px" }} onClick={onClose}>Close</button>
      </div>
    </td>
  </tr>
);

const UnlistedSection: FC<{ items: MailCatalogueUnlisted[] }> = ({ items }) => (
  <div style={{ ...card, marginTop: "24px" }}>
    <div style={{ padding: "16px" }}>
      <div className="d-flex align-items-center mb-1">
        <i className="bi bi-eye-slash-fill me-2" style={{ color: "#4f46e5" }}></i>
        <span style={{ fontWeight: 700, color: "#111827" }}>Not shown here</span>
      </div>
      <p style={{ fontSize: "0.82rem", color: "#6b7280", marginBottom: items.length ? "10px" : 0 }}>
        {items.length ? "Mail the system sends that is not managed as a template, and why." : "Everything the system sends is listed above."}
      </p>
      {items.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem" }}>
          {items.map((u, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: "#111827" }}>{u.what}</span>
              <span style={{ color: "#6b7280" }}> — {u.why}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);

// ── Main ───────────────────────────────────────────────────────────────────

const MailCatalogue: FC = () => {
  const [data, setData] = useState<MailCatalogueData | null>(null);
  const [catalog, setCatalog] = useState<EmailTypeCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [notesOpenId, setNotesOpenId] = useState<number | null>(null);
  const [findingsOpenId, setFindingsOpenId] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setError(null);
      const [c, types] = await Promise.all([getMailCatalogue(), getEmailTypeCatalog()]);
      setData(c.data);
      setCatalog(types.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to load mail catalogue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.category).filter(Boolean))).sort(), [rows]);
  const filtered = useMemo(() => rows.filter((r) => matchesFilters(r, filters)), [rows, filters]);

  const currentNotes = (row: MailCatalogueRow) => notesDraft[row.id] ?? row.reviewNotes ?? "";

  const toggleNotes = (row: MailCatalogueRow) => {
    if (notesOpenId === row.id) {
      setNotesOpenId(null);
      return;
    }
    setNotesDraft((d) => ({ ...d, [row.id]: d[row.id] ?? row.reviewNotes ?? "" }));
    setNotesOpenId(row.id);
  };

  // Persist a review change for one row and patch it (plus the summary counts) in place.
  const saveReview = async (row: MailCatalogueRow, reviewStatus: EmailReviewStatus, notes: string): Promise<boolean> => {
    setBusyId(row.id);
    try {
      const { data: t } = await reviewEmailTemplate(row.id, { reviewStatus, reviewNotes: notes.trim() ? notes : null });
      const prev = row.reviewStatus;
      const next = t.reviewStatus ?? reviewStatus;
      setData((d) => {
        if (!d) return d;
        const summary = { ...d.summary };
        if (prev !== next) {
          summary[REVIEW_SUMMARY_KEY[prev]] -= 1;
          summary[REVIEW_SUMMARY_KEY[next]] += 1;
        }
        const patch: Partial<MailCatalogueRow> = {
          reviewStatus: next,
          reviewNotes: t.reviewNotes ?? (notes.trim() ? notes : null),
          reviewedBy: t.reviewedBy ?? row.reviewedBy,
          reviewedAt: t.reviewedAt ?? row.reviewedAt,
        };
        return { ...d, summary, rows: d.rows.map((r) => (r.id === row.id ? { ...r, ...patch } : r)) };
      });
      setNotesDraft((d) => ({ ...d, [row.id]: t.reviewNotes ?? notes }));
      showSuccessToast("Review saved");
      return true;
    } catch (err: any) {
      showErrorToast(err?.response?.data?.error || err?.message || "Failed to save review");
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const saveNotes = async (row: MailCatalogueRow) => {
    if (await saveReview(row, row.reviewStatus, currentNotes(row))) setNotesOpenId(null);
  };

  const openTemplate = async (row: MailCatalogueRow) => {
    setOpeningId(row.id);
    try {
      const { data: t } = await getEmailTemplate(row.id);
      setEditing(t);
      setShowEditor(true);
    } catch (err: any) {
      showErrorToast(err?.response?.data?.error || err?.message || "Failed to open template");
    } finally {
      setOpeningId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ ...card, padding: "48px", textAlign: "center" }}>
        <div className="spinner-border" style={{ color: "#4f46e5" }} role="status"></div>
        <p className="mt-3" style={{ color: "#6b7280" }}>Loading mail catalogue…</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "10px 14px", marginBottom: "16px", color: "#b91c1c", fontSize: "0.85rem" }} className="d-flex align-items-center">
          <i className="bi bi-exclamation-triangle-fill me-2"></i><span>{error}</span>
          <button type="button" className="btn btn-sm btn-light ms-auto" onClick={() => fetchAll()} style={{ borderRadius: "6px" }}>Retry</button>
        </div>
      )}

      {data && <SummaryStrip summary={data.summary} />}

      <div style={card}>
        <div style={{ padding: "16px" }}>
          <CatalogueFilters filters={filters} categories={categories} shown={filtered.length} total={rows.length} onChange={setFilters} onRefresh={() => fetchAll(true)} />

          {filtered.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-envelope-paper d-block mb-2" style={{ fontSize: "2rem", color: "#d1d5db" }}></i>
              <span style={{ color: "#6b7280" }}>{rows.length === 0 ? "No mails in the catalogue yet." : "No mails match these filters."}</span>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table table-hover align-middle mb-0" style={{ width: "100%", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                    {COLUMNS.map((h) => <th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const busy = busyId === row.id;
                    const reviewBorder = row.reviewStatus === "APPROVED" ? "#6ee7b7" : row.reviewStatus === "NEEDS_CHANGE" ? "#fca5a5" : "#d1d5db";
                    return (
                      <Fragment key={row.id}>
                        <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ ...td, minWidth: "200px" }}>
                            <div style={{ fontWeight: 600, color: "#111827" }}>{row.name}</div>
                            {row.mailKey && <div style={{ ...mono, color: "#6b7280" }}>{row.mailKey}</div>}
                            <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>{row.typeLabel}</div>
                          </td>
                          <td style={{ ...td, color: "#4b5563" }}>{row.category || dash}</td>
                          <td style={td}><MailClassBadge mailClass={row.mailClass} /></td>
                          <td style={td}><OriginBadge origin={row.seedOrigin} /></td>
                          <td style={td}>
                            {row.sourceRef
                              ? <code title={row.sourceRef} style={{ ...mono, color: "#4b5563", display: "inline-block", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>{row.sourceRef}</code>
                              : dash}
                          </td>
                          <td style={{ ...td, maxWidth: "150px" }}><StateBadge row={row} /></td>
                          <td style={td}><EditedCell row={row} /></td>
                          <td style={td}>
                            <div className="d-flex align-items-center gap-1">
                              <select
                                className="form-select form-select-sm"
                                style={{ ...control, width: "140px", fontSize: "0.8rem", borderColor: reviewBorder }}
                                value={row.reviewStatus}
                                disabled={busy}
                                onChange={(e) => saveReview(row, e.target.value as EmailReviewStatus, currentNotes(row))}
                              >
                                {REVIEW_KEYS.map((k) => <option key={k} value={k}>{REVIEW_LABELS[k]}</option>)}
                              </select>
                              <button
                                type="button"
                                className="btn btn-sm btn-light"
                                title={row.reviewNotes ? "Edit review notes" : "Add review notes"}
                                onClick={() => toggleNotes(row)}
                                style={{ borderRadius: "6px", color: row.reviewNotes ? "#4f46e5" : "#9ca3af" }}
                              >
                                <i className={`bi ${row.reviewNotes ? "bi-chat-left-text-fill" : "bi-chat-left-text"}`}></i>
                              </button>
                            </div>
                            {row.reviewedAt && <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: 2, whiteSpace: "nowrap" }}>reviewed {formatDateTime(row.reviewedAt)}</div>}
                          </td>
                          <td style={td}>
                            <FindingsBadge findings={row.findings} open={findingsOpenId === row.id} onToggle={() => setFindingsOpenId(findingsOpenId === row.id ? null : row.id)} />
                          </td>
                          <td style={td}>
                            <button className="btn btn-sm btn-light" onClick={() => openTemplate(row)} disabled={openingId === row.id} style={{ borderRadius: "6px", color: "#4f46e5", fontWeight: 600, whiteSpace: "nowrap" }}>
                              {openingId === row.id ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-box-arrow-up-right me-1"></i>Open</>}
                            </button>
                          </td>
                        </tr>
                        {notesOpenId === row.id && (
                          <NotesRow row={row} draft={currentNotes(row)} busy={busy} onDraft={(v) => setNotesDraft((d) => ({ ...d, [row.id]: v }))} onSave={() => saveNotes(row)} onClose={() => setNotesOpenId(null)} />
                        )}
                        {findingsOpenId === row.id && row.findings.length > 0 && <FindingsRow findings={row.findings} />}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {data && <UnlistedSection items={data.unlisted || []} />}

      <EmailTemplateEditorModal
        show={showEditor}
        onHide={() => { setShowEditor(false); setEditing(null); }}
        template={editing}
        catalog={catalog}
        onSaved={() => fetchAll(true)}
      />
    </>
  );
};

export default MailCatalogue;
