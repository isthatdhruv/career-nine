import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Select, { GroupBase } from "react-select";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import { ActionIcon } from "../../../components/ActionIcon";
import permissionRoutesManifest from "../../../permissions-manifest.json";

const API_URL = process.env.REACT_APP_API_URL;

type CodeToRoutes = Record<string, string[]>;

interface RouteOption {
  label: string;          // displayed path
  value: string;          // the path itself
  perm: string;           // the permission code this route is gated by
}

interface Props {
  show: boolean;
  onHide: () => void;
  role: { id: number; name: string } | null;
  onSaved?: () => void;
}

/**
 * URL whitelist editor for a single role. Admin picks paths primarily from
 * the build-time-generated route catalog (permissions-manifest.json), with
 * an escape hatch for typing custom paths (wildcards/dynamic segments that
 * need broader matching than a literal route).
 *
 * Backend gate runs as an intersection alongside the role's permissions:
 *   user can visit X iff (some role's perm matches X's <RequirePermission>)
 *                       AND (some role's URL list matches X's path)
 */
const RoleUrlsModal = ({ show, onHide, role, onSaved }: Props) => {
  const routesMap = permissionRoutesManifest as CodeToRoutes;

  // Build a flat catalog of {path, perm} from the manifest; group by perm.
  // Same grouped-select pattern as RolePermissionsModal.
  const grouped: GroupBase<RouteOption>[] = useMemo(() => {
    const buckets: Record<string, RouteOption[]> = {};
    for (const [perm, paths] of Object.entries(routesMap)) {
      for (const p of paths) {
        const group = perm.indexOf(".") > 0 ? perm.slice(0, perm.indexOf(".")) : "(other)";
        if (!buckets[group]) buckets[group] = [];
        buckets[group].push({ label: p, value: p, perm });
      }
    }
    return Object.keys(buckets)
      .sort((a, b) => (a === "(other)" ? 1 : b === "(other)" ? -1 : a.localeCompare(b)))
      .map((name) => ({
        label: prettifyGroupName(name) + ` (${buckets[name].length})`,
        options: buckets[name].sort((a, b) => a.value.localeCompare(b.value)),
      }));
  }, [routesMap]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [customInput, setCustomInput] = useState("");
  const [customError, setCustomError] = useState("");

  useEffect(() => {
    if (!show || !role) return;
    setLoading(true);
    setCustomInput("");
    setCustomError("");
    axios
      .get<string[]>(`${API_URL}/role/${role.id}/urls`)
      .then((res) => setSelectedPaths(new Set(res.data || [])))
      .catch(() => {
        setSelectedPaths(new Set());
        showErrorToast("Failed to load role URLs");
      })
      .finally(() => setLoading(false));
  }, [show, role]);

  // Split selected paths into "in catalog" (renderable as Select chips) and
  // "custom" (free-form additions the manifest doesn't know about).
  const allCatalogPaths = useMemo(() => {
    const set = new Set<string>();
    for (const g of grouped) for (const o of g.options) set.add(o.value);
    return set;
  }, [grouped]);

  const catalogSelected: RouteOption[] = useMemo(() => {
    const flat = grouped.flatMap((g) => g.options);
    return flat.filter((o) => selectedPaths.has(o.value));
  }, [grouped, selectedPaths]);

  const customPaths = useMemo(
    () => Array.from(selectedPaths).filter((p) => !allCatalogPaths.has(p)),
    [selectedPaths, allCatalogPaths]
  );

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

  // Toggle every catalog route in a group on/off in one click. Custom paths are
  // untouched — they live outside the catalog groups.
  const handleSelectAllGroup = (groupOpts: RouteOption[]) => {
    const allOn = groupOpts.every((o) => selectedPaths.has(o.value));
    const next = new Set(selectedPaths);
    for (const o of groupOpts) {
      if (allOn) next.delete(o.value);
      else next.add(o.value);
    }
    setSelectedPaths(next);
  };

  const handleSave = async () => {
    if (!role) return;
    setSaving(true);
    try {
      await axios.put(`${API_URL}/role/${role.id}/urls`, {
        paths: Array.from(selectedPaths),
      });
      showSuccessToast(`URL access updated for ${role.name}`);
      onSaved?.();
      onHide();
    } catch {
      showErrorToast("Failed to update URL access");
    } finally {
      setSaving(false);
    }
  };

  if (!show || !role) return null;

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
          backgroundColor: "#fff", borderRadius: "16px", maxWidth: "780px",
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
              <i className="bi bi-globe me-2"></i>URL Access
            </h6>
            <p className="mb-0 text-white" style={{ fontSize: "0.82rem", opacity: 0.85 }}>
              {role.name}
            </p>
          </div>
          <button type="button" className="btn-close btn-close-white" onClick={onHide}></button>
        </div>

        <div style={{ padding: "1rem 1.5rem", overflowY: "auto", flex: 1 }}>
          <p style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: "0.5rem" }}>
            Pick which React routes this role unlocks. Users see a screen only
            if BOTH the permission gate and at least one of their roles'
            URL list pass (intersection). Use <code>:id</code> for parametric
            segments and <code>/x/*</code> for prefix wildcards.
          </p>

          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border spinner-border-sm text-primary"></div>
              <span className="ms-2 text-muted">Loading...</span>
            </div>
          ) : (
            <>
              <label className="form-label fw-bold" style={{ fontSize: "0.85rem" }}>
                Catalog routes
              </label>
              <Select<RouteOption, true, GroupBase<RouteOption>>
                isMulti
                closeMenuOnSelect={false}
                options={grouped}
                value={catalogSelected}
                onChange={(opts) => {
                  const nextCatalog = new Set((opts || []).map((o) => o.value));
                  // Preserve any custom paths that aren't in the catalog.
                  const next = new Set<string>(customPaths);
                  for (const p of Array.from(nextCatalog)) next.add(p);
                  setSelectedPaths(next);
                }}
                placeholder="Choose routes from the catalog..."
                noOptionsMessage={() => "No routes available"}
                formatGroupLabel={(g) => (
                  <UrlGroupHeader
                    label={g.label}
                    onToggle={() => handleSelectAllGroup(g.options as RouteOption[])}
                    selectedCount={(g.options as RouteOption[]).filter((o) => selectedPaths.has(o.value)).length}
                    totalCount={g.options.length}
                  />
                )}
                formatOptionLabel={(opt) => (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{opt.value}</span>
                    <span style={{
                      fontSize: "0.7rem", fontWeight: 600,
                      padding: "2px 8px", borderRadius: 999,
                      background: "#fef3c7", color: "#92400e",
                    }}>
                      gated by <code style={{ background: "transparent" }}>{opt.perm}</code>
                    </span>
                  </div>
                )}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                menuPosition="fixed"
                styles={{
                  control: (base) => ({ ...base, borderRadius: "8px", fontSize: "0.85rem", minHeight: "42px" }),
                  multiValue: (base) => ({ ...base, fontSize: "0.78rem", fontFamily: "monospace" }),
                  valueContainer: (base) => ({ ...base, maxHeight: "200px", overflowY: "auto" }),
                  menuPortal: (base) => ({ ...base, zIndex: 10000 }),
                  menu: (base) => ({ ...base, zIndex: 10000 }),
                  // Custom header (formatGroupLabel) owns its own padding/bg.
                  groupHeading: (base) => ({ ...base, padding: 0, marginBottom: 0 }),
                }}
              />

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

              <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#9ca3af" }}>
                {selectedPaths.size} path{selectedPaths.size === 1 ? "" : "s"} selected
              </div>
            </>
          )}
        </div>

        <div style={{ padding: "0.75rem 1.5rem", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
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
  );
};

// ── Group header with click-to-toggle-all (mirrors RolePermissionsModal) ──────
interface UrlGroupHeaderProps {
  label: string;
  onToggle: () => void;
  selectedCount: number;
  totalCount: number;
}
const UrlGroupHeader = ({ label, onToggle, selectedCount, totalCount }: UrlGroupHeaderProps) => {
  const allOn = selectedCount === totalCount && totalCount > 0;
  const someOn = selectedCount > 0 && !allOn;
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onToggle();
      }}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 12px",
        background: "#f3f4f6",
        cursor: "pointer",
        fontSize: "0.78rem",
        fontWeight: 700,
        color: "#374151",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        userSelect: "none",
      }}
      title={allOn ? "Click to clear all in this group" : "Click to select all in this group"}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <GroupCheckbox allOn={allOn} someOn={someOn} />
        <span>{label}</span>
      </span>
      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: allOn ? "#059669" : someOn ? "#d97706" : "#9ca3af" }}>
        {allOn ? "All selected" : someOn ? `${selectedCount} of ${totalCount} · select all` : "Select all"}
      </span>
    </div>
  );
};

// Tri-state checkbox glyph: empty / dash (some) / check (all). Visual only.
const GroupCheckbox = ({ allOn, someOn }: { allOn: boolean; someOn: boolean }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 16,
      height: 16,
      borderRadius: 4,
      border: `1.5px solid ${allOn || someOn ? "#0891b2" : "#9ca3af"}`,
      background: allOn || someOn ? "#0891b2" : "#fff",
      color: "#fff",
      fontSize: "0.7rem",
      lineHeight: 1,
      flexShrink: 0,
    }}
  >
    {allOn ? "✓" : someOn ? "–" : ""}
  </span>
);

function prettifyGroupName(g: string): string {
  if (g === "(other)") return "(other)";
  return g
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export default RoleUrlsModal;
