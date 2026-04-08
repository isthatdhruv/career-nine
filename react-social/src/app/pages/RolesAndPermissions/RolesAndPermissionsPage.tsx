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
    <div
      className="min-vh-100"
      style={{
        background: "linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)",
        padding: "1rem 1.25rem",
      }}
    >
      {/* Header */}
      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: "12px" }}>
        <div className="card-body p-3">
          <div className="d-flex align-items-center gap-3">
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <i className="bi bi-shield-lock-fill text-white" style={{ fontSize: "1.2rem" }}></i>
            </div>
            <div>
              <h5 className="mb-0 fw-bold" style={{ color: "#1a1a2e" }}>Roles & Permissions</h5>
              <p className="text-muted mb-0" style={{ fontSize: "0.82rem" }}>
                Define roles and bundle them into groups for easy assignment
              </p>
            </div>
          </div>
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
