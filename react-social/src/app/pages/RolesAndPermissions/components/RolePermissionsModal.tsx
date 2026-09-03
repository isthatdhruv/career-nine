import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import { ActionIcon } from "../../../components/ActionIcon";
import permissionRoutesManifest from "../../../permissions-manifest.json";

const API_URL = process.env.REACT_APP_API_URL;

interface Permission {
  id: number;
  code: string;
  description: string;
}

/** Map from `permission code → ["GET /foo", ...]`. Backend endpoint coverage. */
type CodeToEndpoints = Record<string, string[]>;

/** Map from `permission code → ["/route", ...]`. FE route coverage. */
type CodeToRoutes = Record<string, string[]>;

interface CatalogPage {
  path: string;
  perm: string;
  title: string;
  group: string;
}

interface RoleTarget {
  id: number;
  name: string;
}

interface Props {
  show: boolean;
  onHide: () => void;
  /**
   * Single-Role mode (existing flow) or bulk mode. Both shapes accepted —
   * passing a single Role wraps it into a 1-element array internally.
   */
  role?: RoleTarget | null;
  roles?: RoleTarget[];
  /**
   * Optional pre-loaded code→endpoints map (from the parent's introspect call).
   * If not provided, the modal fetches it lazily on open.
   */
  codeToEndpoints?: CodeToEndpoints;
  /** Called after a successful save so the parent can refresh whatever it shows. */
  onSaved?: () => void;
}

/**
 * Manage Permissions — page-first.
 *
 * Step 1: pick the PAGES the role should reach (checkboxes over the
 * build-time route catalog). Checking a page selects its gating permission.
 * Step 2: for the selected pages only, fine-tune that page's permission
 * resource (sibling codes like report_template.create/update/...).
 * Advanced: everything else (backend-only codes with no FE route) lives in a
 * collapsed section — visible, searchable, but out of the way.
 *
 * No prefix-group select-alls, no react-select: plain checkboxes that toggle
 * on click. Saving still re-derives the role's URL whitelist from its
 * permission set (custom wildcard paths survive, see deriveUrls.ts).
 */
