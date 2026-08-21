import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Select from "react-select";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import { ActionIcon } from "../../../components/ActionIcon";
import permissionRoutesManifest from "../../../permissions-manifest.json";
import { deriveUrlsForPerms } from "../../../modules/auth/core/deriveUrls";
import type { Scope } from "../../../modules/auth/core/_models";
import type { RoleItem, RoleGroupItem } from "../RolesAndPermissionsPage";
import RolePermissionsModal from "./RolePermissionsModal";
import ScopeRowsEditor from "./ScopeRowsEditor";

const API_URL = process.env.REACT_APP_API_URL;

/**
 * Guided role-group builder:
 *   1. Group     — name the role group
 *   2. Roles     — attach existing roles or create new ones inline
 *   3. Permissions — per-role permission sets (URL whitelist auto-syncs)
 *   4. Review    — effective permissions + reachable pages of the group
 *   5. Allot     — assign the group to users with ABAC scope rows
 *
 * The group is persisted when leaving step 2 (so steps 3-5 operate on real
 * ids); everything after that edits live data — closing the wizard early
 * leaves a usable (if incomplete) group behind, visible in the panel below.
 */
interface Props {
  show: boolean;
  onClose: () => void;
  roles: RoleItem[];
  roleGroups: RoleGroupItem[];
  /** Refetch roles + groups in the parent page. */
  onDataChanged: () => void;
  codeToEndpoints?: Record<string, string[]>;
}

interface Opt {
  label: string;
  value: number;
}

interface RegisteredUser {
  id: number;
  name?: string;
  email?: string;
  userRoleGroupMappings?: { id: number; roleGroup?: { id: number; name?: string } }[];
}

const STEPS = ["Group", "Roles", "Permissions", "Review", "Allot"] as const;

