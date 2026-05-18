import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Select, { GroupBase } from "react-select";
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

interface OptionRow {
  label: string;          // the code, for react-select's filter input
  value: string;          // the code
  description?: string;
  routes: string[];       // FE routes gated by this code
  endpoints: string[];    // BE endpoints gated by this code
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [endpointsMap, setEndpointsMap] = useState<CodeToEndpoints>(
    codeToEndpoints || {}
  );

  // FE manifest (build-time generated) is a plain JSON import.
  const routesMap = permissionRoutesManifest as CodeToRoutes;

  useEffect(() => {
    if (!show || targets.length === 0) return;
    setLoading(true);

    const calls: Promise<any>[] = [
      axios.get<Permission[]>(`${API_URL}/permission/getAll`),
    ];

    // For single-Role mode: pre-tick the role's current permissions.
    // For bulk mode: start with empty selection — admin's input is intentional.
    if (!isBulk) {
      calls.push(axios.get<string[]>(`${API_URL}/role/${targets[0].id}/permissions`));
    }

    // Fetch the backend endpoint coverage if the parent didn't supply it.
    if (!codeToEndpoints) {
      calls.push(axios.get(`${API_URL}/permission/introspect`));
    }

    Promise.all(calls)
      .then((results) => {
        const catalogRes = results[0];
        setCatalog(catalogRes.data || []);

        if (!isBulk) {
          const currentRes = results[1];
          setSelectedCodes(new Set(currentRes.data || []));
        } else {
          setSelectedCodes(new Set());
        }

        if (!codeToEndpoints) {
          const introspectRes = results[results.length - 1];
          const map = (introspectRes?.data?.codeToEndpoints || {}) as CodeToEndpoints;
          setEndpointsMap(map);
        }
      })
      .catch(() => {
        setCatalog([]);
        setSelectedCodes(new Set());
        showErrorToast("Failed to load permissions");
      })
      .finally(() => setLoading(false));
  }, [show, targets, isBulk, codeToEndpoints]);

  // ── Derive grouped options ────────────────────────────────────────────
  // Group by the first segment of the code (before the first '.'). Codes that
  // have no dot land in an "(other)" group at the end.
  const grouped: GroupBase<OptionRow>[] = useMemo(() => {
    const buckets: Record<string, OptionRow[]> = {};
    for (const p of catalog) {
      const dot = p.code.indexOf(".");
      const group = dot > 0 ? p.code.slice(0, dot) : "(other)";
      if (!buckets[group]) buckets[group] = [];
      buckets[group].push({
        label: p.code,
        value: p.code,
        description: p.description,
        routes: routesMap[p.code] || [],
        endpoints: endpointsMap[p.code] || [],
      });
    }
    const groupNames = Object.keys(buckets).sort((a, b) => {
      if (a === "(other)") return 1;
      if (b === "(other)") return -1;
      return a.localeCompare(b);
    });
    return groupNames.map((name) => ({
      label: prettifyGroupName(name) + ` (${buckets[name].length})`,
      options: buckets[name].sort((a, b) => a.value.localeCompare(b.value)),
    }));
  }, [catalog, routesMap, endpointsMap]);

  const selectedOptions: OptionRow[] = useMemo(() => {
    const all = grouped.flatMap((g) => g.options);
    return all.filter((o) => selectedCodes.has(o.value));
  }, [grouped, selectedCodes]);

  const handleSelectAllGroup = (groupLabel: string, groupOpts: OptionRow[]) => {
    // Toggle: if every option in this group is already selected, clear them;
    // otherwise add the missing ones.
    const allOn = groupOpts.every((o) => selectedCodes.has(o.value));
    const next = new Set(selectedCodes);
    for (const o of groupOpts) {
      if (allOn) next.delete(o.value);
      else next.add(o.value);
    }
    setSelectedCodes(next);
  };

