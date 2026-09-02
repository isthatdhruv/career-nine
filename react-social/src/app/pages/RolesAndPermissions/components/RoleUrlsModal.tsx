import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import { ActionIcon } from "../../../components/ActionIcon";
import permissionRoutesManifest from "../../../permissions-manifest.json";

const API_URL = process.env.REACT_APP_API_URL;

type CodeToRoutes = Record<string, string[]>;

interface CatalogPage {
  path: string;   // route path exactly as registered
  perm: string;   // the ONE permission gating this route
  title: string;  // humanized display name
  group: string;  // display group (first path segment) — display only, no bundling
}

interface PermissionRow {
  code: string;
  description?: string | null;
}

interface Props {
  show: boolean;
  onHide: () => void;
  role: { id: number; name: string } | null;
  onSaved?: () => void;
}

/**
 * Page Access — THE single page catalog for a role.
 *
 * One checkbox per page route. The catalog is auto-populated from
 * permissions-manifest.json, which `npm run gen:perms` (wired into
 * prestart/prebuild) regenerates from PrivateRoutes.tsx — so a new
 * <Route path=".." element={<RequirePermission perm="..">..} appears here on
 * the next dev-server start with zero manual seeding.
 *
 * Checking a page grants BOTH sides of the route gate in one act:
 *   - the page URL into the role's whitelist (role_url), and
 *   - the page's gating permission (role_permission).
 * Expanding a checked page shows ONLY that page's permission resource
 * (sibling codes of the gating permission, e.g. report_template.*) so each
 * page's action permissions are set right there — no prefix-group
 * select-alls, no cross-page bundling, no silent expansion.
 *
 * When one permission gates several routes (e.g. a wizard's steps), the row
 * says so explicitly — that sharing is a property of the permission scheme
 * and is surfaced, never hidden.
 */