const GroupBuilderWizard = ({ show, onClose, roles, roleGroups, onDataChanged, codeToEndpoints }: Props) => {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // Step 1
  const [groupName, setGroupName] = useState("");
  const [groupId, setGroupId] = useState<number | null>(null);

  // Step 2
  const [selectedRoles, setSelectedRoles] = useState<Opt[]>([]);
  const [newRoleName, setNewRoleName] = useState("");

  // Step 3
  const [permsByRole, setPermsByRole] = useState<Record<number, string[]>>({});
  const [permModalRole, setPermModalRole] = useState<Opt | null>(null);

  // Step 5
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Opt[]>([]);
  const [scopeRows, setScopeRows] = useState<Scope[]>([]);

  const manifest = permissionRoutesManifest as Record<string, string[]>;

  const roleOptions: Opt[] = useMemo(
    () => roles.filter((r) => r.id != null).map((r) => ({ label: r.name, value: r.id as number })),
    [roles]
  );

  useEffect(() => {
    if (!show) return;
    // Reset on open.
    setStep(0);
    setGroupName("");
    setGroupId(null);
    setSelectedRoles([]);
    setNewRoleName("");
    setPermsByRole({});
    setSelectedUsers([]);
    setScopeRows([]);
    axios
      .get(`${API_URL}/user/registered-users`)
      .then((res) => setUsers(res.data || []))
      .catch(() => setUsers([]));
  }, [show]);

  const fetchRolePerms = async (roleIds: number[]) => {
    const entries = await Promise.all(
      roleIds.map(async (id) => {
        try {
          const res = await axios.get<string[]>(`${API_URL}/role/${id}/permissions`);
          return [id, res.data || []] as const;
        } catch {
          return [id, []] as const;
        }
      })
    );
    setPermsByRole(Object.fromEntries(entries));
  };

  // ── Step transitions ─────────────────────────────────────────────────
  const persistGroup = async (): Promise<boolean> => {
    try {
      await axios.post(`${API_URL}/rolegroup/update`, {
        values: {
          name: groupName.trim(),
          id: groupId || undefined,
          display: 1,
          roleRoleGroupMappings: selectedRoles.map((r) => ({
            display: true,
            role: { display: true, name: r.label, id: r.value },
            roleGroup: groupId || undefined,
          })),
        },
      });
      if (groupId == null) {
        // The update endpoint doesn't return the created group — locate it by
        // name (newest wins when names collide).
        const res = await axios.get(`${API_URL}/rolegroup/get`);
        const match = (res.data || [])
          .filter((g: any) => g.name === groupName.trim())
          .sort((a: any, b: any) => (b.id || 0) - (a.id || 0))[0];
        if (!match) {
          showErrorToast("Group saved but could not be located — reopen it from the panel");
          return false;
        }
        setGroupId(match.id);
      }
      onDataChanged();
      return true;
    } catch {
      showErrorToast("Failed to save role group");
      return false;
    }
  };

  const createRoleInline = async () => {
    const name = newRoleName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await axios.put(`${API_URL}/role/update`, {
        values: { name, url: "", display: true },
      });
      onDataChanged();
      // Locate the new role once the parent refetch lands is racy — fetch
      // directly so we can select it immediately.
      const res = await axios.get(`${API_URL}/role/get`);
      const match = (res.data || [])
        .filter((r: any) => r.name === name)
        .sort((a: any, b: any) => (b.id || 0) - (a.id || 0))[0];
      if (match) setSelectedRoles((prev) => [...prev, { label: match.name, value: match.id }]);
      setNewRoleName("");
    } catch {
      showErrorToast("Failed to create role");
    } finally {
      setBusy(false);
    }
  };

  const handleNext = async () => {
    if (step === 0) {
      if (!groupName.trim()) return showErrorToast("Give the group a name");
      setStep(1);
    } else if (step === 1) {
      if (selectedRoles.length === 0) return showErrorToast("Attach at least one role");
      setBusy(true);
      const ok = await persistGroup();
      setBusy(false);
      if (!ok) return;
      await fetchRolePerms(selectedRoles.map((r) => r.value));
      setStep(2);
    } else if (step === 2) {
      await fetchRolePerms(selectedRoles.map((r) => r.value));
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  // ── Step 5: allot ────────────────────────────────────────────────────
  const handleAllot = async () => {
    if (groupId == null || selectedUsers.length === 0) return;
    setBusy(true);
    let failed = 0;
    for (const u of selectedUsers) {
      try {
        const user = users.find((x) => x.id === u.value);
        const existingGroupIds = (user?.userRoleGroupMappings || [])
          .map((m) => m.roleGroup?.id)
          .filter((x): x is number => x != null);
        const roleGroupTemp = Array.from(new Set([...existingGroupIds, groupId]));
        await axios.post(`${API_URL}/userrolegroupmapping/update`, {
          values: { user: u.value, roleGroupTemp, display: 1 },
        });
        const assignments = await axios.get(`${API_URL}/userrolegroupmapping/user/${u.value}`);
        const mine = (assignments.data || []).find((a: any) => a.roleGroupId === groupId);
        if (mine) {
          await axios.put(`${API_URL}/userrolegroupmapping/${mine.mappingId}/scopes`, {
            scopes: scopeRows,
          });
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
    setBusy(false);
    if (failed === 0) {
      showSuccessToast(`"${groupName}" allotted to ${selectedUsers.length} user${selectedUsers.length === 1 ? "" : "s"}`);
      onDataChanged();
      onClose();
    } else {
      showErrorToast(`${failed} of ${selectedUsers.length} allotments failed`);
      onDataChanged();
    }
  };

  // ── Review data ──────────────────────────────────────────────────────
  const effectivePerms = useMemo(() => {
    const set = new Set<string>();
    for (const codes of Object.values(permsByRole)) for (const c of codes) set.add(c);
    return Array.from(set).sort();
  }, [permsByRole]);

  const reachablePages = useMemo(
    () => deriveUrlsForPerms(effectivePerms, manifest),
    [effectivePerms, manifest]
  );

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)", zIndex: 9998,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff", borderRadius: 16, maxWidth: 860, width: "94%",
          maxHeight: "90vh", display: "flex", flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + stepper */}
        <div style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
          padding: "1rem 1.5rem", color: "#fff",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h6 className="mb-0 fw-bold" style={{ fontSize: "1rem" }}>
              <i className="bi bi-magic me-2" />
              New Role Group{groupName ? ` — ${groupName}` : ""}
            </h6>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
            {STEPS.map((label, i) => (
              <div
                key={label}
                onClick={() => i < step && setStep(i)}
                style={{
                  flex: 1, textAlign: "center", fontSize: "0.72rem", fontWeight: 600,
                  padding: "4px 0", borderRadius: 6, userSelect: "none",
                  cursor: i < step ? "pointer" : "default",
                  background: i === step ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
                  opacity: i <= step ? 1 : 0.55,
                }}
              >
                {i + 1}. {label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
          {step === 0 && (
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>Group name</label>
              <input
                className="form-control"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder='e.g. "School Coordinators"'
                autoFocus
                style={{ maxWidth: 420, borderRadius: 8, fontSize: "0.9rem" }}
              />
              <p style={{ fontSize: "0.76rem", color: "#6b7280", marginTop: 8 }}>
                A role group is what you allot to users. It bundles one or more
                roles; each role carries permissions, and page access follows the
                permissions automatically.
              </p>
            </div>
          )}

          {step === 1 && (
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>Roles in this group</label>
              <Select
                isMulti
                closeMenuOnSelect={false}
                options={roleOptions}
                value={selectedRoles}
                onChange={(opts: any) => setSelectedRoles(opts || [])}
                placeholder="Attach existing roles..."
                styles={{ control: (b: any) => ({ ...b, borderRadius: 8, fontSize: "0.85rem" }) }}
              />
              <div className="d-flex align-items-center gap-2 mt-3">
                <input
                  className="form-control form-control-sm"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createRoleInline()}
                  placeholder="...or create a new role"
                  style={{ maxWidth: 280, borderRadius: 6, fontSize: "0.82rem" }}
                />
                <button
                  className="btn btn-sm btn-light"
                  onClick={createRoleInline}
                  disabled={busy || !newRoleName.trim()}
                  style={{ borderRadius: 6, fontSize: "0.78rem" }}
                >
                  <ActionIcon type="add" size="sm" className="me-1" />
                  Create role
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p style={{ fontSize: "0.78rem", color: "#6b7280" }}>
                Pick each role's permissions. Saving a role's permissions also
                whitelists the pages those permissions gate — no separate URL
                setup needed.
              </p>
              {selectedRoles.map((r) => (
                <div
                  key={r.value}
                  className="d-flex align-items-center gap-3"
                  style={{ padding: "10px 12px", borderRadius: 8, background: "#fafbfc", border: "1px solid #f0f0f0", marginBottom: 8 }}
                >
                  <span style={{ fontWeight: 600, fontSize: "0.88rem", flex: 1 }}>{r.label}</span>
                  <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                    {(permsByRole[r.value] || []).length} permission{(permsByRole[r.value] || []).length === 1 ? "" : "s"}
                  </span>
                  <button
                    className="btn btn-sm btn-light"
                    onClick={() => setPermModalRole(r)}
                    style={{ borderRadius: 6, fontSize: "0.78rem" }}
                  >
                    <i className="bi bi-key me-1" />
                    Edit permissions
                  </button>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="d-flex gap-3 mb-3">
                <StatCard label="Roles" value={selectedRoles.length} />
                <StatCard label="Effective permissions" value={effectivePerms.length} />
                <StatCard label="Reachable pages" value={reachablePages.length} />
              </div>
              <ReviewList title="Permissions" items={effectivePerms} />
              <ReviewList title="Pages" items={reachablePages} />
              {effectivePerms.length === 0 && (
                <p style={{ fontSize: "0.8rem", color: "#dc2626" }}>
                  This group grants nothing yet — go back and add permissions to
                  its roles, or users allotted this group will see an empty menu.
                </p>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>Allot to users</label>
              <Select
                isMulti
                closeMenuOnSelect={false}
                options={users.map((u) => ({ label: u.name || u.email || `#${u.id}`, value: u.id }))}
                value={selectedUsers}
                onChange={(opts: any) => setSelectedUsers(opts || [])}
                placeholder="Select users..."
                styles={{ control: (b: any) => ({ ...b, borderRadius: 8, fontSize: "0.85rem" }) }}
              />
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>
                  ABAC scope for this allotment
                </label>
                <p style={{ fontSize: "0.74rem", color: "#6b7280", marginBottom: 6 }}>
                  The same scope rows are applied to each selected user's
                  assignment of this group (replacing any scopes they already
                  had on it). Scopes take effect on the user's next login or
                  token refresh.
                </p>
                <ScopeRowsEditor value={scopeRows} onChange={setScopeRows} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "0.75rem 1.5rem", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between" }}>
          <button
            className="btn btn-sm btn-light"
            onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
            disabled={busy}
            style={{ borderRadius: 6 }}
          >
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < 4 ? (
            <button
              className="btn btn-sm"
              onClick={handleNext}
              disabled={busy}
              style={{
                background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, padding: "6px 18px",
              }}
            >
              {busy ? <span className="spinner-border spinner-border-sm" /> : "Next"}
            </button>
          ) : (
            <button
              className="btn btn-sm"
              onClick={handleAllot}
              disabled={busy || selectedUsers.length === 0}
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, padding: "6px 18px",
              }}
            >
              {busy ? (
                <><span className="spinner-border spinner-border-sm me-1" />Allotting...</>
              ) : (
                <>Allot to {selectedUsers.length || "..."} user{selectedUsers.length === 1 ? "" : "s"}</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Per-role permission editing reuses the existing modal (which also
          auto-syncs the role's URL whitelist on save). */}
      <RolePermissionsModal
        show={permModalRole != null}
        onHide={() => setPermModalRole(null)}
        role={permModalRole ? { id: permModalRole.value, name: permModalRole.label } : null}
        codeToEndpoints={codeToEndpoints}
        onSaved={() => fetchRolePerms(selectedRoles.map((r) => r.value))}
      />
    </div>
  );
};

const StatCard = ({ label, value }: { label: string; value: number }) => (
  <div style={{
    flex: 1, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10,
    padding: "10px 14px", textAlign: "center",
  }}>
    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#111827" }}>{value}</div>
    <div style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600 }}>{label}</div>
  </div>
);

const ReviewList = ({ title, items }: { title: string; items: string[] }) => {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{ fontSize: "0.8rem", fontWeight: 700, color: "#374151", cursor: "pointer", userSelect: "none" }}
      >
        <i className={`bi bi-chevron-${open ? "down" : "right"} me-1`} />
        {title} ({items.length})
      </div>
      {open && (
        <div style={{
          fontFamily: "monospace", fontSize: "0.75rem", color: "#1f2937",
          maxHeight: 160, overflowY: "auto", paddingLeft: 18, marginTop: 4,
        }}>
          {items.map((x) => <div key={x}>{x}</div>)}
        </div>
      )}
    </div>
  );
};

export default GroupBuilderWizard;
