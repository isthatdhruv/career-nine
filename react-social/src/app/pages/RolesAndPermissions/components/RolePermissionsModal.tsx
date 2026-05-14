import { useEffect, useState } from "react";
import axios from "axios";
import Select from "react-select";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import { ActionIcon } from "../../../components/ActionIcon";

const API_URL = process.env.REACT_APP_API_URL;

interface Permission {
  id: number;
  code: string;
  description: string;
}

interface Option {
  label: string;
  value: string;
  description?: string;
}

interface Props {
  show: boolean;
  onHide: () => void;
  role: { id: number; name: string } | null;
}

const RolePermissionsModal = ({ show, onHide, role }: Props) => {
  const [allPermissions, setAllPermissions] = useState<Option[]>([]);
  const [selected, setSelected] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!show || !role) return;
    setLoading(true);

    Promise.all([
      axios.get<Permission[]>(`${API_URL}/permission/getAll`),
      axios.get<string[]>(`${API_URL}/role/${role.id}/permissions`),
    ])
      .then(([catalogRes, currentRes]) => {
        const catalog = (catalogRes.data || []).map((p) => ({
          label: p.code,
          value: p.code,
          description: p.description,
        }));
        setAllPermissions(catalog);

        const currentCodes = new Set(currentRes.data || []);
        setSelected(catalog.filter((o) => currentCodes.has(o.value)));
      })
      .catch(() => {
        setAllPermissions([]);
        setSelected([]);
        showErrorToast("Failed to load permissions");
      })
      .finally(() => setLoading(false));
  }, [show, role]);

  const handleSave = async () => {
    if (!role) return;
    setSaving(true);
    try {
      await axios.put(`${API_URL}/role/${role.id}/permissions`, {
        codes: selected.map((o) => o.value),
      });
      showSuccessToast("Permissions updated successfully");
      onHide();
    } catch {
      showErrorToast("Failed to update permissions");
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
          backgroundColor: "#fff", borderRadius: "16px", maxWidth: "720px",
          width: "94%", maxHeight: "85vh", display: "flex", flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
          padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <h6 className="mb-0 text-white fw-bold" style={{ fontSize: "1rem" }}>
              <i className="bi bi-key-fill me-2"></i>Manage Permissions
            </h6>
            <p className="mb-0 text-white" style={{ fontSize: "0.82rem", opacity: 0.85 }}>
              {role.name}
            </p>
          </div>
          <button type="button" className="btn-close btn-close-white" onClick={onHide}></button>
        </div>

        <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border spinner-border-sm text-primary"></div>
              <span className="ms-2 text-muted">Loading...</span>
            </div>
          ) : (
            <div className="mb-3">
              <label className="form-label fw-bold" style={{ fontSize: "0.85rem" }}>
                Select Permissions
              </label>
              <p style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: "0.5rem" }}>
                Permission codes follow the <code>resource.verb</code> convention. Users
                assigned to a role group containing this role will inherit all selected
                permissions on their next login.
              </p>
              <Select
                isMulti
                closeMenuOnSelect={false}
                options={allPermissions}
                value={selected}
                onChange={(opt: any) => setSelected(opt || [])}
                placeholder="Choose permissions..."
                noOptionsMessage={() => "No permissions available"}
                formatOptionLabel={(opt: Option) => (
                  <div>
                    <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{opt.label}</span>
                    {opt.description && (
                      <span style={{ color: "#6b7280", fontSize: "0.78rem", marginLeft: 8 }}>
                        {opt.description}
                      </span>
                    )}
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
                }}
              />
              <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#9ca3af" }}>
                {selected.length} of {allPermissions.length} permissions selected
              </div>
            </div>
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
            {saving ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</> : <><ActionIcon type="approve" size="sm" className="me-1" />Save</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RolePermissionsModal;