  const handleSave = async () => {
    if (targets.length === 0) return;
    setSaving(true);
    const codes = Array.from(selectedCodes);

    try {
      const results = await Promise.allSettled(
        targets.map((t) =>
          axios.put(`${API_URL}/role/${t.id}/permissions`, { codes })
        )
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
              <p style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: "0.5rem" }}>
                Permissions follow the <code>resource.verb</code> convention and are
                grouped here by resource. Hover the badges on a permission to see
                exactly which FE routes and BE endpoints it unlocks.
                {isBulk && (
                  <span style={{ color: "#dc2626" }}>
                    {" "}Bulk mode: saving will <strong>replace</strong> the
                    permission set on all {targets.length} selected roles.
                  </span>
                )}
              </p>

              <Select<OptionRow, true, GroupBase<OptionRow>>
                isMulti
                closeMenuOnSelect={false}
                options={grouped}
                value={selectedOptions}
                onChange={(opts) => setSelectedCodes(new Set((opts || []).map((o) => o.value)))}
                placeholder="Choose permissions..."
                noOptionsMessage={() => "No permissions available"}
                formatOptionLabel={(opt) => <OptionLabelRow opt={opt} />}
                formatGroupLabel={(g) => (
                  <GroupHeader
                    label={g.label}
                    onToggle={() => handleSelectAllGroup(g.label, g.options as OptionRow[])}
                    selectedCount={(g.options as OptionRow[]).filter((o) => selectedCodes.has(o.value)).length}
                    totalCount={g.options.length}
                  />
                )}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                menuPosition="fixed"
                styles={{
                  control: (base) => ({ ...base, borderRadius: "8px", fontSize: "0.85rem", minHeight: "42px" }),
                  multiValue: (base) => ({ ...base, fontSize: "0.78rem", fontFamily: "monospace" }),
                  valueContainer: (base) => ({ ...base, maxHeight: "200px", overflowY: "auto" }),
                  menuPortal: (base) => ({ ...base, zIndex: 10000 }),
                  menu: (base) => ({ ...base, zIndex: 10000 }),
                  groupHeading: (base) => ({ ...base, padding: 0, marginBottom: 0 }),
                  option: (base) => ({ ...base, padding: "8px 12px" }),
                }}
              />

              <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#9ca3af" }}>
                {selectedCodes.size} of {catalog.length} permissions selected
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
  );
};

// ── Group header with click-to-toggle-all ────────────────────────────────────
interface GroupHeaderProps {
  label: string;
  onToggle: () => void;
  selectedCount: number;
  totalCount: number;
}
const GroupHeader = ({ label, onToggle, selectedCount, totalCount }: GroupHeaderProps) => {
  const allOn = selectedCount === totalCount;
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
      title="Click to toggle all permissions in this group"
    >
      <span>{label}</span>
      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: allOn ? "#059669" : someOn ? "#d97706" : "#9ca3af" }}>
        {allOn ? "All selected" : `${selectedCount} of ${totalCount}`}
      </span>
    </div>
  );
};

// ── Single option row: code · description · route/endpoint badges ────────────
interface OptionLabelRowProps {
  opt: OptionRow;
}
const OptionLabelRow = ({ opt }: OptionLabelRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const totalCoverage = opt.routes.length + opt.endpoints.length;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{opt.value}</span>
        {opt.description && (
          <span style={{ color: "#6b7280", fontSize: "0.78rem" }}>{opt.description}</span>
        )}
        {opt.routes.length > 0 && (
          <span style={badgeStyle("#dbeafe", "#1e40af")}>
            {opt.routes.length} route{opt.routes.length === 1 ? "" : "s"}
          </span>
        )}
        {opt.endpoints.length > 0 && (
          <span style={badgeStyle("#fef3c7", "#92400e")}>
            {opt.endpoints.length} endpoint{opt.endpoints.length === 1 ? "" : "s"}
          </span>
        )}
        {totalCoverage > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#2563eb",
              fontSize: "0.72rem",
              padding: 0,
              cursor: "pointer",
            }}
          >
            {expanded ? "hide" : "show"}
          </button>
        )}
      </div>
      {expanded && totalCoverage > 0 && (
        <div style={{ marginTop: 6, paddingLeft: 12, borderLeft: "2px solid #e5e7eb" }}>
          {opt.routes.length > 0 && (
            <div style={{ fontSize: "0.74rem", color: "#1e40af", marginBottom: 4 }}>
              <span style={{ fontWeight: 700 }}>FE routes:</span>{" "}
              <span style={{ fontFamily: "monospace" }}>{opt.routes.join(", ")}</span>
            </div>
          )}
          {opt.endpoints.length > 0 && (
            <div style={{ fontSize: "0.74rem", color: "#92400e" }}>
              <span style={{ fontWeight: 700 }}>BE endpoints:</span>{" "}
              <span style={{ fontFamily: "monospace" }}>{opt.endpoints.join(", ")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const badgeStyle = (bg: string, fg: string): React.CSSProperties => ({
  fontSize: "0.7rem",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 999,
  background: bg,
  color: fg,
});

function prettifyGroupName(g: string): string {
  if (g === "(other)") return "(other)";
  return g
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export default RolePermissionsModal;
