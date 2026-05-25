import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import PageHeader from "../../components/PageHeader";
import RolesPanel from "./components/RolesPanel";
import RoleGroupsPanel from "./components/RoleGroupsPanel";
import { showErrorToast, showSuccessToast } from "../../utils/toast";

export interface RoleItem {
  id?: number;
  name: string;
  url: string;
  display: boolean;
}

export interface RoleGroupItem {
  id?: number;
  name: string;
  display: number;
  roleRoleGroupMappings: any[];
}

const API_URL = process.env.REACT_APP_API_URL;

interface RefreshReport {
  totals?: { enumCodes: number; inUseCodes: number; orphanCodes: number; unusedCodes: number };
  orphanCodes?: string[];
  unusedCodes?: string[];
  seeded?: string[];
  updated?: string[];
  unchanged?: number;
  committed?: boolean;
  refusedDueToOrphans?: boolean;
  codeToEndpoints?: Record<string, string[]>;
}

const RolesAndPermissionsPage = () => {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [roleGroups, setRoleGroups] = useState<RoleGroupItem[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshReport, setRefreshReport] = useState<RefreshReport | null>(null);
  const [codeToEndpoints, setCodeToEndpoints] = useState<Record<string, string[]>>({});

  const fetchRoles = useCallback(async () => {
    setLoadingRoles(true);
    try {
      const res = await axios.get(`${API_URL}/role/get`);
      setRoles(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Failed to fetch roles:", e);
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  const fetchRoleGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await axios.get(`${API_URL}/rolegroup/get`);
      setRoleGroups(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Failed to fetch role groups:", e);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  // Read-only introspect on page load — single fetch shared across both panels'
  // child modals so they don't each fire their own.
  const fetchIntrospect = useCallback(async () => {
    try {
      const res = await axios.get<RefreshReport>(`${API_URL}/permission/introspect`);
      setCodeToEndpoints(res.data.codeToEndpoints || {});
    } catch (e) {
      console.error("Failed to load permission introspection:", e);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchRoleGroups();
    fetchIntrospect();
  }, [fetchRoles, fetchRoleGroups, fetchIntrospect]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await axios.post<RefreshReport>(`${API_URL}/permission/refresh`);
      setRefreshReport(res.data);
      setCodeToEndpoints(res.data.codeToEndpoints || {});
      const seeded = res.data.seeded?.length || 0;
      const updated = res.data.updated?.length || 0;
      const orphans = res.data.orphanCodes?.length || 0;
      if (res.data.refusedDueToOrphans) {
        showErrorToast(`Refresh blocked: ${orphans} orphan code${orphans === 1 ? "" : "s"} — see modal`);
      } else if (seeded + updated === 0) {
        showSuccessToast("Permission catalog already in sync");
      } else {
        showSuccessToast(`${seeded} new · ${updated} updated`);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Refresh failed";
      showErrorToast(typeof msg === "string" ? msg : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-shield-lock-fill" />}
        title="Roles & Permissions"
        subtitle={
          <>
            <strong>{roles.length}</strong> role{roles.length === 1 ? "" : "s"} ·{" "}
            <strong>{roleGroups.length}</strong> group{roleGroups.length === 1 ? "" : "s"}
          </>
        }
        actions={[
          {
            label: refreshing ? "Refreshing..." : "Refresh Permissions",
            iconClass: "bi-arrow-clockwise",
            onClick: handleRefresh,
            variant: "primary",
            disabled: refreshing,
          },
        ]}
      />

      {/* Roles Panel */}
      <RolesPanel
        roles={roles}
        loading={loadingRoles}
        onRefresh={fetchRoles}
        codeToEndpoints={codeToEndpoints}
      />

      {/* Role Groups Panel */}
      <RoleGroupsPanel
        roleGroups={roleGroups}
        roles={roles}
        loading={loadingGroups}
        onRefresh={() => { fetchRoleGroups(); }}
      />

      {/* Refresh report modal — surfaces orphan codes inline so the dev
          knows exactly which @auth.allows literals need an enum entry. */}
      {refreshReport && (
        <RefreshReportModal report={refreshReport} onClose={() => setRefreshReport(null)} />
      )}
    </div>
  );
};

interface RefreshReportModalProps {
  report: RefreshReport;
  onClose: () => void;
}
const RefreshReportModal = ({ report, onClose }: RefreshReportModalProps) => {
  const t = report.totals;
  const orphans = report.orphanCodes || [];
  const seeded = report.seeded || [];
  const updated = report.updated || [];
  const unused = report.unusedCodes || [];

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)", zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff", borderRadius: "16px", maxWidth: 720, width: "94%",
          maxHeight: "85vh", display: "flex", flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          background: orphans.length > 0
            ? "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)"
            : "linear-gradient(135deg, #059669 0%, #047857 100%)",
          padding: "1rem 1.5rem", color: "#fff",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <h6 className="mb-0 fw-bold" style={{ fontSize: "1rem" }}>
              <i className={`bi bi-${orphans.length > 0 ? "exclamation-triangle-fill" : "check-circle-fill"} me-2`} />
              Permission Refresh Report
            </h6>
            {t && (
              <p className="mb-0" style={{ fontSize: "0.82rem", opacity: 0.9 }}>
                {t.enumCodes} catalog · {t.inUseCodes} in use · {t.orphanCodes} orphans · {t.unusedCodes} unused
              </p>
            )}
          </div>
          <button type="button" className="btn-close btn-close-white" onClick={onClose} />
        </div>

        <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
          {orphans.length > 0 && (
            <Section
              tone="danger"
              title={`Orphan codes — must be added to PermissionCode enum (${orphans.length})`}
              hint="These permission codes are referenced by @PreAuthorize in controllers but don't exist in the PermissionCode enum. No DB writes were committed. Add an enum entry with a one-line description, restart the backend, and click Refresh again."
              items={orphans}
            />
          )}
          {seeded.length > 0 && (
            <Section
              tone="success"
              title={`Newly seeded (${seeded.length})`}
              hint="These codes were added to the permission table from the enum."
              items={seeded}
            />
          )}
          {updated.length > 0 && (
            <Section
              tone="info"
              title={`Description updated (${updated.length})`}
              hint="Enum description changed; permission row updated to match."
              items={updated}
            />
          )}
          {orphans.length === 0 && seeded.length === 0 && updated.length === 0 && (
            <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
              Permission catalog is already in sync with the codebase. Nothing to do.
            </div>
          )}
          {unused.length > 0 && (
            <Section
              tone="muted"
              title={`Unused codes (${unused.length}) — informational`}
              hint="In the PermissionCode enum but not referenced by any controller. Common for FE-only permissions that gate React routes without a matching backend endpoint."
              items={unused}
              collapsible
            />
          )}
        </div>

        <div style={{
          padding: "0.75rem 1.5rem", borderTop: "1px solid #f3f4f6",
          display: "flex", justifyContent: "flex-end",
        }}>
          <button
            className="btn btn-sm btn-light"
            onClick={onClose}
            style={{ borderRadius: "6px" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface SectionProps {
  tone: "success" | "danger" | "info" | "muted";
  title: string;
  hint: string;
  items: string[];
  collapsible?: boolean;
}
const Section = ({ tone, title, hint, items, collapsible }: SectionProps) => {
  const [open, setOpen] = useState(!collapsible);
  const colors = {
    success: { bg: "#ecfdf5", border: "#a7f3d0", title: "#065f46" },
    danger: { bg: "#fef2f2", border: "#fecaca", title: "#991b1b" },
    info: { bg: "#eff6ff", border: "#bfdbfe", title: "#1e40af" },
    muted: { bg: "#f9fafb", border: "#e5e7eb", title: "#374151" },
  }[tone];
  return (
    <div
      style={{
        background: colors.bg, border: `1px solid ${colors.border}`,
        borderRadius: 10, padding: "12px 14px", marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontWeight: 700, color: colors.title, fontSize: "0.85rem",
          cursor: collapsible ? "pointer" : "default",
        }}
        onClick={() => collapsible && setOpen((v) => !v)}
      >
        <span>{title}</span>
        {collapsible && <span style={{ fontSize: "0.78rem" }}>{open ? "hide" : "show"}</span>}
      </div>
      <p style={{ fontSize: "0.75rem", color: "#6b7280", margin: "4px 0 8px" }}>{hint}</p>
      {open && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 220, overflowY: "auto" }}>
          {items.map((c) => (
            <li
              key={c}
              style={{
                fontFamily: "monospace", fontSize: "0.78rem",
                padding: "3px 0", color: "#1f2937",
              }}
            >
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RolesAndPermissionsPage;
