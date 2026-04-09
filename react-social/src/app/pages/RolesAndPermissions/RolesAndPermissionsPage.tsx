import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import RolesPanel from "./components/RolesPanel";
import RoleGroupsPanel from "./components/RoleGroupsPanel";

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

const RolesAndPermissionsPage = () => {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [roleGroups, setRoleGroups] = useState<RoleGroupItem[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);

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

  useEffect(() => {
    fetchRoles();
    fetchRoleGroups();
  }, [fetchRoles, fetchRoleGroups]);

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px" }}>
      {/* Page Header */}
      <div className="d-flex align-items-center gap-3" style={{ marginBottom: "24px" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="bi bi-shield-lock-fill text-white" style={{ fontSize: "1.1rem" }}></i>
        </div>
        <div>
          <h4 style={{ margin: 0, color: "#111827", fontWeight: 700, fontSize: "1.3rem" }}>Roles & Permissions</h4>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.82rem" }}>
            Define roles (page access) and bundle them into groups for easy user assignment
          </p>
        </div>
      </div>

      {/* Roles Panel */}
      <RolesPanel
        roles={roles}
        loading={loadingRoles}
        onRefresh={fetchRoles}
      />

      {/* Role Groups Panel */}
      <RoleGroupsPanel
        roleGroups={roleGroups}
        roles={roles}
        loading={loadingGroups}
        onRefresh={() => { fetchRoleGroups(); }}
      />
    </div>
  );
};

export default RolesAndPermissionsPage;
