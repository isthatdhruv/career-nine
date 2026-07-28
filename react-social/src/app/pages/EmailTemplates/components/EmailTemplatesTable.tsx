import { FC, useEffect, useMemo, useState } from "react";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import {
  EmailTemplate,
  EmailTypeCatalogEntry,
  deleteEmailTemplate,
  getEmailTemplates,
  getEmailTypeCatalog,
} from "../API/EmailTemplate_APIs";
import EmailTemplateEditorModal from "./EmailTemplateEditorModal";

const EmailTemplatesTable: FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [catalog, setCatalog] = useState<EmailTypeCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [createType, setCreateType] = useState<string | undefined>(undefined);

  const fetchAll = async () => {
    try {
      setError(null);
      const [t, c] = await Promise.all([getEmailTemplates(), getEmailTypeCatalog()]);
      setTemplates(t.data || []);
      setCatalog(c.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const labelByType = useMemo(() => {
    const m = new Map<string, string>();
    catalog.forEach((c) => m.set(c.key, c.label));
    return m;
  }, [catalog]);

  const defaultByType = useMemo(() => {
    const m = new Map<string, EmailTemplate>();
    templates.forEach((t) => {
      if (t.isDefault) m.set(t.emailType, t);
    });
    return m;
  }, [templates]);

  const filtered = templates.filter((t) => !typeFilter || t.emailType === typeFilter);

  const openCreate = (type?: string) => {
    setEditing(null);
    setCreateType(type);
    setShowEditor(true);
  };
  const openEdit = (t: EmailTemplate) => {
    setEditing(t);
    setCreateType(undefined);
    setShowEditor(true);
  };

  const handleDelete = async (t: EmailTemplate) => {
    if (!window.confirm(`Delete template "${t.name}"? This cannot be undone.`)) return;
    setBusyId(t.id);
    try {
      await deleteEmailTemplate(t.id);
      showSuccessToast("Template deleted");
      fetchAll();
    } catch (err: any) {
      showErrorToast(err?.response?.data?.error || "Failed to delete template");
    } finally {
      setBusyId(null);
    }
  };

  const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 700, color: "#374151", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.3px", background: "#f9fafb", whiteSpace: "nowrap" };

  if (loading) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "48px", textAlign: "center" }}>
        <div className="spinner-border" style={{ color: "#4f46e5" }} role="status"></div>
        <p className="mt-3" style={{ color: "#6b7280" }}>Loading templates…</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "10px 14px", marginBottom: "16px", color: "#b91c1c", fontSize: "0.85rem" }} className="d-flex align-items-center">
          <i className="bi bi-exclamation-triangle-fill me-2"></i><span>{error}</span>
        </div>
      )}

      {/* Templates table */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
        <div style={{ padding: "16px" }}>
          <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
            <select className="form-select form-select-sm" style={{ maxWidth: "260px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.85rem" }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              {catalog.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{filtered.length} template{filtered.length === 1 ? "" : "s"}</span>
            <button className="btn btn-sm ms-auto" onClick={() => openCreate(typeFilter || undefined)} style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600 }}>
              <i className="bi bi-plus-lg me-1"></i>New Template
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-envelope-paper d-block mb-2" style={{ fontSize: "2rem", color: "#d1d5db" }}></i>
              <span style={{ color: "#6b7280" }}>No templates yet. Create one, or seed defaults as senders migrate.</span>
            </div>
          ) : (
            <table className="table table-hover align-middle mb-0" style={{ width: "100%", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  {["Name", "Type", "Default", "Delivery", "Status", "Actions"].map((h) => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: "#111827" }}>{t.name}</td>
                    <td style={{ padding: "8px 12px", color: "#4b5563" }}>{labelByType.get(t.emailType) || t.emailType}</td>
                    <td style={{ padding: "8px 12px" }}>
                      {t.isDefault
                        ? <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "3px 8px", borderRadius: "4px", background: "#4f46e5", color: "#fff" }}><i className="bi bi-star-fill me-1"></i>Default</span>
                        : <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: t.deliveryMode === "SYNC" ? "#fef3c7" : "#e0f2fe", color: t.deliveryMode === "SYNC" ? "#b45309" : "#0369a1" }}>{t.deliveryMode}</span>
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "4px 10px", borderRadius: "4px", background: t.active ? "#059669" : "#d97706", color: "#fff" }}>{t.active ? "Active" : "Inactive"}</span>
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <button className="btn btn-sm btn-light me-1" onClick={() => openEdit(t)} disabled={busyId === t.id} style={{ borderRadius: "6px", color: "#2563eb" }}><i className="bi bi-pencil-square"></i></button>
                      <button className="btn btn-sm btn-light" onClick={() => handleDelete(t)} disabled={busyId === t.id} style={{ borderRadius: "6px", color: "#dc2626" }}><i className="bi bi-trash"></i></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Scenario coverage — every EmailType and its default template */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", marginTop: "24px" }}>
        <div style={{ padding: "16px" }}>
          <div className="d-flex align-items-center mb-1">
            <i className="bi bi-diagram-3-fill me-2" style={{ color: "#4f46e5" }}></i>
            <span style={{ fontWeight: 700, color: "#111827" }}>Scenario coverage</span>
          </div>
          <p style={{ fontSize: "0.82rem", color: "#6b7280", marginBottom: "14px" }}>
            Every email the system can send. Types without a default template fall back to the built-in (inline) copy until you create one.
          </p>
          <table className="table table-hover align-middle mb-0" style={{ width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                {["Scenario", "Category", "Default template", ""].map((h, i) => <th key={i} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {catalog.map((c) => {
                const def = defaultByType.get(c.key);
                return (
                  <tr key={c.key} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: "#111827" }}>{c.label}</td>
                    <td style={{ padding: "8px 12px", color: "#6b7280" }}>{c.category}</td>
                    <td style={{ padding: "8px 12px" }}>
                      {def
                        ? <span style={{ color: "#111827" }}><i className="bi bi-check-circle-fill me-1" style={{ color: "#059669" }}></i>{def.name}</span>
                        : <span style={{ color: "#9ca3af" }}>— none (inline fallback)</span>}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      <button className="btn btn-sm btn-light" onClick={() => (def ? openEdit(def) : openCreate(c.key))} style={{ borderRadius: "6px", color: "#4f46e5", fontWeight: 600 }}>
                        {def ? "Edit" : "Create"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <EmailTemplateEditorModal
        show={showEditor}
        onHide={() => { setShowEditor(false); setEditing(null); }}
        template={editing}
        catalog={catalog}
        defaultType={createType}
        onSaved={fetchAll}
      />
    </>
  );
};

export default EmailTemplatesTable;