const RoleUrlsModal = ({ show, onHide, role, onSaved }: Props) => {
  const manifest = permissionRoutesManifest as CodeToRoutes;

  // ── Catalog (derived from the generated manifest — single source of truth)
  const pages: CatalogPage[] = useMemo(() => {
    const out: CatalogPage[] = [];
    for (const [perm, paths] of Object.entries(manifest)) {
      for (const p of paths) {
        out.push({ path: p, perm, title: pageTitle(p), group: pageGroup(p) });
      }
    }
    return out.sort((a, b) =>
      a.group === b.group ? a.path.localeCompare(b.path) : a.group.localeCompare(b.group)
    );
  }, [manifest]);

  const catalogPathSet = useMemo(() => new Set(pages.map((p) => p.path)), [pages]);

  // How many catalog pages share each gating permission (to surface sharing).
  const permPageCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pages) m.set(p.perm, (m.get(p.perm) || 0) + 1);
    return m;
  }, [pages]);

  // ── State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [initialPaths, setInitialPaths] = useState<Set<string>>(new Set());
  const [rolePerms, setRolePerms] = useState<Set<string>>(new Set());
  const [permCatalog, setPermCatalog] = useState<PermissionRow[]>([]);
  // Explicit sibling-permission toggles made in this session (code → on/off).
  const [permOverrides, setPermOverrides] = useState<Record<string, boolean>>({});
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [customError, setCustomError] = useState("");

  useEffect(() => {
    if (!show || !role) return;
    setLoading(true);
    setSearch("");
    setCustomInput("");
    setCustomError("");
    setPermOverrides({});
    setExpandedPath(null);
    Promise.all([
      axios.get<string[]>(`${API_URL}/role/${role.id}/urls`),
      axios.get<string[]>(`${API_URL}/role/${role.id}/permissions`),
      axios.get<PermissionRow[]>(`${API_URL}/permission/getAll`),
    ])
      .then(([urlsRes, permsRes, catRes]) => {
        const paths = new Set(urlsRes.data || []);
        setSelectedPaths(paths);
        setInitialPaths(new Set(paths));
        setRolePerms(new Set(permsRes.data || []));
        setPermCatalog(catRes.data || []);
      })
      .catch(() => {
        setSelectedPaths(new Set());
        setInitialPaths(new Set());
        setRolePerms(new Set());
        setPermCatalog([]);
        showErrorToast("Failed to load role access");
      })
      .finally(() => setLoading(false));
  }, [show, role]);

  const customPaths = useMemo(
    () => Array.from(selectedPaths).filter((p) => !catalogPathSet.has(p)).sort(),
    [selectedPaths, catalogPathSet]
  );

  const isPermOn = (code: string): boolean =>
    permOverrides[code] !== undefined ? permOverrides[code] : rolePerms.has(code);

  // Sibling permissions of a page = catalog codes sharing the gating
  // permission's resource (code minus its last segment). Only these are shown
  // on the page row — "that page's permissions and that only".
  const siblingsOf = (perm: string): PermissionRow[] => {
    const resource = resourceOf(perm);
    return permCatalog
      .filter((p) => p.code !== perm && resourceOf(p.code) === resource)
      .sort((a, b) => a.code.localeCompare(b.code));
  };

  const togglePage = (page: CatalogPage) => {
    const next = new Set(selectedPaths);
    if (next.has(page.path)) {
      next.delete(page.path);
      if (expandedPath === page.path) setExpandedPath(null);
    } else {
      next.add(page.path);
    }
    setSelectedPaths(next);
  };

  const handleAddCustom = () => {
    const v = customInput.trim();
    setCustomError("");
    if (!v) return;
    if (!v.startsWith("/")) {
      setCustomError("Path must start with '/'");
      return;
    }
    if (selectedPaths.has(v)) {
      setCustomError("Already added");
      return;
    }
    const next = new Set(selectedPaths);
    next.add(v);
    setSelectedPaths(next);
    setCustomInput("");
  };

  const handleRemovePath = (p: string) => {
    const next = new Set(selectedPaths);
    next.delete(p);
    setSelectedPaths(next);
  };

  // Final permission codes: role's current codes, plus this session's explicit
  // sibling toggles, with gating perms following the page checkboxes —
  // added for every checked page; removed only when a page that WAS checked
  // got unchecked and no still-checked page needs that perm. Codes not
  // touched by any of the above pass through untouched (backend-only grants
  // made in the advanced Permissions modal are never silently revoked here).
  const computeFinalCodes = (): string[] => {
    const final = new Set(rolePerms);
    for (const [code, on] of Object.entries(permOverrides)) {
      if (on) final.add(code);
      else final.delete(code);
    }
    const requiredPerms = new Set(
      pages.filter((p) => selectedPaths.has(p.path)).map((p) => p.perm)
    );
    for (const perm of Array.from(requiredPerms)) final.add(perm);
    for (const page of pages) {
      if (
        !selectedPaths.has(page.path) &&
        initialPaths.has(page.path) &&
        !requiredPerms.has(page.perm)
      ) {
        final.delete(page.perm);
      }
    }
    return Array.from(final).sort();
  };

  const handleSave = async () => {
    if (!role) return;
    setSaving(true);
    try {
      await axios.put(`${API_URL}/role/${role.id}/urls`, {
        paths: Array.from(selectedPaths),
      });
      await axios.put(`${API_URL}/role/${role.id}/permissions`, {
        codes: computeFinalCodes(),
      });
      showSuccessToast(`Page access updated for ${role.name}`);
      onSaved?.();
      onHide();
    } catch {
      showErrorToast("Failed to update page access");
    } finally {
      setSaving(false);
    }
  };

  if (!show || !role) return null;

  const q = search.trim().toLowerCase();
  const visiblePages = q
    ? pages.filter(
        (p) =>
          p.path.toLowerCase().includes(q) ||
          p.title.toLowerCase().includes(q) ||
          p.perm.toLowerCase().includes(q)
      )
    : pages;

  // Display grouping only — a group header carries no toggle on purpose.
  const groupedPages: { group: string; items: CatalogPage[] }[] = [];
  for (const p of visiblePages) {
    const last = groupedPages[groupedPages.length - 1];
    if (last && last.group === p.group) last.items.push(p);
    else groupedPages.push({ group: p.group, items: [p] });
  }

  const checkedCount = pages.filter((p) => selectedPaths.has(p.path)).length;

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 9999,
      }}
      onClick={onHide}
    >
      <div
        style={{
          backgroundColor: "#fff", borderRadius: "16px", maxWidth: "860px",
          width: "94%", maxHeight: "88vh", display: "flex", flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          background: "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)",
          padding: "1rem 1.5rem", display: "flex",
          justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <h6 className="mb-0 text-white fw-bold" style={{ fontSize: "1rem" }}>
              <i className="bi bi-columns-gap me-2"></i>Page Access
            </h6>
            <p className="mb-0 text-white" style={{ fontSize: "0.82rem", opacity: 0.85 }}>
              {role.name} — check a page to grant its URL + its permission together
            </p>
          </div>
          <button type="button" className="btn-close btn-close-white" onClick={onHide}></button>
        </div>

        <div style={{ padding: "1rem 1.5rem", overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border spinner-border-sm text-primary"></div>
              <span className="ms-2 text-muted">Loading...</span>
            </div>
          ) : (
            <>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search pages, paths or permissions…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  borderRadius: 8, border: "1px solid #d1d5db",
                  fontSize: "0.85rem", marginBottom: 12,
                }}
              />

              {groupedPages.map(({ group, items }) => (
                <div key={group} style={{ marginBottom: 10 }}>
                  <div style={{
                    fontSize: "0.72rem", fontWeight: 700, color: "#6b7280",
                    textTransform: "uppercase", letterSpacing: "0.5px",
                    padding: "6px 2px",
                  }}>
                    {group}
                  </div>
                  {items.map((page) => {
                    const checked = selectedPaths.has(page.path);
                    const expanded = expandedPath === page.path;
                    const shared = (permPageCount.get(page.perm) || 1) > 1;
                    const siblings = expanded ? siblingsOf(page.perm) : [];
                    return (
                      <div
                        key={page.path}
                        style={{
                          border: `1px solid ${checked ? "#a5f3fc" : "#f1f5f9"}`,
                          background: checked ? "#f0fdff" : "#fff",
                          borderRadius: 10, marginBottom: 6,
                        }}
                      >
                        <div style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 12px",
                        }}>
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={checked}
                            onChange={() => togglePage(page)}
                            style={{ cursor: "pointer", flexShrink: 0, marginTop: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>
                              {page.title}
                            </div>
                            <div style={{
                              fontFamily: "monospace", fontSize: "0.74rem",
                              color: "#6b7280", overflow: "hidden",
                              textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {page.path}
                            </div>
                          </div>
                          <span
                            title={
                              shared
                                ? `This permission also gates ${(permPageCount.get(page.perm) || 1) - 1} other page(s) — granting it here unlocks those too`
                                : "Permission gating this page"
                            }
                            style={{
                              fontSize: "0.68rem", fontWeight: 600,
                              padding: "2px 8px", borderRadius: 999, flexShrink: 0,
                              background: shared ? "#fef3c7" : "#e0f2fe",
                              color: shared ? "#92400e" : "#075985",
                              fontFamily: "monospace",
                            }}
                          >
                            {page.perm}{shared ? " ⚠" : ""}
                          </span>
                          {checked && (
                            <button
                              type="button"
                              onClick={() => setExpandedPath(expanded ? null : page.path)}
                              title="Set this page's permissions"
                              style={{
                                background: "transparent", border: "none",
                                color: "#0891b2", cursor: "pointer",
                                fontSize: "0.78rem", fontWeight: 600,
                                flexShrink: 0, whiteSpace: "nowrap",
                              }}
                            >
                              {expanded ? "Hide perms ▲" : "Page perms ▼"}
                            </button>
                          )}
                        </div>

                        {checked && expanded && (
                          <div style={{
                            borderTop: "1px dashed #bae6fd",
                            padding: "8px 12px 10px 34px",
                          }}>
                            <div style={{
                              display: "flex", alignItems: "center", gap: 8,
                              fontSize: "0.78rem", marginBottom: 6,
                            }}>
                              <input type="checkbox" className="form-check-input" checked disabled style={{ marginTop: 0 }} />
                              <code style={{ fontSize: "0.74rem" }}>{page.perm}</code>
                              <span style={{ color: "#9ca3af", fontSize: "0.7rem" }}>
                                required — granted with the page
                              </span>
                            </div>
                            {siblings.length === 0 ? (
                              <div style={{ fontSize: "0.74rem", color: "#9ca3af" }}>
                                No other permissions exist for this page's resource.
                              </div>
                            ) : (
                              siblings.map((s) => (
                                <label
                                  key={s.code}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 8,
                                    fontSize: "0.78rem", marginBottom: 4,
                                    cursor: "pointer",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={isPermOn(s.code)}
                                    onChange={() =>
                                      setPermOverrides((prev) => ({
                                        ...prev,
                                        [s.code]: !isPermOn(s.code),
                                      }))
                                    }
                                    style={{ marginTop: 0 }}
                                  />
                                  <code style={{ fontSize: "0.74rem" }}>{s.code}</code>
                                  {s.description && (
                                    <span style={{ color: "#6b7280", fontSize: "0.72rem" }}>
                                      {s.description}
                                    </span>
                                  )}
                                </label>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {visiblePages.length === 0 && (
                <div style={{ color: "#9ca3af", fontSize: "0.85rem", padding: "12px 0" }}>
                  No pages match "{search}".
                </div>
              )}

              <div style={{ marginTop: "1rem" }}>
                <label className="form-label fw-bold" style={{ fontSize: "0.85rem" }}>
                  Custom path
                </label>
                <p style={{ fontSize: "0.74rem", color: "#6b7280", marginTop: -4 }}>
                  Escape hatch — for wildcards or paths the catalog doesn't list.
                  Example: <code>/students/*</code>, <code>/dashboard/school/:id</code>.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="/some/custom/:path"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustom();
                      }
                    }}
                    style={{ borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.85rem", fontFamily: "monospace" }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleAddCustom}
                    disabled={!customInput.trim()}
                    style={{
                      background: "#0891b2", color: "#fff", border: "none",
                      borderRadius: "6px", padding: "6px 14px", fontWeight: 600, fontSize: "0.82rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Add
                  </button>
                </div>
                {customError && (
                  <div style={{ color: "#dc2626", fontSize: "0.78rem", marginTop: 4 }}>
                    {customError}
                  </div>
                )}

                {customPaths.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                      Custom paths ({customPaths.length})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {customPaths.map((p) => (
                        <span
                          key={p}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            background: "#e0f2fe", border: "1px solid #7dd3fc",
                            color: "#075985", borderRadius: 999,
                            padding: "2px 10px", fontSize: "0.78rem",
                            fontFamily: "monospace",
                          }}
                        >
                          {p}
                          <button
                            type="button"
                            onClick={() => handleRemovePath(p)}
                            style={{
                              background: "transparent", border: "none",
                              color: "#075985", cursor: "pointer", padding: 0,
                              fontSize: "0.9rem", lineHeight: 1,
                            }}
                            title="Remove"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div style={{
          padding: "0.75rem 1.5rem", borderTop: "1px solid #f3f4f6",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px",
        }}>
          <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
            {checkedCount} page{checkedCount === 1 ? "" : "s"}
            {customPaths.length > 0 ? ` + ${customPaths.length} custom` : ""} selected
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm btn-light" onClick={onHide} style={{ borderRadius: "6px" }}>Cancel</button>
            <button
              className="btn btn-sm"
              onClick={handleSave}
              disabled={saving || loading}
              style={{
                background: "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)",
                color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, padding: "6px 16px",
              }}
            >
              {saving ? (
                <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>
              ) : (
                <><ActionIcon type="approve" size="sm" className="me-1" />Save</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── helpers ──────────────────────────────────────────────────────────────────

/** "report_template.read" → "report_template"; "dashboard.school.release" → "dashboard.school" */
function resourceOf(code: string): string {
  const i = code.lastIndexOf(".");
  return i > 0 ? code.slice(0, i) : code;
}

function humanize(seg: string): string {
  return seg
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "/admin/report-templates" → "Report Templates"; "/assessments/create/step-2" → "Assessments Create Step 2" */
function pageTitle(path: string): string {
  const segs = path
    .split("/")
    .filter((s) => s && !s.startsWith(":") && s !== "*");
  if (segs.length === 0) return path;
  return segs.map(humanize).join(" ");
}

function pageGroup(path: string): string {
  const seg = path.split("/").filter(Boolean)[0] || "(root)";
  return humanize(seg);
}

export default RoleUrlsModal;
