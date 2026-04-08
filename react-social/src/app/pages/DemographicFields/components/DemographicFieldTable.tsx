import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteDemographicField } from '../API/DemographicField_APIs';
import { showErrorToast } from '../../../utils/toast';

type FieldDefinition = {
  fieldId: number;
  fieldName: string;
  displayLabel: string;
  fieldSource: string;
  systemFieldKey: string | null;
  dataType: string;
  isActive: boolean;
  options: any[];
};

type Props = {
  data: FieldDefinition[];
  setPageLoading: (loading: boolean) => void;
  refreshData: () => void;
};

const DATA_TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  TEXT: { bg: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" },
  SELECT_SINGLE: { bg: "rgba(139, 92, 246, 0.1)", color: "#8b5cf6" },
  SELECT_MULTI: { bg: "rgba(168, 85, 247, 0.1)", color: "#a855f7" },
  NUMBER: { bg: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" },
  DATE: { bg: "rgba(16, 185, 129, 0.1)", color: "#10b981" },
};

const DemographicFieldTable = ({ data, setPageLoading, refreshData }: Props) => {
  const navigate = useNavigate();
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");

  const handleDelete = async (id: number) => {
    try {
      setPageLoading(true);
      await deleteDemographicField(id);
      refreshData();
    } catch (error) {
      console.error('Error deleting field:', error);
      showErrorToast('Failed to delete field');
    } finally {
      setPageLoading(false);
      setDeleteConfirm(null);
    }
  };

  const filtered = data.filter((f) => {
    if (!searchText.trim()) return true;
    const q = searchText.trim().toLowerCase();
    return (
      f.fieldName.toLowerCase().includes(q) ||
      f.displayLabel.toLowerCase().includes(q) ||
      f.dataType.toLowerCase().includes(q)
    );
  });

  return (
    <>
      {/* Toolbar */}
      <div className="d-flex align-items-center gap-2 mb-3">
        <div className="position-relative" style={{ flex: "1 0 200px", maxWidth: "320px" }}>
          <i className="bi bi-search position-absolute" style={{ left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}></i>
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Search fields..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ paddingLeft: 36, borderRadius: "8px", border: "1.5px solid #e0e0e0", fontSize: "0.85rem" }}
          />
        </div>
        <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
          {filtered.length} of {data.length} fields
        </span>
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="table align-middle mb-0" style={{ width: "100%", tableLayout: "auto" }}>
          <thead>
            <tr style={{ background: "#f8f9fa" }}>
              {["#", "Field Name", "Display Label", "Source", "Data Type", "Options", "Status", "Actions"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 12px",
                    fontWeight: 600,
                    color: "#1a1a2e",
                    borderBottom: "2px solid #e0e0e0",
                    fontSize: "0.82rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((field, index) => {
              const dtStyle = DATA_TYPE_STYLES[field.dataType] || { bg: "rgba(107,114,128,0.1)", color: "#6b7280" };
              return (
                <tr key={field.fieldId} style={{ background: index % 2 === 0 ? "#fff" : "#fafbfc" }}>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0", fontSize: "0.82rem", color: "#9ca3af" }}>
                    {index + 1}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0" }}>
                    <span style={{ fontSize: "0.88rem", color: "#1f2937", fontWeight: 600 }}>{field.fieldName}</span>
                    {field.systemFieldKey && (
                      <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>maps to: {field.systemFieldKey}</div>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0", fontSize: "0.85rem", color: "#6b7280" }}>
                    {field.displayLabel}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0" }}>
                    <span style={{
                      fontSize: "0.75rem", fontWeight: 600, padding: "3px 8px", borderRadius: "6px",
                      background: field.fieldSource === "SYSTEM" ? "rgba(37, 99, 235, 0.1)" : "rgba(22, 163, 74, 0.1)",
                      color: field.fieldSource === "SYSTEM" ? "#2563eb" : "#16a34a",
                    }}>
                      {field.fieldSource}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0" }}>
                    <span style={{
                      fontSize: "0.75rem", fontWeight: 600, padding: "3px 8px", borderRadius: "6px",
                      background: dtStyle.bg, color: dtStyle.color,
                    }}>
                      {field.dataType}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0", fontSize: "0.85rem", color: "#6b7280" }}>
                    {field.options ? field.options.length : 0}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0" }}>
                    <span style={{
                      fontSize: "0.75rem", fontWeight: 600, padding: "3px 8px", borderRadius: "6px",
                      background: field.isActive ? "rgba(16, 185, 129, 0.1)" : "rgba(220, 38, 38, 0.08)",
                      color: field.isActive ? "#059669" : "#dc2626",
                    }}>
                      {field.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0" }}>
                    <div className="d-flex gap-1">
                      <button
                        className="btn btn-sm"
                        title="Edit"
                        onClick={() => navigate(`/demographic-fields/edit/${field.fieldId}`)}
                        style={{
                          width: "30px", height: "30px", padding: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "rgba(67, 97, 238, 0.1)", color: "#4361ee",
                          border: "1px solid rgba(67, 97, 238, 0.2)", borderRadius: "6px",
                        }}
                      >
                        <i className="bi bi-pencil-fill" style={{ fontSize: "0.75rem" }}></i>
                      </button>
                      {deleteConfirm === field.fieldId ? (
                        <>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleDelete(field.fieldId)}
                            style={{
                              padding: "4px 8px", borderRadius: "6px", fontWeight: 600, fontSize: "0.72rem",
                              background: "rgba(220, 38, 38, 0.1)", color: "#dc2626",
                              border: "1px solid rgba(220, 38, 38, 0.3)",
                            }}
                          >
                            Confirm
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => setDeleteConfirm(null)}
                            style={{
                              padding: "4px 8px", borderRadius: "6px", fontWeight: 600, fontSize: "0.72rem",
                              background: "#f1f5f9", color: "#64748b",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-sm"
                          title="Deactivate"
                          onClick={() => setDeleteConfirm(field.fieldId)}
                          style={{
                            width: "30px", height: "30px", padding: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "rgba(220, 38, 38, 0.1)", color: "#dc2626",
                            border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "6px",
                          }}
                        >
                          <i className="bi bi-trash-fill" style={{ fontSize: "0.75rem" }}></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-5">
                  <i className="bi bi-inbox d-block mb-2" style={{ fontSize: "2rem", color: "#d1d5db" }}></i>
                  <span className="text-muted">No demographic fields found. Create one to get started.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default DemographicFieldTable;
