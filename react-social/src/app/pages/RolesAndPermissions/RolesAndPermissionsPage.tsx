import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import PageHeader from "../../components/PageHeader";
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
      />

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