const RolePermissionsModal = ({
  show,
  onHide,
  role,
  roles,
  codeToEndpoints,
  onSaved,
}: Props) => {
  const targets: RoleTarget[] = useMemo(
    () => (roles && roles.length > 0 ? roles : role ? [role] : []),
    [role, roles]
  );
  const isBulk = targets.length > 1;

  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [endpointsMap, setEndpointsMap] = useState<CodeToEndpoints>(
    codeToEndpoints || {}
  );
  const [pageSearch, setPageSearch] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedSearch, setAdvancedSearch] = useState("");
  const [detailCode, setDetailCode] = useState<string | null>(null);

  // FE manifest (build-time generated) is a plain JSON import.
  const routesMap = permissionRoutesManifest as CodeToRoutes;

  // ── Page catalog from the manifest ────────────────────────────────────
  const pages: CatalogPage[] = useMemo(() => {
    const out: CatalogPage[] = [];
    for (const [perm, paths] of Object.entries(routesMap)) {
      for (const p of paths) {
        out.push({ path: p, perm, title: pageTitle(p), group: pageGroup(p) });
      }
    }
    return out.sort((a, b) =>
      a.group === b.group ? a.path.localeCompare(b.path) : a.group.localeCompare(b.group)
    );
  }, [routesMap]);

  const permPageCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pages) m.set(p.perm, (m.get(p.perm) || 0) + 1);
    return m;
  }, [pages]);

  useEffect(() => {
    if (!show || targets.length === 0) return;
    setLoading(true);
    setPageSearch("");
    setAdvancedSearch("");
    setAdvancedOpen(false);
    setDetailCode(null);

    const calls: Promise<any>[] = [
      axios.get<Permission[]>(`${API_URL}/permission/getAll`),
    ];

    // For single-Role mode: pre-tick the role's current permissions and pages.
    // For bulk mode: start with empty selection — admin's input is intentional.
    if (!isBulk) {
      calls.push(axios.get<string[]>(`${API_URL}/role/${targets[0].id}/permissions`));
      calls.push(axios.get<string[]>(`${API_URL}/role/${targets[0].id}/urls`));
    }

    // Fetch the backend endpoint coverage if the parent didn't supply it.
    if (!codeToEndpoints) {
      calls.push(axios.get(`${API_URL}/permission/introspect`));
    }

    Promise.all(calls)
      .then((results) => {
        const catalogRes = results[0];
        setCatalog(catalogRes.data || []);

        let codes = new Set<string>();
        let storedUrls: string[] = [];
        if (!isBulk) {
          codes = new Set<string>(results[1].data || []);
          storedUrls = results[2].data || [];
        }
        setSelectedCodes(codes);
        // The URL whitelist is the source of truth for page access — checked
        // pages mirror the stored whitelist, NOT the held permissions. A
        // shared permission (⚠) must never make a page look (or become)
        // granted when its URL was never whitelisted.
        const manifestPaths = new Set(pages.map((p) => p.path));
        setSelectedPages(new Set(storedUrls.filter((u) => manifestPaths.has(u))));

        if (!codeToEndpoints) {
          const introspectRes = results[results.length - 1];
          const map = (introspectRes?.data?.codeToEndpoints || {}) as CodeToEndpoints;
          setEndpointsMap(map);
        }
      })
      .catch(() => {
        setCatalog([]);
        setSelectedCodes(new Set());
        setSelectedPages(new Set());
        showErrorToast("Failed to load permissions");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, targets, isBulk, codeToEndpoints]);

  // ── Step 1: page toggles ──────────────────────────────────────────────
  const togglePage = (page: CatalogPage) => {
    const nextPages = new Set(selectedPages);
    const nextCodes = new Set(selectedCodes);
    if (nextPages.has(page.path)) {
      nextPages.delete(page.path);
      const stillNeeded = pages.some(
        (p) => p.perm === page.perm && nextPages.has(p.path)
      );
      if (!stillNeeded) nextCodes.delete(page.perm);
    } else {
      nextPages.add(page.path);
      nextCodes.add(page.perm);
    }
    setSelectedPages(nextPages);
    setSelectedCodes(nextCodes);
  };

  const toggleCode = (code: string) => {
    const next = new Set(selectedCodes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedCodes(next);
  };

  // Gating perms of the currently selected pages are locked on.
  const lockedPerms = useMemo(
    () => new Set(pages.filter((p) => selectedPages.has(p.path)).map((p) => p.perm)),
    [pages, selectedPages]
  );

  // ── Step 2: resource blocks for the selected pages ────────────────────
  const resourceBlocks = useMemo(() => {
    const blocks = new Map<string, { pages: CatalogPage[]; codes: Permission[] }>();
    for (const page of pages) {
      if (!selectedPages.has(page.path)) continue;
      const resource = resourceOf(page.perm);
      if (!blocks.has(resource)) {
        blocks.set(resource, {
          pages: [],
          codes: catalog
            .filter((c) => resourceOf(c.code) === resource)
            .sort((a, b) => a.code.localeCompare(b.code)),
        });
      }
      blocks.get(resource)!.pages.push(page);
    }
    return Array.from(blocks.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [pages, selectedPages, catalog]);

  const shownCodes = useMemo(() => {
    const s = new Set<string>();
    for (const [, block] of resourceBlocks) for (const c of block.codes) s.add(c.code);
    return s;
  }, [resourceBlocks]);

  // ── Advanced: everything not covered by a selected page's resource ────
  const advancedCodes = useMemo(
    () =>
      catalog
        .filter((c) => !shownCodes.has(c.code))
        .sort((a, b) => a.code.localeCompare(b.code)),
    [catalog, shownCodes]
  );
  const advancedSelectedCount = useMemo(
    () => advancedCodes.filter((c) => selectedCodes.has(c.code)).length,
    [advancedCodes, selectedCodes]
  );

  // Save the role's permission set, then write the URL whitelist as EXACTLY
  // the checked pages (plus the role's existing custom wildcard paths, which
  // live outside the catalog). Deliberately NO perm→URL derivation: when one
  // permission gates several routes, only the pages the admin actually
  // checked become reachable — the perm+URL intersection in RequirePermission
  // keeps the rest blocked.
  const savePermissionsAndPages = async (roleId: number, codes: string[]) => {
    await axios.put(`${API_URL}/role/${roleId}/permissions`, { codes });
    try {
      const manifestPaths = new Set(pages.map((p) => p.path));
      let custom: string[] = [];
      try {
        const current = await axios.get<string[]>(`${API_URL}/role/${roleId}/urls`);
        custom = (current.data || []).filter((u) => !manifestPaths.has(u));
      } catch {
        /* no stored urls readable — save the checked pages alone */
      }
      const paths = Array.from(new Set([...Array.from(selectedPages), ...custom])).sort();
      await axios.put(`${API_URL}/role/${roleId}/urls`, { paths });
    } catch (e) {
      showErrorToast("Permissions saved, but the page whitelist update failed — check Page Access");
    }
  };

  const handleSave = async () => {
    if (targets.length === 0) return;
    setSaving(true);
    // Invariant: every checked page carries its gating permission.
    const codesSet = new Set(selectedCodes);
    for (const p of pages) {
      if (selectedPages.has(p.path)) codesSet.add(p.perm);
    }
    const codes = Array.from(codesSet);

    try {
      const results = await Promise.allSettled(
        targets.map((t) => savePermissionsAndPages(t.id, codes))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === 0) {
        showSuccessToast(
          isBulk
            ? `Permissions updated on ${targets.length} roles`
            : "Permissions updated successfully"
        );
        onSaved?.();
        onHide();
      } else if (failed < targets.length) {
        showErrorToast(
          `${failed} of ${targets.length} roles failed; the rest were updated`
        );
        onSaved?.();
      } else {
        showErrorToast("Failed to update permissions");
      }
    } catch {
      showErrorToast("Failed to update permissions");
    } finally {
      setSaving(false);
    }
  };

  if (!show || targets.length === 0) return null;

  const pq = pageSearch.trim().toLowerCase();
  const visiblePages = pq
    ? pages.filter(
        (p) =>
          p.path.toLowerCase().includes(pq) ||
          p.title.toLowerCase().includes(pq) ||
          p.perm.toLowerCase().includes(pq)
      )
    : pages;
  const groupedPages: { group: string; items: CatalogPage[] }[] = [];
  for (const p of visiblePages) {
    const last = groupedPages[groupedPages.length - 1];
    if (last && last.group === p.group) last.items.push(p);
    else groupedPages.push({ group: p.group, items: [p] });
  }

  const aq = advancedSearch.trim().toLowerCase();
  const visibleAdvanced = aq
    ? advancedCodes.filter(
        (c) =>
          c.code.toLowerCase().includes(aq) ||
          (c.description || "").toLowerCase().includes(aq)
      )
    : advancedCodes;

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
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
          padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <h6 className="mb-0 text-white fw-bold" style={{ fontSize: "1rem" }}>
              <i className="bi bi-key-fill me-2"></i>
              {isBulk ? `Manage Permissions — ${targets.length} roles` : "Manage Permissions"}
            </h6>
            <p className="mb-0 text-white" style={{ fontSize: "0.82rem", opacity: 0.85 }}>
              {isBulk
                ? targets.map((t) => t.name).join(", ")
                : targets[0].name}
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
              {isBulk && (
                <p style={{ fontSize: "0.78rem", color: "#dc2626", marginBottom: "0.5rem" }}>
                  Bulk mode: saving will <strong>replace</strong> the permission
                  set on all {targets.length} selected roles.
                </p>
              )}

              {/* ── STEP 1: pages ── */}
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                1 · Pages this role can open
              </div>
              <p style={{ fontSize: "0.74rem", color: "#6b7280", marginBottom: 8 }}>
                Checking a page selects its gating permission. Only checked
                pages are whitelisted — a ⚠ permission is shared by several
                pages, but the unchecked ones stay blocked by the URL gate.
              </p>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search pages…"
                value={pageSearch}
                onChange={(e) => setPageSearch(e.target.value)}
                style={{ borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.85rem", marginBottom: 8 }}
              />
              <div style={{
                maxHeight: 260, overflowY: "auto",
                border: "1px solid #f1f5f9", borderRadius: 10, padding: "6px 10px",
              }}>
                {groupedPages.map(({ group, items }) => (
                  <div key={group} style={{ marginBottom: 6 }}>
                    <div style={{
                      fontSize: "0.7rem", fontWeight: 700, color: "#9ca3af",
                      textTransform: "uppercase", letterSpacing: "0.5px", padding: "4px 0",
                    }}>
                      {group}
                    </div>
                    {items.map((page) => {
                      const checked = selectedPages.has(page.path);
                      const shared = (permPageCount.get(page.perm) || 1) > 1;
                      return (
                        <label
                          key={page.path}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "5px 6px", borderRadius: 8, cursor: "pointer",
                            background: checked ? "#eff6ff" : "transparent",
                          }}
                        >
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={checked}
                            onChange={() => togglePage(page)}
                            style={{ marginTop: 0, flexShrink: 0, cursor: "pointer" }}
                          />
                          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#111827", flexShrink: 0 }}>
                            {page.title}
                          </span>
                          <span style={{
                            fontFamily: "monospace", fontSize: "0.72rem", color: "#6b7280",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                          }}>
                            {page.path}
                          </span>
                          <span
                            title={
                              shared
                                ? `Also gates ${(permPageCount.get(page.perm) || 1) - 1} other page(s)`
                                : "Permission gating this page"
                            }
                            style={{
                              fontSize: "0.66rem", fontWeight: 600, fontFamily: "monospace",
                              padding: "2px 8px", borderRadius: 999, flexShrink: 0,
                              background: shared ? "#fef3c7" : "#e0f2fe",
                              color: shared ? "#92400e" : "#075985",
                            }}
                          >
                            {page.perm}{shared ? " ⚠" : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ))}
                {visiblePages.length === 0 && (
                  <div style={{ color: "#9ca3af", fontSize: "0.82rem", padding: "8px 0" }}>
                    No pages match "{pageSearch}".
                  </div>
                )}
              </div>

              {/* ── STEP 2: permissions of the selected pages ── */}
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#111827", margin: "16px 0 4px" }}>
                2 · Permissions for the selected pages
              </div>
              {resourceBlocks.length === 0 ? (
                <p style={{ fontSize: "0.76rem", color: "#9ca3af" }}>
                  Select a page above to set its permissions.
                </p>
              ) : (
                resourceBlocks.map(([resource, block]) => (
                  <div
                    key={resource}
                    style={{
                      border: "1px solid #e0f2fe", background: "#f8fdff",
                      borderRadius: 10, padding: "8px 12px", marginBottom: 8,
                    }}
                  >
                    <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#075985", marginBottom: 6 }}>
                      {prettifyGroupName(resource)}{" "}
                      <span style={{ fontWeight: 400, color: "#6b7280" }}>
                        — {block.pages.map((p) => p.title).join(", ")}
                      </span>
                    </div>
                    {block.codes.map((c) => {
                      const locked = lockedPerms.has(c.code);
                      return (
                        <label
                          key={c.code}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            fontSize: "0.78rem", marginBottom: 4,
                            cursor: locked ? "default" : "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={locked || selectedCodes.has(c.code)}
                            disabled={locked}
                            onChange={() => toggleCode(c.code)}
                            style={{ marginTop: 0, flexShrink: 0 }}
                          />
                          <code style={{ fontSize: "0.74rem" }}>{c.code}</code>
                          {locked && (
                            <span style={{ color: "#9ca3af", fontSize: "0.68rem" }}>
                              required by page
                            </span>
                          )}
                          {c.description && (
                            <span style={{ color: "#6b7280", fontSize: "0.72rem" }}>
                              {c.description}
                            </span>
                          )}
                          <CoverageBadges
                            code={c.code}
                            routes={routesMap[c.code] || []}
                            endpoints={endpointsMap[c.code] || []}
                            detailCode={detailCode}
                            setDetailCode={setDetailCode}
                          />
                        </label>
                      );
                    })}
                  </div>
                ))
              )}

              {/* ── Advanced: everything else ── */}
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                style={{
                  background: "transparent", border: "none", padding: 0,
                  color: "#2563eb", fontSize: "0.78rem", fontWeight: 700,
                  cursor: "pointer", marginTop: 8,
                }}
              >
                {advancedOpen ? "▾" : "▸"} Advanced — other permissions
                ({advancedSelectedCount} of {advancedCodes.length} selected)
              </button>
              {advancedOpen && (
                <div style={{ marginTop: 6 }}>
                  <p style={{ fontSize: "0.72rem", color: "#6b7280", marginBottom: 6 }}>
                    Backend-only codes and resources not tied to the selected
                    pages. Toggle individually — there is no select-all.
                  </p>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Search permissions…"
                    value={advancedSearch}
                    onChange={(e) => setAdvancedSearch(e.target.value)}
                    style={{ borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.82rem", marginBottom: 6 }}
                  />
                  <div style={{
                    maxHeight: 220, overflowY: "auto",
                    border: "1px solid #f1f5f9", borderRadius: 10, padding: "6px 10px",
                  }}>
                    {visibleAdvanced.map((c) => (
                      <label
                        key={c.code}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          fontSize: "0.78rem", marginBottom: 4, cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selectedCodes.has(c.code)}
                          onChange={() => toggleCode(c.code)}
                          style={{ marginTop: 0, flexShrink: 0 }}
                        />
                        <code style={{ fontSize: "0.74rem" }}>{c.code}</code>
                        {c.description && (
                          <span style={{ color: "#6b7280", fontSize: "0.72rem" }}>
                            {c.description}
                          </span>
                        )}
                        <CoverageBadges
                          code={c.code}
                          routes={routesMap[c.code] || []}
                          endpoints={endpointsMap[c.code] || []}
                          detailCode={detailCode}
                          setDetailCode={setDetailCode}
                        />
                      </label>
                    ))}
                    {visibleAdvanced.length === 0 && (
                      <div style={{ color: "#9ca3af", fontSize: "0.8rem", padding: "6px 0" }}>
                        No permissions match.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {detailCode && (
                <CoverageDetail
                  code={detailCode}
                  routes={routesMap[detailCode] || []}
                  endpoints={endpointsMap[detailCode] || []}
                  onClose={() => setDetailCode(null)}
                />
              )}
            </>
          )}
        </div>

        <div style={{
          padding: "0.75rem 1.5rem", borderTop: "1px solid #f3f4f6",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px",
        }}>
          <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
            {selectedPages.size} page{selectedPages.size === 1 ? "" : "s"} ·{" "}
            {selectedCodes.size} of {catalog.length} permissions selected
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm btn-light" onClick={onHide} style={{ borderRadius: "6px" }}>Cancel</button>
            <button
              className="btn btn-sm"
              onClick={handleSave}
              disabled={saving || loading}
              style={{
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, padding: "6px 16px",
              }}
            >
              {saving ? (
                <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>
              ) : (
                <>
                  <ActionIcon type="approve" size="sm" className="me-1" />
                  {isBulk ? `Save to ${targets.length} roles` : "Save"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Coverage badges + shared detail panel ────────────────────────────────────
interface CoverageBadgesProps {
  code: string;
  routes: string[];
  endpoints: string[];
  detailCode: string | null;
  setDetailCode: (c: string | null) => void;
}
const CoverageBadges = ({ code, routes, endpoints, detailCode, setDetailCode }: CoverageBadgesProps) => {
  const total = routes.length + endpoints.length;
  if (total === 0) return null;
  const open = detailCode === code;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto", flexShrink: 0 }}>
      {routes.length > 0 && (
        <span style={badgeStyle("#dbeafe", "#1e40af")}>
          {routes.length} route{routes.length === 1 ? "" : "s"}
        </span>
      )}
      {endpoints.length > 0 && (
        <span style={badgeStyle("#fef3c7", "#92400e")}>
          {endpoints.length} endpoint{endpoints.length === 1 ? "" : "s"}
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDetailCode(open ? null : code);
        }}
        style={{
          background: "transparent", border: "none", color: "#2563eb",
          fontSize: "0.7rem", padding: 0, cursor: "pointer",
        }}
      >
        {open ? "hide" : "show"}
      </button>
    </span>
  );
};

interface CoverageDetailProps {
  code: string;
  routes: string[];
  endpoints: string[];
  onClose: () => void;
}
const CoverageDetail = ({ code, routes, endpoints, onClose }: CoverageDetailProps) => (
  <div style={{
    marginTop: 10, padding: "8px 12px", borderRadius: 10,
    border: "1px solid #e5e7eb", background: "#f9fafb",
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <code style={{ fontSize: "0.76rem", fontWeight: 700 }}>{code}</code>
      <button
        type="button"
        onClick={onClose}
        style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "0.8rem" }}
      >
        ×
      </button>
    </div>
    {routes.length > 0 && (
      <div style={{ fontSize: "0.74rem", color: "#1e40af", marginBottom: 4 }}>
        <span style={{ fontWeight: 700 }}>FE routes:</span>{" "}
        <span style={{ fontFamily: "monospace" }}>{routes.join(", ")}</span>
      </div>
    )}
    {endpoints.length > 0 && (
      <div style={{ fontSize: "0.74rem", color: "#92400e" }}>
        <span style={{ fontWeight: 700 }}>BE endpoints:</span>{" "}
        <span style={{ fontFamily: "monospace" }}>{endpoints.join(", ")}</span>
      </div>
    )}
  </div>
);

const badgeStyle = (bg: string, fg: string): React.CSSProperties => ({
  fontSize: "0.66rem",
  fontWeight: 600,
  padding: "1px 7px",
  borderRadius: 999,
  background: bg,
  color: fg,
  whiteSpace: "nowrap",
});

// ── helpers ──────────────────────────────────────────────────────────────────

/** "report_template.read" → "report_template"; "dashboard.school.release" → "dashboard.school" */
function resourceOf(code: string): string {
  const i = code.lastIndexOf(".");
  return i > 0 ? code.slice(0, i) : code;
}

function humanize(seg: string): string {
  return seg.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function pageTitle(path: string): string {
  const segs = path.split("/").filter((s) => s && !s.startsWith(":") && s !== "*");
  if (segs.length === 0) return path;
  return segs.map(humanize).join(" ");
}

function pageGroup(path: string): string {
  const seg = path.split("/").filter(Boolean)[0] || "(root)";
  return humanize(seg);
}

function prettifyGroupName(g: string): string {
  if (g === "(other)") return "(other)";
  return g
    .split(/[._]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export default RolePermissionsModal;
