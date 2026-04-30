import { useEffect, useState } from "react";
import axios from "axios";
import Select from "react-select";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import { ActionIcon } from "../../../components/ActionIcon";

const API_URL = process.env.REACT_APP_API_URL;

interface Props {
  show: boolean;
  onHide: () => void;
  user: { id: number; name: string } | null;
}

interface RoleGroupOption {
  label: string;
  value: number;
}

const UserRoleGroupModal = ({ show, onHide, user }: Props) => {
  const [roleGroupOptions, setRoleGroupOptions] = useState<RoleGroupOption[]>([]);
  const [currentAssignments, setCurrentAssignments] = useState<RoleGroupOption[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<RoleGroupOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!show || !user) return;
    setLoading(true);

    Promise.all([
      axios.get(`${API_URL}/rolegroup/get`),
      axios.get(`${API_URL}/userrolegroupmapping/get`),
    ])
      .then(([groupsRes, mappingsRes]) => {
        // Build role group options
        const groups = (groupsRes.data || []).map((g: any) => ({
          label: g.name,
          value: g.id,
        }));
        setRoleGroupOptions(groups);

        // Find current assignments for this user
        const allMappings = mappingsRes.data || [];
        const userMapping = allMappings.find((m: any) => m.id === user.id);
        const assigned: RoleGroupOption[] = [];
        if (userMapping?.userRoleGroupMappings) {
          for (const m of userMapping.userRoleGroupMappings) {
            if (m.roleGroup) {
              assigned.push({ label: m.roleGroup.name, value: m.roleGroup.id });
            }
          }
        }
        setCurrentAssignments(assigned);
        setSelectedGroups(assigned);
      })
      .catch(() => {
        setRoleGroupOptions([]);
        setCurrentAssignments([]);
      })
      .finally(() => setLoading(false));
  }, [show, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const values = {
        user: user.id,
        roleGroupTemp: selectedGroups.map((g) => g.value),
        display: 1,
      };
      await axios.post(`${API_URL}/userrolegroupmapping/update`, { values });
      showSuccessToast("Role groups updated successfully");
      onHide();
    } catch (err) {
      showErrorToast("Failed to update role groups");
    } finally {
      setSaving(false);
    }
  };

  if (!show || !user) return null;

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
          backgroundColor: "#fff", borderRadius: "16px", maxWidth: "550px",
          width: "94%", maxHeight: "80vh", overflow: "hidden",
          boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
          padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <h6 className="mb-0 text-white fw-bold" style={{ fontSize: "1rem" }}>
              <i className="bi bi-shield-check me-2"></i>Assign Role Groups
            </h6>
            <p className="mb-0 text-white" style={{ fontSize: "0.82rem", opacity: 0.85 }}>
              {user.name}
            </p>
          </div>
          <button type="button" className="btn-close btn-close-white" onClick={onHide}></button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.25rem 1.5rem" }}>
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border spinner-border-sm text-primary"></div>
              <span className="ms-2 text-muted">Loading...</span>
            </div>
          ) : (
            <>
              {/* Current assignments */}
              {currentAssignments.length > 0 && (
                <div className="mb-3">
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Current Assignments
                  </label>
                  <div className="d-flex flex-wrap gap-1 mt-1">
                    {currentAssignments.map((g) => (
                      <span key={g.value} style={{
                        fontSize: "0.78rem", fontWeight: 500, padding: "3px 10px", borderRadius: "12px",
                        background: "rgba(67, 97, 238, 0.08)", color: "#4361ee",
                      }}>
                        {g.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Role group selector */}
              <div className="mb-3">
                <label className="form-label fw-bold" style={{ fontSize: "0.85rem" }}>
                  Select Role Groups
                </label>
                <Select
                  isMulti
                  closeMenuOnSelect={false}
                  options={roleGroupOptions}
                  value={selectedGroups}
                  onChange={(opt: any) => setSelectedGroups(opt || [])}
                  placeholder="Choose role groups..."
                  noOptionsMessage={() => "No role groups available"}
                  styles={{
                    control: (base) => ({ ...base, borderRadius: "8px", fontSize: "0.85rem" }),
                    multiValue: (base) => ({ ...base, fontSize: "0.82rem" }),
                  }}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "0.75rem 1.5rem", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="btn btn-sm btn-light" onClick={onHide} style={{ borderRadius: "6px" }}>Cancel</button>
          <button
            className="btn btn-sm"
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, padding: "6px 16px",
            }}
          >
            {saving ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</> : <><ActionIcon type="approve" size="sm" className="me-1" />Save</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserRoleGroupModal;
